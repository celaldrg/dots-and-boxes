/**
 * Chain and loop analysis ("strings and coins") of Dots and Boxes positions.
 *
 * Once no safe line is left, the open boxes form chains (runs of boxes with two
 * drawn sides that end at the edge of the board or at a junction), loops
 * (closed runs) and junctions (boxes with three or four undrawn sides). The
 * player who must move opens one of them; the opponent then either takes it
 * all and must open the next one, or keeps control by declining the last two
 * boxes of a chain or the last four of a loop ("double-dealing").
 */
import { GROUND, across, undrawnSide } from './position.js';

const LOOP = -2;
const CACHE_LIMIT = 50000;
const loonyCache = new Map();

/**
 * @typedef {object} Chain
 * @property {number} length boxes in the chain
 * @property {[number, number]} ends what each end runs into: GROUND or a junction box
 * @property {number} open line that opens it: an end line, or the middle line of a 2-chain
 *
 * @typedef {object} Loop
 * @property {number} length boxes in the loop
 * @property {number} open line that opens it
 *
 * @typedef {object} Components
 * @property {Chain[]} chains
 * @property {Loop[]} loops
 * @property {number[]} junctions open boxes with fewer than two drawn sides
 *
 * @typedef {object} CaptureChoice
 * @property {number} take line that captures a box
 * @property {number} decline double-dealing line that hands the last boxes over instead, -1 if taking is clearly right
 * @property {number} cost boxes handed over by declining (2 for a chain, 4 for a loop)
 */

/**
 * Splits the open boxes of a position into chains, loops and junctions.
 * Meant for positions in which no box is capturable.
 * @param {import('./position.js').Position} position
 * @returns {Components}
 */
export function findComponents(position) {
  const { topology, sides } = position;
  const seen = new Uint8Array(topology.boxCount);
  const chains = [];
  const loops = [];
  const junctions = [];
  for (let box = 0; box < topology.boxCount; box++) {
    if (sides[box] <= 1) junctions.push(box);
    if (sides[box] !== 2 || seen[box]) continue;
    seen[box] = 1;
    const first = undrawnSide(position, box);
    const second = undrawnSide(position, box, first);
    const forward = walkChain(position, box, first, seen);
    if (forward.end === LOOP) {
      loops.push({ length: forward.count + 1, open: first });
      continue;
    }
    const backward = walkChain(position, box, second, seen);
    const length = forward.count + backward.count + 1;
    const open = length === 2 ? (forward.count === 1 ? first : second) : forward.line;
    chains.push({ length, ends: [forward.end, backward.end], open });
  }
  return { chains, loops, junctions };
}

/**
 * Chain lengths as positive numbers and loop lengths as negative numbers.
 * @param {Components} components
 * @returns {number[]}
 */
export function componentParts({ chains, loops }) {
  return [...chains.map((chain) => chain.length), ...loops.map((loop) => -loop.length)];
}

/**
 * One opening line per component worth trying. Chains between the edges and
 * loops that look alike lead to the same play, so only one of each is kept.
 * @param {Components} components
 * @returns {number[]}
 */
export function openingLines({ chains, loops }) {
  const lines = [];
  const seenShapes = new Set();
  const addOnce = (shape, line) => {
    if (seenShapes.has(shape)) return;
    seenShapes.add(shape);
    lines.push(line);
  };
  for (const chain of chains) {
    if (chain.ends[0] === GROUND && chain.ends[1] === GROUND) addOnce(chain.length, chain.open);
    else lines.push(chain.open);
  }
  for (const loop of loops) addOnce(-loop.length, loop.open);
  return lines;
}

/**
 * Looks at a capturable box (three sides drawn) and the boxes behind it.
 * Taking is clearly right unless they are the last two boxes of a chain or the
 * last four of an opened loop: then declining may keep control.
 * @param {import('./position.js').Position} position
 * @param {number} box a box with three drawn sides
 * @returns {CaptureChoice}
 */
export function classifyCapture(position, box) {
  const { topology, sides } = position;
  const take = undrawnSide(position, box);
  const free = { take, decline: -1, cost: 0 };
  const second = across(topology, take, box);
  if (second === GROUND || sides[second] !== 2) return free;
  let previousLine = take;
  let current = second;
  let length = 2;
  for (;;) {
    const nextLine = undrawnSide(position, current, previousLine);
    const next = across(topology, nextLine, current);
    if (next === GROUND || sides[next] <= 1) {
      return length === 2 ? { take, decline: nextLine, cost: 2 } : free;
    }
    if (sides[next] === 3) {
      return length === 3 ? { take, decline: previousLine, cost: 4 } : free;
    }
    if (length === 3) return free;
    previousLine = nextLine;
    current = next;
    length++;
  }
}

