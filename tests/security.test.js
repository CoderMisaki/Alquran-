require('./test-setup.js');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { escapeHTML, safeFetchJson, createTextElement } = require('../assets/js/app.js');

const root = path.resolve(__dirname, '..');

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

test('escapeHTML escapes dangerous html', () => {
  const raw = '<img src=x onerror=alert(1)>';
  assert.match(escapeHTML(raw), /&lt;img/);
});

test('createTextElement renders as text not html', () => {
  const el = createTextElement('div', '', '<script>alert(1)</script>');
  assert.strictEqual(el.textContent, '<script>alert(1)</script>');
});

test('safeFetchJson rejects non-allowlisted domain', async () => {
  await assert.rejects(() => safeFetchJson('https://evil.example.com/x.json'));
});

test('index.html has no inline onclick', () => {
  assert.doesNotMatch(read('index.html'), /\sonclick\s*=/i);
});

test('no unsafe-inline in index.html/vercel.json', () => {
  assert.doesNotMatch(read('index.html'), /unsafe-inline/i);
  assert.doesNotMatch(read('vercel.json'), /unsafe-inline/i);
});

test('no fetch() outside safeFetchJson', () => {
  const js = read('assets/js/app.js');
  const withoutSafeFn = js.replace(/async function safeFetchJson[\s\S]*?\n}\n/, '');
  assert.doesNotMatch(withoutSafeFn, /\bfetch\s*\(/);
});

test('no innerHTML usage for dynamic rendering', () => {
  assert.doesNotMatch(read('assets/js/app.js'), /\.innerHTML\s*=/);
});
