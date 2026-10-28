/**
 * Fixed mid-game position for the README screenshot (the "?demo" page).
 */
import { createGame, playLine } from './game.js';

/**
 * The first 39 lines of a real 5 x 5 game between two medium computer players.
 * You (player 0) lead 3-2 and must open one of a ten-box chain, a six-box
 * loop and a four-box loop.
 */
const DEMO_LINES = Object.freeze([
  50, 29, 53, 47, 30, 18, 8, 0, 44, 22, 25, 42, 37, 38, 33, 58, 49, 15, 39, 19,
  45, 36, 27, 1, 28, 54, 32, 35, 41, 4, 26, 21, 16, 52, 24, 59, 34, 9, 3,
]);

/**
 * Builds the demo game: 5 x 5 against the computer, the human to move.
 * @param {Omit<import('./game.js').GameOptions, 'size' | 'mode' | 'starter'>} [options] level and seed
 * @returns {import('./game.js').Game}
 */
export function createDemoGame(options = {}) {
  const game = createGame({ ...options, size: 5, mode: 'cpu', starter: 0 });
  for (const line of DEMO_LINES) playLine(game, line);
  return game;
}
