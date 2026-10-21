/**
 * The waiting room.
 *
 * Shown after the Host creates a room and before the game starts. It holds
 * the share controls, the rules, the player list and the chat, so the Host
 * can get everyone in before starting.
 */

import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../i18n/index.js';
import { createPlayerCard } from '../components/player-card.js';
import { createChat } from '../components/chat.js';

/**
 * Creates the waiting room.
 *
 * @param {object} options
 * @param {import('../../core/state.js').GameState} options.state
 * @param {string | null} options.selfId
 * @param {boolean} options.isHost
 * @param {(text: string) => void} options.onChat
 * @param {() => void} options.onStart
 * @param {() => void} [options.onCopy]
 * @param {() => void} [options.onShare]
 */
export function createRoomScreen({ state, selfId, isHost, onChat, onStart, onCopy, onShare }) {
  const screen = el('div.mx-auto.flex.w-full.max-w-4xl.flex-col.gap-4.px-4.py-4', {
    'data-screen': 'room',
  });

  /* --- header --- */

  const header = el('header.glass.flex.flex-col.items-center.gap-3.p-5.text-center', {}, [
    el('p.text-xs.font-bold.uppercase.tracking-widest.text-muted', { text: t('create.codeLabel') }),
    el('p.tnum.animate-pop-in.text-5xl.font-extrabold.tracking-[0.35em].text-mint.sm:text-6xl', {
      text: state ? '' : '',
      'data-testid': 'big-room-code',
    }),
    el('p.text-sm.text-muted', { text: t('create.waitingHint') }),
  ]);

  const shareRow = el('div.flex.flex-wrap.justify-center.gap-2');

  const copyButton = el(
    'button.inline-flex.h-11.items-center.gap-2.rounded-xl.bg-violet-deep/70.px-4.text-sm.font-bold.text-text.transition-colors.hover:bg-violet',
    { type: 'button', 'data-action': 'copy-link' },
    [icon('copy', 18), el('span', { text: t('create.copyLink') })],
  );
  copyButton.addEventListener('click', () => onCopy?.());

  const shareButton = el(
    'button.inline-flex.h-11.items-center.gap-2.rounded-xl.bg-panel-soft.px-4.text-sm.font-bold.text-text.transition-colors.hover:bg-violet-deep',
    { type: 'button', 'data-action': 'share' },
    [icon('share', 18), el('span', { text: t('create.share') })],
  );
  shareButton.addEventListener('click', () => onShare?.());

  shareRow.append(copyButton, shareButton);
  header.append(shareRow);

  /* --- the grid --- */

  const grid = el('div.grid.gap-4.lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');

  /* players */

  const playersCard = el('section.glass.flex.flex-col.gap-3.p-4');
  playersCard.append(el('h2.font-display.text-lg.font-extrabold', { text: t('lobby.players') }));

  const playerList = el('div.flex.flex-col.gap-2', { 'data-testid': 'player-list' });
  playersCard.append(playerList);

  const startButton = el(
    'button.mt-1.w-full.rounded-2xl.bg-mint.px-5.py-3.text-base.font-extrabold.text-void.transition-transform.active:scale-[0.98]',
    { type: 'button', 'data-action': 'start-game' },
    [t('lobby.start')],
  );
  startButton.addEventListener('click', () => onStart());

  const waitingNote = el('p.text-center.text-sm.text-muted', { text: t('create.waiting') });

  if (isHost) {
    playersCard.append(startButton);
    playersCard.append(
      el('p.text-center.text-[11px].leading-relaxed.text-faint', { text: t('create.hostNote') }),
    );
  } else {
    playersCard.append(waitingNote);
  }

  /* chat */

  const chat = createChat({ onSend: onChat });
  const chatCard = el('section.glass.flex.flex-col.p-4', {}, [chat.element]);

  grid.append(playersCard, chatCard);

  screen.append(header, grid);

  return {
    element: screen,
    /**
     * Updates the room.
     *
     * @param {import('../../core/state.js').GameState} nextState
     */
    update(nextState) {
      clear(playerList);
      for (const player of nextState.players) {
        playerList.append(
          createPlayerCard(player, {
            isSelf: player.id === selfId,
            isTurn: nextState.turn === player.id,
            maxAttempts: nextState.rules.attempts,
          }),
        );
      }
    },
    /**
     * Appends a chat message.
     *
     * @param {import('../components/chat.js').ChatEntry} entry
     */
    appendChat(entry) {
      chat.append(entry);
    },
  };
}
