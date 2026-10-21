/**
 * A player row.
 *
 * Shows who is in the room, whose turn it is, how many attempts they have
 * left, and how many points they have.
 */

import { el } from '../dom.js';
import { avatar } from '../avatar.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';
import { PlayerStatus } from '../../core/state.js';

/**
 * Creates a player card.
 *
 * @param {import('../../core/state.js').Player} player
 * @param {object} options
 * @param {boolean} options.isSelf
 * @param {boolean} options.isTurn
 * @param {number} options.maxAttempts
 * @returns {HTMLElement}
 */
export function createPlayerCard(player, { isSelf, isTurn, maxAttempts }) {
  const isActive = player.status === PlayerStatus.ACTIVE;

  const card = el(
    'div flex items-center gap-3 rounded-2xl border border-violet/25 bg-panel-soft/60 px-3 py-2.5 transition-colors',
    {
      'data-testid': 'player-card',
      'data-player-id': player.id,
      'data-status': player.status,
    },
  );

  if (isTurn && isActive) {
    card.classList.add('glass-lit', 'border-mint/60');
  }
  if (!isActive) {
    card.classList.add('opacity-55');
  }

  const avatarWrap = el('div relative', {}, [avatar(player.avatar, 40)]);
  if (isTurn && isActive) {
    avatarWrap.append(
      el(
        'span absolute -end-1 -bottom-1 h-3 w-3 rounded-full bg-mint shadow-[0_0_10px_var(--color-mint)]',
        {
          'aria-hidden': 'true',
        },
      ),
    );
  }
  card.append(avatarWrap);

  // The name gets the whole first line, so it is never truncated by a badge.
  const badges = el('div flex items-center gap-1');

  if (player.isHost) {
    badges.append(
      el(
        'span inline-flex items-center gap-0.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold',
        {
          'data-testid': 'player-role',
        },
        [icon('crown', 11), el('span', { text: t('common.host') })],
      ),
    );
  }

  if (isSelf) {
    badges.append(
      el('span rounded-full bg-cyan/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan', {
        text: t('common.you'),
      }),
    );
  }

  const statusText = describeStatus(player, isTurn, maxAttempts);
  const status = el('p text-xs', {
    text: statusText.text,
    class: `text-xs ${statusText.tone}`,
  });

  const points = el('span tnum text-xs font-bold text-gold', {
    text: String(player.points),
    'data-testid': 'player-points',
  });

  const topRow = el('div flex items-center gap-2', {}, [
    el('span min-w-0 flex-1 truncate text-sm font-bold', {
      text: player.name,
      'data-testid': 'player-name',
    }),
    points,
    el('span text-[10px] text-faint', { text: t('game.points') }),
  ]);

  const bottomRow = el('div mt-0.5 flex items-center gap-1.5', {}, [status, badges]);

  card.append(el('div min-w-0 flex-1', {}, [topRow, bottomRow]));
  return card;
}

/**
 * Describes a player's status in one short phrase.
 *
 * @param {import('../../core/state.js').Player} player
 * @param {boolean} isTurn
 * @param {number} maxAttempts
 * @returns {{ text: string, tone: string }}
 */
function describeStatus(player, isTurn, maxAttempts) {
  switch (player.status) {
    case PlayerStatus.WON:
      return { text: t('result.won', { name: player.name }), tone: 'text-mint font-bold' };
    case PlayerStatus.ELIMINATED:
      return { text: t('lobby.eliminated'), tone: 'text-rose font-semibold' };
    case PlayerStatus.DISCONNECTED:
      return { text: t('lobby.reconnecting'), tone: 'text-gold font-semibold' };
    default:
      break;
  }

  if (isTurn) {
    return { text: t('game.turn'), tone: 'text-mint font-bold' };
  }

  const remaining = Math.max(0, maxAttempts - player.attempts.length);
  return { text: t('game.remaining', { n: remaining }), tone: 'text-muted' };
}
