/**
 * The wire protocol.
 *
 * Every message that crosses a data channel is parsed here. Nothing else in
 * the app is allowed to look at raw wire data.
 *
 * The rules that matter:
 *
 * - The **Host validates every inbound message** and re-derives every value
 *   that matters. A guest can ask; only the Host decides.
 * - A message that fails validation is **ignored**, never partially applied.
 * - The secret is never part of a message before the game is over.
 *
 * The full specification lives in `docs/protocol.md`.
 */

import { MAX_CHAT_LENGTH, MAX_MESSAGE_BYTES, MAX_NAME_LENGTH } from '../config.js';
import { isValidGuess } from './secret.js';

/** The protocol version this build speaks. */
export const PROTOCOL_VERSION = 1;

/** @typedef {import('./secret.js').Rules} Rules */

/** Message types. */
export const MessageType = Object.freeze({
  // Guest -> Host
  HELLO: 'hello',
  GUESS: 'guess',
  CHAT: 'chat',
  PING: 'ping',

  // Host -> Guest
  WELCOME: 'welcome',
  STATE: 'state',
  TOAST: 'toast',
  NOTICE: 'notice',
  BYE: 'bye',
  PONG: 'pong',
});

/** Types a guest is allowed to send. */
export const GUEST_MESSAGE_TYPES = Object.freeze([
  MessageType.HELLO,
  MessageType.GUESS,
  MessageType.CHAT,
  MessageType.PING,
]);

/** Types the Host is allowed to send. */
export const HOST_MESSAGE_TYPES = Object.freeze([
  MessageType.WELCOME,
  MessageType.STATE,
  MessageType.CHAT,
  MessageType.TOAST,
  MessageType.NOTICE,
  MessageType.BYE,
  MessageType.PONG,
]);

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, reason: string }} Result
 */

/**
 * @typedef {object} HelloMessage
 * @property {number} v
 * @property {'hello'} t
 * @property {string} name
 * @property {number} avatar
 * @property {string} locale
 * @property {string} clientId  A stable id for this browser, so a guest that
 *   reconnects is recognised as the same player rather than a new one.
 */

/**
 * @typedef {object} GuessMessage
 * @property {number} v
 * @property {'guess'} t
 * @property {string} digits
 */

/**
 * @typedef {object} ChatMessage
 * @property {number} v
 * @property {'chat'} t
 * @property {string} text
 */

/**
 * @typedef {object} PingMessage
 * @property {number} v
 * @property {'ping'} t
 */

/**
 * @typedef {object} WelcomeMessage
 * @property {number} v
 * @property {'welcome'} t
 * @property {{ id: string, name: string, avatar: number }} you
 * @property {unknown} state
 */

/**
 * @typedef {object} StateMessage
 * @property {number} v
 * @property {'state'} t
 * @property {number} rev
 * @property {unknown} state
 */

/**
 * @typedef {object} HostChatMessage
 * @property {number} v
 * @property {'chat'} t
 * @property {string} from
 * @property {string} name
 * @property {string} text
 * @property {number} at
 */

/**
 * @typedef {object} ToastMessage
 * @property {number} v
 * @property {'toast'} t
 * @property {'info' | 'success' | 'warning' | 'error'} kind
 * @property {string} text
 */

/**
 * @typedef {object} NoticeMessage
 * @property {number} v
 * @property {'notice'} t
 * @property {string} kind
 * @property {string} text
 */

/**
 * @typedef {object} ByeMessage
 * @property {number} v
 * @property {'bye'} t
 * @property {string} reason
 */

/**
 * @typedef {object} PongMessage
 * @property {number} v
 * @property {'pong'} t
 * @property {number} at
 */

/**
 * @typedef {HelloMessage | GuessMessage | ChatMessage | PingMessage} GuestMessage
 * @typedef {WelcomeMessage | StateMessage | HostChatMessage | ToastMessage | NoticeMessage | ByeMessage | PongMessage} HostMessage
 */

