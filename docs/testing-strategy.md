# Testing strategy

Three layers, each with a different job. The split is deliberate: the risk
in this project is concentrated in two places — the game rules, and the
network — and they need opposite kinds of test.

| Layer        | Tool                                  | Speed  | Runs against                           |
| ------------ | ------------------------------------- | ------ | -------------------------------------- |
| Unit         | Vitest                                | ~4 s   | The pure logic, in isolation.          |
| End-to-end   | Playwright                            | ~4 min | Real browsers, the live PeerJS server. |
| Static gates | ESLint, tsc, Prettier, custom scripts | ~10 s  | The source itself.                     |

---

## 1. Unit tests — the pure core

`src/core/**` has no DOM, no network, no timers and no globals. It is
tested in isolation, and coverage is **enforced**: `src/core/**` must stay
above 90 % lines, or the build fails.

The rule is not decoration. Every bug found in the core during development
was a wrong expectation written in the test, and writing the test is what
found it:

- the turn skipped to the wrong player when the player on turn left the
  room — the scan ran against the already-shortened player list;
- the bulls/cows scoring disagreed with the reference in three cases
  where a digit appeared more than once;
- the win bonus counted the winning attempt as unused.

What is covered:

| Module      | What is tested                                                                        |
| ----------- | ------------------------------------------------------------------------------------- |
| `room-code` | Generation, the alphabet, normalisation, rejection of anything that cannot be a code. |
| `secret`    | Generation, uniqueness, and bulls/cows scoring including repeated digits.             |
| `rules`     | Validation, and that a malformed value from the wire cannot break the game.           |
| `protocol`  | Every message type, every rejection path, and the size limit.                         |
| `state`     | Turn rotation, elimination, scoring, the secret boundary, ranking.                    |
| `rng`       | Determinism, uniformity, and that a seeded generator really is seeded.                |
| `ui`        | Every screen and component renders without throwing.                                  |

The UI tests exist because a class list accidentally passed as a tag name
produced `<inline-flex>` elements that no CSS applied to, and nothing
failed. Rendering every screen in jsdom catches that class of mistake in
milliseconds.

---

## 2. End-to-end tests — the real network

These run in **real Chromium**, against the **live public PeerJS
signaling server**, in separate browser contexts.

A mocked transport would be faster and would prove nothing about the
failure modes that matter. The single most important finding in this
project came from the real server:

> Roughly **one in six** connections never opens, and emits **no error at
> all**. The guest is simply stuck.

That is why `src/net/peer-link.js` has a connect timeout, a backoff
schedule, and a hard distinction between "this room does not exist" (a
result) and "the network is having a moment" (a condition). A mocked
transport would never have produced that finding, and the retry logic
would not exist.

### The specs

| Spec                    | What it proves                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room.spec.js`          | Creating a room, joining by code, the share link, an unknown room, a malformed code.                                                                                            |
| `game.spec.js`          | A full round to the win screen, a wrong guess being scored, the turn advancing, the attempts board, the chat, the leaderboard, the keypad being inert when it is not your turn. |
| `star-topology.spec.js` | One host and four guests, all connected.                                                                                                                                        |
| `resilience.spec.js`    | The host ending the game, a guest closing their tab, a guest reloading, a guest leaving.                                                                                        |
| `a11y.spec.js`          | axe-core on every screen a player can reach.                                                                                                                                    |
| `rtl.spec.js`           | The Arabic locale, the direction flip, and no horizontal overflow.                                                                                                              |
| `responsive.spec.js`    | The mobile layout, the tab bar, and the 44 px touch targets.                                                                                                                    |

### The flake policy

**The suite must be green on three consecutive runs.** A spec that is
intermittently red is a bug in the product or in the spec, and both are
fixed before the suite is called green. The suite is never "retried until
it passes" in CI.

The end-to-end suite needs network access, so it runs in its own CI job
rather than blocking the fast loop.

---

## 3. Static gates

| Gate      | Command                  | Catches                                                   |
| --------- | ------------------------ | --------------------------------------------------------- |
| Lint      | `npm run lint`           | `innerHTML`, unused code, and style drift.                |
| Format    | `npm run format:check`   | Formatting churn in review.                               |
| Typecheck | `npm run typecheck`      | Wrong types, `tsc --noEmit` over JSDoc-annotated sources. |
| Contrast  | `npm run check:contrast` | An unreadable colour pair in the design tokens.           |
| Bundle    | `npm run check:bundle`   | The payload growing past what a phone can load quickly.   |

---

## 4. How to run everything

```bash
npm run verify         # everything except the end-to-end suite
npm run test           # unit tests
npm run test:coverage  # unit tests with the coverage report
npm run test:e2e       # end-to-end, real browsers
npm run test:e2e:ui    # the end-to-end suite, with the Playwright UI
```

The end-to-end suite builds and serves the app itself, so it always tests
the production bundle.
