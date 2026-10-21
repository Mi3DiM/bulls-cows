/**
 * The secret, and the bulls-and-cows scoring.
 *
 * This is the heart of the game and the code most worth testing exhaustively:
 * a scoring mistake is invisible to the player and quietly ruins the game.
 */

import { randomInt, shuffle } from './rng.js';

/** @typedef {import('./rng.js').Rng} Rng */

/**
 * @typedef {object} Rules
 * @property {number} digits    How many digits the secret has.
 * @property {number} attempts  How many guesses each player gets.
 * @property {boolean} allowRepeats  Whether the secret may repeat a digit.
 */

/**
 * @typedef {object} Score
 * @property {number} bulls  Correct digit in the correct position.
 * @property {number} cows   Correct digit in the wrong position.
 */

const ALL_DIGITS = Object.freeze('0123456789');

/**
 * Generates a secret.
 *
 * With `allowRepeats` false the digits are drawn without replacement, so the
 * secret contains no duplicate. With it true, digits are drawn independently
 * and a digit may appear more than once.
 *
 * @param {Rng} rng
 * @param {{ digits: number, allowRepeats: boolean }} options
 * @returns {string} A string of decimal digits.
 */
export function generateSecret(rng, { digits, allowRepeats }) {
  if (!Number.isInteger(digits) || digits < 1 || digits > ALL_DIGITS.length) {
    throw new RangeError(`generateSecret: digits must be an integer in 1..${ALL_DIGITS.length}`);
  }

  if (allowRepeats) {
    let secret = '';
    for (let i = 0; i < digits; i += 1) {
      secret += ALL_DIGITS.charAt(randomInt(rng, 0, ALL_DIGITS.length - 1));
    }
    return secret;
  }

  const pool = shuffle(rng, ALL_DIGITS.split(''));
  return pool.slice(0, digits).join('');
}

/**
 * Scores a guess against the secret.
 *
 * Bulls are exact positional matches. Cows are the remaining shared digits,
 * counted with multiplicity: a digit present twice in the secret and once in
 * the guess yields exactly one cow, never two.
 *
 * @param {string} secret
 * @param {string} guess
 * @returns {Score}
 */
export function scoreGuess(secret, guess) {
  if (typeof secret !== 'string' || typeof guess !== 'string') {
    throw new TypeError('scoreGuess: secret and guess must both be strings');
  }
  if (secret.length !== guess.length) {
    throw new RangeError('scoreGuess: secret and guess must be the same length');
  }

  /** @type {string[]} */
  const unmatchedSecret = [];
  /** @type {string[]} */
  const unmatchedGuess = [];
  let bulls = 0;

  for (let i = 0; i < secret.length; i += 1) {
    if (secret.charAt(i) === guess.charAt(i)) {
      bulls += 1;
    } else {
      unmatchedSecret.push(secret.charAt(i));
      unmatchedGuess.push(guess.charAt(i));
    }
  }

  /** @type {Map<string, number>} */
  const available = new Map();
  for (const digit of unmatchedSecret) {
    available.set(digit, (available.get(digit) ?? 0) + 1);
  }

  let cows = 0;
  for (const digit of unmatchedGuess) {
    const count = available.get(digit) ?? 0;
    if (count > 0) {
      cows += 1;
      available.set(digit, count - 1);
    }
  }

  return { bulls, cows };
}

/**
 * Whether a guess is a legal move under the given rules.
 *
 * @param {unknown} guess
 * @param {Rules} rules
 * @returns {boolean}
 */
export function isValidGuess(guess, rules) {
  if (typeof guess !== 'string') return false;
  if (guess.length !== rules.digits) return false;

  for (const char of guess) {
    if (!ALL_DIGITS.includes(char)) return false;
  }

  if (!rules.allowRepeats) {
    if (new Set(guess).size !== guess.length) return false;
  }

  return true;
}

/**
 * Whether a guess solved the secret.
 *
 * @param {string} secret
 * @param {string} guess
 * @returns {boolean}
 */
export function isCorrectGuess(secret, guess) {
  return secret.length === guess.length && secret === guess;
}
