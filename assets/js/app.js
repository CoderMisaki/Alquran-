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
const isIntRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const asPositiveInt = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };

function safeGetStorage(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSetStorage(key, value) { try { localStorage.setItem(key, String(value)); } catch {} }
function safeRemoveStorage(key) { try { localStorage.removeItem(key); } catch {} }

function getSafeTheme() { const v = safeGetStorage('quranTheme'); return v === 'dark' || v === 'light' ? v : 'light'; }
function getSafeZoom() { const n = Number(safeGetStorage('quranZoomLevel')); return isIntRange(n, 0, 100) ? n : 30; }
function getSafeLastRead() {
  const s = Number(safeGetStorage('lastReadSurah')); const a = Number(safeGetStorage('lastReadAyah')); const j = Number(safeGetStorage('lastReadJuz'));
  return { surah: isIntRange(s, 1, 114) ? s : null, ayah: asPositiveInt(a), juz: isIntRange(j, 1, 30) ? j : null };
}

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

const indoSurahMeta = {};
for (let i = 1; i <= 114; i += 1) indoSurahMeta[i] = { indoName: `Surah ${i}`, indoTranslation: '' };

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

function cleanBismillah(text, surahNumber) { if (surahNumber === 1 || surahNumber === 9) return text; const words = String(text || '').trim().split(/\s+/); if (words.length > 4 && words[0].replace(/[^\u0621-\u064A]/g, '') === 'بسم') return words.slice(4).join(' ').trim(); return String(text || ''); }
function normalizeAyah(a) { const n = asPositiveInt(a?.numberInSurah); if (!n) return null; return { numberInSurah: n, juz: validJuz(Number(a?.juz)) ? Number(a.juz) : null, text: typeof a?.text === 'string' ? a.text : '' }; }

function renderSurahList(surahs) { const grid = qs('surah-grid'); if (!grid) return; const frag = document.createDocumentFragment(); grid.replaceChildren(); (Array.isArray(surahs) ? surahs : []).forEach((s) => { if (!validSurahNumber(s.number)) return; const b = createTextElement('button', 'surah-card', ''); b.type = 'button'; b.addEventListener('click', () => fetchSurahDetail(s.number, s)); const left = createTextElement('div', 'surah-info-left', ''); const num = createTextElement('div', 'surah-number', String(s.number)); const det = createTextElement('div', 'surah-details', ''); det.append(createTextElement('h3', '', s.indoName || ''), createTextElement('p', '', `${s.indoTranslation || ''} • ${s.numberOfAyahs || 0} Ayat`)); left.append(num, det); b.append(left, createTextElement('div', 'surah-arabic-name', s.name || '')); frag.appendChild(b); });
  if (!frag.childNodes.length) frag.appendChild(createTextElement('p', 'empty-state', 'Pencarian tidak ditemukan.'));
  grid.appendChild(frag);
}
function renderJuzSurahList(list) { renderSurahList((Array.isArray(list) ? list : []).map((x) => x.meta || x)); }
function renderSurahDetail(meta, ar, id, lat) { renderJuzSpecificSurahDetail(meta, ar, id, lat); }
function renderJuzSpecificSurahDetail(meta, ar, id, lat) { const head = qs('surah-header-detail'); const list = qs('ayah-list'); if (!head || !list) return; head.replaceChildren(createTextElement('h2', '', meta?.indoName || ''), createTextElement('p', '', `Surah ke-${meta?.number || ''} • ${meta?.numberOfAyahs || 0} Ayat`)); list.replaceChildren(); const frag = document.createDocumentFragment(); const arArr = Array.isArray(ar) ? ar : []; arArr.forEach((a, idx) => { const va = normalizeAyah(a); if (!va) return; const vi = normalizeAyah(Array.isArray(id) ? id[idx] : null); const vl = normalizeAyah(Array.isArray(lat) ? lat[idx] : null); const item = createTextElement('div', 'ayah-item', ''); item.dataset.ayah = String(va.numberInSurah); if (va.juz) item.dataset.juz = String(va.juz); item.append(createTextElement('div', 'ayah-arabic', (idx === 0 || va.numberInSurah === 1) ? cleanBismillah(va.text, meta?.number) : va.text), createTextElement('div', 'ayah-latin', vl?.text || ''), createTextElement('div', 'ayah-indo', vi?.text || '')); frag.appendChild(item); }); list.appendChild(frag); }

function applySearchAndFilter() { const key = (qs('search-input')?.value || '').trim().toLowerCase(); const src = state.activeJuzFilter && state.currentJuzData ? state.currentJuzData : state.allSurahs; const out = src.filter((s) => { const m = s.meta || s; return String(m.number) === key || (m.indoName || '').toLowerCase().includes(key) || (m.indoTranslation || '').toLowerCase().includes(key) || key === ''; }); if (state.activeJuzFilter && state.currentJuzData) renderJuzSurahList(out); else renderSurahList(out); }
function clearSearch() { const i = qs('search-input'); if (i) i.value = ''; applySearchAndFilter(); }
async function fetchAllSurahs() { try { let payload = await safeFetchJson(`${API_BASE}/surah`); let list = payload?.data; if (!Array.isArray(list)) list = await safeFetchJson(FALLBACK_SURAH_LIST_URL); state.allSurahs = (Array.isArray(list) ? list : []).map((s) => { const n = Number(s.number); const meta = indoSurahMeta[n] || { indoName: '', indoTranslation: '' }; return { number: n, name: typeof s.name === 'string' ? s.name : '', indoName: typeof s.englishName === 'string' ? s.englishName : meta.indoName, indoTranslation: typeof s.englishNameTranslation === 'string' ? s.englishNameTranslation : meta.indoTranslation, numberOfAyahs: asPositiveInt(s.numberOfAyahs) || asPositiveInt(s.number_of_ayah) || 0, revelationType: typeof s.revelationType === 'string' ? s.revelationType : '' }; }).filter((s) => validSurahNumber(s.number)); renderSurahList(state.allSurahs); showListView(); } catch { showToast('Gagal memuat daftar surah.'); } }
async function fetchSurahDetail(surahNumber, meta) { if (!validSurahNumber(Number(surahNumber))) return; safeSetStorage('lastReadSurah', surahNumber); safeSetStorage('lastReadAyah', 1); try { const [ar, id, lat] = await Promise.all([safeFetchJson(`${API_BASE}/surah/${surahNumber}/quran-uthmani`), safeFetchJson(`${API_BASE}/surah/${surahNumber}/id.indonesian`), safeFetchJson(`${API_BASE}/surah/${surahNumber}/en.transliteration`)]); state.currentOpenedSurah = surahNumber; renderSurahDetail(meta, ar?.data?.ayahs, id?.data?.ayahs, lat?.data?.ayahs); showDetailView(); updateNavButtonsVisibility(); } catch { const fallback = await safeFetchJson(`${FALLBACK_SURAH_DETAIL_BASE}/${surahNumber}.json`); const ayahs = Array.isArray(fallback?.verses) ? fallback.verses.map((v, i) => ({ numberInSurah: i + 1, text: typeof v.text === 'string' ? v.text : '', juz: null })) : []; renderSurahDetail(meta, ayahs, ayahs, ayahs); showDetailView(); } }

function setupJuzGrid() { const c = qs('juz-grid-container'); if (!c) return; c.replaceChildren(); for (let i = 1; i <= 30; i += 1) { const b = createTextElement('button', 'modal-btn btn-apply', `Juz ${i}`); b.type = 'button'; b.addEventListener('click', () => selectJuz(i)); c.appendChild(b); } }
function selectJuz(juz) { if (!validJuz(Number(juz))) return; fetchJuzAndShowCards(Number(juz)); }
async function fetchJuzAndShowCards(juzNumber) { if (!validJuz(juzNumber)) return; const res = await safeFetchJson(`${API_BASE}/juz/${juzNumber}/quran-uthmani`); const ayahs = Array.isArray(res?.data?.ayahs) ? res.data.ayahs : []; const map = new Map(); ayahs.forEach((a) => { const s = Number(a?.surah?.number); const n = asPositiveInt(a?.numberInSurah); if (!validSurahNumber(s) || !n) return; if (!map.has(s)) map.set(s, { meta: { number: s, name: a.surah.name || '', indoName: a.surah.englishName || '', indoTranslation: a.surah.englishNameTranslation || '', numberOfAyahs: asPositiveInt(a.surah.numberOfAyahs) || 0 }, ayahsAr: [], ayahsId: [], ayahsLat: [] }); const rec = map.get(s); rec.ayahsAr.push({ numberInSurah: n, text: typeof a.text === 'string' ? a.text : '', juz: juzNumber }); rec.ayahsId.push({ numberInSurah: n, text: '', juz: juzNumber }); rec.ayahsLat.push({ numberInSurah: n, text: '', juz: juzNumber }); }); state.activeJuzFilter = juzNumber; state.currentJuzData = Array.from(map.values()); renderJuzSurahList(state.currentJuzData); closeModal('modal-juz'); showListView(); }
function resetJuzFilter() { state.activeJuzFilter = null; state.currentJuzData = null; renderSurahList(state.allSurahs); closeModal('modal-juz'); }

function updateNavButtonsVisibility() { const prev = qs('btn-prev-surah'); const next = qs('btn-next-surah'); if (!state.currentOpenedSurah) return; prev?.classList.toggle('hidden', state.currentOpenedSurah <= 1); next?.classList.toggle('hidden', state.currentOpenedSurah >= 114); }
function navigateSurah(dir) { if (!state.currentOpenedSurah) return; const next = state.currentOpenedSurah + dir; if (!validSurahNumber(next)) return; const meta = state.allSurahs.find((s) => s.number === next); if (meta) fetchSurahDetail(next, meta); }

function handleLockToggle() { if (state.isLocked) { unlockAyahs(); return; } qs('modal-lock')?.classList.remove('hidden'); }
function applyLock() { const ayahs = Array.from(document.querySelectorAll('.ayah-item')); if (!ayahs.length) return showToast('Belum ada ayat.'); const start = Number(qs('input-start-ayah')?.value); const end = Number(qs('input-end-ayah')?.value); if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1 || start > end || end > ayahs.length) return showToast('Rentang ayat tidak valid.'); ayahs.forEach((n) => { const x = Number(n.dataset.ayah); n.classList.toggle('hidden', !(x >= start && x <= end)); }); state.isLocked = true; qs('icon-lock')?.classList.remove('hidden'); qs('icon-unlock')?.classList.add('hidden'); closeModal('modal-lock'); }
function unlockAyahs() { document.querySelectorAll('.ayah-item.hidden').forEach((n) => n.classList.remove('hidden')); resetLockState(); }
function resetLockState() { state.isLocked = false; qs('icon-lock')?.classList.add('hidden'); qs('icon-unlock')?.classList.remove('hidden'); }

