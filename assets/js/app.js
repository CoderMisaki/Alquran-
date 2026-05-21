'use strict';

const API_BASE = 'https://api.alquran.cloud/v1';
const FALLBACK_SURAH_LIST_URL = 'https://raw.githubusercontent.com/rioastamal/quran-json/master/surah.json';
const FALLBACK_SURAH_DETAIL_BASE = 'https://raw.githubusercontent.com/rioastamal/quran-json/master/surah';
const ALLOWED_ORIGINS = new Set(['https://api.alquran.cloud', 'https://raw.githubusercontent.com']);

const HAS_DOM = typeof document !== 'undefined';
const HAS_WINDOW = typeof window !== 'undefined';

function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function createTextElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text == null ? '' : String(text);
  return el;
}

const SURAH_AYAH_LIMITS = Object.freeze({
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
  11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
  21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
  31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
  41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
  51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
  61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
  71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
  81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
  91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
  101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
  111: 5, 112: 4, 113: 5, 114: 6
});

const SAFE_STORAGE_DEFAULTS = Object.freeze({ zoom: 30, surah: null, ayah: null, juz: null });

function parseBoundedInt(raw, min, max) {
  const num = Number(raw);
  return Number.isInteger(num) && num >= min && num <= max ? num : null;
}

function sanitizeLastReadPosition(surahRaw, ayahRaw) {
  const surah = parseBoundedInt(surahRaw, 1, 114);
  if (!surah) return { surah: SAFE_STORAGE_DEFAULTS.surah, ayah: SAFE_STORAGE_DEFAULTS.ayah };
  const maxAyah = SURAH_AYAH_LIMITS[surah] || 286;
  const ayah = parseBoundedInt(ayahRaw, 1, maxAyah);
  if (!ayah) return { surah, ayah: 1 };
  return { surah, ayah };
}

function sanitizeReadingPreferences() {
  const zoom = parseBoundedInt(safeGetStorage('quranZoomLevel'), 0, 100) ?? SAFE_STORAGE_DEFAULTS.zoom;
  const sanitizedRead = sanitizeLastReadPosition(safeGetStorage('lastReadSurah'), safeGetStorage('lastReadAyah'));
  const juz = parseBoundedInt(safeGetStorage('lastReadJuz'), 1, 30) ?? SAFE_STORAGE_DEFAULTS.juz;

  safeSetStorage('quranZoomLevel', zoom);
  if (sanitizedRead.surah === null) {
    safeRemoveStorage('lastReadSurah');
    safeRemoveStorage('lastReadAyah');
  } else {
    safeSetStorage('lastReadSurah', sanitizedRead.surah);
    safeSetStorage('lastReadAyah', sanitizedRead.ayah);
  }
  if (juz === null) safeRemoveStorage('lastReadJuz');
  else safeSetStorage('lastReadJuz', juz);

  return { zoom, ...sanitizedRead, juz };
}

function validateApiAyahArray(input, { maxArabicLength = 2000, maxTranslationLength = 4000 } = {}) {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const numberInSurah = parseBoundedInt(item.numberInSurah, 1, 286);
    const text = typeof item.text === 'string' && item.text.length <= maxArabicLength ? item.text : '';
    if (!numberInSurah) return null;
    return {
      numberInSurah,
      text,
      translation: typeof item.translation === 'string' && item.translation.length <= maxTranslationLength ? item.translation : '',
      juz: parseBoundedInt(item.juz, 1, 30)
    };
  }).filter(Boolean);
}

const isIntRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const asPositiveInt = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };

