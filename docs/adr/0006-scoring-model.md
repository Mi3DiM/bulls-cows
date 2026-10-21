# ADR 0006 — Scoring: transparent, deterministic, host-computed

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The reference design shows a leaderboard with a star rating and a point value
next to each player. A score has to be **legible to the players** — an opaque
number feels arbitrary, and a score that depends on wall-clock timing or
network latency is unfair and unreproducible.

## Decision

The Host computes the score. It is a pure function of the game state, so it is
deterministic and unit-testable.

### Formula

```
points = 1000                        // base for winning
       + 50  × unusedAttempts        // reward for solving it quickly
       + 100 × placementBonus        // 1st → 100, 2nd → 50, 3rd+ → 0
```

`unusedAttempts = attemptsAllowed − attemptIndex` (the attempt that won does
not count as unused).

A player who is eliminated without solving it scores **0** — but the leaderboard
still shows their attempts, so the table reads as a story rather than a
scoreboard for winners only.

### Star rating

A 5-star display rating, derived from the same points, used for presentation
only:

| Stars | Points |
| ----- | ------ |
| ★★★★★ | ≥ 1400 |
| ★★★★☆ | ≥ 1250 |
| ★★★☆☆ | ≥ 1100 |
| ★★☆☆☆ | ≥ 1000 |
| ★☆☆☆☆ | < 1000 |

The star rating is **never** used for ranking. Ranking is by points, then by
attempt count, then by join order — a total order, so the table never wobbles.

## Consequences

- The scoring function is a pure function in `src/core/state.js` and is
  exhaustively unit-tested.
- The points breakdown is shown in the results screen, so the number is
  explainable on screen.
- No timing input ⇒ no ties caused by clock skew ⇒ reproducible tests.

## Alternatives rejected

| Alternative                        | Why rejected                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Speed bonus based on elapsed time  | Wall-clock dependent, so the score is not reproducible and is unfair on a slow connection. |
| Points per correct bulls/cows      | Rewards guessing near-misses, which pulls players away from solving it.                    |
| Hidden/secret formula              | Feels arbitrary to players and cannot be shown on screen.                                  |
| Points with no base (only bonuses) | A player who wins on the last attempt could score zero — that reads as a loss.             |
