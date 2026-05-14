const { performance } = require('perf_hooks');

const API_BASE = "https://api.alquran.cloud/v1";

async function safeFetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data, HTTP Status: ${response.status}`);
    }
    return await response.json();
}

async function sequentialFetch() {
    const start = performance.now();
    let dataAr, dataId, dataLat;
    try {
        dataAr = await safeFetchJson(`${API_BASE}/surah/1/quran-uthmani`);
        dataId = await safeFetchJson(`${API_BASE}/surah/1/id.indonesian`);
        dataLat = await safeFetchJson(`${API_BASE}/surah/1/en.transliteration`);
    } catch {}
    const end = performance.now();
    return end - start;
}

async function parallelFetch() {
    const start = performance.now();
    let dataAr, dataId, dataLat;
    try {
        [dataAr, dataId, dataLat] = await Promise.all([
            safeFetchJson(`${API_BASE}/surah/1/quran-uthmani`),
            safeFetchJson(`${API_BASE}/surah/1/id.indonesian`),
            safeFetchJson(`${API_BASE}/surah/1/en.transliteration`)
        ]);
    } catch {}
    const end = performance.now();
    return end - start;
}

async function run() {
    console.log("Measuring sequential fetch...");
    let seqSum = 0;
    for (let i=0; i<3; i++) {
        seqSum += await sequentialFetch();
    }
    console.log(`Sequential average: ${seqSum/3} ms`);

    console.log("Measuring parallel fetch...");
    let parSum = 0;
    for (let i=0; i<3; i++) {
        parSum += await parallelFetch();
    }
    console.log(`Parallel average: ${parSum/3} ms`);
}

run();
