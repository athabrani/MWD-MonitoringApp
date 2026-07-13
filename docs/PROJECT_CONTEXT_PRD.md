# Project Context PRD - MWD Monitoring App

## 0. Final Central Local Server Deployment Update

Tanggal update: 2026-06-29  
Branch: `package`  
Status utama: operationally ready pada central local server yang sudah dikonfigurasi.

Bagian ini adalah status PRD terbaru dan menjadi acuan utama jika ada perbedaan dengan catatan audit lama di bawahnya.

### Nama dan Tujuan Aplikasi

**Nama aplikasi:** MWD Monitoring App.

MWD Monitoring App adalah aplikasi web/PWA untuk central local server yang digunakan untuk monitoring MWD/WITS, visualisasi data drilling, MWD session management, historical data, service mode operation, export, dan backup database. Sistem dirancang agar satu server utama menjadi source of truth data operasional, sementara device lain mengakses aplikasi melalui browser atau app-mode shortcut pada jaringan LAN.

### Arsitektur Final

```text
Industrial PC / Laptop Server Utama
├── PostgreSQL
├── Backend API Service
├── Frontend Web Service
├── Receiver / Gateway MWD-WITS
├── Logs
├── Backups
└── LAN URL

User Device
└── Browser / app-mode shortcut ke server
```

Frontend dan backend berjalan sebagai service pada server utama. PostgreSQL tidak diekspos ke client LAN. User device hanya mengakses frontend dan backend API/WebSocket melalui server.

### Deployment Model

| Model | Status | Keterangan |
|---|---|---|
| LocalOnly mode | READY | Digunakan untuk akses dari server sendiri melalui `http://127.0.0.1:3000`. |
| LAN mode | READY | Device lain dapat mengakses `http://192.168.18.75:3000`. |
| WinSW service mode | READY | Backend dan frontend service berjalan dan restart test Windows passed. |
| Backup scheduler | READY | Scheduled task `MWDMonitoringDailyDatabaseBackup`. |
| Admin-assisted installer | READY pipeline / RELEASE CANDIDATE installer | `.iss` valid dan installer `.exe` sudah berhasil dicompile via GUI/user-confirmed. |

Status final yang harus dipakai:

```text
Operational deployment on the configured central local server: READY.
Admin-assisted installer pipeline: READY.
Installer release status: RELEASE CANDIDATE.
Final stable installer status: pending clean-machine installation test.
```

### Current Readiness

| Area | Status |
|---|---|
| LocalOnly runtime | READY |
| LAN runtime | READY |
| LAN access dari device lain | READY |
| Cookie-based auth | READY |
| Login dan dashboard | READY |
| 401 after login | RESOLVED pada deployment saat ini |
| Backend WinSW service | running |
| Frontend WinSW service | running |
| `npm run central:services:check` | READY |
| Restart test Windows | PASSED |
| Database backup manual | READY |
| Backup scheduler | READY |
| Restore guide | READY |
| Inno Setup `.iss` | generated and valid |
| Inno Setup compiler detection | READY |
| Installer compile pipeline | READY |
| Installer `.exe` | compiled via GUI/user-confirmed |
| Clean-machine installer test | PENDING |
| Receiver service | PENDING; standalone receiver entrypoint belum verified |
| Firewall | unchanged |
| Database destructive operation | none |

### Scope Sistem

Sistem saat ini mencakup:

- menerima data MWD/WITS melalui backend/gateway yang dikonfigurasi;
- menyimpan data operasional ke PostgreSQL;
- menyinkronkan session/job aktif;
- menampilkan dashboard, Rig WITS, historical data, well plot, connection status, dan failover events;
- mengekspor data sesuai fitur yang tersedia;
- menjalankan backend dan frontend sebagai Windows service;
- melakukan backup database manual dan terjadwal;
- menyediakan installer admin-assisted untuk central server.

Out of scope untuk status final ini:

- decoding sinyal mentah radio/LoRa level fisik;
- mengendalikan rig;
- membuka PostgreSQL langsung ke client LAN;
- clean-machine stable installer claim sebelum installation test selesai;
- receiver service standalone sampai entrypoint diverifikasi.

### Functional Modules

| Modul | Status | Catatan |
|---|---|---|
| Login/auth | READY | Cookie-based auth berhasil; tidak ada 401 setelah login pada deployment saat ini. |
| Dashboard | READY | Dashboard berhasil terbuka setelah login. |
| MWD sessions | READY untuk runtime saat ini | Session digunakan sebagai konteks data. |
| Rig WITS monitoring | READY/PARTIAL | Siap sebagai modul monitoring; bergantung pada input backend/gateway. |
| Historical data | READY/PARTIAL | Tersedia sebagai workflow data historis. |
| Well plot | READY/PARTIAL | Tersedia sebagai modul visualisasi. |
| Connection status | READY | Dipakai untuk health/runtime visibility. |
| Failover events | READY/PARTIAL | Tersedia sebagai modul status/event. |
| Export | READY/PARTIAL | Bergantung pada endpoint dan data yang tersedia. |
| Admin/settings | READY/PARTIAL | Dipakai untuk administrasi dan konfigurasi. |
| Backup/restore | READY guide | Backup siap; restore production dibatasi oleh dry-run dan confirmation. |
| Service mode | READY | Backend/frontend service running dan restart test passed. |
| Installer | RELEASE CANDIDATE | Pipeline siap; clean install pending. |

### Non-Functional Requirements Final

| Requirement | Status | Catatan |
|---|---|---|
| LAN-based access | READY | Device lain dapat akses server URL. |
| Service auto-start | READY | Restart test Windows passed. |
| Backup safety | READY | Manual backup dan scheduler tersedia. |
| Credential safety | REQUIRED | `.env` dan secret tidak boleh di-commit. |
| No PostgreSQL exposure to clients | REQUIRED | Client LAN hanya akses frontend/backend, bukan `5432`. |
| Installer safety | PARTIAL | Installer admin-assisted; clean-machine test belum selesai. |
| Runtime safety | READY | Tidak ada database destructive operation pada deployment final. |

### Known Limitations

| Limitation | Status | Dampak |
|---|---|---|
| Receiver service standalone | PENDING | Backend/gateway runtime tetap berjalan, tetapi service receiver terpisah belum dapat diklaim siap. |
| Clean-machine installer test | PENDING | Installer masih release candidate, belum final stable. |
| Installer model | Admin-assisted | Belum fully one-click; membutuhkan prerequisite dan setup admin. |
| Firewall | unchanged | Jika client baru gagal akses, firewall perlu dicek manual tanpa membuka PostgreSQL. |

### Dokumentasi Deployment Terkait

Panduan deployment final ada di:

```text
docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md
README-CENTRAL-SERVER-DEPLOYMENT.md
README.md
```

