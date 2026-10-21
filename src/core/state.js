/**
 * The authoritative game state, and the pure reducers that change it.
 *
 * Everything here is immutable: a reducer takes a state and returns a **new**
 * state. That makes the state trivially comparable, trivially testable, and
 * safe to broadcast verbatim.
 *
 * The Host is the only thing that calls these. A guest never computes a score.
 */

import { scoreGuess, isCorrectGuess, isValidGuess } from './secret.js';
import { normalizeRules } from './rules.js';

/** @typedef {import('./secret.js').Rules} Rules */

/**
 * @typedef {object} Attempt
 * @property {string} digits  The guess.
 * @property {number} bulls   Correct digit, correct place.
 * @property {number} cows    Correct digit, wrong place.
 * @property {number} at      Timestamp (ms) when it was made.
 */

/**
 * @typedef {'active' | 'disconnected' | 'eliminated' | 'won'} PlayerStatus
 */

/**
 * @typedef {object} Player
 * @property {string} id
 * @property {string} name
 * @property {number} avatar
 * @property {boolean} isHost
 * @property {PlayerStatus} status
 * @property {Attempt[]} attempts
 * @property {number} points
 * @property {number} joinedAt
 */

/**
 * @typedef {object} GameState
 * @property {'lobby' | 'playing' | 'finished'} phase
 * @property {Rules} rules
 * @property {Player[]} players
 * @property {string | null} turn  The player whose turn it is.
 * @property {string | null} winner
 * @property {string | null} secret  `null` until the game is over.
 * @property {number | null} startedAt
 * @property {number} rev  Monotonic revision, bumped on every change.
 */

/** The phases a room moves through. */
export const Phase = Object.freeze({
  LOBBY: 'lobby',
  PLAYING: 'playing',
  FINISHED: 'finished',
});

/** The states a player can be in. */
export const PlayerStatus = Object.freeze({
  ACTIVE: 'active',
  DISCONNECTED: 'disconnected',
  ELIMINATED: 'eliminated',
  WON: 'won',
});

/* ------------------------------------------------------------------ *
 * Scoring
 *
 * See `docs/adr/0006-scoring-model.md`.
 * ------------------------------------------------------------------ */

/** Points for a single bull. */
export const POINTS_PER_BULL = 25;

/** Points for a single cow. */
export const POINTS_PER_COW = 10;

/** Points awarded for solving the secret. */
export const WIN_BONUS = 1000;

/** Points for each attempt the player did not need. */
export const POINTS_PER_UNUSED_ATTEMPT = 50;

/** Bonus for finishing first, and for finishing second. */
export const PLACEMENT_BONUS = Object.freeze({ first: 100, second: 50, other: 0 });

/**
 * Points earned by a single attempt.
 *
 * @param {number} bulls
 * @param {number} cows
 * @returns {number}
 */
export function attemptPoints(bulls, cows) {
  return bulls * POINTS_PER_BULL + cows * POINTS_PER_COW;
}

/**
 * The five-star rating shown next to a player's points.
 *
 * @param {number} points
 * @returns {1 | 2 | 3 | 4 | 5}
 */
export function starRating(points) {
  if (points >= 1400) return 5;
  if (points >= 1250) return 4;
  if (points >= 1100) return 3;
  if (points >= 1000) return 2;
  return 1;
}

/* ------------------------------------------------------------------ *
 * Construction
 * ------------------------------------------------------------------ */

/**
 * Creates the initial state of a room.
 *
 * @param {unknown} rules
 * @param {Omit<Player, 'status' | 'attempts' | 'points' | 'isHost'>} host
 * @returns {GameState}
 */
export function createInitialState(rules, host) {
  const player = {
    ...host,
    isHost: true,
    status: PlayerStatus.ACTIVE,
    attempts: [],
    points: 0,
  };

  return {
    phase: Phase.LOBBY,
    rules: normalizeRules(rules),
    players: [player],
    turn: player.id,
    winner: null,
    secret: null,
    startedAt: null,
    rev: 0,
  };
}

/**
 * Adds a player to the room.
 *
 * @param {GameState} state
 * @param {{ id: string, name: string, avatar: number, joinedAt: number }} player
 * @returns {GameState}
 */
