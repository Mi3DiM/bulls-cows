# ADR 0005 — Bilingual English/Arabic with full RTL mirroring

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The brief is written in Arabic, but the reference design and every specified
string ("Your Game", "Copy Link", "Share", "Bulls & Cows") are English. The
product should be usable by both audiences without either feeling second-class.

Arabic is not a translation problem, it is a **layout** problem: the script
reads right-to-left, and a UI that merely swaps text strings while keeping a
left-to-right box model feels broken.

## Decision

Ship **English and Arabic** with a first-class language toggle, and make the
layout genuinely direction-aware.

### Direction

- The `<html>` element carries `dir="ltr" | "rtl"` and `lang="en" | "ar"`.
- The choice is applied to `<html>` and every layout rule uses **logical
  properties** — `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start` —
  so the whole layout mirrors with no per-direction CSS.
- `dir` is persisted in `localStorage` and survives reload.

### Fonts

Google Fonts' CSS2 API emits per-subset `@font-face` rules with `unicode-range`,
so the browser routes each glyph to the right family automatically:

| Role     | Latin                                          | Arabic                                         |
| -------- | ---------------------------------------------- | ---------------------------------------------- |
| Display  | **Baloo 2** (400–800) — chunky rounded, arcade | **Cairo** (400–900) — rounded geometric Arabic |
| Body     | **Nunito** (400–900)                           | **Cairo** (400–700)                            |
| Numerals | **JetBrains Mono** (400–700), tabular figures  | (Latin digits — same family)                   |

Measured subset coverage: Baloo 2 → `latin, latin-ext, vietnamese, devanagari`
(**no Arabic**); Cairo → `arabic, latin, latin-ext`; Noto Kufi Arabic →
`arabic, latin, latin-ext` (kept as a fallback).

### Strings

A tiny hand-rolled i18n layer: one flat key → string map per locale, a `t()`
function with `{name}` placeholder interpolation, and a `dir`/`lang` setter.
No i18n library — the surface is small and a dependency would not earn its keep.

## Consequences

- Every user-supplied string must come from the locale tables. A literal in the
  markup is a review defect.
- The e2e suite includes an RTL pass that asserts `dir="rtl"`, checks that the
  layout actually mirrors, and asserts no horizontal overflow.
- Numbers stay Latin digits in both locales — the digit vault and the bulls/cows
  badges are numeric readouts, and Arabic-Indic digits would be ambiguous
  against the keypad.

## Alternatives rejected

| Alternative                    | Why rejected                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| English only                   | Leaves the brief's primary audience without the product.                                                   |
| Arabic only                    | The reference design and the specified copy are English.                                                   |
| English only, RTL-ready        | The user explicitly asked for both, with full RTL.                                                         |
| A full i18n library            | ~30 keys per locale; a library is overhead without benefit.                                                |
| Auto-detect the browser locale | Correct as a _default_, but a visible toggle must win. We use the browser locale for the first visit only. |
