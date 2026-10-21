# ADR 0007 — Testing strategy: pure core, real-network e2e, axe

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

This project's risk is concentrated in two places:

1. **Game logic** — bulls/cows scoring, turn rotation, elimination, protocol
   validation. Bugs here are silent and ruin the game.
2. **The network** — a peer-to-peer handshake against a public signaling server
   that measurably fails ~1 in 6 times without reporting an error.

A test suite that mocks the network proves nothing about the network. A test
suite that exercises the real network is slow and occasionally flaky. Both
halves are needed, and the split must be explicit.

## Decision

Three layers, each with a different job.

### Layer 1 — Unit (Vitest, `src/core/**` and `src/net/**`)

`src/core/**` is **pure**: no DOM, no network, no timers, no globals. It is
tested in isolation, and coverage of `src/core/**` must be **≥ 90 % lines**
(enforced by a coverage threshold in `vitest.config.js`, so a regression fails
the build rather than a report).

What gets tested exhaustively:

- bulls/cows scoring across every edge case (perfect match, zero bulls, one
  digit, repeated digits, off-by-one positions)
- secret generation: length, digit range, uniqueness, distribution sanity
- room-code generation and validation: alphabet, length, normalisation, rejection
  of `O/0/I/1/L`
- protocol envelope validation: rejection of unknown types, wrong types,
  missing fields, oversized payloads
- state reducers: turn rotation, skipping eliminated players, scoring, winning
- the scoring table from ADR 0006

### Layer 2 — E2E (Playwright, real Chromium, real PeerJS cloud)

These specs run against **the live public signaling server**, in real browser
contexts, because that is the only way to observe the failure modes that matter.

Required specs:

| Spec                     | Asserts                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `room.spec.js`           | Host creates a room, the code appears, a guest joins by link, both see each other           |
| `game.spec.js`           | A full game loop: guess → bulls/cows → correct guess → win screen with the secret           |
| `star-topology.spec.js`  | One host + 4 guests all connected and exchanging data                                       |
| `resilience.spec.js`     | Guest sees a reconnecting banner when the channel is dropped, then resyncs                  |
| `errors.spec.js`         | Joining a non-existent room shows a clear "room not found" state                            |
| `duplicate-code.spec.js` | A second host claiming a taken code regenerates it automatically                            |
| `rtl.spec.js`            | Switching to Arabic sets `dir="rtl"`, mirrors the layout, and causes no horizontal overflow |
| `a11y.spec.js`           | axe-core on the home, game and result screens — 0 critical, 0 serious                       |
| `responsive.spec.js`     | 375 / 390 / 768 / 1440 px viewports render without overflow                                 |

**Flake policy:** the suite must be green on three consecutive runs. A spec
that is intermittently red is a bug in the product or in the spec, and both are
fixed before the suite is called green. The suite is never "retried until it
passes" in CI.

### Layer 3 — Static gates

- **Contrast** — `npm run check:contrast` parses the design tokens and asserts
  every foreground/background pair in the palette meets WCAG AA (4.5:1 for body
  text, 3:1 for large text and UI borders).
- **Bundle budget** — `npm run check:bundle` fails if the built JS exceeds the
  agreed budget. A game that takes 10 s to load on mobile data is broken.
- **Lint** — `no-restricted-properties` blocks `innerHTML`, so a user-supplied
  string can never become markup.
- **Typecheck** — `tsc --noEmit` with `checkJs` over JSDoc-annotated sources.

## Consequences

- The e2e suite needs network access. It is separated from `npm test` so the
  fast loop stays fast, and CI runs it on a schedule as well as on push.
- The e2e suite is slower than a typical mock-based suite. That is the point:
  it tests the thing that actually breaks.
- Pure core logic is a hard architectural constraint, not a preference. If a
  module in `src/core/**` needs the DOM, it belongs in `src/ui/`.

## Alternatives rejected

| Alternative                                  | Why rejected                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock the PeerJS transport in unit tests only | Would not have caught the silent-connection failure, which is the most likely real-world failure.                                                        |
| Use a local PeerServer in CI                 | Closer to production, but it needs a backend process and hides the public-server behaviour we actually depend on. The specs run against the real server. |
| Snapshot testing of the whole UI             | Brittle, slow, and it does not assert behaviour.                                                                                                         |
| Manual QA only                               | Not reproducible and not a gate.                                                                                                                         |
