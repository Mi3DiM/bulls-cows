# Wire protocol

> Version **1**. Read this before changing any message.
> Implementation: `src/core/protocol.js` (types + validation).

## 1. Transport

WebRTC **data channel** (reliable, ordered) via PeerJS.

One channel per guest → the Host. The Host holds N channels and fans out to all.

The PeerJS signaling server is used only to exchange SDP/ICE. Game traffic never
touches it.

## 2. Envelope

Every message is a JSON object:

```jsonc
{
  "v": 1, // protocol version, integer, required
  "t": "state", // message type, string, required
  // …type-specific fields…
}
```

Rules:

- `v` and `t` are **required**. A message without them is ignored.
- `v` must equal the supported version. A message with an unknown version is
  ignored (we cannot half-understand a future protocol).
- Unknown extra fields are ignored, not rejected. This keeps the protocol
  forward-compatible.
- A message that is not a plain object, or whose `t` is unknown, is ignored.
- Maximum accepted serialized size: **8 KB**. Anything larger is ignored — the
  state of a room is a few hundred bytes, so this only ever catches abuse.

## 3. Message types

### 3.1 Guest → Host (requests)

The Host treats every inbound message as a _request_. A request never changes
state on its own; the Host validates it, applies it, and then broadcasts the
resulting snapshot.

#### `hello`

Sent once, immediately after the data channel opens.

```jsonc
{ "v": 1, "t": "hello", "name": "Sara", "avatar": 3, "locale": "ar" }
```

| Field    | Type    | Rules                                                           |
| -------- | ------- | --------------------------------------------------------------- |
| `name`   | string  | trimmed, 1–24 chars after trimming, control characters stripped |
| `avatar` | integer | `0`–`avatarCount-1`; out of range → `0`                         |
| `locale` | string  | `"en"` or `"ar"`; anything else → `"en"`                        |

A `hello` from an already-registered peer is ignored (the peer keeps its
original identity).

#### `guess`

```jsonc
{ "v": 1, "t": "guess", "digits": "0247" }
```

| Field    | Type   | Rules                                                                                                        |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `digits` | string | exactly `rules.digits` characters, each `0`–`9`; if `allowRepeats` is false, all characters must be distinct |

The Host **ignores** a guess that fails these rules and does not advance the
turn. The Host computes `bulls` and `cows` itself — the client never sends them.

#### `chat`

```jsonc
{ "v": 1, "t": "chat", "text": "Go Hamed!" }
```

| Field  | Type   | Rules                                                   |
| ------ | ------ | ------------------------------------------------------- |
| `text` | string | 1–200 chars after trimming; control characters stripped |

Rendered with `textContent` only. Never `innerHTML`.

#### `ping`

```jsonc
{ "v": 1, "t": "ping" }
```

Optional. The Host answers with a `pong`. Used to measure round-trip time and to
keep intermediaries from idling the channel out.

### 3.2 Host → Guest (events)

#### `welcome`

The first message a guest receives. Carries the guest's identity and the full
current state, so a guest that joins late — or reconnects — is immediately
correct.

```jsonc
{ "v": 1, "t": "welcome", "you": { "id": "p3", "name": "Sara", "avatar": 3 }, "state": { … } }
```

#### `state`

The authoritative snapshot. Broadcast to **all** guests after every change, and
at least every `HEARTBEAT_MS` while the room is idle.

```jsonc
{ "v": 1, "t": "state", "rev": 42, "state": { … } }
```

| Field   | Type    | Rules                                               |
| ------- | ------- | --------------------------------------------------- |
| `rev`   | integer | monotonically increasing per Host session           |
| `state` | object  | the full game state (see `docs/architecture.md` §3) |

**Ordering rule:** a guest ignores a `state` whose `rev` is **not greater** than
the `rev` it already holds. A late-arriving older snapshot can never roll the UI
backwards.

**Secret rule:** `state.secret` is `null` unless `state.phase === "finished"`.
The Host never puts the secret in a snapshot before the game is over.

#### `chat`

```jsonc
{ "v": 1, "t": "chat", "from": "p3", "name": "Sara", "text": "Go Hamed!", "at": 1712345678901 }
```

#### `toast`

A short, non-blocking notice.

```jsonc
{ "v": 1, "t": "toast", "kind": "info", "text": "Room is full" }
```

`kind` ∈ `info | success | warning | error`.

#### `notice`

A structural change the guest must react to.

```jsonc
{ "v": 1, "t": "notice", "kind": "host-left", "text": "The host ended the game" }
```

`kind` ∈ `player-left | player-rejoined | host-left | game-starting`.

#### `bye`

Terminal. The Host is closing the session.

```jsonc
{ "v": 1, "t": "bye", "reason": "host-left" }
```

`reason` ∈ `host-left | room-closed`. A guest that receives this shows a clear
end-of-game screen. It never freezes.

#### `pong`

```jsonc
{ "v": 1, "t": "pong", "at": 1712345678901 }
```

## 4. State object

```jsonc
{
  "phase": "lobby", // lobby | playing | finished
  "rules": { "digits": 4, "attempts": 8, "allowRepeats": false },
  "players": [
    {
      "id": "p1",
      "name": "CoderHamid",
      "avatar": 0,
      "isHost": true,
      "status": "active", // active | disconnected | eliminated | won
      "attempts": [{ "digits": "0247", "bulls": 2, "cows": 1, "at": 1712345678901 }],
      "points": 0,
    },
  ],
  "turn": "p1",
  "winner": null,
  "secret": null,
  "startedAt": null,
  "rev": 0,
}
```

`status` values:

| Value          | Meaning                                           |
| -------------- | ------------------------------------------------- |
| `active`       | In the game, may still guess.                     |
| `disconnected` | Channel dropped; seat is held for `SEAT_HOLD_MS`. |
| `eliminated`   | Out of attempts.                                  |
| `won`          | Solved the secret.                                |

## 5. Turn order

Round-robin over the players whose `status` is `active`, in join order.

- After a guest's guess, the turn advances to the next `active` player.
- If every remaining player is `eliminated`, the phase becomes `finished` and
  `winner` stays `null`.
- The Host skips `disconnected` and `eliminated` players when advancing.
- The Host ignores a guess from a player who is not the current player. The
  guess is simply not applied — the turn does not move.

## 6. Validation summary

| Inbound field      | Validated                           | On failure                    |
| ------------------ | ----------------------------------- | ----------------------------- |
| `hello.name`       | trimmed, 1–24 chars                 | message ignored               |
| `hello.avatar`     | integer in range                    | coerced to `0`                |
| `guess.digits`     | length, charset, uniqueness         | guess ignored, turn unchanged |
| `chat.text`        | 1–200 chars, control chars stripped | message ignored               |
| envelope `v` / `t` | present, known                      | message ignored               |
| payload size       | ≤ 8 KB                              | message ignored               |

**Nothing else is trusted.** The Host never accepts a score, a result, a turn
change, or the secret from a guest.

## 7. Change log

| Version | Change            |
| ------- | ----------------- |
| 1       | Initial protocol. |
