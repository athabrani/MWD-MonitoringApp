# Central Local Server Deployment Analysis

## 1. Tujuan deployment

MWD Monitoring App diarahkan menjadi sistem production-ready untuk satu server lokal pusat. Industrial PC atau laptop utama menjalankan PostgreSQL, backend API, frontend web service, receiver/gateway MWD-WITS, logs, dan backups. Laptop lain tidak menjalankan database, backend, frontend, source code, VSCode, atau command; laptop lain hanya membuka browser atau shortcut app-mode ke IP/hostname server.

Target operasional:

- Data real-time, active session, historical data, dashboard, Rig WITS, well plot, export, dan multiuser berada pada satu database pusat.
- Receiver/WITS hanya berjalan pada server utama supaya sumber data tidak bercabang.
- Maintenance, backup, dan troubleshooting difokuskan pada satu mesin.
- Arsitektur web tetap dipertahankan.

## 2. Ringkasan arsitektur saat ini

Audit repository:

- Root repository berisi `mwd-app-be`, `mwd-app-fe`, `scripts`, `docs`, `tests`, dan root `package.json`.
- Branch deployment/package saat ini: `package`.
- Backend berada di `mwd-app-be`, Express + Prisma + PostgreSQL, build ke `mwd-app-be/dist`.
- Frontend berada di `mwd-app-fe`, Next.js, build ke `mwd-app-fe/.next`.
- Backend Prisma Client generation and TypeScript build have been validated on branch `package`.
- Frontend production build has been validated.
- Production security env is valid: gateway key is present with sufficient length and `AUTH_EXPOSE_TOKEN=false`.
- Local-only central runtime has been validated through backend health and frontend HTTP checks.
- Backend runtime operational memakai `mwd-app-be/.env`.
- Frontend runtime/build operational memakai `mwd-app-fe/.env`.
- `mwd-app-fe/.env.local` ada dan harus diabaikan untuk central local server deployment.
- Testing assets masih ada: `.env.testing`, port `5002`, frontend testing `3002`, dan database `mwd_test`. Semuanya hanya untuk test flow, bukan deployment operational.
- Backend default port: `5001`.
- Frontend production default port yang dituju: `3000`.
- Backend `server.ts` sudah membaca `PORT` dan `HOST`; default `HOST` adalah `0.0.0.0`.
- Frontend dapat dijalankan dengan `next start -H 0.0.0.0 -p 3000`.
- Backend memiliki health endpoint: `/health`, `/api/health`, dan `/api/readiness`.
- Backend WebSocket native berjalan di path `/ws`.
- Serial gateway dan ESP WebSocket gateway terintegrasi pada backend startup melalui `startSerialGateway()` dan `startEspWebSocketGateway()`.
- PWA manifest dan service worker tersedia di `mwd-app-fe/public`.

Audit env penting:

