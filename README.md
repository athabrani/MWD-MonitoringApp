# MWD Monitoring App

MWD Monitoring App adalah sistem monitoring Measurement While Drilling berbasis web untuk local deployment. Repository ini berisi backend Express/Prisma/WebSocket/serial gateway dan frontend Next.js dengan dukungan PWA.

## Struktur

```txt
.
├─ docs/
├─ mwd-app-be/   # Backend Express, Prisma, PostgreSQL, native WebSocket, serial gateway
├─ mwd-app-fe/   # Frontend Next.js App Router + PWA
└─ package.json  # Root scripts untuk menjalankan kedua package
```

## Install

Dari root repository:

```bash
npm install
npm run install:all
```

`npm install` di root memasang tooling root seperti `concurrently` dan `rimraf`. `npm run install:all` memasang dependency backend dan frontend.

## Environment Backend

Copy file contoh:

```bash
copy mwd-app-be\.env.example mwd-app-be\.env
```

Minimal konfigurasi:

```env
PORT=5001
HOST=0.0.0.0
DATABASE_URL="postgresql://postgres:password_lokal_anda@localhost:5432/mwd_db"
JWT_SECRET="change_this_secret_at_least_32_characters"
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://100.110.181.15:3000"
GATEWAY_API_KEY="change_this_gateway_key_at_least_32_chars"
SERIAL_GATEWAY_ENABLED=false
SERIAL_PORT=auto
SERIAL_BAUD_RATE=115200
```

`DATABASE_URL` wajib memakai format PostgreSQL:

```txt
postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME
```

Gunakan password PostgreSQL lokal masing-masing. Jangan commit file `.env` yang berisi password asli.

Jangan menaruh `DATABASE_URL`, `JWT_SECRET`, `GATEWAY_API_KEY`, SMTP secret, atau secret backend lain ke environment frontend.

## Environment Frontend

Copy file contoh:

```bash
copy mwd-app-fe\.env.example mwd-app-fe\.env.local
```

Local default:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
NEXT_PUBLIC_WS_URL=ws://localhost:5001/ws
NEXT_PUBLIC_SYSTEM_HEALTH_PATH=/
```

Untuk akses dari device lain di jaringan lokal, ganti `localhost` dengan IP laptop/server:

```env
NEXT_PUBLIC_API_URL=http://<IP-LAPTOP>:5001
NEXT_PUBLIC_API_BASE_URL=http://<IP-LAPTOP>:5001
NEXT_PUBLIC_WS_URL=ws://<IP-LAPTOP>:5001/ws
```

Tambahkan origin frontend network ke backend:

```env
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000,http://<IP-LAPTOP>:3000"
```

## Development

Pastikan PostgreSQL lokal sudah berjalan dan `mwd-app-be\.env` sudah berisi `DATABASE_URL` yang benar.

Setup database dan backend dari root repository:

```bash
npm run setup:local
```

Command ini menjalankan `prisma generate`, `prisma migrate dev`, lalu build backend TypeScript.

Jika ingin membuat data awal:

```bash
npm run seed:local
```

Jalankan frontend dan backend dalam mode development:

```bash
npm run dev
```

Default URL:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`
- Backend health: `http://localhost:5001/health`
- WebSocket: `ws://localhost:5001/ws`

Backend tetap bind ke `0.0.0.0`, sehingga dapat diakses dari device lain jika firewall mengizinkan port `3000` dan `5001`.

Jika port frontend `3000` sedang dipakai, jalankan frontend development di port `3001`:

```bash
npm run dev:port-3001
```

Saat memakai port `3001`, pastikan `CORS_ORIGIN` backend memuat `http://localhost:3001`.

## Build Production Local

```bash
npm run build
```

Command ini menjalankan Prisma generate, membuild backend TypeScript ke `mwd-app-be/dist`, dan membuild frontend Next.js ke `mwd-app-fe/.next`.

## Start Production Local

`npm run start` menjalankan output build production dan tetap memakai port frontend default Next.js, yaitu `3000`.

```bash
npm run start
```

Command ini menjalankan backend build dan frontend production server secara bersamaan.

Untuk local production start yang membuild dulu dan menjalankan frontend pada port alternatif `3001`:

```bash
npm run start:local
```

## Clean Build Output

```bash
npm run clean
```

Membersihkan:

- `mwd-app-be/dist`
- `mwd-app-fe/.next`

## Database dan Seed

Pastikan service PostgreSQL lokal berjalan lebih dulu. Buat database sesuai nama di `DATABASE_URL`, misalnya `mwd_db`.

Contoh menggunakan `createdb`:

```bash
createdb -U postgres mwd_db
```

Contoh menggunakan `psql`:

```sql
CREATE DATABASE mwd_db;
```

Isi `mwd-app-be\.env`:

