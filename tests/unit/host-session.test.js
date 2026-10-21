import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HostSession } from '../../src/net/host-session.js';
import { Phase, PlayerStatus } from '../../src/core/state.js';
import { createSeededRng, seedFromString } from '../../src/core/rng.js';
import { createFakeFactory, FakeConnection } from './helpers/fake-peer.js';

const rules = { digits: 4, attempts: 8, allowRepeats: false };

/**
 * Builds a Host session backed by fake peers.
 *
 * @param {object} [options]
 */
function makeHost(options = {}) {
  const { factory, peers } = createFakeFactory();
  const session = new HostSession({
    factory,
    rng: createSeededRng(seedFromString('host-session')),
    rules,
    hostName: 'Host',
    hostAvatar: 0,
    hostLocale: 'en',
    heartbeatMs: 5_000,
    seatHoldMs: 60_000,
    ...options,
  });
  return { session, factory, peers };
}

/**
 * Starts a host session and returns it once the room is open.
 *
 * @param {ReturnType<typeof makeHost>} harness
 */
async function start(harness) {
  const promise = harness.session.start();
  harness.peers[0]?.open_();
  await promise;
  return harness.session.code;
}

/**
 * Connects a fake guest to the host and completes the handshake.
 *
 * @param {ReturnType<typeof makeHost>} harness
 * @param {object} [hello]
 */
/**
 * Connects a fake guest to the host and completes the handshake.
 *
 * @param {ReturnType<typeof makeHost>} harness
 * @param {{ name?: string, avatar?: number, locale?: string }} [hello]
 */
function joinGuest(harness, hello = {}) {
  const peer = harness.peers[0];
  const connection = new FakeConnection('guest-peer');
  peer?.emit('connection', connection);
  connection.accept();

  /** @type {Record<string, unknown>} */
  const payload = {
    v: 1,
    t: 'hello',
    name: hello.name ?? 'Sara',
    avatar: hello.avatar ?? 1,
    locale: hello.locale ?? 'en',
  };

  connection.deliver(JSON.stringify(payload));
  return connection;
}

