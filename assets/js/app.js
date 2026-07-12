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
  1: { name: 'Al-Fatihah', translation: 'Pembukaan' },
  2: { name: 'Al-Baqarah', translation: 'Sapi Betina' },
  3: { name: "Ali 'Imran", translation: 'Keluarga Imran' },
  4: { name: "An-Nisa'", translation: 'Wanita' },
  5: { name: "Al-Ma'idah", translation: 'Hidangan' },
  6: { name: "Al-An'am", translation: 'Hewan Ternak' },
  7: { name: "Al-A'raf", translation: 'Tempat Tertinggi' },
  8: { name: 'Al-Anfal', translation: 'Rampasan Perang' },
  9: { name: 'At-Taubah', translation: 'Pengampunan' },
  10: { name: 'Yunus', translation: 'Yunus' },
  11: { name: 'Hud', translation: 'Hud' },
  12: { name: 'Yusuf', translation: 'Yusuf' },
  13: { name: "Ar-Ra'd", translation: 'Guruh' },
  14: { name: 'Ibrahim', translation: 'Ibrahim' },
  15: { name: 'Al-Hijr', translation: 'Bukit Hijr' },
  16: { name: 'An-Nahl', translation: 'Lebah' },
  17: { name: "Al-Isra'", translation: 'Perjalanan Malam' },
  18: { name: 'Al-Kahf', translation: 'Gua' },
  19: { name: 'Maryam', translation: 'Maryam' },
  20: { name: 'Taha', translation: 'Taha' },
  21: { name: "Al-Anbiya'", translation: 'Para Nabi' },
  22: { name: 'Al-Hajj', translation: 'Haji' },
  23: { name: "Al-Mu'minun", translation: 'Orang-Orang Mukmin' },
  24: { name: 'An-Nur', translation: 'Cahaya' },
  25: { name: 'Al-Furqan', translation: 'Pembeda' },
  26: { name: "Asy-Syu'ara'", translation: 'Para Penyair' },
  27: { name: 'An-Naml', translation: 'Semut' },
  28: { name: 'Al-Qasas', translation: 'Kisah-Kisah' },
  29: { name: "Al-'Ankabut", translation: 'Laba-Laba' },
  30: { name: 'Ar-Rum', translation: 'Bangsa Romawi' },
  31: { name: 'Luqman', translation: 'Luqman' },
  32: { name: 'As-Sajdah', translation: 'Sajdah' },
  33: { name: 'Al-Ahzab', translation: 'Golongan yang Bersekutu' },
  34: { name: "Saba'", translation: 'Saba' },
  35: { name: 'Fatir', translation: 'Pencipta' },
  36: { name: 'Ya-Sin', translation: 'Ya Sin', aliases: ["Yasin", "Yaa Siin"] },
  37: { name: 'As-Saffat', translation: 'Barisan-Barisan' },
  38: { name: 'Sad', translation: 'Sad' },
  39: { name: 'Az-Zumar', translation: 'Rombongan' },
  40: { name: 'Gafir', translation: 'Maha Pengampun' },
  41: { name: 'Fussilat', translation: 'Dijelaskan' },
  42: { name: 'Asy-Syura', translation: 'Musyawarah' },
  43: { name: 'Az-Zukhruf', translation: 'Perhiasan' },
  44: { name: 'Ad-Dukhan', translation: 'Kabut' },
  45: { name: 'Al-Jasiyah', translation: 'Berlutut' },
  46: { name: 'Al-Ahqaf', translation: 'Bukit-Bukit Pasir' },
  47: { name: 'Muhammad', translation: 'Muhammad' },
  48: { name: 'Al-Fath', translation: 'Kemenangan' },
  49: { name: 'Al-Hujurat', translation: 'Kamar-Kamar' },
  50: { name: 'Qaf', translation: 'Qaf' },
  51: { name: 'Az-Zariyat', translation: 'Angin yang Menerbangkan' },
  52: { name: 'At-Tur', translation: 'Bukit' },
  53: { name: 'An-Najm', translation: 'Bintang' },
  54: { name: 'Al-Qamar', translation: 'Bulan' },
  55: { name: 'Ar-Rahman', translation: 'Maha Pengasih' },
  56: { name: "Al-Waqi'ah", translation: 'Hari Kiamat' },
  57: { name: 'Al-Hadid', translation: 'Besi' },
  58: { name: 'Al-Mujadalah', translation: 'Gugatan' },
  59: { name: 'Al-Hasyr', translation: 'Pengusiran' },
  60: { name: 'Al-Mumtahanah', translation: 'Wanita yang Diuji' },
  61: { name: 'As-Saff', translation: 'Barisan' },
  62: { name: "Al-Jumu'ah", translation: 'Jumat' },
  63: { name: 'Al-Munafiqun', translation: 'Orang-Orang Munafik' },
  64: { name: 'At-Tagabun', translation: 'Pengungkapan Kesalahan' },
  65: { name: 'At-Talaq', translation: 'Talak' },
  66: { name: 'At-Tahrim', translation: 'Pengharaman' },
  67: { name: 'Al-Mulk', translation: 'Kerajaan' },
  68: { name: 'Al-Qalam', translation: 'Pena' },
  69: { name: 'Al-Haqqah', translation: 'Hari Kiamat' },
  70: { name: "Al-Ma'arij", translation: 'Tempat Naik' },
  71: { name: 'Nuh', translation: 'Nuh' },
  72: { name: 'Al-Jinn', translation: 'Jin' },
  73: { name: 'Al-Muzzammil', translation: 'Orang yang Berselimut' },
  74: { name: 'Al-Muddassir', translation: 'Orang yang Berkemul' },
  75: { name: 'Al-Qiyamah', translation: 'Hari Kiamat' },
  76: { name: 'Al-Insan', translation: 'Manusia' },
  77: { name: 'Al-Mursalat', translation: 'Malaikat yang Diutus' },
  78: { name: "An-Naba'", translation: 'Berita Besar' },
  79: { name: "An-Nazi'at", translation: 'Malaikat yang Mencabut' },
  80: { name: "'Abasa", translation: 'Bermuka Masam' },
  81: { name: 'At-Takwir', translation: 'Penggulungan' },
  82: { name: 'Al-Infitar', translation: 'Terbelah' },
  83: { name: 'Al-Mutaffifin', translation: 'Orang-Orang Curang' },
  84: { name: 'Al-Insyiqaq', translation: 'Terbelah' },
  85: { name: 'Al-Buruj', translation: 'Gugusan Bintang' },
  86: { name: 'At-Tariq', translation: 'Yang Datang pada Malam Hari' },
  87: { name: "Al-A'la", translation: 'Maha Tinggi' },
  88: { name: 'Al-Gasyiyah', translation: 'Hari Pembalasan' },
  89: { name: 'Al-Fajr', translation: 'Fajar' },
  90: { name: 'Al-Balad', translation: 'Negeri' },
  91: { name: 'Asy-Syams', translation: 'Matahari' },
  92: { name: 'Al-Lail', translation: 'Malam' },
  93: { name: 'Ad-Duha', translation: 'Waktu Duha' },
  94: { name: 'Asy-Syarh', translation: 'Kelapangan' },
  95: { name: 'At-Tin', translation: 'Buah Tin' },
  96: { name: "Al-'Alaq", translation: 'Segumpal Darah' },
  97: { name: 'Al-Qadr', translation: 'Kemuliaan' },
  98: { name: 'Al-Bayyinah', translation: 'Bukti Nyata' },
  99: { name: 'Az-Zalzalah', translation: 'Guncangan' },
  100: { name: "Al-'Adiyat", translation: 'Kuda Perang yang Berlari Kencang' },
  101: { name: "Al-Qari'ah", translation: 'Hari Kiamat' },
  102: { name: 'At-Takasur', translation: 'Bermegah-Megahan' },
  103: { name: "Al-'Asr", translation: 'Masa' },
  104: { name: 'Al-Humazah', translation: 'Pengumpat' },
  105: { name: 'Al-Fil', translation: 'Gajah' },
  106: { name: 'Quraisy', translation: 'Quraisy' },
  107: { name: "Al-Ma'un", translation: 'Barang yang Berguna' },
  108: { name: 'Al-Kausar', translation: 'Nikmat yang Banyak' },
  109: { name: 'Al-Kafirun', translation: 'Orang-Orang Kafir' },
  110: { name: 'An-Nasr', translation: 'Pertolongan' },
  111: { name: 'Al-Lahab', translation: 'Gejolak Api' },
  112: { name: 'Al-Ikhlas', translation: 'Ikhlas' },
  113: { name: 'Al-Falaq', translation: 'Subuh' },
  114: { name: 'An-Nas', translation: 'Manusia' }
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
function showListView() { saveVisibleAyahAsLastRead(); qs('loader')?.classList.add('hidden'); qs('view-list')?.classList.remove('hidden'); qs('view-detail')?.classList.add('hidden'); document.body.classList.remove('in-surah-detail'); }
function showDetailView() { qs('loader')?.classList.add('hidden'); qs('view-detail')?.classList.remove('hidden'); document.body.classList.add('in-surah-detail'); if (window.innerWidth < 1024) qs('view-list')?.classList.add('hidden'); }
function resetDetailScrollPosition() {
  const ayahList = qs('ayah-list');
  if (ayahList) ayahList.scrollTop = 0;
  if (HAS_WINDOW) window.scrollTo({ top: 0, behavior: 'auto' });
}
function toggleBackButtonCollapse() { qs('back-btn-ui')?.classList.toggle('collapsed'); }


