/**
 * Room codes.
 *
 * A room code is simultaneously the game's display name and the Host's
 * PeerJS peer ID — see `docs/adr/0002-room-code-as-peer-id.md`.
 *
 * Two properties matter and are enforced here:
 *
 * 1. **Every code is uppercase.** The public signaling server treats peer IDs
 *    case-insensitively for uniqueness, so the app normalises at this one
 *    choke point and never has to think about case again.
 * 2. **Every code is readable.** The alphabet contains no symbol that can be
 *    misread for another symbol.
 */

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../config.js';
import { randomInt } from './rng.js';

/** @typedef {import('./rng.js').Rng} Rng */

/**
 * Strips everything that is not part of the alphabet and uppercases the rest.
 *
 * This is the forgiving half of code entry: it removes spaces, dashes and any
 * other separators a player might paste in, and it accepts a lowercase code.
 *
 * @param {unknown} input
 * @returns {string} The cleaned code. May be empty or malformed.
 */
export function normalizeRoomCode(input) {
  if (typeof input !== 'string') return '';
  const upper = input.toUpperCase();
  let out = '';
  for (const char of upper) {
    if (ROOM_CODE_ALPHABET.includes(char)) {
      out += char;
    }
  }
  return out;
}

/**
 * Whether `code` is a complete, valid room code.
 *
 * This is the strict check: the code must be exactly the right length and
 * every character must be in the alphabet.
 *
 * @param {unknown} code
 * @param {number} [length]
 * @returns {boolean}
 */
export function isValidRoomCode(code, length = ROOM_CODE_LENGTH) {
  if (typeof code !== 'string' || code.length !== length) return false;
  for (const char of code) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Parses whatever a player typed into a room code.
 *
 * Returns `null` when the input cannot be a valid code — for example when it
 * is too short, or when it contains a character that is not in the alphabet
 * even after normalisation.
 *
 * @param {unknown} input
 * @param {number} [length]
 * @returns {string | null} The normalised, valid code, or `null`.
 */
export function parseRoomCode(input, length = ROOM_CODE_LENGTH) {
  if (typeof input !== 'string') return null;

  // Reject an input that contains characters outside the alphabet *before*
  // cleaning, so that a typo is reported rather than silently dropped.
  const cleaned = input.toUpperCase().replace(/[\s\-_.]/g, '');
  for (const char of cleaned) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return null;
  }

  const normalized = normalizeRoomCode(cleaned);
  return isValidRoomCode(normalized, length) ? normalized : null;
}

/**
 * Generates a random room code.
 *
 * @param {Rng} rng
 * @param {number} [length]
 * @returns {string}
 */
export function generateRoomCode(rng, length = ROOM_CODE_LENGTH) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const index = randomInt(rng, 0, ROOM_CODE_ALPHABET.length - 1);
    code += ROOM_CODE_ALPHABET.charAt(index);
  }
  return code;
}

/**
 * How many distinct codes the alphabet and length allow.
 *
 * Used by the UI to explain the code space, and by the tests to assert the
 * space is still large enough to be practical.
 *
 * @param {number} [length]
 * @returns {number}
 */
export function roomCodeSpace(length = ROOM_CODE_LENGTH) {
  return ROOM_CODE_ALPHABET.length ** length;
}