Dokumen ini adalah PRD sekaligus context handoff document untuk developer dan AI assistant/GPT/Codex session berikutnya. Isi dokumen disusun berdasarkan scan repository pada 2026-06-10 dari source code yang tersedia di repository ini. Jika ada konflik antara dokumentasi lama dan source code, source code diprioritaskan.

## 1. Project Overview

**Nama project:** MWD Monitoring App / MWD Monitoring API.

**Tujuan utama sistem:** menyediakan sistem monitoring Measurement While Drilling berbasis web yang dapat menerima data MWD/WITS dari hardware atau gateway lokal, menyimpan data ke database, dan menampilkan data real-time maupun historical ke frontend.

**Masalah yang ingin diselesaikan:**

- Menghubungkan data drilling dari ESP32/LoRa/Wi-Fi/serial gateway ke aplikasi web.
- Menyimpan data sensor MWD, WITS values, survey, trajectory, depth tracking, dan export secara terstruktur.
- Menampilkan data monitoring real-time ke dashboard frontend melalui WebSocket.
- Mendukung deployment lokal di rig/server PC yang memiliki akses COM port.

**Gambaran sistem umum:**

- Backend Express.js menerima HTTP API, gateway ingest, WebSocket native, ESP WebSocket gateway, dan serial gateway.
- Backend menggunakan Prisma ORM dan PostgreSQL.
- Frontend Next.js membaca API backend melalui `NEXT_PUBLIC_API_BASE_URL` dan real-time stream melalui `NEXT_PUBLIC_WS_URL`.
- Data dari serial/ESP/gateway diparse sebagai WITS atau payload MWD, divalidasi, disimpan, lalu dibroadcast ke WebSocket.

**Scope sistem:**

- Login dan role user.
- Monitoring MWD real-time dan historical.
- Gateway ingest via HTTP, serial port, dan ESP WebSocket.
- WITS config, WITS data values, WITS alarms, dan WITS output queue.
- Survey station, well plan, trajectory actual vs plan, depth tracking.
- Export historical, WITS, survey, LAS, PDF plot, Excel/PDF survey.
- Admin/system utilities untuk backup, restore, clear data, audit logs.

**Batasan sistem:**

- Akses serial COM port hanya valid saat backend berjalan di mesin lokal yang terhubung hardware.
- PWA configuration belum ditemukan di frontend saat ini.
- Frontend dan backend masih berada dalam package terpisah, belum satu production package terpadu.
- Standar data yang dipakai adalah WITS/MWD internal. Jangan mengubahnya menjadi WITSML kecuali diminta eksplisit.

## 2. Current Repository Structure

Struktur utama repository:

```txt
.
├─ README.md
├─ .env.local
├─ docs/
├─ mwd-app-be/
└─ mwd-app-fe/
```

**Folder backend:** `mwd-app-be/`

- `src/server.ts`: entry point backend. Membuat HTTP server, attach Express dan native WebSocket, lalu start ESP WebSocket gateway dan serial gateway.
- `src/app.ts`: konfigurasi Express, CORS, security headers, rate limit, CSRF middleware, JSON normalization, dan route registry.
- `src/routes/`: route API Express.
- `src/controllers/`: HTTP controller layer.
- `src/services/`: business logic, WebSocket, serial gateway, ESP WebSocket, gateway fusion, export, survey, auth, dan lain-lain.
- `src/middlewares/`: auth, gateway API key/HMAC, security, validation, error handling.
- `src/utils/`: parser WITS serial, request schema Zod, security env validation, measurement mapping, timestamp/depth sync.
- `prisma/schema.prisma`: schema database PostgreSQL.
- `prisma/seed.js`: seed role, admin/engineer users, WITS configs, dan default plot template.
- `.env.example`: contoh environment backend.
- `docs/`: dokumentasi backend lama, termasuk native WebSocket dan API endpoint frontend.

**Folder frontend:** `mwd-app-fe/`

- `app/`: Next.js App Router pages seperti dashboard, monitoring, history, export, configuration, data-management, trajectory, admin, login, settings, system-utilities.
- `components/`: layout, screen components, UI components, chart, connection status, auth screen.
- `lib/`: API clients, realtime client, auth API, serial API, export API, WITS API, security helpers, data clients.
- `context/`: `AuthContext.tsx` dan `AppContext.tsx`.
- `data/`: data/config static seperti monitoring, plotting, LAS, Polaris config.
- `public/`: image/static assets, termasuk `mwd.jpg`.
- `next.config.ts`: Next.js config dengan Turbopack root.
- `package.json`: dependency frontend.

**Shared/config folder:** tidak ditemukan folder shared khusus di root. Konfigurasi utama tersebar di `.env.example`, Prisma schema, `lib/*-api.ts`, dan service backend.

**File penting:**

- Backend package: `mwd-app-be/package.json`
- Frontend package: `mwd-app-fe/package.json`
- Prisma schema: `mwd-app-be/prisma/schema.prisma`
- Backend entry: `mwd-app-be/src/server.ts`
- Express app: `mwd-app-be/src/app.ts`
- WebSocket service: `mwd-app-be/src/services/websocket.service.ts`
- Serial gateway: `mwd-app-be/src/services/serial-gateway.service.ts`
- ESP gateway: `mwd-app-be/src/services/esp-websocket.service.ts`
- Gateway ingest/fusion: `mwd-app-be/src/services/gateway-ingest.service.ts`, `mwd-app-be/src/services/gateway-fusion.service.ts`
- Frontend API base client: `mwd-app-fe/lib/api-client.ts`
- Frontend realtime client: `mwd-app-fe/lib/realtime-client.ts`
- PWA config: Not found in current repository.

## 3. System Architecture

**Hardware/gateway ke backend:**

1. Hardware ESP32/LoRa/Wi-Fi dapat mengirim payload melalui:
   - HTTP `POST /api/gateway/mwd-data` dengan `x-gateway-key` atau Bearer gateway key.
   - ESP WebSocket yang dikoneksi oleh backend menggunakan `ESP_WS_URL`.
   - Serial COM port yang dibuka backend menggunakan package `serialport`.
2. Payload dapat berupa JSON MWD, WITS key-value, WITS line compact, atau WITS block `&& ... !!`.
3. Backend melakukan parsing, validasi `sessionId`, mapping WITS ke field MWD, deduplication/fusion, lalu ingest.

**Backend ke database:**

- Database provider adalah PostgreSQL.
- Prisma Client digunakan dari `src/lib/prisma.ts`.
- Data utama masuk ke `MWD_Data`.
- Raw WITS/configured values masuk ke `WITS_Data_Value`.
- Gateway raw packet dapat masuk ke `Gateway_Raw_Packet_Log`.
- Depth tracking diupdate melalui `DepthTrackingState` dan `DepthTrackingSample`.