function updateLastReadFromAyah(ayahNumber, juzNumber = null) {
  if (!state.currentOpenedSurah) return;
  const ayah = parseBoundedInt(ayahNumber, 1, SURAH_AYAH_LIMITS[state.currentOpenedSurah] || 286);
  if (!ayah) return;
  safeSetStorage('lastReadSurah', state.currentOpenedSurah);
  safeSetStorage('lastReadAyah', ayah);
  if (validJuz(Number(juzNumber))) safeSetStorage('lastReadJuz', Number(juzNumber));
  else safeRemoveStorage('lastReadJuz');
}

function saveVisibleAyahAsLastRead() {
  const items = Array.from(document.querySelectorAll('.ayah-item'));
  if (!items.length) return;
  const viewportMid = window.innerHeight * 0.35;
  let chosen = null;
  let minDist = Number.POSITIVE_INFINITY;
  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const dist = Math.abs(rect.top - viewportMid);
    if (dist < minDist) {
      minDist = dist;
      chosen = item;
    }
  });
  if (chosen) updateLastReadFromAyah(chosen.dataset.ayah, chosen.dataset.juz);
}

function cleanBismillah(text, surahNumber) { if (surahNumber === 1 || surahNumber === 9) return text; const words = String(text || '').trim().split(/\s+/); if (words.length > 4 && words[0].replace(/[^\u0621-\u064A]/g, '') === 'بسم') return words.slice(4).join(' ').trim(); return String(text || ''); }
function normalizeAyah(a) { const n = parseBoundedInt(a?.numberInSurah, 1, 286); if (!n) return null; return { numberInSurah: n, juz: validJuz(Number(a?.juz)) ? Number(a.juz) : null, text: typeof a?.text === 'string' ? a.text : '' }; }

