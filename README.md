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
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="change_this_secret_at_least_32_characters"
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000,http://100.110.181.15:3000"
GATEWAY_API_KEY="change_this_gateway_key_at_least_32_chars"
SERIAL_GATEWAY_ENABLED=false
SERIAL_PORT=auto
SERIAL_BAUD_RATE=115200
```

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

```bash
npm run dev
```

Default URL:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`
- Backend health: `http://localhost:5001/health`
- WebSocket: `ws://localhost:5001/ws`

Backend tetap bind ke `0.0.0.0`, sehingga dapat diakses dari device lain jika firewall mengizinkan port `3000` dan `5001`.

## Build Production Local

```bash
npm run build
```

Command ini membuild backend TypeScript ke `mwd-app-be/dist` dan frontend Next.js ke `mwd-app-fe/.next`.

## Start Production Local

```bash
npm run start
```

Command ini menjalankan backend build dan frontend production server secara bersamaan.

## Clean Build Output

```bash
npm run clean
```

Membersihkan:

- `mwd-app-be/dist`
- `mwd-app-fe/.next`

## Database dan Seed

Dari folder backend:

```bash
cd mwd-app-be
npx prisma migrate dev
npm run seed
```

Seed membuat role sistem, user admin/engineer default, WITS config default, dan plot template default.

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
  "build": "npm --prefix mwd-app-be run build && npm --prefix mwd-app-fe run build",
  "start": "concurrently -n backend,frontend -c blue,green \"npm --prefix mwd-app-be run start\" \"npm --prefix mwd-app-fe run start\"",
  "clean": "rimraf mwd-app-be/dist mwd-app-fe/.next"
}
```
