# Security Deployment Notes

- Project ini ditujukan untuk deploy di **Vercel**.
- Security headers dikonfigurasi melalui `vercel.json`.
- Jangan commit file/folder sensitif: `.env`, `.vercel`, `node_modules`, `.Jules`, `.jules`.
- Tidak boleh menggunakan inline event handler pada HTML.
- CSP tidak boleh memakai `unsafe-inline`.
- Seluruh data API wajib dirender dengan `createElement`/`textContent`.
- Semua request eksternal wajib melalui `safeFetchJson`.
- Semua data dari API dan `localStorage` harus divalidasi sebelum dipakai/render.

## Hardening LocalStorage dan Validasi API

- Gunakan `sanitizeReadingPreferences()` sebelum membaca state UI, agar nilai `quranZoomLevel`, `lastReadSurah`, `lastReadAyah`, dan `lastReadJuz` selalu berada di rentang aman.
- Gunakan `validateApiAyahArray()` untuk memvalidasi array ayat dari API pihak ketiga sebelum render ke DOM.
- Jika payload rusak atau aneh (tipe salah, teks terlalu panjang, indeks ayat tidak valid), data otomatis dibersihkan/dibuang.

## Menghapus `.env` dan `.vercel/` dari seluruh riwayat Git

> Setelah data sensitif pernah bocor, **wajib** rotasi seluruh secret terlebih dahulu (API key/token/password).

### Opsi A — `git filter-repo` (disarankan)

1. Backup mirror repo:
   - `git clone --mirror <repo-url> repo-cleanup.git`
   - `cd repo-cleanup.git`
2. Hapus path sensitif dari seluruh history:
   - `git filter-repo --path .env --path .vercel --invert-paths`
3. Pastikan object sensitif hilang:
   - `git log --all -- .env .vercel`
   - `git rev-list --objects --all | rg "(^|/)\.env$|(^|/)\.vercel/"`
4. Force push history baru:
   - `git push --force --all`
   - `git push --force --tags`
5. Bersihkan cache lokal developer lain:
   - `git fetch --all --prune`
   - `git reset --hard origin/<branch-utama>`
   - `git gc --prune=now --aggressive`

### Opsi B — BFG Repo-Cleaner

1. Mirror clone repo:
   - `git clone --mirror <repo-url> repo-bfg.git && cd repo-bfg.git`
2. Jalankan BFG:
   - `bfg --delete-files .env`
   - `bfg --delete-folders .vercel --no-blob-protection`
3. Bersihkan reflog/object lalu push:
   - `git reflog expire --expire=now --all`
   - `git gc --prune=now --aggressive`
   - `git push --force --all && git push --force --tags`

## Mengamankan Supply Chain sebelum Build Vercel

Tambahkan script audit di `package.json`:

```json
{
  "scripts": {
    "security:audit": "npm audit --audit-level=critical",
    "security:deps": "npm audit --production --audit-level=high",
    "vercel-build": "npm run security:audit && npm run security:deps && npm run build"
  }
}
```

Di Vercel, set **Build Command** ke:

- `npm run vercel-build`

Dengan cara ini deployment otomatis gagal jika ditemukan vulnerability level yang diblokir.

Tambahan gratis yang bisa dipakai:
- Aktifkan Dependabot alerts + security updates di GitHub.
- Jalankan `npx osv-scanner --lockfile=package-lock.json` pada pipeline CI sebelum deploy untuk verifikasi ekstra dependency rentan.
