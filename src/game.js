/**
 * Game state and rules of Dots and Boxes.
 *
 * Players take turns drawing one line between two neighbouring dots. A line
 * that closes a box (or two) scores it for the player, who then moves again.
 * The game ends when every line is drawn; the higher score wins.
 *
 * Players are 0 and 1. Against the computer, player 0 is the human.
 */
import { getTopology, boxesOfLine } from './board.js';
import { createRng } from './rng.js';
import { chooseMove, LEVELS } from './ai.js';

export const MODES = Object.freeze(['cpu', 'pvp']);
export const HUMAN = 0;
export const COMPUTER = 1;

/**
 * @typedef {object} GameOptions
 * @property {number} [size=5] boxes per side, 3..7
 * @property {'cpu' | 'pvp'} [mode='cpu'] against the computer or two players on one device
 * @property {'easy' | 'medium' | 'hard'} [level='medium'] computer level
 * @property {0 | 1} [starter=0] player who draws the first line
 * @property {number} [seed=1] seed for the computer's random choices
 *
 * @typedef {object} Move
 * @property {number} line
 * @property {0 | 1} player
 * @property {number[]} boxes boxes the line closed
 *
 * @typedef {object} Game
 * @property {number} size
 * @property {'cpu' | 'pvp'} mode
 * @property {'easy' | 'medium' | 'hard'} level
 * @property {0 | 1} starter
 * @property {import('./board.js').Topology} topology
 * @property {Int8Array} lines player who drew each line, -1 if undrawn
 * @property {Int8Array} boxes owner of each box, -1 if open
 * @property {[number, number]} scores
 * @property {0 | 1} turn player to move
 * @property {Move[]} history
 * @property {() => number} rng
 */

/**
 * Starts a new game.
 * @param {GameOptions} [options]
 * @returns {Game}
 */
export function createGame(options = {}) {
  const { size = 5, mode = 'cpu', level = 'medium', starter = 0, seed = 1 } = options;
  if (!MODES.includes(mode)) throw new RangeError(`Unknown mode: ${mode}`);
  if (!LEVELS.includes(level)) throw new RangeError(`Unknown level: ${level}`);
  if (starter !== 0 && starter !== 1) throw new RangeError('starter must be 0 or 1');
  const topology = getTopology(size);
  return {
    size,
    mode,
    level,
    starter,
    topology,
    lines: new Int8Array(topology.lineCount).fill(-1),
    boxes: new Int8Array(topology.boxCount).fill(-1),
    scores: [0, 0],
    turn: starter,
    history: [],
    rng: createRng(seed),
  };
}

/**
 * Whether the player to move may draw this line now.
 * @param {Game} game
 * @param {number} line
 * @returns {boolean}
 */
export function isLegal(game, line) {
  return Number.isInteger(line) && line >= 0 && line < game.lines.length && game.lines[line] < 0;
}

/**
 * Draws a line for the player to move. Closing boxes scores them and gives the
 * same player another move; otherwise the turn passes.
 * @param {Game} game
 * @param {number} line
 * @returns {{line: number, player: 0 | 1, boxes: number[], extraTurn: boolean, over: boolean} | null}
 *   what happened, or null if the line cannot be drawn
 */
export function playLine(game, line) {
  if (!isLegal(game, line)) return null;
  const player = game.turn;
  game.lines[line] = player;
  const boxes = boxesOfLine(game.topology, line).filter((box) => isClosed(game, box));
  for (const box of boxes) game.boxes[box] = player;
  game.scores[player] += boxes.length;
  const extraTurn = boxes.length > 0;
  if (!extraTurn) game.turn = 1 - player;
  game.history.push({ line, player, boxes });
  return { line, player, boxes: [...boxes], extraTurn, over: isOver(game) };
}

/**
 * Whether there is a move to take back. Against the computer only the human's
 * moves can be taken back.
 * @param {Game} game
 * @returns {boolean}
 */
export function canUndo(game) {
  if (game.mode === 'cpu') return game.history.some((move) => move.player === HUMAN);
  return game.history.length > 0;
}

/**
 * Takes back the last move. Against the computer it also takes back the
 * computer's reply, so the human is to move again.
 * @param {Game} game
 * @returns {number} number of lines taken back
 */
export function undo(game) {
  if (!canUndo(game)) return 0;
  let count = 0;
  if (game.mode === 'cpu') {
    while (game.history[game.history.length - 1].player === COMPUTER) {
      popMove(game);
      count++;
    }
  }
  popMove(game);
  return count + 1;
}

/**
 * Whether every line has been drawn.
 * @param {Game} game
 * @returns {boolean}
 */
export function isOver(game) {
  return game.history.length === game.lines.length;
}

/**
 * Whether the computer should move now.
 * @param {Game} game
 * @returns {boolean}
 */
export function isComputerTurn(game) {
  return game.mode === 'cpu' && game.turn === COMPUTER && !isOver(game);
}

/**
 * Asks the computer player of the game's level for a line for the player to
 * move (does not draw it).
 * @param {Game} game
 * @returns {number} line index, or -1 when the game is over
 */
export function computerMove(game) {
  return chooseMove(game.topology, game.lines, game.level, game.rng);
}

/**
 * Final result.
 * @param {Game} game
 * @returns {{winner: 0 | 1 | null, scores: [number, number]} | null}
 *   null while the game is running; winner null means a draw
 */
export function outcome(game) {
  if (!isOver(game)) return null;
  const [a, b] = game.scores;
  return { winner: a === b ? null : a > b ? 0 : 1, scores: [a, b] };
}

/**
 * A plain snapshot of the game for rendering.
 * @param {Game} game
 * @returns {{size: number, mode: string, level: string, starter: 0 | 1, turn: 0 | 1,
 *   scores: [number, number], lines: number[], boxes: number[], lastLine: number,
 *   lastBoxes: number[], history: Move[], over: boolean,
 *   outcome: ReturnType<typeof outcome>, canUndo: boolean, computerTurn: boolean}}
 */
export function getState(game) {
  const last = game.history[game.history.length - 1];
  return {
    size: game.size,
    mode: game.mode,
    level: game.level,
    starter: game.starter,
    turn: game.turn,
    scores: [game.scores[0], game.scores[1]],
    lines: Array.from(game.lines),
    boxes: Array.from(game.boxes),
    lastLine: last ? last.line : -1,
    lastBoxes: last ? [...last.boxes] : [],
    history: game.history.map((move) => ({ ...move, boxes: [...move.boxes] })),
    over: isOver(game),
    outcome: outcome(game),
    canUndo: canUndo(game),
    computerTurn: isComputerTurn(game),
  };
}

function isClosed(game, box) {
  const { boxLines } = game.topology;
  for (let i = 4 * box; i < 4 * box + 4; i++) {
    if (game.lines[boxLines[i]] < 0) return false;
  }
  return true;
}

function popMove(game) {
  const move = game.history.pop();
  game.lines[move.line] = -1;
  for (const box of move.boxes) game.boxes[box] = -1;
  game.scores[move.player] -= move.boxes.length;
  game.turn = move.player;
}
