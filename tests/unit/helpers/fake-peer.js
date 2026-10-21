/**
 * A fake PeerJS peer, used to test the transport deterministically.
 *
 * The real PeerJS client needs a browser and a live signaling server, which
 * makes it useless for asserting *when* a retry happens or *what* the UI is
 * told. These fakes expose the same surface with manual control.
 */

/**
 * @typedef {import('../../../src/net/peer-link.js').DataConnectionLike} DataConnectionLike
 * @typedef {import('../../../src/net/peer-link.js').PeerLike} PeerLike
 */

export class FakeConnection {
  /**
   * @param {string} peer
   * @param {Record<string, unknown>} [options]
   */
  constructor(peer, options = {}) {
    this.peer = peer;
    this.options = options;
    this.open = false;
    this.label = String(options.label ?? 'fake');
    /** @type {unknown[]} */
    this.sent = [];
    /** @type {Map<string, Set<(...args: never[]) => void>>} */
    this.listeners = new Map();
    this.closed = false;
  }

  /**
   * @param {string} event
   * @param {(...args: never[]) => void} listener
   */
  on(event, listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  /**
   * @param {string} event
   * @param {...unknown} args
   */
  emit(event, ...args) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      // @ts-expect-error — the fake forwards whatever the caller supplies.
      listener(...args);
    }
  }

  /**
   * @param {unknown} data
   */
  send(data) {
    if (!this.open) throw new Error('FakeConnection: not open');
    this.sent.push(data);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    this.emit('close');
  }

  /* --- test helpers --- */

  /** Marks the connection as open and fires the `open` event. */
  accept() {
    this.open = true;
    this.emit('open');
  }

  /**
   * Delivers a payload to the connection's listeners.
   *
   * @param {unknown} data
   */
  deliver(data) {
    this.emit('data', data);
  }
}

export class FakePeer {
  /**
   * @param {string | undefined} id
   * @param {Record<string, unknown>} [options]
   */
  constructor(id, options = {}) {
    this.id = id;
    this.options = options;
    this.destroyed = false;
    this.disconnected = false;
    this.reconnectCount = 0;
    /** @type {FakeConnection[]} */
    this.connections = [];
    /** @type {Map<string, Set<(...args: never[]) => void>>} */
    this.listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {(...args: never[]) => void} listener
   */
  on(event, listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  /**
   * @param {string} event
   * @param {...unknown} args
   */
  emit(event, ...args) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      // @ts-expect-error — the fake forwards whatever the caller supplies.
      listener(...args);
    }
  }

  /**
   * @param {string} target
   * @param {Record<string, unknown>} [options]
   */
  connect(target, options = {}) {
    const connection = new FakeConnection(target, options);
    this.connections.push(connection);
    return connection;
  }

  destroy() {
    this.destroyed = true;
    this.emit('close');
  }

  disconnect() {
    this.disconnected = true;
    this.emit('disconnected');
  }

  reconnect() {
    this.reconnectCount += 1;
  }

  /* --- test helpers --- */

  /** Fires the `open` event. */
  open_() {
    this.emit('open', this.id);
  }

  /**
   * Fires an error.
   *
   * @param {string} type
   * @param {string} [message]
   */
  fail(type, message = type) {
    this.emit('error', { type, message });
  }
}

/**
 * Builds a peer factory that hands out `FakePeer` instances and records them.
 *
 * @returns {{ factory: (id: string | undefined, options: Record<string, unknown>) => FakePeer, peers: FakePeer[] }}
 */
export function createFakeFactory() {
  /** @type {FakePeer[]} */
  const peers = [];

  return {
    peers,
    factory: (id, options) => {
      const peer = new FakePeer(id, options);
      peers.push(peer);
      return peer;
    },
  };
}
