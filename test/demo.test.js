import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGame } from '../src/demo.js';
import { getState, isComputerTurn, HUMAN } from '../src/game.js';
import { createPosition } from '../src/position.js';
import { findComponents } from '../src/chains.js';

test('the demo is a 5x5 game in progress with the human to move', () => {
  const game = createDemoGame();
  const state = getState(game);
  assert.equal(state.size, 5);
  assert.equal(state.mode, 'cpu');
  assert.equal(state.over, false);
  assert.equal(state.turn, HUMAN);
  assert.equal(isComputerTurn(game), false);
  assert.ok(state.lastLine >= 0, 'a last line to highlight');
});

test('the demo shows boxes for both sides and long chains', () => {
  const game = createDemoGame();
  assert.ok(game.scores[0] >= 2 && game.scores[1] >= 2, `scores ${game.scores}`);
  const { chains, loops } = findComponents(createPosition(game.topology, game.lines));
  assert.ok(chains.some((chain) => chain.length >= 3), 'a long chain');
  assert.ok(chains.length + loops.length >= 2, 'more than one chain or loop');
});

test('the demo is the same every time and takes options', () => {
  assert.deepEqual(getState(createDemoGame()), getState(createDemoGame()));
  assert.equal(createDemoGame({ level: 'hard' }).level, 'hard');
});