**Backend ke frontend via WebSocket:**

- Native WebSocket menggunakan package `ws`.
- WebSocket ditempel ke HTTP server yang sama dengan Express.
- Path WebSocket: `/ws`.
- Event utama: `connected`, `mwd-data`, `connection-status`, `esp-gateway-status`, `gateway-raw-packet`, `wits-data`, `alert`, `error`, `pong`.

**Hubungan komponen:**

```txt
ESP32/LoRa/Wi-Fi/Serial
  -> Backend gateway parser/ingest/fusion
  -> PostgreSQL via Prisma
  -> Native WebSocket /ws
  -> Next.js frontend dashboard/monitoring/charts
```

**Mode local deployment:**

- Backend berjalan di PC lokal rig/server pada port default `5001`.
- Frontend berjalan di `localhost:3000` saat development.
- `CORS_ORIGIN` harus mengizinkan frontend.
- Serial gateway hanya dapat membaca COM port pada mesin yang menjalankan backend.

**Konsep one package PWA/local production-ready:**

Saat ini belum satu package. Rekomendasi: build frontend static/PWA lalu backend Express melayani API, `/ws`, dan static frontend build dalam satu command `npm start`. Detail ada di bagian 11.

## 4. Core Features

- **Login dan role user:** JWT auth dengan role `admin`, `engineer`, dan `operator`. Seed membuat admin dan engineer default; role operator dibuat oleh sync role tetapi user operator default tidak dibuat di `prisma/seed.js`.
- **Monitoring real-time data MWD:** data dari gateway masuk ke `MWD_Data` dan dibroadcast sebagai event `mwd-data`.
- **Native WebSocket:** memakai package `ws`, bukan Socket.IO, path `/ws`.
- **Serial gateway:** membaca ESP32/LoRa dari COM port, parsing WITS/MWD, ingest ke backend.
- **Auto serial port detection:** tersedia jika `SERIAL_PORT=auto`. Kode memilih port serial non-Bluetooth pertama dari daftar `SerialPort.list()` dan retry discovery.
- **Historical data:** tersedia route `/api/historical-data` dan data utama `/api/mwd-data`.
- **Export data:** export historical, WITS, surveys, LAS, PDF plot, survey XLSX/PDF, dan export records.
- **Survey configuration:** tersedia `SurveyConfig`, `/api/survey-configs/:sessionId`, survey station, well plan import, trajectory data.
- **Plan view actual vs plan:** model `SurveyStation.stationType` mendukung `actual` dan `plan`; frontend memiliki `trajectory` dan `well-plot`.
- **Plotting/export PDF:** `PlotTemplate`, `pdf-plot.service.ts`, dan `/api/exports/pdf-plot`.
- **Status koneksi gateway:** connection status, serial status, ESP WebSocket status, raw packet log.
- **Failover Wi-Fi/LoRa:** model `FailoverEvent` dan gateway fusion tersedia. Implementasi hardware failover fisik perlu konfirmasi.
- **PWA support:** Not found in current repository.
- **Local deployment support:** tersedia secara arsitektur melalui backend lokal, serialport, CORS, dan env local.

## 5. Backend Context

**Tech stack backend:**

- Node.js, TypeScript, Express.js 5, Prisma 5, PostgreSQL.
- WebSocket native memakai `ws`.
- Serial port memakai `serialport`.
- Auth memakai `jsonwebtoken` dan `bcrypt`.
- Validation memakai `zod`.
- Export memakai `exceljs`, `pdfkit`.

**Entry point server:** `mwd-app-be/src/server.ts`.

**Port default:** `PORT` env jika valid, fallback `5001`. Host default `0.0.0.0`.

