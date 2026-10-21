# Accessibility

The game is played on phones, in a hurry, often in bright light and often
with one hand. Accessibility here is not a compliance exercise — it is the
difference between a game everyone can play and a game some people cannot.

Every claim below is **checked by a gate**, not asserted.

---

## 1. What is guaranteed

| Guarantee                              | How it is enforced                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Text contrast ≥ 4.5:1                  | `npm run check:contrast` parses the design tokens and checks every pair the interface renders. It runs in CI.        |
| No serious or critical axe violations  | `tests/e2e/a11y.spec.js` runs axe-core against the home, join, waiting-room, game and result screens. It runs in CI. |
| Every interactive target ≥ 44 × 44 px  | `tests/e2e/responsive.spec.js` measures every keypad key on a phone viewport.                                        |
| Every icon-only button has a name      | Each one carries an `aria-label`; the axe run checks it.                                                             |
| Focus is always visible                | `:focus-visible` draws a 3 px cyan ring. The ring is never removed.                                                  |
| The keyboard can reach everything      | The DOM is built in order, and every control is a real `<button>`, `<input>` or `<a>`.                               |
| Scrollable regions are reachable       | The attempts board is focusable and labelled, so a keyboard user can scroll it.                                      |
| Motion can be turned off               | `prefers-reduced-motion` removes every animation and transition, rather than shortening them.                        |
| The direction change is announced      | The `<html>` element carries both `lang` and `dir`.                                                                  |
| Status messages are announced          | The banner and the toast are `role="status"` with `aria-live="polite"`.                                              |
| The game never depends on colour alone | The turn is shown as a word and a badge, not just a glow. Bulls and cows are labelled.                               |

---

## 2. Colour is never the only signal

A player who cannot distinguish mint from violet still plays. The live
turn is a **word** ("Your turn to guess!") and a badge, not just a green
glow. A bulls/cows badge carries the letter as well as the number. A
disconnected player is labelled "Reconnecting…", not merely dimmed.

---

## 3. The screen reader experience

The screens are ordinary landmarks and headings:

- The room code bar is a `<header>` with `role="banner"`.
- Each screen carries a `data-screen` attribute, and the visible content
  starts with a single `<h1>` or `<h2>`.
- The turn banner is a live region, so a screen reader announces whose turn
  it is when it changes.
- The chat log is `role="log"` with `aria-live="polite"`.
- The digit vault is a labelled `group`, and the tiles are read as a group
  rather than as four unrelated numbers.

The mascot and the decorative shapes are `aria-hidden`. They carry no
information that is not also in text.

---

## 4. The keyboard path

A complete turn is possible with the keyboard alone:

1. <kbd>Tab</kbd> to the digit keys
2. <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> to type
3. <kbd>Backspace</kbd> to correct — the key is labelled "Clear"
4. <kbd>Tab</kbd> to **Guess** and <kbd>Enter</kbd> to submit

The keypad keys are `<button>` elements in DOM order, so the order is
1-9, clear, 0, guess — the order a number pad works in.

---

## 5. Reduced motion

`prefers-reduced-motion: reduce` is honoured in two ways:

- Every animation and transition is removed.
- The looping ones — the breathing digit tile, the floating mascot, the
  glowing trophy, the shimmer — are switched off explicitly, because
  shortening them still leaves them moving.

The confetti is not drawn at all under the setting. The celebration still
happens: the mascot changes expression and the win card appears.

---

## 6. Text size and zoom

The layout is fluid, in `rem` units, and in logical properties. The
interface works at 200 % browser zoom and with a large system font size;
nothing is clipped and nothing overlaps.

The page sets `viewport-fit=cover` and uses safe-area padding, so it fits
a notched phone without the home indicator covering the tab bar.

---

## 7. Language and direction

Switching to Arabic sets `lang="ar"` and `dir="rtl"`. Screen readers
follow `lang`, and the logical properties mirror the layout.

The digit tiles stay in **Latin numerals** in both languages, because they
are numeric readouts that must match the keypad exactly, and the keypad
uses Latin numerals in both.

---

## 8. Running the checks

```bash
npm run check:contrast   # the token contrast gate
npm run test:e2e         # includes the axe specs
```

To run just the accessibility specs:

```bash
npx playwright test tests/e2e/a11y.spec.js
```

---

## 9. Known limitations

Honest list, so nobody is surprised:

- The confetti is decorative and has no text alternative. It conveys
  nothing that the win card does not.
- The mascot's expression is decorative. The same information is in the
  turn banner and the result card.
- The sound effects have no captions. They are decorative — the same
  information is on screen.
