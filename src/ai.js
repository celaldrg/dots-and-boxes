/**
 * Computer players.
 *
 * - easy: takes free boxes, otherwise draws a random line, avoiding a third
 *   side of a box most of the time;
 * - medium: always takes free boxes, never draws a third side while a safe line
 *   exists, and when forced opens the chain that gives away the fewest boxes;
 * - hard: like medium while safe lines remain, but searches the last safe
 *   moves for the right chain parity, and in the endgame uses chain and loop
 *   analysis: it keeps control by double-dealing when that pays and opens
 *   chains in the best order (a node-capped search handles junctions).
 */
import { pick } from './rng.js';
import {
  createPosition,
  drawLine,
  eraseLine,
  positionKey,
  undrawnLines,
  captureLines,
  safeLines,
} from './position.js';
import {
  findComponents,
  componentParts,
  openingLines,
  captureDecision,
  loonyValue,
  estimateValue,
} from './chains.js';

export const LEVELS = Object.freeze(['easy', 'medium', 'hard']);

/** How often the easy player avoids a third side when it can. */
const EASY_SAFE_CHANCE = 0.8;
/**
 * The hard player searches the safe-line phase once this few safe lines are
 * left; with more, the search almost never fits under its node cap.
 */
const PARITY_SEARCH_LIMIT = 18;
/** Node caps keep every hard move well under 300 ms on a 7 x 7 board. */
const PARITY_NODE_CAP = 12000;
const ENDGAME_NODE_CAP = 20000;

/**
 * Chooses a line for the player to move.
 * @param {import('./board.js').Topology} topology
 * @param {ArrayLike<number>} lines per line: a negative value means not drawn yet
 * @param {'easy' | 'medium' | 'hard'} level
 * @param {() => number} rng random numbers in [0, 1)
 * @returns {number} the line to draw, or -1 when every line is drawn
 */
export function chooseMove(topology, lines, level, rng) {
  const position = createPosition(topology, lines);
  if (position.open === 0) return -1;
  if (level === 'easy') return easyMove(position, rng);
  if (level === 'medium') return mediumMove(position, rng);
  if (level === 'hard') return hardMove(position, rng);
  throw new RangeError(`Unknown level: ${level}`);
}

function easyMove(position, rng) {
  const captures = captureLines(position);
  if (captures.length > 0) return pick(rng, captures);
  const safe = safeLines(position);
  if (safe.length > 0 && rng() < EASY_SAFE_CHANCE) return pick(rng, safe);
  return pick(rng, undrawnLines(position));
}

function mediumMove(position, rng) {
  const captures = captureLines(position);
  if (captures.length > 0) return pick(rng, captures);
  const safe = safeLines(position);
  if (safe.length > 0) return pick(rng, safe);
  return pick(rng, cheapestOpenings(position));
}

function hardMove(position, rng) {
  const safe = safeLines(position);
  if (safe.length === 0) return endgameMove(position, rng);
  const captures = captureLines(position);
  if (captures.length > 0) return pick(rng, captures);
  if (safe.length <= PARITY_SEARCH_LIMIT) {
    const best = bestSafeLines(position, safe);
    if (best) return pick(rng, best);
  }
  return pick(rng, safe);
}

/** Lines that hand the opponent the fewest boxes, counting greedy captures. */
function cheapestOpenings(position) {
  let fewest = Infinity;
  let best = [];
  for (const line of undrawnLines(position)) {
    const boxes = giveaway(position, line);
    if (boxes < fewest) {
      fewest = boxes;
      best = [line];
    } else if (boxes === fewest) {
      best.push(line);
    }
  }
  return best;
}

function giveaway(position, line) {
  drawLine(position, line);
  const taken = [];
  let boxes = 0;
  for (let next = firstCapture(position); next >= 0; next = firstCapture(position)) {
    boxes += drawLine(position, next);
    taken.push(next);
  }
  for (let i = taken.length - 1; i >= 0; i--) eraseLine(position, taken[i]);
  eraseLine(position, line);
  return boxes;
}