function debounce(fn, delay = 110) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{N}'\s]+/gu, ' ')
    .replace(/'+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSurahSearchText(surah) {
  const meta = surah?.meta || surah || {};
  const localMeta = indoSurahMeta[Number(meta.number)] || {};
  const values = [
    meta.number, meta.indoName, localMeta.name, ...(localMeta.aliases || []), meta.name,
    meta.indoTranslation, localMeta.translation, meta.englishName, meta.englishNameTranslation,
    meta.revelationType
  ];
  const normalized = values.map(normalizeSearchText).filter(Boolean);
  return `${normalized.join(' ')} ${normalized.map((value) => value.replace(/\s+/g, '')).join(' ')}`;
}

function matchesSurahSearch(surah, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const searchText = getSurahSearchText(surah);
  return searchText.includes(normalizedQuery) || searchText.includes(normalizedQuery.replace(/\s+/g, ''));
}

function renderSurahList(surahs) {
  const grid = qs('surah-grid');
  if (!grid) return;

  const frag = document.createDocumentFragment();
  grid.replaceChildren();

  (Array.isArray(surahs) ? surahs : []).forEach((s) => {
    if (!validSurahNumber(s.number)) return;

    const b = createTextElement('button', 'surah-card tap-effect', '');
    b.type = 'button';
    b.addEventListener('click', () => fetchSurahDetail(s.number, s));

    const left = createTextElement('div', 'surah-info-left', '');

    const numberBox = document.createElement('div');
    numberBox.className = 'surah-number';

    const numberSpan = document.createElement('span');
    numberSpan.textContent = String(s.number);

    const det = createTextElement('div', 'surah-details', '');
    det.append(
      createTextElement('h3', '', s.indoName || ''),
      createTextElement('p', '', `${s.indoTranslation || ''} • ${s.numberOfAyahs || 0} Ayat`)
    );

    numberBox.appendChild(numberSpan);
    left.append(numberBox, det);

    b.append(left, createTextElement('div', 'surah-arabic-name', s.name || ''));
    frag.appendChild(b);
  });

  if (!frag.childNodes.length) {
    frag.appendChild(createTextElement('p', 'empty-state', 'Pencarian tidak ditemukan.'));
  }

  grid.appendChild(frag);
}
function renderJuzSurahList(list) { const mapped = (Array.isArray(list)?list:[]).map((item)=>{ const meta=item.meta||item; return { ...meta, juzStartAyah: meta.juzStartAyah || (item.ayahsAr?.[0]?.numberInSurah ?? '-'), juzEndAyah: meta.juzEndAyah || (item.ayahsAr?.[item.ayahsAr.length-1]?.numberInSurah ?? '-') }; }); const grid = qs('surah-grid'); if (!grid) return; grid.replaceChildren(); const frag = document.createDocumentFragment(); mapped.forEach((m)=>{ if (!validSurahNumber(m.number)) return; const b=createTextElement('button','surah-card tap-effect',''); b.type='button'; b.addEventListener('click',()=>{const src=(Array.isArray(list)?list:[]).find((x)=>(x.meta?.number||x.number)===m.number); if(src?.ayahsAr) { state.currentOpenedSurah = m.number; renderJuzSpecificSurahDetail(m, src.ayahsAr, src.ayahsId, src.ayahsLat); showDetailView(); updateNavButtonsVisibility(); } }); const left=createTextElement('div','surah-info-left',''); const nb=document.createElement('div'); nb.className='surah-number'; const sp=document.createElement('span'); sp.textContent=String(m.number); nb.appendChild(sp); const det=createTextElement('div','surah-details',''); det.append(createTextElement('h3','',m.indoName || indoSurahMeta[m.number]?.name || ''),createTextElement('p','',`${m.indoTranslation||''} • Ayat ${m.juzStartAyah}-${m.juzEndAyah}`)); left.append(nb,det); b.append(left,createTextElement('div','surah-arabic-name',m.name||'')); frag.appendChild(b); }); if(!frag.childNodes.length) frag.appendChild(createTextElement('p','empty-state','Pencarian tidak ditemukan.')); grid.appendChild(frag);}
function renderSurahDetail(meta, ar, id, lat) {
  const ayahsAr = validateApiAyahArray(ar);
  const ayahsId = validateApiAyahArray((Array.isArray(id) ? id : []).map((x) => ({ ...x, translation: x?.text })));
  const ayahsLat = validateApiAyahArray((Array.isArray(lat) ? lat : []).map((x) => ({ ...x, translation: x?.text })));
  renderJuzSpecificSurahDetail(meta, ayahsAr, ayahsId, ayahsLat);
}
function renderJuzSpecificSurahDetail(meta, ar, id, lat) { const head = qs('surah-header-detail'); const list = qs('ayah-list'); if (!head || !list) return; head.replaceChildren(createTextElement('h2', '', meta?.indoName || ''), createTextElement('p', '', `Surah ke-${meta?.number || ''} • ${meta?.numberOfAyahs || 0} Ayat`)); list.replaceChildren(); const frag = document.createDocumentFragment(); const arArr = Array.isArray(ar) ? ar : []; arArr.forEach((a, idx) => { const va = normalizeAyah(a); if (!va) return; const vi = normalizeAyah(Array.isArray(id) ? id[idx] : null); const vl = normalizeAyah(Array.isArray(lat) ? lat[idx] : null); const item = createTextElement('div', 'ayah-item', ''); item.dataset.ayah = String(va.numberInSurah); item.addEventListener('click', () => updateLastReadFromAyah(va.numberInSurah, va.juz)); if (va.juz) item.dataset.juz = String(va.juz); const ayahTop=createTextElement('div','ayah-top',''); const numberBadge=createTextElement('div','ayah-number-badge',`Ayat ${va.numberInSurah}`); const arabicDiv=createTextElement('div','ayah-arabic',(idx===0||va.numberInSurah===1)?cleanBismillah(va.text,meta?.number):va.text); ayahTop.append(numberBadge,arabicDiv); const translations=createTextElement('div','ayah-translations',''); const latinDiv=createTextElement('div','ayah-latin',vl?.text||''); const indoDiv=createTextElement('div','ayah-indo',vi?.text||''); translations.append(latinDiv,indoDiv); item.append(ayahTop,translations); frag.appendChild(item); }); list.appendChild(frag); }

