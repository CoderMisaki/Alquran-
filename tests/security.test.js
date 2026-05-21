require('./test-setup.js');
const test = require('node:test');
const assert = require('node:assert');
const { escapeHTML, safeFetchJson, createTextElement } = require('../assets/js/app.js');

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
