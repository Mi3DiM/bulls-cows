import { describe, expect, it } from 'vitest';

import {
  MessageType,
  PROTOCOL_VERSION,
  encodeMessage,
  isWithinSizeLimit,
  parseEnvelope,
  parseGuestMessage,
  parseHostMessage,
  sanitizeText,
} from '../../src/core/protocol.js';

const rules = { digits: 4, attempts: 8, allowRepeats: false };

describe('sanitizeText', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeText('  Go   Hamed!  ', 100)).toBe('Go Hamed!');
  });

  it('strips control characters', () => {
    expect(sanitizeText('a\u0000b\u0007c', 100)).toBe('a b c');
    expect(sanitizeText('a\nb', 100)).toBe('a b');
  });

  it('truncates to the maximum length', () => {
    expect(sanitizeText('abcdefgh', 4)).toBe('abcd');
  });

  it('returns null when nothing is left', () => {
    expect(sanitizeText('', 100)).toBeNull();
    expect(sanitizeText('   ', 100)).toBeNull();
    expect(sanitizeText(null, 100)).toBeNull();
    expect(sanitizeText(123, 100)).toBeNull();
  });
});

describe('isWithinSizeLimit', () => {
  it('accepts a small payload', () => {
    expect(isWithinSizeLimit('{"a":1}')).toBe(true);
  });

  it('rejects a payload that is too large', () => {
    expect(isWithinSizeLimit('x'.repeat(9000))).toBe(false);
  });
});

describe('parseEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const result = parseEnvelope('{"v":1,"t":"ping"}');
    expect(result).toEqual({ ok: true, value: { v: 1, t: 'ping' } });
  });

  it('rejects a non-string', () => {
    expect(parseEnvelope(123)).toEqual({ ok: false, reason: 'not-a-string' });
  });

  it('rejects invalid JSON', () => {
    expect(parseEnvelope('{not json')).toEqual({ ok: false, reason: 'not-json' });
  });

  it('rejects a non-object', () => {
    expect(parseEnvelope('[]')).toEqual({ ok: false, reason: 'not-an-object' });
    expect(parseEnvelope('"hello"')).toEqual({ ok: false, reason: 'not-an-object' });
  });

  it('rejects a missing or malformed version', () => {
    expect(parseEnvelope('{"t":"ping"}')).toEqual({ ok: false, reason: 'missing-version' });
    expect(parseEnvelope('{"v":"1","t":"ping"}')).toEqual({ ok: false, reason: 'missing-version' });
  });

  it('rejects an unsupported version', () => {
    expect(parseEnvelope('{"v":99,"t":"ping"}')).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('rejects a missing type', () => {
    expect(parseEnvelope('{"v":1}')).toEqual({ ok: false, reason: 'missing-type' });
  });

  it('rejects an oversized payload before parsing it', () => {
    expect(parseEnvelope(`{"v":1,"t":"ping","pad":"${'x'.repeat(9000)}"}`)).toEqual({
      ok: false,
      reason: 'too-large',
    });
  });
});

describe('parseGuestMessage', () => {
  it('parses a hello', () => {
    const result = parseGuestMessage(
      JSON.stringify({ v: 1, t: 'hello', name: 'Sara', avatar: 2, locale: 'ar' }),
      { avatarCount: 8 },
    );
    expect(result).toEqual({
      ok: true,
      value: { v: 1, t: 'hello', name: 'Sara', avatar: 2, locale: 'ar', clientId: '' },
    });
  });

  it('cleans a hostile name', () => {
    const result = parseGuestMessage(
      JSON.stringify({ v: 1, t: 'hello', name: '<script>alert(1)</script>', avatar: 0 }),
      { avatarCount: 8 },
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value.t === 'hello') {
      // The text is inserted with textContent, so the markup is inert — but it
      // must also be truncated to the name limit and must not carry line
      // breaks that could wreck the layout.
      expect(result.value.name).toBe('<script>alert(1)</script');
      expect(result.value.name.length).toBeLessThanOrEqual(24);
      expect(result.value.name).not.toContain('\n');
    }
  });

  it('rejects a hello with no usable name', () => {
    expect(parseGuestMessage(JSON.stringify({ v: 1, t: 'hello', name: '   ' }))).toEqual({
      ok: false,
      reason: 'invalid-name',
    });
  });

  it('coerces an out-of-range avatar to zero', () => {
    const result = parseGuestMessage(
      JSON.stringify({ v: 1, t: 'hello', name: 'Sara', avatar: 99 }),
      { avatarCount: 8 },
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value.t === 'hello') expect(result.value.avatar).toBe(0);
  });

  it('rejects a non-avatar locale', () => {
    const result = parseGuestMessage(
      JSON.stringify({ v: 1, t: 'hello', name: 'Sara', avatar: 0, locale: 'fr' }),
      { avatarCount: 8 },
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value.t === 'hello') expect(result.value.locale).toBe('en');
  });

  it('parses a valid guess', () => {
    const result = parseGuestMessage(JSON.stringify({ v: 1, t: 'guess', digits: '0247' }), {
      rules,
    });
    expect(result).toEqual({ ok: true, value: { v: 1, t: 'guess', digits: '0247' } });
  });

  it('rejects a guess that breaks the rules', () => {
    expect(
      parseGuestMessage(JSON.stringify({ v: 1, t: 'guess', digits: '0024' }), { rules }),
    ).toEqual({ ok: false, reason: 'invalid-digits' });

    expect(
      parseGuestMessage(JSON.stringify({ v: 1, t: 'guess', digits: '024' }), { rules }),
    ).toEqual({ ok: false, reason: 'invalid-digits' });

    expect(
      parseGuestMessage(JSON.stringify({ v: 1, t: 'guess', digits: '02A7' }), { rules }),
    ).toEqual({ ok: false, reason: 'invalid-digits' });
  });

  it('parses a chat message', () => {
    const result = parseGuestMessage(JSON.stringify({ v: 1, t: 'chat', text: 'Go Hamed!' }));
    expect(result).toEqual({ ok: true, value: { v: 1, t: 'chat', text: 'Go Hamed!' } });
  });

  it('rejects an empty chat message', () => {
    expect(parseGuestMessage(JSON.stringify({ v: 1, t: 'chat', text: '  ' }))).toEqual({
      ok: false,
      reason: 'invalid-text',
    });
  });

  it('parses a ping', () => {
    expect(parseGuestMessage(JSON.stringify({ v: 1, t: 'ping' }))).toEqual({
      ok: true,
      value: { v: 1, t: 'ping' },
    });
  });

  it('rejects a message type only the Host may send', () => {
    expect(parseGuestMessage(JSON.stringify({ v: 1, t: 'state', rev: 1, state: {} }))).toEqual({
      ok: false,
      reason: 'unexpected-type',
    });
  });

  it('rejects an unknown message type', () => {
    expect(parseGuestMessage(JSON.stringify({ v: 1, t: 'hack' }))).toEqual({
      ok: false,
      reason: 'unexpected-type',
    });
  });
});

