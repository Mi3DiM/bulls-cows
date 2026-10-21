/**
 * Internationalisation.
 *
 * A deliberately small implementation: two locale tables, a `t()` function
 * with `{placeholder}` interpolation, and a `dir`/`lang` setter. A full i18n
 * library would be more code than the feature needs.
 *
 * The direction matters as much as the text. Arabic is right-to-left, so
 * switching locale flips `dir` on the document and the whole layout mirrors —
 * which is why every layout rule in the app uses logical properties.
 */

import ar from './ar.js';
import en from './en.js';

/** @typedef {'en' | 'ar'} Locale */

/** Every locale the app ships with. */
export const LOCALES = Object.freeze([
  { id: /** @type {Locale} */ ('en'), label: 'English', dir: /** @type {'ltr'} */ ('ltr') },
  { id: /** @type {Locale} */ ('ar'), label: 'العربية', dir: /** @type {'rtl'} */ ('rtl') },
]);

/** The locale used when nothing else applies. */
export const DEFAULT_LOCALE = /** @type {Locale} */ ('en');

const TABLES = { en, ar };

const STORAGE_KEY = 'bulls-cows:locale';

/**
 * Whether a value is a supported locale.
 *
 * @param {unknown} value
 * @returns {value is Locale}
 */
export function isLocale(value) {
  return value === 'en' || value === 'ar';
}

/**
 * Picks the best locale for a browser.
 *
 * Used only for the very first visit; an explicit choice always wins.
 *
 * @param {string | undefined | null} languages  A comma-separated language list.
 * @returns {Locale}
 */
export function detectLocale(languages) {
  if (!languages) return DEFAULT_LOCALE;

  for (const entry of languages.split(',')) {
    const tag = entry.trim().toLowerCase().split(';')[0]?.split('-')[0];
    if (isLocale(tag)) return tag;
  }

  return DEFAULT_LOCALE;
}

/**
 * Reads the stored locale, falling back to the browser's.
 *
 * @returns {Locale}
 */
export function readStoredLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Private browsing, or storage disabled. Fall through to detection.
  }
  return detectLocale(navigator.language);
}

/**
 * The current locale.
 *
 * @returns {Locale}
 */
let current = DEFAULT_LOCALE;

/**
 * The current locale.
 *
 * @returns {Locale}
 */
export function getLocale() {
  return current;
}

/**
 * The current text direction.
 *
 * @returns {'ltr' | 'rtl'}
 */
export function getDirection() {
  return current === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Switches locale, updates the document, and persists the choice.
 *
 * @param {Locale} locale
 */
export function setLocale(locale) {
  current = isLocale(locale) ? locale : DEFAULT_LOCALE;

  const root = document.documentElement;
  root.setAttribute('lang', current);
  root.setAttribute('dir', getDirection());

  try {
    window.localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Storage disabled. The choice lasts for this page view only.
  }
}

/**
 * Translates a key.
 *
 * An unknown key returns the key itself, so a missing string is visible in
 * the UI rather than silently blank.
 *
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const table = TABLES[current] ?? TABLES[DEFAULT_LOCALE];
  const template = table[key] ?? TABLES[DEFAULT_LOCALE][key] ?? key;

  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Formats a number for the current locale.
 *
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  try {
    return new Intl.NumberFormat(current).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Formats a duration as `m:ss`.
 *
 * @param {number} milliseconds
 * @returns {string}
 */
export function formatDuration(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
