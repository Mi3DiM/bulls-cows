/**
 * Injectable randomness.
 *
 * Every module that needs randomness takes an RNG function so its tests are
 * deterministic. An RNG is simply a function returning a float in `[0, 1)`.
 *
 * @typedef {() => number} Rng
 */

/**
 * A fast, well-distributed 32-bit PRNG (mulberry32).
 *
 * Chosen because it is four lines, has no dependencies, and passes the
 * statistical checks that matter for picking digits and codes. It is **not**
 * cryptographically secure, and it does not need to be: the secret is chosen
 * at game start and never guards anything worth attacking.
 *
 * @param {number} seed  Any 32-bit integer.
 * @returns {Rng} A generator producing floats in `[0, 1)`.
 */
export function createSeededRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a 32-bit seed from a string.
 *
 * Used to make a test reproducible from a readable name rather than a magic
 * number.
 *
 * @param {string} text
 * @returns {number}
 */
export function seedFromString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A non-deterministic RNG, used in production.
 *
 * @returns {Rng}
 */
export function createRandomRng() {
  return Math.random;
}

/**
 * Returns a uniformly distributed integer in `[min, max]`, inclusive.
 *
 * @param {Rng} rng
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(rng, min, max) {
  if (max < min) {
    throw new RangeError(`randomInt: max (${max}) must be >= min (${min})`);
  }
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

/**
 * Returns a uniformly distributed element of `items`.
 *
 * @template T
 * @param {Rng} rng
 * @param {readonly T[]} items
 * @returns {T}
 * @throws {RangeError} when `items` is empty.
 */
export function pick(rng, items) {
  if (items.length === 0) {
    throw new RangeError('pick: cannot choose from an empty list');
  }
  const index = randomInt(rng, 0, items.length - 1);
  const value = items[index];
  // `randomInt` is bounded by the list length, so this cannot be undefined.
  return /** @type {T} */ (value);
}

/**
 * Returns a new array with the elements of `items` in random order.
 *
 * The input is not modified.
 *
 * @template T
 * @param {Rng} rng
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function shuffle(rng, items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    const a = result[i];
    const b = result[j];
    result[i] = /** @type {T} */ (b);
    result[j] = /** @type {T} */ (a);
  }
  return result;
}