describe('parseHostMessage', () => {
  it('parses a welcome', () => {
    const result = parseHostMessage(
      JSON.stringify({ v: 1, t: 'welcome', you: { id: 'p1', name: 'Sara', avatar: 1 }, state: {} }),
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.value.t === 'welcome') {
      expect(result.value.you).toEqual({ id: 'p1', name: 'Sara', avatar: 1 });
    }
  });

  it('rejects a welcome with no identity', () => {
    expect(parseHostMessage(JSON.stringify({ v: 1, t: 'welcome', state: {} }))).toEqual({
      ok: false,
      reason: 'invalid-you',
    });
  });

  it('parses a state snapshot', () => {
    const result = parseHostMessage(JSON.stringify({ v: 1, t: 'state', rev: 7, state: { a: 1 } }));
    expect(result).toEqual({ ok: true, value: { v: 1, t: 'state', rev: 7, state: { a: 1 } } });
  });

  it('rejects a state snapshot with a bad revision', () => {
    expect(parseHostMessage(JSON.stringify({ v: 1, t: 'state', rev: -1, state: {} }))).toEqual({
      ok: false,
      reason: 'invalid-revision',
    });
    expect(parseHostMessage(JSON.stringify({ v: 1, t: 'state', rev: 1.5, state: {} }))).toEqual({
      ok: false,
      reason: 'invalid-revision',
    });
  });

  it('parses a host chat message', () => {
    const result = parseHostMessage(
      JSON.stringify({
        v: 1,
        t: 'chat',
        from: 'g1',
        name: 'Sara',
        text: 'Go Hamed!',
        at: 1712345678901,
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        v: 1,
        t: 'chat',
        from: 'g1',
        name: 'Sara',
        text: 'Go Hamed!',
        at: 1712345678901,
      },
    });
  });

  it('rejects a host chat message with no text', () => {
    expect(
      parseHostMessage(JSON.stringify({ v: 1, t: 'chat', from: 'g1', name: 'Sara', text: '  ' })),
    ).toEqual({ ok: false, reason: 'invalid-text' });
  });

  it('parses a toast and rejects an unknown kind', () => {
    expect(
      parseHostMessage(JSON.stringify({ v: 1, t: 'toast', kind: 'error', text: 'Nope' })).ok,
    ).toBe(true);
    expect(
      parseHostMessage(JSON.stringify({ v: 1, t: 'toast', kind: 'catastrophe', text: 'Nope' })),
    ).toEqual({ ok: false, reason: 'invalid-kind' });
  });

  it('parses a bye', () => {
    expect(parseHostMessage(JSON.stringify({ v: 1, t: 'bye', reason: 'host-left' }))).toEqual({
      ok: true,
      value: { v: 1, t: 'bye', reason: 'host-left' },
    });
  });

  it('rejects a message type only a guest may send', () => {
    expect(parseHostMessage(JSON.stringify({ v: 1, t: 'guess', digits: '0247' }))).toEqual({
      ok: false,
      reason: 'unexpected-type',
    });
  });
});

describe('encodeMessage', () => {
  it('produces a message the parser accepts', () => {
    const raw = encodeMessage(MessageType.PING);
    expect(raw).toBe('{"v":1,"t":"ping"}');
    expect(parseGuestMessage(raw).ok).toBe(true);
  });

  it('always stamps the current protocol version', () => {
    const raw = JSON.parse(encodeMessage(MessageType.CHAT, { text: 'hi' }));
    expect(raw.v).toBe(PROTOCOL_VERSION);
  });
});
