import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { chooseMove, LEVELS } from '../src/ai.js';
import { createGame, playLine, isOver } from '../src/game.js';
import { getTopology } from '../src/board.js';
import { createRng, pick } from '../src/rng.js';

// 3 x 3 boards, lines numbered as in src/board.js (h: 0..11, v: 12..23).
// Two chains along the edges: A = boxes 3-4-7-6 (4 boxes), B = boxes 0-1-2-5-8 (5 boxes).
const TWO_CHAINS = [0, 1, 2, 3, 4, 15, 18, 19, 22, 23, 10, 6, 9];
const CHAIN_A_LINES = [16, 17, 7, 21, 20];
// A loop of the four top-left boxes and a chain of the other five.
const LOOP_AND_CHAIN = [0, 1, 12, 16, 6, 7, 14, 18, 15, 19, 23, 11, 10, 9];
// 5 x 5, player 1 starts: 22 safe lines drawn at random (seed 1), 15 safe lines left.
// 5 x 5, player 1 starts: 21 safe lines drawn at random (seed 38), 19 safe lines left.
const EARLY_RACE = [43, 51, 3, 47, 48, 19, 26, 9, 57, 20, 30, 6, 39, 27, 28, 52, 4, 38, 59, 33, 54];
const PARITY_RACE = [37, 0, 31, 58, 57, 16, 38, 44, 25, 59, 26, 32, 9, 21, 13, 8, 27, 3, 19, 47, 15, 10];

function drawnSides(game, box) {
  const { boxLines } = game.topology;
  let sides = 0;
  for (let i = 4 * box; i < 4 * box + 4; i++) if (game.lines[boxLines[i]] >= 0) sides++;
  return sides;
}

function neighbours(game, line) {
  const { lineBoxes } = game.topology;
  return [lineBoxes[2 * line], lineBoxes[2 * line + 1]].filter((box) => box >= 0);
}

function undrawn(game) {
  return [...game.lines.keys()].filter((line) => game.lines[line] < 0);
}

/** Undrawn lines that give no box a third side. */
function safeLinesOf(game) {
  return undrawn(game).filter((line) => neighbours(game, line).every((box) => drawnSides(game, box) < 2));
}

/** True when a safe line exists but `line` gives a box its third side without closing any box. */
function breaksSafetyRule(game, line) {
  const safeExists = safeLinesOf(game).length > 0;
  const sidesNow = neighbours(game, line).map((box) => drawnSides(game, box));
  const closes = sidesNow.includes(3);
  const givesThird = sidesNow.includes(2);
  return safeExists && !closes && givesThird;
}

/** Plays a game between two levels; returns final scores and each side's slowest move in ms. */
function playMatch(size, levels, starter, seed, onMove = () => {}) {
  const game = createGame({ size, mode: 'pvp', starter, seed });
  const rngs = [createRng(seed * 2 + 1), createRng(seed * 2 + 2)];
  const slowest = [0, 0];
  while (!isOver(game)) {
    const player = game.turn;
    const start = performance.now();
    const line = chooseMove(game.topology, game.lines, levels[player], rngs[player]);
    slowest[player] = Math.max(slowest[player], performance.now() - start);
    onMove(game, player, line);
    assert.ok(playLine(game, line), `${levels[player]} chose an illegal line ${line}`);
  }
  return { scores: [...game.scores], slowest };
}

/** Lets two levels finish a game already in progress. */
function finish(game, levels) {
  const rngs = [createRng(1), createRng(2)];
  while (!isOver(game)) playLine(game, chooseMove(game.topology, game.lines, levels[game.turn], rngs[game.turn]));
  return game.scores;
}

function gameWith(lines, starter = 0, size = 3) {
  const game = createGame({ size, mode: 'pvp', starter });
  for (const line of lines) assert.ok(playLine(game, line));
  return game;
}

const GAMES = 50;
const seriesCache = new Map();

/** Hard (player 0) against `opponent`: 50 seeded 5 x 5 games, alternating who starts. */
function series(opponent) {
  if (!seriesCache.has(opponent)) {
    let wins = 0;
    const violations = { hard: 0, [opponent]: 0 };
    for (let i = 0; i < GAMES; i++) {
      const levels = ['hard', opponent];
      const { scores } = playMatch(5, levels, i % 2, 1 + i, (game, player, line) => {
        if (breaksSafetyRule(game, line)) violations[levels[player]]++;
      });
      if (scores[0] > scores[1]) wins++;
    }
    seriesCache.set(opponent, { wins, violations });
  }
  return seriesCache.get(opponent);
}

