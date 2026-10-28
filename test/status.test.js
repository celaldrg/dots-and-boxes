import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hLine, vLine } from '../src/board.js';
import { createGame, getState, playLine } from '../src/game.js';
import { MESSAGES } from '../src/i18n.js';
import { playerInitialKey, playerNameKey, resultMessage, statusMessage } from '../src/status.js';

/** Plays lines on a new game and returns the snapshot. */
function stateAfter(options, lines) {
  const game = createGame(options);
  for (const line of lines) assert.ok(playLine(game, line), `line ${line} is legal`);
  return getState(game);
}

/** The four sides of box (0, 0) on a board of the given size. */
const firstBoxSides = (size) => [hLine(size, 0, 0), hLine(size, 1, 0), vLine(size, 0, 0), vLine(size, 0, 1)];

test('player names and initials depend on the mode', () => {
  assert.equal(playerNameKey('cpu', 0), 'you');
  assert.equal(playerNameKey('cpu', 1), 'computer');
  assert.equal(playerNameKey('pvp', 0), 'player1');
  assert.equal(playerNameKey('pvp', 1), 'player2');
  assert.equal(playerInitialKey('cpu', 1), 'computerInitial');
  assert.equal(playerInitialKey('pvp', 0), 'player1Initial');
});

test('the status says whose turn it is', () => {
  assert.deepEqual(statusMessage(stateAfter({ size: 3 }, [])), { key: 'turnYou', player: 0 });
  assert.deepEqual(statusMessage(stateAfter({ size: 3, starter: 1 }, [])), { key: 'turnComputer', player: 1 });
  assert.deepEqual(statusMessage(stateAfter({ size: 3, mode: 'pvp' }, [hLine(3, 0, 0)])), { key: 'turnPlayer', player: 1 });
});

test('the status says when a closed box gives another move', () => {
  // The turns go 0, 1, 0, 1, so the second player draws the fourth side,
  // closes the box and moves again.
  const [top, bottom, left, right] = firstBoxSides(3);
  const second = stateAfter({ size: 3 }, [top, bottom, left, right]);
  assert.equal(second.turn, 1, 'the computer drew the closing line');
  assert.deepEqual(statusMessage(second), { key: 'againComputer', player: 1 });

  const human = stateAfter({ size: 3, starter: 1 }, [top, bottom, left, right]);
  assert.deepEqual(statusMessage(human), { key: 'againYou', player: 0 });

  const friends = stateAfter({ size: 3, mode: 'pvp' }, [top, bottom, left, right]);
  assert.deepEqual(statusMessage(friends), { key: 'againPlayer', player: 1 });

  const passed = stateAfter({ size: 3, mode: 'pvp' }, [top, bottom, left, right, hLine(3, 3, 2)]);
  assert.deepEqual(statusMessage(passed), { key: 'turnPlayer', player: 0 }, 'the turn passes after a line that closes nothing');
});

test('finished games report the winner or a draw', () => {
  const base = { over: true, history: [], turn: 0 };
  const cpu = (winner) => ({ ...base, mode: 'cpu', outcome: { winner, scores: [0, 0] } });
  assert.deepEqual(resultMessage(cpu(0)), { key: 'resultYouWin', player: 0 });
  assert.deepEqual(resultMessage(cpu(1)), { key: 'resultComputerWins', player: 1 });
  assert.deepEqual(resultMessage(cpu(null)), { key: 'resultDraw', player: null });
  assert.deepEqual(statusMessage({ ...cpu(1), mode: 'pvp' }), { key: 'resultPlayerWins', player: 1 });
});

test('a real game played to the end gets a result message', () => {
  const game = createGame({ size: 3, mode: 'pvp' });
  for (let line = 0; line < game.lines.length; line++) playLine(game, line);
  const state = getState(game);
  assert.equal(state.over, true);
  const message = statusMessage(state);
  assert.ok(message.key.startsWith('result'), message.key);
});

test('every message key exists in both languages', () => {
  const keys = ['you', 'computer', 'player1', 'player2', 'youInitial', 'computerInitial', 'player1Initial', 'player2Initial'];
  for (const prefix of ['turn', 'again']) for (const who of ['You', 'Computer', 'Player']) keys.push(prefix + who);
  keys.push('resultYouWin', 'resultComputerWins', 'resultPlayerWins', 'resultDraw');
  for (const key of keys) {
    assert.ok(Object.hasOwn(MESSAGES.en, key) && Object.hasOwn(MESSAGES.tr, key), key);
  }
});