function safeGetStorage(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSetStorage(key, value) { try { localStorage.setItem(key, String(value)); } catch {} }
function safeRemoveStorage(key) { try { localStorage.removeItem(key); } catch {} }

function getSafeTheme() { const v = safeGetStorage('quranTheme'); return v === 'dark' || v === 'light' ? v : 'light'; }
function getSafeZoom() { return sanitizeReadingPreferences().zoom; }
function getSafeLastRead() { const pref = sanitizeReadingPreferences(); return { surah: pref.surah, ayah: pref.ayah, juz: pref.juz }; }

async function safeFetchJson(url, timeoutMs = 10000) {
  const parsed = new URL(url, HAS_WINDOW && window.location ? window.location.origin : 'http://localhost');
  if (!ALLOWED_ORIGINS.has(parsed.origin)) throw new Error('URL tidak diizinkan');
  const controller = new AbortController();
  const timeoutId = (HAS_WINDOW ? window.setTimeout : setTimeout)(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('JSON invalid');
    throw error;
  } finally { (HAS_WINDOW ? window.clearTimeout : clearTimeout)(timeoutId); }
}

const indoSurahMeta = {
  1: { name: "Al-Fatihah", translation: "Pembukaan" },
  2: { name: "Al-Baqarah", translation: "Sapi" },
  3: { name: "Ali Imran", translation: "Keluarga Imran" },
  4: { name: "An-Nisa", translation: "Wanita" },
  5: { name: "Al-Maidah", translation: "Hidangan" },
  6: { name: "Al-Anam", translation: "Hewan Ternak" },
  7: { name: "Al-Araf", translation: "Tempat Tertinggi" },
  8: { name: "Al-Anfal", translation: "Rampasan Perang" },
  9: { name: "At-Taubah", translation: "Pengampunan" },
  10: { name: "Surah 10", translation: "" },
  11: { name: "Surah 11", translation: "" },
  12: { name: "Surah 12", translation: "" },
  13: { name: "Surah 13", translation: "" },
  14: { name: "Surah 14", translation: "" },
  15: { name: "Surah 15", translation: "" },
  16: { name: "Surah 16", translation: "" },
  17: { name: "Surah 17", translation: "" },
  18: { name: "Surah 18", translation: "" },
  19: { name: "Surah 19", translation: "" },
  20: { name: "Surah 20", translation: "" },
  21: { name: "Surah 21", translation: "" },
  22: { name: "Surah 22", translation: "" },
  23: { name: "Surah 23", translation: "" },
  24: { name: "Surah 24", translation: "" },
  25: { name: "Surah 25", translation: "" },
  26: { name: "Surah 26", translation: "" },
  27: { name: "Surah 27", translation: "" },
  28: { name: "Surah 28", translation: "" },
  29: { name: "Surah 29", translation: "" },
  30: { name: "Surah 30", translation: "" },
  31: { name: "Surah 31", translation: "" },
  32: { name: "Surah 32", translation: "" },
  33: { name: "Surah 33", translation: "" },
  34: { name: "Surah 34", translation: "" },
  35: { name: "Surah 35", translation: "" },
  36: { name: "Surah 36", translation: "" },
  37: { name: "Surah 37", translation: "" },
  38: { name: "Surah 38", translation: "" },
  39: { name: "Surah 39", translation: "" },
  40: { name: "Surah 40", translation: "" },
  41: { name: "Surah 41", translation: "" },
  42: { name: "Surah 42", translation: "" },
  43: { name: "Surah 43", translation: "" },
  44: { name: "Surah 44", translation: "" },
  45: { name: "Surah 45", translation: "" },
  46: { name: "Surah 46", translation: "" },
  47: { name: "Surah 47", translation: "" },
  48: { name: "Surah 48", translation: "" },
  49: { name: "Surah 49", translation: "" },
  50: { name: "Surah 50", translation: "" },
  51: { name: "Surah 51", translation: "" },
  52: { name: "Surah 52", translation: "" },
  53: { name: "Surah 53", translation: "" },
  54: { name: "Surah 54", translation: "" },
  55: { name: "Surah 55", translation: "" },
  56: { name: "Surah 56", translation: "" },
  57: { name: "Surah 57", translation: "" },
  58: { name: "Surah 58", translation: "" },
  59: { name: "Surah 59", translation: "" },
  60: { name: "Surah 60", translation: "" },
  61: { name: "Surah 61", translation: "" },
  62: { name: "Surah 62", translation: "" },
  63: { name: "Surah 63", translation: "" },
  64: { name: "Surah 64", translation: "" },
  65: { name: "Surah 65", translation: "" },
  66: { name: "Surah 66", translation: "" },
  67: { name: "Surah 67", translation: "" },
  68: { name: "Surah 68", translation: "" },
  69: { name: "Surah 69", translation: "" },
  70: { name: "Surah 70", translation: "" },
  71: { name: "Surah 71", translation: "" },
  72: { name: "Surah 72", translation: "" },
  73: { name: "Surah 73", translation: "" },
  74: { name: "Surah 74", translation: "" },
  75: { name: "Surah 75", translation: "" },
  76: { name: "Surah 76", translation: "" },
  77: { name: "Surah 77", translation: "" },
  78: { name: "Surah 78", translation: "" },
  79: { name: "Surah 79", translation: "" },
  80: { name: "Surah 80", translation: "" },
  81: { name: "Surah 81", translation: "" },
  82: { name: "Surah 82", translation: "" },
  83: { name: "Surah 83", translation: "" },
  84: { name: "Surah 84", translation: "" },
  85: { name: "Surah 85", translation: "" },
  86: { name: "Surah 86", translation: "" },
  87: { name: "Surah 87", translation: "" },
  88: { name: "Surah 88", translation: "" },
  89: { name: "Surah 89", translation: "" },
  90: { name: "Surah 90", translation: "" },
  91: { name: "Surah 91", translation: "" },
  92: { name: "Surah 92", translation: "" },
  93: { name: "Surah 93", translation: "" },
  94: { name: "Surah 94", translation: "" },
  95: { name: "Surah 95", translation: "" },
  96: { name: "Surah 96", translation: "" },
  97: { name: "Surah 97", translation: "" },
  98: { name: "Surah 98", translation: "" },
  99: { name: "Surah 99", translation: "" },
  100: { name: "Surah 100", translation: "" },
  101: { name: "Surah 101", translation: "" },
  102: { name: "Surah 102", translation: "" },
  103: { name: "Surah 103", translation: "" },
  104: { name: "Surah 104", translation: "" },
  105: { name: "Surah 105", translation: "" },
  106: { name: "Surah 106", translation: "" },
  107: { name: "Surah 107", translation: "" },
  108: { name: "Surah 108", translation: "" },
  109: { name: "Surah 109", translation: "" },
  110: { name: "Surah 110", translation: "" },
  111: { name: "Surah 111", translation: "" },
  112: { name: "Surah 112", translation: "" },
  113: { name: "Surah 113", translation: "" },
  114: { name: "An-Nas", translation: "Manusia" }
};

let state = { allSurahs: [], currentOpenedSurah: null, activeJuzFilter: null, currentJuzData: null, isLocked: false, currentZoomLevel: getSafeZoom() };

function qs(id) { return HAS_DOM ? document.getElementById(id) : null; }
function validSurahNumber(n) { return isIntRange(Number(n), 1, 114); }
function validJuz(n) { return isIntRange(Number(n), 1, 30); }

function runThemeTransition(nextTheme) { applyTheme(nextTheme); }
function applyTheme(theme) { if (!HAS_DOM) return; const t = theme === 'dark' ? 'dark' : 'light'; document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${t}`); safeSetStorage('quranTheme', t); }
function initThemeToggle() { const btn = qs('theme-toggle'); if (!btn) return; applyTheme(getSafeTheme()); btn.addEventListener('click', () => runThemeTransition(getSafeTheme() === 'dark' ? 'light' : 'dark')); }
function applyZoom() { if (!HAS_DOM) return; document.documentElement.style.setProperty('--font-scale', String(0.7 + (state.currentZoomLevel / 100))); const z = qs('zoom-value'); if (z) z.textContent = String(state.currentZoomLevel); }
function handleZoomPress(type, delta) { state.currentZoomLevel = Math.max(0, Math.min(100, state.currentZoomLevel + delta)); safeSetStorage('quranZoomLevel', state.currentZoomLevel); applyZoom(); const btn = qs(type === 'out' ? 'btn-zoom-out' : 'btn-zoom-in'); if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 150); } }

function showToast(msg) { const toast = qs('toast'); const body = qs('toast-message'); if (!toast || !body) return; body.textContent = String(msg || ''); toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2000); }
function closeModal(id) { if (!['modal-lock', 'modal-juz'].includes(id)) return; const m = qs(id); if (m) m.classList.add('hidden'); }
function showListView() { qs('loader')?.classList.add('hidden'); qs('view-list')?.classList.remove('hidden'); qs('view-detail')?.classList.add('hidden'); }
function showDetailView() { qs('loader')?.classList.add('hidden'); qs('view-detail')?.classList.remove('hidden'); if (window.innerWidth < 1024) qs('view-list')?.classList.add('hidden'); }
function toggleBackButtonCollapse() { qs('back-btn-ui')?.classList.toggle('collapsed'); }

function cleanBismillah(text, surahNumber) { if (surahNumber === 1 || surahNumber === 9) return text; const words = String(text || '').trim().split(/\s+/); if (words.length > 4 && words[0].replace(/[^\u0621-\u064A]/g, '') === 'بسم') return words.slice(4).join(' ').trim(); return String(text || ''); }
function normalizeAyah(a) { const n = parseBoundedInt(a?.numberInSurah, 1, 286); if (!n) return null; return { numberInSurah: n, juz: validJuz(Number(a?.juz)) ? Number(a.juz) : null, text: typeof a?.text === 'string' ? a.text : '' }; }

function renderSurahList(surahs) { const grid = qs('surah-grid'); if (!grid) return; const frag = document.createDocumentFragment(); grid.replaceChildren(); (Array.isArray(surahs) ? surahs : []).forEach((s) => { if (!validSurahNumber(s.number)) return; const b = createTextElement('button', 'surah-card tap-effect', ''); b.type = 'button'; b.addEventListener('click', () => fetchSurahDetail(s.number, s)); const left = createTextElement('div', 'surah-info-left', ''); const numberBox = document.createElement('div'); numberBox.className = 'surah-number'; const numberSpan = document.createElement('span'); numberSpan.textContent = String(s.number); const det = createTextElement('div', 'surah-details', ''); det.append(createTextElement('h3', '', s.indoName || ''), createTextElement('p', '', `${s.indoTranslation || ''} • ${s.numberOfAyahs || 0} Ayat`)); numberBox.appendChild(numberSpan); left.append(numberBox, det); b.append(left, createTextElement('div', 'surah-arabic-name', s.name || '')); frag.appendChild(b); });
  if (!frag.childNodes.length) frag.appendChild(createTextElement('p', 'empty-state', 'Pencarian tidak ditemukan.'));
  grid.appendChild(frag);
}
function renderJuzSurahList(list) { const mapped = (Array.isArray(list)?list:[]).map((item)=>{ const meta=item.meta||item; return { ...meta, juzStartAyah: meta.juzStartAyah || (item.ayahsAr?.[0]?.numberInSurah ?? '-'), juzEndAyah: meta.juzEndAyah || (item.ayahsAr?.[item.ayahsAr.length-1]?.numberInSurah ?? '-') }; }); const grid = qs('surah-grid'); if (!grid) return; grid.replaceChildren(); const frag = document.createDocumentFragment(); mapped.forEach((m)=>{ if (!validSurahNumber(m.number)) return; const b=createTextElement('button','surah-card tap-effect',''); b.type='button'; b.addEventListener('click',()=>{const src=(Array.isArray(list)?list:[]).find((x)=>(x.meta?.number||x.number)===m.number); if(src?.ayahsAr) { renderJuzSpecificSurahDetail(m, src.ayahsAr, src.ayahsId, src.ayahsLat); showDetailView(); } }); const left=createTextElement('div','surah-info-left',''); const nb=document.createElement('div'); nb.className='surah-number'; const sp=document.createElement('span'); sp.textContent=String(m.number); nb.appendChild(sp); const det=createTextElement('div','surah-details',''); det.append(createTextElement('h3','',m.indoName||`Surah ${m.number}`),createTextElement('p','',`${m.indoTranslation||''} • Ayat ${m.juzStartAyah}-${m.juzEndAyah}`)); left.append(nb,det); b.append(left,createTextElement('div','surah-arabic-name',m.name||'')); frag.appendChild(b); }); if(!frag.childNodes.length) frag.appendChild(createTextElement('p','empty-state','Pencarian tidak ditemukan.')); grid.appendChild(frag);} 
function renderSurahDetail(meta, ar, id, lat) {
  const ayahsAr = validateApiAyahArray(ar);
  const ayahsId = validateApiAyahArray((Array.isArray(id) ? id : []).map((x) => ({ ...x, translation: x?.text })));
  const ayahsLat = validateApiAyahArray((Array.isArray(lat) ? lat : []).map((x) => ({ ...x, translation: x?.text })));
  renderJuzSpecificSurahDetail(meta, ayahsAr, ayahsId, ayahsLat);
}
function renderJuzSpecificSurahDetail(meta, ar, id, lat) { const head = qs('surah-header-detail'); const list = qs('ayah-list'); if (!head || !list) return; head.replaceChildren(createTextElement('h2', '', meta?.indoName || ''), createTextElement('p', '', `Surah ke-${meta?.number || ''} • ${meta?.numberOfAyahs || 0} Ayat`)); list.replaceChildren(); const frag = document.createDocumentFragment(); const arArr = Array.isArray(ar) ? ar : []; arArr.forEach((a, idx) => { const va = normalizeAyah(a); if (!va) return; const vi = normalizeAyah(Array.isArray(id) ? id[idx] : null); const vl = normalizeAyah(Array.isArray(lat) ? lat[idx] : null); const item = createTextElement('div', 'ayah-item', ''); item.dataset.ayah = String(va.numberInSurah); if (va.juz) item.dataset.juz = String(va.juz); const ayahTop=createTextElement('div','ayah-top',''); const numberBadge=createTextElement('div','ayah-number-badge',`Ayat ${va.numberInSurah}`); const arabicDiv=createTextElement('div','ayah-arabic',(idx===0||va.numberInSurah===1)?cleanBismillah(va.text,meta?.number):va.text); ayahTop.append(numberBadge,arabicDiv); const translations=createTextElement('div','ayah-translations',''); const latinDiv=createTextElement('div','ayah-latin',vl?.text||''); const indoDiv=createTextElement('div','ayah-indo',vi?.text||''); translations.append(latinDiv,indoDiv); item.append(ayahTop,translations); frag.appendChild(item); }); list.appendChild(frag); }

function applySearchAndFilter() { const key = (qs('search-input')?.value || '').trim().toLowerCase(); const src = state.activeJuzFilter && state.currentJuzData ? state.currentJuzData : state.allSurahs; const out = src.filter((s) => { const m = s.meta || s; return String(m.number) === key || (m.indoName || '').toLowerCase().includes(key) || (m.indoTranslation || '').toLowerCase().includes(key) || key === ''; }); if (state.activeJuzFilter && state.currentJuzData) renderJuzSurahList(out); else renderSurahList(out); }
function clearSearch() { const i = qs('search-input'); if (i) i.value = ''; applySearchAndFilter(); }
async function fetchAllSurahs() { try { let payload = await safeFetchJson(`${API_BASE}/surah`); let list = payload?.data; if (!Array.isArray(list)) list = await safeFetchJson(FALLBACK_SURAH_LIST_URL); state.allSurahs = (Array.isArray(list) ? list : []).map((s) => { const n = Number(s.number); const meta = indoSurahMeta[n] || {}; return { number: n, name: typeof s.name === 'string' ? s.name : '', indoName: meta.name || s.englishName || `Surah ${n}`, indoTranslation: meta.translation || s.englishNameTranslation || '', numberOfAyahs: asPositiveInt(s.numberOfAyahs) || asPositiveInt(s.number_of_ayah) || 0, revelationType: typeof s.revelationType === 'string' ? s.revelationType : '' }; }).filter((s) => validSurahNumber(s.number)); renderSurahList(state.allSurahs); showListView(); } catch { showToast('Gagal memuat daftar surah.'); } }
async function fetchSurahDetail(surahNumber, meta) { if (!validSurahNumber(Number(surahNumber))) return; safeSetStorage('lastReadSurah', surahNumber); safeSetStorage('lastReadAyah', 1); try { const [ar, id, lat] = await Promise.all([safeFetchJson(`${API_BASE}/surah/${surahNumber}/quran-uthmani`), safeFetchJson(`${API_BASE}/surah/${surahNumber}/id.indonesian`), safeFetchJson(`${API_BASE}/surah/${surahNumber}/en.transliteration`)]); state.currentOpenedSurah = surahNumber; renderSurahDetail(meta, ar?.data?.ayahs, id?.data?.ayahs, lat?.data?.ayahs); showDetailView(); updateNavButtonsVisibility(); checkLastRead(); } catch { const fallback = await safeFetchJson(`${FALLBACK_SURAH_DETAIL_BASE}/${surahNumber}.json`); const ayahs = Array.isArray(fallback?.verses) ? fallback.verses.map((v, i) => ({ numberInSurah: i + 1, text: typeof v.text === 'string' ? v.text : '', juz: null })) : []; renderSurahDetail(meta, ayahs, ayahs, ayahs); showDetailView(); checkLastRead(); } }

function setupJuzGrid() { const c = qs('juz-grid-container'); if (!c) return; c.replaceChildren(); for (let i = 1; i <= 30; i += 1) { const b = createTextElement('button', 'juz-btn tap-effect', `Juz ${i}`); b.type = 'button'; b.addEventListener('click', () => selectJuz(i)); c.appendChild(b); } }
function selectJuz(juz) { if (!validJuz(Number(juz))) return; fetchJuzAndShowCards(Number(juz)); }
async function fetchJuzAndShowCards(juzNumber) { if (!validJuz(juzNumber)) return; const res = await safeFetchJson(`${API_BASE}/juz/${juzNumber}/quran-uthmani`); const ayahs = Array.isArray(res?.data?.ayahs) ? res.data.ayahs : []; const map = new Map(); ayahs.forEach((a) => { const s = Number(a?.surah?.number); const n = parseBoundedInt(a?.numberInSurah, 1, 286); if (!validSurahNumber(s) || !n) return; if (!map.has(s)) map.set(s, { meta: { number: s, name: a.surah.name || '', indoName: a.surah.englishName || '', indoTranslation: a.surah.englishNameTranslation || '', numberOfAyahs: asPositiveInt(a.surah.numberOfAyahs) || 0 }, ayahsAr: [], ayahsId: [], ayahsLat: [] }); const rec = map.get(s); rec.ayahsAr.push({ numberInSurah: n, text: typeof a.text === 'string' ? a.text : '', juz: juzNumber }); rec.ayahsId.push({ numberInSurah: n, text: '', juz: juzNumber }); rec.ayahsLat.push({ numberInSurah: n, text: '', juz: juzNumber }); }); state.activeJuzFilter = juzNumber; state.currentJuzData = Array.from(map.values()); renderJuzSurahList(state.currentJuzData); closeModal('modal-juz'); showListView(); }
function resetJuzFilter() { state.activeJuzFilter = null; state.currentJuzData = null; renderSurahList(state.allSurahs); closeModal('modal-juz'); }

function updateNavButtonsVisibility() { const prev = qs('btn-prev-surah'); const next = qs('btn-next-surah'); if (!state.currentOpenedSurah) return; prev?.classList.toggle('hidden', state.currentOpenedSurah <= 1); next?.classList.toggle('hidden', state.currentOpenedSurah >= 114); }
function navigateSurah(dir) { if (!state.currentOpenedSurah) return; const next = state.currentOpenedSurah + dir; if (!validSurahNumber(next)) return; const meta = state.allSurahs.find((s) => s.number === next); if (meta) fetchSurahDetail(next, meta); }

function handleLockToggle() { if (state.isLocked) { unlockAyahs(); return; } qs('modal-lock')?.classList.remove('hidden'); }
function applyLock() { const ayahs = Array.from(document.querySelectorAll('.ayah-item')); if (!ayahs.length) return showToast('Belum ada ayat.'); const start = Number(qs('input-start-ayah')?.value); const end = Number(qs('input-end-ayah')?.value); if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1 || start > end || end > ayahs.length) return showToast('Rentang ayat tidak valid.'); ayahs.forEach((n) => { const x = Number(n.dataset.ayah); n.classList.toggle('hidden', !(x >= start && x <= end)); }); state.isLocked = true; qs('icon-lock')?.classList.remove('hidden'); qs('icon-unlock')?.classList.add('hidden'); closeModal('modal-lock'); }
function unlockAyahs() { document.querySelectorAll('.ayah-item.hidden').forEach((n) => n.classList.remove('hidden')); resetLockState(); }
function resetLockState() { state.isLocked = false; qs('icon-lock')?.classList.add('hidden'); qs('icon-unlock')?.classList.remove('hidden'); }

function setupContinueReadingSwipe() {
  const banner = qs('continue-reading');
  if (!banner) return;

  const SWIPE_LIMIT = 160;
  const CLOSE_THRESHOLD = 0.62;
  let startX = null;
  let currentShift = 0;
  let dragging = false;
  let didMove = false;

  const applyShift = (x) => {
    currentShift = Math.max(-SWIPE_LIMIT, Math.min(0, x));
    const ratio = Math.abs(currentShift) / SWIPE_LIMIT;
    banner.style.transform = `translate3d(${currentShift}px, 0, 0)`;
    banner.style.opacity = String(1 - (ratio * 0.28));
    banner.style.setProperty('--swipe-ratio', ratio.toFixed(3));
  };

  const resetCard = () => {
    banner.classList.remove('cr-swiping');
    banner.classList.add('cr-snap-back');
    applyShift(0);
    window.setTimeout(() => banner.classList.remove('cr-snap-back'), 260);
  };

  const clearCard = () => {
    safeRemoveStorage('lastReadSurah');
    safeRemoveStorage('lastReadAyah');
    safeRemoveStorage('lastReadJuz');
    banner.classList.remove('cr-snap-back');
    banner.classList.add('cr-swipe-out-left');
    window.setTimeout(() => {
      banner.classList.add('hidden');
      banner.classList.remove('cr-swipe-out-left');
      banner.style.transform = '';
      banner.style.opacity = '';
      banner.style.removeProperty('--swipe-ratio');
      currentShift = 0;
      checkLastRead();
    }, 320);
  };

  banner.addEventListener('touchstart', (e) => {
    if (!e.touches?.length) return;
    startX = e.touches[0].clientX;
    didMove = false;
    dragging = true;
    banner.classList.remove('cr-snap-back', 'cr-swipe-out-left');
    banner.classList.add('cr-swiping');
  }, { passive: true });

  banner.addEventListener('touchmove', (e) => {
    if (!dragging || startX == null || !e.touches?.length) return;
    const delta = e.touches[0].clientX - startX;
    if (delta < 0) {
      didMove = true;
      applyShift(delta);
    } else {
      applyShift(0);
    }
  }, { passive: true });

  banner.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    banner.classList.remove('cr-swiping');
    if (Math.abs(currentShift) >= SWIPE_LIMIT * CLOSE_THRESHOLD) clearCard();
    else resetCard();
    startX = null;
  }, { passive: true });

  banner.addEventListener('click', (e) => {
    if (didMove) {
      e.preventDefault();
      e.stopPropagation();
      didMove = false;
    }
  }, true);
}
function setupPressFeedback() {
  const clearPressState = (el) => el?.classList.remove('is-pressed');
  document.addEventListener('pointerdown', (e) => {
    const target = e.target instanceof Element ? e.target.closest('.tap-effect, button, .search-clear-btn, [role="button"]') : null;
    if (!target || target.hasAttribute('disabled')) return;
    target.classList.add('is-pressed');
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
    document.addEventListener(evt, (e) => {
      const target = e.target instanceof Element ? e.target.closest('.tap-effect, button, .search-clear-btn, [role="button"]') : null;
      clearPressState(target);
    }, { passive: true });
  });
}
async function resumeReading() { const lr = getSafeLastRead(); if (!lr.surah) return; const meta = state.allSurahs.find((s) => s.number === lr.surah); if (!meta) return; await fetchSurahDetail(lr.surah, meta); const target = document.querySelector(`.ayah-item[data-ayah="${lr.ayah || 1}"]`); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function checkLastRead() { const lr = getSafeLastRead(); const card = qs('continue-reading'); if (!card) return; if (!lr.surah || !lr.ayah) return card.classList.add('hidden'); const meta = state.allSurahs.find((s) => s.number === lr.surah); if (!meta) return card.classList.add('hidden'); const surahName = meta.indoName || meta.name || ''; qs('cr-surah-name').textContent = surahName ? `Surah ${surahName}` : 'Surah'; qs('cr-ayah-info').textContent = `Ayat ${lr.ayah}${lr.juz ? ` • Juz ${lr.juz}` : ''}`; card.classList.remove('hidden', 'cr-swipe-out-left'); }

function bindEvents() {
  qs('btn-open-juz')?.addEventListener('click', () => qs('modal-juz')?.classList.remove('hidden'));
  qs('btn-close-juz')?.addEventListener('click', () => closeModal('modal-juz'));
  qs('btn-reset-juz')?.addEventListener('click', resetJuzFilter);
  qs('search-input')?.addEventListener('input', applySearchAndFilter);
  qs('search-clear')?.addEventListener('click', clearSearch);
  qs('btn-back-main')?.addEventListener('click', showListView);
  qs('btn-back-toggle')?.addEventListener('click', toggleBackButtonCollapse);
  qs('btn-prev-surah')?.addEventListener('click', () => navigateSurah(-1));
  qs('btn-next-surah')?.addEventListener('click', () => navigateSurah(1));
  qs('lock-btn')?.addEventListener('click', handleLockToggle);
  qs('btn-cancel-lock')?.addEventListener('click', () => closeModal('modal-lock'));
  qs('btn-apply-lock')?.addEventListener('click', applyLock);
  qs('btn-zoom-out')?.addEventListener('click', () => handleZoomPress('out', -10));
  qs('btn-zoom-in')?.addEventListener('click', () => handleZoomPress('in', 10));
  qs('continue-reading')?.addEventListener('click', resumeReading);
}

if (HAS_DOM) {
  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle(); applyZoom(); setupJuzGrid(); setupContinueReadingSwipe(); setupPressFeedback(); bindEvents(); fetchAllSurahs().then(checkLastRead);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanBismillah, escapeHTML, createTextElement, safeFetchJson, sanitizeReadingPreferences, sanitizeLastReadPosition, validateApiAyahArray };
}
