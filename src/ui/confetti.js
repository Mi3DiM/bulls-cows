/**
 * Confetti.
 *
 * A small canvas particle system for the win moment. It is deliberately
 * lightweight: a few hundred particles, a single `requestAnimationFrame`
 * loop, and it stops itself when the last particle has fallen.
 *
 * It respects `prefers-reduced-motion` — with the setting on, no confetti is
 * drawn at all.
 */

const COLORS = ['#fbbf24', '#2bf59b', '#22d3ee', '#e935c1', '#f4f1ff', '#7c3aed'];

/**
 * @typedef {object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} rotation
 * @property {number} spin
 * @property {number} size
 * @property {string} color
 * @property {number} life
 */

/**
 * Whether the user prefers reduced motion.
 *
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Fires a burst of confetti across the top of the screen.
 *
 * @param {object} [options]
 * @param {number} [options.count]  How many particles.
 * @param {number} [options.durationMs]  How long to run.
 */
export function burstConfetti({ count = 160, durationMs = 2600 } = {}) {
  if (prefersReducedMotion()) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'pointer-events-none fixed inset-0 z-50 h-full w-full';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);

  /** @type {CanvasRenderingContext2D | null} */
  let context = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    // Some environments have no canvas at all. The celebration is
    // decorative, so the game carries on without it.
  }

  if (!context) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const width = window.innerWidth;
  /** @type {Particle[]} */
  const particles = [];

  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: Math.random() * width,
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2 + Math.random() * 3.4,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.24,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#fbbf24',
      life: 1,
    });
  }

  const started = performance.now();
  let frame = 0;

  const step = () => {
    const elapsed = performance.now() - started;

    context.clearRect(0, 0, width, window.innerHeight);

    let alive = false;
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.045;
      particle.rotation += particle.spin;

      if (elapsed > durationMs * 0.55) {
        particle.life -= 0.014;
      }

      if (particle.life <= 0 || particle.y > window.innerHeight + 40) continue;
      alive = true;

      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, particle.life));
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 3, particle.size, particle.size * 0.66);
      context.restore();
    }

    if (alive && elapsed < durationMs) {
      frame = requestAnimationFrame(step);
      return;
    }

    cancelAnimationFrame(frame);
    canvas.remove();
  };

  frame = requestAnimationFrame(step);

  window.addEventListener('resize', resize, { passive: true });
}
