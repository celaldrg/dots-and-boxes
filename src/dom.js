/**
 * Small DOM helpers for the UI modules. Text is always set with textContent.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The element with this id; throws if the page lacks it.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

/**
 * Creates an HTML element.
 * @param {string} tag
 * @param {Record<string, string>} [attributes]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function html(tag, attributes = {}, text = '') {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text) element.textContent = text;
  return element;
}

/**
 * Creates an SVG element.
 * @param {string} tag
 * @param {Record<string, string | number>} [attributes]
 * @returns {SVGElement}
 */
export function svg(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  setAttributes(element, attributes);
  return element;
}

/**
 * Sets several attributes at once.
 * @param {Element} element
 * @param {Record<string, string | number>} attributes
 */
export function setAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
}

/**
 * Sets the class attribute only when it changes, so running CSS animations
 * are not restarted.
 * @param {Element} element
 * @param {string} value
 */
export function setClass(element, value) {
  if (element.getAttribute('class') !== value) element.setAttribute('class', value);
}

/**
 * Fills every [data-i18n] element with its string and every
 * [data-i18n-label] element with its aria-label.
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function applyTexts(root, t) {
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of root.querySelectorAll('[data-i18n-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nLabel));
  }
}