/**
 * What a player facing capturable boxes has to decide.
 * When several pieces could be declined, the costliest is taken first so that
 * the cheapest decision is the one left for last.
 * @param {import('./position.js').Position} position
 * @returns {CaptureChoice | null} null when nothing is capturable; `decline` is -1 when taking needs no thought
 */
export function captureDecision(position) {
  const { topology, sides } = position;
  const choices = [];
  for (let box = 0; box < topology.boxCount; box++) {
    if (sides[box] !== 3) continue;
    const choice = classifyCapture(position, box);
    if (choice.decline < 0) return choice;
    if (!choices.some((other) => other.decline === choice.decline)) choices.push(choice);
  }
  if (choices.length === 0) return null;
  if (choices.length === 1) return choices[0];
  const costliest = choices.reduce((a, b) => (b.cost > a.cost ? b : a));
  return { take: costliest.take, decline: -1, cost: 0 };
}

/**
 * Exact value of an endgame of independent chains and loops for the player who
 * must open one of them: their future boxes minus the opponent's, with best
 * play on both sides. Chains of one or two boxes give no choice (a 2-chain is
 * opened in the middle); longer chains and loops may be declined.
 * @param {readonly number[]} parts chain lengths as positive numbers, loop lengths as negative numbers
 * @returns {number}
 */
export function loonyValue(parts) {
  return sortedLoonyValue([...parts].sort((a, b) => a - b));
}

/**
 * Value of a position with no safe line and nothing capturable for the player
 * to move. Exact without junctions; otherwise each junction is assumed to end
 * up joining its two longest neighbouring chains.
 * @param {import('./position.js').Position} position
 * @param {Components} [components]
 * @returns {number}
 */
export function estimateValue(position, components = findComponents(position)) {
  const { chains, loops, junctions } = components;
  if (junctions.length === 0) return loonyValue(componentParts(components));
  const parent = chains.map((_, i) => i);
  const length = chains.map((chain) => chain.length);
  const closed = chains.map(() => false);
  const root = (i) => {
    while (parent[i] !== i) i = parent[i];
    return i;
  };
  const incidences = new Map(junctions.map((box) => [box, []]));
  chains.forEach((chain, i) => {
    for (const end of chain.ends) if (end !== GROUND) incidences.get(end).push(i);
  });
  for (const box of junctions) {
    const groups = incidences.get(box).map(root).sort((a, b) => length[b] - length[a]);
    if (groups.length < 2) continue;
    const [a, b] = groups;
    if (a === b) {
      closed[a] = true;
      length[a] += 1;
    } else {
      parent[b] = a;
      length[a] += length[b] + 1;
      closed[a] = closed[a] || closed[b];
    }
  }
  const parts = loops.map((loop) => -loop.length);
  chains.forEach((_, i) => {
    if (root(i) === i) parts.push(closed[i] ? -length[i] : length[i]);
  });
  return loonyValue(parts);
}

function sortedLoonyValue(parts) {
  if (parts.length === 0) return 0;
  const key = parts.join(',');
  const known = loonyCache.get(key);
  if (known !== undefined) return known;
  let best = -Infinity;
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && parts[i] === parts[i - 1]) continue;
    const rest = sortedLoonyValue([...parts.slice(0, i), ...parts.slice(i + 1)]);
    best = Math.max(best, openingValue(parts[i], rest));
  }
  if (loonyCache.size >= CACHE_LIMIT) loonyCache.clear();
  loonyCache.set(key, best);
  return best;
}

/**
 * Value for the opener of opening one part, where `rest` is the value of the
 * remaining parts for whoever has to open next.
 */
function openingValue(part, rest) {
  if (part < 0) {
    const size = -part;
    return Math.min(-size - rest, 8 - size + rest);
  }
  if (part <= 2) return -part - rest;
  return Math.min(-part - rest, 4 - part + rest);
}

/**
 * Follows a chain from `start` through `via` while boxes have two drawn sides.
 * @returns {{count: number, line: number, end: number}} boxes passed, last line crossed,
 *   and where the walk stopped: GROUND, LOOP (back at start) or a junction box
 */
function walkChain(position, start, via, seen) {
  const { topology, sides } = position;
  let line = via;
  let box = start;
  let count = 0;
  for (;;) {
    const next = across(topology, line, box);
    if (next === GROUND) return { count, line, end: GROUND };
    if (next === start) return { count, line, end: LOOP };
    if (sides[next] !== 2) return { count, line, end: next };
    seen[next] = 1;
    count++;
    line = undrawnSide(position, next, line);
    box = next;
  }
}
