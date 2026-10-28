import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  playLine,
  isLegal,
  undo,
  canUndo,
  isOver,
  isComputerTurn,
  computerMove,
  outcome,
  getState,
  HUMAN,
  COMPUTER,
} from '../src/game.js';
import { hLine, vLine } from '../src/board.js';
import { createRng, pick } from '../src/rng.js';

/** Draws the lines in order and returns the result of the last one. */
function playAll(game, lines) {
  let result = null;
  for (const line of lines) {
    result = playLine(game, line);
    assert.ok(result, `line ${line} should be legal`);
  }
  return result;
}

function undrawn(game) {
  return [...game.lines.keys()].filter((line) => game.lines[line] < 0);
}

/** Plays random legal lines until the game is over, checking the turn rule on every move. */
function playRandomGame(size, seed) {
  const game = createGame({ size, mode: 'pvp', seed });
  const rng = createRng(seed);
  while (!isOver(game)) {
    const player = game.turn;
    const result = playLine(game, pick(rng, undrawn(game)));
    assert.equal(result.extraTurn, result.boxes.length > 0);
    assert.equal(game.turn, result.extraTurn ? player : 1 - player, 'extra turn only after a capture');
  }
  return game;
}

// 3 x 3 board: box (0,0) has sides 0 (top), 13 (right), 3 (bottom), 12 (left);
// box (0,1) has sides 1, 14, 4 and 13, so line 13 is shared.
const N = 3;
const TOP_A = hLine(N, 0, 0);
const BOTTOM_A = hLine(N, 1, 0);
const LEFT_A = vLine(N, 0, 0);
const SHARED = vLine(N, 0, 1);
const TOP_B = hLine(N, 0, 1);
const BOTTOM_B = hLine(N, 1, 1);
const RIGHT_B = vLine(N, 0, 2);

test('a new game starts empty with the chosen player to move', () => {
  const game = createGame({ size: 4, mode: 'pvp', starter: 1 });
  assert.equal(game.lines.length, 2 * 4 * 5);
  assert.ok(game.lines.every((owner) => owner === -1));
  assert.ok(game.boxes.every((owner) => owner === -1));
  assert.deepEqual(game.scores, [0, 0]);
  assert.equal(game.turn, 1);
  assert.equal(isOver(game), false);
  assert.equal(outcome(game), null);
});

test('invalid options are rejected', () => {
  assert.throws(() => createGame({ size: 2 }), RangeError);
  assert.throws(() => createGame({ size: 8 }), RangeError);
  assert.throws(() => createGame({ mode: 'online' }), RangeError);
  assert.throws(() => createGame({ level: 'expert' }), RangeError);
  assert.throws(() => createGame({ starter: 2 }), RangeError);
});

test('drawing a line that closes no box passes the turn', () => {
  const game = createGame({ size: N, mode: 'pvp' });
  const result = playLine(game, TOP_A);
  assert.deepEqual(result, { line: TOP_A, player: 0, boxes: [], extraTurn: false, over: false });
  assert.equal(game.lines[TOP_A], 0);
  assert.equal(game.turn, 1);
});

test('closing a box scores it and the same player moves again', () => {
  const game = createGame({ size: N, mode: 'pvp' });
  playAll(game, [TOP_A, LEFT_A, BOTTOM_A]);
  assert.equal(game.turn, 1);
  const result = playLine(game, SHARED);
  assert.deepEqual(result.boxes, [0]);
  assert.equal(result.player, 1);
  assert.equal(result.extraTurn, true);
  assert.equal(game.boxes[0], 1);
  assert.deepEqual(game.scores, [0, 1]);
  assert.equal(game.turn, 1, 'extra turn after the capture');
  playLine(game, TOP_B);
  assert.equal(game.turn, 0, 'the next line without a capture passes the turn');
});

test('one line can close two boxes at once', () => {
  const game = createGame({ size: N, mode: 'pvp' });
  playAll(game, [TOP_A, BOTTOM_A, LEFT_A, TOP_B, BOTTOM_B, RIGHT_B]);
  assert.deepEqual(game.scores, [0, 0], 'no box closed yet');
  assert.equal(game.turn, 0);
  const result = playLine(game, SHARED);
  assert.deepEqual([...result.boxes].sort(), [0, 1]);
  assert.deepEqual(game.scores, [2, 0]);
  assert.equal(game.turn, 0);
});

