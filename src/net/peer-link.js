/**
 * The PeerJS transport, wrapped.
 *
 * PeerJS gives us a data channel and nothing else. What it does *not* give us
 * is any notion of "this connection failed and the player is staring at a
 * spinner". Measured against the live public server, roughly **one in six**
 * connections never opens and emits no error at all.
 *
 * This module turns that raw behaviour into something a UI can rely on:
 *
 * - a **connect timeout**, so a stalled handshake becomes a failure;
 * - **exponential backoff**, so a transient outage does not exhaust the
 *   signaling server's rate limit;
 * - a **distinction between "not found" and "not yet"** — a room that does not
 *   exist is a *result* and must not be retried, while a network problem is a
 *   *condition* and must be;
 * - an explicit **state machine** the UI can render.
 *
 * See `docs/adr/0004-connection-resilience.md`.
 */

import { CONNECT_TIMEOUT_MS, GUEST_PING_MS, RETRY_DELAYS_MS } from '../config.js';
import { Emitter } from './emitter.js';

/**
 * @typedef {object} DataConnectionLike
 * @property {(event: string, listener: (...args: never[]) => void) => void} on
 * @property {(data: unknown) => void} send
 * @property {() => void} close
 * @property {string} peer
 * @property {boolean} open
 * @property {string} label
 */

/**
 * @typedef {object} PeerLike
 * @property {(event: string, listener: (...args: never[]) => void) => void} on
 * @property {(id: string, options?: { reliable?: boolean, label?: string }) => DataConnectionLike} connect
 * @property {() => void} destroy
 * @property {() => void} disconnect
 * @property {() => void} reconnect
 * @property {string | undefined} id
 * @property {boolean} disconnected
 * @property {boolean} destroyed
 */

/**
 * @typedef {(id: string | undefined, options: Record<string, unknown>) => PeerLike} PeerFactory
 */

/** The states a link moves through. */
export const LinkState = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  OPEN: 'open',
  RETRYING: 'retrying',
  FAILED: 'failed',
  CLOSED: 'closed',
});

/** Why a link failed. */
export const LinkFailure = Object.freeze({
  /** The room does not exist. Retrying will not help. */
  ROOM_NOT_FOUND: 'room-not-found',
  /** The signaling server could not be reached. */
  SIGNALING_UNREACHABLE: 'signaling-unreachable',
  /** Every attempt timed out. */
  TIMED_OUT: 'timed-out',
  /** The browser does not support WebRTC. */
  UNSUPPORTED: 'unsupported',
  /** The link was closed on purpose. */
  CLOSED: 'closed',
  /** The requested peer ID was already taken. */
  ID_TAKEN: 'id-taken',
});

/**
 * @typedef {object} LinkStateDetail
 * @property {string} state  One of {@link LinkState}.
 * @property {number} attempt  Which attempt this is, starting at 1.
 * @property {number} [nextDelayMs]  How long until the next attempt.
 * @property {string} [reason]  A {@link LinkFailure} value.
 * @property {string} [message]  A human-readable explanation.
 * @property {unknown} [error]  The original error, when there was one.
 */

/**
 * Classifies a PeerJS error into a failure reason.
 *
 * @param {{ type?: string, message?: string }} error
 * @returns {string} A {@link LinkFailure} value.
 */
export function classifyError(error) {
  switch (error?.type) {
    case 'peer-unavailable':
      return LinkFailure.ROOM_NOT_FOUND;
    case 'unavailable-id':
      return LinkFailure.ID_TAKEN;
    case 'browser-incompatible':
    case 'ssl-unavailable':
      return LinkFailure.UNSUPPORTED;
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
    case 'disconnected':
      return LinkFailure.SIGNALING_UNREACHABLE;
    default:
      return LinkFailure.SIGNALING_UNREACHABLE;
  }
}

/**
 * @typedef {object} PeerLinkOptions
 * @property {PeerFactory} factory  Creates the underlying peer.
 * @property {string} [peerId]  The peer ID to claim. Omit for a random one.
 * @property {string} [target]  The peer ID to connect to. Required for a guest.
 * @property {number} [connectTimeoutMs]
 * @property {number[]} [retryDelaysMs]
 * @property {Record<string, unknown>} [peerOptions]  Extra options for the peer.
 * @property {Record<string, unknown>} [connectionOptions]  Extra options for the data connection.
 * @property {number} [heartbeatMs]  How often to ping the peer.
 */

