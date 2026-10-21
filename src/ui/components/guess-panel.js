/**
 * The guess panel — the digit vault and the keypad.
 *
 * This is the centre of the game screen, so it gets the most attention: the
 * vault tiles glow as digits land in them, the active tile breathes, and the
 * keypad is built for thumbs (large targets, no tiny digits).
 */

import { el, elButton } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';
import { playSfx, vibrate } from '../sfx.js';

/**
 * Creates the guess panel.
 *
 * @param {object} options
 * @param {number} options.digitCount
 * @param {boolean} options.enabled  Whether the player may guess right now.
 * @param {(digits: string) => void} options.onSubmit
 * @param {() => void} [options.onChange]
 */
export function createGuessPanel({ digitCount, enabled, onSubmit, onChange }) {
  /** @type {string[]} */
  let digits = [];

  let isEnabled = enabled;

  const panel = el('section.flex.flex-col.gap-4', { 'data-testid': 'guess-panel' });

  const vault = el('div.flex.justify-center.gap-2.sm:gap-3', {
    'data-testid': 'digit-vault',
    role: 'group',
    'aria-label': t('game.enter', { n: digitCount }),
  });

  const hint = el('p.text-center.text-sm.text-muted', { text: t('game.enter', { n: digitCount }) });

  /** @type {HTMLElement[]} */
  const tiles = [];

  for (let i = 0; i < digitCount; i += 1) {
    const tile = el(
      'div.tnum.flex.h-16.w-14.items-center.justify-center.rounded-2xl.border-2.border-violet/40.bg-panel-soft.text-3xl.font-extrabold.text-text.transition-all.sm:h-20.sm:w-16',
      { 'data-tile-index': i },
    );
    tiles.push(tile);
    vault.append(tile);
  }

  const keypad = el('div.grid.grid-cols-3.gap-2', { 'data-testid': 'keypad' });

  /** @type {HTMLButtonElement[]} */
  const keypadButtons = [];

  const render = () => {
    for (let i = 0; i < tiles.length; i += 1) {
      const tile = tiles[i];
      if (!tile) continue;

      const value = digits[i];
      const isActive = i === digits.length && isEnabled;

      tile.textContent = value ?? '';
      tile.classList.toggle('border-mint', Boolean(value) || isActive);
      tile.classList.toggle('text-mint', Boolean(value));
      tile.classList.toggle('animate-breathe', isActive);
      tile.classList.toggle('bg-mint/10', Boolean(value));
      tile.classList.toggle('border-violet/40', !value && !isActive);
    }

    // The keypad is inert when it is not the player's turn, and it says so
    // rather than silently swallowing the keypresses.
    for (const button of keypadButtons) {
      button.disabled = !isEnabled;
      button.classList.toggle('opacity-40', !isEnabled);
    }

    sendButton.disabled = !isEnabled || digits.length !== digitCount;
    sendButton.classList.toggle('opacity-40', sendButton.disabled);
  };

  const press = (digit) => {
    if (!isEnabled) return;
    if (digits.length >= digitCount) return;
    if (digits.includes(digit)) return;

    digits = [...digits, digit];
    playSfx('tap');
    vibrate(10);
    render();
    onChange?.();
  };

  const backspace = () => {
    if (!isEnabled) return;
    if (digits.length === 0) return;

    digits = digits.slice(0, -1);
    playSfx('backspace');
    vibrate(8);
    render();
    onChange?.();
  };

  const submit = () => {
    if (!isEnabled) return;
    if (digits.length !== digitCount) return;

    playSfx('send');
    vibrate(14);
    onSubmit(digits.join(''));
  };

  /**
   * Builds a keypad key.
   *
   * @param {string} label
   * @param {string} ariaLabel
   * @param {string} [extra]  Extra classes.
   * @returns {HTMLButtonElement}
   */
  const keyButton = (label, ariaLabel, extra = '') =>
    elButton(
      {
        class: `flex h-14 items-center justify-center rounded-2xl border border-violet/25 bg-panel-soft text-xl font-extrabold text-text transition-all active:scale-95 ${extra}`,
        type: 'button',
        'aria-label': ariaLabel,
        'data-key': label,
      },
      [label],
    );

  for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    const button = keyButton(digit, digit);
    keypadButtons.push(button);
    button.addEventListener('click', () => press(digit));
    keypad.append(button);
  }

  const clearButton = keyButton('', t('game.clear'), 'bg-panel/60');
  keypadButtons.push(clearButton);
  clearButton.append(icon('backspace', 22));
  clearButton.setAttribute('data-key', 'backspace');
  clearButton.addEventListener('click', backspace);
  keypad.append(clearButton);

  const zeroButton = keyButton('0', '0');
  keypadButtons.push(zeroButton);
  zeroButton.addEventListener('click', () => press('0'));
  keypad.append(zeroButton);

  const sendButton = elButton(
    {
      class:
        'flex h-14 items-center justify-center gap-2 rounded-2xl bg-mint text-lg font-extrabold text-void shadow-[0_0_24px_-6px_var(--color-mint)] transition-all active:scale-95',
      type: 'button',
      'data-action': 'send-guess',
      'aria-label': t('game.send'),
    },
    [icon('send', 20), el('span', { text: t('game.send') })],
  );
  sendButton.addEventListener('click', submit);
  keypad.append(sendButton);

  panel.append(vault, hint, keypad);
  render();

  return {
    element: panel,
    /**
     * Updates the panel when the turn changes.
     *
     * @param {boolean} next
     */
    setEnabled(next) {
      isEnabled = next;
      if (!isEnabled) digits = [];
      render();
    },
    /**
     * Clears the input.
     */
    reset() {
      digits = [];
      render();
    },
    /**
     * The digits currently entered.
     *
     * @returns {string}
     */
    value() {
      return digits.join('');
    },
  };
}