function firstCapture(position) {
  const { topology, sides, drawn } = position;
  for (let box = 0; box < topology.boxCount; box++) {
    if (sides[box] !== 3) continue;
    for (let i = 4 * box; i < 4 * box + 4; i++) {
      const line = topology.boxLines[i];
      if (!drawn[line]) return line;
    }
  }
  return -1;
}

/** Endgame (no safe line): capture, double-deal or open the best component. */
function endgameMove(position, rng) {
  const capture = captureDecision(position);
  if (capture && capture.decline < 0) return capture.take;
  const solver = createSolver(position, ENDGAME_NODE_CAP);
  if (capture) {
    const take = moveValue(position, capture.take, solver);
    const decline = moveValue(position, capture.decline, solver);
    return decline > take ? capture.decline : capture.take;
  }
  return pick(rng, bestLines(position, openingLines(findComponents(position)), solver.value));
}

/**
 * Searches the remaining safe lines, assuming both sides play safe until none
 * is left, and scores the resulting endgame. Every position it visits counts
 * toward the node cap; returns null if the search does not fit under it.
 */
function bestSafeLines(position, safe) {
  const solver = createSolver(position, PARITY_NODE_CAP);
  const table = new Map();
  let nodes = 0;
  let aborted = false;
  const value = (candidates) => {
    const key = positionKey(position);
    const known = table.get(key);
    if (known !== undefined) return known;
    if (++nodes > PARITY_NODE_CAP) {
      aborted = true;
      return 0;
    }
    const moves = safeLines(position, candidates);
    let best = moves.length === 0 ? solver.value() : -Infinity;
    for (const line of moves) {
      drawLine(position, line);
      const score = -value(moves);
      eraseLine(position, line);
      if (aborted) return 0;
      best = Math.max(best, score);
    }
    table.set(key, best);
    return best;
  };
  const best = bestLines(position, safe, () => value(safe));
  return aborted ? null : best;
}

/** The candidate lines with the highest value for the player to move. */
function bestLines(position, candidates, valueAfter) {
  let bestScore = -Infinity;
  let best = [];
  for (const line of candidates) {
    const completed = drawLine(position, line);
    const score = completed > 0 ? completed + valueAfter() : -valueAfter();
    eraseLine(position, line);
    if (score > bestScore) {
      bestScore = score;
      best = [line];
    } else if (score === bestScore) {
      best.push(line);
    }
  }
  return best;
}

function moveValue(position, line, solver) {
  const completed = drawLine(position, line);
  const score = completed > 0 ? completed + solver.value() : -solver.value();
  eraseLine(position, line);
  return score;
}

/**
 * Negamax over canonical endgame moves with a transposition table. Values are
 * the future boxes of the player to move minus the opponent's. Positions
 * without junctions are scored exactly by loonyValue; past the node cap,
 * junction positions are estimated.
 * @returns {{value: () => number}}
 */
function createSolver(position, nodeCap) {
  const table = new Map();
  let nodes = 0;

  const value = () => {
    const key = positionKey(position);
    const known = table.get(key);
    if (known !== undefined) return known;
    const result = evaluate();
    table.set(key, result);
    return result;
  };

  const evaluate = () => {
    const forced = [];
    let gained = 0;
    let capture = captureDecision(position);
    while (capture && capture.decline < 0) {
      gained += drawLine(position, capture.take);
      forced.push(capture.take);
      capture = captureDecision(position);
    }
    let result = 0;
    if (capture) result = decide(capture);
    else if (position.open > 0) result = openingsValue();
    for (let i = forced.length - 1; i >= 0; i--) eraseLine(position, forced[i]);
    return gained + result;
  };

  const decide = (capture) => {
    nodes++;
    const take = drawLine(position, capture.take) + value();
    eraseLine(position, capture.take);
    drawLine(position, capture.decline);
    const decline = -value();
    eraseLine(position, capture.decline);
    return Math.max(take, decline);
  };

  const openingsValue = () => {
    const components = findComponents(position);
    if (components.junctions.length === 0) return loonyValue(componentParts(components));
    if (++nodes > nodeCap) return estimateValue(position, components);
    let best = -Infinity;
    for (const line of openingLines(components)) {
      drawLine(position, line);
      best = Math.max(best, -value());
      eraseLine(position, line);
    }
    return best;
  };

  return { value };
}
