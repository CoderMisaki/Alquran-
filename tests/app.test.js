require('./test-setup.js');
const test = require('node:test');
const assert = require('node:assert');
const { cleanBismillah } = require('../assets/js/app.js');

test('cleanBismillah', async (t) => {
  await t.test('returns original text for surah 1', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ';
    assert.strictEqual(cleanBismillah(text, 1), text);
  });

  await t.test('returns original text for surah 9', () => {
    const text = 'بَرَآءَةٌۭ مِّنَ ٱللَّهِ وَرَسُولِهِۦٓ إِلَى ٱلَّذِينَ عَـٰهَدتُّم مِّنَ ٱلْمُشْرِكِينَ';
    assert.strictEqual(cleanBismillah(text, 9), text);
  });

  await t.test('trims bismillah for other surahs', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ الٓمٓ';
    const expected = 'الٓمٓ';
    assert.strictEqual(cleanBismillah(text, 2), expected);
  });

  await t.test('returns original text if it does not start with bismillah', () => {
    const text = 'الٓمٓ ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًۭى لِّلْمُتَّقِينَ';
    assert.strictEqual(cleanBismillah(text, 2), text);
  });

  await t.test('returns original text if words < 5', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ';
    assert.strictEqual(cleanBismillah(text, 2), text);
  });
});

const fs = require('node:fs');
const path = require('node:path');
const {
  indoSurahMeta,
  normalizeSearchText,
  matchesSurahSearch,
  filterSurahsBySearch,
  updateSearchClearVisibility,
  clearSearch,
  sanitizeLastReadPosition,
  setupContinueReadingSwipe
} = require('../assets/js/app.js');

function surah(number, extra = {}) {
  const meta = indoSurahMeta[number];
  return { number, indoName: meta.name, indoTranslation: meta.translation, ...extra };
}

for (const query of ['baqarah', 'al baqarah', 'al-baqarah']) {
  test(`search ${JSON.stringify(query)} finds Al-Baqarah`, () => {
    assert.strictEqual(matchesSurahSearch(surah(2), query), true);
  });
}

for (const query of ['annas', 'an nas', 'an-nas']) {
  test(`search ${JSON.stringify(query)} finds An-Nas`, () => {
    assert.strictEqual(matchesSurahSearch(surah(114), query), true);
  });
}

test('search supports surah number and Ya-Sin aliases', () => {
  assert.strictEqual(matchesSurahSearch(surah(36), '36'), true);
  assert.strictEqual(matchesSurahSearch(surah(36), 'yasin'), true);
  assert.strictEqual(matchesSurahSearch(surah(36), 'yaa siin'), true);
});

test('search normalization removes latin diacritics and light punctuation', () => {
  assert.strictEqual(normalizeSearchText("  Al—Baqarāh__  "), 'al baqarah');
});

test('search filters the active Juz list and preserves an empty result', () => {
  const juzOne = [surah(1), surah(2)];
  assert.deepStrictEqual(filterSurahsBySearch(juzOne, 'baqarah').map(({ number }) => number), [2]);
  assert.deepStrictEqual(filterSurahsBySearch(juzOne, 'an-nas'), []);
  assert.deepStrictEqual(filterSurahsBySearch(juzOne, '').map(({ number }) => number), [1, 2]);
});

test('clear search empties input and hides its clear button', () => {
  const originalDocument = global.document;
  const classes = new Set();
  const input = { value: 'baqarah' };
  const clearButton = { classList: { toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) } };
  global.document = { ...originalDocument, getElementById: (id) => ({ 'search-input': input, 'search-clear': clearButton }[id] || null) };
  try {
    updateSearchClearVisibility(input.value);
    assert.strictEqual(classes.has('hidden'), false);
    clearSearch();
    assert.strictEqual(input.value, '');
    assert.strictEqual(classes.has('hidden'), true);
  } finally { global.document = originalDocument; }
});

test('all 114 local surah metadata entries are named without placeholders', () => {
  assert.strictEqual(Object.keys(indoSurahMeta).length, 114);
  for (let number = 1; number <= 114; number += 1) {
    assert.ok(indoSurahMeta[number]?.name);
    assert.doesNotMatch(indoSurahMeta[number].name, /^Surah\s+\d+$/i);
  }
});

test('sanitizeLastReadPosition remains safe for valid and invalid positions', () => {
  assert.deepStrictEqual(sanitizeLastReadPosition('36', '83'), { surah: 36, ayah: 83 });
  assert.deepStrictEqual(sanitizeLastReadPosition('36', '84'), { surah: 36, ayah: 1 });
});

function createSwipeHarness() {
  const listeners = new Map();
  const classes = new Set();
  const storage = new Map([['lastReadSurah', '2'], ['lastReadAyah', '25'], ['lastReadJuz', '1']]);
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalStorage = global.localStorage;
  const styleValues = new Map();
  const card = {
    style: {
      transform: '', opacity: '',
      setProperty: (key, value) => styleValues.set(key, String(value)),
      removeProperty: (key) => styleValues.delete(key)
    },
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value))
    },
    addEventListener: (type, listener) => listeners.set(type, listener),
    setPointerCapture: () => {}, hasPointerCapture: () => false
  };
  global.document = { ...originalDocument, getElementById: (id) => id === 'continue-reading' ? card : null };
  global.window = { ...originalWindow, requestAnimationFrame: (fn) => { fn(); return 1; }, cancelAnimationFrame: () => {}, setTimeout: (fn) => { fn(); return 1; } };
  global.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
  const restore = () => { global.document = originalDocument; global.window = originalWindow; global.localStorage = originalStorage; };
  return { card, classes, listeners, storage, styleValues, restore };
}

