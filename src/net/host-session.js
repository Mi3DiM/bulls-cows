/**
 * The Host side of a room.
 *
 * The Host is the only authority: it owns the game state, it validates every
 * inbound message, and it broadcasts a full snapshot after every change. A
 * guest can *ask*; only the Host decides.
 *
 * See `docs/adr/0003-host-authoritative-state.md`.
 */

import {
  CODE_REGENERATION_ATTEMPTS,
  GUEST_TIMEOUT_MS,
  HEARTBEAT_MS,
  MAX_PLAYERS,
  SEAT_HOLD_MS,
} from '../config.js';
import { MessageType, encodeMessage, parseGuestMessage } from '../core/protocol.js';
import { generateRoomCode } from '../core/room-code.js';
import {
  Phase,
  PlayerStatus,
  addPlayer,
  applyGuess,
  createInitialState,
  findPlayer,
  publicView,
  removePlayer,
  renamePlayer,
  setPlayerStatus,
  startGame,
} from '../core/state.js';
import { Emitter } from './emitter.js';
import { LinkFailure, LinkState, PeerLink } from './peer-link.js';

/**
 * @typedef {import('../core/state.js').GameState} GameState
 * @typedef {import('../core/state.js').Rules} Rules
 * @typedef {import('./peer-link.js').DataConnectionLike} DataConnectionLike
 */

/**
 * @typedef {object} HostSessionOptions
 * @property {import('./peer-link.js').PeerFactory} factory
 * @property {import('../core/rng.js').Rng} rng
 * @property {Rules} rules
 * @property {string} hostName
 * @property {number} hostAvatar
 * @property {string} hostLocale
 * @property {number} [maxPlayers]
 * @property {number} [heartbeatMs]
 * @property {number} [seatHoldMs]
 * @property {number} [guestTimeoutMs]
 * @property {number} [codeAttempts]
 */

/**
 * @typedef {object} ConnectedPlayer
 * @property {string} id
 * @property {string} name
 * @property {number} avatar
 * @property {string} locale
 * @property {DataConnectionLike} connection
 * @property {ReturnType<typeof setTimeout> | null} holdTimer
 * @property {number} lastSeen  When the Host last heard from this guest.
 */

/** The Host's own player id. */
export const HOST_PLAYER_ID = 'host';

/**
 * Runs a room.
 *
 * Emits:
 * - `state` → the public {@link GameState}, after every change
 * - `chat` → `{ from, name, text, at }`
 * - `notice` → `{ kind, text }`
 * - `status` → the transport state, for the UI banner
 */
export class HostSession extends Emitter {
  /** @type {PeerLink | null} */
  #link = null;

  /** @type {Map<string, ConnectedPlayer>} */
  #guests = new Map();

  /** @type {Map<string, string>} Client id to player id, for reconnects. */
  #clients = new Map();

  /** @type {Map<string, ReturnType<typeof setTimeout>>} Player id to seat-hold timer. */
  #holdTimers = new Map();

  /** @type {GameState} */
  #state;

  /** @type {string} */
  #code = '';

  /** @type {ReturnType<typeof setInterval> | null} */
  #heartbeatTimer = null;

  /** @type {HostSessionOptions} */
  #options;

  #closed = false;

