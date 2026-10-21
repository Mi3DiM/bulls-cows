# Design system

The game looks the way it does on purpose. This document records the
decisions, so the next change is made in the same spirit rather than at
random.

---

## 1. The direction

**A dark neon arcade cabinet, not a website.**

The reference the design came from is a game: deep indigo, glowing borders,
saturated buttons, chunky rounded type, and a mascot that reacts. The
interface is built as an instrument panel, not as a document.

Three rules follow from that, and they decide most questions:

1. **Everything glows.** A surface is a translucent panel with a lit border,
   not a solid rectangle. Light is the material.
2. **One thing is bright at a time.** Mint for the live turn, gold for
   points, rose for danger, violet for structure. If everything glows,
   nothing does.
3. **The type is chunky.** A rounded display face with real weight, so the
   screen reads at a glance from across a table.

---

## 2. Colour

All tokens live in `src/styles/main.css` under `@theme`. **No component
contains a raw hex value** — a token is referenced by name, so the palette
can be changed in one place and the contrast gate follows it.

| Token                 | Hex       | Role                                                 |
| --------------------- | --------- | ---------------------------------------------------- |
| `--color-void`        | `#05011a` | The deepest background.                              |
| `--color-abyss`       | `#0c0533` | The app background.                                  |
| `--color-panel`       | `#150a44` | The glass panel base.                                |
| `--color-panel-soft`  | `#1d0f57` | Raised surfaces, inputs, keys.                       |
| `--color-elevated`    | `#241273` | The brightest surface.                               |
| `--color-violet`      | `#7c3aed` | The brand colour: primary buttons, borders.          |
| `--color-violet-deep` | `#4c1d95` | Inset surfaces, the room-code chip.                  |
| `--color-magenta`     | `#e935c1` | Accent: the mascot's muzzle, highlights.             |
| `--color-cyan`        | `#22d3ee` | Secondary accent: "you", informational text.         |
| `--color-mint`        | `#2bf59b` | **Success and the live turn.** The one bright thing. |
| `--color-mint-deep`   | `#059669` | Mint surfaces.                                       |
| `--color-gold`        | `#fbbf24` | **Points, stars, the trophy.**                       |
| `--color-gold-deep`   | `#d97706` | Gold text on dark surfaces.                          |
| `--color-rose`        | `#fb4e6e` | **Danger: leaving, disconnection, failure.**         |
| `--color-rose-deep`   | `#9f1239` | Rose surfaces.                                       |
| `--color-text`        | `#f4f1ff` | Primary text.                                        |
| `--color-muted`       | `#a79fe0` | Secondary text.                                      |
| `--color-faint`       | `#756bb0` | Tertiary text, hints.                                |

### Contrast is a gate, not a hope

`npm run check:contrast` parses the tokens straight out of the CSS and
checks every pair the interface actually renders against WCAG AA. It has
already caught one real defect — an unreadable gold-on-gold pairing — and
the token was corrected rather than the rule relaxed.

Add a pair to the list in `scripts/contrast-check.mjs` when you introduce a
new combination.

---

## 3. Typography

| Role     | Latin              | Arabic         | Used for                          |
| -------- | ------------------ | -------------- | --------------------------------- |
| Display  | **Baloo 2**        | **Cairo**      | Headings, the room code, buttons. |
| Body     | **Nunito**         | **Cairo**      | Prose, labels, chat.              |
| Numerals | **JetBrains Mono** | (Latin digits) | The digit tiles, points, timers.  |

Google Fonts emits per-subset `@font-face` rules with `unicode-range`, so
the browser routes Latin glyphs to Baloo and Arabic glyphs to Cairo from a
single font stack. No separate stylesheet per language.

The numerals are deliberately monospaced: the digit tiles and the points
column are read as _data_, and tabular figures make a column line up.

### Scale

The display face is used large and sparingly — 48 px for the room code, 30 px
for the player names, 18 px for a section heading. Body text is 14–16 px.
Nothing sits between 10 px and 12 px except badges, which are labels
rather than reading matter.

---

## 4. Shape and depth

