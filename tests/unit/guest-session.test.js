import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuestSession } from '../../src/net/guest-session.js';
import { LinkFailure, LinkState } from '../../src/net/peer-link.js';
import { createFakeFactory } from './helpers/fake-peer.js';

/**
 * Builds a guest session backed by fake peers.
 *
 * @param {object} [options]
 */
function makeGuest(options = {}) {
  const { factory, peers } = createFakeFactory();
  const session = new GuestSession({
    factory,
    code: 'K7P4',
    name: 'Sara',
    avatar: 1,
    locale: 'en',
    ...options,
  });
  return { session, factory, peers };
}

describe('GuestSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to the room and introduces itself', () => {
    const { session, peers } = makeGuest();
    session.start();

    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    expect(session.sendHello()).toBe(true);

    const sent = peers[0]?.connections[0]?.sent ?? [];
    const hello = sent.map((raw) => JSON.parse(String(raw))).find((m) => m.t === 'hello');
    expect(hello.name).toBe('Sara');
    expect(hello.avatar).toBe(1);
  });

  it('reports the transport status so the UI can show a banner', () => {
    const { session, peers } = makeGuest();

    /** @type {string[]} */
    const states = [];
    session.on('status', (detail) => states.push(detail.state));

    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    expect(states).toContain(LinkState.CONNECTING);
    expect(states).toContain(LinkState.OPEN);
  });

  it('accepts a welcome and stores the state', () => {
    const { session, peers } = makeGuest();

    /** @type {any[]} */
    const states = [];
    session.on('state', (state) => states.push(state));

    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    const state = { phase: 'lobby', players: [], rev: 1 };
    peers[0]?.connections[0]?.deliver(
      JSON.stringify({
        v: 1,
        t: 'welcome',
        you: { id: 'g1', name: 'Sara', avatar: 1 },
        state,
      }),
    );

    expect(session.self).toEqual({ id: 'g1', name: 'Sara', avatar: 1 });
    expect(session.state).toEqual(state);
    expect(states).toHaveLength(1);
  });

  it('ignores a snapshot that is not newer than the one it holds', () => {
    const { session, peers } = makeGuest();

    /** @type {any[]} */
    const states = [];
    session.on('state', (state) => states.push(state));

    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    const connection = peers[0]?.connections[0];
    connection?.deliver(
      JSON.stringify({ v: 1, t: 'state', rev: 5, state: { phase: 'lobby', rev: 5 } }),
    );
    connection?.deliver(
      JSON.stringify({ v: 1, t: 'state', rev: 3, state: { phase: 'playing', rev: 3 } }),
    );

    expect(states).toHaveLength(1);
    expect(session.state?.phase).toBe('lobby');
  });

  it('accepts a newer snapshot', () => {
    const { session, peers } = makeGuest();
    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    const connection = peers[0]?.connections[0];
    connection?.deliver(
      JSON.stringify({ v: 1, t: 'state', rev: 1, state: { phase: 'lobby', rev: 1 } }),
    );
    connection?.deliver(
      JSON.stringify({ v: 1, t: 'state', rev: 2, state: { phase: 'playing', rev: 2 } }),
    );

    expect(session.state?.phase).toBe('playing');
  });

  it('sends a guess and a chat message', () => {
    const { session, peers } = makeGuest();
    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    expect(session.sendGuess('0247')).toBe(true);
    expect(session.sendChat('Go Hamed!')).toBe(true);

    const sent = (peers[0]?.connections[0]?.sent ?? []).map((raw) => JSON.parse(String(raw)));
    expect(sent.find((m) => m.t === 'guess')?.digits).toBe('0247');
    expect(sent.find((m) => m.t === 'chat')?.text).toBe('Go Hamed!');
  });

  it('forwards chat, toast and notice events', () => {
    const { session, peers } = makeGuest();

    /** @type {string[]} */
    const events = [];
    session.on('chat', () => events.push('chat'));
    session.on('toast', () => events.push('toast'));
    session.on('notice', () => events.push('notice'));
    session.on('bye', () => events.push('bye'));

    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    const connection = peers[0]?.connections[0];
    connection?.deliver(
      JSON.stringify({ v: 1, t: 'chat', from: 'g1', name: 'Sara', text: 'Hi', at: 1 }),
    );
    connection?.deliver(JSON.stringify({ v: 1, t: 'toast', kind: 'info', text: 'Notice' }));
    connection?.deliver(JSON.stringify({ v: 1, t: 'notice', kind: 'player-left', text: 'x' }));
    connection?.deliver(JSON.stringify({ v: 1, t: 'bye', reason: 'host-left' }));

    expect(events).toEqual(['chat', 'toast', 'notice', 'bye']);
  });

  it('reports a room that does not exist, without retrying forever', () => {
    const { session, peers } = makeGuest();

    /** @type {string[]} */
    const errors = [];
    session.on('error', (error) => errors.push(error.reason));

    session.start();
    peers[0]?.fail('peer-unavailable');

    expect(errors).toEqual([LinkFailure.ROOM_NOT_FOUND]);
  });

  it('ignores a malformed message from the host', () => {
    const { session, peers } = makeGuest();

    /** @type {any[]} */
    const states = [];
    session.on('state', (state) => states.push(state));

    session.start();
    peers[0]?.open_();
    peers[0]?.connections[0]?.accept();

    const connection = peers[0]?.connections[0];
    connection?.deliver('not json');
    connection?.deliver(JSON.stringify({ v: 1, t: 'nonsense' }));
    connection?.deliver(JSON.stringify({ v: 99, t: 'state', rev: 1, state: {} }));

    expect(states).toHaveLength(0);
  });

  it('closes cleanly', () => {
    const { session, peers } = makeGuest();
    session.start();
    peers[0]?.open_();

    session.close();
    expect(session.connected).toBe(false);
    expect(peers[0]?.destroyed).toBe(true);
  });
});
