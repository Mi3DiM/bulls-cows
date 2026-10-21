/**
 * The home screen.
 *
 * Two ways in — create a room, or join one with a code — and a short
 * explanation of what the game is, because a first-time player should not
 * have to guess.
 */

import { el, elInput } from '../dom.js';
import { mascot } from '../mascot.js';
import { t } from '../../i18n/index.js';
import { createLanguageToggle } from '../components/language-toggle.js';

/**
 * Creates the home screen.
 *
 * @param {object} options
 * @param {() => void} options.onCreate
 * @param {(code: string) => void} options.onJoin
 * @param {() => void} [options.onLanguageChange]
 */
export function createHomeScreen({ onCreate, onJoin, onLanguageChange }) {
  const screen = el('div mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6', {
    'data-screen': 'home',
  });

  /* --- brand --- */

  const brand = el('header flex flex-col items-center gap-3 text-center');

  const mascotWrap = el('div relative', {}, [mascot('idle', 150)]);
  mascotWrap.classList.add('animate-float');

  brand.append(
    mascotWrap,
    el('h1 font-display text-4xl font-extrabold leading-none text-text', { text: t('app.title') }),
    el('p text-sm font-semibold text-cyan', { text: t('app.tagline') }),
  );

  /* --- name --- */

  const nameLabel = el('label block text-xs font-bold uppercase tracking-wider text-muted', {
    text: t('common.name'),
    for: 'player-name',
  });

  const nameInput = elInput({
    class: 'w-full rounded-xl border border-violet/25 bg-panel-soft px-3 py-2.5 text-sm',
    type: 'text',
    id: 'player-name',
    maxlength: '24',
    placeholder: t('common.namePlaceholder'),
    autocomplete: 'nickname',
    'data-testid': 'name-input',
  });

  const nameField = el('div flex flex-col gap-1.5', {}, [nameLabel, nameInput]);

  /* --- create --- */

  const createButton = el(
    'button w-full rounded-2xl bg-violet px-5 py-3.5 text-base font-extrabold text-text transition-transform active:scale-[0.98]',
    { type: 'button', 'data-action': 'create-room' },
    [t('home.create.cta')],
  );
  createButton.addEventListener('click', () => onCreate());

  const createCard = el('section glass flex flex-col gap-3 p-5', {}, [
    el('h2 font-display text-xl font-extrabold', { text: t('home.create.title') }),
    el('p text-sm text-muted', { text: t('home.create.body') }),
    createButton,
  ]);

  /* --- join --- */

  const joinInput = elInput({
    class:
      'tnum w-full rounded-xl border border-violet/25 bg-panel-soft px-3 py-3 text-center text-lg font-extrabold tracking-[0.3em] uppercase',
    type: 'text',
    id: 'room-code-input',
    maxlength: '8',
    placeholder: t('home.join.placeholder'),
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: 'false',
    'aria-label': t('home.join.placeholder'),
    'data-testid': 'room-code-input',
  });

  const joinError = el('p hidden text-xs font-semibold text-rose', {
    text: t('home.join.error'),
    role: 'alert',
    'data-testid': 'join-error',
  });

  const joinButton = el(
    'button w-full rounded-2xl bg-mint px-5 py-3.5 text-base font-extrabold text-void transition-transform active:scale-[0.98]',
    { type: 'button', 'data-action': 'join-room' },
    [t('home.join.cta')],
  );

  const submitJoin = () => {
    joinError.classList.add('hidden');
    onJoin(joinInput.value);
  };

  joinButton.addEventListener('click', submitJoin);
  joinInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitJoin();
    }
  });

  const joinCard = el('section glass flex flex-col gap-3 p-5', {}, [
    el('h2 font-display text-xl font-extrabold', { text: t('home.join.title') }),
    joinInput,
    joinButton,
    joinError,
  ]);

  /* --- how it works --- */

  const steps = el('ol grid gap-3 sm:grid-cols-3', { 'data-testid': 'how-it-works' });

  const stepData = [
    { title: t('home.how.1.title'), body: t('home.how.1.body') },
    { title: t('home.how.2.title'), body: t('home.how.2.body') },
    { title: t('home.how.3.title'), body: t('home.how.3.body') },
  ];

  stepData.forEach((step, index) => {
    steps.append(
      el('li glass flex flex-col gap-1.5 p-4', {}, [
        el(
          'span tnum flex h-7 w-7 items-center justify-center rounded-full bg-violet text-xs font-extrabold text-text',
          {
            text: String(index + 1),
          },
        ),
        el('h3 font-display text-base font-extrabold', { text: step.title }),
        el('p text-xs leading-relaxed text-muted', { text: step.body }),
      ]),
    );
  });

  const howCard = el('section flex flex-col gap-3', {}, [
    el('h2 font-display text-xl font-extrabold', { text: t('home.how.title') }),
    steps,
  ]);

  /* --- footer --- */

  const footer = el('footer flex flex-col items-center gap-3 text-center', {}, [
    el('p max-w-md text-xs leading-relaxed text-faint', { text: t('home.footer') }),
    createLanguageToggle(onLanguageChange),
  ]);

  screen.append(brand, nameField, createCard, joinCard, howCard, footer);

  return {
    element: screen,
    /**
     * The name the player typed.
     *
     * @returns {string}
     */
    name() {
      return nameInput.value.trim();
    },
    /**
     * Shows a join error.
     */
    showJoinError() {
      joinError.classList.remove('hidden');
    },
  };
}