**Environment penting:** `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `GATEWAY_API_KEY`, `GATEWAY_HMAC_SECRET`, `ESP_WS_URL`, `SERIAL_GATEWAY_ENABLED`, `SERIAL_PORT`, `SERIAL_BAUD_RATE`.

**API routes utama:**

- `/api/auth`
- `/api/mwd-sessions`
- `/api/mwd-data`
- `/api/gateway`
- `/api/serial`
- `/api/esp-ws`
- `/api/wits-config`
- `/api/wits-data-values`
- `/api/wits-alarms`
- `/api/wits-output`
- `/api/surveys`
- `/api/survey-configs`
- `/api/exports`
- `/api/historical-data`
- `/api/depth-tracking`
- `/api/memory-files`
- `/api/plot-templates`
- `/api/connection-status`
- `/api/failover-events`
- `/api/gateway-raw-packets`
- `/api/system-utilities`
- `/api/users`, `/api/roles`, `/api/audit-logs`, `/api/reports`

**WebSocket path:** `/ws`.

**Cara backend menjalankan Express dan WebSocket:**

`server.ts` menggunakan:

```ts
const httpServer = createServer(app)
initializeWebSocket(httpServer)
httpServer.listen(PORT, HOST, ...)
```

`websocket.service.ts` menggunakan:

```ts
new WebSocketServer({ server: httpServer, path: "/ws" })
```

Ini adalah pola yang benar agar Express dan WebSocket tidak melakukan `listen` terpisah pada port yang sama.

**Serial gateway behavior:**

- Start otomatis hanya jika `SERIAL_GATEWAY_ENABLED=true`.
- Manual connect tersedia melalui `POST /api/serial/connect`.
- Port bisa manual, misalnya `COM9`, atau `auto`.
- Baud default `115200`.
- Reconnect default `5000` ms.
- Parser menerima WITS block `&& ... !!`, WITS pairs, JSON payload, dan key-value MWD.
- Metadata signal yang dikenali: `SEQ`, `TS`, `RX_TS`, `RSSI`, `SNR`.

**Database dan Prisma behavior:**

- PostgreSQL dengan Prisma Client.
- Decimal dan BigInt dinormalisasi pada response JSON agar aman untuk frontend.
- Seed melakukan upsert role, admin/engineer user, WITS config default, dan plot template default.

**Authentication behavior:**

- `POST /api/auth/login` menerima `identifier` dan `password`.
- Middleware `authenticate` membaca Bearer token atau cookie token.
- Middleware `authorize` membatasi role.
- Gateway HTTP memakai `authenticateGateway`, bukan user JWT.
- Gateway API key dapat dikirim via `x-gateway-key` atau `Authorization: Bearer <key>`.
- HMAC gateway opsional jika `GATEWAY_HMAC_SECRET` diisi.

**Data model penting:**

- `Role`, `User`, `AuditLog`
- `MWDSession`, `MWDData`
- `WitsConfig`, `WitsDataValue`, `WitsAlarmEvent`, `WitsOutputMessage`
- `SurveyConfig`, `SurveyStation`, `PlotTemplate`
- `GatewayRawPacketLog`, `ConnectionStatus`, `FailoverEvent`, `Websocket`
- `DepthTrackingState`, `DepthTrackingSample`
- `MemoryFile`, `MemoryDataPoint`, `MemoryCorrelation`
- `ExportRecord`, `ReportEmailLog`

**Service penting dan tanggung jawab:**

- `websocket.service.ts`: native WS server, client set, broadcast events.
- `gateway-ingest.service.ts`: validasi payload gateway, session lookup, record MWD/WITS/depth tracking.
- `gateway-fusion.service.ts`: memilih kandidat terbaik dari serial/websocket dalam window waktu.
- `serial-gateway.service.ts`: list/connect/disconnect serial port, parse serial WITS/MWD, status runtime.
- `esp-websocket.service.ts`: koneksi backend ke ESP WebSocket, parse LoRa/raw/WITS payload.
- `mwd-data.service.ts`: CRUD MWD data.
- `wits-data.service.ts`: record configured WITS values dan alarms.
- `survey.service.ts`: survey stations, recalculation, trajectory.
- `export.service.ts`, `las-export.service.ts`, `pdf-plot.service.ts`: export data.
- `auth.service.ts`, `role.service.ts`: auth, JWT, role sync.

## 6. Frontend Context

**Tech stack frontend:**

- Next.js 16 App Router, React 19, TypeScript.
- UI components berbasis Radix UI dan custom `components/ui`.
- Charting memakai Recharts.
- Icons memakai `lucide-react`.

**Halaman/fitur utama:**

- `/login`
- `/dashboard`
- `/monitoring/rig-wits`, `/monitoring/aux-port`
- `/charts`
- `/history`
- `/export`
- `/configuration`, `/configuration/wellplan-surveys`
- `/data-management/log-data`, `/survey-data`, `/plotting`, `/memory-import`, `/generate-las`
- `/trajectory`, `/trajectory/well-plot`
- `/admin`
- `/settings`
- `/system-utilities`
- `/alerts`
- `/help`

**Cara frontend connect ke backend API:**

- `mwd-app-fe/lib/api-client.ts` membaca `NEXT_PUBLIC_API_BASE_URL`.
- Base URL wajib absolute `http` atau `https`.
- Semua path request harus relative. Client menolak URL absolut pada path untuk mencegah endpoint liar.
- Auth token dikirim sebagai `Authorization: Bearer <token>` jika tersedia.

**Cara frontend connect ke WebSocket:**

- `mwd-app-fe/lib/realtime-client.ts` membaca `NEXT_PUBLIC_WS_URL`.
- Client memakai native browser `WebSocket`.
- Event yang diproses saat ini: `mwd-data`, `esp-gateway-status`, `connection-status`.
- Event `connected`, `ping`, `pong`, `heartbeat`, subscription-related diabaikan secara aman.

**Environment variables frontend:**

- `NEXT_PUBLIC_API_BASE_URL`: contoh `http://localhost:5001`.
- `NEXT_PUBLIC_WS_URL`: contoh `ws://localhost:5001/ws`.
- `NEXT_PUBLIC_SYSTEM_HEALTH_PATH`: opsional, dipakai `system-health-api.ts`.

**PWA configuration:**

- Not found in current repository. Tidak ditemukan `manifest`, service worker, Workbox, atau `next-pwa` pada scan source.

**Catatan keamanan frontend:**

- Jangan menaruh secret backend seperti `JWT_SECRET`, `DATABASE_URL`, `GATEWAY_API_KEY`, SMTP credentials, atau API key internal pada `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_*` akan terlihat di bundle/browser.
- Logging error frontend sudah memakai helper security; jangan menambahkan log yang membocorkan token, cookie, gateway key, atau payload sensitif.

**Production/local build behavior:**

- Frontend: `npm run build`, `npm run start`.
- Backend: `npm run build`, `npm start`.
- One-package serving static frontend dari backend belum ditemukan.

## 7. Database Context

**Database:** PostgreSQL.

**ORM:** Prisma.

**Schema:** `mwd-app-be/prisma/schema.prisma`.

**Model/tabel penting:**

- User dan role: `Role`, `User`.
- Job/session: `MWDSession`.
- Data monitoring: `MWDData`.
- WITS: `WitsConfig`, `WitsDataValue`, `WitsAlarmEvent`, `WitsOutputMessage`.
- Survey/trajectory: `SurveyConfig`, `SurveyStation`.
- Gateway: `GatewayRawPacketLog`, `ConnectionStatus`, `FailoverEvent`, `Websocket`.
- Export/report: `ExportRecord`, `ReportEmailLog`.
- Memory/depth tracking: `MemoryFile`, `MemoryDataPoint`, `MemoryCorrelation`, `DepthTrackingState`, `DepthTrackingSample`.

**Relasi penting:**

- `User` memiliki banyak `MWDSession`.
- `MWDSession` memiliki banyak `MWDData`, WITS values, survey stations, memory files, depth tracking samples, export records, raw packet logs.
- `SurveyConfig` unik per `sessionId`.
- `SurveyStation` unik per `sessionId + stationType + measuredDepth`.
- `WitsDataValue` dapat terhubung ke `WitsConfig`.

**Migration/seed behavior:**

- Migration tersedia di `mwd-app-be/prisma/migrations`.
- Seed dari root repository: `npm run seed:local` menjalankan seed backend.
- Seed membuat role `admin`, `engineer`, `operator`, tetapi default user hanya `admin` dan `engineer`.
- Seed mengisi banyak WITS config default dan satu plot template default.

**DATABASE_URL:** wajib untuk Prisma dan backend.

## 8. Environment Variables

