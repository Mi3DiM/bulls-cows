# Architecture

> Read this before changing anything under `src/core/**` or `src/net/**`.
> The design decisions behind it live in `docs/adr/`.

## 1. The shape of the system

```
                    ┌───────────────────────┐
                    │       HOST            │
   peer.id = "K7P4" │  authoritative state  │
                    │  secret · turn · logs │
                    └───┬───────────┬───────┘
        ┌───────────────┘           └──────────────┐
        │                                          │
   ┌────▼─────┐  ┌─────────────┐  ┌────────────┐  ┌▼────────┐
   │ Player 1 │  │  Player 2   │  │  Player 3  │  │Spectator│
   └──────────┘  └─────────────┘  └────────────┘  └─────────┘
        \____________  WebRTC data channels  ____________/
                             (direct P2P)

        signaling only:  wss://0.peerjs.com  (never sees game traffic)
```

The Host is a **peer**, not a server. It holds the state, and it fans out
snapshots. Guests are renderers.

## 2. Layers

| Layer     | Directory   | Depends on              | Must never depend on          |
| --------- | ----------- | ----------------------- | ----------------------------- |
| Pure core | `src/core/` | nothing                 | DOM, network, timers, globals |
| Transport | `src/net/`  | `src/core/`             | `src/ui/`                     |
| UI        | `src/ui/`   | `src/core/`, `src/net/` | —                             |
| i18n      | `src/i18n/` | —                       | —                             |

The dependency arrow only points downward. `src/core/` is the part we trust
most, and it is kept free of the outside world so it can be tested in isolation
and reused without thought.

## 3. State model

One object, owned by the Host, broadcast verbatim to guests.

```jsonc
{
  "phase": "playing", // lobby | playing | finished
  "rules": {
    "digits": 4,
    "attempts": 8,
    "allowRepeats": false,
  },
  "players": [
    {
      "id": "p1",
      "name": "Sara",
      "avatar": 3, // index into the avatar set
      "isHost": true,
      "status": "active", // active | disconnected | eliminated | won
      "attempts": [{ "digits": "0247", "bulls": 2, "cows": 1, "at": 1712345678901 }],
      "points": 0,
    },
  ],
  "turn": "p2",
  "winner": null, // player id
  "secret": null, // ONLY populated once phase === "finished"
  "startedAt": 1712345678901,
  "rev": 17,
}
```

Invariants enforced by the Host (see `src/core/state.js`):

- `turn` always names a player whose `status` is `active`.
- `secret` is `null` while `phase !== "finished"`.
- every `attempts[i].bulls + cows <= digits`.
- a player's `attempts.length <= rules.attempts`.

## 4. Message flow

```
guest                                        host
  │  ── {t:'hello', name, avatar} ──────────▶ │
  │                                            │  validate, add player
  │  ◀────────────── {t:'welcome', you, state} │
  │                                            │
  │  ── {t:'guess', digits:'0247'} ───────────▶ │  validate shape
  │                                            │  re-derive bulls/cows
  │                                            │  apply to state
  │  ◀──────────── {t:'state', rev, state} ─── │  broadcast to all
  │                                            │
  │  ◀──────────── {t:'chat', from, text} ──── │  broadcast
```

Every inbound message is validated for **shape** only. Everything of substance
— the score, the bulls and cows, whose turn it is, whether the game is over — is
computed by the Host from its own state. A guest cannot forge a win.

Full message reference: [`docs/protocol.md`](./protocol.md).

## 5. Connection lifecycle

```
guest                                  host
  │  peer = new Peer()                  │  peer = new Peer('K7P4')
  │  peer.on('open')                    │
  │  conn = peer.connect('K7P4')        │
  │  ── 15s connect timeout ──▶         │
  │     on timeout: destroy + retry     │
  │     backoff 1s→2s→4s→8s→15s         │
  │  conn.on('open')  → hello            │
  │  ◀── welcome(state)                  │
  │                                      │
  │  conn.on('close')                    │  seat held 60s
  │     banner + resync on reconnect     │  then removed
```

The Host reconnects to the signaling server with `peer.reconnect()` if the socket
drops; established data channels survive that.

## 6. Resilience matrix

| Failure                                 | Detection                               | Response                                                    |
| --------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Guest cannot reach the signaling server | `peer` error `network` / `server-error` | Retry with backoff, banner, terminal state after 5 attempts |
| Room does not exist                     | `peer` error `peer-unavailable`         | Stop. "Room not found."                                     |
| Channel never opens                     | 15 s timeout (no error is emitted)      | Retry with backoff, banner with countdown                   |
| Channel drops mid-game                  | `conn` `close` event                    | Banner; seat held 60 s; resync on return                    |
| Host's signaling socket drops           | `peer` `disconnected`                   | `peer.reconnect()`; data channels survive                   |
| Host closes the tab                     | guests' `conn` `close` + `bye`          | "The host ended the game" — explicit, not a freeze          |
| Code already claimed                    | `peer` error `unavailable-id`           | Host regenerates the code (up to 8×)                        |
| Host page reloaded                      | guests' channel closes                  | Same as "host closed the tab" — the room is gone by design  |

## 7. Configuration

`src/config.js` holds every tunable. There are **no environment variables** —
the project must build and run with zero configuration.

| Key                  | Default                           | Purpose                                                              |
| -------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `SIGNALING_HOST`     | `0.peerjs.com`                    | Public PeerServer. Swappable for a self-hosted one.                  |
| `SIGNALING_PORT`     | `443`                             |                                                                      |
| `SIGNALING_PATH`     | `/`                               |                                                                      |
| `ICE_SERVERS`        | Google STUN + two public STUNs    | ICE configuration. Add a TURN entry for symmetric NAT.               |
| `CONNECT_TIMEOUT_MS` | `15000`                           | Per-attempt connect timeout.                                         |
| `RETRY_DELAYS_MS`    | `[1000, 2000, 4000, 8000, 15000]` | Backoff schedule.                                                    |
| `HEARTBEAT_MS`       | `5000`                            | Host's idle snapshot cadence.                                        |
| `SEAT_HOLD_MS`       | `60000`                           | How long a disconnected player's seat is held.                       |
| `STALE_MS`           | `12000`                           | How long a guest waits without a snapshot before showing the banner. |
| `MAX_PLAYERS`        | `8`                               | Room capacity.                                                       |

## 8. Directory map

```
src/
├─ main.js                  bootstrap: config, i18n, router, screens
├─ config.js                every tunable, in one place
├─ core/                    pure, unit-tested
│  ├─ room-code.js          generate / validate / normalize
│  ├─ secret.js             secret generation + bulls/cows
│  ├─ rules.js              rule validation
│  ├─ protocol.js           message types + envelope validation
│  ├─ state.js              state shape, reducers, scoring
│  └─ rng.js                injectable RNG
├─ net/
│  ├─ peer-link.js          PeerJS wrapper: timeout, retry, heartbeat
│  ├─ host-session.js       host side: peer registry + authority
│  └─ guest-session.js      guest side: join, snapshot cache
├─ i18n/                    en.js, ar.js, index.js
├─ ui/                      screens, components, mascot, icons, sfx, confetti
└─ styles/                  main.css (tokens) + game.css (motion)
```

## 9. Testing seams

Two seams make the network testable without a network:

- `src/net/peer-link.js` takes a `PeerFactory` in its options. Tests inject a
  fake peer; production injects PeerJS.
- `src/core/rng.js` exports a seeded generator. Secret and room-code generation
  accept an injected RNG, so their tests are deterministic.
