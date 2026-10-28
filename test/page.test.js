import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const page = read('index.html');
const sources = readdirSync(new URL('src/', root))
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, text: read(`src/${name}`) }));

test('every element the scripts look up exists in index.html', () => {
  const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  let lookups = 0;
  for (const { name, text } of sources) {
    for (const [, id] of text.matchAll(/byId\(['`]([^'`]+)['`]\)/g)) {
      for (const player of ['0', '1']) {
        const wanted = id.replace('${player}', player);
        assert.ok(ids.has(wanted), `${name} looks up #${wanted}`);
      }
      lookups++;
    }
  }
  assert.ok(lookups > 20, `found ${lookups} lookups`);
});

test('the scripts avoid eval, innerHTML and console output', () => {
  for (const { name, text } of sources) {
    for (const pattern of [/\binnerHTML\b/, /\bouterHTML\b/, /\beval\s*\(/, /\bnew Function\b/, /\bconsole\./, /document\.write/]) {
      assert.doesNotMatch(text, pattern, `${name} uses ${pattern}`);
    }
  }
});

test('every import is local and points at a file that exists', () => {
  for (const { name, text } of sources) {
    for (const [, path] of text.matchAll(/from '([^']+)'/g)) {
      assert.ok(path.startsWith('./') && path.endsWith('.js'), `${name} imports ${path}`);
      assert.ok(existsSync(new URL(`src/${path.slice(2)}`, root)), `${name} imports missing ${path}`);
    }
  }
});

test('index.html has the page metadata and loads only local files', () => {
  for (const snippet of [
    '<!doctype html>',
    '<html lang="en">',
    '<meta charset="utf-8">',
    'name="viewport"',
    'name="description"',
    'property="og:title"',
    'property="og:description"',
    '<meta property="og:url" content="https://celaldrg.github.io/dots-and-boxes/">',
    '<meta property="og:image" content="https://celaldrg.github.io/dots-and-boxes/docs/screenshot.png">',
    '<link rel="icon" href="data:image/svg+xml,',
    '<script type="module" src="src/main.js"></script>',
    'href="https://github.com/celaldrg/dots-and-boxes"',
  ]) {
    assert.ok(page.includes(snippet), `index.html lacks ${snippet}`);
  }
  for (const [, url] of page.matchAll(/<(?:script|link|img)\b[^>]*\s(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(url), `index.html loads ${url}`);
  }
  assert.doesNotMatch(read('style.css'), /url\(\s*['"]?(https?:)?\/\//, 'style.css loads nothing remote');
});

test('the viewport allows safe-area padding only because the CSS uses it', () => {
  assert.ok(page.includes('viewport-fit=cover'));
  assert.match(read('style.css'), /env\(safe-area-inset-/);
});
