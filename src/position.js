/**
 * Mutable analysis board for the computer players: which lines are drawn, how
 * many sides of each box are drawn, and a Zobrist hash of the drawn lines.
 *
 * Vocabulary used by the analysis:
 * - a box with 3 drawn sides is "capturable" (its last line scores it);
 * - a box with 2 drawn sides is a "chain box";
 * - a box with 0 or 1 drawn sides is a "junction";
 * - a line is "safe" when drawing it gives no box a third side.
 */
import { createRng } from './rng.js';

/** Marks the edge of the board where a walk along a chain leaves it. */
export const GROUND = -1;

const zobristTables = new Map();

/**
 * @typedef {object} Position
 * @property {import('./board.js').Topology} topology
 * @property {Uint8Array} drawn 1 for each drawn line
 * @property {Uint8Array} sides drawn sides per box
 * @property {number} open number of undrawn lines
 * @property {number} hashA first half of the Zobrist hash
 * @property {number} hashB second half of the Zobrist hash
 * @property {Int32Array} keysA Zobrist keys per line
 * @property {Int32Array} keysB Zobrist keys per line
 */

/**
 * Builds an analysis position from a game's line array.
 * @param {import('./board.js').Topology} topology
 * @param {ArrayLike<number>} lines per line: a negative value means not drawn
 * @returns {Position}
 */
export function createPosition(topology, lines) {
  const [keysA, keysB] = zobristKeys(topology.lineCount);
  const position = {
    topology,
    drawn: new Uint8Array(topology.lineCount),
    sides: new Uint8Array(topology.boxCount),
    open: topology.lineCount,
    hashA: 0,
    hashB: 0,
    keysA,
    keysB,
  };
  for (let line = 0; line < topology.lineCount; line++) {
    if (lines[line] >= 0) drawLine(position, line);
  }
  return position;
}

/**
 * Draws a line.
 * @param {Position} position
 * @param {number} line an undrawn line
 * @returns {number} boxes completed by it (0, 1 or 2)
 */
export function drawLine(position, line) {
  position.drawn[line] = 1;
  position.open--;
  position.hashA ^= position.keysA[line];
  position.hashB ^= position.keysB[line];
  const { lineBoxes } = position.topology;
  let completed = 0;
  for (let i = 2 * line; i < 2 * line + 2; i++) {
    const box = lineBoxes[i];
    if (box >= 0 && ++position.sides[box] === 4) completed++;
  }
  return completed;
}

/**
 * Takes back a line drawn with drawLine.
 * @param {Position} position
 * @param {number} line
 */
export function eraseLine(position, line) {
  position.drawn[line] = 0;
  position.open++;
  position.hashA ^= position.keysA[line];
  position.hashB ^= position.keysB[line];
  const { lineBoxes } = position.topology;
  for (let i = 2 * line; i < 2 * line + 2; i++) {
    const box = lineBoxes[i];
    if (box >= 0) position.sides[box]--;
  }
}

/**
 * A 53-bit key of the drawn lines, for transposition tables.
 * @param {Position} position
 * @returns {number}
 */
export function positionKey(position) {
  return (position.hashA >>> 0) * 2097152 + (position.hashB >>> 11);
}

/**
 * The box on the other side of a line, or GROUND on the edge of the board.
 * @param {import('./board.js').Topology} topology
 * @param {number} line
 * @param {number} box one of the boxes the line borders
 * @returns {number}
 */
export function across(topology, line, box) {
  const a = topology.lineBoxes[2 * line];
  return a === box ? topology.lineBoxes[2 * line + 1] : a;
}

/**
 * The first undrawn side of a box other than `except`.
 * @param {Position} position
 * @param {number} box
 * @param {number} [except] a line to skip
 * @returns {number} line index, or -1 if there is none
 */
export function undrawnSide(position, box, except = -1) {
  const { boxLines } = position.topology;
  for (let i = 4 * box; i < 4 * box + 4; i++) {
    const line = boxLines[i];
    if (line !== except && !position.drawn[line]) return line;
  }
  return -1;
}

/**
 * All undrawn lines.
 * @param {Position} position
 * @returns {number[]}
 */
export function undrawnLines(position) {
  const lines = [];
  for (let line = 0; line < position.drawn.length; line++) {
    if (!position.drawn[line]) lines.push(line);
  }
  return lines;
}

/**
 * Undrawn lines that complete a box.
 * @param {Position} position
 * @returns {number[]}
 */
export function captureLines(position) {
  return undrawnLines(position).filter((line) => isCapture(position, line));
}

/**
 * Undrawn lines that give no box a third side.
 * @param {Position} position
 * @param {readonly number[]} [candidates] lines to check, all undrawn lines by default
 * @returns {number[]}
 */
export function safeLines(position, candidates = undrawnLines(position)) {
  return candidates.filter((line) => !position.drawn[line] && isSafe(position, line));
}

/** Whether drawing the (undrawn) line completes a box. */
function isCapture(position, line) {
  return maxSidesAround(position, line) === 3;
}

/** Whether drawing the (undrawn) line gives no box its third side. */
function isSafe(position, line) {
  return maxSidesAround(position, line) < 2;
}

function maxSidesAround(position, line) {
  const { lineBoxes } = position.topology;
  const a = lineBoxes[2 * line];
  const b = lineBoxes[2 * line + 1];
  const sidesA = a >= 0 ? position.sides[a] : 0;
  const sidesB = b >= 0 ? position.sides[b] : 0;
  return Math.max(sidesA, sidesB);
}

function zobristKeys(lineCount) {
  let keys = zobristTables.get(lineCount);
  if (!keys) {
    const rng = createRng(0x5eed + lineCount);
    const random32 = () => Math.floor(rng() * 4294967296) | 0;
    keys = [Int32Array.from({ length: lineCount }, random32), Int32Array.from({ length: lineCount }, random32)];
    zobristTables.set(lineCount, keys);
  }
  return keys;
}