/**
 * Removes control characters and collapses whitespace.
 *
 * This is the single place user-supplied text is cleaned. The result is
 * inserted with `textContent`, so markup is never interpreted — but cleaning
 * here also stops a chat message from smuggling invisible characters or
 * wrecking the layout.
 *
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string | null} The cleaned text, or `null` if nothing is left.
 */
export function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return null;

  // eslint-disable-next-line no-control-regex
  const withoutControls = value.replace(/[\u0000-\u001F\u007F]/g, ' ');
  const collapsed = withoutControls.replace(/\s+/g, ' ').trim();

  if (collapsed.length === 0) return null;
  return collapsed.slice(0, maxLength);
}

/**
 * Checks the size of a raw message before it is even parsed.
 *
 * @param {string} raw
 * @param {number} [maxBytes]
 * @returns {boolean}
 */
export function isWithinSizeLimit(raw, maxBytes = MAX_MESSAGE_BYTES) {
  // A UTF-8 character is at most 3 bytes for the code points we allow, but
  // measuring the encoded length is the honest check.
  return new TextEncoder().encode(raw).length <= maxBytes;
}

/**
 * Parses and validates the envelope of a raw message.
 *
 * @param {unknown} raw
 * @returns {Result<{ v: number, t: string }>}
 */
export function parseEnvelope(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'not-a-string' };
  }
  if (!isWithinSizeLimit(raw)) {
    return { ok: false, reason: 'too-large' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not-json' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'not-an-object' };
  }

  const envelope = /** @type {Record<string, unknown>} */ (parsed);

  if (typeof envelope.v !== 'number' || !Number.isInteger(envelope.v)) {
    return { ok: false, reason: 'missing-version' };
  }
  if (envelope.v !== PROTOCOL_VERSION) {
    return { ok: false, reason: 'unsupported-version' };
  }
  if (typeof envelope.t !== 'string') {
    return { ok: false, reason: 'missing-type' };
  }

  return { ok: true, value: { v: envelope.v, t: envelope.t } };
}

/**
 * @typedef {object} ParseContext
 * @property {number} [avatarCount]  How many avatars exist.
 * @property {Rules} [rules]  The rules in force, used to validate a guess.
 * @property {number} [maxNameLength]
 * @property {number} [maxChatLength]
 */

/**
 * Parses a message sent by a guest.
 *
 * @param {unknown} raw
 * @param {ParseContext} [context]
 * @returns {Result<GuestMessage>}
 */
export function parseGuestMessage(raw, context = {}) {
  const envelope = parseEnvelope(raw);
  if (!envelope.ok) return envelope;

  const { v, t } = envelope.value;
  const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(/** @type {string} */ (raw)));

  if (!GUEST_MESSAGE_TYPES.includes(/** @type {never} */ (t))) {
    return { ok: false, reason: 'unexpected-type' };
  }

  switch (t) {
    case MessageType.HELLO: {
      const name = sanitizeText(parsed.name, context.maxNameLength ?? MAX_NAME_LENGTH);
      if (name === null) return { ok: false, reason: 'invalid-name' };

      const avatarCount = context.avatarCount ?? 8;
      const rawAvatar = parsed.avatar;
      const avatar =
        typeof rawAvatar === 'number' &&
        Number.isInteger(rawAvatar) &&
        rawAvatar >= 0 &&
        rawAvatar < avatarCount
          ? rawAvatar
          : 0;

      const locale = parsed.locale === 'ar' ? 'ar' : 'en';
      const clientId = sanitizeText(parsed.clientId, 64) ?? '';

      return { ok: true, value: { v, t, name, avatar, locale, clientId } };
    }

    case MessageType.GUESS: {
      const digits = parsed.digits;
      if (typeof digits !== 'string') return { ok: false, reason: 'invalid-digits' };

      const rules = context.rules;
      if (rules && !isValidGuess(digits, rules)) {
        return { ok: false, reason: 'invalid-digits' };
      }
      if (!rules && !/^\d+$/.test(digits)) {
        return { ok: false, reason: 'invalid-digits' };
      }

      return { ok: true, value: { v, t, digits } };
    }

    case MessageType.CHAT: {
      const text = sanitizeText(parsed.text, context.maxChatLength ?? MAX_CHAT_LENGTH);
      if (text === null) return { ok: false, reason: 'invalid-text' };
      return { ok: true, value: { v, t, text } };
    }

    case MessageType.PING:
      return { ok: true, value: { v, t } };

    default:
      return { ok: false, reason: 'unexpected-type' };
  }
}

