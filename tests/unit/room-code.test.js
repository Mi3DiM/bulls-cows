import { describe, expect, it } from 'vitest';

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../src/config.js';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  parseRoomCode,
  roomCodeSpace,
} from '../../src/core/room-code.js';
import { createSeededRng, seedFromString } from '../../src/core/rng.js';

describe('normalizeRoomCode', () => {
  it('uppercases the input', () => {
    expect(normalizeRoomCode('k7p4')).toBe('K7P4');
    expect(normalizeRoomCode('K7p4')).toBe('K7P4');
  });

  it('removes separators that players commonly paste in', () => {
    expect(normalizeRoomCode('K7 P4')).toBe('K7P4');
    expect(normalizeRoomCode('K7-P4')).toBe('K7P4');
    expect(normalizeRoomCode('  K7P4  ')).toBe('K7P4');
    expect(normalizeRoomCode('K7.P4')).toBe('K7P4');
  });

  it('drops characters that are not in the alphabet', () => {
    expect(normalizeRoomCode('K7P4!')).toBe('K7P4');
    expect(normalizeRoomCode('K7P4O')).toBe('K7P4');
  });

  it('returns an empty string for non-string input', () => {
    expect(normalizeRoomCode(null)).toBe('');
    expect(normalizeRoomCode(undefined)).toBe('');
    expect(normalizeRoomCode(42)).toBe('');
    expect(normalizeRoomCode({})).toBe('');
  });
});

describe('isValidRoomCode', () => {
  it('accepts a code made only of alphabet characters at the right length', () => {
    expect(isValidRoomCode('K7P4')).toBe(true);
    expect(isValidRoomCode('ACDE')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidRoomCode('K7P')).toBe(false);
    expect(isValidRoomCode('K7P45')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('rejects characters outside the alphabet', () => {
    expect(isValidRoomCode('K7PO')).toBe(false);
    expect(isValidRoomCode('K7P0')).toBe(false);
    expect(isValidRoomCode('K7PI')).toBe(false);
    expect(isValidRoomCode('K7PL')).toBe(false);
  });

  it('rejects lowercase input, because codes are always uppercase', () => {
    expect(isValidRoomCode('k7p4')).toBe(false);
  });

  it('honours a custom length', () => {
    expect(isValidRoomCode('K7P4', 4)).toBe(true);
    expect(isValidRoomCode('K7P4', 5)).toBe(false);
  });
});

describe('parseRoomCode', () => {
  it('parses a code the player typed in lower case', () => {
    expect(parseRoomCode('k7p4')).toBe('K7P4');
  });

  it('parses a code with separators', () => {
    expect(parseRoomCode('K7-P4')).toBe('K7P4');
    expect(parseRoomCode(' k7 p4 ')).toBe('K7P4');
  });

  it('rejects a code that is too short or too long', () => {
    expect(parseRoomCode('K7P')).toBeNull();
    expect(parseRoomCode('K7P45')).toBeNull();
  });

  it('rejects a code containing a character outside the alphabet', () => {
    // A typo is reported rather than silently dropped, so the player is told
    // the code is wrong instead of being sent to a room that does not exist.
    expect(parseRoomCode('K7PO')).toBeNull();
    expect(parseRoomCode('K7P0')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseRoomCode(null)).toBeNull();
    expect(parseRoomCode(undefined)).toBeNull();
  });
});

describe('generateRoomCode', () => {
  it('always produces a valid code', () => {
    const rng = createSeededRng(seedFromString('room-code'));
    for (let i = 0; i < 500; i += 1) {
      const code = generateRoomCode(rng);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateRoomCode(createSeededRng(1234));
    const b = generateRoomCode(createSeededRng(1234));
    expect(a).toBe(b);
  });

  it('produces different codes for different seeds', () => {
    const codes = new Set();
    for (let seed = 0; seed < 200; seed += 1) {
      codes.add(generateRoomCode(createSeededRng(seed)));
    }
    // With 456,976 possible codes, 200 draws colliding would be a broken RNG.
    expect(codes.size).toBeGreaterThan(195);
  });

  it('uses the whole alphabet over many draws', () => {
    const rng = createSeededRng(seedFromString('coverage'));
    const seen = new Set();
    for (let i = 0; i < 2000; i += 1) {
      for (const char of generateRoomCode(rng)) seen.add(char);
    }
    expect(seen.size).toBe(ROOM_CODE_ALPHABET.length);
  });

  it('honours a custom length', () => {
    const rng = createSeededRng(7);
    expect(generateRoomCode(rng, 6)).toHaveLength(6);
    expect(isValidRoomCode(generateRoomCode(rng, 6), 6)).toBe(true);
  });
});

describe('roomCodeSpace', () => {
  it('matches the size of the code space', () => {
    expect(roomCodeSpace(4)).toBe(ROOM_CODE_ALPHABET.length ** 4);
  });

  it('is large enough to be practical', () => {
    expect(roomCodeSpace()).toBeGreaterThan(100_000);
  });
});
