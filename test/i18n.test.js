import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGUAGES, MESSAGES, normalizeLanguage, otherLanguage, translate } from '../src/i18n.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('English and Turkish have the same keys, all non-empty', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  const keys = Object.keys(MESSAGES.en).sort();
  assert.deepEqual(Object.keys(MESSAGES.tr).sort(), keys);
  for (const lang of LANGUAGES) {
    for (const key of keys) {
      assert.equal(typeof MESSAGES[lang][key], 'string', `${lang}.${key}`);
      assert.ok(MESSAGES[lang][key].trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('both languages use the same placeholders', () => {
  for (const key of Object.keys(MESSAGES.en)) {
    assert.deepEqual(placeholders(MESSAGES.tr[key]), placeholders(MESSAGES.en[key]), key);
  }
});

test('translate fills placeholders and falls back sensibly', () => {
  assert.equal(translate('en', 'turnPlayer', { name: 'Player 2' }), 'Player 2 to move');
  assert.equal(translate('tr', 'turnPlayer', { name: 'Oyuncu 2' }), 'Sıra: Oyuncu 2');
  assert.equal(translate('tr', 'title'), 'Noktalar ve Kutular');
  assert.equal(translate('de', 'title'), 'Dots and Boxes', 'unknown language uses English');
  assert.equal(translate('en', 'noSuchKey'), 'noSuchKey');
  assert.equal(translate('en', 'turnPlayer'), '{name} to move', 'missing params stay visible');
  assert.equal(translate('en', 'toString'), 'toString', 'object keys are not strings');
});

test('language helpers', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('fr'), 'en');
  assert.equal(normalizeLanguage(null), 'en');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
  assert.equal(translate('en', 'langButton'), 'TR', 'the toggle shows the language it switches to');
  assert.equal(translate('tr', 'langButton'), 'EN');
});

test('every text key used in index.html exists', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = [...page.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(used.length > 20, `found ${used.length} keys`);
  for (const key of used) assert.ok(Object.hasOwn(MESSAGES.en, key), `index.html uses unknown key "${key}"`);
});
