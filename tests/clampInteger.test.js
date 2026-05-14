const assert = require('node:assert');

// Mock browser globals required by app.js before requiring it
global.document = {
    documentElement: { style: { setProperty: () => {} } },
    getElementById: () => ({
        classList: { add: () => {}, remove: () => {} },
        value: '',
        style: {},
        addEventListener: () => {},
        textContent: ''
    }),
    querySelectorAll: () => [],
    querySelector: () => ({ addEventListener: () => {} }),
    addEventListener: () => {},
    body: { classList: { add: () => {}, remove: () => {} }, style: {} },
    createElement: () => ({
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {},
        setAttribute: () => {},
        addEventListener: () => {},
        style: {}
    })
};
global.window = {
    addEventListener: () => {},
    scrollTo: () => {},
    scrollY: 0,
    innerHeight: 1000,
    location: { hash: '' },
    matchMedia: () => ({ matches: false, addEventListener: () => {} })
};
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};
global.navigator = { userAgent: '' };

const { clampInteger } = require('../assets/js/app.js');

try {
    // Test Happy Path: Value within range
    assert.strictEqual(clampInteger(5, 1, 10), 5, 'Should return 5 when clamping 5 between 1 and 10');
    assert.strictEqual(clampInteger('5', 1, 10), 5, 'Should return 5 when clamping string "5" between 1 and 10');

    // Test Edge Cases: Value exactly at min or max
    assert.strictEqual(clampInteger(1, 1, 10), 1, 'Should return 1 when clamping 1 between 1 and 10');
    assert.strictEqual(clampInteger(10, 1, 10), 10, 'Should return 10 when clamping 10 between 1 and 10');

    // Test Out of bounds: Value below min or above max
    assert.strictEqual(clampInteger(0, 1, 10), 1, 'Should return 1 when clamping 0 between 1 and 10');
    assert.strictEqual(clampInteger(-5, 1, 10), 1, 'Should return 1 when clamping -5 between 1 and 10');
    assert.strictEqual(clampInteger(11, 1, 10), 10, 'Should return 10 when clamping 11 between 1 and 10');
    assert.strictEqual(clampInteger(100, 1, 10), 10, 'Should return 10 when clamping 100 between 1 and 10');

    // Test Error conditions / Invalid input
    assert.strictEqual(clampInteger(5.5, 1, 10), 5, 'Number.parseInt parses 5.5 as 5, so should return 5');
    assert.strictEqual(clampInteger('abc', 1, 10), null, 'Should return null for non-numeric string "abc"');
    assert.strictEqual(clampInteger('', 1, 10), null, 'Should return null for empty string');
    assert.strictEqual(clampInteger(NaN, 1, 10), null, 'Should return null for NaN');
    assert.strictEqual(clampInteger(null, 1, 10), null, 'Should return null for null input');
    assert.strictEqual(clampInteger(undefined, 1, 10), null, 'Should return null for undefined input');

    console.log('✅ All clampInteger tests passed successfully!');
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}