function filterSurahsBySearch(surahs, query) {
  return (Array.isArray(surahs) ? surahs : []).filter((surah) => matchesSurahSearch(surah, query));
}

function updateSearchClearVisibility(query) {
  qs('search-clear')?.classList.toggle('hidden', !String(query ?? '').trim());
}

function applySearchAndFilter() {
  const key = qs('search-input')?.value || '';
  const src = state.activeJuzFilter && Array.isArray(state.currentJuzData) ? state.currentJuzData : state.allSurahs;
  const out = filterSurahsBySearch(src, key);
  updateSearchClearVisibility(key);
  if (state.activeJuzFilter && Array.isArray(state.currentJuzData)) renderJuzSurahList(out);
  else renderSurahList(out);
}
function clearSearch() { const input = qs('search-input'); if (input) input.value = ''; applySearchAndFilter(); }
async function fetchAllSurahs() { try { let payload = await safeFetchJson(`${API_BASE}/surah`); let list = payload?.data; if (!Array.isArray(list)) list = await safeFetchJson(FALLBACK_SURAH_LIST_URL); state.allSurahs = (Array.isArray(list) ? list : []).map((s) => { const n = Number(s.number); const meta = indoSurahMeta[n] || {}; return { number: n, name: typeof s.name === 'string' ? s.name : '', indoName: meta.name || s.englishName || '', indoTranslation: meta.translation || s.englishNameTranslation || '', englishName: typeof s.englishName === 'string' ? s.englishName : '', englishNameTranslation: typeof s.englishNameTranslation === 'string' ? s.englishNameTranslation : '', numberOfAyahs: asPositiveInt(s.numberOfAyahs) || asPositiveInt(s.number_of_ayah) || SURAH_AYAH_LIMITS[n] || 0, revelationType: typeof s.revelationType === 'string' ? s.revelationType : '' }; }).filter((s) => validSurahNumber(s.number)); renderSurahList(state.allSurahs); showListView(); } catch { showToast('Gagal memuat daftar surah.'); } }
async function fetchSurahDetail(surahNumber, meta) { const safeSurahNum = parseBoundedInt(surahNumber, 1, 114); if (!safeSurahNum) return showToast('Nomor surah tidak valid'); const previousSurah = Number(safeGetStorage('lastReadSurah')); safeSetStorage('lastReadSurah', safeSurahNum); if (previousSurah !== safeSurahNum) { safeSetStorage('lastReadAyah', 1); safeRemoveStorage('lastReadJuz'); } state.currentOpenedSurah = safeSurahNum; try { const [ar, id, lat] = await Promise.all([safeFetchJson(`${API_BASE}/surah/${safeSurahNum}/quran-uthmani`), safeFetchJson(`${API_BASE}/surah/${safeSurahNum}/id.indonesian`), safeFetchJson(`${API_BASE}/surah/${safeSurahNum}/en.transliteration`)]); renderSurahDetail(meta, ar?.data?.ayahs, id?.data?.ayahs, lat?.data?.ayahs); showDetailView(); resetDetailScrollPosition(); updateNavButtonsVisibility(); checkLastRead(); } catch { const fallback = await safeFetchJson(`${FALLBACK_SURAH_DETAIL_BASE}/${safeSurahNum}.json`); const ayahs = Array.isArray(fallback?.verses) ? fallback.verses.map((v, i) => ({ numberInSurah: i + 1, text: typeof v.text === 'string' ? v.text : '', juz: null })) : []; renderSurahDetail(meta, ayahs, ayahs, ayahs); showDetailView(); resetDetailScrollPosition(); checkLastRead(); } }

