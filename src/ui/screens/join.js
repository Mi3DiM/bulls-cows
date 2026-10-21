/**
 * The join screen.
 *
 * A guest who follows a share link lands here first, so they can pick a name
 * before joining. It is one field and one button — the brief promises no
 * accounts, and this keeps that promise literal: you type a name, and that
 * is all there is.
 *
 * A player who has joined before is remembered, and skips straight in.
 */

import { el, elInput } from '../dom.js';
import { avatar, AVATAR_COUNT } from '../avatar.js';
import { t } from '../../i18n/index.js';
import { createLanguageToggle } from '../components/language-toggle.js';

/**
 * Creates the join screen.
 *
 * @param {object} options
 * @param {string} options.code  The room being joined.
 * @param {string} options.name  The remembered name, if there is one.
 * @param {number} options.avatar
 * @param {(name: string, avatar: number) => void} options.onJoin
 * @param {() => void} [options.onLanguageChange]
 */
export function createJoinScreen({ code, name, avatar: selectedAvatar, onJoin, onLanguageChange }) {
  const screen = el('div.mx-auto.flex.w-full.max-w-md.flex-col.gap-4.px-4.py-8', {
    'data-screen': 'join',
  });

  const head = el('header.flex.flex-col.items-center.gap-2.text-center', {}, [
    el('p.text-xs.font-bold.uppercase.tracking-widest.text-muted', { text: t('create.codeLabel') }),
    el('p.tnum.text-4xl.font-extrabold.tracking-[0.3em].text-mint', {
      text: code,
      'data-testid': 'join-room-code',
    }),
    el('p.text-sm.text-muted', { text: t('home.join.title') }),
  ]);

  const nameLabel = el('label.block.text-xs.font-bold.uppercase.tracking-wider.text-muted', {
    text: t('common.name'),
    for: 'join-name',
  });

  const nameInput = elInput({
    class: 'w-full.rounded-xl.border.border-violet/25.bg-panel-soft.px-3.py-2.5.text-sm',
    type: 'text',
    id: 'join-name',
    maxlength: '24',
    placeholder: t('common.namePlaceholder'),
    autocomplete: 'nickname',
    value: name,
    'data-testid': 'name-input',
  });

  /* --- avatar picker --- */

  let chosen = selectedAvatar;

  const avatarRow = el('div.flex.flex-wrap.gap-2', {
    role: 'radiogroup',
    'aria-label': t('common.name'),
  });

  /** @type {Map<number, HTMLElement>} */
  const avatarButtons = new Map();

  const syncAvatars = () => {
    for (const [index, button] of avatarButtons) {
      const isChosen = index === chosen;
      button.setAttribute('aria-checked', isChosen ? 'true' : 'false');
      button.classList.toggle('ring-2', isChosen);
      button.classList.toggle('ring-mint', isChosen);
      button.classList.toggle('opacity-55', !isChosen);
    }
  };

  for (let i = 0; i < AVATAR_COUNT; i += 1) {
    const button = el(
      'button.flex.h-11.w-11.items-center.justify-center.rounded-full.transition-all',
      {
        type: 'button',
        role: 'radio',
        'aria-checked': 'false',
        'data-avatar': String(i),
        'aria-label': `${t('common.name')} ${i + 1}`,
      },
      [avatar(i, 32)],
    );

    button.addEventListener('click', () => {
      chosen = i;
      syncAvatars();
    });

    avatarButtons.set(i, button);
    avatarRow.append(button);
  }

  syncAvatars();

  const joinButton = el(
    'button.w-full.rounded-2xl.bg-mint.px-5.py-3.5.text-base.font-extrabold.text-void.transition-transform.active:scale-[0.98]',
    { type: 'button', 'data-action': 'join-room' },
    [t('home.join.cta')],
  );

  const submit = () => {
    const trimmed = nameInput.value.trim() || t('common.namePlaceholder');
    onJoin(trimmed, chosen);
  };

  joinButton.addEventListener('click', submit);
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });

  const card = el('section.glass.flex.flex-col.gap-4.p-5', {}, [
    nameLabel,
    nameInput,
    avatarRow,
    joinButton,
  ]);

  screen.append(
    head,
    card,
    el('div.flex.justify-center', {}, [createLanguageToggle(onLanguageChange)]),
  );

  // Focus the name field so the guest can type straight away.
  queueMicrotask(() => nameInput.focus());

  return { element: screen };
}
