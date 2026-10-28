import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTopology } from '../src/board.js';
import { createPosition, drawLine, safeLines } from '../src/position.js';
import {
  findComponents,
  componentParts,
  openingLines,
  classifyCapture,
  captureDecision,
  loonyValue,
  estimateValue,
} from '../src/chains.js';
import { createRng, pick } from '../src/rng.js';

// 3 x 3 boards, lines numbered as in src/board.js (h: 0..11, v: 12..23).
// Two chains along the edges: A = boxes 3-4-7-6 (4 boxes), B = boxes 0-1-2-5-8 (5 boxes).
const TWO_CHAINS = [0, 1, 2, 3, 4, 15, 18, 19, 22, 23, 10, 6, 9];
// A loop of the four top-left boxes and a chain of the other five.
const LOOP_AND_CHAIN = [0, 1, 12, 16, 6, 7, 14, 18, 15, 19, 23, 11, 10, 9];

function positionWith(size, drawn) {
  const topology = getTopology(size);
  const lines = new Int8Array(topology.lineCount).fill(-1);
  for (const line of drawn) lines[line] = 0;
  return createPosition(topology, lines);
}

function sortedParts(components) {
  return componentParts(components).sort((a, b) => a - b);
}

test('loonyValue knows the classic small endgames', () => {
  assert.equal(loonyValue([]), 0);
  assert.equal(loonyValue([1]), -1);
  assert.equal(loonyValue([2]), -2);
  assert.equal(loonyValue([3]), -3);
  assert.equal(loonyValue([1, 1]), 0, 'two single boxes split');
  assert.equal(loonyValue([3, 3]), -2, 'the controller declines two boxes once');
  assert.equal(loonyValue([4, 5]), -5, 'controller takes 2 + 5, opener 2');
  assert.equal(loonyValue([-4]), -4);
  assert.equal(loonyValue([3, -4]), -1, 'open the loop first, the controller takes it');
  assert.equal(loonyValue([5, -4]), -1, 'here the controller declines the loop');
  assert.equal(loonyValue([1, 3, 3]), 1, 'a short chain hands the move over');
  assert.equal(loonyValue([5, 3, 4]), loonyValue([3, 4, 5]), 'order does not matter');
});

test('findComponents splits the open boxes into chains and loops', () => {
  const twoChains = findComponents(positionWith(3, TWO_CHAINS));
  assert.deepEqual(sortedParts(twoChains), [4, 5]);
  assert.deepEqual(twoChains.junctions, []);
  assert.ok(twoChains.chains.every((chain) => chain.ends.every((end) => end === -1)), 'both run edge to edge');

  const loopAndChain = findComponents(positionWith(3, LOOP_AND_CHAIN));
  assert.deepEqual(sortedParts(loopAndChain), [-4, 5]);
  assert.deepEqual(loopAndChain.junctions, []);
});

test('every open box belongs to exactly one chain, loop or junction', () => {
  const rng = createRng(11);
  for (let round = 0; round < 60; round++) {
    const size = 3 + (round % 5);
    const position = positionWith(size, []);
    for (let safe = safeLines(position); safe.length > 0; safe = safeLines(position)) {
      drawLine(position, pick(rng, safe));
    }
    const components = findComponents(position);
    const counted = componentParts(components).reduce((sum, part) => sum + Math.abs(part), 0);
    assert.equal(counted + components.junctions.length, size * size, `round ${round}`);
    for (const line of openingLines(components)) assert.equal(position.drawn[line], 0);
    assert.ok(Number.isInteger(estimateValue(position, components)));
  }
});

test('a 2-chain is opened in the middle, longer chains at an end', () => {
  // Boxes 0 and 1 form a 2-chain along the top edge; the rest of the board is closed off.
  const position = positionWith(3, [0, 3, 4, 14]);
  const components = findComponents(position);
  const twoChain = components.chains.find((chain) => chain.length === 2);
  assert.ok(twoChain);
  assert.equal(twoChain.open, 13, 'the line between the two boxes');
  const chains = findComponents(positionWith(3, TWO_CHAINS)).chains;
  for (const chain of chains) {
    const position2 = positionWith(3, [...TWO_CHAINS, chain.open]);
    const capturable = [...position2.sides].filter((sides) => sides === 3).length;
    assert.equal(capturable, 1, 'opening at an end leaves one box to start capturing');
  }
});

test('the last two boxes of an opened chain can be declined', () => {
  // Chain A opened at box 3, and its first two boxes already taken.
  const position = positionWith(3, [...TWO_CHAINS, 16, 17, 7]);
  assert.deepEqual(classifyCapture(position, 7), { take: 21, decline: 20, cost: 2 });
  assert.deepEqual(captureDecision(position), { take: 21, decline: 20, cost: 2 });
});

test('boxes deeper in an opened chain are simply taken', () => {
  const position = positionWith(3, [...TWO_CHAINS, 16]);
  assert.deepEqual(classifyCapture(position, 3), { take: 17, decline: -1, cost: 0 });
  assert.equal(captureDecision(position).decline, -1);
});

test('an opened loop of four can be declined for four boxes', () => {
  const position = positionWith(3, [...LOOP_AND_CHAIN, 13]);
  const choice = captureDecision(position);
  assert.equal(choice.decline, 17, 'the middle line leaves two dominoes');
  assert.equal(choice.cost, 4);
  assert.ok([3, 4].includes(choice.take));
});

test('estimateValue is exact without junctions', () => {
  assert.equal(estimateValue(positionWith(3, TWO_CHAINS)), loonyValue([4, 5]));
  assert.equal(estimateValue(positionWith(3, LOOP_AND_CHAIN)), loonyValue([5, -4]));
});