test('every level returns -1 on a full board and unknown levels are rejected', () => {
  const topology = getTopology(3);
  const full = new Int8Array(topology.lineCount).fill(0);
  for (const level of LEVELS) assert.equal(chooseMove(topology, full, level, createRng(1)), -1);
  assert.throws(() => chooseMove(topology, new Int8Array(24).fill(-1), 'expert', createRng(1)), RangeError);
});

test('every level takes a free box', () => {
  // Box 0 has three sides; line 13 closes it. Nothing else is close to closing.
  const game = gameWith([0, 12, 3]);
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 20; seed++) {
      assert.equal(chooseMove(game.topology, game.lines, level, createRng(seed)), 13, `${level} seed ${seed}`);
    }
  }
});

test('easy usually avoids a third side but not always', () => {
  const game = gameWith([0, 3]); // box 0 has two sides: lines 12 and 13 would give it a third
  let risky = 0;
  for (let seed = 1; seed <= 400; seed++) {
    if ([12, 13].includes(chooseMove(game.topology, game.lines, 'easy', createRng(seed)))) risky++;
  }
  assert.ok(risky > 0 && risky < 40, `easy gave a third side in ${risky} of 400 tries`);
});

test('medium never draws a third side while a safe line exists', () => {
  assert.equal(series('easy').violations.easy > 0, true, 'easy does break the rule sometimes');
  const { violations } = series('medium');
  assert.equal(violations.medium, 0);
});

test('medium opens the shortest chain when every line gives boxes away', () => {
  const game = gameWith(TWO_CHAINS);
  for (let seed = 1; seed <= 20; seed++) {
    const line = chooseMove(game.topology, game.lines, 'medium', createRng(seed));
    assert.ok(CHAIN_A_LINES.includes(line), `seed ${seed} opened ${line}`);
  }
});

test('hard double-deals in a hand-made endgame and wins it', () => {
  // The opponent (player 1) opens the 4-chain. Taking all four would force
  // hard to open the 5-chain and lose 4-5; taking two and handing the last
  // two back keeps control and wins 7-2.
  const game = gameWith([...TWO_CHAINS, 16]);
  assert.equal(game.turn, 0);
  const rng = createRng(3);
  const hardTurn = [];
  while (game.turn === 0) {
    const line = chooseMove(game.topology, game.lines, 'hard', rng);
    hardTurn.push(line);
    playLine(game, line);
  }
  assert.deepEqual(hardTurn, [17, 7, 20], 'takes two boxes, then draws the far end line');
  assert.deepEqual(game.scores, [2, 0]);
  assert.deepEqual(finish(game, ['hard', 'medium']), [7, 2]);

  const greedy = gameWith([...TWO_CHAINS, 16]);
  assert.deepEqual(finish(greedy, ['medium', 'hard']), [4, 5], 'taking everything instead loses');
});

test('hard declines the last four boxes of an opened loop when that wins', () => {
  const game = gameWith([...LOOP_AND_CHAIN, 13], 1); // player 1 opens the loop
  assert.equal(game.turn, 0);
  const line = chooseMove(game.topology, game.lines, 'hard', createRng(1));
  assert.equal(line, 17, 'the middle line leaves two dominoes');
  playLine(game, line);
  assert.deepEqual(finish(game, ['hard', 'medium']), [5, 4]);
});

test('hard takes the whole chain when keeping control does not pay', () => {
  // After hard declined chain A, the opponent opens chain B: the last one.
  const game = gameWith([...TWO_CHAINS, 16, 17, 7, 20, 21, 5]);
  assert.equal(game.turn, 0);
  const rng = createRng(4);
  while (game.turn === 0 && !isOver(game)) playLine(game, chooseMove(game.topology, game.lines, 'hard', rng));
  assert.equal(isOver(game), true);
  assert.deepEqual(game.scores, [7, 2]);
});

test('hard plays perfectly in random 3x3 endgames (checked by brute force)', () => {
  const topology = getTopology(3);
  const rng = createRng(2024);
  for (let round = 0; round < 150; round++) {
    const game = createGame({ size: 3, mode: 'pvp' });
    for (let safe = safeLinesOf(game); safe.length > 0; safe = safeLinesOf(game)) playLine(game, pick(rng, safe));
    const extra = Math.floor(rng() * 4); // a few loony moves so that captures are on the table too
    for (let i = 0; i < extra && undrawn(game).length > 1; i++) playLine(game, pick(rng, undrawn(game)));
    const drawn = Uint8Array.from(game.lines, (owner) => (owner >= 0 ? 1 : 0));
    const memo = new Map();
    const best = bruteValue(topology, drawn, memo);
    const line = chooseMove(topology, game.lines, 'hard', createRng(round));
    assert.equal(moveValue(topology, drawn, line, memo), best, `round ${round}: line ${line} is not optimal`);
  }
});