| Env | Digunakan di | Wajib/Opsional | Contoh value | Penjelasan |
| --- | --- | --- | --- | --- |
| `PORT` | Backend | Opsional | `5001` | Port HTTP Express dan WebSocket. Fallback `5001`. |
| `HOST` | Backend | Opsional | `0.0.0.0` | Host bind backend. |
| `DATABASE_URL` | Backend/Prisma | Wajib | `postgresql://postgres:password@localhost:5432/mwd_db` | Koneksi PostgreSQL. |
| `JWT_SECRET` | Backend | Wajib | `change_me_long_secret` | Secret JWT auth. |
| `CORS_ORIGIN` | Backend | Wajib untuk FE cross-origin | `http://localhost:3000` | Origin frontend yang diizinkan. Bisa CSV. |
| `AUTH_EXPOSE_TOKEN` | Backend | Opsional | `false` | Mengontrol apakah token diekspos di response login. |
| `AUTH_COOKIE_SAME_SITE` | Backend | Opsional | `Lax` | SameSite cookie auth. |
| `AUTH_COOKIE_SECURE` | Backend | Opsional | `false` | Secure cookie flag. |
| `GATEWAY_API_KEY` | Backend/gateway | Wajib untuk HTTP gateway | `replace_with_secret` | API key untuk `/api/gateway/mwd-data`. |
| `GATEWAY_HMAC_SECRET` | Backend/gateway | Opsional | `hmac_secret` | Jika diisi, gateway harus kirim timestamp dan signature HMAC. |
| `GATEWAY_FUSION_ENABLED` | Backend | Opsional | `true` | Aktifkan pemilihan kandidat terbaik serial/websocket. |
| `GATEWAY_FUSION_WINDOW_MS` | Backend | Opsional | `750` | Window fusion candidate. |
| `GATEWAY_RAW_PACKET_LOG_ENABLED` | Backend | Opsional | `true` | Aktifkan logging raw gateway packet. |
| `SERIAL_GATEWAY_ENABLED` | Backend | Opsional | `false` | Start serial gateway saat server boot. |
| `SERIAL_PORT` | Backend | Wajib jika serial enabled | `COM9` atau `auto` | COM port manual atau auto-detection. |
| `SERIAL_BAUD_RATE` | Backend | Opsional | `115200` | Baud rate serial. |
| `SERIAL_GATEWAY_SESSION_ID` | Backend | Opsional tetapi diperlukan jika payload tidak membawa `sessionId` | `1` | Default session untuk serial ingest. |
| `SERIAL_GATEWAY_SOURCE` | Backend | Opsional | `esp32-serial` | Source label serial. |
| `SERIAL_GATEWAY_RECONNECT_MS` | Backend | Opsional | `5000` | Reconnect interval. |
| `SERIAL_GATEWAY_VERBOSE` | Backend | Opsional | `false` | Log raw serial verbose. |
| `SERIAL_GATEWAY_TRANSMITTER_ID` | Backend | Opsional | `tx-1` | Identitas transmitter untuk dedup/fusion. |
| `ESP_WS_GATEWAY_ENABLED` | Backend | Opsional | `false` | Start ESP WebSocket gateway saat server boot. |
| `ESP_WS_URL` | Backend | Opsional | `ws://192.168.4.1:81` | URL ESP WebSocket saat `ESP_WS_GATEWAY_ENABLED=true`. |
| `ESP_GATEWAY_SESSION_ID` | Backend | Opsional tetapi diperlukan jika ESP payload tidak membawa `sessionId` | `1` | Default session untuk ESP ingest. |
| `ESP_GATEWAY_SOURCE` | Backend | Opsional | `esp32-websocket` | Source label ESP WebSocket. |
| `ESP_WS_RECONNECT_MS` | Backend | Opsional | `5000` | Reconnect ESP WebSocket. |
| `ESP_WS_INGEST_TYPES` | Backend | Opsional | `rx,tx_ws_only,raw` | Message type ESP yang diingest. |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Wajib | `http://localhost:5001` | Base URL backend untuk browser. |
| `NEXT_PUBLIC_WS_URL` | Frontend | Wajib untuk realtime | `ws://localhost:5001/ws` | Native WebSocket URL. |
| `NEXT_PUBLIC_SYSTEM_HEALTH_PATH` | Frontend | Opsional | `/api/health` | Health probe path frontend. |
| `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed | Opsional | `admin`, `admin@example.com`, `admin12345` | Default admin seed. |
| `ENGINEER_USERNAME`, `ENGINEER_EMAIL`, `ENGINEER_PASSWORD` | Seed | Opsional | `engineer`, `engineer@example.com`, `engineer12345` | Default engineer seed. |
| `EMAIL_REPORTS_ENABLED` dan `SMTP_*` | Backend | Opsional | `false` | Email report feature dan SMTP config. |

Jika `SERIAL_PORT=auto`, kode harus menggunakan logic auto-detection. Repository saat ini sudah memiliki `resolveConfiguredSerialPath()` yang memanggil `listSerialPorts()`, memilih port non-Bluetooth pertama, dan retry jika belum ditemukan.

## 9. Known Issues / Important Fixes

**EADDRINUSE `0.0.0.0:5001`:**

- Potensi penyebab: Express dan WebSocket sama-sama memanggil `listen` secara terpisah pada port yang sama.
- Status source saat ini: sudah menggunakan pola yang benar di `src/server.ts`.
- Solusi yang harus dipertahankan:

```ts
const httpServer = createServer(app)
initializeWebSocket(httpServer)
httpServer.listen(PORT, HOST)
```

```ts
new WebSocketServer({ server: httpServer, path: "/ws" })
```

**Native WebSocket vs Socket.IO:**

- Backend saat ini memakai native WebSocket package `ws`.
- Frontend memakai browser `WebSocket`.
- Jangan memakai Socket.IO client kecuali backend juga diubah secara eksplisit.

**WebSocket tidak boleh membuat server port sendiri:**

- `websocket.service.ts` harus attach ke `httpServer`.
- Jangan membuat `new WebSocketServer({ port: 5001 })` jika Express sudah listen di port yang sama.

**Deployment/local mode:**

- Serial gateway dan COM port hanya cocok untuk local deployment, bukan Vercel/serverless.
- `mwd-app-be/vercel.json` ada, tetapi hardware serial tidak cocok untuk platform serverless.

**Serial port manual vs auto:**

- Manual: `SERIAL_PORT=COM9` atau body `{"path":"COM9"}`.
- Auto: `SERIAL_PORT=auto`, memilih port non-Bluetooth pertama.
- Auto tidak menjamin memilih device yang benar jika ada banyak USB serial device. UI sebaiknya tetap menyediakan manual selection.

**Dokumentasi lama vs source:**

- `mwd-app-be/docs/FE_API_ENDPOINTS.md` menyebut operator default credentials, tetapi `prisma/seed.js` hanya membuat admin dan engineer user default. Operator role ada, user operator default tidak ditemukan di seed.

## 10. Development Workflow

**Install dependency:**

```bash
cd mwd-app-be
npm install

cd ../mwd-app-fe
npm install
```

**Setup `.env`:**

```bash
cd mwd-app-be
copy .env.example .env
```

Isi minimal backend:

```txt
DATABASE_URL="postgresql://postgres:password@localhost:5432/mwd_db"
JWT_SECRET="change_me"
CORS_ORIGIN="http://localhost:3000"
GATEWAY_API_KEY="change_me_gateway"
```

Frontend membutuhkan env local sendiri. File contoh frontend tidak ditemukan. Buat sesuai kebutuhan:

```txt
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
NEXT_PUBLIC_WS_URL=ws://localhost:5001/ws
```

**Database setup:**

```bash
npm run setup:local
npm run seed:local
```

**Menjalankan backend:**

```bash
cd mwd-app-be
npm run dev
```

Backend default: `http://localhost:5001`.

