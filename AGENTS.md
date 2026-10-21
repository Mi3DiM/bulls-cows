# AGENTS.md - Operating rules for this repository

> Applies to every human and every AI agent working in this repo.
> Read this file completely **before** making a change. It is binding.

---

## 1. What this project is

`Bulls & Cows` - a multiplayer, peer-to-peer number-guessing game.

- **Static web app.** HTML + CSS + vanilla JavaScript ES modules. No framework.
- **WebRTC via PeerJS.** The Host holds the authoritative game state; guests connect
  to the Host over a PeerJS data channel. Star topology.
- **No database. No backend. No accounts. No auth.** All state lives in the Host's
  memory and dies with the Host's tab. This is a hard product constraint, not an
  oversight - see `docs/adr/0003-host-authoritative-state.md`.
- **Deployable as static files** to GitHub Pages, Netlify, or Vercel.

---

## 2. Non-negotiable product constraints

| Constraint         | Rule                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| No database        | Never add Supabase / Firebase / Postgres / Mongo / SQLite / any persistence layer. |
| No backend         | Never add server routes, serverless functions, or a signing service.               |
| No accounts        | Never add sign-up, sign-in, email, password, tokens, or user records.              |
| No project secrets | This project must remain deployable with zero environment variables.               |
| Static output      | `npm run build` must produce a `dist/` that works on any static host.              |

The only permitted external dependency is the **PeerJS public signaling server**
(`0.peerjs.com`). It is a _signaling_ relay, not a data store - game traffic never
touches it. Its address is swappable in `src/config.js` if a self-hosted
PeerServer is ever needed.

---

## 3. Definition of Done - a stage is NOT complete until every applicable gate passes

Never report a stage as finished, and never open a PR, while any applicable gate
is red. A gate that cannot be run must be reported as **not run** with a reason -
never silently skipped.

| Gate             | Command                        | Requirement                                              |
| ---------------- | ------------------------------ | -------------------------------------------------------- |
| **G1 lint**      | `npm run lint`                 | 0 errors, 0 warnings                                     |
| **G2 format**    | `npm run format:check`         | clean                                                    |
| **G3 typecheck** | `npm run typecheck`            | 0 errors (`tsc --noEmit` with `checkJs`)                 |
| **G4 unit**      | `npm run test`                 | all pass; `src/core/**` >= 90 % line coverage            |
| **G5 build**     | `npm run build`                | succeeds, no errors, bundle within budget                |
| **G6 e2e**       | `npm run test:e2e`             | all Playwright specs pass                                |
| **G7 a11y**      | `npm run test:e2e` (axe specs) | 0 critical, 0 serious violations                         |
| **G8 contrast**  | `npm run check:contrast`       | 0 failures                                               |
| **G9 docs**      | manual                         | README / ADR / `docs/protocol.md` updated for the change |

`npm run verify` runs G1-G5 + G8. CI runs G1-G9.

---

## 4. Engineering rules

### 4.1 Workflow

1. **Plan -> implement -> verify -> document -> commit.** No code without a plan.
2. Read `docs/architecture.md` before touching `src/core/**` or `src/net/**`.
3. Read `docs/protocol.md` before changing any wire message.
4. **One logical change per commit.** Never mix a refactor with a feature.
5. **Never** rewrite or squash published history. Never force-push `main`.

### 4.2 Git

- Branches: `main` (protected), `develop` (integration), plus
  `feat/<slug>` / `fix/<slug>` / `docs/<slug>` / `chore/<slug>`.