function setupJuzGrid() { const c = qs('juz-grid-container'); if (!c) return; c.replaceChildren(); for (let i = 1; i <= 30; i += 1) { const b = createTextElement('button', 'juz-btn tap-effect', `Juz ${i}`); b.type = 'button'; b.addEventListener('click', () => selectJuz(i)); c.appendChild(b); } }
function selectJuz(juz) { if (!validJuz(Number(juz))) return; fetchJuzAndShowCards(Number(juz)); }
async function fetchJuzAndShowCards(juzNumber) { if (!validJuz(juzNumber)) return; const res = await safeFetchJson(`${API_BASE}/juz/${juzNumber}/quran-uthmani`); const ayahs = Array.isArray(res?.data?.ayahs) ? res.data.ayahs : []; const map = new Map(); ayahs.forEach((a) => { const s = Number(a?.surah?.number); const n = parseBoundedInt(a?.numberInSurah, 1, 286); if (!validSurahNumber(s) || !n) return; if (!map.has(s)) map.set(s, { meta: { number: s, name: a.surah.name || '', indoName: indoSurahMeta[s]?.name || a.surah.englishName || '', indoTranslation: indoSurahMeta[s]?.translation || a.surah.englishNameTranslation || '', englishName: a.surah.englishName || '', englishNameTranslation: a.surah.englishNameTranslation || '', numberOfAyahs: asPositiveInt(a.surah.numberOfAyahs) || SURAH_AYAH_LIMITS[s] || 0 }, ayahsAr: [], ayahsId: [], ayahsLat: [] }); const rec = map.get(s); rec.ayahsAr.push({ numberInSurah: n, text: typeof a.text === 'string' ? a.text : '', juz: juzNumber }); rec.ayahsId.push({ numberInSurah: n, text: '', juz: juzNumber }); rec.ayahsLat.push({ numberInSurah: n, text: '', juz: juzNumber }); }); state.activeJuzFilter = juzNumber; state.currentJuzData = Array.from(map.values()); renderJuzSurahList(state.currentJuzData); closeModal('modal-juz'); showListView(); }
function resetJuzFilter() { state.activeJuzFilter = null; state.currentJuzData = null; renderSurahList(state.allSurahs); closeModal('modal-juz'); }

