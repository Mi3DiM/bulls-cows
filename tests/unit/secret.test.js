import { describe, expect, it } from 'vitest';

import { generateSecret, isCorrectGuess, isValidGuess, scoreGuess } from '../../src/core/secret.js';
import { createSeededRng, seedFromString } from '../../src/core/rng.js';

describe('scoreGuess', () => {
  it('scores a perfect match as all bulls', () => {
    expect(scoreGuess('0247', '0247')).toEqual({ bulls: 4, cows: 0 });
  });

  it('scores zero bulls and zero cows when nothing matches', () => {
    expect(scoreGuess('0247', '1359')).toEqual({ bulls: 0, cows: 0 });
  });

  it('counts a bull only for the right digit in the right place', () => {
    // Only the 4 is in the right place. The 0 and the 2 are present but
    // misplaced; the 9 is absent entirely.
    expect(scoreGuess('0247', '2049')).toEqual({ bulls: 1, cows: 2 });
  });

  it('separates bulls from cows correctly', () => {
    // The 0 and the 7 are in the right place; the 2 and the 4 are present but
    // swapped.
    expect(scoreGuess('0247', '0427')).toEqual({ bulls: 2, cows: 2 });
  });

  it('never counts a digit as both a bull and a cow', () => {
    for (let i = 0; i < 200; i += 1) {
      const rng = createSeededRng(seedFromString(`score-${i}`));
      const secret = generateSecret(rng, { digits: 4, allowRepeats: false });
      const guess = generateSecret(rng, { digits: 4, allowRepeats: false });
      const { bulls, cows } = scoreGuess(secret, guess);
      expect(bulls + cows).toBeLessThanOrEqual(4);
    }
  });

  it('counts a repeated digit with multiplicity', () => {
    // The secret holds two 1s and the guess holds one 1 in the wrong place,
    // so exactly one cow is earned — never two.
    expect(scoreGuess('1123', '2156')).toEqual({ bulls: 1, cows: 1 });
  });

  it('never counts more cows than the secret contains', () => {
    // Three 1s in the guess against two 1s in the secret: two bulls and no
    // cow, because the third 1 has nothing left to match.
    expect(scoreGuess('1123', '1115')).toEqual({ bulls: 2, cows: 0 });
  });

  it('does not count a cow for a digit the secret does not contain', () => {
    expect(scoreGuess('1123', '1456')).toEqual({ bulls: 1, cows: 0 });
    expect(scoreGuess('1123', '4156')).toEqual({ bulls: 1, cows: 0 });
  });

  it('scores a one-digit game', () => {
    expect(scoreGuess('7', '7')).toEqual({ bulls: 1, cows: 0 });
    expect(scoreGuess('7', '3')).toEqual({ bulls: 0, cows: 0 });
  });

  it('rejects mismatched lengths', () => {
    expect(() => scoreGuess('0247', '024')).toThrow(RangeError);
  });

  it('rejects non-string input', () => {
    // The runtime guard is deliberate: a score must never be computed from a
    // value that is not a string.
    const notAString = /** @type {any} */ (247);
    const notAStringEither = /** @type {any} */ (null);
    expect(() => scoreGuess('0247', notAString)).toThrow(TypeError);
    expect(() => scoreGuess(notAStringEither, '0247')).toThrow(TypeError);
  });
});

describe('generateSecret', () => {
  it('produces a secret of the requested length', () => {
    const rng = createSeededRng(1);
    for (const digits of [3, 4, 5]) {
      expect(generateSecret(rng, { digits, allowRepeats: false })).toHaveLength(digits);
    }
  });

  it('uses only decimal digits', () => {
    const rng = createSeededRng(2);
    for (let i = 0; i < 200; i += 1) {
      expect(generateSecret(rng, { digits: 4, allowRepeats: false })).toMatch(/^\d{4}$/);
    }
  });

  it('never repeats a digit when repeats are not allowed', () => {
    const rng = createSeededRng(3);
    for (let i = 0; i < 500; i += 1) {
      const secret = generateSecret(rng, { digits: 4, allowRepeats: false });
      expect(new Set(secret).size).toBe(4);
    }
  });

  it('can repeat a digit when repeats are allowed', () => {
    const rng = createSeededRng(seedFromString('repeats'));
    let sawRepeat = false;
    for (let i = 0; i < 500; i += 1) {
      const secret = generateSecret(rng, { digits: 4, allowRepeats: true });
      if (new Set(secret).size < 4) {
        sawRepeat = true;
        break;
      }
    }
    expect(sawRepeat).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const a = generateSecret(createSeededRng(99), { digits: 4, allowRepeats: false });
    const b = generateSecret(createSeededRng(99), { digits: 4, allowRepeats: false });
    expect(a).toBe(b);
  });

  it('rejects an impossible digit count', () => {
    const rng = createSeededRng(1);
    expect(() => generateSecret(rng, { digits: 0, allowRepeats: false })).toThrow(RangeError);
    expect(() => generateSecret(rng, { digits: 11, allowRepeats: false })).toThrow(RangeError);
    expect(() => generateSecret(rng, { digits: 2.5, allowRepeats: false })).toThrow(RangeError);
  });
});

describe('isValidGuess', () => {
  const strict = { digits: 4, attempts: 8, allowRepeats: false };
  const loose = { digits: 4, attempts: 8, allowRepeats: true };

  it('accepts a well-formed guess', () => {
    expect(isValidGuess('0247', strict)).toBe(true);
  });

  it('rejects a guess of the wrong length', () => {
    expect(isValidGuess('024', strict)).toBe(false);
    expect(isValidGuess('02477', strict)).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidGuess('02A7', strict)).toBe(false);
    expect(isValidGuess('02 7', strict)).toBe(false);
    expect(isValidGuess('', strict)).toBe(false);
  });

  it('rejects repeated digits when repeats are not allowed', () => {
    expect(isValidGuess('0024', strict)).toBe(false);
  });

  it('accepts repeated digits when repeats are allowed', () => {
    expect(isValidGuess('0024', loose)).toBe(true);
  });

  it('rejects non-string input', () => {
    expect(isValidGuess(247, strict)).toBe(false);
    expect(isValidGuess(null, strict)).toBe(false);
  });
});

describe('isCorrectGuess', () => {
  it('is true only for an exact match', () => {
    expect(isCorrectGuess('0247', '0247')).toBe(true);
    expect(isCorrectGuess('0247', '0248')).toBe(false);
    expect(isCorrectGuess('0247', '047')).toBe(false);
  });
});
