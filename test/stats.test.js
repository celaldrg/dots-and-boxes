import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStats, recordResult } from '../src/stats.js';
import { HUMAN, COMPUTER } from '../src/game.js';

const ZERO = { wins: 0, losses: 0, draws: 0 };
const EMPTY = { easy: ZERO, medium: ZERO, hard: ZERO };

test('nothing stored means zero games for every level', () => {
  assert.deepEqual(normalizeStats(null), EMPTY);
});

test('recordResult counts wins, losses and draws per level without changing its input', () => {
  const start = normalizeStats(null);
  let stats = recordResult(start, 'hard', HUMAN);
  stats = recordResult(stats, 'hard', COMPUTER);
  stats = recordResult(stats, 'hard', COMPUTER);
  stats = recordResult(stats, 'easy', null);
  assert.deepEqual(stats.hard, { wins: 1, losses: 2, draws: 0 });
  assert.deepEqual(stats.easy, { wins: 0, losses: 0, draws: 1 });
  assert.deepEqual(stats.medium, ZERO);
  assert.deepEqual(start, EMPTY);
  assert.throws(() => recordResult(stats, 'expert', HUMAN), RangeError);
});

test('normalizeStats repairs whatever storage returned', () => {
  for (const raw of [null, undefined, 'oops', 42, [], {}]) assert.deepEqual(normalizeStats(raw), EMPTY);
  assert.deepEqual(
    normalizeStats({ easy: { wins: 3, losses: -1, draws: 'x' }, medium: null, hard: { wins: 1.5, draws: 2 } }),
    { easy: { wins: 3, losses: 0, draws: 0 }, medium: ZERO, hard: { wins: 0, losses: 0, draws: 2 } },
  );
});
