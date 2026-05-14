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
