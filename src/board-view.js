/**
 * The board as SVG: dots, lines and boxes, plus the pointer and keyboard input
 * that becomes line picks. One cell is CELL user units wide and dot (row, col)
 * sits at (col * CELL, row * CELL); half a cell of margin surrounds the dots,
 * so every line's hit area lies inside the picture.
 */
import { boxCell, hLine, lineForPoint, lineGeometry, moveCursor } from './board.js';
import { setAttributes, setClass, svg } from './dom.js';

const CELL = 100;
const BOX_INSET = 11;
const DOT_RADIUS = 8;
const RING_HALF_WIDTH = 17;
const RING_END_GAP = 15;
const ARROWS = Object.freeze({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' });

/**
 * @typedef {ReturnType<typeof import('./game.js').getState>} GameState
 *
 * @typedef {object} BoardLook
 * @property {boolean} interactive whether the player to move may draw a line now
 * @property {string[]} initials letter shown in each player's boxes
 *
 * @typedef {object} BoardHandlers
 * @property {(line: number) => void} onPick a line was chosen to be drawn
 * @property {(line: number) => void} onCursor the keyboard cursor moved to a line
 *
 * @typedef {object} BoardView
 * @property {(topology: import('./board.js').Topology) => void} reset builds an empty board
 * @property {(state: GameState, look: BoardLook) => void} update shows a game snapshot
 */

/**
 * Creates the board inside a focusable host element.
 * @param {HTMLElement} host receives the SVG and the keyboard input
 * @param {BoardHandlers} handlers
 * @returns {BoardView}
 */
export function createBoardView(host, handlers) {
  const root = svg('svg', { class: 'board-svg', 'aria-hidden': 'true', focusable: 'false' });
  host.prepend(root);
  let topology = null;
  let parts = null;
  let state = null;
  let interactive = false;
  let hover = -1;
  let cursor = 0;
  let keyboard = false;
  let activePointer = null;

  function reset(nextTopology) {
    topology = nextTopology;
    parts = buildBoard(root, topology);
    state = null;
    hover = -1;
    cursor = centreLine(topology);
  }

  function update(nextState, look) {
    const previous = state;
    state = nextState;
    interactive = look.interactive;
    paintLines(parts, state, previous);
    paintBoxes(parts, state, previous, look.initials);
    paintHalo(parts, topology, state);
    root.classList.toggle('interactive', interactive);
    refreshMarks();
  }

  /** Redraws the hover or cursor preview and the keyboard ring. */
  function refreshMarks() {
    if (!parts || !state) return;
    const target = keyboard ? cursor : hover;
    if (interactive && target >= 0 && state.lines[target] < 0) {
      setAttributes(parts.preview, endpoints(topology, target));
      setClass(parts.preview, `preview visible p${state.turn}`);
    } else {
      setClass(parts.preview, 'preview');
    }
    if (keyboard && document.activeElement === host) {
      setAttributes(parts.ring, ringRect(topology, cursor));
      setClass(parts.ring, 'cursor-ring visible');
    } else {
      setClass(parts.ring, 'cursor-ring');
    }
  }

  function lineUnder(event) {
    if (!interactive || !state) return -1;
    const matrix = root.getScreenCTM();
    if (!matrix) return -1;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return lineForPoint(topology, point.x / CELL, point.y / CELL, (line) => state.lines[line] < 0);
  }

  root.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    activePointer = event.pointerId;
    root.setPointerCapture(event.pointerId);
    keyboard = false;
    hover = lineUnder(event);
    refreshMarks();
  });

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerId !== activePointer) return;
    hover = lineUnder(event);
    refreshMarks();
  });

  root.addEventListener('pointerup', (event) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    const line = lineUnder(event);
    hover = event.pointerType === 'mouse' ? line : -1;
    if (line >= 0) {
      cursor = line;
      handlers.onPick(line);
    }
    refreshMarks();
  });

  root.addEventListener('pointercancel', () => {
    activePointer = null;
    hover = -1;
    refreshMarks();
  });

  root.addEventListener('pointerleave', () => {
    if (activePointer !== null) return;
    hover = -1;
    refreshMarks();
  });

  host.addEventListener('keydown', (event) => {
    if (!topology || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ARROWS[event.key];
    if (direction) {
      event.preventDefault();
      // The first key press only shows the cursor where it is.
      if (keyboard) cursor = moveCursor(topology, cursor, direction);
      keyboard = true;
      refreshMarks();
      handlers.onCursor(cursor);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      keyboard = true;
      refreshMarks();
      if (interactive && state && state.lines[cursor] < 0) handlers.onPick(cursor);
      else handlers.onCursor(cursor);
    }
  });

  host.addEventListener('focus', () => {
    keyboard = host.matches(':focus-visible');
    refreshMarks();
    if (keyboard) handlers.onCursor(cursor);
  });

  host.addEventListener('blur', () => {
    keyboard = false;
    refreshMarks();
  });

  return { reset, update };
}

