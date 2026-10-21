# PeerJS cloud — empirical findings

**Date:** 2026-10-21
**PeerJS client:** `peerjs@1.5.5` (latest stable; `2.0.0-beta.3` exists but is a beta and was rejected)
**Node:** v24.16.0 · **Test browser:** Chromium 1248 (Playwright 1.64.1)

Everything below was measured against the live public server, not recalled from
training. Re-verify if you upgrade PeerJS or the server changes.

---

## 1. The public signaling server is alive

```
GET https://0.peerjs.com   →  200
{"name":"PeerJS Server","description":"A server side element to broker connections between PeerJS clients.","location":"EU","website":"https://peerjs.com/"}
```

`location: "EU"` — signaling latency is EU-scoped. Game traffic is direct P2P and
never touches this host.

---

## 2. The signaling wire protocol

The client opens a **raw WebSocket** (not socket.io) to:

```
wss://0.peerjs.com:443/peerjs?key=peerjs&id=<PEER_ID>&token=<RANDOM>&version=1.5.5
```

All four query parameters are required. Omitting `token` or `version` produces a
`403` at the HTTP upgrade, and messages are then rejected because the server
switches protocol shape based on `version`.

- `version` selects the modern envelope: `{type:'SIGNAL', dst, payload:{…}}`
- the legacy (pre-1.x) envelope was `{type:'OFFER'|'ANSWER'|'CANDIDATE', dst, payload}`
- the server answers a successful claim with `{"type":"OPEN"}`
- the server answers a duplicate claim with `{"type":"ID-TAKEN", …}`
- the client maps `ID-TAKEN` → PeerJS error type `unavailable-id`

Source: `peerjs@1.5.5` `dist/peerjs.js` line 3537 (`Socket.start`) and lines
4405–4420 (`_handleMessage`).

---

## 3. Peer ID rules

`peerjs@1.5.5` `dist/peerjs.js` line 3039:

```js
return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(id);
```

- must start and end with an alphanumeric character
- `-`, `_` and space are allowed in the middle
- the client does **not** lowercase the ID it sends

**Server-side uniqueness is case-insensitive.** Measured: while `k7p4` was held
open, a concurrent claim of `K7P4` returned `ID-TAKEN`.

→ **Decision:** the app normalizes every room code to **UPPERCASE** for both
display and transport, so the strings always match exactly. See
`docs/adr/0002-room-code-as-peer-id.md`.

---

## 4. Custom peer IDs work on the public cloud

Claiming `id=K7P4` returned `{"type":"OPEN"}`. Custom IDs are not restricted on
`0.peerjs.com`.

This is what makes the whole serverless design possible: the room code **is** the
host's peer ID, so a guest needs nothing but the code to find the host.

---

## 5. End-to-end proof (real browser, real client)

A page loading the real `peerjs.js` was opened in two Chromium contexts:

```js
// host
new Peer('K7P4')            // peer open id=K7P4
peer.on('connection', c => c.on('data', d => …))

// guest
new Peer()                  // peer open id=9f33741b-…
peer.connect('K7P4', { reliable: true })
```

Result: `host conn open` + `client conn open`, and **both directions of data
flowed**. Uppercase matched uppercase on both sides.

---

## 6. Star topology (host + 4 clients)

Four independent browser contexts joined one host room.

| Metric                                    | Result                                      |
| ----------------------------------------- | ------------------------------------------- |
| Clients that completed a data channel     | 4 / 4                                       |
| Hosts that received data from all clients | 4 / 4                                       |
| Nonexistent room                          | `peer-unavailable` error surfaced correctly |

---

## 7. Reliability — the number that shaped the design

Six consecutive star-topology runs: **5 passed, 1 failed**. The failure was
silent: one client never opened its data channel and emitted **no error** — the
guest was simply stuck in a "connecting" state with no way forward.

> This is the single most important finding in this document. A guest must never
> be left waiting silently.

→ **Decision:** a 15 s connect timeout with exponential backoff (1 s → 15 s cap),
a visible "Reconnecting…" banner, and a snapshot-resync on reconnect. See
`docs/adr/0004-connection-resilience.md`.

---

## 8. Known limits of the public server

- **No custom peer IDs issues** — confirmed working (§4).
- **Single region (EU)** — signaling only.
- **Rate limits exist.** Sustained abuse of a free public service can get an IP
  throttled. The app therefore treats signaling failure as a _recoverable_ state
  with a clear message, never as a crash.
- **No persistence.** A room lives only as long as the host's peer connection.

---

## 9. How to re-run these probes

The probes used for this document live in the repo under `tests/e2e/`. The
wire-level probes (`ws`) were run ad hoc against `wss://0.peerjs.com` with the
`ws` package and the URL shape from §2.

**Checklist when PeerJS is upgraded:**

1. Re-read `dist/peerjs.js` for `VALID_ID_REGEX` — did the ID grammar change?
2. Re-read `Socket.start` — did the query-parameter shape change?
3. Re-read `_handleMessage` — did the server message types change?
4. Re-run the 2-browser e2e and the 4-client star-topology spec.
5. Update the numbers in this document.
