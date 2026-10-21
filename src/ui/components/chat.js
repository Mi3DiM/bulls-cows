/**
 * The chat panel.
 *
 * Messages are inserted with `textContent`, so a player can type whatever
 * they like without it ever becoming markup.
 */

import { el, elButton, elInput, clear } from '../dom.js';
import { t } from '../../i18n/index.js';

/**
 * @typedef {object} ChatEntry
 * @property {string} from
 * @property {string} name
 * @property {string} text
 * @property {number} at
 */

/**
 * Creates the chat panel.
 *
 * @param {object} options
 * @param {(text: string) => void} options.onSend
 */
export function createChat({ onSend }) {
  const panel = el('section flex min-h-0 flex-col gap-3', { 'data-testid': 'chat' });

  panel.append(el('h2 font-display text-lg font-extrabold', { text: t('lobby.chat') }));

  const log = el(
    'div flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-violet/20 bg-panel-soft/40 p-2.5',
    { 'data-testid': 'chat-log', role: 'log', 'aria-live': 'polite' },
  );

  const form = el('form flex gap-2', { 'data-testid': 'chat-form' });

  const input = elInput({
    class: 'flex-1 min-w-0 rounded-xl border border-violet/25 bg-panel-soft px-3 py-2 text-sm',
    type: 'text',
    maxlength: '200',
    placeholder: t('lobby.chatPlaceholder'),
    'aria-label': t('lobby.chatPlaceholder'),
    autocomplete: 'off',
    'data-testid': 'chat-input',
  });

  const send = elButton(
    {
      class:
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint text-void transition-transform active:scale-95',
      type: 'submit',
      'aria-label': t('lobby.send'),
      title: t('lobby.send'),
    },
    [svgSend()],
  );

  form.append(input, send);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = '';
  });

  panel.append(log, form);

  return {
    element: panel,
    /**
     * Appends a message.
     *
     * @param {ChatEntry} entry
     */
    append(entry) {
      const bubble = el('div rounded-lg border border-violet/15 bg-panel/70 px-2.5 py-1.5', {
        'data-chat-from': entry.from,
      });

      bubble.append(
        el('span text-[10px] font-bold text-cyan', { text: entry.name }),
        el('p break-words text-sm text-text', { text: entry.text }),
      );

      log.append(bubble);
      log.scrollTop = log.scrollHeight;
    },
    /**
     * Clears the log.
     */
    clear() {
      clear(log);
    },
  };
}

/**
 * The send icon, built here so the chat module has no import cycle.
 *
 * @returns {SVGElement}
 */
function svgSend() {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('width', '20');
  node.setAttribute('height', '20');
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', 'currentColor');
  node.setAttribute('stroke-width', '2');
  node.setAttribute('stroke-linecap', 'round');
  node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z');
  node.append(path);

  return node;
}
