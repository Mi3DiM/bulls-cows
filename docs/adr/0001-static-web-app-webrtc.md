# ADR 0001 — Static web app with WebRTC data channels

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The product is a real-time multiplayer number-guessing game. Players join from
different devices over the public internet, with no accounts, no email, and no
backend. The brief explicitly forbids Supabase, Firebase, Postgres, MongoDB,
any accounts system, and any authentication.

The hard question is therefore: **where does the shared game state live?**

## Decision

The game is a **static web app** (HTML + CSS + vanilla ES modules) whose only
runtime dependency is the **PeerJS** client, which uses WebRTC data channels for
peer-to-peer traffic. The **Host** peer holds the authoritative game state;
guests connect directly to the Host and render what the Host tells them.

The app is built with **Vite 8** and **Tailwind CSS v4** and produces a `dist/`
folder that runs on any static host with **zero environment variables**.

## Consequences

### Positive

- No database, no server, no secrets, no cost. Deployable by uploading files.
- Game traffic is direct peer-to-peer; the signaling server is never in the data path.
- No account friction: a player joins by opening a link.
- The static `dist/` works identically on GitHub Pages, Netlify and Vercel.

### Negative

- The room dies when the Host closes the tab. This is an accepted trade-off, not
  an oversight — it is the direct consequence of having no server.
- The Host is a single point of failure for the session.
- A peer-to-peer game cannot be joined by URL alone without a signaling step;
  PeerJS's public signaling server fills that role.

### Neutral

- NAT traversal depends on STUN (and, for symmetric NAT, TURN). The ICE server
  list is configuration, not code — see `src/config.js`.

## Alternatives rejected

| Alternative                       | Why rejected                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| Firebase / Supabase realtime      | Explicitly forbidden by the brief; adds a database.                        |
| A small Node relay server         | Forbidden ("no backend"). Adds ops, cost and a failure mode.               |
| WebSocket to a public echo server | Would need a message broker for fan-out; the Host already _is_ the broker. |
| Server-Sent Events + polling      | Still a server, and far worse for a real-time game.                        |
| `BroadcastChannel` only           | Same-device only; cannot span phones and laptops.                          |

## Related

- [ADR 0003 — Host-authoritative state](./0003-host-authoritative-state.md)
- [ADR 0002 — Room code as the Host's peer ID](./0002-room-code-as-peer-id.md)