/**
 * Parses a message sent by the Host.
 *
 * @param {unknown} raw
 * @returns {Result<HostMessage>}
 */
export function parseHostMessage(raw) {
  const envelope = parseEnvelope(raw);
  if (!envelope.ok) return envelope;

  const { v, t } = envelope.value;
  const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(/** @type {string} */ (raw)));

  if (!HOST_MESSAGE_TYPES.includes(/** @type {never} */ (t))) {
    return { ok: false, reason: 'unexpected-type' };
  }

  switch (t) {
    case MessageType.WELCOME: {
      const you = parsed.you;
      if (typeof you !== 'object' || you === null) return { ok: false, reason: 'invalid-you' };
      const record = /** @type {Record<string, unknown>} */ (you);
      if (typeof record.id !== 'string' || typeof record.name !== 'string') {
        return { ok: false, reason: 'invalid-you' };
      }
      const avatar = typeof record.avatar === 'number' ? record.avatar : 0;
      return {
        ok: true,
        value: {
          v,
          t,
          you: { id: record.id, name: record.name, avatar },
          state: parsed.state,
        },
      };
    }

    case MessageType.STATE: {
      const rev = parsed.rev;
      if (typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) {
        return { ok: false, reason: 'invalid-revision' };
      }
      if (typeof parsed.state !== 'object' || parsed.state === null) {
        return { ok: false, reason: 'invalid-state' };
      }
      return { ok: true, value: { v, t, rev, state: parsed.state } };
    }

    case MessageType.CHAT: {
      const from = typeof parsed.from === 'string' ? parsed.from : '';
      const name = sanitizeText(parsed.name, MAX_NAME_LENGTH) ?? '';
      const text = sanitizeText(parsed.text, MAX_CHAT_LENGTH);
      if (text === null) return { ok: false, reason: 'invalid-text' };
      const at = typeof parsed.at === 'number' ? parsed.at : 0;
      return { ok: true, value: { v, t, from, name, text, at } };
    }

    case MessageType.TOAST: {
      const kind = parsed.kind;
      if (kind !== 'info' && kind !== 'success' && kind !== 'warning' && kind !== 'error') {
        return { ok: false, reason: 'invalid-kind' };
      }
      const text = sanitizeText(parsed.text, 160);
      if (text === null) return { ok: false, reason: 'invalid-text' };
      return { ok: true, value: { v, t, kind, text } };
    }

    case MessageType.NOTICE: {
      const kind = typeof parsed.kind === 'string' ? parsed.kind : 'info';
      const text = sanitizeText(parsed.text, 160) ?? '';
      return { ok: true, value: { v, t, kind, text } };
    }

    case MessageType.BYE: {
      const reason = typeof parsed.reason === 'string' ? parsed.reason : 'host-left';
      return { ok: true, value: { v, t, reason } };
    }

    case MessageType.PONG: {
      const at = typeof parsed.at === 'number' ? parsed.at : 0;
      return { ok: true, value: { v, t, at } };
    }

    default:
      return { ok: false, reason: 'unexpected-type' };
  }
}

/**
 * Builds a wire message.
 *
 * @param {string} t
 * @param {Record<string, unknown>} [payload]
 * @returns {string}
 */
export function encodeMessage(t, payload = {}) {
  return JSON.stringify({ v: PROTOCOL_VERSION, t, ...payload });
}
