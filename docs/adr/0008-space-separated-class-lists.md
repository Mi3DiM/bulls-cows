# ADR 0008 — Class names must be space-separated in the source

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The interface is built with a small DOM helper so that user-supplied text
can only ever reach the page through `textContent`:

```js
el('div', { class: 'flex items-center gap-2' }, [...]);
```

The helper originally accepted a dot-separated shorthand:

```js
el('div.flex.items-center.gap-2', { ... }, [...]);
```

It looked tidier. It was also silently destroying the layout.

Tailwind v4 extracts class candidates from the **source text**. A run like
`div.flex.items-center` is a single token to the scanner, not three, so
none of those utilities were ever generated. The interface still rendered —
the custom component classes (`.glass`, `.neon-ring`) were in separate
files and worked fine — but roughly half the layout was missing: no
max-width, no gaps, no large type, no arbitrary tracking values.

Nothing failed. The build was green, the tests were green, the contrast
gate was green. The page was simply not the page it was written to be.

The stylesheet contained **145** utilities instead of **233**.

## Decision

**Class lists are separated by spaces in the source, never by dots.**

```js
el('div flex items-center gap-2', { ... }, [...]);
```

The helper splits on whitespace. Tailwind sees each class as its own
token. The two agree.

The `class` property takes the same space-separated form:

```js
elInput({ class: 'w-full rounded-xl border border-violet/25 px-3 py-2.5' });
```

### The trap inside the trap

A dot is not always a separator. Tailwind's fractional scale puts one
inside the class name:

```
py-2.5   gap-1.5   mt-0.5   text-1.5xl   tracking-[0.35em]
```

Splitting on every dot turns `py-2.5` into `py-2` and `5`, which is
worse than the original problem. The rule that distinguishes them:

> A dot **between two digits** belongs to the class name. Any other dot
> separates two classes.

The codemod that performed the rewrite used that rule, and it reported any
fragment it could not account for rather than writing it out.

## Consequences

- The stylesheet now contains every utility the source mentions.
- The `el()` helper rejects an unknown element name. A class list passed as
  a tag name produces an unknown element that no CSS applies to — a
  failure that is silent by nature. Now it throws.
- A new rule belongs in `AGENTS.md`: **classes are space-separated, always.**
- Anyone writing a class list by hand must keep it space-separated. The
  mistake is invisible in review, so it is called out explicitly.

## Alternatives rejected

| Alternative                               | Why rejected                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A build step that expands the shorthand   | A second source of truth for the class list, and a build step to get wrong.                                           |
| A Tailwind `@source inline(...)` safelist | The list would have to be generated and kept in sync — the same problem, with more machinery.                         |
| Writing every class in a `class` property | Correct, but it made the call sites noisy, and the shorthand is genuinely more readable once it uses spaces.          |
| Switching to a CSS-in-JS library          | A runtime dependency, a build step, and a large amount of new machinery for a problem that a separator choice solves. |

## Related

- [`AGENTS.md`](../../AGENTS.md) §4.5
- The lint rule `no-restricted-properties` already blocks `innerHTML`; the
  unknown-tag guard in `src/ui/dom.js` closes the sibling hole.