function buildBoard(root, topology) {
  const n = topology.size;
  const span = n * CELL + CELL;
  root.setAttribute('viewBox', `${-CELL / 2} ${-CELL / 2} ${span} ${span}`);

  const boxLayer = svg('g', { class: 'boxes' });
  const boxes = [];
  for (let box = 0; box < topology.boxCount; box++) {
    const { row, col } = boxCell(topology, box);
    const group = svg('g', { class: 'box' });
    const label = svg('text', { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
    const size = CELL - 2 * BOX_INSET;
    group.append(svg('rect', { x: col * CELL + BOX_INSET, y: row * CELL + BOX_INSET, width: size, height: size, rx: 12 }), label);
    boxLayer.append(group);
    boxes.push({ group, label });
  }

  const lineLayer = svg('g', { class: 'lines' });
  const lines = [];
  for (let line = 0; line < topology.lineCount; line++) {
    const element = svg('line', { class: 'edge', ...endpoints(topology, line) });
    lineLayer.append(element);
    lines.push(element);
  }

  const dotLayer = svg('g', { class: 'dots' });
  for (let row = 0; row <= n; row++) {
    for (let col = 0; col <= n; col++) dotLayer.append(svg('circle', { cx: col * CELL, cy: row * CELL, r: DOT_RADIUS }));
  }

  const halo = svg('line', { class: 'halo' });
  const preview = svg('line', { class: 'preview' });
  const ring = svg('rect', { class: 'cursor-ring', rx: RING_HALF_WIDTH });
  root.replaceChildren(boxLayer, halo, lineLayer, preview, dotLayer, ring);
  return { boxes, lines, halo, preview, ring };
}

function paintLines(parts, state, previous) {
  state.lines.forEach((owner, line) => {
    if (owner < 0) {
      setClass(parts.lines[line], 'edge');
      return;
    }
    const fresh = previous !== null && previous.lines[line] < 0;
    setClass(parts.lines[line], `edge drawn p${owner}${fresh ? ' fresh' : ''}`);
  });
}

function paintBoxes(parts, state, previous, initials) {
  state.boxes.forEach((owner, box) => {
    const { group, label } = parts.boxes[box];
    if (owner < 0) {
      setClass(group, 'box');
      label.textContent = '';
      return;
    }
    const fresh = previous !== null && previous.boxes[box] < 0;
    setClass(group, `box owned p${owner}${fresh ? ' pulse' : ''}`);
    label.textContent = initials[owner];
  });
}

function paintHalo(parts, topology, state) {
  if (state.lastLine < 0) {
    setClass(parts.halo, 'halo');
    return;
  }
  setAttributes(parts.halo, endpoints(topology, state.lastLine));
  setClass(parts.halo, `halo visible p${state.lines[state.lastLine]}`);
}

function endpoints(topology, line) {
  const { x1, y1, x2, y2 } = lineGeometry(topology, line);
  return { x1: x1 * CELL, y1: y1 * CELL, x2: x2 * CELL, y2: y2 * CELL };
}

function ringRect(topology, line) {
  const { horizontal, x1, y1 } = lineGeometry(topology, line);
  const along = CELL - 2 * RING_END_GAP;
  const across = 2 * RING_HALF_WIDTH;
  if (horizontal) return { x: x1 * CELL + RING_END_GAP, y: y1 * CELL - RING_HALF_WIDTH, width: along, height: across };
  return { x: x1 * CELL - RING_HALF_WIDTH, y: y1 * CELL + RING_END_GAP, width: across, height: along };
}

function centreLine(topology) {
  const n = topology.size;
  return hLine(n, Math.floor(n / 2), Math.floor((n - 1) / 2));
}
