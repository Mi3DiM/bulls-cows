import { describe, expect, it } from 'vitest';

import { isDefaultRules, normalizeRules, validateRules } from '../../src/core/rules.js';
import { DEFAULT_RULES } from '../../src/config.js';

describe('validateRules', () => {
  it('accepts a legal rule set', () => {
    const result = validateRules({ digits: 4, attempts: 8, allowRepeats: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ digits: 4, attempts: 8, allowRepeats: false });
    }
  });

  it('freezes the result so a caller cannot mutate the rules in place', () => {
    const result = validateRules({ digits: 4, attempts: 8, allowRepeats: false });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('rejects an unsupported digit count', () => {
    expect(validateRules({ digits: 12, attempts: 8, allowRepeats: false })).toEqual({
      ok: false,
      error: 'invalid-digits',
    });
    expect(validateRules({ digits: '4', attempts: 8, allowRepeats: false })).toEqual({
      ok: false,
      error: 'invalid-digits',
    });
  });

  it('rejects an unsupported attempt count', () => {
    expect(validateRules({ digits: 4, attempts: 7, allowRepeats: false })).toEqual({
      ok: false,
      error: 'invalid-attempts',
    });
  });

  it('rejects a non-boolean repeats flag', () => {
    expect(validateRules({ digits: 4, attempts: 8, allowRepeats: 'yes' })).toEqual({
      ok: false,
      error: 'invalid-repeats',
    });
  });

  it('rejects non-object input', () => {
    expect(validateRules(null).ok).toBe(false);
    expect(validateRules('nope').ok).toBe(false);
  });
});

describe('normalizeRules', () => {
  it('passes a legal rule set through', () => {
    const rules = normalizeRules({ digits: 3, attempts: 6, allowRepeats: true });
    expect(rules).toEqual({ digits: 3, attempts: 6, allowRepeats: true });
  });

  it('falls back to the defaults for anything illegal', () => {
    expect(normalizeRules({ digits: 99 })).toEqual({ ...DEFAULT_RULES });
    expect(normalizeRules(null)).toEqual({ ...DEFAULT_RULES });
  });
});

describe('isDefaultRules', () => {
  it('recognises the default rule set', () => {
    expect(isDefaultRules({ ...DEFAULT_RULES })).toBe(true);
    expect(isDefaultRules({ digits: 3, attempts: 8, allowRepeats: false })).toBe(false);
  });
});