test('hard wins the race for control with up to 18 safe lines left', () => {
  // A seeded 5 x 5 middle game, player 1 to move with 15 safe lines left.
  // Playing every safe line out, hard against hard, shows that only line 17
  // wins: a random safe line almost always loses.
  const start = () => gameWith(PARITY_RACE, 1, 5);
  const game = start();
  const safe = safeLinesOf(game);
  assert.equal(game.turn, 1);
  assert.equal(safe.length, 15);
  const winners = safe.filter((line) => {
    const trial = start();
    playLine(trial, line);
    const scores = finish(trial, ['hard', 'hard']);
    return scores[1] > scores[0];
  });
  assert.deepEqual(winners, [17]);
  for (let seed = 1; seed <= 8; seed++) {
    assert.equal(chooseMove(game.topology, game.lines, 'hard', createRng(seed)), 17, `seed ${seed}`);
  }
});

test('with too many safe lines to search, hard still picks race-winning lines by playouts', (t) => {
  // 19 safe lines is past the exact search; playing each one out, hard
  // against hard, shows that only 3 of them win. A random safe line would
  // pick one of those about 1 time in 6.
  const start = () => gameWith(EARLY_RACE, 1, 5);
  const game = start();
  const safe = safeLinesOf(game);
  assert.equal(safe.length, 19);
  const winners = safe.filter((line) => {
    const trial = start();
    playLine(trial, line);
    const scores = finish(trial, ['hard', 'hard']);
    return scores[game.turn] > scores[1 - game.turn];
  });
  assert.equal(winners.length, 3);
  let hits = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const line = chooseMove(game.topology, game.lines, 'hard', createRng(seed));
    assert.ok(safe.includes(line), `seed ${seed}: ${line} is not a safe line`);
    if (winners.includes(line)) hits++;
  }
  t.diagnostic(`hard picked a winning line ${hits}/8 times`);
  assert.ok(hits >= 6, `hard picked a winning line only ${hits}/8 times`);
});

test('hard never draws a third side while a safe line exists', () => {
  for (const opponent of ['medium', 'easy']) {
    assert.equal(series(opponent).violations.hard, 0, `against ${opponent}`);
  }
});

test('hard beats medium in at least 35 of 50 seeded 5x5 games', (t) => {
  const { wins } = series('medium');
  t.diagnostic(`hard beat medium ${wins}/${GAMES}`);
  assert.ok(wins >= 35, `hard beat medium only ${wins}/${GAMES}`);
});

test('hard beats easy in at least 48 of 50 seeded 5x5 games', (t) => {
  const { wins } = series('easy');
  t.diagnostic(`hard beat easy ${wins}/${GAMES}`);
  assert.ok(wins >= 48, `hard beat easy only ${wins}/${GAMES}`);
});

test('the slowest hard move of a full seeded 7x7 game stays under 300 ms', (t) => {
  let violations = 0;
  const { slowest } = playMatch(7, ['hard', 'hard'], 0, 77, (game, _player, line) => {
    if (breaksSafetyRule(game, line)) violations++;
  });
  const worst = Math.max(...slowest);
  t.diagnostic(`slowest hard move on 7x7: ${worst.toFixed(1)} ms`);
  assert.ok(worst < 300, `slowest hard move took ${worst.toFixed(1)} ms`);
  assert.equal(violations, 0);
});

/** Exact value of a position for the player to move (future boxes minus the opponent's). */
function bruteValue(topology, drawn, memo) {
  let key = 0;
  for (let line = 0; line < drawn.length; line++) if (drawn[line]) key += 2 ** line;
  if (memo.has(key)) return memo.get(key);
  let best = drawn.includes(0) ? -Infinity : 0;
  for (let line = 0; line < drawn.length; line++) {
    if (!drawn[line]) best = Math.max(best, moveValue(topology, drawn, line, memo));
  }
  memo.set(key, best);
  return best;
}

function moveValue(topology, drawn, line, memo) {
  drawn[line] = 1;
  let closed = 0;
  for (const box of [topology.lineBoxes[2 * line], topology.lineBoxes[2 * line + 1]]) {
    if (box >= 0 && [0, 1, 2, 3].every((i) => drawn[topology.boxLines[4 * box + i]])) closed++;
  }
  const value = closed > 0 ? closed + bruteValue(topology, drawn, memo) : -bruteValue(topology, drawn, memo);
  drawn[line] = 0;
  return value;
}
