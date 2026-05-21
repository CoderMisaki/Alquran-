# Security Deployment Notes

- Project ini ditujukan untuk deploy di **Vercel**.
- Security headers dikonfigurasi melalui `vercel.json`.
- Jangan commit file/folder sensitif: `.env`, `.vercel`, `node_modules`, `.Jules`, `.jules`.
- Tidak boleh menggunakan inline event handler pada HTML.
- CSP tidak boleh memakai `unsafe-inline`.
- Seluruh data API wajib dirender dengan `createElement`/`textContent`.
- Semua request eksternal wajib melalui `safeFetchJson`.
- Semua data dari API dan `localStorage` harus divalidasi sebelum dipakai/render.
