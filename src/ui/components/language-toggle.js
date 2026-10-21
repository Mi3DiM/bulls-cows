/**
 * The language toggle.
 *
 * A compact two-state switch. Switching locale flips the document direction,
 * which mirrors the whole layout.
 */

import { el } from '../dom.js';
import { t, getLocale, setLocale, LOCALES } from '../../i18n/index.js';

/**
 * Creates the language toggle.
 *
 * @param {() => void} [onChange]  Called after the locale changes.
 * @returns {HTMLElement}
 */
export function createLanguageToggle(onChange) {
  const group = el(
    'div.inline-flex.items-center.gap-0.5.rounded-xl.border.border-violet/25.bg-panel-soft.p-1',
    { role: 'group', 'aria-label': t('common.language') },
  );

  const buttons = new Map();

  for (const locale of LOCALES) {
    const button = el(
      'button.rounded-lg.px-2.5.py-1.text-xs.font-bold.transition-colors',
      {
        type: 'button',
        'data-locale': locale.id,
        'aria-pressed': 'false',
        lang: locale.id,
      },
      [locale.label],
    );

    button.addEventListener('click', () => {
      if (getLocale() === locale.id) return;
      setLocale(locale.id);
      sync();
      onChange?.();
    });

    buttons.set(locale.id, button);
    group.append(button);
  }

  const sync = () => {
    const current = getLocale();
    for (const [id, button] of buttons) {
      const active = id === current;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('bg-violet', active);
      button.classList.toggle('text-text', active);
      button.classList.toggle('text-muted', !active);
    }
  };

  sync();
  return group;
}
