import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SIZE,
  MAX_SIZE,
  getTopology,
  hLine,
  vLine,
  lineGeometry,
  boxCell,
  boxesOfLine,
  lineAt,
  lineForPoint,
  moveCursor,
  lineLabel,
} from '../src/board.js';

const SIZES = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);

test('an n x n board has 2n(n+1) lines and n^2 boxes', () => {
  for (const n of SIZES) {
    const topology = getTopology(n);
    assert.equal(topology.lineCount, 2 * n * (n + 1), `lines on ${n}x${n}`);
    assert.equal(topology.boxCount, n * n, `boxes on ${n}x${n}`);
  }
});

test('every box has four distinct sides and every line borders one or two boxes', () => {
  for (const n of SIZES) {
    const topology = getTopology(n);
    for (let box = 0; box < topology.boxCount; box++) {
      const sides = Array.from(topology.boxLines.subarray(4 * box, 4 * box + 4));
      assert.equal(new Set(sides).size, 4);
      for (const line of sides) assert.ok(boxesOfLine(topology, line).includes(box));
    }
    const edgeLines = [];
    for (let line = 0; line < topology.lineCount; line++) {
      const boxes = boxesOfLine(topology, line);
      assert.ok(boxes.length === 1 || boxes.length === 2);
      if (boxes.length === 1) edgeLines.push(line);
    }
    assert.equal(edgeLines.length, 4 * n, `edge lines on ${n}x${n}`);
  }
});

test('box sides are numbered top, right, bottom, left', () => {
  const topology = getTopology(3);
  const box = 4; // row 1, col 1
  assert.deepEqual(boxCell(topology, box), { row: 1, col: 1 });
  assert.deepEqual(Array.from(topology.boxLines.subarray(16, 20)), [
    hLine(3, 1, 1),
    vLine(3, 1, 2),
    hLine(3, 2, 1),
    vLine(3, 1, 1),
  ]);
});

test('sizes outside 3..7 are rejected', () => {
  for (const size of [2, 8, 4.5, NaN, '5']) assert.throws(() => getTopology(size), RangeError);
  assert.equal(getTopology(4), getTopology(4), 'topologies are shared');
});

test('line geometry and labels use dot coordinates', () => {
  const topology = getTopology(5);
  assert.deepEqual(lineGeometry(topology, hLine(5, 2, 3)), {
    horizontal: true, row: 2, col: 3, x1: 3, y1: 2, x2: 4, y2: 2,
  });
  assert.deepEqual(lineGeometry(topology, vLine(5, 4, 5)), {
    horizontal: false, row: 4, col: 5, x1: 5, y1: 4, x2: 5, y2: 5,
  });
  assert.equal(lineLabel(topology, hLine(5, 0, 0)), 'a1-b1');
  assert.equal(lineLabel(topology, vLine(5, 4, 5)), 'f5-f6');
});

test('lineAt finds the nearest line within half a cell', () => {
  const topology = getTopology(4);
  assert.equal(lineAt(topology, 0.5, 0.1), hLine(4, 0, 0));
  assert.equal(lineAt(topology, 0.1, 0.5), vLine(4, 0, 0));
  assert.equal(lineAt(topology, 2.4, 3.05), hLine(4, 3, 2));
  assert.equal(lineAt(topology, 4.3, 1.6), vLine(4, 1, 4));
  assert.equal(lineAt(topology, -1, -1), -1, 'far outside the board');
  assert.equal(lineAt(topology, 5, 2), -1, 'more than half a cell away');
});

test('lineAt skips lines the caller does not accept', () => {
  const topology = getTopology(4);
  const top = hLine(4, 1, 1);
  assert.equal(lineAt(topology, 1.5, 1.2), top);
  const next = lineAt(topology, 1.5, 1.2, (line) => line !== top);
  assert.notEqual(next, top);
  assert.ok(next >= 0, 'another line is within half a cell');
  assert.equal(lineAt(topology, 1.5, 1.2, () => false), -1);
});

test('moveCursor steps between neighbouring lines and stops at the edges', () => {
  const n = 4;
  const topology = getTopology(n);
  assert.equal(moveCursor(topology, hLine(n, 1, 1), 'right'), hLine(n, 1, 2));
  assert.equal(moveCursor(topology, hLine(n, 1, 1), 'left'), hLine(n, 1, 0));
  assert.equal(moveCursor(topology, hLine(n, 1, 1), 'down'), vLine(n, 1, 1));
  assert.equal(moveCursor(topology, vLine(n, 1, 1), 'down'), hLine(n, 2, 1));
  assert.equal(moveCursor(topology, hLine(n, 1, 1), 'up'), vLine(n, 0, 1));
  assert.equal(moveCursor(topology, vLine(n, 0, 1), 'up'), hLine(n, 0, 1));
  assert.equal(moveCursor(topology, hLine(n, 0, 0), 'up'), hLine(n, 0, 0));
  assert.equal(moveCursor(topology, hLine(n, 0, 0), 'left'), hLine(n, 0, 0));
  assert.equal(moveCursor(topology, hLine(n, n, n - 1), 'down'), hLine(n, n, n - 1));
  assert.equal(moveCursor(topology, vLine(n, 2, n), 'right'), vLine(n, 2, n));
  assert.equal(moveCursor(topology, vLine(n, 2, n), 'down'), hLine(n, 3, n - 1));
});

test('up then down (and down then up) returns to the same line', () => {
  const topology = getTopology(5);
  for (let line = 0; line < topology.lineCount; line++) {
    const down = moveCursor(topology, line, 'down');
    if (down !== line && lineGeometry(topology, line).col < 5) {
      assert.equal(moveCursor(topology, down, 'up'), line, `line ${line}`);
    }
  }
});

test('the cursor can reach every line from the first one', () => {
  for (const n of SIZES) {
    const topology = getTopology(n);
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      const line = queue.shift();
      for (const direction of ['up', 'down', 'left', 'right']) {
        const next = moveCursor(topology, line, direction);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    assert.equal(seen.size, topology.lineCount, `${n}x${n}`);
  }
});

test('lineForPoint picks the nearest undrawn line but not through a drawn one', () => {
  const n = 4;
  const topology = getTopology(n);
  const drawn = new Set([hLine(n, 1, 1)]);
  const isOpen = (line) => !drawn.has(line);
  assert.equal(lineForPoint(topology, 1.5, 0.9, isOpen), -1, 'a tap on a drawn line draws nothing');
  assert.equal(lineForPoint(topology, 1.45, 1.02, isOpen), -1, 'not even the side line half a cell away');
  assert.equal(lineForPoint(topology, 2.5, 1.1, isOpen), hLine(n, 1, 2), 'an undrawn line is picked');
  assert.equal(lineForPoint(topology, 1.08, 1.03, isOpen), vLine(n, 1, 1), 'near a dot both are close enough');
  assert.equal(lineForPoint(topology, 9, 9, isOpen), -1, 'far outside the board');
});

test('lineForPoint finds the last side of a box from its centre', () => {
  const n = 3;
  const topology = getTopology(n);
  const sides = Array.from(topology.boxLines.subarray(16, 20)); // box 4: top, right, bottom, left
  const drawn = new Set(sides.slice(0, 3));
  const line = lineForPoint(topology, 1.5, 1.5, (l) => !drawn.has(l));
  assert.equal(line, sides[3]);
});
