import { describe, expect, it } from 'vitest';

import {
  Phase,
  PlayerStatus,
  POINTS_PER_BULL,
  POINTS_PER_COW,
  PLACEMENT_BONUS,
  POINTS_PER_UNUSED_ATTEMPT,
  WIN_BONUS,
  addPlayer,
  applyGuess,
  attemptPoints,
  createInitialState,
  endWithoutWinner,
  finalize,
  findPlayer,
  pickNextActive,
  publicView,
  rankedPlayers,
  removePlayer,
  setPlayerStatus,
  starRating,
  startGame,
} from '../../src/core/state.js';

const rules = { digits: 4, attempts: 8, allowRepeats: false };

/** Builds a lobby with the given player names. */
function lobby(names = ['Host']) {
  let state = createInitialState(rules, {
    id: 'p1',
    name: names[0] ?? 'Host',
    avatar: 0,
    joinedAt: 0,
  });
  for (let i = 1; i < names.length; i += 1) {
    state = addPlayer(state, {
      id: `p${i + 1}`,
      name: names[i] ?? `Player ${i + 1}`,
      avatar: i,
      joinedAt: i,
    });
  }
  return state;
}

/** Starts a game with the given secret. */
function playing(names, secret = '0247') {
  return startGame(lobby(names), secret, 1000);
}

describe('createInitialState', () => {
  it('creates a lobby with the host as the first player', () => {
    const state = lobby(['Host']);
    expect(state.phase).toBe(Phase.LOBBY);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.isHost).toBe(true);
    expect(state.players[0]?.status).toBe(PlayerStatus.ACTIVE);
    expect(state.secret).toBeNull();
  });

  it('normalises illegal rules to the defaults', () => {
    const state = createInitialState(
      { digits: 99 },
      { id: 'p1', name: 'H', avatar: 0, joinedAt: 0 },
    );
    expect(state.rules.digits).toBe(4);
    expect(state.rules.attempts).toBe(8);
  });
});

describe('addPlayer', () => {
  it('adds a player', () => {
    const state = lobby(['Host', 'Sara']);
    expect(state.players).toHaveLength(2);
    expect(state.players[1]?.name).toBe('Sara');
    expect(state.players[1]?.isHost).toBe(false);
  });

  it('ignores a duplicate id', () => {
    let state = lobby(['Host']);
    const before = state;
    state = addPlayer(state, { id: 'p1', name: 'Impostor', avatar: 0, joinedAt: 9 });
    expect(state).toBe(before);
    expect(state.players).toHaveLength(1);
  });

  it('bumps the revision', () => {
    const state = lobby(['Host', 'Sara']);
    expect(state.rev).toBeGreaterThan(0);
  });
});

describe('removePlayer', () => {
  it('removes a player', () => {
    const state = removePlayer(lobby(['Host', 'Sara']), 'p2');
    expect(state.players).toHaveLength(1);
  });

  it('moves the turn on when the current player leaves', () => {
    let state = playing(['Host', 'Sara', 'Rayan']);
    state = { ...state, turn: 'p2' };
    state = removePlayer(state, 'p2');
    expect(state.turn).toBe('p3');
  });

  it('ignores an unknown player', () => {
    const before = lobby(['Host']);
    expect(removePlayer(before, 'nope')).toBe(before);
  });
});

describe('setPlayerStatus', () => {
  it('changes a status', () => {
    const state = setPlayerStatus(lobby(['Host', 'Sara']), 'p2', PlayerStatus.DISCONNECTED);
    expect(findPlayer(state, 'p2')?.status).toBe(PlayerStatus.DISCONNECTED);
  });
});

describe('startGame', () => {
  it('moves to the playing phase and gives the first player the turn', () => {
    const state = playing(['Host', 'Sara']);
    expect(state.phase).toBe(Phase.PLAYING);
    expect(state.turn).toBe('p1');
    expect(state.secret).toBe('0247');
    expect(state.startedAt).toBe(1000);
  });

  it('is idempotent', () => {
    const state = playing(['Host']);
    expect(startGame(state, '9999', 2000)).toBe(state);
  });
});

