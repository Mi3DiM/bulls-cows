/**
 * The guest side of a room.
 *
 * A guest joins a room, sends its intent to the Host, and renders whatever
 * state the Host sends back. It computes nothing: no score, no turn, no
 * result. Everything it displays came from the Host.
 */

import { MessageType, encodeMessage, parseHostMessage } from '../core/protocol.js';
import { Emitter } from './emitter.js';
import { LinkState, PeerLink } from './peer-link.js';

/**
 * @typedef {import('../core/state.js').GameState} GameState
 * @typedef {import('./peer-link.js').DataConnectionLike} DataConnectionLike
 */

/**
 * Reads the revision out of a state object.
 *
 * The `welcome` message carries the state but no separate revision, so the
 * revision is read from the state itself.
 *
 * @param {unknown} state
 * @returns {number}
 */
function revisionOf(state) {
  if (typeof state !== 'object' || state === null) return 0;
  const rev = /** @type {Record<string, unknown>} */ (state).rev;
  return typeof rev === 'number' ? rev : 0;
}

/**
 * Creates a stable id for this browser tab.
 *
 * It is kept in `sessionStorage`, so it survives a reload — a player who
 * refreshes the page keeps their seat instead of arriving as a second copy
 * of themselves. It is scoped to the tab, so two players on the same device
 * are still two players.
 *
 * @returns {string}
 */
function createClientId() {
  const KEY = 'bulls-cows:client-id';

  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) return stored;
  } catch {
    // Storage disabled. A per-page id is still better than none.
  }

  /** @type {string} */
  let id;
  try {
    id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  try {
    window.sessionStorage.setItem(KEY, id);
  } catch {
    // Storage disabled.
  }

  return id;
}

/**
 * @typedef {object} GuestSessionOptions
 * @property {import('./peer-link.js').PeerFactory} factory
 * @property {string} code  The room code, already normalised to uppercase.
 * @property {string} name
 * @property {number} avatar
 * @property {string} locale
 * @property {number} [connectTimeoutMs]
 * @property {number[]} [retryDelaysMs]
 */

/**
 * Joins a room.
 *
 * Emits:
 * - `state` → the {@link GameState} from the Host
 * - `chat` → `{ from, name, text, at }`
 * - `toast` → `{ kind, text }`
 * - `notice` → `{ kind, text }`
 * - `bye` → `{ reason }`
 * - `status` → the transport state, for the UI banner
 * - `error` → `{ reason, message }` when the room could not be joined
 */
export class GuestSession extends Emitter {
  /** @type {PeerLink | null} */
  #link = null;

  /** @type {GameState | null} */
  #state = null;

  /** @type {{ id: string, name: string, avatar: number } | null} */
  #self = null;

  /** @type {number} */
  #lastRevision = -1;

  /** @type {GuestSessionOptions} */
  #options;

  /**
   * A stable id for this browser, so the Host recognises the guest after a
   * reconnect instead of adding a second copy of them.
   */
  #clientId = createClientId();

  #closed = false;

  /**
   * @param {GuestSessionOptions} options
   */
  constructor(options) {
    super();
    this.#options = options;
  }

  /**
   * The latest state from the Host.
   *
   * @returns {GameState | null}
   */
  get state() {
    return this.#state;
  }

  /**
   * This guest's identity, once the Host has welcomed it.
   *
   * @returns {{ id: string, name: string, avatar: number } | null}
   */
  get self() {
    return this.#self;
  }

  /**
   * Whether the guest currently has a live connection.
   *
   * @returns {boolean}
   */
  get connected() {
    return this.#link?.state === LinkState.OPEN;
  }

  /**
   * Joins the room.
   */
  start() {
    const link = new PeerLink({
      factory: this.#options.factory,
      target: this.#options.code,
      connectTimeoutMs: this.#options.connectTimeoutMs,
      retryDelaysMs: this.#options.retryDelaysMs,
    });

    this.#link = link;

    link.on('state', (detail) => {
      this.emit('status', detail);

      if (detail.state === LinkState.FAILED) {
        this.emit('error', {
          reason: detail.reason,
          message: detail.reason,
        });
      }
    });

    link.on('message', (raw) => {
      this.#handleMessage(raw);
    });

    link.on('close', ({ reason }) => {
      this.emit('status', { state: LinkState.CLOSED, attempt: 0, reason });
      if (!this.#closed && reason !== 'closed') {
        this.emit('notice', { kind: 'disconnected', text: reason });
      }
    });

    link.start();
  }

  /**
   * Sends the guest's introduction.
   *
   * @returns {boolean}
   */
  sendHello() {
    return this.#send({
      t: MessageType.HELLO,
      name: this.#options.name,
      avatar: this.#options.avatar,
      locale: this.#options.locale,
      clientId: this.#clientId,
    });
  }

  /**
   * Sends a guess.
   *
   * @param {string} digits
   * @returns {boolean}
   */
  sendGuess(digits) {
    return this.#send({ t: MessageType.GUESS, digits });
  }

  /**
   * Sends a chat message.
   *
   * @param {string} text
   * @returns {boolean}
   */
  sendChat(text) {
    return this.#send({ t: MessageType.CHAT, text });
  }

  /**
   * Closes the session.
   */
  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#link?.close();
    this.#link = null;
  }

  /**
   * Handles a message from the Host.
   *
   * @param {unknown} raw
   */
  #handleMessage(raw) {
    if (typeof raw !== 'string') return;

    const parsed = parseHostMessage(raw);
    if (!parsed.ok) return;

    const message = parsed.value;

    switch (message.t) {
      case MessageType.WELCOME: {
        this.#self = message.you;
        this.#applyState(message.state, revisionOf(message.state));
        this.emit('welcome', message.you);
        return;
      }

      case MessageType.STATE: {
        // A snapshot that is not newer than the one we hold is stale — it
        // must never roll the UI backwards.
        if (message.rev <= this.#lastRevision) return;
        this.#applyState(message.state, message.rev);
        return;
      }

      case MessageType.CHAT: {
        this.emit('chat', {
          from: message.from,
          name: message.name,
          text: message.text,
          at: message.at,
        });
        return;
      }

      case MessageType.TOAST: {
        this.emit('toast', { kind: message.kind, text: message.text });
        return;
      }

      case MessageType.NOTICE: {
        this.emit('notice', { kind: message.kind, text: message.text });
        return;
      }

      case MessageType.BYE: {
        this.emit('bye', { reason: message.reason });
        return;
      }

      default:
        return;
    }
  }

  /**
   * Stores a state snapshot.
   *
   * @param {unknown} state
   * @param {number} rev  The revision this snapshot carries.
   */
  #applyState(state, rev) {
    if (typeof state !== 'object' || state === null) return;
    if (rev <= this.#lastRevision) return;

    this.#lastRevision = rev;
    this.#state = /** @type {GameState} */ (state);
    this.emit('state', this.#state);
  }

  /**
   * Sends a message to the Host.
   *
   * @param {Record<string, unknown>} payload
   * @returns {boolean}
   */
  #send(payload) {
    const link = this.#link;
    if (!link) return false;
    return link.send(encodeMessage(String(payload.t), payload));
  }
}
