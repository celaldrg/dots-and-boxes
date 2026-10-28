import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, pick } from '../src/rng.js';

const take = (rng, count) => Array.from({ length: count }, () => rng());

test('the same seed gives the same sequence', () => {
  assert.deepEqual(take(createRng(42), 20), take(createRng(42), 20));
  assert.notDeepEqual(take(createRng(42), 20), take(createRng(43), 20));
});

test('values lie in [0, 1) and spread over the range', () => {
  const values = take(createRng(7), 5000);
  assert.ok(values.every((value) => value >= 0 && value < 1));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.03, `mean ${mean}`);
});

test('pick returns every element of a list eventually and nothing else', () => {
  const rng = createRng(3);
  const items = ['a', 'b', 'c', 'd'];
  const seen = new Set(Array.from({ length: 200 }, () => pick(rng, items)));
  assert.deepEqual([...seen].sort(), items);
});