function updateNavButtonsVisibility() { const prev = qs('btn-prev-surah'); const next = qs('btn-next-surah'); if (!state.currentOpenedSurah) return; prev?.classList.toggle('hidden', state.currentOpenedSurah <= 1); next?.classList.toggle('hidden', state.currentOpenedSurah >= 114); }
function navigateSurah(dir) { if (!state.currentOpenedSurah) return; const next = state.currentOpenedSurah + dir; if (!validSurahNumber(next)) return; const meta = state.allSurahs.find((s) => s.number === next); if (meta) fetchSurahDetail(next, meta); }

function handleLockToggle() { if (state.isLocked) { unlockAyahs(); return; } qs('modal-lock')?.classList.remove('hidden'); }
function applyLock() { const ayahs = Array.from(document.querySelectorAll('.ayah-item')); if (!ayahs.length) return showToast('Belum ada ayat.'); const start = Number(qs('input-start-ayah')?.value); const end = Number(qs('input-end-ayah')?.value); if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1 || start > end || end > ayahs.length) return showToast('Rentang ayat tidak valid.'); ayahs.forEach((n) => { const x = Number(n.dataset.ayah); n.classList.toggle('hidden', !(x >= start && x <= end)); }); state.isLocked = true; qs('icon-lock')?.classList.remove('hidden'); qs('icon-unlock')?.classList.add('hidden'); closeModal('modal-lock'); }
function unlockAyahs() { document.querySelectorAll('.ayah-item.hidden').forEach((n) => n.classList.remove('hidden')); resetLockState(); }
function resetLockState() { state.isLocked = false; qs('icon-lock')?.classList.add('hidden'); qs('icon-unlock')?.classList.remove('hidden'); }

