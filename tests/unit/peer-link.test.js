import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LinkFailure, LinkState, PeerLink, classifyError } from '../../src/net/peer-link.js';
import { createFakeFactory, FakeConnection } from './helpers/fake-peer.js';

describe('classifyError', () => {
  it('maps a missing peer to "room not found"', () => {
    expect(classifyError({ type: 'peer-unavailable' })).toBe(LinkFailure.ROOM_NOT_FOUND);
  });

  it('maps a taken id to "id taken"', () => {
    expect(classifyError({ type: 'unavailable-id' })).toBe(LinkFailure.ID_TAKEN);
  });

  it('maps a browser without WebRTC to "unsupported"', () => {
    expect(classifyError({ type: 'browser-incompatible' })).toBe(LinkFailure.UNSUPPORTED);
  });

  it('maps a network failure to "signaling unreachable"', () => {
    expect(classifyError({ type: 'network' })).toBe(LinkFailure.SIGNALING_UNREACHABLE);
    expect(classifyError({ type: 'server-error' })).toBe(LinkFailure.SIGNALING_UNREACHABLE);
    expect(classifyError({})).toBe(LinkFailure.SIGNALING_UNREACHABLE);
  });
});

describe('PeerLink', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reaches the open state when the peer opens and the connection opens', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'K7P4' });

    const states = [];
    link.on('state', (detail) => states.push(detail.state));

    link.start();
    expect(link.state).toBe(LinkState.CONNECTING);

    // The peer registering with the signaling server is not enough: the link
    // is only open once the data channel itself is open.
    peers[0]?.open_();
    expect(link.state).toBe(LinkState.CONNECTING);

    const connection = peers[0]?.connections[0];
    expect(connection).toBeDefined();
    connection?.accept();
    expect(link.state).toBe(LinkState.OPEN);
  });

  it('delivers messages from the connection', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'K7P4' });

    /** @type {unknown[]} */
    const received = [];
    link.on('message', (data) => received.push(data));

    link.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();
    peers[0]?.connections[0]?.deliver('hello');

    expect(received).toEqual(['hello']);
  });

  it('sends only over an open connection', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'K7P4' });

    link.start();
    expect(link.send('nope')).toBe(false);

    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();
    expect(link.send('yes')).toBe(true);
  });

  it('retries after a connection timeout, with backoff', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({
      factory,
      target: 'K7P4',
      connectTimeoutMs: 15_000,
      retryDelaysMs: [1_000, 2_000],
    });

    /** @type {string[]} */
    const states = [];
    link.on('state', (detail) => states.push(detail.state));

    link.start();
    peers[0]?.open_();

    // The connection never opens and no error is emitted — the measured
    // silent failure. The timeout must turn it into a retry.
    vi.advanceTimersByTime(15_000);
    expect(states).toContain(LinkState.RETRYING);
    expect(peers).toHaveLength(1);

    // The first backoff is 1s.
    vi.advanceTimersByTime(1_000);
    expect(peers).toHaveLength(2);
  });

  it('gives up after the retry schedule is exhausted', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({
      factory,
      target: 'K7P4',
      connectTimeoutMs: 1_000,
      retryDelaysMs: [1_000],
    });

    /** @type {string[]} */
    const reasons = [];
    link.on('close', ({ reason }) => reasons.push(reason));

    link.start();

    // Attempt 1 times out, attempt 2 times out, then the schedule is spent.
    for (let i = 0; i < 4 && link.state !== LinkState.FAILED; i += 1) {
      peers[peers.length - 1]?.open_();
      vi.advanceTimersByTime(1_000);
      vi.advanceTimersByTime(5_000);
    }

    expect(link.state).toBe(LinkState.FAILED);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('ignores events from a peer it has already replaced', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({
      factory,
      target: 'K7P4',
      connectTimeoutMs: 1_000,
      retryDelaysMs: [1_000],
    });

    link.start();
    peers[0]?.open_();
    vi.advanceTimersByTime(1_000); // the connection times out
    vi.advanceTimersByTime(1_000); // the retry fires, creating a second peer

    expect(peers).toHaveLength(2);

    // The stale peer must not be able to resurrect the link.
    peers[0]?.open_();
    expect(link.state).not.toBe(LinkState.OPEN);
  });

  it('does not retry when the room does not exist', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'NOPE' });

    /** @type {string[]} */
    const reasons = [];
    link.on('close', ({ reason }) => reasons.push(reason));

    link.start();
    peers[0]?.fail('peer-unavailable');

    expect(link.state).toBe(LinkState.FAILED);
    expect(reasons).toEqual([LinkFailure.ROOM_NOT_FOUND]);

    // No retry is scheduled.
    vi.advanceTimersByTime(60_000);
    expect(peers).toHaveLength(1);
  });

  it('does not retry when the browser does not support WebRTC', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'K7P4' });

    link.start();
    peers[0]?.fail('browser-incompatible');

    expect(link.state).toBe(LinkState.FAILED);
    vi.advanceTimersByTime(60_000);
    expect(peers).toHaveLength(1);
  });

  it('retries after a network error', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({
      factory,
      target: 'K7P4',
      retryDelaysMs: [1_000],
    });

    link.start();
    peers[0]?.fail('network');

    expect(link.state).toBe(LinkState.RETRYING);
    vi.advanceTimersByTime(1_000);
    expect(peers).toHaveLength(2);
  });

  it('reconnects to the signaling server when the socket drops', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'K7P4' });

    link.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();
    peers[0]?.disconnect();

    expect(peers[0]?.reconnectCount).toBe(1);
    expect(link.state).toBe(LinkState.OPEN);
  });

  it('forwards an incoming connection in host mode', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, peerId: 'K7P4' });

    /** @type {unknown[]} */
    const incoming = [];
    link.on('connection', (connection) => incoming.push(connection));

    link.start();
    peers[0]?.open_();

    const peer = peers[0];
    expect(peer).toBeDefined();
    if (!peer) return;

    const incomingConnection = new FakeConnection('guest');
    peer.emit('connection', incomingConnection);

    expect(incoming).toHaveLength(1);
  });

  it('closes cleanly and stops retrying', () => {
    const { factory, peers } = createFakeFactory();
    const link = new PeerLink({ factory, target: 'K7P4', retryDelaysMs: [1_000] });

    link.start();
    link.close();

    expect(link.state).toBe(LinkState.CLOSED);
    expect(peers[0]?.destroyed).toBe(true);

    vi.advanceTimersByTime(60_000);
    expect(peers).toHaveLength(1);
  });
});