- Commit messages follow **Conventional Commits**:
  `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `perf:`, `chore:`, `build:`, `ci:`.
  Subject <= 72 chars, imperative mood, no trailing period.
- Commit early and often. A change is committed as soon as it is green, not
  batched up at the end of a phase.
- Never commit `dist/`, `node_modules/`, `coverage/`, `.env`, or any key.

### 4.3 Testing

- **Every bug fix starts with a failing test** that reproduces the bug. Red -> fix -> green.
- `src/core/**` must stay **pure**: no DOM, no network, no timers, no globals.
  It is unit-tested in isolation and is the part we can trust most.
- New behaviour ships with new tests in the same commit.
- The end-to-end suite runs against the **live public PeerJS server** in real
  browsers. A mocked transport would not catch the failures that actually
  happen. The suite must be green on three consecutive runs.

### 4.4 Correctness

- Never trust client-supplied values. The Host validates every inbound message
  and re-derives every score, turn, and win condition itself.
- The secret must never appear in a snapshot before the game is over.
- All user-supplied text is inserted with `textContent` - never `innerHTML`.
  (`eslint` enforces this via `no-restricted-properties`.)

### 4.5 Frontend

- Tailwind v4 with design tokens in `src/styles/main.css` (`@theme`). **No raw hex
  in components** - use the token names so light/dark and RTL stay consistent.
- **Class lists are space-separated, never dot-separated.**
  `el('div flex items-center')`, not `el('div.flex.items-center')`.
  Tailwind extracts class names from the source _text_, and a dotted run is a
  single token, so the utilities inside it are never generated and the layout
  breaks silently. A dot between two digits belongs to the class name
  (`py-2.5`, `gap-1.5`, `tracking-[0.35em]`).
  See `docs/adr/0008-space-separated-class-lists.md`.
- Use **logical properties** (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`, `text-start`)
  so the Arabic RTL layout mirrors automatically. Never `ml-`/`mr-`/`left`/`right`.
- Respect `prefers-reduced-motion`. A decorative animation that cannot be
  disabled is a defect.
- Every interactive target is at least 44 x 44 px. Every icon-only button has an
  `aria-label`. Focus must always be visible.
- Text contrast is at least 4.5:1 against its actual background.

### 4.6 Dependencies

- Verify the **current official documentation** before using any API - do not rely
  on prior training. Record what you verified in `docs/research/`.
- Pin exact versions. No floating ranges.
- No runtime dependency without a written justification in the PR description.

---

## 5. Anti-patterns explicitly forbidden

These are the failure modes that have ruined AI-assisted projects before. They are
rejected in review:

- **Shipping a hollow feature** - a button that does nothing, a placeholder that
  never gets filled, a "coming soon" screen. If it is in the UI, it works.
- **Deferring the hard part** - building the pretty shell first and leaving the
  networking, validation, or error handling for "later". Later never comes.
- **Rebuilding after building** - rewriting a module that works because it looks
  cleaner. Prefer refactoring in place, with tests green, in its own commit.
- **Duplicating instead of generalising** - the third copy of a similar block is
  the moment to extract a shared helper.
- **Silent partial completion** - claiming a stage is done while a gate is red,
  or while an edge case is untested.
- **Faked verification** - writing a test that asserts nothing, or an e2e test
  that never fails. A test that cannot fail is worse than no test.
- **Unbounded scope creep** - a phase is not allowed to grow features that were
  not in the plan. New ideas go to `docs/roadmap.md`.
- **A broken gate hidden by a passing test** - if a change makes a gate red,
  the change is wrong, not the gate.

---

## 6. Where things live

```
src/core/     pure game logic (room code, secret, scoring, protocol, state)
src/net/      PeerJS transport (host-session, guest-session, peer-link)
src/ui/       screens, components, mascot, icons, sfx, confetti
src/i18n/     en.js, ar.js, translator
src/styles/   main.css (tokens) + game.css (animations)
tests/unit/   Vitest specs for core + net + ui
tests/e2e/    Playwright specs (real Chromium, real PeerJS cloud)
docs/         architecture, protocol, ADRs, deployment, research notes
```

---

## 7. Definition of a good commit message

```
fix(net): retry guest connection after signaling timeout

The PeerJS cloud dropped ~1 in 6 connections during local e2e runs.
A guest that failed to open its data channel was left in a silent
"connecting" state with no way forward.

Add a 15s connect timeout with exponential backoff (1s -> 15s cap) and
surface a "Reconnecting" banner so the player is never left guessing.

Closes #12
```

Not this:

```
fix stuff
```

---

## 8. Definition of a good PR

- Title follows Conventional Commits.
- Body has **Summary**, **Testing** (exact commands + results), **Screenshots**
  (for UI changes), **Checklist** (gates G1-G9).
- Every gate is checked or explicitly marked _not run_ with a reason.
- One concern per PR.

---

## 9. Definition of done for the whole project

- [ ] All nine gates green on a clean checkout
- [ ] A full game completes across two real browsers on the real PeerJS cloud
- [ ] A 4-player room works (star topology)
- [ ] Host closing the tab shows a clear message, not a frozen screen
- [ ] English and Arabic both fully usable, including RTL mirroring
- [ ] Deploys to GitHub Pages, Netlify, and Vercel from the same `dist/`
- [ ] `docs/` reflects the shipped system, not an aspiration
