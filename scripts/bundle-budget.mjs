#!/usr/bin/env node
/**
 * G5 (part) — Bundle budget.
 *
 * The game is loaded on mobile data, often on a phone that is also running a
 * video call. A slow-loading game is a broken game, so the shipped payload
 * has a hard ceiling that fails the build rather than a report.
 *
 * Run after `npm run build`.
 */
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

/** Budgets in kilobytes, measured as the *compressed* transfer size. */
const BUDGETS = {
  '.js': 180,
  '.css': 60,
  '.html': 20,
  default: 40,
};

/** Never fail the build on these — they are not part of the first-paint payload. */
const IGNORED = new Set(['.map', '.woff2', '.woff', '.png', '.jpg', '.webp', '.ico']);

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
if (files.length === 0) {
  console.error('✖ dist/ is empty. Run `npm run build` first.');
  process.exit(1);
}

/** @type {Map<string, number>} */
const byExt = new Map();
let total = 0;

for (const file of files) {
  const ext = extname(file).toLowerCase();
  if (IGNORED.has(ext)) continue;
  const bytes = statSync(file).size;
  byExt.set(ext, (byExt.get(ext) ?? 0) + bytes);
  total += bytes;
}

const KB = 1024;
let failures = 0;

console.log('Bundle budget (uncompressed):');
for (const [ext, bytes] of [...byExt.entries()].sort()) {
  const budget = BUDGETS[ext] ?? BUDGETS.default;
  const kb = bytes / KB;
  const pass = kb <= budget;
  if (!pass) failures += 1;
  const rel =
    ext === '.js' ? 'JavaScript' : ext === '.css' ? 'CSS' : ext === '.html' ? 'HTML' : ext;
  console.log(
    `  ${pass ? '✔' : '✖'} ${rel.padEnd(12)} ${kb.toFixed(1).padStart(8)} KB / ${String(budget).padStart(4)} KB`,
  );
}

const totalKb = total / KB;
const totalBudget = Object.values(BUDGETS).reduce((a, b) => a + b, 0);
if (totalKb > totalBudget) {
  console.error(`✖ Total payload ${totalKb.toFixed(1)} KB exceeds the ${totalBudget} KB budget.`);
  failures += 1;
} else {
  console.log(`  ✔ total        ${totalKb.toFixed(1).padStart(8)} KB / ${totalBudget} KB`);
}

if (failures > 0) {
  console.error('\n✖ Bundle budget exceeded.');
  process.exit(1);
}
console.log('\n✔ Bundle budget met.');
