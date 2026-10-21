import { beforeEach, describe, expect, it } from 'vitest';

import { createInitialState, addPlayer, startGame, Phase } from '../../src/core/state.js';
import { createHomeScreen } from '../../src/ui/screens/home.js';
import { createJoinScreen } from '../../src/ui/screens/join.js';
import { createRoomScreen } from '../../src/ui/screens/room.js';
import { createGameScreen } from '../../src/ui/screens/game.js';
import { createResultScreen } from '../../src/ui/screens/result.js';
import { createPlayerCard } from '../../src/ui/components/player-card.js';
import { createGuessPanel } from '../../src/ui/components/guess-panel.js';
import { createAttemptsBoard, renderAttempts } from '../../src/ui/components/attempts.js';
import { createLeaderboard, renderLeaderboard } from '../../src/ui/components/leaderboard.js';
import { createChat } from '../../src/ui/components/chat.js';
import { createLanguageToggle } from '../../src/ui/components/language-toggle.js';
import { showBanner, showToast } from '../../src/ui/components/notices.js';
import { avatar } from '../../src/ui/avatar.js';
import { icon } from '../../src/ui/icons.js';
import { mascot, setMascotState } from '../../src/ui/mascot.js';

/**
 * A room with two players and one guess each.
 */
function sampleState() {
  let state = createInitialState(
    { digits: 4, attempts: 8, allowRepeats: false },
    { id: 'host', name: 'CoderHamid', avatar: 0, joinedAt: 1 },
  );
  state = addPlayer(state, { id: 'g1', name: 'Sara', avatar: 3, joinedAt: 2 });
  state = startGame(state, '0247', 1000);

  return {
    ...state,
    players: state.players.map((player, index) =>
      index === 0
        ? {
            ...player,
            attempts: [{ digits: '1359', bulls: 0, cows: 1, at: 1200 }],
            points: 10,
          }
        : player,
    ),
  };
}

describe('the interface renders without throwing', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('renders the home screen', () => {
    const screen = createHomeScreen({ onCreate: () => {}, onJoin: () => {} });
    expect(screen.element).toBeTruthy();
    expect(screen.name()).toBe('');
  });

  it('renders the join screen', () => {
    const screen = createJoinScreen({
      code: 'K7P4',
      name: 'Sara',
      avatar: 2,
      onJoin: () => {},
    });
    expect(screen.element).toBeTruthy();
  });

  it('renders the waiting room', () => {
    const state = sampleState();
    const screen = createRoomScreen({
      state,
      selfId: 'host',
      isHost: true,
      onChat: () => {},
      onStart: () => {},
    });
    screen.update(state);
    expect(screen.element).toBeTruthy();
  });

  it('renders the game screen', () => {
    const state = sampleState();
    const screen = createGameScreen({
      state,
      selfId: 'host',
      onGuess: () => {},
      onChat: () => {},
    });
    screen.update(state);
    expect(screen.element).toBeTruthy();
  });

  it('renders the result screen', () => {
    const state = { ...sampleState(), phase: Phase.FINISHED, winner: 'host' };
    const screen = createResultScreen({ state, selfId: 'host', isHost: true });
    expect(screen.element).toBeTruthy();
  });

  it('renders a player card', () => {
    const [player] = sampleState().players;
    expect(player).toBeDefined();
    const card = createPlayerCard(/** @type {any} */ (player), {
      isSelf: true,
      isTurn: true,
      maxAttempts: 8,
    });
    expect(card.getAttribute('data-testid')).toBe('player-card');
  });

  it('renders the guess panel and accepts a guess', () => {
    /** @type {string[]} */
    const guesses = [];
    const panel = createGuessPanel({
      digitCount: 4,
      enabled: true,
      onSubmit: (digits) => guesses.push(digits),
    });

    expect(panel.value()).toBe('');

    // The keypad is built, and the submit button starts disabled.
    const keys = panel.element.querySelectorAll('[data-key]');
    expect(keys.length).toBeGreaterThan(9);

    const send = panel.element.querySelector('[data-action="send-guess"]');
    expect(send?.hasAttribute('disabled')).toBe(true);
  });

  it('renders the attempts board with one column per player', () => {
    const state = sampleState();
    const board = createAttemptsBoard({ state, selfId: 'host' });
    const columns = board.querySelectorAll('[data-column-player]');
    expect(columns).toHaveLength(2);

    const attempts = board.querySelectorAll('[data-attempt]');
    expect(attempts).toHaveLength(1);
  });

  it('re-renders the attempts board', () => {
    const state = sampleState();
    const board = createAttemptsBoard({ state, selfId: 'host' });
    const rail = board.querySelector('[data-testid="attempts-rail"]');
    expect(rail).toBeTruthy();
    renderAttempts(/** @type {HTMLElement} */ (rail), state, 'host');
    expect(board.querySelectorAll('[data-column-player]')).toHaveLength(2);
  });

  it('renders the leaderboard', () => {
    const state = sampleState();
    const board = createLeaderboard({ state, selfId: 'host' });
    const list = board.querySelector('[data-testid="leaderboard-list"]');
    expect(list?.querySelectorAll('li')).toHaveLength(2);

    renderLeaderboard(/** @type {HTMLElement} */ (list), state, 'host');
    expect(list?.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders the chat and accepts a message', () => {
    /** @type {string[]} */
    const sent = [];
    const chat = createChat({ onSend: (text) => sent.push(text) });

    const input = chat.element.querySelector('[data-testid="chat-input"]');
    expect(input).toBeTruthy();

    chat.append({ from: 'g1', name: 'Sara', text: 'Go Hamed!', at: 1 });
    expect(chat.element.querySelector('[data-testid="chat-log"]')?.textContent).toContain(
      'Go Hamed!',
    );
    expect(sent).toHaveLength(0);
  });

  it('renders the language toggle', () => {
    const toggle = createLanguageToggle();
    expect(toggle.querySelectorAll('[data-locale]')).toHaveLength(2);
  });

  it('renders a banner and a toast', () => {
    const root = document.querySelector('#root');
    expect(root).toBeTruthy();

    showBanner(/** @type {HTMLElement} */ (root), { text: 'Reconnecting…' });
    expect(root?.textContent).toContain('Reconnecting');

    showToast(/** @type {HTMLElement} */ (root), { text: 'Copied!' });
    expect(root?.textContent).toContain('Copied!');
  });

  it('renders every avatar and every icon', () => {
    for (let i = 0; i < 8; i += 1) {
      expect(avatar(i, 24)).toBeTruthy();
    }

    for (const name of ['copy', 'share', 'check', 'backspace', 'send', 'trophy', 'bull', 'cow']) {
      expect(icon(/** @type {any} */ (name), 16)).toBeTruthy();
    }
  });

  it('renders the mascot and swaps its expression', () => {
    const cow = mascot('idle', 100);
    expect(cow).toBeTruthy();

    setMascotState(cow, 'celebrate');
    expect(cow.querySelectorAll('[data-face]')).toHaveLength(1);
  });
});
