# ADR 0003 — Host-authoritative state with full-snapshot broadcast

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

Every player must see the same board: whose turn it is, every attempt, every
bull/cow count, who is still in, and the score table. There is no server to
arbitrate, and the network is peer-to-peer and therefore **lossy, reordered, and
occasionally silent**.

Two models are possible:

1. **Event stream** — the Host emits deltas ("player 2 guessed 0247"). Guests
   apply them in order. Cheap on the wire, but every guest must maintain an
   identical replica, and a dropped or reordered message desynchronizes it
   permanently.
2. **Snapshot broadcast** — the Host emits the whole authoritative state on every
   change. Guests replace their local copy.

## Decision

**The Host owns the only authoritative state. Every change is broadcast as a
complete, versioned state snapshot.**

```jsonc
{
  "v": 1,
  "t": "state",
  "rev": 42, // monotonic revision, for out-of-order detection
  "state": {/* …the whole game… */},
}
```

The state is small — at most 8 players, 8 attempts each — so a snapshot is a few
hundred bytes. Fan-out to 7 guests is trivial.

### Rules that follow from this

- The Host **re-derives everything** from its own state. It never accepts a
  client-provided score, turn, or result.
- A guest's guess is a _request_ (`{t:'guess', digits:'1234'}`), not an event.
  The Host validates it, applies it, then broadcasts the new snapshot.
- Snapshots carry a monotonic `rev`. A guest that receives a lower `rev` than it
  already has **ignores** it, so a late-arriving old snapshot can never roll the
  UI backwards.
- The secret is present in a snapshot **only after the game is over**.

## Consequences

### Positive

- **Late joiners are free.** A guest that connects mid-game receives the current
  snapshot as its first message.
- **Reconnects are free.** A guest that reconnects asks for the state again.
- **No drift class of bugs.** There is no replica to reconcile; the guest either
  has the latest snapshot or it is slightly old.
- **Idempotent.** Re-applying the same snapshot is a no-op.

### Negative

- More bytes on the wire than a delta stream. At this scale that is irrelevant.
- Every guest must re-render on every change. Mitigated by rendering from a
  cheap derived view-model and by keeping the DOM diff small.

### Neutral

- A guest that misses a snapshot stays stale until the next one. The Host also
  sends a periodic heartbeat snapshot (every 5 s) so an idle room still
  self-heals.

## Alternatives rejected

| Alternative                            | Why rejected                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Delta/event stream                     | Requires every guest to run an identical replica; a dropped message desynchronizes it forever. Much harder to test. |
| CRDT / eventual-consistency model      | Enormous complexity for a game that has one obvious authority.                                                      |
| Last-writer-wins merge on the guest    | The guest would need a merge rule, and "who wins" is exactly the question the Host already answers.                 |
| Guests keep a local copy of the secret | Breaks the core rule that the secret is never shared before the game ends.                                          |

## Related

- [`docs/protocol.md`](../protocol.md)
- [`docs/architecture.md`](../architecture.md)