function dispatchSwipe(harness, fromX, toX, y = 10) {
  harness.listeners.get('pointerdown')({ pointerId: 1, button: 0, clientX: fromX, clientY: y });
  harness.listeners.get('pointermove')({ pointerId: 1, clientX: toX, clientY: y });
  harness.listeners.get('pointerup')({ pointerId: 1, clientX: toX, clientY: y });
}

test('small last-read drag snaps back without clearing storage', () => {
  const harness = createSwipeHarness();
  try {
    setupContinueReadingSwipe(() => {});
    dispatchSwipe(harness, 200, 170);
    assert.strictEqual(harness.storage.get('lastReadSurah'), '2');
    assert.strictEqual(harness.card.style.transform, '');
    assert.strictEqual(harness.card.style.opacity, '');
  } finally { harness.restore(); }
});

test('last-read drag beyond threshold clears storage and hides card', () => {
  const harness = createSwipeHarness();
  try {
    setupContinueReadingSwipe(() => {});
    dispatchSwipe(harness, 200, 70);
    assert.strictEqual(harness.storage.has('lastReadSurah'), false);
    assert.strictEqual(harness.storage.has('lastReadAyah'), false);
    assert.strictEqual(harness.storage.has('lastReadJuz'), false);
    assert.strictEqual(harness.classes.has('hidden'), true);
  } finally { harness.restore(); }
});

test('last-read click without drag resumes reading', () => {
  const harness = createSwipeHarness();
  let resumed = 0;
  try {
    setupContinueReadingSwipe(() => { resumed += 1; });
    harness.listeners.get('pointerdown')({ pointerId: 1, button: 0, clientX: 200, clientY: 10 });
    harness.listeners.get('pointerup')({ pointerId: 1, clientX: 200, clientY: 10 });
    harness.listeners.get('click')({ preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(resumed, 1);
  } finally { harness.restore(); }
});

test('last-read swipe does not resume reading and clears transient styles and classes', () => {
  const harness = createSwipeHarness();
  let resumed = 0;
  try {
    harness.classes.add('is-pressed');
    setupContinueReadingSwipe(() => { resumed += 1; });
    dispatchSwipe(harness, 200, 70);
    harness.listeners.get('click')({ preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(resumed, 0);
    assert.strictEqual(harness.card.style.transform, '');
    assert.strictEqual(harness.card.style.opacity, '');
    assert.strictEqual(harness.styleValues.has('--swipe-ratio'), false);
    for (const name of ['is-pressed', 'cr-swiping', 'cr-snap-back', 'cr-swipe-out-left']) assert.strictEqual(harness.classes.has(name), false);
  } finally { harness.restore(); }
});

test('vertical last-read gesture keeps native scrolling behavior without swipe styles', () => {
  const harness = createSwipeHarness();
  try {
    setupContinueReadingSwipe(() => {});
    harness.listeners.get('pointerdown')({ pointerId: 1, button: 0, clientX: 200, clientY: 10 });
    harness.listeners.get('pointermove')({ pointerId: 1, clientX: 198, clientY: 80 });
    harness.listeners.get('pointerup')({ pointerId: 1, clientX: 198, clientY: 80 });
    assert.strictEqual(harness.card.style.transform, '');
    assert.strictEqual(harness.card.style.opacity, '');
    assert.strictEqual(harness.classes.has('cr-swiping'), false);
    assert.strictEqual(harness.storage.get('lastReadSurah'), '2');
  } finally { harness.restore(); }
});

test('last-read swipe setup is safe when the card is absent', () => {
  const originalDocument = global.document;
  global.document = { ...originalDocument, getElementById: () => null };
  try { assert.doesNotThrow(() => setupContinueReadingSwipe(() => {})); }
  finally { global.document = originalDocument; }
});

test('style.css contains CSS only, without accidentally embedded JavaScript', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../assets/css/style.css'), 'utf8');
  assert.doesNotMatch(css, /\bfunction\s+[A-Za-z_$]/);
  assert.doesNotMatch(css, /\b(?:let|const|var)\s+[A-Za-z_$]/);
  assert.doesNotMatch(css, /document\.|localStorage|API_BASE/);
  assert.doesNotMatch(css, /^(?:<<<<<<<|=======|>>>>>>>|PATH:)/m);
  assert.doesNotMatch(css, /PATH:\s*assets\/js\/app\.js/);
  assert.match(css, /\.empty-state\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
});

test('app.js contains JavaScript only and target logic is not duplicated', () => {
  const js = fs.readFileSync(path.resolve(__dirname, '../assets/js/app.js'), 'utf8');
  assert.doesNotMatch(js, /^(?:<<<<<<<|=======|>>>>>>>|PATH:)/m);
  assert.doesNotMatch(js, /^\s*[.#][A-Za-z_-][^\n{]*\{\s*$/m);
  for (const name of ['bindEvents', 'setupContinueReadingSwipe', 'applySearchAndFilter']) {
    assert.strictEqual((js.match(new RegExp(`function ${name}\\(`, 'g')) || []).length, 1, `${name} must have one declaration`);
  }
});