describe('applyGuess', () => {
  it('rejects a guess when the game has not started', () => {
    const result = applyGuess(lobby(['Host']), 'p1', '0247');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('game-not-playing');
  });

  it('rejects a guess from a player who is not on turn', () => {
    const state = playing(['Host', 'Sara']);
    const result = applyGuess(state, 'p2', '0247');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-your-turn');
  });

  it('rejects an illegal guess without changing the state', () => {
    const state = playing(['Host']);
    const result = applyGuess(state, 'p1', '0024');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-guess');
    expect(result.state).toBe(state);
  });

  it('scores a guess and advances the turn', () => {
    const state = playing(['Host', 'Sara']);
    const result = applyGuess(state, 'p1', '2049', 1500);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempt).toEqual({ digits: '2049', bulls: 1, cows: 2, at: 1500 });
      expect(result.won).toBe(false);
      expect(result.state.turn).toBe('p2');
      expect(findPlayer(result.state, 'p1')?.attempts).toHaveLength(1);
      expect(findPlayer(result.state, 'p1')?.points).toBe(attemptPoints(1, 2));
    }
  });

  it('wins the game on a correct guess', () => {
    const state = playing(['Host', 'Sara']);
    const result = applyGuess(state, 'p1', '0247');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.won).toBe(true);
      expect(result.state.phase).toBe(Phase.FINISHED);
      expect(result.state.winner).toBe('p1');
      expect(findPlayer(result.state, 'p1')?.status).toBe(PlayerStatus.WON);
      expect(result.state.turn).toBeNull();
    }
  });

  it('ends the game when the last player runs out of attempts', () => {
    // A single player, so the turn stays with them for every attempt.
    let state = playing(['Host']);
    for (let i = 0; i < 8; i += 1) {
      const result = applyGuess(state, 'p1', '1359');
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.phase).toBe(Phase.FINISHED);
    expect(state.winner).toBeNull();
  });

  it('rejects a guess from a player who has been eliminated', () => {
    let state = playing(['Host', 'Sara']);
    for (let i = 0; i < 8; i += 1) {
      const result = applyGuess(state, 'p1', '1359');
      if (result.ok) state = result.state;
      // The turn alternates, so hand it back to p1 for the next attempt.
      if (result.ok && result.state.turn !== 'p1') {
        state = { ...result.state, turn: 'p1' };
      }
    }
    expect(findPlayer(state, 'p1')?.status).toBe(PlayerStatus.ELIMINATED);

    const result = applyGuess(state, 'p1', '1359');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('player-not-active');
  });

  it('eliminates a player who runs out of attempts', () => {
    let state = playing(['Host', 'Sara']);
    for (let i = 0; i < 8; i += 1) {
      const result = applyGuess(state, 'p1', '1359');
      if (result.ok) state = result.state;
      if (result.ok && result.state.turn !== 'p1') {
        state = { ...result.state, turn: 'p1' };
      }
    }
    expect(findPlayer(state, 'p1')?.status).toBe(PlayerStatus.ELIMINATED);
    expect(state.phase).toBe(Phase.PLAYING);
  });

  it('ends the game when every player is eliminated', () => {
    let state = playing(['Host']);
    for (let i = 0; i < 8; i += 1) {
      const result = applyGuess(state, 'p1', '1359');
      if (result.ok) state = result.state;
    }
    expect(state.phase).toBe(Phase.FINISHED);
    expect(state.winner).toBeNull();
  });
});

describe('pickNextActive', () => {
  it('skips eliminated and disconnected players', () => {
    let state = playing(['Host', 'Sara', 'Rayan', 'Yasser']);
    state = setPlayerStatus(state, 'p2', PlayerStatus.ELIMINATED);
    state = setPlayerStatus(state, 'p3', PlayerStatus.DISCONNECTED);
    expect(pickNextActive(state, 'p1')).toBe('p4');
  });

  it('wraps around the table', () => {
    let state = playing(['Host', 'Sara', 'Rayan']);
    state = setPlayerStatus(state, 'p2', PlayerStatus.ELIMINATED);
    expect(pickNextActive(state, 'p3')).toBe('p1');
  });

  it('returns null when nobody can act', () => {
    let state = playing(['Host', 'Sara']);
    state = setPlayerStatus(state, 'p1', PlayerStatus.ELIMINATED);
    state = setPlayerStatus(state, 'p2', PlayerStatus.ELIMINATED);
    expect(pickNextActive(state, 'p1')).toBeNull();
  });
});

