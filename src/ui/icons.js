/**
 * The icon set.
 *
 * Inline SVG, drawn for this project. Every icon is decorative by default
 * (`aria-hidden`), because the control that holds it carries the accessible
 * name. Icons are never emoji — emoji render differently on every platform
 * and cannot be styled.
 */

import { svg } from './dom.js';

/**
 * @typedef {'copy' | 'share' | 'check' | 'backspace' | 'send' | 'trophy' | 'bull' | 'cow' | 'globe' | 'leave' | 'crown' | 'clock' | 'users' | 'hash' | 'sparkle' | 'warning'} IconName
 */

const PATHS = {
  copy: 'M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4M5 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  check: 'm5 13 4 4L19 7',
  backspace: 'M21 5H9l-6 7 6 7h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2ZM17 9l-5 6M12 9l5 6',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  trophy: 'M6 4h12v6a6 6 0 0 1-12 0V4ZM6 6H3v2a4 4 0 0 0 4 4M18 6h3v2a4 4 0 0 1-4 4M9 22h6M12 16v6',
  bull: 'M4 4c0 3 1 4 3 5M20 4c0 3-1 4-3 5M8 9h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4ZM9 13h.01M15 13h.01',
  cow: 'M4 4c0 3 1 4 3 5M20 4c0 3-1 4-3 5M8 9h8a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4ZM9 13h.01M15 13h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z',
  leave: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  crown: 'M3 7l4 4 5-7 5 7 4-4v12H3V7Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  sparkle:
    'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8',
  warning:
    'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
};

/**
 * Creates an icon.
 *
 * @param {IconName} name
 * @param {number} [size]
 * @returns {SVGElement}
 */
export function icon(name, size = 20) {
  const path = PATHS[name];
  if (!path) {
    throw new Error(`icon: unknown icon "${name}"`);
  }

  return svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [svg('path', { d: path })],
  );
}
