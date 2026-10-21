/**
 * Transient notices.
 *
 * Two kinds:
 *
 * - a **banner**, pinned to the top, for a condition the player must know
 *   about right now — "reconnecting", "the host left";
 * - a **toast**, at the bottom, for a brief message.
 *
 * Both are announced to assistive technology through `aria-live`, and both
 * are dismissible by clicking.
 */

import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';

/**
 * Shows a banner.
 *
 * @param {HTMLElement} root
 * @param {object} options
 * @param {string} options.text
 * @param {string} [options.hint]
 * @param {'info' | 'warning' | 'error' | 'success'} [options.kind]
 * @param {number} [options.autoDismissMs]  0 keeps it until replaced.
 */
export function showBanner(root, { text, hint, kind = 'info', autoDismissMs = 0 }) {
  clear(root);

  const tones = {
    info: 'border-cyan/50 bg-cyan/10 text-cyan',
    warning: 'border-gold/50 bg-gold/10 text-gold',
    error: 'border-rose/50 bg-rose/10 text-rose',
    success: 'border-mint/50 bg-mint/10 text-mint',
  };

  const banner = el(
    `div.glass.animate-drop-in.pointer-events-auto.flex.w-full.max-w-md.items-start.gap-3.rounded-2xl.border.px-4.py-3 ${tones[kind]}`,
    { role: 'status' },
    [
      el('span.mt-0.5.shrink-0', {}, [icon(kind === 'error' ? 'warning' : 'sparkle', 20)]),
      el('div.min-w-0.flex-1', {}, [
        el('p.text-sm.font-bold', { text }),
        hint ? el('p.mt-0.5.text-xs.opacity-80', { text: hint }) : null,
      ]),
    ],
  );

  banner.addEventListener('click', () => clear(root));
  root.append(banner);

  if (autoDismissMs > 0) {
    setTimeout(() => {
      if (banner.isConnected) clear(root);
    }, autoDismissMs);
  }
}

/**
 * Hides the banner.
 *
 * @param {HTMLElement} root
 */
export function hideBanner(root) {
  clear(root);
}

/**
 * Shows a toast.
 *
 * @param {HTMLElement} root
 * @param {object} options
 * @param {string} options.text
 * @param {'info' | 'success' | 'warning' | 'error'} [options.kind]
 * @param {number} [options.durationMs]
 */
export function showToast(root, { text, kind = 'info', durationMs = 3200 }) {
  const tones = {
    info: 'border-violet/50 bg-panel/95 text-text',
    success: 'border-mint/50 bg-panel/95 text-mint',
    warning: 'border-gold/50 bg-panel/95 text-gold',
    error: 'border-rose/50 bg-panel/95 text-rose',
  };

  const toast = el(
    `glass.animate-slide-in-top.pointer-events-auto.flex.max-w-sm.items-center.gap-2.rounded-2xl.border.px-4.py-2.5.text-sm.font-semibold ${tones[kind]}`,
    { role: 'status' },
    [el('span', { text })],
  );

  toast.addEventListener('click', () => toast.remove());
  root.append(toast);

  setTimeout(() => toast.remove(), durationMs);

  // Keep the stack short enough to stay readable.
  while (root.childElementCount > 3) {
    root.firstElementChild?.remove();
  }
}

/**
 * The text of the reconnecting banner, including the countdown.
 *
 * @param {number} seconds
 * @returns {string}
 */
export function reconnectingText(seconds) {
  return t('game.reconnectingHint', { n: seconds });
}