/**
 * A single peer and, for a guest, a single outgoing data connection.
 *
 * Emits:
 * - `state` → {@link LinkStateDetail}
 * - `message` → the decoded payload
 * - `connection` → a {@link DataConnectionLike} (host mode, one per guest)
 * - `close` → `{ reason }`
 */
export class PeerLink extends Emitter {
  /** @type {PeerLike | null} */
  #peer = null;

  /** @type {DataConnectionLike | null} */
  #connection = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #connectTimer = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #retryTimer = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  #heartbeatTimer = null;

  #attempt = 0;

  #closed = false;

  /** @type {string} */
  #state = LinkState.IDLE;

  /** @type {PeerLinkOptions} */
  #options;

  /** @type {string | undefined} */
  #peerId;

  /**
   * @param {PeerLinkOptions} options
   */
  constructor(options) {
    super();
    this.#options = options;
    this.#peerId = options.peerId;
  }

  /**
   * The current state.
   *
   * @returns {string}
   */
  get state() {
    return this.#state;
  }

  /**
   * The peer ID, once the peer has opened.
   *
   * @returns {string | undefined}
   */
  get peerId() {
    return this.#peer?.id;
  }

  /**
   * Starts the link.
   *
   * @returns {void}
   */
  start() {
    if (this.#closed) return;
    this.#attempt += 1;
    this.#setState(LinkState.CONNECTING);

    const peer = this.#options.factory(this.#peerId, {
      ...this.#options.peerOptions,
    });
    this.#peer = peer;

    // A peer that has been replaced or destroyed can still fire events. Every
    // handler checks that it is still the current peer, so a stale event can
    // never move the link back into a healthy state.
    const isCurrent = () => this.#peer === peer;

