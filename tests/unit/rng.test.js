import { describe, expect, it } from 'vitest';

import {
  createRandomRng,
  createSeededRng,
  pick,
  randomInt,
  seedFromString,
  shuffle,
} from '../../src/core/rng.js';

describe('createSeededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(first).toEqual(second);
  });

  it('produces a different sequence for a different seed', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a()).not.toBe(b());
  });

  it('always produces values in [0, 1)', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const rng = createSeededRng(seedFromString('uniformity'));
    const buckets = new Array(10).fill(0);
    const samples = 100_000;
    for (let i = 0; i < samples; i += 1) {
      const index = Math.floor(rng() * 10);
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    for (const count of buckets) {
      // Each bucket should hold about 10 % of the samples.
      expect(count / samples).toBeGreaterThan(0.085);
      expect(count / samples).toBeLessThan(0.115);
    }
  });
});

describe('seedFromString', () => {
  it('is deterministic', () => {
    expect(seedFromString('bulls-and-cows')).toBe(seedFromString('bulls-and-cows'));
  });

  it('gives different seeds for different strings', () => {
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const seed = seedFromString('anything');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('createRandomRng', () => {
  it('returns a function producing values in [0, 1)', () => {
    const rng = createRandomRng();
    const value = rng();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});

describe('randomInt', () => {
  it('stays within the inclusive range', () => {
    const rng = createSeededRng(3);
    for (let i = 0; i < 1000; i += 1) {
      const value = randomInt(rng, 3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it('can return both endpoints', () => {
    const rng = createSeededRng(11);
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) seen.add(randomInt(rng, 0, 1));
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
  });

  it('returns the only value when the range is a single number', () => {
    const rng = createSeededRng(5);
    expect(randomInt(rng, 4, 4)).toBe(4);
  });

  it('rejects an inverted range', () => {
    const rng = createSeededRng(5);
    expect(() => randomInt(rng, 9, 2)).toThrow(RangeError);
  });
});

describe('pick', () => {
  it('picks an element of the list', () => {
    const rng = createSeededRng(13);
    const items = ['a', 'b', 'c'];
    expect(items).toContain(pick(rng, items));
  });

  it('rejects an empty list', () => {
    const rng = createSeededRng(13);
    expect(() => pick(rng, [])).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('keeps every element', () => {
    const rng = createSeededRng(17);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle(rng, items);
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('does not modify the input', () => {
    const rng = createSeededRng(17);
    const items = [1, 2, 3, 4, 5];
    shuffle(rng, items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('actually reorders the list', () => {
    const rng = createSeededRng(19);
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(rng, items);
    expect(shuffled).not.toEqual(items);
  });
});
