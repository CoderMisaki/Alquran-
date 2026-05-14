const test = require('node:test');
const assert = require('node:assert');

// Mock localStorage and document before requiring app.js
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

const mockElement = {
    textContent: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    addEventListener: () => {},
    style: { setProperty: () => {}, display: '' },
    innerHTML: '',
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    dataset: {},
    scrollIntoView: () => {}
};

global.document = {
  documentElement: mockElement,
  getElementById: () => mockElement,
  querySelector: () => mockElement,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({...mockElement}),
  createDocumentFragment: () => ({ appendChild: () => {} }),
  body: { ...mockElement, style: {} }
};
global.window = {
  addEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  location: { hash: '' },
  scrollTo: () => {}
};
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });

const { debounce } = require('../assets/js/app.js');

test('debounce - does not execute immediately', async () => {
    let callCount = 0;
    const func = () => callCount++;
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    assert.strictEqual(callCount, 0, 'Function should not be called immediately');
});

test('debounce - executes callback exactly once after delay', async () => {
    let callCount = 0;
    const func = () => callCount++;
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    await new Promise(resolve => setTimeout(resolve, 150));

    assert.strictEqual(callCount, 1, 'Function should be called exactly once after the delay');
});

test('debounce - preserves arguments passed to callback', async () => {
    let receivedArgs = null;
    const func = (...args) => receivedArgs = args;
    const debouncedFunc = debounce(func, 50);

    debouncedFunc(1, 2, 'three');

    await new Promise(resolve => setTimeout(resolve, 100));

    assert.deepStrictEqual(receivedArgs, [1, 2, 'three'], 'Arguments should be correctly passed to original function');
});

test('debounce - preserves the this context of the callback', async () => {
    const obj = {
        val: 0,
        increment: function(amount) {
            this.val += amount;
        }
    };
    obj.debouncedIncrement = debounce(obj.increment, 50);

    obj.debouncedIncrement(5);

    await new Promise(resolve => setTimeout(resolve, 100));

    assert.strictEqual(obj.val, 5, 'Debounced function should preserve context (`this`) and arguments');
});
