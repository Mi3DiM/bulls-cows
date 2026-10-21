# Roadmap

What is **not** in the current build. Anything here is a proposal, not a
promise, and nothing here may be started without a plan in the issue
tracker.

---

## Shipped

See [CHANGELOG.md](../CHANGELOG.md).

- Static web app, no backend, no database, no accounts.
- WebRTC peer-to-peer rooms over PeerJS, up to 8 players.
- Host-authoritative state, broadcast as full snapshots.
- English and Arabic, with a fully mirrored right-to-left layout.
- Per-player attempts board, live leaderboard, chat.
- Connection resilience: timeouts, backoff, liveness detection, seat
  holding, and a visible "reconnecting" banner.
- Nine quality gates, all enforced in CI.

---

## Next

### Spectators

The topology already allows a guest to watch without guessing — the
protocol has no concept of a spectator, and the UI has no way to show
one. It is a small change to the state model and a real one to the
interface.

### Host settings during a game

The Host picks the rules when creating a room. Changing the digit count
or the attempt count mid-game would need the state model to allow it and
the scoring to be recomputed. It is a good feature and a fair amount of
work; it should not be bolted on.

### A private room

A room code is a capability: anyone who knows it can join. A second
secret — a separate "invite token" in the link — would let a Host share
the link publicly while keeping the room private. The room code stays
short and memorable; the token is long and not spoken aloud.

### TURN relay

A player behind a symmetric NAT cannot connect without a TURN server.
The ICE server list is already configuration, so this is a deployment
decision rather than a code change — but the game should say so plainly
when a connection fails for that reason, instead of showing a generic
error.

### Rematch

The result screen offers "Play again" for the Host. A proper rematch would
keep the players, reshuffle the turn order and deal a new secret.

---

## Deliberately not planned

| Idea                                 | Why not                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts, logins, email              | Forbidden by the product. The brief asks for no accounts, and a game is better without one.                                                                          |
| A server-side room registry          | Forbidden by the product, and it would remove the whole point.                                                                                                       |
| Persistent leaderboards across games | Needs a database. The leaderboard is per-room and lives in the Host's memory.                                                                                        |
| A bot opponent                       | A bot would need the Host's secret to score its guesses correctly, which breaks the fair-play rule. A separate local mode could work, but it is a different product. |
| Replaying a finished game            | Needs the game history stored somewhere, which means a database.                                                                                                     |

---

## Known rough edges

Honest list of things that are not as good as they could be:

- **The Host is a single point of failure.** Closing their tab ends the
  game. This is the direct consequence of having no server, and the game
  says so plainly rather than pretending otherwise.
- **A guest behind a symmetric NAT cannot connect.** The ICE list has
  STUN but no TURN. It is one configuration change away.
- **The public signaling server is in the EU and shared.** It can be slow
  or rate-limited. The transport already retries; the latency cannot be
  fixed from the client.
- **The elapsed timer ticks in the Host's clock.** Every client shows the
  Host's time, so a client with a skewed clock would disagree — but the
  timer is derived from the Host's timestamps, not from the local clock.
