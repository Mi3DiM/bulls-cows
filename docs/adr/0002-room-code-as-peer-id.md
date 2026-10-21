# ADR 0002 — The room code _is_ the Host's peer ID

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

A guest must be able to join a room knowing nothing but a short code such as
`K7P4`. With no database and no room registry, the mapping **code → host
address** has to be derivable from the code alone.

PeerJS lets a peer claim a chosen ID. If the Host's peer ID is derived
deterministically from the room code, then the code _is_ the address, and no
lookup service is needed.

## Decision

The Host's PeerJS peer ID **is** the room code, normalized to **uppercase**.

```
room code "K7P4"  →  host peer id "K7P4"  →  guest: peer.connect("K7P4")
```

### Alphabet

```
ABCDEFGHJKMNPQRSTUVWXYZ23456789
```

31 symbols, 4 characters → **923,521** possible codes. Excluded: `O` and `0`,
`I` and `1`, `L` — the classic misreadings when a code is read aloud or typed
from a screenshot.

### Case normalization is mandatory, not cosmetic

Measured against the live public server: **peer-ID uniqueness is
case-insensitive** — while `k7p4` was held, a concurrent claim of `K7P4`
returned `ID-TAKEN`. The client itself does _not_ lowercase what it sends.

Therefore the app normalizes at a single choke point (`normalizeRoomCode`) and
uses the uppercase form for display, for the Host's peer ID, and as the guest's
connect target. The strings then always match byte-for-byte.

### Collisions

Two live rooms can draw the same code. The server resolves it: the second Host
to claim it receives `unavailable-id`. The app treats that as routine —
it **regenerates the code automatically** (up to 8 attempts) and only then shows
the player the final code. A player therefore never sees a code they cannot use.

## Consequences

- **Zero lookup infrastructure.** The code is the address.
- **The code is a capability.** Anyone who knows it can join the room. That is
  inherent to the design and is documented in the README.
- **A lost code means a lost room.** There is no recovery path, by design.
- **Code exhaustion is theoretically reachable** (923 k codes) but a collision
  self-heals in under a second and the player sees only the working code.

## Alternatives rejected

| Alternative                                     | Why rejected                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Random peer ID + a code→ID registry             | Requires a server. Forbidden.                                                             |
| Longer code (e.g. 8 chars) to reduce collisions | Collisions already self-heal; a long code is worse to read aloud and type.                |
| Lowercase codes                                 | No benefit; uppercase is easier to distinguish and to read aloud.                         |
| A checksum character in the code                | Would lengthen the code; a mistyped code already produces a clear "room not found" error. |

## Related

- [`docs/research/peerjs-findings.md`](../research/peerjs-findings.md) §3, §4
