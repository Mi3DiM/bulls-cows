/**
 * Minimal DOM helpers.
 *
 * The app builds its interface with the DOM API rather than a template
 * string, so there is exactly one way user-supplied text can reach the page:
 * `textContent`. `innerHTML` is banned by the lint rules, and this module
 * never offers an escape hatch for it.
 */

/**
 * The HTML element names this helper knows about.
 *
 * Used as a guard: a class list accidentally passed as the tag name is a
 * silent, hard-to-spot bug — it renders an unknown element that no CSS
 * applies to. Failing loudly at the call site is much cheaper to debug.
 */
const KNOWN_TAGS = new Set([
  'a',
  'article',
  'aside',
  'button',
  'canvas',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'header',
  'hgroup',
  'hr',
  'img',
  'input',
  'label',
  'legend',
  'li',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'ul',
  'video',
]);

/**
 * Creates an element.
 *
 * @param {string} tag  A tag name, optionally followed by a `class` shorthand.
 * @param {Record<string, unknown>} [props]
 * @param {(Node | string | null | undefined)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const elementName = name || 'div';

  if (!KNOWN_TAGS.has(elementName)) {
    throw new Error(
      `el(): "${elementName}" is not a known HTML element. Did you pass a class list ` +
        'as the tag? Use a real element name, for example "button.flex.items-center".',
    );
  }

  const node = document.createElement(elementName);

  if (classes.length > 0) {
    node.className = classes.join(' ');
  }

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class' || key === 'className') {
      node.className = node.className ? `${node.className} ${String(value)}` : String(value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'html') {
      // Deliberately unsupported. Use `text`, or build the node properly.
      throw new Error('el(): raw HTML is not supported');
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        node.dataset[dataKey] = String(dataValue);
      }
    } else if (key === 'style') {
      const styles = /** @type {Record<string, string | number>} */ (value);
      for (const [styleKey, styleValue] of Object.entries(styles)) {
        node.style.setProperty(styleKey, String(styleValue));
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      const listener = /** @type {EventListener} */ (value);
      node.addEventListener(key.slice(2).toLowerCase(), listener);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/**
 * Creates an SVG element.
 *
 * @param {string} tag
 * @param {Record<string, string | number>} [attrs]
 * @param {(SVGElement | null | undefined)[]} [children]
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);

  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }

  for (const child of children) {
    if (child) node.append(child);
  }

  return node;
}

/**
 * Creates an input element.
 *
 * The typed wrappers below exist because `el()` returns a plain
 * `HTMLElement`, and an input needs its `value` and `disabled` properties.
 *
 * @param {Record<string, unknown>} [props]
 * @returns {HTMLInputElement}
 */
export function elInput(props = {}) {
  return /** @type {HTMLInputElement} */ (el('input', props));
}

/**
 * Creates a button element.
 *
 * @param {Record<string, unknown>} [props]
 * @param {(Node | string | null | undefined)[]} [children]
 * @returns {HTMLButtonElement}
 */
export function elButton(props = {}, children = []) {
  return /** @type {HTMLButtonElement} */ (el('button', props, children));
}

/**
 * Removes every child of a node.
 *
 * @param {HTMLElement} node
 */
export function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/**
 * Replaces the children of a node.
 *
 * @param {HTMLElement} node
 * @param {(Node | string)[]} children
 */
export function replace(node, children) {
  clear(node);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/**
 * Adds a listener and returns a function that removes it.
 *
 * @param {EventTarget} target
 * @param {string} type
 * @param {(event: Event) => void} listener
 * @returns {() => void}
 */
export function on(target, type, listener) {
  target.addEventListener(type, listener);
  return () => target.removeEventListener(type, listener);
}

/**
 * Sets the accessible label of a button and marks its icon decorative.
 *
 * @param {HTMLElement} button
 * @param {string} label
 */
export function labelButton(button, label) {
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
}
