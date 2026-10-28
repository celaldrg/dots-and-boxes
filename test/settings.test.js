import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SIZES, normalizeSettings } from '../src/settings.js';

test('the setup offers boards from 3 x 3 to 7 x 7', () => {
  assert.deepEqual(SIZES, [3, 4, 5, 6, 7]);
  assert.ok(SIZES.includes(DEFAULT_SETTINGS.size));
});

test('nothing stored gives the defaults', () => {
  for (const raw of [null, undefined, 'junk', 42, []]) {
    assert.deepEqual(normalizeSettings(raw), { ...DEFAULT_SETTINGS }, String(raw));
  }
});

test('valid values are kept, form strings become numbers', () => {
  assert.deepEqual(normalizeSettings({ size: 7, mode: 'pvp', level: 'hard', starter: 1 }), {
    size: 7,
    mode: 'pvp',
    level: 'hard',
    starter: 1,
  });
  assert.deepEqual(normalizeSettings({ size: '3', mode: 'cpu', level: 'easy', starter: '1' }), {
    size: 3,
    mode: 'cpu',
    level: 'easy',
    starter: 1,
  });
});

test('each invalid value falls back on its own', () => {
  assert.deepEqual(normalizeSettings({ size: 12, mode: 'online', level: 'expert', starter: 2 }), { ...DEFAULT_SETTINGS });
  assert.deepEqual(normalizeSettings({ size: 4.5, mode: 'pvp' }), { ...DEFAULT_SETTINGS, mode: 'pvp' });
  assert.deepEqual(normalizeSettings({ size: '6', level: '__proto__' }), { ...DEFAULT_SETTINGS, size: 6 });
});
