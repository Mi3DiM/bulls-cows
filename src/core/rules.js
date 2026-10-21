/**
 * Game rules.
 *
 * The Host picks the rules when creating a room; everything downstream reads
 * them from the shared state. This module is the only place that decides what
 * a legal rule set looks like.
 */

import { ATTEMPT_OPTIONS, DEFAULT_RULES, DIGIT_OPTIONS } from '../config.js';

/** @typedef {import('./secret.js').Rules} Rules */

/**
 * @typedef {'invalid-digits' | 'invalid-attempts' | 'invalid-repeats'} RuleError
 */

/**
 * @typedef {{ ok: true, value: Rules } | { ok: false, error: RuleError }} RuleResult
 */

/**
 * Validates a rule set.
 *
 * @param {unknown} input
 * @returns {RuleResult}
 */
export function validateRules(input) {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'invalid-digits' };
  }

  const candidate = /** @type {Record<string, unknown>} */ (input);

  const digits = candidate.digits;
  if (typeof digits !== 'number' || !DIGIT_OPTIONS.includes(digits)) {
    return { ok: false, error: 'invalid-digits' };
  }

  const attempts = candidate.attempts;
  if (typeof attempts !== 'number' || !ATTEMPT_OPTIONS.includes(attempts)) {
    return { ok: false, error: 'invalid-attempts' };
  }

  const allowRepeats = candidate.allowRepeats;
  if (typeof allowRepeats !== 'boolean') {
    return { ok: false, error: 'invalid-repeats' };
  }

  return {
    ok: true,
    value: Object.freeze({
      digits: /** @type {number} */ (digits),
      attempts: /** @type {number} */ (attempts),
      allowRepeats: /** @type {boolean} */ (allowRepeats),
    }),
  };
}

/**
 * Coerces anything into a legal rule set, falling back to the defaults.
 *
 * Used when reading rules that arrived over the wire, where a malformed value
 * must not be able to break the game.
 *
 * @param {unknown} input
 * @returns {Rules}
 */
export function normalizeRules(input) {
  const result = validateRules(input);
  if (result.ok) return result.value;
  return Object.freeze({ ...DEFAULT_RULES });
}

/**
 * Whether the rules are the default ones.
 *
 * @param {Rules} rules
 * @returns {boolean}
 */
export function isDefaultRules(rules) {
  return (
    rules.digits === DEFAULT_RULES.digits &&
    rules.attempts === DEFAULT_RULES.attempts &&
    rules.allowRepeats === DEFAULT_RULES.allowRepeats
  );
}
