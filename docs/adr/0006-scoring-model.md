# ADR 0006 — Scoring: live, transparent, host-computed

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The reference design shows a **live** leaderboard: four players, all with
non-zero point values, visible while the game is still running. A score that
only materialises at the end would not match that, and would give players
nothing to chase mid-round.

A score has to be **legible to the players** — an opaque number feels
arbitrary — and it must not depend on wall-clock timing or network latency, or
it would be unfair and unreproducible.

## Decision

The Host computes the score. It is a pure function of the game state, so it is
deterministic and unit-testable. Points come from two places.

### 1. Per-attempt points — earned live

```
attemptPoints = bulls × 25 + cows × 10
```

A bull is worth more than a cow because it is a strictly stronger signal: a
bull narrows the search space more than a cow does.

| Guess            | Points |
| ---------------- | ------ |
| 4 bulls (solved) | 100    |
| 3 bulls, 1 cow   | 85     |
| 2 bulls, 2 cows  | 70     |
| 0 bulls, 4 cows  | 40     |
| 0 bulls, 0 cows  | 0      |

The leaderboard therefore moves as the game is played, exactly as the reference
does.

### 2. End-of-game bonuses — earned once

```
winBonus    = 1000 + 50 × unusedAttempts + placementBonus
placementBonus = 100 (first) | 50 (second) | 0 (third and below)
```

`unusedAttempts = attemptsAllowed − attemptsUsed`. `attemptsUsed` counts every
attempt the player made, **including the one that solved the secret** — so
solving it on the first attempt leaves every other attempt unused, and is worth
the most.

A player who is eliminated without solving it keeps their per-attempt points and
receives no bonus. Their attempts still show in the table, so the leaderboard
reads as a story rather than a scoreboard for winners only.

### Star rating

A 5-star display rating derived from the total, used for presentation **only**:

| Stars | Points |
| ----- | ------ |
| ★★★★★ | ≥ 1400 |
| ★★★★☆ | ≥ 1250 |
| ★★★☆☆ | ≥ 1100 |
| ★★☆☆☆ | ≥ 1000 |
| ★☆☆☆☆ | < 1000 |

The star rating is never used for ranking.

### Ranking

By points, then by fewest attempts, then by join order. A total order — the
table never wobbles between two snapshots.

## Consequences

- The scoring functions are pure functions in `src/core/state.js` and are
  exhaustively unit-tested.
- The points breakdown is shown on the results screen, so the number is
  explainable on screen.
- No timing input ⇒ no ties caused by clock skew ⇒ reproducible tests.
- A player who is winning on points mid-game is not guaranteed to win. The game
  is won by guessing the secret, not by accumulating points. That is intentional
  and stated in the UI.

## Alternatives rejected

| Alternative                                   | Why rejected                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Speed bonus based on elapsed time             | Wall-clock dependent, so the score is not reproducible and is unfair on a slow connection.                                     |
| Points only at the end                        | Gives players nothing to chase during the round, and does not match the reference's live leaderboard.                          |
| Points per bulls/cows only, with no win bonus | A player who solves it on the last attempt would score about the same as one who flailed all round. The win needs to dominate. |
| Hidden or secret formula                      | Feels arbitrary to players and cannot be shown on screen.                                                                      |
| Points with no base (only bonuses)            | A player who wins on the last attempt could score zero — that reads as a loss.                                                 |
