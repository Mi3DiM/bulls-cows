# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-10-21

The first playable release.

### Added

- **Multiplayer rooms over WebRTC.** A player creates a room and gets a
  four-character code; every other player connects to the Host directly
  over a PeerJS data channel. Up to eight players per room, star
  topology.
- **Host-authoritative state.** The Host owns the game and broadcasts a
  full snapshot after every change, so late joiners and reconnects work
  without any extra protocol.
- **The game itself.** Four-digit secrets by default, unique digits,
  eight attempts each, round-robin turns, live scoring, and a final
  leaderboard.
- **A neon-arcade interface**, designed mobile-first: a pinned room-code
  bar, a glowing digit vault, a large keypad, a per-player attempts
  board, a live leaderboard and chat.
- **English and Arabic**, with a language toggle, full right-to-left
  mirroring, and both scripts covered by the same font stack.
- **Connection resilience.** A 15-second connect timeout, exponential
  backoff, liveness detection so a vanished guest is noticed, seat
  holding, a visible "reconnecting" banner with a countdown, and a
  definite "this room does not exist" answer instead of an endless
  spinner.
- **A join screen** where a guest picks a name and an avatar — no
  account, no email, no password.
- **Original artwork.** An SVG mascot with four expressions, eight
  generated avatars, and a hand-drawn icon set. No emoji, no bitmaps.
- **Sound and haptics.** Every effect is synthesised with the Web Audio
  API, so the app ships without a single binary asset.
- **Win celebration** with confetti, disabled under
  `prefers-reduced-motion`.
- **Deployment** for GitHub Pages, Netlify and Vercel, from the same
  `dist/` folder. No server, no function, no environment variable.
- **Nine quality gates** — lint, format, typecheck, unit, build, bundle
  budget, end-to-end, accessibility and contrast — enforced in CI.
- **Documentation**: seven architecture decision records, a wire-protocol
  specification, an architecture overview, a design system, an
  accessibility statement, a testing strategy, a deployment guide, and a
  record of what was measured.

### Fixed

- The room code is normalised to uppercase everywhere, because the public
  signaling server treats peer IDs case-insensitively.
- A room code that is already taken is regenerated automatically, so a
  player is never shown a code they cannot use.
- The secret is never included in a snapshot before the game is over.

[1.0.0]: https://github.com/your-user/bulls-cows/releases/tag/v1.0.0
