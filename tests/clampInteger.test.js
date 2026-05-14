const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Read app.js
const appJsPath = path.join(__dirname, '..', 'assets', 'js', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Use regex to extract the clampInteger function
// This avoids having to run all of app.js (which might have DOM dependencies)
const clampIntegerMatch = appJsContent.match(/function clampInteger[\s\S]*?\n        \}/);

if (!clampIntegerMatch) {
    throw new Error('Could not find clampInteger function in app.js');
}

const clampIntegerCode = clampIntegerMatch[0];

// Execute the extracted function in a sandboxed context
const context = {};
vm.createContext(context);
vm.runInContext(clampIntegerCode + '\nthis.clampInteger = clampInteger;', context);
const clampInteger = context.clampInteger;


test('clampInteger utility', async (t) => {

    await t.test('Happy paths - normal valid integers', () => {
        assert.strictEqual(clampInteger(5, 1, 10), 5);
        assert.strictEqual(clampInteger(8, 1, 10), 8);
    });

    await t.test('String integer inputs', () => {
        assert.strictEqual(clampInteger("5", 1, 10), 5);
        assert.strictEqual(clampInteger("8", 1, 10), 8);
    });

    await t.test('Boundary conditions', () => {
        assert.strictEqual(clampInteger(1, 1, 10), 1, 'Should return min when equal to min');
        assert.strictEqual(clampInteger(10, 1, 10), 10, 'Should return max when equal to max');
    });

    await t.test('Out of bounds cases', () => {
        assert.strictEqual(clampInteger(0, 1, 10), 1, 'Should clamp to min when below min');
        assert.strictEqual(clampInteger(-5, 1, 10), 1, 'Should clamp to min when far below min');
        assert.strictEqual(clampInteger(11, 1, 10), 10, 'Should clamp to max when above max');
        assert.strictEqual(clampInteger(100, 1, 10), 10, 'Should clamp to max when far above max');
    });

    await t.test('Float inputs - parsed as integers via parseInt', () => {
        assert.strictEqual(clampInteger(5.5, 1, 10), 5);
        assert.strictEqual(clampInteger("5.5", 1, 10), 5);
        assert.strictEqual(clampInteger("5.9", 1, 10), 5); // parseInt truncates
    });

    await t.test('Invalid inputs returning null', () => {
        assert.strictEqual(clampInteger("abc", 1, 10), null, 'Non-numeric string should return null');
        assert.strictEqual(clampInteger(NaN, 1, 10), null, 'NaN should return null');
        assert.strictEqual(clampInteger(null, 1, 10), null, 'null should return null');
        assert.strictEqual(clampInteger(undefined, 1, 10), null, 'undefined should return null');
        assert.strictEqual(clampInteger("", 1, 10), null, 'empty string should return null');
    });
});