```env
DATABASE_URL="postgresql://postgres:password_lokal_anda@localhost:5432/mwd_db"
```

Dari root repository:

```bash
npm run setup:local
npm run seed:local
```

Atau dari folder backend:

```bash
cd mwd-app-be
npx prisma generate
npx prisma migrate dev
npm run build
npm run seed
```

Seed membuat role sistem, user admin/engineer default, WITS config default, dan plot template default.

Jika backend gagal dengan pesan authentication failed untuk user `postgres`, password pada `DATABASE_URL` tidak cocok dengan password PostgreSQL lokal, atau user/database belum tersedia.

## Troubleshooting Port 3000 Windows

Jika frontend gagal dengan `EADDRINUSE: address already in use :::3000`, cek proses yang memakai port:

```bat
netstat -ano | findstr :3000
```

Hentikan proses berdasarkan PID:

```bat
taskkill /PID <PID> /F
```

Alternatif tanpa menghentikan proses tersebut, jalankan frontend pada port `3001`:

```bash
npm run dev:port-3001
```

Untuk production local dengan port `3001`:

```bash
npm run start:local
```

## Serial Gateway

Serial gateway hanya valid untuk backend lokal pada mesin yang memiliki akses COM port.

Mode manual:

```env
SERIAL_GATEWAY_ENABLED=true
SERIAL_PORT=COM9
SERIAL_BAUD_RATE=115200
SERIAL_GATEWAY_SESSION_ID=1
```

Mode auto:

```env
SERIAL_GATEWAY_ENABLED=true
SERIAL_PORT=auto
SERIAL_BAUD_RATE=115200
SERIAL_GATEWAY_SESSION_ID=1
```

`SERIAL_PORT=auto` akan memilih port serial non-Bluetooth pertama yang ditemukan dan retry jika port belum tersedia. Jika ada banyak device USB serial, mode manual lebih aman.

Endpoint serial:

- `GET /api/serial/ports`
- `GET /api/serial/status`
- `POST /api/serial/connect`
- `POST /api/serial/disconnect`

## Cek WebSocket

Backend memakai native WebSocket package `ws` pada path `/ws`, bukan Socket.IO.

URL:

```txt
ws://localhost:5001/ws
```

Kirim:

```json
{
  "event": "ping",
  "payload": {}
}
```

Response yang diharapkan:

```json
{
  "event": "pong",
  "payload": {
    "pong": true
  }
}
```

Event utama yang dipertahankan:

- `connected`
- `pong`
- `mwd-data`
- `connection-status`
- `esp-gateway-status`
- `gateway-raw-packet`
- `wits-data`
- `alert`
- `error`

## Cek PWA

Build dan start frontend production:

```bash
npm run build
npm run start
```

Lalu buka `http://localhost:3000` di browser.

Checklist:

- `http://localhost:3000/manifest.webmanifest` terbuka.
- `http://localhost:3000/sw.js` terbuka.
- DevTools > Application > Manifest menampilkan `MWD Monitoring App`.
- DevTools > Application > Service Workers menunjukkan service worker registered.
- DevTools > Application > Cache Storage hanya berisi asset statis/shell dasar.
- Request backend `/api/*` dan WebSocket `/ws` tidak dicache oleh service worker.

Service worker dibuat manual agar aman dengan Next.js versi saat ini. Cache dibatasi pada JS, CSS, font, image, icon, manifest, dan shell navigasi dasar. Monitoring real-time tetap bergantung pada network dan WebSocket.

## Root Scripts

```json
{
  "install:all": "cd mwd-app-be && npm install && cd ../mwd-app-fe && npm install",
  "dev": "concurrently -n backend,frontend -c blue,green \"npm --prefix mwd-app-be run dev\" \"npm --prefix mwd-app-fe run dev\"",
  "dev:port-3001": "concurrently -n backend,frontend -c blue,green \"npm --prefix mwd-app-be run dev\" \"npm --prefix mwd-app-fe run dev:port-3001\"",
  "setup:local": "npm --prefix mwd-app-be run prisma:generate && npm --prefix mwd-app-be run prisma:migrate && npm --prefix mwd-app-be run build",
  "seed:local": "npm --prefix mwd-app-be run seed",
  "build": "npm --prefix mwd-app-be run build && npm --prefix mwd-app-fe run build",
  "start:local": "npm run build && concurrently -n backend,frontend -c blue,green \"npm --prefix mwd-app-be run start\" \"npm --prefix mwd-app-fe run start:port-3001\"",
  "start": "concurrently -n backend,frontend -c blue,green \"npm --prefix mwd-app-be run start\" \"npm --prefix mwd-app-fe run start\"",
  "clean": "rimraf mwd-app-be/dist mwd-app-fe/.next"
}
```
