/**
 * The attempts board.
 *
 * One **column per player**, each holding that player's attempts. On a phone
 * the columns scroll sideways; on a wide screen they sit side by side.
 *
 * Each attempt card shows the guess as glowing digit tiles plus a bull and a
 * cow badge.
 */

import { el, clear } from '../dom.js';
import { avatar } from '../avatar.js';
import { t } from '../../i18n/index.js';
import { PlayerStatus } from '../../core/state.js';

/**
 * Creates the attempts board.
 *
 * @param {object} options
 * @param {import('../../core/state.js').GameState} options.state
 * @param {string | null} options.selfId
 * @returns {HTMLElement}
 */
export function createAttemptsBoard({ state, selfId }) {
  const board = el('section flex flex-col gap-3', { 'data-testid': 'attempts-board' });

  const header = el('div flex items-baseline justify-between gap-3', {}, [
    el('h2 font-display text-lg font-extrabold', { text: t('game.attempts') }),
  ]);

  const rail = el('div flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory', {
    'data-testid': 'attempts-rail',
    // A horizontally scrollable region has to be reachable from the
    // keyboard, otherwise a keyboard user cannot see the later columns.
    tabindex: '0',
    role: 'group',
    'aria-label': t('game.attempts'),
  });

  board.append(header, rail);
  renderAttempts(rail, state, selfId);

  return board;
}

/**
 * Renders the attempts board.
 *
 * @param {HTMLElement} rail
 * @param {import('../../core/state.js').GameState} state
 * @param {string | null} selfId
 */
export function renderAttempts(rail, state, selfId) {
  clear(rail);

  if (state.players.length === 0) {
    rail.append(el('p w-full py-6 text-center text-sm text-muted', { text: t('game.noAttempts') }));
    return;
  }

  for (const player of state.players) {
    rail.append(createColumn(player, state, selfId));
  }
}

/**
 * Creates one player's column.
 *
 * @param {import('../../core/state.js').Player} player
 * @param {import('../../core/state.js').GameState} state
 * @param {string | null} selfId
 * @returns {HTMLElement}
 */
function createColumn(player, state, selfId) {
  const isSelf = player.id === selfId;
  const isTurn = state.turn === player.id && player.status === PlayerStatus.ACTIVE;

  const column = el('section snap-start flex w-44 shrink-0 flex-col gap-2', {
    'data-column-player': player.id,
  });

  const head = el(
    'div flex items-center gap-2 rounded-xl border border-violet/25 bg-panel-soft/70 px-2.5 py-2',
    {},
    [
      avatar(player.avatar, 28),
      el('span min-w-0 flex-1 truncate text-xs font-bold', { text: player.name }),
    ],
  );

  if (isTurn) {
    head.classList.add('glass-lit', 'border-mint/60');
    head.dataset.turn = 'true';
  }
  if (isSelf) {
    head.append(
      el('span rounded-full bg-cyan/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan', {
        text: t('common.you'),
      }),
    );
  }

  column.append(head);

  if (player.attempts.length === 0) {
    column.append(
      el(
        'p rounded-xl border border-dashed border-violet/20 px-2 py-4 text-center text-[11px] text-faint',
        {
          text: t('game.noAttempts'),
        },
      ),
    );
    return column;
  }

  for (const attempt of player.attempts) {
    column.append(createAttemptCard(attempt, state.rules.digits));
  }

  return column;
}

/**
 * Creates a single attempt card.
 *
 * @param {import('../../core/state.js').Attempt} attempt
 * @param {number} digitCount
 * @returns {HTMLElement}
 */
function createAttemptCard(attempt, digitCount) {
  const card = el(
    'div animate-stamp-in flex flex-col gap-1.5 rounded-xl border border-violet/20 bg-panel-soft/50 px-2 py-2',
    { 'data-attempt': attempt.digits },
  );

  const digits = el('div flex justify-center gap-1');
  for (let i = 0; i < digitCount; i += 1) {
    digits.append(
      el(
        'span tnum flex h-7 w-6 items-center justify-center rounded-md bg-violet-deep/50 text-xs font-extrabold text-text',
        {
          text: attempt.digits.charAt(i),
        },
      ),
    );
  }

  const badges = el('div flex justify-center gap-1.5');

  badges.append(
    badge(attempt.bulls, 'bull', 'text-mint', 'bg-mint/12'),
    badge(attempt.cows, 'cow', 'text-gold', 'bg-gold/12'),
  );

  card.append(digits, badges);
  return card;
}

/**
 * Creates a bulls or cows badge.
 *
 * @param {number} value
 * @param {'bull' | 'cow'} kind
 * @param {string} tone
 * @param {string} background
 * @returns {HTMLElement}
 */
function badge(value, kind, tone, background) {
  return el(
    'span',
    {
      class: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${tone} ${background}`,
      'data-badge': kind,
      title: kind === 'bull' ? t('game.bulls') : t('game.cows'),
    },
    [
      el('span tnum', { text: String(value) }),
      el('span text-[9px] uppercase tracking-wide opacity-80', {
        text: kind === 'bull' ? 'B' : 'C',
      }),
    ],
  );
}