- Backend `.env` memakai database `mwd_db`, port `5001`, gateway/serial settings, dan CORS origin.
- Frontend `.env` saat audit masih mengarah ke `localhost:5001`.
- Untuk LAN mode, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_URL`, dan `NEXT_PUBLIC_WS_URL` harus memakai IP/hostname server atau tervalidasi aman.
- Backend CORS sudah membaca `CORS_ORIGIN`. Pada production, origin yang diizinkan harus eksplisit.

## 3. Opsi deployment yang dianalisis

1. Full isolated local install di setiap laptop.
2. Central local server.
3. Central local server + Level 3 installer untuk server utama.
4. Docker Compose.
5. Electron/Tauri desktop wrapper.
6. Cloud/server online.

## 4. Perbandingan opsi

| Opsi | Kelebihan | Kekurangan | Kesesuaian |
| --- | --- | --- | --- |
| Full isolated local setiap laptop | Tiap laptop bisa berdiri sendiri | Database terpecah, receiver ganda, session tidak konsisten, backup sulit, maintenance berulang | Tidak cocok |
| Central local server | Data terpusat, receiver satu, user cukup browser, maintenance sederhana | Perlu konfigurasi LAN, firewall, host, service, backup | Cocok |
| Central local server + Level 3 installer server utama | Menjaga central server, instalasi server lebih rapi, service/log/shortcut bisa distandardisasi | Installer harus hati-hati agar tidak menyentuh data tanpa konfirmasi | Paling cocok sebagai target bertahap |
| Docker Compose | Environment konsisten, dependency terisolasi | Perlu Docker di industrial PC, serial/USB dan Windows service lebih rumit, operator perlu pengetahuan tambahan | Opsional masa depan |
| Electron/Tauri wrapper | Terasa desktop-native | Tidak menyelesaikan sentralisasi data, menambah maintenance app wrapper, tetap butuh server pusat | Tidak perlu |
| Cloud/server online | Akses luas dan backup bisa lebih matang | Bergantung internet, isu latency/site security, receiver rig lokal tetap perlu gateway | Bukan target utama |

## 5. Opsi yang dipilih

Opsi yang dipilih:

```text
Central local server sebagai arsitektur utama
+
Level 3 installer/package hanya untuk server utama
+
Shortcut app-mode untuk server dan user lain
```

## 6. Alasan memilih Central Local Server

- Cocok untuk monitoring real-time karena data dan receiver berada di satu titik operasi.
- Data tidak terfragmentasi antar laptop.
- Multiuser lebih tepat karena semua user melihat session dan historical data yang sama.
- Maintenance cukup dilakukan di server utama.
- Backup lebih aman karena database pusat hanya satu.
- Receiver/WITS tidak berjalan ganda.
- Web architecture tetap dipertahankan; laptop user lain cukup memakai browser.
- Tidak perlu mengubah aplikasi menjadi Electron/native desktop.

## 7. Posisi Level 3 installer

Level 3 installer hanya untuk server utama. Installer/package bertugas menyiapkan production build, script service, shortcut server, dokumentasi, dan template konfigurasi. Installer tidak ditujukan untuk laptop user lain dan tidak boleh melakukan operasi berisiko seperti restore database, reset data, atau membuka firewall tanpa konfirmasi eksplisit.

## 8. Posisi shortcut app-mode

Shortcut app-mode adalah mekanisme akses UI ringan:

- Server utama dapat memakai `http://127.0.0.1:3000`.
- User LAN memakai `http://<SERVER_HOST>:3000` atau hostname lokal.
- Shortcut membuka Edge/Chrome dengan `--app=<AppUrl>` jika tersedia.
- Shortcut tidak menginstall database, backend, frontend, atau source code pada laptop user.

## 9. Risiko teknis

- Frontend `.env` memakai `localhost`, sehingga laptop user LAN bisa gagal mengakses backend jika build tidak sesuai.
- CORS production harus memuat origin IP/hostname server.
- Firewall Windows dapat memblokir port frontend/backend.
- PostgreSQL tidak boleh diekspos ke LAN.
- Service Windows perlu tool seperti NSSM dan konfigurasi working directory/log yang benar.
- Receiver serial/gateway harus hanya aktif di server utama.
- Mengubah `NEXT_PUBLIC_*` membutuhkan rebuild frontend.
- LAN mode membutuhkan IP/hostname server aktual sebelum env diterapkan.
- LAN env has been generated for `192.168.18.75`, but LAN reachability still depends on binding/firewall approval and network policy.

## 10. Mitigasi risiko

- Gunakan script check central server untuk validasi env, port, build, CORS, API URL, WS URL, health endpoint, dan LAN readiness.
- Gunakan `mwd-app-be/.env` dan `mwd-app-fe/.env` sebagai env operational.
- Jangan buka port PostgreSQL ke jaringan.
- Firewall script default dry-run; apply hanya dengan `-ConfirmApply`.
- Service install default dry-run; install nyata hanya dengan `-ConfirmInstall`.
- Backup script hanya menjalankan `pg_dump`; tidak ada restore otomatis.
- Package script tidak menyalin `.env` berisi secret, `.env.local`, `.env.testing`, `.git`, logs lama, atau dump database.
- Branch `package` adalah branch yang benar untuk pengujian package/installer deployment saat ini.
- Validate production security env before start: `JWT_SECRET`, `GATEWAY_API_KEY` if set, and `GATEWAY_HMAC_SECRET` if set must be at least 32 characters; `AUTH_EXPOSE_TOKEN` must be off.
- Keep firewall and Windows service installation gated behind explicit approval.

## 11. Roadmap implementasi bertahap

1. Selesaikan audit dan dokumen keputusan.
2. Tambahkan script validasi central local server.
3. Tambahkan script start production central server dengan log dan mode LAN/local-only.
4. Tambahkan shortcut app-mode untuk server dan client.
5. Tambahkan scaffold service Windows berbasis NSSM dengan dry-run default.
6. Tambahkan firewall dry-run/apply eksplisit.
7. Tambahkan backup database aman dengan `pg_dump`.
8. Tambahkan package scaffold dan Inno Setup template untuk server utama.
9. Tambahkan dokumentasi operational, security, backup, service, client access, dan troubleshooting.
10. Jalankan validasi non-destruktif.