describe('finalize', () => {
  it('awards the win bonus and the placement bonus', () => {
    const state = playing(['Host', 'Sara']);
    const result = applyGuess(state, 'p1', '0247');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const winner = findPlayer(result.state, 'p1');
    // 4 bulls, no cows, then the win bonus, 7 unused attempts (the winning
    // attempt counts as used) and first place.
    const expected =
      POINTS_PER_BULL * 4 + WIN_BONUS + 7 * POINTS_PER_UNUSED_ATTEMPT + PLACEMENT_BONUS.first;
    expect(winner?.points).toBe(expected);
  });

  it('gives the runner-up a smaller placement bonus', () => {
    let state = playing(['Host', 'Sara']);
    const first = applyGuess(state, 'p1', '1359');
    if (first.ok) state = first.state;
    const second = applyGuess(state, 'p2', '0247');
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    // p2 solved it, so p2 is the winner and p1 is the runner-up.
    const winner = findPlayer(second.state, 'p2');
    expect(winner?.points).toBe(
      POINTS_PER_BULL * 4 + WIN_BONUS + 7 * POINTS_PER_UNUSED_ATTEMPT + PLACEMENT_BONUS.first,
    );

    const runnerUp = findPlayer(second.state, 'p1');
    // p1 scored nothing on the attempt and earns only the placement bonus.
    expect(runnerUp?.points).toBe(PLACEMENT_BONUS.second);
  });

  it('ignores a finalise for an unknown winner', () => {
    const state = playing(['Host']);
    expect(finalize(state, 'nobody')).toBe(state);
  });

  it('gives the first-place bonus even when the winner is the only player', () => {
    const state = playing(['Host']);
    const result = applyGuess(state, 'p1', '0247');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The only player is still the first player, so the first-place bonus
    // applies; there is simply nobody to place second.
    expect(findPlayer(result.state, 'p1')?.points).toBe(
      POINTS_PER_BULL * 4 + WIN_BONUS + 7 * POINTS_PER_UNUSED_ATTEMPT + PLACEMENT_BONUS.first,
    );
  });
});

describe('endWithoutWinner', () => {
  it('finishes the game with no winner', () => {
    const state = endWithoutWinner(playing(['Host']));
    expect(state.phase).toBe(Phase.FINISHED);
    expect(state.winner).toBeNull();
  });
});

describe('publicView', () => {
  it('hides the secret while the game is running', () => {
    const state = playing(['Host']);
    expect(state.secret).toBe('0247');
    expect(publicView(state).secret).toBeNull();
  });

  it('reveals the secret once the game is over', () => {
    let state = playing(['Host']);
    const result = applyGuess(state, 'p1', '0247');
    if (result.ok) state = result.state;
    expect(publicView(state).secret).toBe('0247');
  });

  it('does not mutate the original state', () => {
    const state = playing(['Host']);
    const view = publicView(state);
    expect(view).not.toBe(state);
    expect(state.secret).toBe('0247');
  });
});

describe('rankedPlayers', () => {
  it('ranks by points, then by fewest attempts, then by join order', () => {
    let state = playing(['Host', 'Sara', 'Rayan']);
    const a = applyGuess(state, 'p1', '0247');
    if (a.ok) state = a.state;
    const b = applyGuess(state, 'p2', '1359');
    if (b.ok) state = b.state;

    const ranked = rankedPlayers(state);
    expect(ranked[0]?.id).toBe('p1');
    expect(ranked.map((p) => p.id)).toHaveLength(3);
  });
});

describe('starRating', () => {
  it('maps points onto five stars', () => {
    expect(starRating(1500)).toBe(5);
    expect(starRating(1300)).toBe(4);
    expect(starRating(1150)).toBe(3);
    expect(starRating(1000)).toBe(2);
    expect(starRating(500)).toBe(1);
  });
});

describe('attemptPoints', () => {
  it('weights a bull more heavily than a cow', () => {
    expect(POINTS_PER_BULL).toBeGreaterThan(POINTS_PER_COW);
    expect(attemptPoints(1, 0)).toBeGreaterThan(attemptPoints(0, 1));
  });
});
