const fs = require('fs');
const path = require('path');

// Provide basic DOM mock before running app.js so it doesn't crash on load
document.body.innerHTML = `
    <input id="search-input" />
    <div id="search-clear"></div>
    <div id="surah-list"></div>
    <div id="theme-toggle"></div>
    <div id="juz-container"></div>
    <div id="juz-list"></div>
    <div id="toast"></div>
    <div id="toast-message"></div>
    <div id="loader"></div>
`;

// Also need to set up localStorage since jsdom might throw on opaque origin without setup
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) { return store[key] || null; },
    setItem: function(key, value) { store[key] = value.toString(); },
    clear: function() { store = {}; },
    removeItem: function(key) { delete store[key]; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Require app.js which will attach safeFetchJson to module.exports
const app = require('../assets/js/app.js');

describe('safeFetchJson', () => {
    // Save original fetch
    const originalFetch = global.fetch;

    afterEach(() => {
        // Restore fetch after each test
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    test('should return JSON data on successful response (ok: true)', async () => {
        const mockData = { message: 'success' };
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockData),
            })
        );

        const result = await app.safeFetchJson('https://api.example.com/data');
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data');
        expect(result).toEqual(mockData);
    });

    test('should throw an error with the correct message when response is not ok (e.g., 404)', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                status: 404,
            })
        );

        await expect(app.safeFetchJson('https://api.example.com/data')).rejects.toThrow('Gagal mengambil data, HTTP Status: 404');
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data');
    });

    test('should throw an error with the correct message when response is not ok (e.g., 500)', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                status: 500,
            })
        );

        await expect(app.safeFetchJson('https://api.example.com/data')).rejects.toThrow('Gagal mengambil data, HTTP Status: 500');
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data');
    });

    test('should propagate network errors thrown by fetch', async () => {
        const networkError = new Error('Network failure');
        global.fetch = jest.fn(() => Promise.reject(networkError));

        await expect(app.safeFetchJson('https://api.example.com/data')).rejects.toThrow('Network failure');
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/data');
    });
});