export function addPlayer(state, player) {
  if (state.players.some((p) => p.id === player.id)) {
    return state;
  }

  const next = {
    ...player,
    isHost: false,
    status: PlayerStatus.ACTIVE,
    attempts: [],
    points: 0,
  };

  return bump({ ...state, players: [...state.players, next] });
}

/**
 * Removes a player from the room.
 *
 * @param {GameState} state
 * @param {string} playerId
 * @returns {GameState}
 */
export function removePlayer(state, playerId) {
  const players = state.players.filter((p) => p.id !== playerId);
  if (players.length === state.players.length) return state;

  const next = { ...state, players };
  if (state.turn === playerId) {
    // The turn moves to the next player in the original seating order, with
    // the player who just left excluded.
    next.turn = pickNextActive(
      state,
      playerId,
      (player) => player.id !== playerId && player.status === PlayerStatus.ACTIVE,
    );
  }
  return bump(next);
}

/**
 * Changes a player's status.
 *
 * @param {GameState} state
 * @param {string} playerId
 * @param {PlayerStatus} status
 * @returns {GameState}
 */
export function setPlayerStatus(state, playerId, status) {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, status } : p));
  if (players.every((p, i) => p === state.players[i])) return state;
  return bump({ ...state, players });
}

/**
 * Finds a player by id.
 *
 * @param {GameState} state
 * @param {string} playerId
 * @returns {Player | undefined}
 */
export function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}

/* ------------------------------------------------------------------ *
 * Game flow
 * ------------------------------------------------------------------ */

/**
 * Starts the game: locks the rules in and gives the first player the turn.
 *
 * @param {GameState} state
 * @param {string} secret
 * @param {number} now
 * @returns {GameState}
 */
export function startGame(state, secret, now) {
  if (state.phase === Phase.PLAYING) return state;

  const first = state.players.find((p) => p.status === PlayerStatus.ACTIVE);
  return bump({
    ...state,
    phase: Phase.PLAYING,
    secret,
    startedAt: now,
    turn: first ? first.id : null,
    winner: null,
  });
}

/**
 * The result of trying to apply a guess.
 *
 * @typedef {{ ok: true, state: GameState, attempt: Attempt, won: boolean } | { ok: false, state: GameState, reason: string }} GuessResult
 */

/**
 * Applies a guess to the state.
 *
 * The Host is the only caller. It re-derives the score from the secret and
 * never trusts a client-supplied result.
 *
 * @param {GameState} state
 * @param {string} playerId
 * @param {string} digits
 * @param {number} [now]
 * @returns {GuessResult}
 */
export function applyGuess(state, playerId, digits, now = Date.now()) {
  if (state.phase !== Phase.PLAYING) {
    return { ok: false, state, reason: 'game-not-playing' };
  }
  if (!state.secret) {
    return { ok: false, state, reason: 'no-secret' };
  }
  if (state.turn !== playerId) {
    return { ok: false, state, reason: 'not-your-turn' };
  }

  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, state, reason: 'unknown-player' };
  }
  if (player.status !== PlayerStatus.ACTIVE) {
    return { ok: false, state, reason: 'player-not-active' };
  }
  if (player.attempts.length >= state.rules.attempts) {
    return { ok: false, state, reason: 'no-attempts-left' };
  }
  if (!isValidGuess(digits, state.rules)) {
    return { ok: false, state, reason: 'invalid-guess' };
  }

  const { bulls, cows } = scoreGuess(state.secret, digits);
  const attempt = { digits, bulls, cows, at: now };
  const won = isCorrectGuess(state.secret, digits);

  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;

    const attempts = [...p.attempts, attempt];
    const points = p.points + attemptPoints(bulls, cows);

    if (won) {
      return { ...p, attempts, points, status: PlayerStatus.WON };
    }
    if (attempts.length >= state.rules.attempts) {
      return { ...p, attempts, points, status: PlayerStatus.ELIMINATED };
    }
    return { ...p, attempts, points };
  });

  let next = { ...state, players };

  if (won) {
    next = finalize(next, playerId, now);
  } else {
    const eliminated = findPlayer(next, playerId);
    if (eliminated && eliminated.status === PlayerStatus.ELIMINATED) {
      const stillPlaying = next.players.some((p) => p.status === PlayerStatus.ACTIVE);
      if (!stillPlaying) {
        next = { ...next, phase: Phase.FINISHED, turn: null, winner: null };
        next = bump(next);
        return { ok: true, state: next, attempt, won: false };
      }
    }
    next.turn = pickNextActive(next, playerId);
  }

  return { ok: true, state: bump(next), attempt, won };
}