**Menjalankan frontend:**

```bash
cd mwd-app-fe
npm run dev
```

Frontend default: `http://localhost:3000`.

**Full local package:** Not found in current repository. Saat ini jalankan backend dan frontend sebagai dua process.

**Build production:**

```bash
cd mwd-app-be
npm run build
npm start

cd ../mwd-app-fe
npm run build
npm run start
```

**Test WebSocket:**

- URL local: `ws://localhost:5001/ws`.
- Kirim:

```json
{ "event": "ping", "payload": {} }
```

- Expected event: `pong`.

**Test serial gateway:**

1. Pastikan backend berjalan di mesin yang punya COM port.
2. Login sebagai admin/engineer.
3. `GET /api/serial/ports`.
4. `POST /api/serial/connect` dengan body:

```json
{
  "path": "COM9",
  "baudRate": 115200,
  "sessionId": 1,
  "source": "esp32-serial",
  "verbose": true
}
```

5. Poll `GET /api/serial/status`.

**Test API:**

1. `POST /api/auth/login`
2. `GET /api/auth/me`
3. `GET /api/mwd-sessions`
4. `POST /api/gateway/mwd-data` dengan `x-gateway-key` untuk test hardware ingest.

## 11. PWA / One Package Plan

**Kondisi saat ini:**

- Frontend Next.js dan backend Express berada dalam package terpisah.
- PWA support belum ditemukan.
- Backend belum serve build frontend.

**Rencana implementasi yang disarankan:**

- Backend tetap menjadi process utama local production-ready.
- Backend melayani:
  - API di `/api/*`
  - WebSocket di `/ws`
  - Static frontend build di `/`
- Frontend dibuild menjadi output static atau standalone sesuai strategi Next.js.
- Tambahkan PWA:
  - `manifest.webmanifest`
  - service worker
  - icon sizes lengkap
  - offline shell minimal untuk halaman utama/status
- Satu command start:

```txt
npm run build
npm start
```

- Struktur profesional yang direkomendasikan:

```txt
apps/
  backend/
  frontend/
packages/
  shared/
docs/
```

atau tetap:

```txt
mwd-app-be/
mwd-app-fe/
docs/
```

dengan script root untuk build/start keduanya.

**Catatan keamanan one-package:**

- Jangan mengirim `.env` backend ke frontend.
- Hanya env `NEXT_PUBLIC_*` yang boleh diakses browser.
- Gateway key, JWT secret, DB URL, SMTP secret tetap server-only.

## 12. API Contract

Ringkasan endpoint berdasarkan `src/app.ts` dan `src/routes/*`.

