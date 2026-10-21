# ADR 0004 — Connection resilience: timeouts, retries and resync

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

Local e2e runs against the real public signaling server showed that **1 in 6
star-topology connections failed silently**: the guest's data channel never
opened, and the PeerJS client emitted **no error event**. The guest was stuck
in a "connecting" state with no way forward and no way to tell what happened.

This is not hypothetical — it is the measured behaviour of the system we are
shipping against. A WebRTC connection is a negotiation across two networks
(STUN, then a direct peer path), and any of those steps can stall without
raising an error.

The default PeerJS behaviour assumes the connection will eventually resolve.
For a game, that assumption is unacceptable: a player staring at a spinner
with no feedback is the worst experience we can ship.

## Decision

Every connection attempt is wrapped in an explicit, observable lifecycle.

### 1. Connect timeout with exponential backoff

A guest that has not reached the `open` state within **15 s** aborts the attempt
and retries. Backoff: **1 s → 2 s → 4 s → 8 s → 15 s (cap)**, up to 5 attempts.
Each attempt tears down the old peer and builds a fresh one — a half-open peer
cannot be revived.

### 2. Never fail silently

While an attempt is in flight the UI shows a **"Reconnecting…"** banner with a
live countdown to the next attempt. The player always knows the network is
being worked on. A connection that dies after being established shows the same
banner.

### 3. Distinguish "not found" from "not yet"

| Error                                       | Meaning                       | Behaviour                                                                |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `peer-unavailable`                          | No host is claiming that code | **Stop.** Show "Room not found — check the code". Retrying is pointless. |
| `unavailable-id`                            | Code already claimed          | Only the Host hits this. Regenerate the code.                            |
| `network` / `server-error` / `socket-error` | Signaling unreachable         | Retry with backoff, then show a clear failure state.                     |
| Timeout (no error at all)                   | The measured silent failure   | Retry with backoff.                                                      |

The distinction matters: "room not found" is a _result_, the others are
_conditions_, and a user should never be asked to wait for a result that will
never arrive.

### 4. Heartbeat and staleness detection

The Host broadcasts a snapshot at least every **5 s**, so a guest detects
staleness within ~12 s and can surface the reconnecting banner.

### 5. Seat holding

When a guest's channel closes, the Host keeps the player's seat for **60 s**
(marked "reconnecting") before removing them. This covers a genuine transient
drop — a phone switching from Wi-Fi to cellular — without immediately
penalising the player.

### 6. Resync

On reconnect, the Host sends a `welcome` message containing the full current
state. A guest therefore recovers its entire position — turn, attempts,
scores, players — from one message.

## Consequences

- No player is ever left staring at an unexplained spinner.
- The retry logic costs a little battery and a few round trips. Worth it.
- The 60 s seat-hold means a player who genuinely leaves still occupies a slot
  briefly. The Host can remove them manually from the player list.

## Alternatives rejected

| Alternative                                      | Why rejected                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Rely on PeerJS's own `error` event               | Measured to be insufficient — the most common failure emits nothing.                |
| A fixed 30 s timeout, no retry                   | Too slow to feel responsive and still fails permanently on the first attempt.       |
| Infinite retry                                   | An infinite spinner with no end state. The player must always get a terminal state. |
| WebSocket transport instead of a data channel    | Requires a signaling server of our own. Forbidden.                                  |
| Reconnect immediately on `close` without backoff | Hammers the signaling server during an outage and can exhaust an IP's rate limit.   |

## Related

- [`docs/research/peerjs-findings.md`](../research/peerjs-findings.md) §7
- [`docs/protocol.md`](../protocol.md)
