/**
 * Every tunable in one place.
 *
 * There are no environment variables in this project — it must build and run
 * with zero configuration. The only external dependency is the public PeerJS
 * signaling server, whose address can be swapped here for a self-hosted
 * PeerServer without touching any other file.
 */

/** Public PeerJS signaling server. Swap for a self-hosted PeerServer if needed. */
export const SIGNALING_HOST = '0.peerjs.com';
export const SIGNALING_PORT = 443;
export const SIGNALING_PATH = '/';
export const SIGNALING_KEY = 'peerjs';

/**
 * ICE configuration.
 *
 * STUN is enough for the vast majority of home and mobile networks. A player
 * behind a symmetric NAT will not connect without a TURN relay; add one here if
 * that becomes a problem for your audience.
 */
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/* ------------------------------------------------------------------ *
 * Connection lifecycle
 * ------------------------------------------------------------------ */

/** How long a single connect attempt may take before it is abandoned. */
export const CONNECT_TIMEOUT_MS = 15_000;

/** Backoff schedule between connect attempts. The last value repeats. */
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

/** How often the Host re-broadcasts a snapshot while the room is idle. */
export const HEARTBEAT_MS = 5_000;

/** How long a disconnected player's seat is held before they are removed. */
export const SEAT_HOLD_MS = 60_000;

/** How long a guest may go without a snapshot before it shows the reconnecting banner. */
export const STALE_MS = 12_000;

/** How many times the Host regenerates a room code that is already taken. */
export const CODE_REGENERATION_ATTEMPTS = 8;

/* ------------------------------------------------------------------ *
 * Game rules
 * ------------------------------------------------------------------ */

export const MAX_PLAYERS = 8;

/** How many characters the room code has. */
export const ROOM_CODE_LENGTH = 4;

/**
 * Room-code alphabet — 26 symbols.
 *
 * Every symbol that can be misread as another symbol is excluded:
 *
 * | Excluded | Confused with | Why it matters |
 * |---|---|---|
 * | `O` | `0` | classic misread |
 * | `I`, `L` | `1` | classic misread |
 * | `B` | `8` | letter/digit confusion |
 * | `G` | `6` | letter/digit confusion |
 * | `S` | `5` | letter/digit confusion |
 * | `T` | `7` | letter/digit confusion |
 * | `Z` | `2` | letter/digit confusion |
 *
 * Digits `0` and `1` are excluded outright. The result is a set in which no
 * letter resembles any digit, so a code read aloud over a phone call is
 * unambiguous.
 *
 * 26⁴ = 456,976 codes. Collisions are possible but self-healing: the Host
 * regenerates a taken code automatically (see ADR 0002).
 */
export const ROOM_CODE_ALPHABET = 'ACDEFHJKMNPQRUVWXY23456789';

export const DEFAULT_RULES = Object.freeze({
  digits: 4,
  attempts: 8,
  allowRepeats: false,
});

/** Digit-count options the Host can choose from. */
export const DIGIT_OPTIONS = [3, 4, 5];

/** Attempt-count options the Host can choose from. */
export const ATTEMPT_OPTIONS = [4, 6, 8, 10];

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

/** Maximum length of a player name. */
export const MAX_NAME_LENGTH = 24;

/** Maximum length of a chat message. */
export const MAX_CHAT_LENGTH = 200;

/** Maximum accepted size of an inbound wire message. */
export const MAX_MESSAGE_BYTES = 8 * 1024;

/** Minimum accepted size of a renderable viewport, used by the e2e specs. */
export const MIN_TOUCH_TARGET_PX = 44;
