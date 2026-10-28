/**
 * Board geometry for Dots and Boxes.
 *
 * An n x n board has (n + 1) x (n + 1) dots, n * n boxes and 2n(n + 1) lines.
 * Coordinates are in dot units: x grows to the right, y grows downwards and
 * dot (row r, column c) sits at (c, r).
 *
 * Line numbering: horizontal lines come first, row by row; line r * n + c joins
 * dot (r, c) to dot (r, c + 1). Vertical lines follow, row by row; line
 * n(n + 1) + r(n + 1) + c joins dot (r, c) to dot (r + 1, c).
 * Box (r, c) has index r * n + c.
 */

export const MIN_SIZE = 3;
export const MAX_SIZE = 7;

const COLUMN_NAMES = 'abcdefgh';
const topologies = new Map();

/**
 * @typedef {object} Topology
 * @property {number} size boxes per side
 * @property {number} hCount number of horizontal lines (= vertical lines)
 * @property {number} lineCount 2n(n + 1)
 * @property {number} boxCount n * n
 * @property {Int16Array} lineBoxes two entries per line: the boxes it borders, -1 for none
 * @property {Int16Array} boxLines four entries per box: top, right, bottom, left line
 */

/**
 * Returns the shared, read-only topology of an n x n board.
 * @param {number} size boxes per side, MIN_SIZE..MAX_SIZE
 * @returns {Topology}
 */
export function getTopology(size) {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`Board size must be an integer from ${MIN_SIZE} to ${MAX_SIZE}`);
  }
  let topology = topologies.get(size);
  if (!topology) {
    topology = buildTopology(size);
    topologies.set(size, topology);
  }
  return topology;
}

/**
 * Index of the horizontal line from dot (row, col) to dot (row, col + 1).
 * @param {number} size
 * @param {number} row 0..size
 * @param {number} col 0..size - 1
 * @returns {number}
 */
export function hLine(size, row, col) {
  return row * size + col;
}

/**
 * Index of the vertical line from dot (row, col) to dot (row + 1, col).
 * @param {number} size
 * @param {number} row 0..size - 1
 * @param {number} col 0..size
 * @returns {number}
 */
export function vLine(size, row, col) {
  return size * (size + 1) + row * (size + 1) + col;
}

/**
 * Orientation, grid position and end points (in dot units) of a line.
 * @param {Topology} topology
 * @param {number} line
 * @returns {{horizontal: boolean, row: number, col: number, x1: number, y1: number, x2: number, y2: number}}
 */
export function lineGeometry(topology, line) {
  const n = topology.size;
  if (line < topology.hCount) {
    const row = Math.floor(line / n);
    const col = line % n;
    return { horizontal: true, row, col, x1: col, y1: row, x2: col + 1, y2: row };
  }
  const k = line - topology.hCount;
  const row = Math.floor(k / (n + 1));
  const col = k % (n + 1);
  return { horizontal: false, row, col, x1: col, y1: row, x2: col, y2: row + 1 };
}

/**
 * Row and column of a box.
 * @param {Topology} topology
 * @param {number} box
 * @returns {{row: number, col: number}}
 */
export function boxCell(topology, box) {
  return { row: Math.floor(box / topology.size), col: box % topology.size };
}

/**
 * The boxes a line borders (one on the edge of the board, two inside it).
 * @param {Topology} topology
 * @param {number} line
 * @returns {number[]}
 */
export function boxesOfLine(topology, line) {
  const a = topology.lineBoxes[2 * line];
  const b = topology.lineBoxes[2 * line + 1];
  return b < 0 ? [a] : [a, b];
}

/**
 * Finds the line nearest to a point, if it is within half a cell.
 * @param {Topology} topology
 * @param {number} x point in dot units
 * @param {number} y point in dot units
 * @param {(line: number) => boolean} [accept] only lines it accepts are considered
 * @returns {number} line index, or -1 when no accepted line is close enough
 */
export function lineAt(topology, x, y, accept = () => true) {
  let best = -1;
  let bestDistance = 0.5;
  for (let line = 0; line < topology.lineCount; line++) {
    if (!accept(line)) continue;
    const distance = distanceToLine(lineGeometry(topology, line), x, y);
    if (distance < bestDistance || (distance === bestDistance && best < 0)) {
      best = line;
      bestDistance = distance;
    }
  }
  return best;
}