/**
 * Ends the game and awards the win and placement bonuses.
 *
 * @param {GameState} state
 * @param {string} winnerId
 * @param {number} [now]
 * @returns {GameState}
 */
export function finalize(state, winnerId, now = Date.now()) {
  const winner = findPlayer(state, winnerId);
  if (!winner) return state;

  const unused = Math.max(0, state.rules.attempts - winner.attempts.length);

  // The winner is first. Everyone else is ranked by how few attempts they
  // used, and by join order when that ties.
  const rivals = state.players
    .filter((p) => p.id !== winnerId)
    .map((p, index) => ({ player: p, index }))
    .sort((a, b) => a.player.attempts.length - b.player.attempts.length || a.index - b.index);

  const secondId = rivals[0]?.player.id ?? null;

  const players = state.players.map((p) => {
    if (p.id === winnerId) {
      return {
        ...p,
        status: PlayerStatus.WON,
        points: p.points + WIN_BONUS + unused * POINTS_PER_UNUSED_ATTEMPT + PLACEMENT_BONUS.first,
      };
    }
    if (p.id === secondId && p.status === PlayerStatus.ACTIVE) {
      return { ...p, points: p.points + PLACEMENT_BONUS.second };
    }
    return p;
  });

  return bump({
    ...state,
    phase: Phase.FINISHED,
    players,
    winner: winnerId,
    turn: null,
    startedAt: state.startedAt ?? now,
  });
}

/**
 * Ends the game with no winner (every player ran out of attempts).
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function endWithoutWinner(state) {
  if (state.phase === Phase.FINISHED) return state;
  return bump({ ...state, phase: Phase.FINISHED, turn: null, winner: null });
}

/* ------------------------------------------------------------------ *
 * Turn order
 * ------------------------------------------------------------------ */

/**
 * Finds the next player who can still act.
 *
 * Scans forward from the player who just acted, wrapping around. The scan
 * follows the **original** seating order, so removing a player does not
 * shuffle the turn rotation.
 *
 * @param {GameState} state
 * @param {string} fromId
 * @param {(player: Player) => boolean} [isEligible]
 *   Defaults to "the player is active". Callers that are removing a player
 *   pass a predicate that also excludes the player being removed.
 * @returns {string | null}
 */
export function pickNextActive(state, fromId, isEligible = defaultEligible) {
  const order = state.players;
  const currentIndex = order.findIndex((p) => p.id === fromId);

  for (let step = 1; step <= order.length; step += 1) {
    const index = (currentIndex + step + order.length) % order.length;
    const candidate = order[index];
    if (candidate && isEligible(candidate)) {
      return candidate.id;
    }
  }

  return null;
}

/**
 * @param {Player} player
 * @returns {boolean}
 */
function defaultEligible(player) {
  return player.status === PlayerStatus.ACTIVE;
}

/**
 * The players, ranked for the leaderboard.
 *
 * Points first, then fewest attempts, then join order. A total order, so the
 * table never wobbles between two snapshots.
 *
 * @param {GameState} state
 * @returns {Player[]}
 */
export function rankedPlayers(state) {
  return state.players
    .map((player, index) => ({ player, index }))
    .sort(
      (a, b) =>
        b.player.points - a.player.points ||
        a.player.attempts.length - b.player.attempts.length ||
        a.index - b.index,
    )
    .map((entry) => entry.player);
}

/* ------------------------------------------------------------------ *
 * The wire view
 * ------------------------------------------------------------------ */

/**
 * The state as it may be sent to a guest.
 *
 * **The secret is removed unless the game is over.** This is the single place
 * that boundary is enforced, and the Host must call it before broadcasting.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function publicView(state) {
  if (state.phase === Phase.FINISHED) return state;

  if (state.secret === null) return state;

  return { ...state, secret: null };
}

/**
 * Bumps the revision counter.
 *
 * @param {GameState} state
 * @returns {GameState}
 */
export function bump(state) {
  return { ...state, rev: state.rev + 1 };
}