test('drawn lines and lines off the board are not legal', () => {
  const game = createGame({ size: N, mode: 'pvp' });
  playLine(game, TOP_A);
  for (const line of [TOP_A, -1, 24, 1.5, '3']) {
    assert.equal(isLegal(game, line), false);
    assert.equal(playLine(game, line), null);
  }
  assert.equal(game.history.length, 1);
  assert.equal(game.turn, 1);
});

test('the game ends when every line is drawn and the scores add up to n x n', () => {
  for (let size = 3; size <= 7; size++) {
    for (let seed = 1; seed <= 4; seed++) {
      const game = playRandomGame(size, seed * 100 + size);
      assert.equal(game.history.length, 2 * size * (size + 1));
      assert.equal(game.scores[0] + game.scores[1], size * size);
      assert.ok(game.boxes.every((owner) => owner === 0 || owner === 1));
      const result = outcome(game);
      assert.deepEqual(result.scores, game.scores);
      const [a, b] = game.scores;
      assert.equal(result.winner, a === b ? null : a > b ? 0 : 1);
      assert.equal(playLine(game, 0), null, 'no move after the end');
    }
  }
});

test('a game can end in a draw on an even number of boxes', () => {
  let draw = null;
  for (let seed = 1; seed <= 500 && !draw; seed++) {
    const game = playRandomGame(4, seed);
    if (game.scores[0] === game.scores[1]) draw = game;
  }
  assert.ok(draw, 'some random 4x4 game ends 8-8');
  assert.deepEqual(outcome(draw), { winner: null, scores: [8, 8] });
});

test('undo in a two-player game takes back exactly one line', () => {
  const game = createGame({ size: N, mode: 'pvp' });
  playAll(game, [TOP_A, LEFT_A, BOTTOM_A, SHARED]);
  assert.equal(canUndo(game), true);
  assert.equal(undo(game), 1);
  assert.equal(game.lines[SHARED], -1);
  assert.equal(game.boxes[0], -1);
  assert.deepEqual(game.scores, [0, 0]);
  assert.equal(game.turn, 1, 'the player who drew it is to move again');
  assert.equal(undo(game) + undo(game) + undo(game), 3);
  assert.equal(canUndo(game), false);
  assert.equal(undo(game), 0);
  assert.equal(game.turn, 0);
});

test('undo against the computer also takes back its reply', () => {
  const game = createGame({ size: 4, mode: 'cpu', level: 'easy', seed: 9 });
  assert.equal(canUndo(game), false);
  playLine(game, 0);
  assert.equal(isComputerTurn(game), true);
  while (isComputerTurn(game)) playLine(game, computerMove(game));
  const before = getState(game);
  playLine(game, undrawn(game)[0]);
  while (isComputerTurn(game)) playLine(game, computerMove(game));
  assert.ok(undo(game) >= 2, 'the human line and at least one computer line');
  const after = getState(game);
  assert.deepEqual(after.lines, before.lines);
  assert.deepEqual(after.scores, before.scores);
  assert.equal(game.turn, HUMAN);
});

test('when the computer starts, its moves alone cannot be undone', () => {
  const game = createGame({ size: 3, mode: 'cpu', level: 'medium', starter: COMPUTER, seed: 2 });
  assert.equal(isComputerTurn(game), true);
  playLine(game, computerMove(game));
  assert.equal(isComputerTurn(game), false);
  assert.equal(canUndo(game), false);
  assert.equal(undo(game), 0);
  assert.equal(game.history.length, 1);
});

test('computerMove suggests a legal line and -1 when the board is full', () => {
  const game = createGame({ size: 3, mode: 'cpu', level: 'hard', starter: COMPUTER, seed: 5 });
  while (!isOver(game)) {
    const line = computerMove(game);
    assert.equal(isLegal(game, line), true);
    playLine(game, line);
  }
  assert.equal(computerMove(game), -1);
  assert.equal(isComputerTurn(game), false);
});

test('getState returns a detached snapshot', () => {
  const game = createGame({ size: N, mode: 'pvp' });
  playAll(game, [TOP_A, LEFT_A, BOTTOM_A, SHARED]);
  const state = getState(game);
  assert.equal(state.lastLine, SHARED);
  assert.deepEqual(state.lastBoxes, [0]);
  assert.equal(state.turn, 1);
  assert.equal(state.history.length, 4);
  assert.equal(state.canUndo, true);
  assert.equal(state.computerTurn, false);
  state.lines[TOP_B] = 0;
  state.history[0].boxes.push(5);
  state.scores[0] = 9;
  assert.equal(game.lines[TOP_B], -1);
  assert.deepEqual(game.history[0].boxes, []);
  assert.deepEqual(game.scores, [0, 1]);
});
