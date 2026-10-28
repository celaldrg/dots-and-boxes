/**
 * Setup of the next game (board size, mode, level, who starts) and its
 * validation, so that whatever comes from storage or a form is safe to use.
 */
import { MIN_SIZE, MAX_SIZE } from './board.js';
import { MODES } from './game.js';
import { LEVELS } from './ai.js';

/**
 * @typedef {object} Settings
 * @property {number} size boxes per side
 * @property {'cpu' | 'pvp'} mode
 * @property {'easy' | 'medium' | 'hard'} level
 * @property {0 | 1} starter
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({ size: 5, mode: 'cpu', level: 'medium', starter: 0 });

/** Board sizes offered in the setup. */
export const SIZES = Object.freeze(
  Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i),
);

/**
 * Turns stored or submitted values into valid settings; anything unknown
 * falls back to the default. Numbers may arrive as strings (form data).
 * @param {unknown} raw
 * @returns {Settings}
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const size = Number(source.size);
  const starter = Number(source.starter);
  return {
    size: SIZES.includes(size) ? size : DEFAULT_SETTINGS.size,
    mode: MODES.includes(source.mode) ? source.mode : DEFAULT_SETTINGS.mode,
    level: LEVELS.includes(source.level) ? source.level : DEFAULT_SETTINGS.level,
    starter: starter === 1 ? 1 : 0,
  };
}
