import { describe, expect, it } from 'vitest';

import {
  CODE_REGENERATION_ATTEMPTS,
  CONNECT_TIMEOUT_MS,
  DEFAULT_RULES,
  DIGIT_OPTIONS,
  HEARTBEAT_MS,
  ICE_SERVERS,
  MAX_CHAT_LENGTH,
  MAX_MESSAGE_BYTES,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  RETRY_DELAYS_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SEAT_HOLD_MS,
  STALE_MS,
} from '../../src/config.js';

describe('config', () => {
  it('keeps the room-code alphabet free of visually ambiguous characters', () => {
    // The three classic misreadings: O/0, I/1 and L.
    for (const ambiguous of ['O', '0', 'I', '1', 'L']) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('uses an alphabet of unique uppercase alphanumerics', () => {
    expect(ROOM_CODE_ALPHABET).toMatch(/^[A-Z0-9]+$/);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });

  it('produces a room-code space large enough to be practical', () => {
    const space = ROOM_CODE_ALPHABET.length ** ROOM_CODE_LENGTH;
    expect(space).toBeGreaterThan(100_000);
  });

  it('keeps the retry schedule increasing and bounded', () => {
    expect(RETRY_DELAYS_MS.length).toBeGreaterThan(0);
    for (let i = 1; i < RETRY_DELAYS_MS.length; i += 1) {
      expect(RETRY_DELAYS_MS[i]).toBeGreaterThan(RETRY_DELAYS_MS[i - 1] ?? 0);
    }
    expect(Math.max(...RETRY_DELAYS_MS)).toBeLessThanOrEqual(15_000);
  });

  it('keeps the staleness window longer than the heartbeat interval', () => {
    // A guest must not declare itself stale while the host is still heartbeating.
    expect(STALE_MS).toBeGreaterThan(HEARTBEAT_MS);
  });

  it('keeps the seat-hold window longer than the connect timeout', () => {
    expect(SEAT_HOLD_MS).toBeGreaterThan(CONNECT_TIMEOUT_MS);
  });

  it('offers at least one ICE server', () => {
    expect(ICE_SERVERS.length).toBeGreaterThan(0);
    for (const server of ICE_SERVERS) {
      expect(typeof server.urls).toBe('string');
    }
  });

  it('freezes the default rules', () => {
    expect(Object.isFrozen(DEFAULT_RULES)).toBe(true);
    expect(DIGIT_OPTIONS).toContain(DEFAULT_RULES.digits);
  });

  it('keeps the message size ceiling above the largest realistic payload', () => {
    // A full state snapshot is a few hundred bytes; 8 KB leaves ample room while
    // still bounding what a guest can make the host parse.
    expect(MAX_MESSAGE_BYTES).toBeGreaterThan(4 * 1024);
  });

  it('keeps the text limits sane', () => {
    expect(MAX_NAME_LENGTH).toBeGreaterThan(0);
    expect(MAX_CHAT_LENGTH).toBeGreaterThan(MAX_NAME_LENGTH);
    expect(MAX_PLAYERS).toBeGreaterThan(1);
    expect(CODE_REGENERATION_ATTEMPTS).toBeGreaterThan(1);
  });
});