/** Taps farther than this from every line (in cells) are near a box centre. */
const CENTRE_DISTANCE = 0.3;
/** Near a box centre, the nearest undrawn line must win by at least this much. */
const CENTRE_MARGIN = 0.1;

/**
 * The undrawn line a tap or click at (x, y) points at: the nearest undrawn
 * line within half a cell, unless a drawn line is clearly closer to the point,
 * so that tapping a drawn line does not draw one of its neighbours. Near the
 * middle of a box, where two undrawn sides are about as close, the tap is
 * ambiguous and draws nothing.
 * @param {Topology} topology
 * @param {number} x point in dot units
 * @param {number} y point in dot units
 * @param {(line: number) => boolean} isOpen whether a line is still undrawn
 * @param {number} [slack=0.2] how much closer (in cells) a drawn line must be to block the tap
 * @returns {number} line index, or -1
 */
export function lineForPoint(topology, x, y, isOpen, slack = 0.2) {
  const open = lineAt(topology, x, y, isOpen);
  if (open < 0) return -1;
  const distance = distanceToLine(lineGeometry(topology, open), x, y);
  if (distance > CENTRE_DISTANCE) {
    const rival = lineAt(topology, x, y, (line) => line !== open && isOpen(line));
    if (rival >= 0 && distanceToLine(lineGeometry(topology, rival), x, y) - distance < CENTRE_MARGIN) return -1;
  }
  const nearest = lineAt(topology, x, y);
  if (nearest === open || isOpen(nearest)) return open;
  const gap = distance - distanceToLine(lineGeometry(topology, nearest), x, y);
  return gap <= slack ? open : -1;
}

/**
 * Moves a keyboard cursor to a neighbouring line. Left and right step along
 * lines of the same orientation; up and down walk down a column, alternating
 * horizontal and vertical lines. At the edge of the board the cursor stays.
 * @param {Topology} topology
 * @param {number} line current line
 * @param {'up' | 'down' | 'left' | 'right'} direction
 * @returns {number} new line
 */
export function moveCursor(topology, line, direction) {
  const n = topology.size;
  const { horizontal, row, col } = lineGeometry(topology, line);
  if (horizontal) {
    if (direction === 'left' && col > 0) return hLine(n, row, col - 1);
    if (direction === 'right' && col < n - 1) return hLine(n, row, col + 1);
    if (direction === 'up' && row > 0) return vLine(n, row - 1, col);
    if (direction === 'down' && row < n) return vLine(n, row, col);
    return line;
  }
  if (direction === 'left' && col > 0) return vLine(n, row, col - 1);
  if (direction === 'right' && col < n) return vLine(n, row, col + 1);
  if (direction === 'up') return hLine(n, row, Math.min(col, n - 1));
  if (direction === 'down') return hLine(n, row + 1, Math.min(col, n - 1));
  return line;
}

/**
 * Short name of a line by its end dots, e.g. "a1-b1": columns are letters from
 * the left, rows are numbers from the top.
 * @param {Topology} topology
 * @param {number} line
 * @returns {string}
 */
export function lineLabel(topology, line) {
  const { x1, y1, x2, y2 } = lineGeometry(topology, line);
  return `${COLUMN_NAMES[x1]}${y1 + 1}-${COLUMN_NAMES[x2]}${y2 + 1}`;
}

function buildTopology(n) {
  const hCount = n * (n + 1);
  const lineCount = 2 * hCount;
  const boxCount = n * n;
  const lineBoxes = new Int16Array(lineCount * 2).fill(-1);
  const boxLines = new Int16Array(boxCount * 4);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const box = row * n + col;
      const sides = [hLine(n, row, col), vLine(n, row, col + 1), hLine(n, row + 1, col), vLine(n, row, col)];
      sides.forEach((line, i) => {
        boxLines[box * 4 + i] = line;
        const slot = lineBoxes[line * 2] < 0 ? 0 : 1;
        lineBoxes[line * 2 + slot] = box;
      });
    }
  }
  return Object.freeze({ size: n, hCount, lineCount, boxCount, lineBoxes, boxLines });
}

function distanceToLine({ x1, y1, x2, y2 }, x, y) {
  // Lines are axis-aligned unit segments, so clamping gives the nearest point.
  const nx = Math.min(Math.max(x, Math.min(x1, x2)), Math.max(x1, x2));
  const ny = Math.min(Math.max(y, Math.min(y1, y2)), Math.max(y1, y2));
  return Math.hypot(x - nx, y - ny);
}
