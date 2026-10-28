import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, storage } from '../src/storage.js';

/** A Map-backed stand-in for localStorage. */
function memoryBackend() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test('values survive a save and load round trip under a prefixed key', () => {
  const backend = memoryBackend();
  const store = createStore(() => backend);
  assert.equal(store.save('stats', { easy: { wins: 2 } }), true);
  assert.deepEqual(store.load('stats', null), { easy: { wins: 2 } });
  assert.deepEqual([...backend.map.keys()], ['dots-and-boxes.stats']);
  assert.equal(store.load('missing', 'fallback'), 'fallback');
});

test('broken or blocked storage never throws', () => {
  const blocked = createStore(() => {
    throw new Error('SecurityError: storage is disabled');
  });
  assert.equal(blocked.load('lang', 'en'), 'en');
  assert.equal(blocked.save('lang', 'tr'), false);

  const full = createStore(() => ({
    getItem: () => '{not json',
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  }));
  assert.equal(full.load('stats', 42), 42, 'malformed JSON falls back');
  assert.equal(full.save('stats', {}), false);

  const absent = createStore(() => undefined);
  assert.equal(absent.load('lang', 'en'), 'en');
  assert.equal(absent.save('lang', 'tr'), false);
});

/**
 * Runs `body` with globalThis.localStorage replaced by `descriptor`, then puts
 * back whatever the runtime had (newer Node versions define their own).
 */
function withLocalStorage(descriptor, body) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
  try {
    body();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('the default store looks up localStorage on every call and copes without it', (t) => {
  if (Object.getOwnPropertyDescriptor(globalThis, 'localStorage')?.configurable === false) {
    t.skip('this runtime does not let tests replace localStorage');
    return;
  }
  const backend = memoryBackend();
  withLocalStorage({ value: backend }, () => {
    assert.equal(storage.save('lang', 'tr'), true);
    assert.equal(storage.load('lang', 'en'), 'tr');
    assert.deepEqual([...backend.map.keys()], ['dots-and-boxes.lang']);
  });
  withLocalStorage({ value: undefined }, () => {
    assert.equal(storage.load('lang', 'en'), 'en');
    assert.equal(storage.save('lang', 'tr'), false);
  });
  withLocalStorage({ get: () => { throw new Error('SecurityError: access denied'); } }, () => {
    assert.equal(storage.load('lang', 'en'), 'en', 'blocked storage throws on access in some browsers');
    assert.equal(storage.save('lang', 'tr'), false);
  });
});