function setupContinueReadingSwipe(onResume = resumeReading) {
  const banner = qs('continue-reading');
  if (!banner) return;

  const SWIPE_LIMIT = 160;
  const CLOSE_THRESHOLD = 0.62;
  const MOVE_THRESHOLD = 6;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let pendingShift = 0;
  let currentShift = 0;
  let gesture = null;
  let didSwipe = false;
  let frameId = null;

  const resetInlineStyles = () => {
    banner.style.transform = '';
    banner.style.opacity = '';
    banner.style.removeProperty('--swipe-ratio');
    banner.classList.remove('is-pressed');
    pendingShift = 0;
    currentShift = 0;
  };

  const renderShift = () => {
    frameId = null;
    currentShift = Math.max(-SWIPE_LIMIT, Math.min(0, pendingShift));
    const ratio = Math.abs(currentShift) / SWIPE_LIMIT;
    banner.style.transform = `translate3d(${currentShift}px, 0, 0)`;
    banner.style.opacity = String(1 - (ratio * 0.28));
    banner.style.setProperty('--swipe-ratio', ratio.toFixed(3));
  };

  const scheduleShift = (shift) => {
    pendingShift = shift;
    if (frameId == null) frameId = window.requestAnimationFrame(renderShift);
  };

  const flushShift = () => {
    if (frameId != null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
      renderShift();
    }
  };

  const snapBack = () => {
    banner.classList.remove('cr-swiping', 'cr-swipe-out-left');
    banner.classList.add('cr-snap-back');
    pendingShift = 0;
    renderShift();
    window.setTimeout(() => {
      banner.classList.remove('cr-snap-back');
      resetInlineStyles();
    }, 260);
  };

  const dismiss = () => {
    safeRemoveStorage('lastReadSurah');
    safeRemoveStorage('lastReadAyah');
    safeRemoveStorage('lastReadJuz');
    banner.classList.remove('cr-swiping', 'cr-snap-back');
    resetInlineStyles();
    banner.classList.add('cr-swipe-out-left');
    window.setTimeout(() => {
      banner.classList.add('hidden');
      banner.classList.remove('cr-swipe-out-left');
      resetInlineStyles();
    }, 320);
  };

  banner.addEventListener('pointerdown', (event) => {
    if (pointerId != null || event.button !== undefined && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    gesture = null;
    didSwipe = false;
    banner.classList.remove('cr-snap-back', 'cr-swipe-out-left');
  });

  banner.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (!gesture && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= MOVE_THRESHOLD) {
      gesture = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      if (gesture === 'horizontal') {
        banner.classList.add('cr-swiping');
        banner.setPointerCapture?.(pointerId);
      }
    }
    if (gesture !== 'horizontal') return;
    didSwipe = didSwipe || Math.abs(deltaX) >= MOVE_THRESHOLD;
    scheduleShift(Math.min(0, deltaX));
  });

  const finishGesture = (event, cancelled = false) => {
    if (event.pointerId !== pointerId) return;
    if (banner.hasPointerCapture?.(pointerId)) banner.releasePointerCapture(pointerId);
    pointerId = null;
    flushShift();
    banner.classList.remove('cr-swiping');
    if (!cancelled && gesture === 'horizontal' && Math.abs(currentShift) >= SWIPE_LIMIT * CLOSE_THRESHOLD) dismiss();
    else if (gesture === 'horizontal') snapBack();
    gesture = null;
  };

  banner.addEventListener('pointerup', finishGesture);
  banner.addEventListener('pointercancel', (event) => finishGesture(event, true));
  banner.addEventListener('click', (event) => {
    if (didSwipe) {
      event.preventDefault();
      event.stopPropagation();
      didSwipe = false;
      return;
    }
    onResume();
  });
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
  qs('search-input')?.addEventListener('input', debounce(applySearchAndFilter, 110));
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
  if (HAS_WINDOW) window.addEventListener('scroll', saveVisibleAyahAsLastRead, { passive: true });
  qs('ayah-list')?.addEventListener('scroll', saveVisibleAyahAsLastRead, { passive: true });
}


if (HAS_DOM) {
  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle(); applyZoom(); setupJuzGrid(); setupContinueReadingSwipe(); setupPressFeedback(); bindEvents(); fetchAllSurahs().then(checkLastRead);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanBismillah, escapeHTML, createTextElement, safeFetchJson, sanitizeReadingPreferences, sanitizeLastReadPosition, validateApiAyahArray, indoSurahMeta, normalizeSearchText, getSurahSearchText, matchesSurahSearch, filterSurahsBySearch, updateSearchClearVisibility, clearSearch, setupContinueReadingSwipe };
}
