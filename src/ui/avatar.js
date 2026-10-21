/**
 * Player avatars.
 *
 * Eight original, purely geometric marks. They are generated rather than
 * loaded, so a player on a slow connection gets them instantly and the app
 * ships no image assets.
 */

import { svg } from './dom.js';

/** How many avatars exist. A player picks one by index. */
export const AVATAR_COUNT = 8;

/** The palette each avatar is drawn from. */
const PALETTES = [
  { base: '#7c3aed', accent: '#e935c1' },
  { base: '#059669', accent: '#2bf59b' },
  { base: '#e935c1', accent: '#fbbf24' },
  { base: '#0891b2', accent: '#22d3ee' },
  { base: '#b45309', accent: '#fbbf24' },
  { base: '#9f1239', accent: '#fb4e6e' },
  { base: '#4c1d95', accent: '#a78bfa' },
  { base: '#166534', accent: '#2bf59b' },
];

/**
 * Creates an avatar.
 *
 * @param {number} index  Which avatar, 0 to {@link AVATAR_COUNT} - 1.
 * @param {number} [size]
 * @returns {SVGElement}
 */
export function avatar(index, size = 40) {
  const variant = ((index % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const palette = PALETTES[variant] ?? { base: '#7c3aed', accent: '#e935c1' };

  const root = svg('svg', {
    viewBox: '0 0 48 48',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
    class: 'shrink-0 rounded-full',
  });

  root.append(
    svg('circle', { cx: 24, cy: 24, r: 23, fill: palette.base }),
    svg('circle', {
      cx: 24,
      cy: 24,
      r: 23,
      fill: 'none',
      stroke: palette.accent,
      'stroke-width': 2.5,
    }),
  );

  switch (variant) {
    case 0:
      root.append(
        svg('circle', { cx: 18, cy: 20, r: 4, fill: '#f4f1ff' }),
        svg('circle', { cx: 30, cy: 20, r: 4, fill: '#f4f1ff' }),
        svg('path', {
          d: 'M17 29c3 3 11 3 14 0',
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }),
      );
      break;

    case 1:
      root.append(
        svg('path', {
          d: 'M14 30c0-6 4-10 10-10s10 4 10 10',
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3.4,
          'stroke-linecap': 'round',
        }),
        svg('circle', { cx: 24, cy: 33, r: 3, fill: palette.accent }),
      );
      break;

    case 2:
      root.append(
        svg('path', {
          d: 'M24 11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L24 27.5l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z',
          fill: '#f4f1ff',
        }),
      );
      break;

    case 3:
      root.append(
        svg('circle', {
          cx: 24,
          cy: 24,
          r: 9,
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3.4,
        }),
        svg('circle', { cx: 24, cy: 24, r: 3, fill: palette.accent }),
      );
      break;

    case 4:
      root.append(
        svg('path', {
          d: 'M15 16h18v10a9 9 0 0 1-18 0z',
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3.2,
        }),
        svg('path', {
          d: 'M18 12v4M30 12v4',
          stroke: palette.accent,
          'stroke-width': 3.2,
          'stroke-linecap': 'round',
        }),
      );
      break;

    case 5:
      root.append(
        svg('path', {
          d: 'M24 12l11 8-11 16-11-16z',
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3.2,
          'stroke-linejoin': 'round',
        }),
        svg('path', {
          d: 'M18 22h12',
          stroke: palette.accent,
          'stroke-width': 3.2,
          'stroke-linecap': 'round',
        }),
      );
      break;

    case 6:
      root.append(
        svg('rect', {
          x: 14,
          y: 14,
          width: 20,
          height: 20,
          rx: 6,
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3.2,
        }),
        svg('circle', { cx: 24, cy: 24, r: 3.4, fill: palette.accent }),
      );
      break;

    default:
      root.append(
        svg('path', {
          d: 'M13 30c0-6.6 5-11 11-11s11 4.4 11 11',
          fill: 'none',
          stroke: '#f4f1ff',
          'stroke-width': 3.4,
          'stroke-linecap': 'round',
        }),
        svg('path', {
          d: 'M13 30h22',
          stroke: palette.accent,
          'stroke-width': 3.4,
          'stroke-linecap': 'round',
        }),
      );
      break;
  }

  return root;
}