  /**
   * @param {HostSessionOptions} options
   */
  constructor(options) {
    super();
    this.#options = options;
    this.#state = createInitialState(options.rules, {
      id: HOST_PLAYER_ID,
      name: options.hostName,
      avatar: options.hostAvatar,
      joinedAt: Date.now(),
    });
  }

  /**
   * The Host's display name.
   *
   * @returns {string}
   */
  #hostName() {
    return this.#state.players[0]?.name ?? this.#options.hostName;
  }

  /**
   * The room code, once the room has started.
   *
   * @returns {string}
   */
  get code() {
    return this.#code;
  }

  /**
   * The current state.
   *
   * @returns {GameState}
   */
  get state() {
    return this.#state;
  }

  /**
   * The number of connected guests.
   *
   * @returns {number}
   */
  get guestCount() {
    return this.#guests.size;
  }

  /**
   * Starts the room.
   *
   * Claims a room code, retrying with a fresh code if the one it drew is
   * already in use somewhere on the public signaling server.
   *
   * @returns {Promise<string>} The room code.
   */
  async start() {
    const attempts = this.#options.codeAttempts ?? CODE_REGENERATION_ATTEMPTS;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const code = generateRoomCode(this.#options.rng);
      const link = this.#createLink(code);

      // Sequential on purpose: each attempt must finish before the next code
      // is drawn, so the Host never holds two peer IDs at once.
      // eslint-disable-next-line no-await-in-loop
      const outcome = await this.#awaitOpen(link);
      if (outcome === 'open') {
        this.#code = code;
        this.#link = link;
        this.#startHeartbeat();
        this.#publishState();
        return code;
      }

      if (outcome === LinkFailure.ID_TAKEN) {
        // Somebody else is using that code. Draw another one and try again.
        continue;
      }

      throw new Error(`Could not start the room: ${outcome}`);
    }

    throw new Error('Could not claim a free room code');
  }

  /**
   * Creates a link for a given code.
   *
   * @param {string} code
   * @returns {PeerLink}
   */
  #createLink(code) {
    const link = new PeerLink({
      factory: this.#options.factory,
      peerId: code,
      peerOptions: { debug: 0 },
    });

    link.on('state', (detail) => {
      this.emit('status', detail);
    });

    link.on('connection', (connection) => {
      this.#acceptConnection(connection);
    });

    link.on('close', ({ reason }) => {
      this.emit('status', { state: LinkState.CLOSED, attempt: 0, reason });
    });

    return link;
  }

  /**
   * Waits for a link to open or fail.
   *
   * @param {PeerLink} link
   * @returns {Promise<string>} `'open'`, or a {@link LinkFailure} value.
   */
  #awaitOpen(link) {
    return new Promise((resolve) => {
      const offState = link.on('state', (detail) => {
        if (detail.state === LinkState.OPEN) {
          offState();
          offClose();
          resolve('open');
        } else if (detail.state === LinkState.FAILED) {
          offState();
          offClose();
          resolve(detail.reason ?? LinkFailure.SIGNALING_UNREACHABLE);
        }
      });

      const offClose = link.on('close', ({ reason }) => {
        offState();
        offClose();
        resolve(reason);
      });

      link.start();
    });
  }

  /**
   * Accepts an incoming data connection.
   *
   * @param {DataConnectionLike} connection
   */
  #acceptConnection(connection) {
    connection.on('data', (raw) => {
      this.#handleMessage(connection, raw);
    });

    connection.on('close', () => {
      this.#handleDisconnect(connection);
    });

    connection.on('error', () => {
      this.#handleDisconnect(connection);
    });
  }

  /**
   * Handles an inbound message from a guest.
   *
   * @param {DataConnectionLike} connection
   * @param {unknown} raw
   */
  #handleMessage(connection, raw) {
    if (typeof raw !== 'string') return;

    const parsed = parseGuestMessage(raw, {
      avatarCount: 8,
      rules: this.#state.rules,
    });
    if (!parsed.ok) return;

    const message = parsed.value;

    // Any message at all proves the guest is alive.
    const guest = this.#findGuest(connection);
    if (guest) {
      guest.lastSeen = Date.now();
    }

    switch (message.t) {
      case MessageType.HELLO:
        this.#handleHello(connection, message);
        return;
      case MessageType.GUESS:
        this.#handleGuess(connection, message);
        return;
      case MessageType.CHAT:
        this.#handleChat(connection, message);
        return;
      case MessageType.PING:
        this.#sendTo(connection, { t: 'pong', at: Date.now() });
        return;
      default:
        return;
    }
  }

  /**
   * Registers a guest that has introduced itself.
   *
   * @param {DataConnectionLike} connection
   * @param {import('../core/protocol.js').HelloMessage} message
   */
  #handleHello(connection, message) {
    // A guest that says hello twice over the same connection keeps its
    // original identity.
    for (const guest of this.#guests.values()) {
      if (guest.connection === connection) return;
    }

    // A guest that reconnects is recognised by its client id, so it keeps
    // its seat instead of appearing twice.
    if (message.clientId) {
      const knownPlayerId = this.#clients.get(message.clientId);
      if (knownPlayerId) {
        const existing = this.#guests.get(knownPlayerId);
        if (existing) {
          // The same connection, saying hello again. It keeps its identity.
          this.#sendTo(connection, {
            t: 'welcome',
            you: { id: knownPlayerId, name: existing.name, avatar: existing.avatar },
            state: publicView(this.#state),
          });
          return;
        }

        // A player who is known but not currently connected is coming
        // back. They keep their seat rather than appearing twice.
        const player = findPlayer(this.#state, knownPlayerId);
        if (player) {
          const holdTimer = this.#holdTimers.get(knownPlayerId);
          if (holdTimer) {
            clearTimeout(holdTimer);
            this.#holdTimers.delete(knownPlayerId);
          }

          this.#guests.set(knownPlayerId, {
            id: knownPlayerId,
            name: message.name,
            avatar: message.avatar,
            locale: message.locale,
            connection,
            holdTimer: null,
            lastSeen: Date.now(),
          });

          this.#state = setPlayerStatus(this.#state, knownPlayerId, PlayerStatus.ACTIVE);
          this.#state = renamePlayer(this.#state, knownPlayerId, message.name, message.avatar);

          this.#sendTo(connection, {
            t: 'welcome',
            you: { id: knownPlayerId, name: message.name, avatar: message.avatar },
            state: publicView(this.#state),
          });
          this.#publishState();
          return;
        }

        // The seat expired while they were away. Treat them as new.
        this.#clients.delete(message.clientId);
      }
    }

    if (this.#guests.size >= (this.#options.maxPlayers ?? MAX_PLAYERS)) {
      this.#sendTo(connection, {
        t: 'toast',
        kind: 'error',
        text: 'This room is full.',
      });
      this.#sendTo(connection, { t: 'bye', reason: 'room-full' });
      try {
        connection.close();
      } catch {
        // Already gone.
      }
      return;
    }

    const id = `g${this.#guests.size + 1}-${Date.now().toString(36)}`;
    const guest = {
      id,
      name: message.name,
      avatar: message.avatar,
      locale: message.locale,
      connection,
      holdTimer: null,
      lastSeen: Date.now(),
    };

    this.#guests.set(id, guest);
    if (message.clientId) {
      this.#clients.set(message.clientId, id);
    }
    this.#state = addPlayer(this.#state, {
      id,
      name: message.name,
      avatar: message.avatar,
      joinedAt: Date.now(),
    });

    // The new guest gets the state immediately, so joining late is seamless.
    this.#sendTo(connection, {
      t: 'welcome',
      you: { id, name: message.name, avatar: message.avatar },
      state: publicView(this.#state),
    });

    this.#publishState();
  }

  /**
   * Handles a guess.
   *
   * @param {DataConnectionLike} connection
   * @param {import('../core/protocol.js').GuessMessage} message
   */
  #handleGuess(connection, message) {
    const guest = this.#findGuest(connection);
    if (!guest) return;

    if (this.#state.phase === Phase.LOBBY) {
      this.#sendTo(connection, {
        t: 'toast',
        kind: 'info',
        text: 'The game has not started yet.',
      });
      return;
    }

    const result = applyGuess(this.#state, guest.id, message.digits, Date.now());
    if (!result.ok) {
      if (result.reason === 'not-your-turn') {
        this.#sendTo(connection, {
          t: 'toast',
          kind: 'info',
          text: 'It is not your turn yet.',
        });
      }
      return;
    }

    this.#state = result.state;
    this.#publishState();

    if (result.won) {
      this.#broadcast({
        t: 'toast',
        kind: 'success',
        text: `${guest.name} cracked it!`,
      });
    }
  }

  /**
   * Handles a chat message.
   *
   * @param {DataConnectionLike} connection
   * @param {import('../core/protocol.js').ChatMessage} message
   */
  #handleChat(connection, message) {
    const guest = this.#findGuest(connection);
    if (!guest) return;

    const payload = {
      t: 'chat',
      from: guest.id,
      name: guest.name,
      text: message.text,
      at: Date.now(),
    };

    this.#broadcast(payload);
    this.emit('chat', payload);
  }

  /**
   * Handles a guest's connection closing.
   *
   * The seat is held for a while so a player who briefly loses their
   * connection is not punished for it.
   *
   * @param {DataConnectionLike} connection
   */
  #handleDisconnect(connection) {
    const guest = this.#findGuest(connection);
    if (!guest) return;

    this.#guests.delete(guest.id);

    if (this.#state.phase !== Phase.FINISHED) {
      this.#markDisconnected(guest);
    } else {
      this.#state = removePlayer(this.#state, guest.id);
      this.#publishState();
    }
  }

  /**
   * Marks a guest as disconnected and holds their seat.
   *
   * @param {ConnectedPlayer} guest
   */
  #markDisconnected(guest) {
    if (guest.holdTimer) return;

    this.#state = setPlayerStatus(this.#state, guest.id, PlayerStatus.DISCONNECTED);
    this.#publishState();

    const holdMs = this.#options.seatHoldMs ?? SEAT_HOLD_MS;
    const timer = setTimeout(() => {
      this.#holdTimers.delete(guest.id);
      this.#state = removePlayer(this.#state, guest.id);
      this.#publishState();
      this.emit('notice', { kind: 'player-left', text: guest.name });
    }, holdMs);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    guest.holdTimer = timer;
    this.#holdTimers.set(guest.id, timer);
  }

  /**
   * Marks guests that have gone quiet as disconnected.
   *
   * A tab that closes abruptly does not always deliver a "close" event — the
   * WebRTC connection simply dies. The guests ping the Host, so silence is
   * the reliable signal that one has gone.
   */
  #sweepSilentGuests() {
    if (this.#closed) return;
    if (this.#state.phase === Phase.FINISHED) return;

    const timeout = this.#options.guestTimeoutMs ?? GUEST_TIMEOUT_MS;
    const now = Date.now();

    for (const guest of [...this.#guests.values()]) {
      if (guest.holdTimer) continue;
      if (now - guest.lastSeen < timeout) continue;

      this.#guests.delete(guest.id);
      this.#markDisconnected(guest);
    }
  }

  /**
   * Starts the game.
   *
   * The secret is generated here and never leaves the Host until the game is
   * over.
   *
   * @param {string} secret
   */
  beginGame(secret) {
    if (this.#state.phase !== Phase.LOBBY) return;
    this.#state = startGame(this.#state, secret, Date.now());
    this.#publishState();
  }

  /**
   * Plays a guess as the Host.
   *
   * The Host is a player too, so it goes through exactly the same path a
   * guest does: the same validation, the same scoring, the same rules. There
   * is no privileged shortcut — the Host merely holds the answer.
   *
   * @param {string} digits
   * @returns {boolean} Whether the guess was applied.
   */
  playLocal(digits) {
    if (this.#state.phase !== Phase.PLAYING) return false;

    const result = applyGuess(this.#state, HOST_PLAYER_ID, digits, Date.now());
    if (!result.ok) return false;

    this.#state = result.state;
    this.#publishState();

    if (result.won) {
      this.#broadcast({
        t: 'toast',
        kind: 'success',
        text: `${this.#hostName()} cracked it!`,
      });
    }

    return true;
  }

  /**
   * Sends a chat message as the Host.
   *
   * @param {string} text
   */
  sendChat(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const payload = {
      t: 'chat',
      from: HOST_PLAYER_ID,
      name: this.#hostName(),
      text: trimmed,
      at: Date.now(),
    };

    this.#broadcast(payload);
    this.emit('chat', payload);
  }

  /**
   * Closes the room.
   */
  close() {
    if (this.#closed) return;
    this.#closed = true;

    if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = null;

    for (const guest of this.#guests.values()) {
      if (guest.holdTimer) clearTimeout(guest.holdTimer);
      this.#sendTo(guest.connection, { t: 'bye', reason: 'host-left' });
    }
    this.#guests.clear();

    this.#link?.close();
    this.#link = null;
  }

  /**
   * Broadcasts the current state to everyone and publishes it locally.
   */
  #publishState() {
    const view = publicView(this.#state);
    this.#broadcast({ t: 'state', rev: view.rev, state: view });
    this.emit('state', view);
  }

  /**
   * Broadcasts a message to every guest.
   *
   * @param {Record<string, unknown>} payload
   */
  #broadcast(payload) {
    const raw = encodeMessage(String(payload.t), payload);
    for (const guest of this.#guests.values()) {
      this.#sendRaw(guest.connection, raw);
    }
  }

  /**
   * Sends a message to one guest.
   *
   * @param {DataConnectionLike} connection
   * @param {Record<string, unknown>} payload
   */
  #sendTo(connection, payload) {
    this.#sendRaw(connection, encodeMessage(String(payload.t), payload));
  }

  /**
   * @param {DataConnectionLike} connection
   * @param {string} raw
   */
  #sendRaw(connection, raw) {
    try {
      connection.send(raw);
    } catch {
      // The connection is gone. It will be cleaned up by its close handler.
    }
  }

  /**
   * Finds the guest behind a connection.
   *
   * @param {DataConnectionLike} connection
   * @returns {ConnectedPlayer | undefined}
   */
  #findGuest(connection) {
    for (const guest of this.#guests.values()) {
      if (guest.connection === connection) return guest;
    }
    return undefined;
  }

  /**
   * Starts the periodic snapshot broadcast.
   *
   * The heartbeat keeps idle guests fresh and lets them detect a stale link.
   */
  #startHeartbeat() {
    const interval = this.#options.heartbeatMs ?? HEARTBEAT_MS;
    this.#heartbeatTimer = setInterval(() => {
      if (this.#closed) return;
      this.#publishState();
      this.#sweepSilentGuests();
    }, interval);
    if (typeof this.#heartbeatTimer === 'object' && 'unref' in this.#heartbeatTimer) {
      this.#heartbeatTimer.unref();
    }
  }
}
