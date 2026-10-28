/**
 * Which message the page shows for a game snapshot. Pure: returns i18n keys,
 * the UI translates them.
 */
import { HUMAN } from './game.js';

/**
 * @typedef {ReturnType<typeof import('./game.js').getState>} GameState
 * @typedef {{key: string, player: 0 | 1 | null}} Message the player fills {name}; null for a draw
 */

/**
 * i18n key of a player's name: "you" and "computer" against the computer,
 * "player1" and "player2" in a two-player game.
 * @param {'cpu' | 'pvp'} mode
 * @param {0 | 1} player
 * @returns {string}
 */
export function playerNameKey(mode, player) {
  if (mode === 'cpu') return player === HUMAN ? 'you' : 'computer';
  return player === 0 ? 'player1' : 'player2';
}

/**
 * i18n key of the letter that marks a player's boxes.
 * @param {'cpu' | 'pvp'} mode
 * @param {0 | 1} player
 * @returns {string}
 */
export function playerInitialKey(mode, player) {
  return `${playerNameKey(mode, player)}Initial`;
}

/**
 * The status line: whose turn it is, whether they move again after closing a
 * box, or the result once the game is over.
 * @param {GameState} state
 * @returns {Message}
 */
export function statusMessage(state) {
  if (state.over) return resultMessage(state);
  const last = state.history[state.history.length - 1];
  const again = Boolean(last && last.boxes.length > 0 && last.player === state.turn);
  return { key: (again ? 'again' : 'turn') + speaker(state.mode, state.turn), player: state.turn };
}

/**
 * Headline of a finished game.
 * @param {GameState} state a finished game
 * @returns {Message}
 */
export function resultMessage(state) {
  const winner = state.outcome ? state.outcome.winner : null;
  if (winner === null) return { key: 'resultDraw', player: null };
  if (state.mode === 'pvp') return { key: 'resultPlayerWins', player: winner };
  return { key: winner === HUMAN ? 'resultYouWin' : 'resultComputerWins', player: winner };
}

function speaker(mode, player) {
  if (mode === 'pvp') return 'Player';
  return player === HUMAN ? 'You' : 'Computer';
}
