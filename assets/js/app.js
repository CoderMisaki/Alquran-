        function escapeHTML(str) {
            if (str === null || str === undefined) return '';
            const s = String(str);
            return s.replace(/[&<>"']/g, function(m) {
                switch (m) {
                    case '&': return '&amp;';
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '"': return '&quot;';
                    case "'": return '&#39;';
                    default: return m;
                }
            });
        }

        function debounce(func, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        }

        let currentZoomLevel = parseInt(localStorage.getItem('quranZoomLevel'));
        if (isNaN(currentZoomLevel)) currentZoomLevel = 30; 

        function applyZoom() {
            const scale = 0.7 + (currentZoomLevel / 100);
            document.documentElement.style.setProperty('--font-scale', scale);
            const zoomValueEl = document.getElementById('zoom-value');
            if (zoomValueEl) zoomValueEl.textContent = currentZoomLevel;
        }

        function adjustZoom(change) {
            currentZoomLevel += change;
            if (currentZoomLevel < 0) currentZoomLevel = 0;
            if (currentZoomLevel > 100) currentZoomLevel = 100;
            applyZoom();
            localStorage.setItem('quranZoomLevel', currentZoomLevel);
        }

        let zoomTimerOut, zoomTimerIn;
        function handleZoomPress(type, change) {
            adjustZoom(change);
            const btnOut = document.getElementById('btn-zoom-out');
            const btnIn = document.getElementById('btn-zoom-in');
            
            clearTimeout(zoomTimerOut); clearTimeout(zoomTimerIn);
            if (type === 'out') {
                btnOut.classList.add('pressed'); btnIn.classList.remove('pressed');
                zoomTimerOut = setTimeout(() => btnOut.classList.remove('pressed'), 200);
            } else {
                btnIn.classList.add('pressed'); btnOut.classList.remove('pressed');
                zoomTimerIn = setTimeout(() => btnIn.classList.remove('pressed'), 200);
            }
        }
        applyZoom();

        let allSurahs = [];
        let currentJuzData = null;
        let currentOpenedSurah = null; 
        let isLocked = false;
        let activeJuzFilter = null;
        let ayahObserver = null;
        let detailRequestToken = 0;

        const API_BASE = 'https://api.alquran.cloud/v1';
        const FALLBACK_SURAH_LIST_URL = 'https://raw.githubusercontent.com/rioastamal/quran-json/master/surah.json';
        const FALLBACK_SURAH_DETAIL_BASE = 'https://raw.githubusercontent.com/rioastamal/quran-json/master/surah';
        const ALLOWED_THEMES = new Set(['light', 'dark']);
        const ALLOWED_MODAL_IDS = new Set(['modal-lock', 'modal-juz']);

        const elLoader = document.getElementById('loader');
        const elViewList = document.getElementById('view-list');
        const elViewDetail = document.getElementById('view-detail');
        const elSurahGrid = document.getElementById('surah-grid');
        const elSearchInput = document.getElementById('search-input');
        const elSearchClear = document.getElementById('search-clear');
        const elHeaderRight = document.getElementById('header-right');
        const elSurahHeaderDetail = document.getElementById('surah-header-detail');
        const elAyahList = document.getElementById('ayah-list');
        
        const modalLock = document.getElementById('modal-lock');
        const inputStartAyah = document.getElementById('input-start-ayah');
        const inputEndAyah = document.getElementById('input-end-ayah');
        const lockBtn = document.getElementById('lock-btn');
        const iconUnlock = document.getElementById('icon-unlock');
        const iconLock = document.getElementById('icon-lock');
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        const themeToggleBtn = document.getElementById('theme-toggle');
        let isThemeAnimating = false;

        const indoSurahMeta = {
            1: { name: "Al-Fatihah", translation: "Pembukaan" }, 2: { name: "Al-Baqarah", translation: "Sapi Betina" }, 3: { name: "Ali 'Imran", translation: "Keluarga 'Imran" }, 4: { name: "An-Nisa'", translation: "Wanita" }, 5: { name: "Al-Ma'idah", translation: "Jamuan (Hidangan)" },
            6: { name: "Al-An'am", translation: "Binatang Ternak" }, 7: { name: "Al-A'raf", translation: "Tempat yang Tertinggi" }, 8: { name: "Al-Anfal", translation: "Rampasan Perang" }, 9: { name: "At-Taubah", translation: "Pengampunan" }, 10: { name: "Yunus", translation: "Nabi Yunus" },
            11: { name: "Hud", translation: "Nabi Hud" }, 12: { name: "Yusuf", translation: "Nabi Yusuf" }, 13: { name: "Ar-Ra'd", translation: "Guruh (Petir)" }, 14: { name: "Ibrahim", translation: "Nabi Ibrahim" }, 15: { name: "Al-Hijr", translation: "Gunung Al-Hijr" },
            16: { name: "An-Nahl", translation: "Lebah" }, 17: { name: "Al-Isra'", translation: "Perjalanan Malam" }, 18: { name: "Al-Kahf", translation: "Penghuni Gua" }, 19: { name: "Maryam", translation: "Maryam" }, 20: { name: "Taha", translation: "Taha" },
            21: { name: "Al-Anbiya'", translation: "Nabi-Nabi" }, 22: { name: "Al-Hajj", translation: "Haji" }, 23: { name: "Al-Mu'minun", translation: "Orang-Orang Mukmin" }, 24: { name: "An-Nur", translation: "Cahaya" }, 25: { name: "Al-Furqan", translation: "Pembeda" },
            26: { name: "Asy-Syu'ara'", translation: "Penyair" }, 27: { name: "An-Naml", translation: "Semut" }, 28: { name: "Al-Qasas", translation: "Kisah-Kisah" }, 29: { name: "Al-'Ankabut", translation: "Laba-Laba" }, 30: { name: "Ar-Rum", translation: "Bangsa Romawi" },
            31: { name: "Luqman", translation: "Keluarga Luqman" }, 32: { name: "As-Sajdah", translation: "Sajdah" }, 33: { name: "Al-Ahzab", translation: "Golongan yang Bersekutu" }, 34: { name: "Saba'", translation: "Kaum Saba'" }, 35: { name: "Fathir", translation: "Pencipta" },
            36: { name: "Yasin", translation: "Yasin" }, 37: { name: "As-Saffat", translation: "Barisan-Barisan" }, 38: { name: "Shad", translation: "Shad" }, 39: { name: "Az-Zumar", translation: "Rombongan-Rombongan" }, 40: { name: "Ghafir", translation: "Maha Pengampun" },
            41: { name: "Fussilat", translation: "Yang Dijelaskan" }, 42: { name: "Asy-Syura", translation: "Musyawarah" }, 43: { name: "Az-Zukhruf", translation: "Perhiasan" }, 44: { name: "Ad-Dukhan", translation: "Kabut" }, 45: { name: "Al-Jatsiyah", translation: "Yang Berlutut" },
            46: { name: "Al-Ahqaf", translation: "Bukit-Bukit Pasir" }, 47: { name: "Muhammad", translation: "Nabi Muhammad" }, 48: { name: "Al-Fath", translation: "Kemenangan" }, 49: { name: "Al-Hujurat", translation: "Kamar-Kamar" }, 50: { name: "Qaf", translation: "Qaf" },
            51: { name: "Az-Zariyat", translation: "Angin yang Menerbangkan" }, 52: { name: "At-Thur", translation: "Bukit" }, 53: { name: "An-Najm", translation: "Bintang" }, 54: { name: "Al-Qamar", translation: "Bulan" }, 55: { name: "Ar-Rahman", translation: "Maha Pemurah" },
            56: { name: "Al-Waqi'ah", translation: "Hari Kiamat" }, 57: { name: "Al-Hadid", translation: "Besi" }, 58: { name: "Al-Mujadilah", translation: "Gugatan" }, 59: { name: "Al-Hasyr", translation: "Pengusiran" }, 60: { name: "Al-Mumtahanah", translation: "Wanita yang Diuji" },
            61: { name: "As-Saff", translation: "Barisan" }, 62: { name: "Al-Jumu'ah", translation: "Hari Jumat" }, 63: { name: "Al-Munafiqun", translation: "Orang Munafik" }, 64: { name: "At-Taghabun", translation: "Hari Dinampakkan Kesalahan" }, 65: { name: "At-Thalaq", translation: "Talak" },
            66: { name: "At-Tahrim", translation: "Mengharamkan" }, 67: { name: "Al-Mulk", translation: "Kerajaan" }, 68: { name: "Al-Qalam", translation: "Pena" }, 69: { name: "Al-Haqqah", translation: "Hari Kiamat" }, 70: { name: "Al-Ma'arij", translation: "Tempat Naik" },
            71: { name: "Nuh", translation: "Nabi Nuh" }, 72: { name: "Al-Jinn", translation: "Jin" }, 73: { name: "Al-Muzzammil", translation: "Orang yang Berselimut" }, 74: { name: "Al-Muddassir", translation: "Orang yang Berkemul" }, 75: { name: "Al-Qiyamah", translation: "Hari Kiamat" },
            76: { name: "Al-Insan", translation: "Manusia" }, 77: { name: "Al-Mursalat", translation: "Malaikat yang Diutus" }, 78: { name: "An-Naba'", translation: "Berita Besar" }, 79: { name: "An-Nazi'at", translation: "Malaikat yang Mencabut" }, 80: { name: "'Abasa", translation: "Bermuka Masam" },
            81: { name: "At-Takwir", translation: "Menggulung" }, 82: { name: "Al-Infitar", translation: "Terbelah" }, 83: { name: "Al-Mutaffifin", translation: "Orang yang Curang" }, 84: { name: "Al-Insyiqaq", translation: "Terbelah" }, 85: { name: "Al-Buruj", translation: "Gugusan Bintang" },
            86: { name: "At-Tariq", translation: "Yang Datang di Malam Hari" }, 87: { name: "Al-A'la", translation: "Yang Paling Tinggi" }, 88: { name: "Al-Ghasyiyah", translation: "Hari Pembalasan" }, 89: { name: "Al-Fajr", translation: "Fajar" }, 90: { name: "Al-Balad", translation: "Negeri" },
            91: { name: "Asy-Syams", translation: "Matahari" }, 92: { name: "Al-Lail", translation: "Malam" }, 93: { name: "Adh-Dhuha", translation: "Waktu Duha" }, 94: { name: "Al-Insyirah", translation: "Melapangkan" }, 95: { name: "At-Tin", translation: "Buah Tin" },
            96: { name: "Al-'Alaq", translation: "Segumpal Darah" }, 97: { name: "Al-Qadr", translation: "Kemuliaan" }, 98: { name: "Al-Bayyinah", translation: "Pembuktian" }, 99: { name: "Az-Zalzalah", translation: "Kegoncangan" }, 100: { name: "Al-'Adiyat", translation: "Kuda yang Berlari Kencang" },
            101: { name: "Al-Qari'ah", translation: "Hari Kiamat" }, 102: { name: "At-Takatsur", translation: "Bermegah-Megahan" }, 103: { name: "Al-'Asr", translation: "Masa/Waktu" }, 104: { name: "Al-Humazah", translation: "Pengumpat" }, 105: { name: "Al-Fil", translation: "Gajah" },
            106: { name: "Quraisy", translation: "Suku Quraisy" }, 107: { name: "Al-Ma'un", translation: "Barang Berguna" }, 108: { name: "Al-Kausar", translation: "Nikmat yang Banyak" }, 109: { name: "Al-Kafirun", translation: "Orang-Orang Kafir" }, 110: { name: "An-Nasr", translation: "Pertolongan" },
            111: { name: "Al-Lahab", translation: "Gejolak Api" }, 112: { name: "Al-Ikhlas", translation: "Ikhlas" }, 113: { name: "Al-Falaq", translation: "Waktu Subuh" }, 114: { name: "An-Nas", translation: "Manusia" }
        };

        document.addEventListener('DOMContentLoaded', () => {
            initThemeToggle();
            fetchAllSurahs();
            setupJuzGrid();
            setupContinueReadingSwipe();
            initAyahObserver();
        });

        function getSafeTheme(value) {
            return ALLOWED_THEMES.has(value) ? value : null;
        }

        function getStoredTheme() {
            try {
                return getSafeTheme(localStorage.getItem('quranTheme'));
            } catch {
                return null;
            }
        }

        function saveTheme(theme) {
            if (!ALLOWED_THEMES.has(theme)) return;
            try {
                localStorage.setItem('quranTheme', theme);
            } catch {}
        }

        function applyTheme(theme) {
            const safeTheme = getSafeTheme(theme) || 'light';
            const isDarkTheme = safeTheme === 'dark';
            document.body.classList.toggle('theme-dark', isDarkTheme);
            document.body.classList.toggle('theme-light', !isDarkTheme);
            document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light';
            syncDesktopLightDetailLayout();
            if (themeToggleBtn) {
                themeToggleBtn.setAttribute('aria-pressed', isDarkTheme ? 'true' : 'false');
            }
        }

        function isDesktopLayout() {
            return window.matchMedia('(min-width: 1024px)').matches;
        }

        function syncDesktopLightDetailLayout() {
            const isDesktop = window.innerWidth >= 1024;
            const hasDetail = elViewDetail && !elViewDetail.classList.contains('hidden');
            document.body.classList.toggle('desktop-quran-detail', isDesktop && hasDetail);
        }

        function getThemeTransitionDuration() {
            const rawValue = getComputedStyle(document.documentElement)
                .getPropertyValue('--theme-duration')
                .trim();

            if (rawValue.endsWith('ms')) return Number.parseFloat(rawValue);
            if (rawValue.endsWith('s')) return Number.parseFloat(rawValue) * 1000;
            return 780;
        }

        async function runThemeTransition(nextTheme) {
            if (isThemeAnimating) return;
            isThemeAnimating = true;
            document.body.classList.add('theme-transitioning');
            
            if (themeToggleBtn) {
                themeToggleBtn.disabled = true;
                themeToggleBtn.style.pointerEvents = 'none';
                themeToggleBtn.setAttribute('aria-busy', 'true');
            }

            const commitTheme = () => {
                applyTheme(nextTheme);
                saveTheme(nextTheme);
            };

            try {
                if ('startViewTransition' in document) {
                    const transition = document.startViewTransition(commitTheme);
                    await Promise.race([
                        transition.finished,
                        new Promise(resolve => setTimeout(resolve, 800))
                    ]);
                } else {
                    commitTheme();
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
            } finally {
                document.body.classList.remove('theme-transitioning');
                if (themeToggleBtn) {
                    themeToggleBtn.disabled = false;
                    themeToggleBtn.style.pointerEvents = 'auto';
                    themeToggleBtn.removeAttribute('aria-busy');
                }
                isThemeAnimating = false;
            }
        }

        function initThemeToggle() {
            const savedTheme = getStoredTheme();
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
            applyTheme(initialTheme);

            requestAnimationFrame(() => {
                document.documentElement.classList.add('theme-ready');
                document.body.classList.add('theme-ready');
            });

            if (!themeToggleBtn) return;
            themeToggleBtn.addEventListener('click', () => {
                if (isThemeAnimating) return;
                const isDark = document.body.classList.contains('theme-dark');
                const nextTheme = isDark ? 'light' : 'dark';
                runThemeTransition(nextTheme);
            });
        }

        const smartNormalize = (str) => {
            let s = str.toLowerCase().replace(/[^a-z0-9]/g, ''); 
            s = s.replace(/q/g, 'k').replace(/th/g, 't').replace(/sh/g, 's').replace(/sy/g, 's')
                 .replace(/kh/g, 'h').replace(/dz/g, 'z').replace(/o/g, 'a').replace(/e/g, 'i');
            s = s.replace(/(.)\1+/g, '$1'); 
            return s;
        };

        function applySearchAndFilter(animateSlide = false) {
            const keyword = elSearchInput.value.trim();
            const isSearching = keyword.length > 0;

            if (isSearching) elSearchClear.classList.remove('hidden');
            else elSearchClear.classList.add('hidden');

            let sourceData = (activeJuzFilter && currentJuzData) ? currentJuzData : allSurahs;
            let filtered = sourceData;

            if (isSearching) {
                const rawKey = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
                const normKey = smartNormalize(keyword);

                filtered = sourceData.filter(s => {
                    const metaObj = (activeJuzFilter && currentJuzData) ? s.meta : s;
                    if (!isNaN(keyword) && metaObj.number === parseInt(keyword)) return true;
                    if (metaObj.name && metaObj.name.includes(keyword)) return true;

                    const rawName = metaObj.indoName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const rawTrans = metaObj.indoTranslation.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normName = smartNormalize(metaObj.indoName);
                    const normTrans = smartNormalize(metaObj.indoTranslation);
                    
                    return rawName.includes(rawKey) || rawTrans.includes(rawKey) || 
                           normName.includes(normKey) || normTrans.includes(normKey);
                });
            }

            if (activeJuzFilter && currentJuzData) renderJuzSurahList(filtered, animateSlide, isSearching);
            else renderSurahList(filtered, animateSlide, isSearching);
        }

        elSearchInput.addEventListener('input', debounce(() => applySearchAndFilter(false), 250));

        function clearSearch() {
            elSearchInput.value = '';
            elSearchClear.classList.add('hidden');
            applySearchAndFilter(false);
            elSearchInput.focus();
        }

        function showLoader() {
            document.body.classList.add('is-loading');
            elLoader.classList.remove('hidden');
            elViewList.classList.add('hidden');
            elViewDetail.classList.add('hidden');
            syncDesktopLightDetailLayout();
        }

        function hideLoader() {
            document.body.classList.remove('is-loading');
            elLoader.classList.add('hidden');
            syncDesktopLightDetailLayout();
        }

        function showListView(clearSearchQuery = true) {
            hideLoader();
            resetLockState();
            currentOpenedSurah = null;
            document.getElementById('reading-progress-container').style.opacity = '0';

            const btnUI = document.getElementById('back-btn-ui');
            if (btnUI) btnUI.classList.remove('collapsed');

            if (clearSearchQuery) {
                elSearchInput.value = '';
                elSearchClear.classList.add('hidden');
            }

            elViewList.classList.remove('hidden');
            elViewDetail.classList.add('hidden');
            document.body.classList.remove('desktop-quran-detail');
            syncDesktopLightDetailLayout();
            if (elHeaderRight) elHeaderRight.style.display = 'flex';

            checkLastRead();
            applySearchAndFilter(!clearSearchQuery);
            window.scrollTo({ top: 0, behavior: 'auto' });
        }

        function showDetailView() {
            hideLoader();
            if (isDesktopLayout()) {
                elViewList.classList.remove('hidden');
                if (elHeaderRight) elHeaderRight.style.display = 'flex';
            } else {
                elViewList.classList.add('hidden');
                if (elHeaderRight) elHeaderRight.style.display = 'none';
            }
            elViewDetail.classList.remove('hidden');
            syncDesktopLightDetailLayout();

            updateNavButtonsVisibility();
            window.scrollTo({ top: 0, behavior: 'auto' });
            applyZoom();

            if (ayahObserver) ayahObserver.disconnect();
            const ayahs = document.querySelectorAll('.ayah-item');

            ayahs.forEach(el => ayahObserver.observe(el));
        }

        function toggleBackButton() {
            const btn = document.getElementById('back-btn-ui');
            if(btn) btn.classList.toggle('collapsed');
        }

        function updateNavButtonsVisibility() {
            const btnPrev = document.getElementById('btn-prev-surah');
            const btnNext = document.getElementById('btn-next-surah');

            if (currentOpenedSurah) {
                btnPrev.style.display = 'flex';
                btnNext.style.display = 'flex';
                
                btnPrev.style.opacity = currentOpenedSurah > 1 ? '1' : '0.3';
                btnPrev.style.pointerEvents = currentOpenedSurah > 1 ? 'auto' : 'none';

                btnNext.style.opacity = currentOpenedSurah < 114 ? '1' : '0.3';
                btnNext.style.pointerEvents = currentOpenedSurah < 114 ? 'auto' : 'none';
            } else {
                btnPrev.style.display = 'none';
                btnNext.style.display = 'none';
            }
        }

        function navigateSurah(direction) {
            if (!currentOpenedSurah) return;
            if (activeJuzFilter) {
                activeJuzFilter = null;
                document.getElementById('btn-open-juz').classList.remove('active');
            }
            const target = currentOpenedSurah + direction;
            if (target >= 1 && target <= 114) {
                const meta = allSurahs.find(s => s.number === target) || {
                    number: target, indoName: indoSurahMeta[target].name,
                    indoTranslation: indoSurahMeta[target].translation, numberOfAyahs: 0, revelationType: 'Meccan'
                };
                fetchSurahDetail(target, meta);
            }
        }

        function initAyahObserver() {
            ayahObserver = new IntersectionObserver((entries) => {
                if(!currentOpenedSurah) return;
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const ayahNum = entry.target.getAttribute('data-ayah');
                        localStorage.setItem('lastReadSurah', currentOpenedSurah);
                        localStorage.setItem('lastReadAyah', ayahNum);
                        const ayahJuz = entry.target.getAttribute('data-juz');
                        if (ayahJuz) localStorage.setItem('lastReadJuz', ayahJuz);
                    }
                });
            }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
        }

        function checkLastRead() {
            const lastSurah = localStorage.getItem('lastReadSurah');
            const lastAyah = localStorage.getItem('lastReadAyah');
            const lastJuz = localStorage.getItem('lastReadJuz');
            const crBanner = document.getElementById('continue-reading');
            
            if (lastSurah && allSurahs.length > 0) {
                const meta = allSurahs.find(s => s.number == parseInt(lastSurah));
                if(meta) {
                    document.getElementById('cr-surah-name').textContent = meta.indoName;
                    document.getElementById('cr-ayah-info').textContent = `Ayat ke-${lastAyah || 1}${lastJuz ? ` • Juz ${lastJuz}` : ''}`;
                    crBanner.classList.remove('hidden', 'cr-collapsing');
                    crBanner.style.transform = '';
                    crBanner.style.opacity = '1';
                    return;
                }
            }
            crBanner.classList.add('hidden');
        }

        function setupContinueReadingSwipe() {
            const crCard = document.getElementById('continue-reading');
            let startX = 0;
            let currentX = 0;
            let isDragging = false;
            let pointerId = null;

            const isDesktopCardMode = () => document.body.classList.contains('desktop-quran-detail');
            const resetCardVisual = () => {
                crCard.style.transform = '';
                crCard.style.opacity = '1';
            };

            const onStart = (clientX, activePointerId = null) => {
                startX = clientX;
                currentX = clientX;
                isDragging = false;
                pointerId = activePointerId;
                crCard.style.transition = 'none';
            };

            const onMove = (clientX) => {
                currentX = clientX;
                const diff = currentX - startX;
                if (Math.abs(diff) > 10) isDragging = true;
                if (!isDragging) return;

                if (isDesktopCardMode() && diff > 0) {
                    crCard.style.transform = `translateX(${Math.min(diff, 120)}px)`;
                    return;
                }

                if (diff < 0) {
                    crCard.style.transform = `translateX(${diff}px)`;
                    crCard.style.opacity = Math.max(0.2, 1 + (diff / 150));
                }
            };

            const onEnd = () => {
                if (!isDragging) {
                    resumeReading();
                    return;
                }

                const diff = currentX - startX;
                crCard.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';

                if (isDesktopCardMode() && diff > 55) {
                    crCard.classList.add('desktop-collapsed');
                    resetCardVisual();
                    return;
                }

                if (isDesktopCardMode() && diff < -35) {
                    crCard.classList.remove('desktop-collapsed');
                }

                if (diff < -80 && !isDesktopCardMode()) {
                    crCard.style.transform = 'translateX(-100%)';
                    crCard.style.opacity = '0';
                    setTimeout(() => {
                        crCard.classList.add('cr-collapsing');
                        setTimeout(() => {
                            crCard.classList.add('hidden');
                            localStorage.removeItem('lastReadSurah');
                            localStorage.removeItem('lastReadAyah');
                        }, 400);
                    }, 100);
                    return;
                }

                resetCardVisual();
            };

            crCard.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
            crCard.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
            crCard.addEventListener('touchend', onEnd);

            crCard.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                onStart(e.clientX, e.pointerId);
                crCard.setPointerCapture?.(e.pointerId);
            });
            crCard.addEventListener('pointermove', (e) => {
                if (pointerId !== e.pointerId) return;
                onMove(e.clientX);
            });
            crCard.addEventListener('pointerup', (e) => {
                if (pointerId !== e.pointerId) return;
                pointerId = null;
                onEnd();
            });

            crCard.addEventListener('click', () => {
                if (!isDragging) resumeReading();
            });
        }

        function resumeReading() {
            const lastSurah = localStorage.getItem('lastReadSurah');
            const lastAyah = localStorage.getItem('lastReadAyah');
            if(lastSurah && allSurahs.length > 0) {
                const meta = allSurahs.find(s => s.number == lastSurah);
                if(meta) fetchSurahDetail(parseInt(lastSurah), meta, parseInt(lastAyah));
            }
        }

        let progressTimeout;
        let isScrolling = false;
        window.addEventListener(
            'resize',
            debounce(syncDesktopLightDetailLayout, 150),
            { passive: true }
        );

        window.addEventListener('scroll', () => {
            if (!isScrolling && !elViewDetail.classList.contains('hidden')) {
                window.requestAnimationFrame(() => {
                    const barContainer = document.getElementById('reading-progress-container');
                    barContainer.style.opacity = '1';

                    const winScroll = window.scrollY || window.pageYOffset;
                    const height = document.documentElement.scrollHeight - window.innerHeight;
                    const scrolled = height > 0 ? (winScroll / height) * 100 : 100;
                    document.getElementById('reading-progress-bar').style.width = scrolled + "%";

                    clearTimeout(progressTimeout);
                    progressTimeout = setTimeout(() => {
                        barContainer.style.opacity = '0';
                    }, 2000);

                    isScrolling = false;
                });
                isScrolling = true;
            }
        }, {passive: true});

        async function safeFetchJson(url) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Gagal mengambil data, HTTP Status: ${response.status}`);
            }
            return await response.json();
        }

        function mapFallbackSurahList(data) {
            return data.map((surah) => ({
                number: Number(surah.number),
                name: surah.name || '',
                englishName: surah.name_latin || '',
                englishNameTranslation: '',
                numberOfAyahs: Number(surah.number_of_ayah) || 0,
                revelationType: (surah.place || '').toLowerCase() === 'madinah' ? 'Medinan' : 'Meccan'
            }));
        }

        function mapFallbackAyahs(arabicAyahs, propertyName) {
            return arabicAyahs.map((ayah) => ({
                numberInSurah: Number(ayah.number),
                text: ayah[propertyName] || ''
            }));
        }

        async function fetchAllSurahs() {
            try {
                showLoader();
                let surahResponse;
                try {
                    const data = await safeFetchJson(`${API_BASE}/surah`);
                    if (data.code === 200 && Array.isArray(data.data)) {
                        surahResponse = data.data;
                    }
                } catch {}

                if (!surahResponse) {
                    const fallbackData = await safeFetchJson(FALLBACK_SURAH_LIST_URL);
                    surahResponse = mapFallbackSurahList(fallbackData);
                }

                if (Array.isArray(surahResponse)) {
                    allSurahs = surahResponse.map(surah => ({
                        ...surah,
                        indoName: indoSurahMeta[surah.number].name,
                        indoTranslation: indoSurahMeta[surah.number].translation
                    }));

                    showListView(true);

                    if (isDesktopLayout()) {
                        let targetSurah = 1;
                        let targetAyah = 1;

                        const lastSurah = localStorage.getItem('lastReadSurah');
                        const lastAyah = localStorage.getItem('lastReadAyah');
                        if (lastSurah) {
                            targetSurah = parseInt(lastSurah, 10);
                            targetAyah = parseInt(lastAyah, 10) || 1;
                        }

                        const meta = allSurahs.find(s => s.number === targetSurah);
                        if (meta) {
                            setTimeout(() => {
                                fetchSurahDetail(targetSurah, meta, targetAyah);
                            }, 300);
                        }
                    }

                } else throw new Error('Gagal mengambil API.');
            } catch (error) {
                console.error('Detail Error API:', error);
                showToast(`Koneksi terganggu: ${error.message}`, true);
            }
        }


        function renderSurahList(surahs, animateSlide = false) {
            elSurahGrid.innerHTML = '';

            if (!Array.isArray(surahs) || surahs.length === 0) {
                elSurahGrid.innerHTML = `
                    <p style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 2rem;">
                        Pencarian tidak ditemukan.
                    </p>
                `;
                return;
            }

            const fragment = document.createDocumentFragment();
            surahs.forEach((surah, index) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = `surah-card ${animateSlide ? 'animate-slide' : ''}`;

                if (animateSlide) {
                    card.style.animationDelay = `${index * 0.02}s`;
                }

                card.onclick = () => fetchSurahDetail(surah.number, surah);

                card.innerHTML = `
                    <div class="surah-info-left">
                        <div class="surah-number"><span>${escapeHTML(surah.number)}</span></div>
                        <div class="surah-details">
                            <h3>${escapeHTML(surah.indoName)}</h3>
                            <p>${escapeHTML(surah.indoTranslation)} • ${escapeHTML(surah.numberOfAyahs)} Ayat</p>
                        </div>
                    </div>
                    <div class="surah-arabic-name">${escapeHTML(surah.name)}</div>
                `;

                fragment.appendChild(card);
            });
            elSurahGrid.appendChild(fragment);
        }

        function renderJuzSurahList(juzSurahs, animateSlide = false) {
            elSurahGrid.innerHTML = '';

            if (!Array.isArray(juzSurahs) || juzSurahs.length === 0) {
                elSurahGrid.innerHTML = `
                    <p style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 2rem;">
                        Pencarian tidak ditemukan.
                    </p>
                `;
                return;
            }

            const fragment = document.createDocumentFragment();
            juzSurahs.forEach((item, index) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = `surah-card ${animateSlide ? 'animate-slide' : ''}`;

                if (animateSlide) {
                    card.style.animationDelay = `${index * 0.02}s`;
                }

                card.onclick = () => {
                    currentOpenedSurah = null;
                    renderJuzSpecificSurahDetail(item.meta, item.ayahsAr, item.ayahsId, item.ayahsLat);
                    showDetailView();
                };

                card.innerHTML = `
                    <div class="surah-info-left">
                        <div class="surah-number"><span>${escapeHTML(item.meta.number)}</span></div>
                        <div class="surah-details">
                            <h3>${escapeHTML(item.meta.indoName)}</h3>
                            <p>${escapeHTML(item.meta.indoTranslation)} • Ayat ${escapeHTML(item.meta.juzStartAyah)}-${escapeHTML(item.meta.juzEndAyah)}</p>
                        </div>
                    </div>
                    <div class="surah-arabic-name">${escapeHTML(item.meta.name)}</div>
                `;

                fragment.appendChild(card);
            });
            elSurahGrid.appendChild(fragment);
        }

        async function fetchSurahDetail(surahNumber, surahMeta, scrollToAyah = null) {
            const requestToken = ++detailRequestToken;

            try {
                showLoader();
                resetLockState();
                
                localStorage.setItem('lastReadSurah', surahNumber);
                if(scrollToAyah) localStorage.setItem('lastReadAyah', scrollToAyah);
                else localStorage.setItem('lastReadAyah', 1);

                let dataAr, dataId, dataLat;
                try {
                    dataAr = await safeFetchJson(`${API_BASE}/surah/${surahNumber}/quran-uthmani`);
                    dataId = await safeFetchJson(`${API_BASE}/surah/${surahNumber}/id.indonesian`);
                    dataLat = await safeFetchJson(`${API_BASE}/surah/${surahNumber}/en.transliteration`);
                } catch {}

                if (!(dataAr?.code === 200 && dataId?.code === 200 && dataLat?.code === 200)) {
                    const fallbackDetail = await safeFetchJson(`${FALLBACK_SURAH_DETAIL_BASE}/${surahNumber}.json`);
                    const fallbackAyahs = Array.isArray(fallbackDetail) ? fallbackDetail : (fallbackDetail.verses || []);
                    dataAr = { code: 200, data: { ayahs: mapFallbackAyahs(fallbackAyahs, 'text') } };
                    dataId = { code: 200, data: { ayahs: mapFallbackAyahs(fallbackAyahs, 'translation_id') } };
                    dataLat = { code: 200, data: { ayahs: mapFallbackAyahs(fallbackAyahs, 'transliteration') } };
                }

                if (requestToken !== detailRequestToken) return;

                if (dataAr.code === 200 && dataId.code === 200 && dataLat.code === 200) {
                    currentOpenedSurah = surahNumber;
                    renderSurahDetail(surahMeta, dataAr.data.ayahs, dataId.data.ayahs, dataLat.data.ayahs);
                    showDetailView();

                    if(scrollToAyah) {
                        setTimeout(() => {
                            const targetEl = document.querySelector(`.ayah-item[data-ayah="${scrollToAyah}"]`);
                            if(targetEl) {
                                targetEl.scrollIntoView({behavior: 'smooth', block: 'center'});
                                targetEl.classList.add('flash-highlight');
                                setTimeout(() => targetEl.classList.remove('flash-highlight'), 1200);
                            }
                        }, 300);
                    }

                } else throw new Error("Gagal memuat ayat.");

            } catch (error) {
                if (requestToken !== detailRequestToken) return;
                showToast("Gagal memuat. Periksa koneksi internet.", true);
                showListView();
            }
        }

        function cleanBismillah(arabicText, surahNumber) {
    
    if (surahNumber === 1 || surahNumber === 9) return arabicText;
    
    const words = arabicText.split(/\s+/);
    
    if (words.length > 4) {
        
        const firstWordClean = words[0].replace(/[^\u0621-\u064A]/g, '');
        
        
        if (firstWordClean === 'بسم') {
            
            return words.slice(4).join(' ').trim();
        }
    }
    
    return arabicText;
}


        function generateAyahsHTML(ayahsAr, ayahsId, ayahsLat, metaNumber) {
            let allAyahsHTML = '';
            ayahsAr.forEach((ayah, index) => {
                let arabicText = ayah.text;
                if (ayah.numberInSurah === 1) arabicText = cleanBismillah(arabicText, metaNumber);

                const latinText = ayahsLat[index].text;
                const indoText = ayahsId[index].text;

                allAyahsHTML += `
                    <div class="ayah-item" data-ayah="${escapeHTML(ayah.numberInSurah)}" data-juz="${escapeHTML(ayah.juz || "")}">
                        <div class="ayah-top">
                            <div class="ayah-number-badge">${escapeHTML(ayah.numberInSurah)}</div>
                            <div class="ayah-arabic">${escapeHTML(arabicText)}</div>
                        </div>
                        <div class="ayah-translations">
                            <div class="ayah-latin">${escapeHTML(latinText)}</div>
                            <div class="ayah-indo">${escapeHTML(indoText)}</div>
                        </div>
                    </div>
                `;
            });
            return allAyahsHTML;
        }

        function renderSurahDetail(meta, ayahsAr, ayahsId, ayahsLat) {
            const isFatihahOrTawbah = meta.number === 1 || meta.number === 9;
            const bismillahHtml = !isFatihahOrTawbah ? `<div class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>` : '';
            const revType = meta.revelationType && meta.revelationType.toLowerCase() === 'meccan' ? 'Makkiyah' : 'Madaniyah';

            elSurahHeaderDetail.innerHTML = `
                <h2>${escapeHTML(meta.indoName)}</h2>
                <p>Surah ke-${escapeHTML(meta.number)} dari 114 • ${escapeHTML(revType)} • ${escapeHTML(meta.numberOfAyahs)} Ayat</p>
                ${bismillahHtml}
            `;

            let allAyahsHTML = generateAyahsHTML(ayahsAr, ayahsId, ayahsLat, meta.number);
            elAyahList.innerHTML = allAyahsHTML;
        }

        function renderJuzSpecificSurahDetail(meta, ayahsAr, ayahsId, ayahsLat) {
            const isFatihahOrTawbah = meta.number === 1 || meta.number === 9;
            
            let bismillahHtml = '';
            if (meta.juzStartAyah === 1 && !isFatihahOrTawbah) {
                bismillahHtml = `<div class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>`;
            }

            elSurahHeaderDetail.innerHTML = `
                <h2>${escapeHTML(meta.indoName)}</h2>
                <p>Juz ${escapeHTML(activeJuzFilter)} • Ayat ${escapeHTML(meta.juzStartAyah)} - ${escapeHTML(meta.juzEndAyah)}</p>
                ${bismillahHtml}
            `;

            let allAyahsHTML = generateAyahsHTML(ayahsAr, ayahsId, ayahsLat, meta.number);
            elAyahList.innerHTML = allAyahsHTML;
        }

        function setupJuzGrid() {
            const container = document.getElementById('juz-grid-container');
            container.innerHTML = '';
            for(let i = 1; i <= 30; i++) {
                const btn = document.createElement('button');
                btn.className = 'juz-btn tap-effect';
                btn.textContent = `Juz ${i}`;
                btn.onclick = () => selectJuz(i);
                container.appendChild(btn);
            }
        }

        function openJuzModal() {
            document.getElementById('modal-juz').classList.remove('hidden');
            updateJuzButtons();
        }

        function selectJuz(juz) {
            activeJuzFilter = juz;
            document.getElementById('btn-open-juz').classList.add('active');
            updateJuzButtons();
            closeModal('modal-juz');
            fetchJuzAndShowCards(juz);
        }

        function resetJuzFilter() {
            activeJuzFilter = null;
            currentJuzData = null;
            document.getElementById('btn-open-juz').classList.remove('active');
            updateJuzButtons();
            showListView(true); 
            closeModal('modal-juz');
            showToast(`Menampilkan Semua Surah`);
        }

        function updateJuzButtons() {
            const btns = document.querySelectorAll('.juz-btn');
            btns.forEach((btn, index) => {
                if (index + 1 === activeJuzFilter) btn.classList.add('selected');
                else btn.classList.remove('selected');
            });
        }

        function handleLockToggle() {
            if (isLocked) unlockAyahs();
            else {
                inputStartAyah.value = ''; inputEndAyah.value = '';
                document.getElementById('modal-lock').classList.remove('hidden');
            }
        }

        function clampInteger(value, min, max) {
            const number = Number.parseInt(value, 10);
            if (!Number.isInteger(number)) return null;
            return Math.min(Math.max(number, min), max);
        }

        function applyLock() {
            const allRenderedAyahs = Array.from(document.querySelectorAll('.ayah-item'));
            const maxAyah = allRenderedAyahs.reduce((max, el) => {
                const ayahNum = Number.parseInt(el.getAttribute('data-ayah'), 10);
                return Number.isInteger(ayahNum) ? Math.max(max, ayahNum) : max;
            }, 1);
            const start = clampInteger(inputStartAyah.value, 1, maxAyah);
            const end = clampInteger(inputEndAyah.value, 1, maxAyah);
            if (start === null || end === null || start > end) {
                showToast('Rentang ayat tidak valid.', true);
                return;
            }
            let hasMatch = false;

            allRenderedAyahs.forEach(el => {
                const ayahNum = Number.parseInt(el.getAttribute('data-ayah'), 10);
                const shouldShow = Number.isInteger(ayahNum) && ayahNum >= start && ayahNum <= end;
                el.hidden = !shouldShow;
                el.style.display = shouldShow ? 'flex' : 'none';
                if (shouldShow) hasMatch = true;
            });

            if (!hasMatch) {
                showToast(`Ayat ${start} - ${end} tidak ada di halaman ini.`, true);
                unlockAyahs();
                return;
            }

            isLocked = true;
            lockBtn.classList.add('locked');
            iconUnlock.classList.add('hidden');
            iconLock.classList.remove('hidden');

            closeModal('modal-lock');
            showToast(`Menampilkan Ayat ${start} - ${end}`);
        }

        function unlockAyahs() {
            const allRenderedAyahs = document.querySelectorAll('.ayah-item');
            allRenderedAyahs.forEach(el => el.style.display = 'flex');
            resetLockState();
            showToast("Semua ayat ditampilkan.");
        }

        function resetLockState() {
            isLocked = false;
            lockBtn.classList.remove('locked');
            iconUnlock.classList.remove('hidden');
            iconLock.classList.add('hidden');
        }

        function closeModal(id) {
            if (!ALLOWED_MODAL_IDS.has(id)) return;
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('hidden');
        }

        let toastTimeout;
        function showToast(message, isError = false) {
            clearTimeout(toastTimeout);
            toastMessage.textContent = message;
            if (isError) toast.classList.add('error');
            else toast.classList.remove('error');
            toast.classList.remove('hidden');
            toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
        }

    