| Token            | Value     | Where             |
| ---------------- | --------- | ----------------- |
| `--radius-tile`  | `1.25rem` | The digit tiles.  |
| `--radius-panel` | `1.75rem` | Every panel.      |
| `--radius-pill`  | `999px`   | Badges and chips. |

Panels use the `glass` component class: a translucent background, a
one-pixel lit border, a backdrop blur, and a soft violet shadow beneath.
There are no hard drop shadows and no skeuomorphic textures.

---

## 5. Motion

Motion is used to say something, never to decorate.

| Motion                           | Meaning                             |
| -------------------------------- | ----------------------------------- |
| The active digit tile breathes   | This is where your next digit goes. |
| A digit commits with a small pop | The keypress landed.                |
| The room code pops in            | A new room was just created.        |
| An attempt card stamps in        | That guess was scored.              |
| The mascot floats                | The game is waiting.                |
| The trophy glows                 | Somebody won.                       |

**Every animation is disabled under `prefers-reduced-motion`.** A looping
animation that keeps moving is exactly what that setting asks us to stop, so
the rules remove them rather than shorten them.

---

## 6. Components

| Component           | File                                   | Notes                                                                                      |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| The mascot          | `src/ui/mascot.js`                     | Original SVG cow with `idle`, `thinking`, `celebrate` and `sad` expressions.               |
| Icons               | `src/ui/icons.js`                      | Inline SVG. Never emoji — emoji render differently on every platform and cannot be styled. |
| Avatars             | `src/ui/avatar.js`                     | Eight generated geometric marks, so a player on slow data gets them instantly.             |
| The digit vault     | `src/ui/components/guess-panel.js`     | Four glowing tiles that fill as you type.                                                  |
| The attempts board  | `src/ui/components/attempts.js`        | One column per player, scrollable sideways on a phone.                                     |
| The leaderboard     | `src/ui/components/leaderboard.js`     | Live ranking with points.                                                                  |
| Chat                | `src/ui/components/chat.js`            | `textContent` only, so a message can never become markup.                                  |
| The language toggle | `src/ui/components/language-toggle.js` | Switches locale and re-renders the screen.                                                 |

### The mascot

Drawn for this project rather than copied. It reacts to the game: thinking
while it is somebody else's turn, celebrating when the secret is cracked.

### The attempts board

**One column per player**, each holding that player's attempts. On a phone
the columns scroll sideways; on a wide screen they sit side by side. Each
attempt card shows the guess as digit tiles plus a bull and a cow badge.

A horizontally scrollable region is focusable and labelled, so a keyboard
user can reach the columns a mouse user would scroll to — axe-core checks
this.

---

## 7. Layout

### Mobile first

The phone is the primary device. The guess pad sits at the top, under the
thumbs, and everything else is behind a bottom tab bar.

```
┌──────────────────────────────┐
│ ROOM CODE  K7P4  ⧉ ↗ ⤶    │ ← always visible, on every screen
├──────────────────────────────┤
│  Your turn to guess!          │ ← the turn banner
│        (0 )( 2 )( 4 )( 7 )   │ ← the digit vault
│   [1][2][3]  [4][5][6]        │
│   [7][8][9]  [⌫][0][GUESS]    │
├──────────────────────────────┤
│  Players  │  History  │  Chat │ ← the tab bar
└──────────────────────────────┘
```

### Desktop

From `lg` up, the tab bar disappears and all three columns are visible at
once — players and chat on the left, the game in the middle, the attempts
board and leaderboard on the right.

### Right to left

Every layout rule uses **logical properties** — `ms-`, `me-`, `ps-`, `pe-`,
`start-`, `end-`, `text-start`. The whole layout mirrors when the locale is
Arabic, with no direction-specific CSS anywhere.

---

## 8. Rules of thumb

1. **No raw colours in components.** Use a token.
2. **One bright thing at a time.** Mint means "your turn, right now".
3. **Every interactive target is at least 44 × 44 px.**
4. **Every icon-only button has an `aria-label`.**
5. **User text goes in through `textContent`.** Never `innerHTML`.
6. **Focus is always visible.**
7. **Text meets 4.5:1.** The contrast gate enforces it.
8. **If it moves, it means something.**
