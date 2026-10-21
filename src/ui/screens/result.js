/**
 * The result screen.
 *
 * Shown when the game is over. It answers the two questions a player has:
 * *what was the number* and *how did I do*.
 */

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';
import { avatar } from '../avatar.js';
import { mascot, setMascotState } from '../mascot.js';
import { rankedPlayers, starRating } from '../../core/state.js';
import { burstConfetti } from '../confetti.js';

/**
 * Creates the result screen.
 *
 * @param {object} options
 * @param {import('../../core/state.js').GameState} options.state
 * @param {string | null} options.selfId
 * @param {boolean} options.isHost
 * @param {() => void} [options.onRestart]
 * @param {() => void} [options.onHome]
 */
export function createResultScreen({ state, selfId, isHost, onRestart, onHome }) {
  const screen = el('div mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6', {
    'data-screen': 'result',
  });

  const winner = state.players.find((p) => p.id === state.winner);
  const isSelfWinner = state.winner !== null && state.winner === selfId;
  const self = state.players.find((p) => p.id === selfId);

  /* --- hero --- */

  const hero = el('section glass flex flex-col items-center gap-3 p-6 text-center');

  const mascotWrap = el('div', {}, [mascot(isSelfWinner ? 'celebrate' : 'idle', 140)]);
  const mascotNode = /** @type {SVGSVGElement} */ (mascotWrap.firstElementChild);

  const title = el('h1 font-display text-3xl font-extrabold', {
    text:
      state.winner === null
        ? t('result.none')
        : isSelfWinner
          ? t('result.youWon')
          : t('result.won', { name: winner?.name ?? '' }),
  });

  title.classList.add(isSelfWinner ? 'text-mint' : 'text-gold');

  const secretRow = el('div flex items-center gap-2 rounded-2xl bg-violet-deep/50 px-4 py-2', {}, [
    icon('hash', 18),
    el('span tnum text-2xl font-extrabold tracking-[0.3em] text-gold', {
      text: state.secret ?? '----',
      'data-testid': 'secret',
    }),
  ]);

  hero.append(
    mascotWrap,
    title,
    el('p text-sm text-muted', {
      text:
        state.winner === null
          ? t('result.noneHint', { code: state.secret ?? '' })
          : t('result.secret', { code: state.secret ?? '' }),
    }),
    secretRow,
  );

  if (isSelfWinner) {
    hero.classList.add('border-mint/40');
  }

  /* --- your score --- */

  const scoreCard = el('section glass flex flex-col gap-3 p-5');
  scoreCard.append(el('h2 font-display text-lg font-extrabold', { text: t('result.yourScore') }));

  if (self) {
    const rating = starRating(self.points);
    const stars = el('span flex items-center gap-0.5 text-gold', { 'aria-label': `${rating} / 5` });
    for (let i = 0; i < 5; i += 1) {
      stars.append(el('span text-lg', { text: i < rating ? '★' : '☆' }));
    }

    scoreCard.append(
      el('div flex items-center gap-3', {}, [
        avatar(self.avatar, 48),
        el('div flex flex-1 flex-col', {}, [
          el('span text-sm font-bold', { text: self.name }),
          stars,
        ]),
        el('span tnum text-3xl font-extrabold text-gold', {
          text: String(self.points),
          'data-testid': 'final-score',
        }),
      ]),
    );

    scoreCard.append(el('p text-xs leading-relaxed text-faint', { text: t('result.breakdown') }));
  }

  /* --- leaderboard --- */

  const boardCard = el('section glass flex flex-col gap-3 p-5');
  boardCard.append(el('h2 font-display text-lg font-extrabold', { text: t('result.leaderboard') }));

  const list = el('ol flex flex-col gap-2', { 'data-testid': 'final-leaderboard' });

  for (const [index, player] of rankedPlayers(state).entries()) {
    const row = el(
      'li flex items-center gap-2.5 rounded-xl border border-violet/20 bg-panel-soft/50 px-3 py-2',
    );
    if (player.id === selfId) row.classList.add('border-cyan/40');

    row.append(
      el('span tnum w-4 text-center text-xs font-bold text-faint', { text: `${index + 1}` }),
      avatar(player.avatar, 30),
      el('span min-w-0 flex-1 truncate text-sm font-bold', { text: player.name }),
      el('span tnum text-sm font-extrabold text-gold', { text: String(player.points) }),
    );

    if (player.id === state.winner) {
      row.append(icon('crown', 16));
    }

    list.append(row);
  }

  boardCard.append(list);

  /* --- actions --- */

  const actions = el('div flex flex-col gap-2');

  if (isHost) {
    const again = el(
      'button w-full rounded-2xl bg-mint px-5 py-3 text-base font-extrabold text-void transition-transform active:scale-[0.98]',
      { type: 'button', 'data-action': 'play-again' },
      [t('result.newRound')],
    );
    again.addEventListener('click', () => onRestart?.());
    actions.append(again);
  }

  const home = el(
    'button w-full rounded-2xl bg-panel-soft px-5 py-3 text-base font-extrabold text-text transition-transform active:scale-[0.98]',
    { type: 'button', 'data-action': 'back-home' },
    [t('result.backHome')],
  );
  home.addEventListener('click', () => onHome?.());
  actions.append(home);

  screen.append(hero, scoreCard, boardCard, actions);

  if (isSelfWinner) {
    burstConfetti();
  }

  return {
    element: screen,
    /**
     * Swaps the mascot's expression.
     *
     * @param {'idle' | 'celebrate' | 'sad'} expression
     */
    setMascot(expression) {
      setMascotState(mascotNode, expression);
    },
  };
}