describe('HostSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('claims a room code and reports it', async () => {
    const harness = makeHost();
    const code = await start(harness);
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    expect(harness.session.code).toBe(code);
  });

  it('regenerates the code when the one it drew is already taken', async () => {
    const harness = makeHost();
    const promise = harness.session.start();

    // The first code is taken on the public server.
    harness.peers[0]?.fail('unavailable-id');
    await vi.advanceTimersByTimeAsync(1);

    // The Host tries again with a fresh code.
    harness.peers[1]?.open_();
    const code = await promise;

    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    expect(harness.peers).toHaveLength(2);
  });

  it('welcomes a guest and publishes the state', async () => {
    const harness = makeHost();
    await start(harness);

    /** @type {any[]} */
    const states = [];
    harness.session.on('state', (state) => states.push(state));

    const connection = joinGuest(harness);

    const welcome = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .find((message) => message.t === 'welcome');

    expect(welcome).toBeDefined();
    const payload = /** @type {any} */ (welcome);
    expect(payload.you.name).toBe('Sara');
    expect(payload.state.players).toHaveLength(2);
    expect(states.length).toBeGreaterThan(0);
  });

  it('never puts the secret in a snapshot before the game is over', async () => {
    const harness = makeHost();
    await start(harness);

    harness.session.beginGame('0247');

    const connection = joinGuest(harness);
    const welcome = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .find((message) => message.t === 'welcome');

    expect(welcome.state.phase).toBe(Phase.PLAYING);
    expect(welcome.state.secret).toBeNull();
  });

  it('applies a guess and broadcasts the new state', async () => {
    const harness = makeHost();
    await start(harness);
    harness.session.beginGame('0247');

    const connection = joinGuest(harness);
    connection.sent.length = 0;

    // The Host plays first, so the guest cannot guess yet.
    connection.deliver(JSON.stringify({ v: 1, t: 'guess', digits: '0247' }));
    expect(
      connection.sent.map((raw) => JSON.parse(String(raw))).filter((m) => m.t === 'state'),
    ).toHaveLength(0);

    // The Host plays, which hands the turn to the guest.
    expect(harness.session.playLocal('1359')).toBe(true);
    expect(harness.session.state.turn).not.toBe('host');

    // Now the guest's guess is applied and the new state is broadcast.
    connection.sent.length = 0;
    connection.deliver(JSON.stringify({ v: 1, t: 'guess', digits: '0247' }));

    const states = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .filter((message) => message.t === 'state');
    expect(states).toHaveLength(1);
    expect(states[0].state.phase).toBe(Phase.FINISHED);
    expect(states[0].state.winner).not.toBeNull();
  });

  it('refuses a local guess when it is not the Host turn', async () => {
    const harness = makeHost();
    await start(harness);
    harness.session.beginGame('0247');

    joinGuest(harness);
    // The Host plays first, so the Host's turn is current.
    expect(harness.session.playLocal('1359')).toBe(true);

    // Now it is the guest's turn, so the Host cannot play again.
    expect(harness.session.playLocal('1359')).toBe(false);
  });

  it('hides the secret while the game runs and reveals it at the end', async () => {
    const harness = makeHost();
    await start(harness);
    harness.session.beginGame('0247');

    const connection = joinGuest(harness);
    harness.session.playLocal('1359');
    connection.sent.length = 0;

    // While the game is running, the secret never crosses the wire.
    const during = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .filter((message) => message.t === 'state');
    for (const message of during) {
      expect(message.state.secret).toBeNull();
    }

    // The guest solves it, and the game is over — now the secret is public.
    connection.deliver(JSON.stringify({ v: 1, t: 'guess', digits: '0247' }));

    const after = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .filter((message) => message.t === 'state')
      .pop();
    expect(after.state.phase).toBe(Phase.FINISHED);
    expect(after.state.secret).toBe('0247');
  });

  it('broadcasts a chat message to every guest', async () => {
    const harness = makeHost();
    await start(harness);

    const first = joinGuest(harness);
    const second = joinGuest(harness, { name: 'Rayan' });
    first.sent.length = 0;
    second.sent.length = 0;

    /** @type {any[]} */
    const chats = [];
    harness.session.on('chat', (chat) => chats.push(chat));

    first.deliver(JSON.stringify({ v: 1, t: 'chat', text: 'Go Hamed!' }));

    const firstChat = first.sent
      .map((raw) => JSON.parse(String(raw)))
      .find((message) => message.t === 'chat');
    const secondChat = second.sent
      .map((raw) => JSON.parse(String(raw)))
      .find((message) => message.t === 'chat');

    expect(firstChat.text).toBe('Go Hamed!');
    expect(secondChat.text).toBe('Go Hamed!');
    expect(chats).toHaveLength(1);
  });

  it('ignores a chat message from a guest that never said hello', async () => {
    const harness = makeHost();
    await start(harness);

    const peer = harness.peers[0];
    const connection = new FakeConnection('stranger');
    peer?.emit('connection', connection);
    connection.accept();
    connection.sent.length = 0;

    connection.deliver(JSON.stringify({ v: 1, t: 'chat', text: 'Hello?' }));

    expect(
      connection.sent.map((raw) => JSON.parse(String(raw))).filter((m) => m.t === 'chat'),
    ).toHaveLength(0);
  });

  it('ignores a malformed message', async () => {
    const harness = makeHost();
    await start(harness);

    const connection = joinGuest(harness);
    connection.sent.length = 0;

    connection.deliver('not json');
    connection.deliver(JSON.stringify({ v: 1, t: 'hack' }));
    connection.deliver(JSON.stringify({ v: 99, t: 'guess', digits: '0247' }));

    expect(
      connection.sent.map((raw) => JSON.parse(String(raw))).filter((m) => m.t === 'state'),
    ).toHaveLength(0);
  });

  it('marks a disconnected guest and holds their seat', async () => {
    const harness = makeHost();
    await start(harness);

    const connection = joinGuest(harness);
    connection.close();

    let state = harness.session.state;
    const guest = state.players.find((p) => p.name === 'Sara');
    expect(guest?.status).toBe(PlayerStatus.DISCONNECTED);

    // The seat is held, then released.
    await vi.advanceTimersByTimeAsync(60_000);
    state = harness.session.state;
    expect(state.players.find((p) => p.name === 'Sara')).toBeUndefined();
  });

  it('tells a guest that the room is full', async () => {
    const harness = makeHost({ maxPlayers: 1 });
    await start(harness);

    joinGuest(harness);

    const peer = harness.peers[0];
    const connection = new FakeConnection('latecomer');
    peer?.emit('connection', connection);
    connection.accept();
    connection.sent.length = 0;

    connection.deliver(JSON.stringify({ v: 1, t: 'hello', name: 'Late', avatar: 0, locale: 'en' }));

    const messages = connection.sent.map((raw) => JSON.parse(String(raw)));
    expect(messages.find((m) => m.t === 'bye')?.reason).toBe('room-full');
  });

  it('says goodbye to every guest when the host leaves', async () => {
    const harness = makeHost();
    await start(harness);

    const connection = joinGuest(harness);
    connection.sent.length = 0;

    harness.session.close();

    const bye = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .find((message) => message.t === 'bye');
    expect(bye.reason).toBe('host-left');
  });

  it('broadcasts a heartbeat snapshot so idle guests stay fresh', async () => {
    const harness = makeHost();
    await start(harness);

    const connection = joinGuest(harness);
    connection.sent.length = 0;

    await vi.advanceTimersByTimeAsync(5_000);

    const states = connection.sent
      .map((raw) => JSON.parse(String(raw)))
      .filter((message) => message.t === 'state');
    expect(states.length).toBeGreaterThan(0);
  });
});
