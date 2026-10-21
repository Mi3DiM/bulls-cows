# Contributing

Thanks for wanting to help. This project is small and the rules are short.

Read [`AGENTS.md`](AGENTS.md) first — it is the contract, and it applies to
every contributor and every automated agent working on the repository.

---

## The short version

1. **Plan before you write.** A one-paragraph plan in the issue is enough.
2. **One logical change per commit.** A refactor and a feature are two
   commits.
3. **Never break a gate.** A stage is not done until every applicable gate
   is green.
4. **Every bug fix starts with a failing test** that reproduces the bug.
5. **Update the documentation** in the same commit as the change.

---

## Getting set up

```bash
git clone https://github.com/your-user/bulls-cows.git
cd bulls-cows
npm install
npm run dev
```

You need Node 22.12 or newer. The version in `.nvmrc` is what CI uses.

---

## Before you open a pull request

```bash
npm run verify         # lint, format, typecheck, unit, build, contrast
npm run test:e2e       # end-to-end, real browsers
```

Both must be green. The end-to-end suite needs network access, because it
runs against the **live public PeerJS server** — a mocked transport would
not catch the failures that actually happen.

---

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(net): retry the guest connection after a signaling timeout

The PeerJS cloud dropped roughly one connection in six during local
end-to-end runs, and a guest that failed to open its data channel was
left in a silent "connecting" state with no way forward.

Add a 15s connect timeout with exponential backoff and a visible
"Reconnecting" banner.
```

`feat:` `fix:` `docs:` `test:` `refactor:` `perf:` `chore:` `build:` `ci:`

The subject is at most 72 characters, imperative, and has no trailing full
stop.

---

## Branches

- `main` — protected. The branch that is deployed.
- `develop` — integration. Feature branches are based on it.
- `feat/<slug>` `fix/<slug>` `docs/<slug>` `chore/<slug>`

```bash
git checkout develop
git checkout -b feat/my-change
```

---

## What belongs in this project

| Yes                          | No                               |
| ---------------------------- | -------------------------------- |
| A static site                | A server, a function, a database |
| WebRTC data channels         | A message broker                 |
| Pure logic in `src/core/`    | DOM access in `src/core/`        |
| Design tokens                | Raw colours in components        |
| Tests that fail before a fix | Tests that assert nothing        |

The product constraints are not negotiable. If a feature needs a backend, it
does not belong in this game — it belongs in a different one.

---

## Style

- **ES modules**, no framework.
- **The DOM API** for the interface — never a template string with HTML in
  it. `textContent` for anything a user typed.
- **JSDoc types** on the public functions. `tsc --noEmit` checks them.
- **Comments explain why**, not what. The code already says what.
- **No comments left in the code.** A comment that restates the line below
  it is noise.

---

## Review

A pull request needs:

- a **Summary** — what changed and why
- **Testing** — the exact commands you ran, and the results
- **Screenshots** — for anything visual
- a **Checklist** — gates G1 to G9, each checked or explicitly marked
  _not run_ with a reason

One concern per pull request. A large pull request is a large review, and
large reviews do not get done carefully.

---

## Reporting a bug

A good report has:

1. What you did
2. What you expected
3. What happened
4. The browser and its version
5. A trace or screenshot, if there is one

If it is a network problem, mention whether you were on Wi-Fi or mobile
data — the two behave very differently in a peer-to-peer game.
