/**
 * Application bootstrap.
 *
 * Sets the locale, restores the player's name, wires the controller to the
 * DOM, and starts the app.
 */

import './styles/main.css';
import './styles/game.css';

import { App } from './app.js';
import { getLocale, setLocale, t } from './i18n/index.js';
import { AVATAR_COUNT } from './ui/avatar.js';
import { readStoredLocale } from './i18n/index.js';

const NAME_KEY = 'bulls-cows:name';
const AVATAR_KEY = 'bulls-cows:avatar';

/**
 * Reads the stored player name, or makes one up.
 *
 * @returns {string}
 */
function readName() {
  try {
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored && stored.trim()) return stored.trim().slice(0, 24);
  } catch {
    // Storage disabled.
  }
  return 'Player';
}

/**
 * Whether the player has chosen a name on this device before.
 *
 * @returns {boolean}
 */
function hasName() {
  try {
    const stored = window.localStorage.getItem(NAME_KEY);
    return Boolean(stored && stored.trim());
  } catch {
    return false;
  }
}

/**
 * Reads the stored avatar index.
 *
 * @returns {number}
 */
function readAvatar() {
  try {
    const stored = Number.parseInt(window.localStorage.getItem(AVATAR_KEY) ?? '', 10);
    if (Number.isInteger(stored) && stored >= 0 && stored < AVATAR_COUNT) return stored;
  } catch {
    // Storage disabled.
  }
  return Math.floor(Math.random() * AVATAR_COUNT);
}

/**
 * Stores the player's name.
 *
 * @param {string} name
 */
export function storeName(name) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage disabled. The name lasts for this page view only.
  }
}

/**
 * Stores the player's chosen avatar.
 *
 * @param {number} index
 */
export function storeAvatar(index) {
  try {
    window.localStorage.setItem(AVATAR_KEY, String(index));
  } catch {
    // Storage disabled.
  }
}

const screenRoot = /** @type {HTMLElement | null} */ (document.querySelector('#screen-root'));
const roomBar = /** @type {HTMLElement | null} */ (document.querySelector('#room-bar'));
const bannerRoot = /** @type {HTMLElement | null} */ (document.querySelector('#banner-root'));
const toastRoot = /** @type {HTMLElement | null} */ (document.querySelector('#toast-root'));

if (screenRoot && roomBar && bannerRoot && toastRoot) {
  setLocale(readStoredLocale());

  const app = new App({
    screenRoot,
    roomBar,
    bannerRoot,
    toastRoot,
    playerName: readName(),
    playerAvatar: readAvatar(),
    locale: getLocale(),
    hasName: hasName(),
  });

  // A stable handle for the end-to-end tests, and a convenience for
  // debugging in the console.
  /** @type {any} */ (window).bullsCows = app;

  // Remember the name so a returning player does not have to type it again.
  const originalSetPlayerName = app.setPlayerName.bind(app);
  app.setPlayerName = (name, avatarIndex) => {
    originalSetPlayerName(name, avatarIndex);
    storeName(name);
    if (typeof avatarIndex === 'number') storeAvatar(avatarIndex);
  };

  void app.start();

  document.title = `${t('app.title')} — ${t('app.tagline')}`;
}
