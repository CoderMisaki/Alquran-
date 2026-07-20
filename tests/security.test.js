require('./test-setup.js');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { safeFetchJson, createTextElement, sanitizeReadingPreferences, sanitizeLastReadPosition, validateApiAyahArray } = require('../assets/js/app.js');

const root = path.resolve(__dirname, '..');

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

function withMockStorage(seed, run) {
  const store = new Map(Object.entries(seed || {}));
  const original = global.localStorage;
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
  try {
    run(store);
  } finally {
    global.localStorage = original;
  }
}

test('createTextElement renders as text not html', () => {
  const el = createTextElement('div', '', '<script>alert(1)</script>');
  assert.strictEqual(el.textContent, '<script>alert(1)</script>');
  assert.notStrictEqual(el.innerHTML, '<script>alert(1)</script>');
});

test('safeFetchJson rejects non-allowlisted domain', async () => {
  await assert.rejects(() => safeFetchJson('https://evil.example.com/x.json'));
});

test('index.html has no inline event handlers', () => {
  assert.doesNotMatch(read('index.html'), /\son[a-z]+\s*=/i);
});

test('no unsafe-inline in index.html/vercel.json', () => {
  assert.doesNotMatch(read('index.html'), /unsafe-inline/i);
  assert.doesNotMatch(read('vercel.json'), /unsafe-inline/i);
});

test('assets/js/app.js forbids dangerous DOM/code execution sinks', () => {
  const js = read('assets/js/app.js');
  assert.doesNotMatch(js, /\binnerHTML\s*=/);
  assert.doesNotMatch(js, /\bouterHTML\s*=/);
  assert.doesNotMatch(js, /insertAdjacentHTML\s*\(/);
  assert.doesNotMatch(js, /document\.write\s*\(/);
  assert.doesNotMatch(js, /\beval\s*\(/);
  assert.doesNotMatch(js, /new\s+Function\s*\(/);
});

test('no fetch() outside safeFetchJson', () => {
  const js = read('assets/js/app.js');
  const withoutSafeFn = js.replace(/async function safeFetchJson[\s\S]*?\n}\n/, '');
  assert.doesNotMatch(withoutSafeFn, /\bfetch\s*\(/);
});

test('sanitizeLastReadPosition resets invalid ayah and surah bounds', () => {
  assert.deepStrictEqual(sanitizeLastReadPosition('2', '9999'), { surah: 2, ayah: 1 });
  assert.deepStrictEqual(sanitizeLastReadPosition('999', '1'), { surah: null, ayah: null });
});

test('sanitizeReadingPreferences hardens storage values', () => {
  withMockStorage({ lastReadSurah: '999', lastReadAyah: '777', quranZoomLevel: '200', lastReadJuz: '31' }, (store) => {
    const output = sanitizeReadingPreferences();
    assert.strictEqual(output.surah, null);
    assert.strictEqual(output.ayah, null);
    assert.strictEqual(output.zoom, 30);
    assert.strictEqual(output.juz, null);
    assert.strictEqual(store.get('quranZoomLevel'), '30');
    assert.strictEqual(store.has('lastReadSurah'), false);
    assert.strictEqual(store.has('lastReadAyah'), false);
  });

  withMockStorage({ lastReadSurah: '2', lastReadAyah: '9999', quranZoomLevel: '-1' }, (store) => {
    const output = sanitizeReadingPreferences();
    assert.strictEqual(output.surah, 2);
    assert.strictEqual(output.ayah, 1);
    assert.strictEqual(output.zoom, 30);
    assert.strictEqual(store.get('lastReadAyah'), '1');
  });
});

test('validateApiAyahArray rejects malformed items and overlong translation', () => {
  const list = validateApiAyahArray([
    { numberInSurah: 1, text: 'ٱلْحَمْدُ', translation: 'ok', juz: 1 },
    { numberInSurah: -1, text: 'bad', translation: 'drop', juz: 2 },
    { numberInSurah: 2, text: 'abc', translation: 'x'.repeat(5001), juz: 99 },
    null,
    'bad'
  ]);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].translation, 'ok');
  assert.strictEqual(list[1].translation, '');
  assert.strictEqual(list[1].juz, null);
});

test('validateApiAyahArray handles non-array input', () => {
  const result1 = validateApiAyahArray(null);
  const result2 = validateApiAyahArray(undefined);
  const result3 = validateApiAyahArray({});
  const result4 = validateApiAyahArray("not an array");

  assert.deepStrictEqual(result1, []);
  assert.deepStrictEqual(result2, []);
  assert.deepStrictEqual(result3, []);
  assert.deepStrictEqual(result4, []);
});