    peer.on('open', () => {
      if (!isCurrent() || this.#closed) return;
      this.#startHeartbeat();

      if (this.#options.target) {
        // A guest is only "open" once its **data channel** is open, not when
        // the peer registers with the signaling server. Announcing it earlier
        // would let the application send its first message into a channel
        // that cannot carry it yet.
        this.#openConnection();
      } else {
        this.#setState(LinkState.OPEN);
      }
    });

    peer.on('connection', (connection) => {
      if (!isCurrent() || this.#closed) return;
      this.#bindConnection(connection);
      this.emit('connection', connection);
    });

    peer.on('disconnected', () => {
      if (!isCurrent() || this.#closed) return;
      // The socket dropped. Existing data channels survive, so we try to
      // re-register with the signaling server rather than tearing everything
      // down.
      if (!peer.destroyed) {
        try {
          peer.reconnect();
        } catch {
          this.#fail(LinkFailure.SIGNALING_UNREACHABLE);
        }
      }
    });

    peer.on('error', (error) => {
      if (!isCurrent() || this.#closed) return;
      this.#handlePeerError(error);
    });
  }

  /**
   * Opens the outgoing data connection (guest mode).
   *
   * @returns {void}
   */
  #openConnection() {
    const peer = this.#peer;
    if (!peer || !this.#options.target) return;

    let connection;
    try {
      connection = peer.connect(this.#options.target, {
        reliable: true,
        label: 'bulls-cows',
        ...this.#options.connectionOptions,
      });
    } catch (error) {
      this.#handlePeerError(/** @type {{ type?: string, message?: string }} */ (error));
      return;
    }

    this.#connection = connection;
    this.#bindConnection(connection);

    this.#connectTimer = setTimeout(() => {
      this.#connectTimer = null;
      if (this.#state === LinkState.OPEN && connection.open) return;
      // No error, no open. This is the measured silent failure. Treat it as
      // a timeout and start over.
      this.#teardownConnection();
      this.#scheduleRetry(LinkFailure.TIMED_OUT);
    }, this.#options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);
  }

  /**
   * Attaches the handlers to a data connection.
   *
   * @param {DataConnectionLike} connection
   */
  #bindConnection(connection) {
    connection.on('open', () => {
      if (this.#connectTimer) {
        clearTimeout(this.#connectTimer);
        this.#connectTimer = null;
      }
      if (this.#state !== LinkState.OPEN) {
        this.#setState(LinkState.OPEN);
      }
    });

    connection.on('data', (data) => {
      if (this.#closed) return;
      this.emit('message', data);
    });

    connection.on('close', () => {
      if (this.#closed) return;
      this.#emitClose('connection-closed');
    });

    connection.on('error', (error) => {
      if (this.#closed) return;
      this.#handlePeerError(error);
    });
  }

  /**
   * Handles an error from the peer or the connection.
   *
   * @param {{ type?: string, message?: string }} error
   */
  #handlePeerError(error) {
    // The transport only cares about the error *type*.
    if (this.#closed) return;

    const reason = classifyError(error);

    if (reason === LinkFailure.ROOM_NOT_FOUND) {
      // The room does not exist. Retrying would only waste the signaling
      // server's patience, and the player deserves a definite answer.
      this.#fail(reason, error);
      return;
    }

    if (reason === LinkFailure.ID_TAKEN) {
      this.#fail(reason, error);
      return;
    }

    if (reason === LinkFailure.UNSUPPORTED) {
      this.#fail(reason, error);
      return;
    }

    this.#scheduleRetry(reason, error);
  }

  /**
   * Schedules the next attempt.
   *
   * @param {string} reason
   * @param {unknown} [error]
   */
  #scheduleRetry(reason, error) {
    if (this.#closed) return;

    const delays = this.#options.retryDelaysMs ?? RETRY_DELAYS_MS;

    if (this.#attempt > delays.length) {
      this.#fail(reason, error);
      return;
    }

    const delay = delays[Math.min(this.#attempt - 1, delays.length - 1)] ?? 1000;

    this.#teardownConnection();
    this.#destroyPeer();
    this.#setState(LinkState.RETRYING, { nextDelayMs: delay, reason, error });

    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.start();
    }, delay);
  }

  /**
   * Fails the link for good.
   *
   * @param {string} reason
   * @param {unknown} [error]
   */
  #fail(reason, error) {
    if (this.#closed) return;

    this.#teardownConnection();
    this.#destroyPeer();
    this.#setState(LinkState.FAILED, { reason, error });
    this.#emitClose(reason);
  }

  /**
   * Sends a payload over the data connection.
   *
   * @param {unknown} payload
   * @returns {boolean} Whether the payload was handed to the transport.
   */
  send(payload) {
    const connection = this.#connection;
    if (!connection || !connection.open) return false;
    try {
      connection.send(payload);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Closes the link on purpose.
   */
  close() {
    if (this.#closed) return;
    this.#closed = true;

    if (this.#connectTimer) clearTimeout(this.#connectTimer);
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer);
    this.#connectTimer = null;
    this.#retryTimer = null;
    this.#heartbeatTimer = null;

    this.#teardownConnection();
    this.#destroyPeer();

    this.#setState(LinkState.CLOSED, { reason: LinkFailure.CLOSED });
    this.#emitClose(LinkFailure.CLOSED);
  }

  /**
   * Starts the keep-alive ping.
   */
  #startHeartbeat() {
    if (this.#heartbeatTimer) return;
    const interval = this.#options.heartbeatMs ?? GUEST_PING_MS;
    this.#heartbeatTimer = setInterval(() => {
      if (this.#connection?.open) {
        this.send(JSON.stringify({ v: 1, t: 'ping' }));
      }
    }, interval);
    // A heartbeat must never keep a Node process (or a test runner) alive.
    if (typeof this.#heartbeatTimer === 'object' && 'unref' in this.#heartbeatTimer) {
      this.#heartbeatTimer.unref();
    }
  }

  /**
   * @param {string} reason
   */
  #emitClose(reason) {
    if (this.#closed && reason === LinkFailure.CLOSED) {
      this.emit('close', { reason });
      return;
    }
    this.emit('close', { reason });
  }

  /**
   * @param {string} state
   * @param {Partial<LinkStateDetail>} [detail]
   */
  #setState(state, detail = {}) {
    this.#state = state;
    this.emit('state', { state, attempt: this.#attempt, ...detail });
  }

  /**
   * Closes and drops the outgoing connection.
   */
  #teardownConnection() {
    const connection = this.#connection;
    this.#connection = null;
    if (!connection) return;
    try {
      connection.close();
    } catch {
      // The connection may already be gone. Nothing to do.
    }
  }

  /**
   * Destroys the peer.
   */
  #destroyPeer() {
    const peer = this.#peer;
    this.#peer = null;
    if (!peer) return;
    try {
      peer.destroy();
    } catch {
      // The peer may already be destroyed. Nothing to do.
    }
  }
}
