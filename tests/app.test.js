const assert = require('assert');

// Mock objects for app.js global variables
const mockElement = {
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    setAttribute: () => {},
    removeAttribute: () => {},
    appendChild: () => {},
    innerHTML: '',
    value: '',
    focus: () => {}
};

global.document = {
    addEventListener: () => {},
    getElementById: () => mockElement,
    querySelectorAll: () => [],
    querySelector: () => mockElement,
    documentElement: {
        style: { setProperty: () => {} },
        classList: { add: () => {}, remove: () => {} }
    },
    body: {
        classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} }
    },
    createElement: () => mockElement,
    createDocumentFragment: () => mockElement
};

global.window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    innerWidth: 1024,
    scrollTo: () => {},
    requestAnimationFrame: (cb) => cb()
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

global.IntersectionObserver = class {
    observe() {}
    disconnect() {}
};

global.setTimeout = (cb) => cb();
global.clearTimeout = () => {};

const { safeFetchJson } = require('../assets/js/app.js');

async function runTests() {
    let originalFetch = global.fetch;
    try {
        console.log('Running tests for safeFetchJson...');

        // Test 1: Successful fetch
        global.fetch = async (url) => {
            return {
                ok: true,
                json: async () => ({ success: true, url })
            };
        };
        const result1 = await safeFetchJson('https://example.com/api');
        assert.deepStrictEqual(result1, { success: true, url: 'https://example.com/api' });
        console.log('✅ Test 1 Passed: Successful response resolves correctly');

        // Test 2: HTTP Error Response
        global.fetch = async (url) => {
            return {
                ok: false,
                status: 404,
                json: async () => ({ error: 'Not found' })
            };
        };
        let errorThrown = false;
        try {
            await safeFetchJson('https://example.com/not-found');
        } catch (e) {
            errorThrown = true;
            assert.strictEqual(e.message, 'Gagal mengambil data, HTTP Status: 404');
        }
        assert.strictEqual(errorThrown, true, 'Should have thrown an error for 404 status');
        console.log('✅ Test 2 Passed: Error response handling throws correct message');

        // Test 3: Network Failure
        global.fetch = async (url) => {
            throw new Error('Network failure');
        };
        let networkErrorThrown = false;
        try {
            await safeFetchJson('https://example.com/network-error');
        } catch (e) {
            networkErrorThrown = true;
            assert.strictEqual(e.message, 'Network failure');
        }
        assert.strictEqual(networkErrorThrown, true, 'Should pass through network errors');
        console.log('✅ Test 3 Passed: Network error passes through cleanly');

        console.log('🎉 All safeFetchJson tests passed successfully!');
    } finally {
        global.fetch = originalFetch;
    }
}

runTests().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
