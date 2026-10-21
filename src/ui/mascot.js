/**
 * The mascot.
 *
 * An original cartoon cow, drawn as inline SVG for this project. It reacts to
 * what happens in the game — waiting, thinking, celebrating, commiserating.
 *
 * Everything is built from shapes rather than a bitmap, so it stays crisp at
 * any size, costs a couple of kilobytes, and can be recoloured with the
 * current theme.
 */

import { svg } from './dom.js';

/** @typedef {'idle' | 'thinking' | 'celebrate' | 'sad' | 'cheer'} MascotState */

/**
 * @param {MascotState} state
 * @returns {SVGElement}
 */
function face(state) {
  const group = svg('g', { 'data-face': 'true' });

  // Eyes.
  if (state === 'celebrate' || state === 'cheer') {
    // Happy closed arcs.
    group.append(
      svg('path', {
        d: 'M74 84c3-6 9-6 12 0',
        fill: 'none',
        stroke: '#1a0b3d',
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }),
      svg('path', {
        d: 'M114 84c3-6 9-6 12 0',
        fill: 'none',
        stroke: '#1a0b3d',
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }),
    );
  } else if (state === 'sad') {
    group.append(
      svg('path', {
        d: 'M72 88c4 4 10 4 14 0',
        fill: 'none',
        stroke: '#1a0b3d',
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }),
      svg('path', {
        d: 'M114 88c4 4 10 4 14 0',
        fill: 'none',
        stroke: '#1a0b3d',
        'stroke-width': 5,
        'stroke-linecap': 'round',
      }),
    );
  } else {
    const eyeY = state === 'thinking' ? 82 : 80;
    group.append(
      svg('ellipse', {
        cx: 80,
        cy: eyeY,
        rx: 7,
        ry: state === 'thinking' ? 5 : 8,
        fill: '#1a0b3d',
      }),
      svg('ellipse', {
        cx: 120,
        cy: eyeY,
        rx: 7,
        ry: state === 'thinking' ? 5 : 8,
        fill: '#1a0b3d',
      }),
      svg('circle', { cx: 82, cy: eyeY - 3, r: 2.6, fill: '#ffffff' }),
      svg('circle', { cx: 122, cy: eyeY - 3, r: 2.6, fill: '#ffffff' }),
    );
  }

  // Muzzle and mouth.
  group.append(
    svg('ellipse', { cx: 100, cy: 112, rx: 27, ry: 20, fill: '#f7a8c4' }),
    svg('ellipse', { cx: 89, cy: 112, rx: 4, ry: 6, fill: '#c25b83' }),
    svg('ellipse', { cx: 111, cy: 112, rx: 4, ry: 6, fill: '#c25b83' }),
  );

  if (state === 'celebrate' || state === 'cheer') {
    group.append(
      svg('path', {
        d: 'M86 130c4 8 24 8 28 0',
        fill: '#c25b83',
        stroke: '#c25b83',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
    );
  } else if (state === 'sad') {
    group.append(
      svg('path', {
        d: 'M88 132c4-6 20-6 24 0',
        fill: 'none',
        stroke: '#c25b83',
        'stroke-width': 3.5,
        'stroke-linecap': 'round',
      }),
    );
  } else if (state === 'thinking') {
    group.append(
      svg('path', {
        d: 'M90 130h20',
        fill: 'none',
        stroke: '#c25b83',
        'stroke-width': 3.5,
        'stroke-linecap': 'round',
      }),
    );
  } else {
    group.append(
      svg('path', {
        d: 'M88 128c4 6 20 6 24 0',
        fill: 'none',
        stroke: '#c25b83',
        'stroke-width': 3.5,
        'stroke-linecap': 'round',
      }),
    );
  }

  return group;
}

/**
 * Creates the mascot.
 *
 * @param {MascotState} [state]
 * @param {number} [size]
 * @returns {SVGElement}
 */
export function mascot(state = 'idle', size = 180) {
  const root = svg('svg', {
    viewBox: '0 0 200 180',
    width: size,
    height: (size * 180) / 200,
    fill: 'none',
    'aria-hidden': 'true',
    focusable: 'false',
    class: 'select-none',
  });

  // Ears.
  root.append(
    svg('ellipse', {
      cx: 40,
      cy: 68,
      rx: 16,
      ry: 11,
      fill: '#e6e1ff',
      stroke: '#4c1d95',
      'stroke-width': 3,
      transform: 'rotate(-24 40 68)',
    }),
    svg('ellipse', {
      cx: 160,
      cy: 68,
      rx: 16,
      ry: 11,
      fill: '#e6e1ff',
      stroke: '#4c1d95',
      'stroke-width': 3,
      transform: 'rotate(24 160 68)',
    }),
  );

  // Horns.
  root.append(
    svg('path', {
      d: 'M64 44c-4-12-2-20 6-24 2 8 6 14 12 18',
      fill: '#fbbf24',
      stroke: '#b45309',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }),
    svg('path', {
      d: 'M136 44c4-12 2-20-6-24-2 8-6 14-12 18',
      fill: '#fbbf24',
      stroke: '#b45309',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }),
  );

  // Head.
  root.append(
    svg('ellipse', {
      cx: 100,
      cy: 86,
      rx: 58,
      ry: 52,
      fill: '#f4f1ff',
      stroke: '#4c1d95',
      'stroke-width': 4,
    }),
  );

  // Patches. Kept clear of the eyes so the expression always reads.
  root.append(
    svg('ellipse', {
      cx: 58,
      cy: 46,
      rx: 19,
      ry: 15,
      fill: '#1a0b3d',
      transform: 'rotate(-18 58 46)',
    }),
    svg('ellipse', { cx: 142, cy: 118, rx: 16, ry: 13, fill: '#1a0b3d' }),
  );

  root.append(face(state));

  // Bell.
  root.append(
    svg('path', {
      d: 'M74 138c8 8 44 8 52 0',
      fill: 'none',
      stroke: '#e935c1',
      'stroke-width': 6,
      'stroke-linecap': 'round',
    }),
    svg('circle', {
      cx: 100,
      cy: 146,
      r: 10,
      fill: '#fbbf24',
      stroke: '#b45309',
      'stroke-width': 2.5,
    }),
    svg('path', {
      d: 'M94 146h12',
      stroke: '#b45309',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
    }),
  );

  return root;
}

/**
 * Swaps the mascot's expression.
 *
 * @param {SVGElement} root
 * @param {MascotState} state
 */
export function setMascotState(root, state) {
  const current = root.querySelector('[data-face]');
  const next = face(state);
  next.setAttribute('data-face', 'true');
  if (current) {
    root.replaceChild(next, current);
  } else {
    root.append(next);
  }
}
