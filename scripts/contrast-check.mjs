#!/usr/bin/env node
/**
 * G8 — Contrast gate.
 *
 * Parses the design tokens out of `src/styles/main.css` and checks every
 * foreground/background pair the app actually uses against WCAG 2.1.
 *
 * The CSS is the single source of truth: no palette is duplicated here, so a
 * token change is caught by this gate rather than drifting from it.
 *
 * Exit code 0 = all pairs pass. Exit code 1 = at least one failure.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_FILE = resolve(ROOT, 'src/styles/main.css');

/**
 * The pairs the app renders.
 *
 * `min` is the WCAG ratio required: 4.5 for body text, 3 for large text
 * (>= 24px, or >= 18.66px bold) and for UI component boundaries.
 */
const PAIRS = [
  { fg: 'text', bg: 'abyss', min: 4.5, use: 'body text on the app background' },
  { fg: 'text', bg: 'void', min: 4.5, use: 'body text on the deepest surface' },
  { fg: 'text', bg: 'panel', min: 4.5, use: 'body text on a glass panel' },
  { fg: 'text', bg: 'elevated', min: 4.5, use: 'body text on a raised panel' },
  { fg: 'muted', bg: 'abyss', min: 4.5, use: 'secondary text on the app background' },
  { fg: 'muted', bg: 'panel', min: 4.5, use: 'secondary text on a glass panel' },
  { fg: 'muted', bg: 'elevated', min: 4.5, use: 'secondary text on a raised panel' },
  { fg: 'faint', bg: 'panel', min: 3, use: 'disabled / tertiary labels on a panel' },
  { fg: 'mint', bg: 'abyss', min: 4.5, use: 'success text on the app background' },
  { fg: 'mint', bg: 'panel', min: 4.5, use: 'success text on a glass panel' },
  { fg: 'mint', bg: 'violet-deep', min: 3, use: 'success text on the violet button' },
  { fg: 'gold', bg: 'abyss', min: 4.5, use: 'points and star rating on the app background' },
  { fg: 'gold', bg: 'panel', min: 4.5, use: 'points and star rating on a glass panel' },
  { fg: 'gold-deep', bg: 'panel', min: 4.5, use: 'deep gold text on a glass panel' },
  { fg: 'gold-deep', bg: 'abyss', min: 4.5, use: 'deep gold text on the app background' },
  { fg: 'violet', bg: 'abyss', min: 3, use: 'violet accent on the app background' },
  { fg: 'cyan', bg: 'abyss', min: 4.5, use: 'cyan accent on the app background' },
  { fg: 'cyan', bg: 'panel', min: 4.5, use: 'cyan accent on a glass panel' },
  { fg: 'rose', bg: 'abyss', min: 4.5, use: 'danger text on the app background' },
  { fg: 'rose', bg: 'panel', min: 4.5, use: 'danger text on a glass panel' },
  { fg: 'void', bg: 'mint', min: 4.5, use: 'dark label on the green button' },
  { fg: 'void', bg: 'gold', min: 4.5, use: 'dark label on the gold button' },
  { fg: 'text', bg: 'violet-deep', min: 4.5, use: 'text on the violet button' },
  { fg: 'magenta', bg: 'panel', min: 3, use: 'magenta accent on a glass panel' },
];

/** Parses `#rrggbb` tokens out of the `--color-*` declarations. */
function readPalette(css) {
  /** @type {Record<string, string>} */
  const palette = {};
  const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    palette[match[1]] = match[2];
  }
  return palette;
}

/** WCAG 2.1 relative luminance. */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1 contrast ratio. */
function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const light = a > b ? a : b;
  const dark = a > b ? b : a;
  return (light + 0.05) / (dark + 0.05);
}

const css = readFileSync(CSS_FILE, 'utf8');
const palette = readPalette(css);

if (Object.keys(palette).length === 0) {
  console.error('✖ No --color-* tokens found in src/styles/main.css');
  process.exit(1);
}

let failures = 0;
const rows = [];

for (const pair of PAIRS) {
  const fg = palette[pair.fg];
  const bg = palette[pair.bg];

  if (!fg || !bg) {
    console.error(`✖ Missing token: --color-${!fg ? pair.fg : pair.bg}`);
    failures += 1;
    continue;
  }

  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= pair.min;
  if (!pass) failures += 1;

  rows.push({
    pair: `--color-${pair.fg} on --color-${pair.bg}`,
    use: pair.use,
    fg,
    bg,
    ratio: ratio.toFixed(2),
    min: pair.min.toFixed(1),
    result: pass ? 'PASS' : 'FAIL',
  });
}

const width = Math.max(...rows.map((r) => r.pair.length));
for (const row of rows) {
  const line = `${row.result.padEnd(4)} ${row.pair.padEnd(width)}  ${row.ratio}:1 (min ${row.min})  ${row.use}`;
  console.log(row.result === 'PASS' ? line : `✖ ${line}`);
}

console.log('');
if (failures > 0) {
  console.error(`✖ Contrast gate failed: ${failures} of ${rows.length} pairs below target.`);
  process.exit(1);
}
console.log(`✔ Contrast gate passed: ${rows.length} of ${rows.length} pairs.`);