function setupContinueReadingSwipe() { const banner = qs('continue-reading'); if (!banner) return; let x0 = null; banner.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true }); banner.addEventListener('touchend', (e) => { if (x0 == null) return; const d = e.changedTouches[0].clientX - x0; x0 = null; if (d < -60) { safeRemoveStorage('lastReadSurah'); safeRemoveStorage('lastReadAyah'); safeRemoveStorage('lastReadJuz'); banner.classList.add('hidden'); } }, { passive: true }); }
async function resumeReading() { const lr = getSafeLastRead(); if (!lr.surah) return; const meta = state.allSurahs.find((s) => s.number === lr.surah); if (!meta) return; await fetchSurahDetail(lr.surah, meta); const target = document.querySelector(`.ayah-item[data-ayah="${lr.ayah || 1}"]`); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function checkLastRead() { const lr = getSafeLastRead(); const card = qs('continue-reading'); if (!card) return; if (!lr.surah || !lr.ayah) return card.classList.add('hidden'); const meta = state.allSurahs.find((s) => s.number === lr.surah); if (!meta) return card.classList.add('hidden'); qs('cr-surah-name').textContent = meta.indoName || `Surah ${lr.surah}`; qs('cr-ayah-info').textContent = `Ayat ${lr.ayah}${lr.juz ? ` • Juz ${lr.juz}` : ''}`; card.classList.remove('hidden'); }

function bindEvents() {
  qs('btn-open-juz')?.addEventListener('click', () => qs('modal-juz')?.classList.remove('hidden'));
  qs('btn-close-juz')?.addEventListener('click', () => closeModal('modal-juz'));
  qs('btn-reset-juz')?.addEventListener('click', resetJuzFilter);
  qs('search-input')?.addEventListener('input', applySearchAndFilter);
  qs('search-clear')?.addEventListener('click', clearSearch);
  qs('btn-back-main')?.addEventListener('click', showListView);
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
    initThemeToggle(); applyZoom(); setupJuzGrid(); setupContinueReadingSwipe(); bindEvents(); fetchAllSurahs().then(checkLastRead);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanBismillah, escapeHTML, createTextElement, safeFetchJson };
}
