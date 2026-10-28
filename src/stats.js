/**
 * Wins, losses and draws against the computer, per level. Pure helpers: the
 * UI loads and saves the object through the storage helper.
 */
import { LEVELS } from './ai.js';
import { HUMAN } from './game.js';

/**
 * @typedef {{wins: number, losses: number, draws: number}} LevelRecord
 * @typedef {{easy: LevelRecord, medium: LevelRecord, hard: LevelRecord}} Stats
 */

/**
 * Turns whatever was read from storage into valid stats; anything missing or
 * malformed counts as zero, so normalizeStats(null) gives empty stats.
 * @param {unknown} raw
 * @returns {Stats}
 */
export function normalizeStats(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const stats = {};
  for (const level of LEVELS) {
    const record = source[level] && typeof source[level] === 'object' ? source[level] : {};
    stats[level] = { wins: count(record.wins), losses: count(record.losses), draws: count(record.draws) };
  }
  return /** @type {Stats} */ (stats);
}

/**
 * Adds a finished game against the computer.
 * @param {Stats} stats
 * @param {'easy' | 'medium' | 'hard'} level
 * @param {0 | 1 | null} winner winning player (the human is player 0), null for a draw
 * @returns {Stats} new stats; the input is not changed
 */
export function recordResult(stats, level, winner) {
  const next = normalizeStats(stats);
  const record = next[level];
  if (!record) throw new RangeError(`Unknown level: ${level}`);
  if (winner === null) record.draws++;
  else if (winner === HUMAN) record.wins++;
  else record.losses++;
  return next;
}

function count(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
