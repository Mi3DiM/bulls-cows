/**
 * The leaderboard.
 *
 * A live ranking with points and a star rating. The stars are presentation
 * only — the order comes from the points, then the fewest attempts, then the
 * join order.
 */

import { el, clear } from '../dom.js';
import { avatar } from '../avatar.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';
import { rankedPlayers, starRating } from '../../core/state.js';

/**
 * Creates the leaderboard.
 *
 * @param {object} options
 * @param {import('../../core/state.js').GameState} options.state
 * @param {string | null} options.selfId
 * @returns {HTMLElement}
 */
export function createLeaderboard({ state, selfId }) {
  const board = el('section flex flex-col gap-3', { 'data-testid': 'leaderboard' });

  board.append(
    el('div flex items-center gap-2', {}, [
      icon('trophy', 18),
      el('h2 font-display text-lg font-extrabold', { text: t('game.leaderboard') }),
    ]),
  );

  const list = el('ol flex flex-col gap-2', { 'data-testid': 'leaderboard-list' });
  board.append(list);

  renderLeaderboard(list, state, selfId);
  return board;
}

/**
 * Renders the leaderboard.
 *
 * @param {HTMLElement} list
 * @param {import('../../core/state.js').GameState} state
 * @param {string | null} selfId
 */
export function renderLeaderboard(list, state, selfId) {
  clear(list);

  const ranked = rankedPlayers(state);

  ranked.forEach((player, index) => {
    const isSelf = player.id === selfId;
    const rating = starRating(player.points);

    const row = el(
      'li flex items-center gap-2.5 rounded-xl border border-violet/20 bg-panel-soft/50 px-3 py-2',
      { 'data-rank': String(index + 1) },
    );

    if (isSelf) {
      row.classList.add('border-cyan/40');
    }

    row.append(
      el('span tnum w-4 text-center text-xs font-bold text-faint', { text: `${index + 1}` }),
      avatar(player.avatar, 30),
      el('span min-w-0 flex-1 truncate text-sm font-bold', { text: player.name }),
      el('span flex items-center gap-0.5 text-gold', { 'aria-label': `${rating} / 5` }, [
        el('span tnum text-sm font-extrabold', { text: String(player.points) }),
        el('span text-[10px] opacity-80', { text: '★' }),
      ]),
    );

    if (index === 0 && player.status === 'won') {
      row.append(icon('crown', 16));
    }

    list.append(row);
  });
}
