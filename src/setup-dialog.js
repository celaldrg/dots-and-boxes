/**
 * The "New game" dialog: board size, mode, computer level and who starts.
 */
import { SIZES, normalizeSettings } from './settings.js';
import { playerNameKey } from './status.js';
import { byId, html } from './dom.js';

const FIELDS = Object.freeze(['size', 'mode', 'level', 'starter']);

/**
 * @typedef {(key: string, params?: Record<string, string | number>) => string} Translate
 *
 * @typedef {object} SetupDialog
 * @property {(settings: import('./settings.js').Settings, t: Translate) => void} open
 * @property {(t: Translate) => void} relabel refreshes the strings set from code
 * @property {() => boolean} isOpen
 */

/**
 * Binds the dialog to its elements in the page.
 * @param {{onStart: (settings: import('./settings.js').Settings) => void}} handlers
 * @returns {SetupDialog}
 */
export function createSetupDialog(handlers) {
  const dialog = /** @type {HTMLDialogElement} */ (byId('setup'));
  const form = /** @type {HTMLFormElement} */ (byId('setup-form'));
  const levelField = /** @type {HTMLFieldSetElement} */ (byId('level-field'));
  const starterLabels = [byId('starter-0'), byId('starter-1')];
  const sizeLabels = SIZES.map((size) => sizeOption(byId('size-options'), size));
  let t = /** @type {Translate} */ ((key) => key);

  const value = (name) => /** @type {RadioNodeList} */ (form.elements.namedItem(name)).value;

  function relabel(translate) {
    t = translate;
    sizeLabels.forEach((label, i) => {
      label.textContent = t('sizeOption', { n: SIZES[i] });
    });
    const mode = value('mode');
    starterLabels.forEach((label, player) => {
      label.textContent = t(playerNameKey(mode === 'pvp' ? 'pvp' : 'cpu', player));
    });
    levelField.disabled = mode === 'pvp';
  }

  form.addEventListener('change', () => relabel(t));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const settings = normalizeSettings(Object.fromEntries(FIELDS.map((name) => [name, value(name)])));
    dialog.close();
    handlers.onStart(settings);
  });
  byId('setup-cancel').addEventListener('click', () => dialog.close());

  return {
    open(settings, translate) {
      for (const name of FIELDS) {
        const input = form.querySelector(`input[name="${name}"][value="${settings[name]}"]`);
        if (input) input.checked = true;
      }
      relabel(translate);
      dialog.showModal();
    },
    relabel,
    isOpen: () => dialog.open,
  };
}

/** Adds one board-size radio button and returns its label element. */
function sizeOption(group, size) {
  const option = html('label', { class: 'option' });
  const label = html('span');
  option.append(html('input', { type: 'radio', name: 'size', value: String(size) }), label);
  group.append(option);
  return label;
}