| Method | Path | Fungsi | Auth |
| --- | --- | --- | --- |
| GET | `/` | Health/root API | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/logout` | Logout | No/Token optional behavior needs confirmation |
| GET | `/api/auth/me` | Current user | User JWT/cookie |
| GET | `/api/mwd-sessions` | List sessions/jobs | User JWT |
| POST | `/api/mwd-sessions` | Create session | Admin/engineer |
| GET | `/api/mwd-sessions/:id` | Session detail | User JWT |
| PUT | `/api/mwd-sessions/:id` | Update session | Admin/engineer |
| DELETE | `/api/mwd-sessions/:id` | Delete session | Admin/engineer |
| GET | `/api/mwd-data` | List MWD data, filter by query | User JWT |
| POST | `/api/mwd-data` | Create MWD data manual/raw | Admin/engineer |
| GET | `/api/mwd-data/:id` | Detail MWD data | User JWT |
| PUT | `/api/mwd-data/:id` | Update MWD data | Admin/engineer |
| DELETE | `/api/mwd-data/:id` | Delete MWD data | Admin/engineer |
| GET | `/api/mwd-data/edit/operations` | Edit operation history | User JWT |
| GET/POST | `/api/mwd-data/edit/move-depth` | Preview/apply move depth | Admin/engineer |
| GET/POST | `/api/mwd-data/edit/copy-depth` | Preview/apply copy depth | Admin/engineer |
| GET/POST | `/api/mwd-data/edit/rescale` | Preview/apply rescale | Admin/engineer |
| POST | `/api/mwd-data/edit/hide-range` | Hide depth range | Admin/engineer |
| POST | `/api/mwd-data/edit/unhide-range` | Unhide depth range | Admin/engineer |
| POST | `/api/mwd-data/edit/delete-depth-range` | Delete depth range | Admin/engineer |
| POST | `/api/gateway/mwd-data` | Hardware/gateway ingest | Gateway key/HMAC |
| GET | `/api/serial/ports` | List serial ports | Needs confirmation from route: no `authenticate` seen at route level |
| GET | `/api/serial/status` | Serial runtime status | Needs confirmation from route: no `authenticate` seen at route level |
| POST | `/api/serial/connect` | Connect serial gateway | Admin/engineer |
| POST | `/api/serial/disconnect` | Disconnect serial gateway | Admin/engineer |
| GET | `/api/esp-ws/status` | ESP WebSocket gateway status | Route auth needs confirmation |
| GET | `/api/wits-config` | List WITS config | Route auth needs confirmation |
| POST | `/api/wits-config` | Create WITS config | Admin/engineer |
| GET/PUT/DELETE | `/api/wits-config/:id` | Detail/update/delete WITS config | Mixed, write admin/engineer |
| GET | `/api/wits-data-values` | Query WITS value history | User JWT |
| GET | `/api/wits-alarms` | Query WITS alarms | User JWT |
| PUT | `/api/wits-alarms/:id/acknowledge` | Acknowledge alarm | Admin/engineer |
| PUT | `/api/wits-alarms/:id/resolve` | Resolve alarm | Admin/engineer |
| GET | `/api/wits-output/queue` | WITS output queue | Route auth needs confirmation |
| POST | `/api/wits-output/generate-from-latest` | Generate WITS output from latest | Admin/engineer |
| PUT | `/api/wits-output/:id/status` | Mark output status | Admin/engineer |
| GET | `/api/surveys` | List survey stations | User JWT |
| GET | `/api/surveys/trajectory` | Trajectory plot data | User JWT |
| POST | `/api/surveys` | Create survey station | Admin/engineer |
| POST | `/api/surveys/recalculate` | Recalculate survey | Admin/engineer |
| POST | `/api/surveys/from-mwd-data` | Import survey from MWD data | Admin/engineer |
| POST | `/api/surveys/well-plan/import-csv` | Import well plan CSV raw text | Admin/engineer |
| GET/PUT/DELETE | `/api/surveys/:id` | Detail/update/delete survey | Mixed, write admin/engineer |
| GET/PUT/POST/DELETE | `/api/survey-configs/:sessionId` | Get/upsert/delete survey config | Mixed, write admin/engineer |
| GET | `/api/plot-templates` | List plot templates | Route auth needs confirmation |
| GET | `/api/plot-templates/default` | Default plot template | Route auth needs confirmation |
| POST | `/api/plot-templates` | Create plot template | Admin/engineer |
| GET/PUT/DELETE | `/api/plot-templates/:id` | Detail/update/delete plot template | Mixed, write admin/engineer |
| POST | `/api/exports/historical` | Export historical data | Route auth needs confirmation |
| GET | `/api/exports/historical/last-24-hours` | Export last 24h | Route auth needs confirmation |
| POST | `/api/exports/wits` | Export WITS data | Route auth needs confirmation |
| POST | `/api/exports/surveys` | Export survey CSV | Route auth needs confirmation |
| POST | `/api/exports/las` | Export LAS | Route auth needs confirmation |
| POST | `/api/exports/pdf-plot` | Export PDF plot | Route auth needs confirmation |
| GET | `/api/exports/records` | Export records | Route auth needs confirmation |
| POST | `/api/exports/surveys/xlsx` | Export survey XLSX | Route auth needs confirmation |
| POST | `/api/exports/surveys/pdf` | Export survey PDF | Route auth needs confirmation |
| GET | `/api/historical-data` | Historical data query | Route auth needs confirmation |
| GET | `/api/depth-tracking/state` | Depth tracking state | Route auth needs confirmation |
| GET | `/api/depth-tracking/samples` | Depth tracking samples | Route auth needs confirmation |
| POST | `/api/depth-tracking/update` | Update depth tracking | Admin/engineer |
| POST | `/api/depth-tracking/recalculate` | Recalculate depth tracking | Admin/engineer |
| GET/POST/etc | `/api/memory-files` | Memory import/correlation | Mixed, write admin/engineer |
| GET/POST/etc | `/api/system-utilities/*` | Backup, restore, clear, config backup | Needs confirmation per route |
| GET/POST/etc | `/api/users`, `/api/roles` | Admin user/role management | Mixed, role route write admin |
| GET | `/api/audit-logs` | Audit logs | Route auth needs confirmation |
| GET/POST/etc | `/api/connection-status`, `/api/failover-events` | Connection/failover records | Mixed, write admin/engineer |
| GET | `/api/gateway-raw-packets` | Raw packet logs | Route auth needs confirmation |
| POST/GET | `/api/reports/email/*` | Email reports if enabled | Feature-flagged |

Request body ringkas:

- Login: `{ "identifier": "admin", "password": "..." }`
- Manual MWD: `{ "sessionId": 1, "measuredAt": "...", "depthMd": 1000, "inclination": 10, "azimuth": 200 }`
- Gateway ingest: `{ "sessionId": 1, "wits": { "0108": "1000.0", "0715": "200.0" } }`
- Raw WITS: `{ "sessionId": 1, "raw": "&&\n01081000.0\n0715200.0\n!!" }`
- Serial connect: `{ "path": "COM9", "baudRate": 115200, "sessionId": 1 }`

Response ringkas:

- Standard JSON `{ message, data }` atau `{ count, data }`.
- Export endpoints mengembalikan downloadable file response.
- BigInt dapat dikirim sebagai string; Decimal dapat dikirim sebagai string.

## 13. WebSocket Contract

**URL/path local:** `ws://localhost:5001/ws`.

**Production HTTPS:** `wss://<backend-domain>/ws`.

**Format message backend ke frontend:**

```json
{
  "event": "mwd-data",
  "payload": {},
  "timestamp": "2026-06-10T00:00:00.000Z"
}
```

Catatan: `broadcast()` menambahkan `timestamp` juga ke dalam payload.

**Events backend ke frontend:**

- `connected`: dikirim saat client connect.
- `pong`: response untuk `ping`.
- `mwd-data`: MWD row baru dari gateway/fusion.
- `connection-status`: status koneksi sistem.
- `esp-gateway-status`: status ESP WebSocket gateway.
- `gateway-raw-packet`: raw gateway packet.
- `wits-data`: WITS data update.
- `alert`: alarm/notifikasi.
- `error`: error message.

**Events frontend/gateway ke backend via WebSocket:**

- `ping`: backend membalas `pong`.
- `request-latest-data`: backend emit internal event `request-latest-data`, tetapi handler data terbaru perlu dikonfirmasi/ditambahkan.
- Event lain di-emit ke `websocketEventEmitter`.

**Contoh ping:**

```json
{
  "event": "ping",
  "payload": {}
}
```

**Contoh subscribe dari frontend saat ini:**

Frontend `realtime-client.ts` mengirim `{ "type": "subscribe", "sessionId": "1" }` dan `{ "type": "unsubscribe", "sessionId": "1" }`. Backend WebSocket service saat ini membaca `event` dari parsed message, bukan `type`, sehingga subscription ini belum terlihat ditangani khusus. Needs confirmation/fix jika session-level filtering dibutuhkan.

## 14. Serial Gateway Contract

**Sumber data serial:** COM port lokal dari ESP32/LoRa/serial gateway.

**Baud rate default:** `115200`.

**Port behavior:**

- Env boot: `SERIAL_GATEWAY_ENABLED=true`, `SERIAL_PORT=COM9` atau `auto`.
- API manual: `POST /api/serial/connect`.
- Runtime status: `GET /api/serial/status`.
- Disconnect: `POST /api/serial/disconnect`.

**Format data yang diharapkan:**

WITS block:

```txt
&&
01089545.00
0110945.00
0715234.89
071607.48
082478
!!
```

WITS pair/key-value:

```txt
0715=234.89
0108 9545.00
SEQ=12|RSSI=-58|SNR=12|0715=234.89|0824=78
```

JSON payload:

```json
{
  "sessionId": 1,
  "depthMd": 1000.5,
  "inclination": 7.48,
  "azimuth": 234.89,
  "gammaRay": 78
}
```

MWD key-value aliases:

```txt
depth=1000|inc=7.48|azi=234.89|gamma=78|temp=65|rop=12
```

**Auto port behavior:**

- `SERIAL_PORT=auto` memanggil `SerialPort.list()`.
- Port Bluetooth dihindari.
- Port non-Bluetooth pertama dipilih.
- Jika tidak ada port, status `reconnecting=true`, path `auto`, dan discovery diulang sesuai reconnect interval.

**Error handling:**

- Open/connect error disimpan di `runtimeStatus.lastError`.
- Status koneksi direkam ke `ConnectionStatus`.
- Port close memicu reconnect kecuali disconnect manual.
- Line tanpa payload MWD/WITS dihitung ignored.

## 15. Data Flow Example

Contoh alur end-to-end:

1. ESP32 menerima data MWD/WITS dari sensor atau LoRa.
2. ESP32 mengirim data ke PC backend melalui serial COM atau WebSocket.
3. Backend `serial-gateway.service.ts` atau `esp-websocket.service.ts` membaca raw packet.
4. Parser mendeteksi metadata `SEQ/RSSI/SNR` dan payload WITS/MWD.
5. Payload dinormalisasi menjadi `{ sessionId, measuredAt, wits, depthMd, inclination, azimuth, ... }`.
6. `gateway-fusion.service.ts` memilih kandidat terbaik jika serial dan websocket mengirim packet yang sama.
7. `gateway-ingest.service.ts` validasi session, parse measurement fields, dedup payload, sync timestamp/depth.
8. Backend menyimpan row ke `MWD_Data`, mencatat WITS values/alarms, raw packet log, dan depth tracking.
9. Backend broadcast event `mwd-data` ke `/ws`.
10. Frontend `realtime-client.ts` menerima event, update dashboard/charts/status real-time.

## 16. Important Context for Future GPT/Codex Sessions

- Project ini adalah sistem monitoring Measurement While Drilling berbasis web/PWA-plan dengan backend Express, frontend Next.js, PostgreSQL/Prisma, native WebSocket, serial gateway, dan ESP WebSocket gateway.
- Backend ada di `mwd-app-be`, frontend ada di `mwd-app-fe`.
- File yang harus dicek dulu saat mengubah backend: `src/server.ts`, `src/app.ts`, `src/services/websocket.service.ts`, `src/services/gateway-ingest.service.ts`, `src/services/gateway-fusion.service.ts`, `src/services/serial-gateway.service.ts`, `prisma/schema.prisma`.
- File yang harus dicek dulu saat mengubah frontend API/realtime: `lib/api-client.ts`, `lib/realtime-client.ts`, `context/AuthContext.tsx`, halaman terkait di `app/`.
- WebSocket sekarang native `ws` pada path `/ws`, attach ke HTTP server Express. Jangan membuat listener port WebSocket terpisah pada port yang sama.
- Jangan mengganti WITS menjadi WITSML kecuali user meminta eksplisit.
- Serial port hanya bekerja di local backend, bukan Vercel/serverless.
- PWA belum ditemukan. Jika diminta PWA, tambahkan manifest/service worker secara sadar dan pastikan env secret tidak bocor.
- Gateway HTTP menggunakan `GATEWAY_API_KEY` dan opsional HMAC. Jangan expose key di frontend.
- Data MWD utama adalah `MWD_Data`; WITS config adalah kamus; WITS data values adalah history nilai per WITS ID.
- `depthMd` biasanya Bit Depth/WITS `0108`; `hole_depth` biasanya Hole Depth/WITS `0110`.
- Seed membuat admin dan engineer default, bukan operator user default.
- Jaga sistem tetap production-ready, modular, rapi, dan sesuai pattern repository.
- Jangan melakukan refactor besar tanpa alasan. Perubahan sebaiknya scoped ke route/service/component yang relevan.

## 17. Recommended Next Tasks

**Prioritas tinggi:**

- Tambahkan `.env.example` untuk frontend berisi `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WS_URL`, dan health path opsional.
- Verifikasi route yang belum jelas auth-nya, terutama serial status/ports, exports, WITS config, plot templates, raw packet logs, dan system utilities.
- Sinkronkan kontrak frontend subscription WebSocket dengan backend. Saat ini frontend mengirim `type: subscribe`, backend membaca `event`.
- Tambahkan test minimal untuk gateway ingest, serial WITS parser, dan WebSocket ping.

**Prioritas sedang:**

- Implement PWA manifest/service worker jika target benar-benar PWA.
- Buat one-package local production script untuk build frontend dan serve dari backend.
- Tambahkan health endpoint eksplisit, misalnya `/health`, dengan database/gateway status ringkas.
- Perkuat UI serial port selection dengan mode manual/auto dan status RSSI/SNR.

**Task teknis opsional:**

- Tambahkan OpenAPI/Swagger generated dari route/schema.
- Tambahkan typed shared API contract antara frontend dan backend.
- Tambahkan structured logging untuk gateway ingest/fusion.
- Tambahkan integration test untuk ESP WebSocket gateway dengan mock WebSocket server.

**Dokumentasi/testing:**

- Update README root agar menjelaskan cara menjalankan backend, frontend, database, seed, dan env.
- Rapikan dokumentasi API lama agar tidak bertentangan dengan source.
- Dokumentasikan contoh payload hardware ESP32/LoRa yang final.
- Tambahkan checklist deployment lokal rig/server PC.

## File Penting yang Dianalisis

- `README.md`
- `mwd-app-be/package.json`
- `mwd-app-be/.env.example`
- `mwd-app-be/src/server.ts`
- `mwd-app-be/src/app.ts`
- `mwd-app-be/src/services/websocket.service.ts`
- `mwd-app-be/src/services/serial-gateway.service.ts`
- `mwd-app-be/src/services/esp-websocket.service.ts`
- `mwd-app-be/src/services/gateway-ingest.service.ts`
- `mwd-app-be/src/services/gateway-fusion.service.ts`
- `mwd-app-be/src/utils/serial-wits-parser.ts`
- `mwd-app-be/src/utils/request-schemas.ts`
- `mwd-app-be/src/middlewares/auth.middleware.ts`
- `mwd-app-be/src/middlewares/gateway.middleware.ts`
- `mwd-app-be/src/routes/*`
- `mwd-app-be/prisma/schema.prisma`
- `mwd-app-be/prisma/seed.js`
- `mwd-app-be/docs/NATIVE_WS_IMPLEMENTATION.md`
- `mwd-app-be/docs/FE_API_ENDPOINTS.md`
- `mwd-app-fe/package.json`
- `mwd-app-fe/next.config.ts`
- `mwd-app-fe/app/*`
- `mwd-app-fe/lib/api-client.ts`
- `mwd-app-fe/lib/realtime-client.ts`
- `mwd-app-fe/lib/*-api.ts`
- `mwd-app-fe/context/AuthContext.tsx`
- `mwd-app-fe/README.md`

## Bagian yang Perlu Konfirmasi

- Konfigurasi PWA belum ditemukan. Perlu konfirmasi apakah PWA sudah pernah dibuat di branch lain atau belum.
- Deployment satu-package belum ditemukan. Perlu keputusan apakah akan memakai Next.js standalone/static export atau tetap dua process.
- Beberapa route tidak ditelusuri controller-level auth-nya satu per satu; tabel API menandai bagian tersebut sebagai "Needs confirmation".
- Implementasi hardware failover Wi-Fi/LoRa fisik belum jelas. Source memiliki gateway fusion dan `FailoverEvent`, tetapi logic hardware failover eksternal perlu konfirmasi.
- Session-level WebSocket subscription belum sinkron antara frontend dan backend.
