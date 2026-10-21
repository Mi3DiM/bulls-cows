/**
 * Sound and haptics.
 *
 * Every sound is **synthesised** with the Web Audio API. No audio files, so
 * the app ships without a single binary asset and the whole bundle stays
 * small — which matters on a phone that is also running a video call.
 *
 * The audio context is created lazily, on the first user gesture, because
 * browsers refuse to start audio before one.
 */

/** @typedef {'tap' | 'backspace' | 'send' | 'correct' | 'wrong' | 'win' | 'lose' | 'join' | 'leave'} SfxName */

/** @type {AudioContext | null} */
let context = null;

/** Whether sound is muted. */
let muted = false;

/**
 * Whether the user has muted sound.
 *
 * @returns {boolean}
 */
export function isMuted() {
  return muted;
}

/**
 * Mutes or unmutes sound.
 *
 * @param {boolean} value
 */
export function setMuted(value) {
  muted = value;
}

/**
 * Creates (or resumes) the audio context.
 *
 * Must be called from a user gesture the first time.
 *
 * @returns {AudioContext | null}
 */
function ensureContext() {
  if (muted) return null;
  if (context) {
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  const Ctor =
    window.AudioContext ??
    /** @type {any} */ (window).webkitAudioContext ??
    /** @type {any} */ (null);

  if (!Ctor) return null;

  try {
    context = new Ctor();
  } catch {
    return null;
  }

  return context;
}

/**
 * Plays a single tone.
 *
 * @param {AudioContext} ctx
 * @param {number} frequency  Hz.
 * @param {number} startAt    Offset from now, in seconds.
 * @param {number} duration   Seconds.
 * @param {OscillatorType} type
 * @param {number} peak       Gain, 0..1.
 */
function tone(ctx, frequency, startAt, duration, type = 'sine', peak = 0.2) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startAt);

  // A short attack and a gentle release: a click, not a bang.
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(ctx.currentTime + startAt);
  oscillator.stop(ctx.currentTime + startAt + duration + 0.02);
}

/**
 * Plays a named sound.
 *
 * @param {SfxName} name
 */
export function playSfx(name) {
  const ctx = ensureContext();
  if (!ctx) return;

  switch (name) {
    case 'tap':
      tone(ctx, 660, 0, 0.07, 'triangle', 0.12);
      break;

    case 'backspace':
      tone(ctx, 320, 0, 0.09, 'triangle', 0.1);
      break;

    case 'send':
      tone(ctx, 520, 0, 0.1, 'triangle', 0.14);
      tone(ctx, 780, 0.07, 0.12, 'triangle', 0.12);
      break;

    case 'correct':
      tone(ctx, 660, 0, 0.1, 'sine', 0.16);
      tone(ctx, 880, 0.08, 0.12, 'sine', 0.16);
      tone(ctx, 1174, 0.16, 0.2, 'sine', 0.16);
      break;

    case 'wrong':
      tone(ctx, 240, 0, 0.16, 'sawtooth', 0.1);
      break;

    case 'win':
      [523, 659, 784, 1046].forEach((frequency, index) => {
        tone(ctx, frequency, index * 0.1, 0.28, 'triangle', 0.18);
      });
      break;

    case 'lose':
      [392, 349, 294].forEach((frequency, index) => {
        tone(ctx, frequency, index * 0.14, 0.26, 'sine', 0.14);
      });
      break;

    case 'join':
      tone(ctx, 587, 0, 0.1, 'sine', 0.12);
      tone(ctx, 880, 0.08, 0.14, 'sine', 0.12);
      break;

    case 'leave':
      tone(ctx, 440, 0, 0.1, 'sine', 0.1);
      tone(ctx, 330, 0.08, 0.14, 'sine', 0.1);
      break;

    default:
      break;
  }
}

/**
 * Fires a haptic pulse, where the device supports it.
 *
 * @param {number | number[]} [pattern]  Milliseconds, or a vibration pattern.
 */
export function vibrate(pattern = 12) {
  if (muted) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration is a nice-to-have; never let it break the interaction.
  }
}

/**
 * Unlocks audio after the first user gesture.
 *
 * Browsers block audio until the user interacts with the page.
 */
export function unlockAudio() {
  ensureContext();
}
