/**
 * The game screen.
 *
 * Mobile-first: the turn banner and the keypad sit at the top where the
 * thumbs are, and the rest of the information is behind a bottom tab bar.
 * On a wide screen the tab bar disappears and all three columns are visible
 * at once, which is the layout in the reference design.
 */

import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { mascot, setMascotState } from '../mascot.js';
import { t } from '../../i18n/index.js';
import { createPlayerCard } from '../components/player-card.js';
import { createGuessPanel } from '../components/guess-panel.js';
import { createAttemptsBoard, renderAttempts } from '../components/attempts.js';
import { createLeaderboard, renderLeaderboard } from '../components/leaderboard.js';
import { createChat } from '../components/chat.js';

/** @typedef {'players' | 'history' | 'chat'} GameTab */

/**
 * Creates the game screen.
 *
 * @param {object} options
 * @param {import('../../core/state.js').GameState} options.state
 * @param {string | null} options.selfId
 * @param {(digits: string) => void} options.onGuess
 * @param {(text: string) => void} options.onChat
 */
export function createGameScreen({ state, selfId, onGuess, onChat }) {
  const screen = el('div.flex.w-full.flex-1.flex-col', { 'data-screen': 'game' });

  /* --- turn banner --- */

  const banner = el(
    'div.glass.flex.items-center.gap-3.rounded-none.border-x-0.border-t-0.px-4.py-3',
    { 'data-testid': 'turn-banner' },
  );

  const bannerIcon = el('span.shrink-0.text-mint');
  const bannerText = el('p.font-display.text-lg.font-extrabold', { 'data-testid': 'turn-text' });
  const bannerSub = el('p.text-xs.text-muted');

  const bannerBody = el('div.min-w-0.flex-1', {}, [bannerText, bannerSub]);
  banner.append(bannerIcon, bannerBody);

  /* --- the centre column --- */

  const centre = el('div.mx-auto.flex.w-full.max-w-md.flex-col.gap-3.px-4.py-4');

  const mascotWrap = el('div.flex.justify-center', {}, [mascot('idle', 130)]);
  const mascotNode = /** @type {SVGSVGElement} */ (mascotWrap.firstElementChild);

  const guessPanel = createGuessPanel({
    digitCount: state.rules.digits,
    enabled: false,
    onSubmit: onGuess,
  });

  centre.append(mascotWrap, guessPanel.element);

  /* --- panels --- */

  const playersCard = el('section.glass.flex.flex-col.gap-3.p-4');
  playersCard.append(el('h2.font-display.text-lg.font-extrabold', { text: t('lobby.players') }));
  const playerList = el('div.flex.flex-col.gap-2', { 'data-testid': 'player-list' });
  playersCard.append(playerList);

  const historyCard = el('section.glass.flex.flex-col.p-4');
  const attempts = createAttemptsBoard({ state, selfId });
  historyCard.append(attempts);

  const leaderboardCard = el('section.glass.flex.flex-col.p-4');
  const leaderboard = createLeaderboard({ state, selfId });
  leaderboardCard.append(leaderboard);

  const chat = createChat({ onSend: onChat });
  const chatCard = el('section.glass.flex.flex-col.p-4', {}, [chat.element]);

  const panels = {
    players: el('div.flex.flex-col.gap-4', { 'data-panel': 'players' }, [playersCard]),
    history: el('div.flex.flex-col.gap-4', { 'data-panel': 'history' }, [
      historyCard,
      leaderboardCard,
    ]),
    chat: el('div.flex.flex-col.gap-4', { 'data-panel': 'chat' }, [chatCard]),
  };

  /* --- tab bar --- */

  const tabBar = el(
    'div.glass.sticky.bottom-0.z-20.grid.grid-cols-3.gap-1.rounded-none.border-x-0.border-b-0.p-2.lg:hidden',
    { role: 'tablist', 'data-testid': 'tab-bar' },
  );

  /** @type {GameTab} */
  let activeTab = 'players';

  /** @type {Map<GameTab, HTMLElement>} */
  const tabButtons = new Map();

  /** @type {{ id: GameTab, label: string, iconName: 'users' | 'hash' | 'sparkle' }[]} */
  const tabData = [
    { id: 'players', label: t('lobby.players'), iconName: 'users' },
    { id: 'history', label: t('game.history'), iconName: 'hash' },
    { id: 'chat', label: t('lobby.chat'), iconName: 'sparkle' },
  ];

  for (const tab of tabData) {
    const button = el(
      'button.flex.flex-col.items-center.gap-0.5.rounded-xl.px-2.py-1.5.text-[11px].font-bold.transition-colors',
      {
        type: 'button',
        role: 'tab',
        'aria-selected': 'false',
        'data-tab': tab.id,
      },
      [icon(tab.iconName, 20), el('span', { text: tab.label })],
    );

    button.addEventListener('click', () => setActiveTab(tab.id));
    tabButtons.set(tab.id, button);
    tabBar.append(button);
  }

  const applyTabVisibility = () => {
    for (const [id, panel] of Object.entries(panels)) {
      const isActive = id === activeTab;
      // Below the large breakpoint only the active tab is shown. From the
      // large breakpoint up, every panel is visible at once.
      panel.classList.toggle('max-lg:hidden', !isActive);
    }
    for (const [id, button] of tabButtons) {
      const isActive = id === activeTab;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.classList.toggle('bg-violet', isActive);
      button.classList.toggle('text-text', isActive);
      button.classList.toggle('text-muted', !isActive);
    }
  };

  /**
   * @param {GameTab} tab
   */
  function setActiveTab(tab) {
    activeTab = tab;
    applyTabVisibility();
  }

  applyTabVisibility();

  /* --- layout --- */

  const body = el(
    'div.mx-auto.grid.w-full.max-w-7xl.flex-1.gap-4.px-4.pb-4.lg:grid-cols-[17rem_minmax(0,1fr)_20rem]',
    {},
    [
      el('div.flex.flex-col.gap-4', {}, [panels.players, panels.chat]),
      centre,
      el('div.flex.flex-col.gap-4', {}, [panels.history]),
    ],
  );

  screen.append(banner, body, tabBar);

  /* --- rendering --- */

  let current = state;

  const render = () => {
    clear(playerList);
    for (const player of current.players) {
      playerList.append(
        createPlayerCard(player, {
          isSelf: player.id === selfId,
          isTurn: current.turn === player.id,
          maxAttempts: current.rules.attempts,
        }),
      );
    }

    renderAttempts(
      /** @type {HTMLElement} */ (attempts.querySelector('[data-testid="attempts-rail"]')),
      current,
      selfId,
    );
    renderLeaderboard(
      /** @type {HTMLElement} */ (leaderboard.querySelector('[data-testid="leaderboard-list"]')),
      current,
      selfId,
    );
  };

  render();

  return {
    element: screen,

    /**
     * Updates the screen with a new state.
     *
     * @param {import('../../core/state.js').GameState} nextState
     */
    update(nextState) {
      current = nextState;

      const isMyTurn = nextState.turn === selfId && nextState.phase === 'playing';
      guessPanel.setEnabled(isMyTurn);

      const turnPlayer = nextState.players.find((p) => p.id === nextState.turn);

      clear(bannerIcon);
      clear(bannerText);
      clear(bannerSub);

      if (nextState.phase === 'finished') {
        bannerIcon.append(icon('trophy', 22));
        bannerIcon.className = 'shrink-0 text-gold';
        bannerText.textContent = t('result.youWon');
        bannerSub.textContent = t('game.attempts');
        setMascotState(mascotNode, 'celebrate');
      } else if (isMyTurn) {
        bannerIcon.append(icon('sparkle', 22));
        bannerIcon.className = 'shrink-0 text-mint';
        bannerText.textContent = t('game.turn');
        bannerSub.textContent = t('game.enter', { n: nextState.rules.digits });
        setMascotState(mascotNode, 'idle');
      } else {
        bannerIcon.append(icon('clock', 22));
        bannerIcon.className = 'shrink-0 text-cyan';
        bannerText.textContent = turnPlayer
          ? t('game.turnOther', { name: turnPlayer.name })
          : t('game.waiting', { name: '' });
        bannerSub.textContent = t('game.tip');
        setMascotState(mascotNode, 'thinking');
      }

      render();
    },

    /**
     * Appends a chat message.
     *
     * @param {import('../components/chat.js').ChatEntry} entry
     */
    appendChat(entry) {
      chat.append(entry);
    },

    /**
     * Switches the visible tab.
     *
     * @param {GameTab} tab
     */
    setTab(tab) {
      setActiveTab(tab);
    },

    /**
     * Reacts to a guess being made.
     *
     * @param {{ bulls: number, cows: number, won: boolean }} outcome
     */
    announceOutcome(outcome) {
      if (outcome.won) {
        setMascotState(mascotNode, 'celebrate');
      }
    },
  };
}
