# Product Requirements Document: MWD Monitoring App

Revisi terakhir: 2026-05-30

## Latest Audit Summary

Dokumen ini diperbarui setelah audit ulang codebase frontend, backend lokal, API client, AppContext, realtime WebSocket client, Dashboard, Rig WITS, Survey, Log Data, Plotting, Well Plot, Trajectory, Alerts, History, Export, System Utilities, dan Admin.

Sumber audit utama:

- `mwd-app-fe/.env.local`
- `mwd-app-fe/.env.example`
- `mwd-app-fe/lib/api-client.ts`
- `mwd-app-fe/lib/realtime-client.ts`
- `mwd-app-fe/context/AppContext.tsx`
- `mwd-app-fe/app/dashboard/page.tsx`
- `mwd-app-fe/app/monitoring/rig-wits/page.tsx`
- `mwd-app-fe/app/data-management/survey-data/page.tsx`
- `mwd-app-fe/app/data-management/log-data/page.tsx`
- `mwd-app-fe/app/data-management/plotting/page.tsx`
- `mwd-app-fe/components/well-plot-panel.tsx`
- `mwd-app-fe/app/trajectory/page.tsx`
- `mwd-app-fe/app/trajectory/well-plot/page.tsx`
- `mwd-app-fe/components/contents/trajectory/vertical-trajectory.tsx`
- `mwd-app-fe/app/alerts/page.tsx`
- `mwd-app-fe/app/history/page.tsx`
- `mwd-app-fe/app/export/page.tsx`
- `mwd-app-fe/app/system-utilities/page.tsx`
- `mwd-app-fe/components/contents/admin/admin-screen.tsx`
- `mwd-app-be/src/server.ts`
- `docs/MWD_FE_API_Routemap_Rapih.md`

Catatan penting: frontend sekarang sudah diarahkan ke backend production dan WebSocket production melalui environment variable. Namun backend lokal di folder `mwd-app-be` masih hanya menyediakan `GET /`, sehingga implementasi backend aktual diasumsikan berada di deployment/repo lain.

## Product Owner Requirement Verification

| Requirement / Change Item | Status | Evidence in Code | Notes |
|---|---:|---|---|
| REST backend memakai `https://be-mwd.vercel.app` | IMPLEMENTED | `mwd-app-fe/.env.local` dan `.env.example` berisi `NEXT_PUBLIC_API_BASE_URL=https://be-mwd.vercel.app`; `api-client.ts` memakai `NEXT_PUBLIC_API_BASE_URL`. | Base URL tidak hardcoded di client, tetapi sudah dikonfigurasi di env repo. |
| WebSocket memakai `wss://be-mwd-production.up.railway.app/ws` | IMPLEMENTED | `.env.local` dan `.env.example` berisi `NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws`; `realtime-client.ts` memakai `NEXT_PUBLIC_WS_URL`. | WebSocket URL env-driven. |
| Event WebSocket yang ditangani: `mwd-data`, `esp-gateway-status`, `connection-status` | IMPLEMENTED | `realtime-client.ts` mendefinisikan `RealtimeEventType`; `AppContext.tsx` menangani ketiga event pada `applyRealtimeEvent`. | Unknown event diabaikan. |
| Subscribe session dikirim setelah `activeSessionId` tersedia | IMPLEMENTED | `AppContext.tsx` memanggil `client.connect()` dan `client.subscribeSession(activeMwdSessionId)` hanya saat authenticated, token, dan `activeMwdSessionId` tersedia. | Client juga resend subscribe saat socket open jika session sudah tersimpan. |
| Mock runtime sudah dihapus | IMPLEMENTED | Audit `rg` pada `app`, `components`, `context`, dan `lib` tidak menemukan import mock/generateMock; AppContext state awal kosong/offline. | Folder `data` masih ada, tetapi tidak terlihat dipakai runtime utama. |
| Empty state muncul jika data backend kosong | IMPLEMENTED | Dashboard, Rig WITS, Trajectory, History, Plotting, Log Data, Alerts, Admin memiliki pesan `Belum ada...` atau empty card/table. | Empty state tersebar per modul. |
| Error state muncul jika backend gagal | IMPLEMENTED | Banyak modul menggunakan `Gagal memuat data dari backend.` dan error state lokal. | Beberapa error masih berupa toast saja untuk action tertentu. |
| KPI dashboard tetap muncul walaupun value kosong | IMPLEMENTED | Dashboard hanya block jika startup error/no session; `hasNoMwdData` menampilkan alert, lalu key parameter cards menampilkan `-` dari `keyParameters`. AppContext memakai `buildEmptyKpiData()`. | KPI/key parameter cards tetap render ketika session ada tetapi MWD data kosong. |
| Rig WITS hanya menampilkan Received Data dan Output Queue | IMPLEMENTED | `app/monitoring/rig-wits/page.tsx` hanya merender dua `PacketPanel`: `Received Data` dan `Output Queue`. | UI serial/raw debug lama sudah tidak ada di page ini. |
| Received Data dan Output Queue tampil 2 kolom pada desktop | IMPLEMENTED | Rig WITS memakai `grid grid-cols-1 ... lg:grid-cols-2`. | Mobile tetap satu kolom. |
| Well Plot mendukung multi-track atau navigation | IMPLEMENTED | `well-plot-panel.tsx` memiliki `TrackWindowControls`, `PlotTabs`, `showAllTracks`, `maxVisibleTracks`, `responsiveTrackWindow`; `trajectory/well-plot/page.tsx` memakai `showAllTracks maxVisibleTracks={4} responsiveTrackWindow`. | Multi-track/window navigation tersedia. |
| Vertical Section tidak overflow dan tetap depth-down | IMPLEMENTED | `vertical-trajectory.tsx` memakai `normalizeTvd` untuk TVD negatif menjadi absolut, `scaleY` depth-down, `overflow-hidden`, `clipPath`, dan clamp label. | Code-level implemented; visual regression tetap disarankan untuk data ekstrem. |
| Legend Planned Path dan Actual Path tidak overlap | IMPLEMENTED | `trajectory/page.tsx` menempatkan legend di luar `ResponsiveContainer` dengan `flex flex-wrap`, `justify-center`, `gap-x-6`, dan `whitespace-nowrap`. | Code-level implemented; visual screenshot tetap disarankan. |
| Rig WITS Received Data memakai `/api/mwd-data` | IMPLEMENTED | `app/monitoring/rig-wits/page.tsx` memanggil `getMwdData(token, { sessionId, limit: 50 })` dan menampilkan source badge `/api/mwd-data`. | Empty state: `Belum ada received data untuk session ini.` |
| Historical export mendukung date range dan depth range | FRONTEND IMPLEMENTED / NEEDS BACKEND VERIFICATION | `app/export/page.tsx` dan `app/history/page.tsx` membangun payload `measuredFrom`, `measuredTo`, `depthMin`, `depthMax` hanya saat field diisi. | Backend production perlu diverifikasi untuk AND filtering. |
| Manual serial connect/disconnect tidak menjadi kontrol FE | IMPLEMENTED | Audit UI utama tidak menemukan tombol serial connect/disconnect; dashboard/system health hanya menampilkan status serial/backend. | `serial-api.ts` masih punya client function, tetapi tidak dipakai sebagai kontrol UI utama. |
| ESP raw packet stream | FRONTEND READY / BACKEND GAP IF ABSENT | `esp-ws-api.ts`, `AppContext.tsx`, dan `system-health-panel.tsx` membaca/menampilkan raw packet fields jika dikirim backend. | Jika payload tidak menyediakan raw packet, UI menampilkan `ESP raw packet stream belum tersedia dari backend.` |
| Survey VS azimuth default 90 intentional | IMPLEMENTED | `lib/survey-defaults.ts` mendefinisikan `DEFAULT_VERTICAL_SECTION_AZIMUTH = 90`; Survey dan Well Plan import CSV memakai constant. | Tidak diubah menjadi session-level config. |
| Admin audit logs tidak memakai mock | IMPLEMENTED / BLOCKED BY BACKEND | Admin Audit tab menampilkan `Audit logs API belum tersedia.` | Endpoint audit logs masih planned. |

## Change Log Table

| Module / Feature | Previous Status | Current Status | What Changed | Notes |
|---|---:|---:|---|---|
| Environment configuration | Needs Clarification | IMPLEMENTED | REST dan WebSocket production URL sudah ada di `.env.local` dan `.env.example`. | Backend lokal repo tetap minimal. |
| Realtime WebSocket | Needs Clarification | IMPLEMENTED | `realtime-client.ts` ditambahkan/terpakai; AppContext consume event `mwd-data`, `esp-gateway-status`, `connection-status`. | Belum ada UI dedicated WebSocket log. |
| AppContext runtime data | Partial / mock fallback | IMPLEMENTED | State runtime utama kosong/offline dan data berasal dari REST/WebSocket. | Polling REST masih ada sebagai fallback/refresh. |
| Dashboard empty/error/KPI | Partial | IMPLEMENTED | Empty/no-data alert dan KPI cards dengan value `-` tersedia. | Dashboard tetap block untuk startup error atau no session. |
| Rig WITS | Partial / serial-heavy | UPDATED / BACKEND-DRIVEN | UI disederhanakan menjadi Received Data dan Output Queue. Received Data memakai `/api/mwd-data`; Output Queue memakai `/api/wits-output/*`. | Empty/error state tetap dipakai jika backend kosong/gagal. |
| WITS Output Queue | In Progress | IMPLEMENTED as FE integration | Client `wits-output-api.ts` memakai queue, generate-from-latest, update status. | Perlu backend runtime untuk validasi end-to-end. |
| Serial status | Partial | IMPLEMENTED as status-only | Serial status masih ada di AppContext/Dashboard/System Health via `/api/serial/status`, tetapi FE tidak menyediakan manual serial connect/disconnect control. | Serial lifecycle dikelola backend/system. |
| ESP gateway status | Partial | UPDATED / FRONTEND READY | REST `/api/esp-ws/status` dan realtime `esp-gateway-status` update AppContext. UI System Health menampilkan raw packet jika payload backend mengirim field raw/payload/packet. | Jika payload backend tidak menyediakan raw packet, UI menampilkan backend gap. |
| Well Plot | Partial | IMPLEMENTED / UPDATED | Multi-track/window navigation dan responsive track count ada. | Bergantung pada plot template dan MWD data backend. |
| Vertical trajectory | Partial | IMPLEMENTED / UPDATED | Depth-down normalization dan label clamp ada. | Visual regression masih direkomendasikan. |
| Survey Data | Partial | IMPLEMENTED as FE integration | Actual survey CRUD, projection save, generate from MWD, recalculate, import plan CSV, export survey memakai backend client. | `verticalSectionAzimuth` memakai intentional default constant `DEFAULT_VERTICAL_SECTION_AZIMUTH = 90`. |
| Log Data | Partial | UPDATED / PARTIAL | MWD/WITS data dan edit tools backend-driven. Import/memory flow dirapikan: CSV/LAS import menampilkan backend-unavailable state, memory import diarahkan ke workflow `/data-management/memory-import`. | Batch settings/export masih perlu endpoint backend. |
| Plotting | Partial | PARTIAL | Template CRUD, preview MWD data by depth range, PDF export sudah backend-driven. | Beberapa upload/template-file action masih placeholder. |
| Trajectory | Partial | PARTIAL | Actual/plan surveys dari backend; plan view legend diperbaiki; vertical section diperbaiki. | Snapshot/export/3D masih BLOCKED BY BACKEND karena UI menyatakan endpoint belum tersedia. |
| Alerts | Partial | PARTIAL | Alerts memakai events dari AppContext/WITS alarms; acknowledge/resolve terhubung untuk backend WITS alarms. | Resolved 24h label berasal dari current state, bukan history endpoint khusus. |
| History | Partial | FRONTEND IMPLEMENTED / NEEDS BACKEND VERIFICATION | Historical data load dan export memakai date range + depth range payload. | Perlu backend verification untuk support `measuredFrom/measuredTo/depthMin/depthMax` dan AND filtering. |
| Export | Partial | FRONTEND IMPLEMENTED / NEEDS BACKEND VERIFICATION | Historical export UI/payload sekarang mendukung date range dan depth range. | Empty filter fields tidak dikirim; response diproses sebagai blob/file. |
| System Utilities | Partial | PARTIAL | Admin-only, backup/clear/restore/config utilities memakai API client. | System Info tidak lagi menampilkan data statis; diagnostics tetap BLOCKED BY BACKEND. |
| Admin | Partial | PARTIAL | Users/roles backend-driven; system health memakai panel troubleshooting; audit logs menampilkan unavailable state. | Audit logs PLANNED / BLOCKED BY BACKEND; user/role integration bergantung backend production. |

## 1. Document Overview

**Nama sistem:** MWD Monitoring App / MWD Monitor

**Tujuan dokumen:**

Mendokumentasikan kebutuhan produk berdasarkan kondisi aktual implementasi terbaru, termasuk pembaruan requirement dari product owner, integrasi REST/WebSocket yang benar-benar terlihat di frontend, dan fitur yang masih partial, placeholder, atau mismatch.

**Ruang lingkup:**

- Frontend monitoring, data management, plotting, trajectory, export, utilities, dan admin.
- API client frontend dan kontrak endpoint yang dipakai.
- Realtime WebSocket client dan event yang diproses.
- Backend lokal hanya sebagai pembanding status repository, bukan source of truth endpoint production.

**Audience utama:**

- Product owner.
- Frontend engineer.
- Backend engineer.
- QA engineer.
- Operator/engineer domain MWD.

## 2. Product Overview

MWD Monitoring App adalah aplikasi web untuk memonitor operasi Measurement While Drilling berbasis session/job. Sistem menggabungkan data MWD realtime, status gateway, WITS configuration, WITS output queue, survey, log data, plotting, trajectory, historical data, export, system utilities, dan admin user management.

Sistem saat ini bersifat frontend-integrated terhadap backend production melalui REST dan WebSocket:

- REST base URL: `https://be-mwd.vercel.app`.
- WebSocket URL: `wss://be-mwd-production.up.railway.app/ws`.
- REST dipakai untuk data session, MWD data, WITS config/value/alarm, output queue, survey, plot templates, exports, utilities, users, dan roles.
- WebSocket dipakai untuk event `mwd-data`, `esp-gateway-status`, dan `connection-status`.

Masalah utama yang diselesaikan:

- Menampilkan status operasional MWD dan KPI walaupun data belum tersedia penuh.
- Menghubungkan session/job dengan data MWD, WITS values, output queue, survey, plot, dan export.
- Memberikan workflow engineer/admin untuk edit, generate, recalculate, export, dan utility.
- Memberikan empty/error state yang jujur saat backend kosong/gagal.

## 3. Product Goals

**Goal utama:**

- Menyediakan workspace monitoring dan data management untuk operasi MWD berbasis backend production dan realtime WebSocket.

**Goal operasional:**

- Operator dapat memantau dashboard, alarm, trajectory, history, dan status data.
- Engineer dapat mengelola WITS config, survey, log data, plot, export, dan WITS output queue.
- Admin dapat mengelola user/role dan menjalankan system utilities.

**Goal teknis:**

- REST dan WebSocket harus env-driven dan dapat diarahkan ke production backend.
- AppContext harus menjadi orchestration layer untuk REST polling, active session, dan realtime events.
- Data runtime tidak boleh bergantung pada mock.
- Empty/error state harus muncul saat backend kosong atau gagal.

## 4. Users and Roles

| Role | Tanggung Jawab | Fitur yang Diakses | Batasan |
|---|---|---|---|
| Operator | Monitoring dan awareness | Dashboard, Alerts, Trajectory, History, read-only monitoring | Tidak boleh melakukan edit/config/destructive action. |
| Engineer | Konfigurasi dan koreksi data | WITS Config, Survey, Log Data, Plotting, Export, WITS Output Queue | Tidak boleh mengakses admin-only system/user utilities. |
| Admin | Administrasi dan utility berisiko | Admin Panel, System Utilities, semua workflow engineer/operator | Audit logs masih placeholder. |

## 5. Core Product Scope

### 5.1 Environment and API Layer

**Status:** IMPLEMENTED.

Frontend memakai `NEXT_PUBLIC_API_BASE_URL=https://be-mwd.vercel.app` untuk REST dan `NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws` untuk WebSocket. API request terpusat di `api-client.ts` dan menambahkan bearer token jika tersedia.

### 5.2 Realtime WebSocket

**Status:** IMPLEMENTED.

`realtime-client.ts` membuka WebSocket, reconnect dengan exponential backoff, memfilter event yang dikenal, dan mengirim subscribe/unsubscribe per session. AppContext memproses:

- `mwd-data`: normalisasi record, update latest MWD data dan chart.
- `esp-gateway-status`: update ESP gateway status.
- `connection-status`: update connection state dan event list.

### 5.3 Authentication and Session

**Status:** IMPLEMENTED as frontend integration.

Auth memakai backend token dan session/job dimuat dari `/api/mwd-sessions`. Active session disimpan di local storage dan menjadi konteks untuk REST polling dan WebSocket subscription.

### 5.4 Dashboard

**Status:** IMPLEMENTED / BACKEND-DRIVEN.

Dashboard membaca AppContext untuk session, MWD data, WITS config/value/alarm, connection status, failover, serial status, ESP status, realtime status, depth tracking, dan plot overview.

Dashboard behavior:

- Startup error atau no session menampilkan blocking state.
- Session aktif tetapi data MWD kosong menampilkan alert dan tetap menampilkan KPI/key parameter cards dengan value `-`.
- Backend failure menampilkan badge/error state.
- Realtime status tampil bersama DTS, Serial, dan ESP WS.

### 5.5 Rig WITS

**Status:** UPDATED / PARTIAL.

Rig WITS terbaru hanya menampilkan dua panel:

- Received Data.
- Output Queue.

Layout desktop memakai dua kolom (`lg:grid-cols-2`). Output Queue backend-driven melalui:

- `GET /api/wits-output/queue`
- `POST /api/wits-output/generate-from-latest`
- `PUT /api/wits-output/:id/status`

Received Data backend-driven melalui:

- `GET /api/mwd-data?sessionId=<activeSessionId>`

Flow yang disepakati: raw/WITS data masuk ke backend, backend membaca mapping `/api/wits-config`, backend menerjemahkan WITS ID menjadi field MWD, data disimpan sebagai MWD Data, lalu frontend menampilkan hasil translasi dari `/api/mwd-data`.

### 5.6 WITS Config and WITS Values

**Status:** PARTIAL / BACKEND-DRIVEN.

WITS Config dipakai sebagai metadata label, unit, scale, alarm, source, dan plotting. WITS Values dipakai untuk raw/debug value per WITS ID. AppContext dan Log Data menggunakan endpoint WITS.

### 5.7 Alerts

**Status:** PARTIAL.

Alerts memakai `events` dari AppContext dan WITS alarms backend. Acknowledge/resolve diarahkan ke backend hanya jika event berasal dari backend WITS alarm. Empty/error state tersedia.

### 5.8 Survey Data

**Status:** IMPLEMENTED as frontend integration.

Survey page memakai backend untuk:

- Load actual surveys.
- Create survey.
- Store projection as actual survey.
- Get survey detail.
- Update survey.
- Delete survey.
- Generate survey from MWD data.
- Recalculate survey.
- Import plan CSV.
- Export actual surveys CSV.

Catatan: `verticalSectionAzimuth` memakai `DEFAULT_VERTICAL_SECTION_AZIMUTH = 90` sebagai intentional default untuk current drilling vertical view scope. Nilai ini belum menjadi session-level config karena keputusan product owner menyatakan scope saat ini cukup memakai default 90.

### 5.9 Log Data

**Status:** PARTIAL.

Log Data memakai backend untuk:

- `/api/mwd-data`
- `/api/wits-config`
- `/api/wits-data-values`
- `/api/mwd-data/edit/operations`
- `/api/mwd-data/edit/hide-range`
- `/api/mwd-data/edit/unhide-range`
- `/api/mwd-data/edit/delete-depth-range`
- `/api/mwd-data/edit/move-depth`
- `/api/mwd-data/edit/copy-depth`
- `/api/mwd-data/edit/rescale`

Masih partial/backend-blocked:

- CSV/LAS import endpoint belum tersedia; UI menampilkan unavailable state dan tidak membuat local runtime rows.
- Batch settings editor.
- Beberapa export/log action.
- Memory import/correlation diarahkan ke dedicated workflow `/data-management/memory-import` yang memakai `/api/memory-files/*`; panel Log Data tidak lagi menjalankan local-only import/correlation/copy-depth mutation.

### 5.10 Plotting

**Status:** PARTIAL.

Plotting memakai backend untuk plot template CRUD, plot template detail, MWD data preview by depth range, dan PDF export. Empty state untuk no WITS config, no template, no data, dan backend error tersedia.

Masih partial/placeholder:

- Upload template/file metadata action.
- Beberapa action asset/template file.
- Detail template bisa metadata-only dan frontend fallback ke local config.

### 5.11 Well Plot

**Status:** IMPLEMENTED / UPDATED.

Well Plot mendukung:

- Render track dari selected plot template.
- Single-track navigation via tabs/buttons.
- Multi-track render via `showAllTracks`.
- Responsive track window via `TrackWindowControls`.
- Previous/Next dan page navigation untuk track window.
- Empty state untuk no plot template, loading, error, atau no MWD data.

### 5.12 Trajectory

**Status:** PARTIAL / UPDATED.

Trajectory memuat actual dan plan survey dari backend dan menampilkan:

- Metric cards.
- Vertical Section.
- Plan View.
- Planned/Actual legend yang ditempatkan di luar chart dan memakai flex wrap.

Vertical Section sudah memperbaiki:

- TVD negatif dinormalisasi menjadi depth-down absolut.
- SVG clipping dan overflow hidden.
- Label coordinate clamp.

Masih BLOCKED BY BACKEND / placeholder:

- Snapshot.
- Export.
- 3D visualization.

### 5.13 History

**Status:** PARTIAL.

History memakai `/api/historical-data` dengan `sessionId`, `measuredFrom`, `measuredTo`, `depthMin`, dan `depthMax`. Frontend juga memfilter hasil berdasarkan session/date range. Empty/error state tersedia.

History export sekarang mengirim filter yang diisi user ke `/api/exports/historical`. Jika date range dan depth range sama-sama diisi, backend harus menerapkan filter gabungan dengan logic AND.

### 5.14 Export

**Status:** PARTIAL.

Export page memiliki UI date range, depth range, dan format CSV/JSON. Payload export historical mengirim field yang diisi user:

- `sessionId`
- `format`
- `measuredFrom`
- `measuredTo`
- `depthMin`
- `depthMax`

Field kosong tidak dikirim. Response tetap diproses sebagai blob/file. Jika backend belum mendukung filter tersebut, frontend menampilkan error backend tanpa fallback dummy export.

### 5.15 System Utilities

**Status:** PARTIAL.

System Utilities restricted untuk admin. Backend-driven untuk backup, restore, clear data, config backup/restore sesuai API client. Setelah mutation, frontend refresh MWD data, sessions, WITS alarms, WITS data values, actual surveys, dan plan surveys.

Masih backend-blocked/unavailable:

- System info / diagnostics endpoints.
- Action yang menampilkan `Endpoint backend untuk fitur ini belum tersedia.`

### 5.16 Admin

**Status:** PARTIAL.

Admin Panel memakai backend untuk:

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/roles`

Audit logs masih PLANNED / BLOCKED BY BACKEND karena UI menampilkan `Audit logs API belum tersedia.` System health sekarang memakai `SystemHealthPanel` dan menampilkan raw ESP packet jika field tersebut dikirim backend.

## 6. Functional Requirements

| ID | Requirement | Status | Actor | Input | Output | Dependency |
|---|---|---:|---|---|---|---|
| FR-01 | Sistem harus memakai REST backend production dari env. | IMPLEMENTED | All | `NEXT_PUBLIC_API_BASE_URL` | REST request ke backend | `api-client.ts` |
| FR-02 | Sistem harus memakai WebSocket production dari env. | IMPLEMENTED | All | `NEXT_PUBLIC_WS_URL` | WebSocket connection | `realtime-client.ts` |
| FR-03 | Sistem harus subscribe WebSocket per active session. | IMPLEMENTED | All | `activeMwdSessionId` | Subscribe message | WebSocket |
| FR-04 | Sistem harus memproses realtime MWD data. | IMPLEMENTED | All | `mwd-data` event | Latest data/chart update | WebSocket event |
| FR-05 | Sistem harus memproses realtime ESP gateway status. | IMPLEMENTED | All | `esp-gateway-status` event | ESP status update | WebSocket event |
| FR-06 | Sistem harus memproses realtime connection status. | IMPLEMENTED | All | `connection-status` event | Connection state/event update | WebSocket event |
| FR-07 | Dashboard harus menampilkan KPI cards walaupun data kosong. | IMPLEMENTED | All | Empty MWD data | KPI cards with `-` | AppContext/Dashboard |
| FR-08 | Dashboard harus menampilkan backend error state. | IMPLEMENTED | All | Failed API call | Error badge/card | REST clients |
| FR-09 | Dashboard harus menampilkan no-data state. | IMPLEMENTED | All | Empty MWD records | No-data alert | `/api/mwd-data` |
| FR-10 | Rig WITS harus menampilkan Received Data dan Output Queue saja. | IMPLEMENTED | Operator, Engineer | Session state | Two-panel UI | Rig WITS page |
| FR-11 | Rig WITS Output Queue harus memuat queue dari backend. | IMPLEMENTED as FE integration | Engineer, Admin | `sessionId`, status filter | Queue list | `/api/wits-output/queue` |
| FR-12 | Engineer/Admin dapat generate WITS output dari latest data. | IMPLEMENTED as FE integration | Engineer, Admin | `sessionId` | New queue item | `/api/wits-output/generate-from-latest` |
| FR-13 | Engineer/Admin dapat update queue status. | IMPLEMENTED as FE integration | Engineer, Admin | Queue ID, status | Updated queue item | `/api/wits-output/:id/status` |
| FR-14 | Received Data harus dimuat dari `/api/mwd-data?sessionId=<activeSessionId>`. | IMPLEMENTED | All | `sessionId` | Received Data hasil translasi backend | `/api/mwd-data` |
| FR-15 | Received Data harus menampilkan empty state jika backend kosong. | IMPLEMENTED | All | Empty MWD data response | `Belum ada received data untuk session ini.` | Rig WITS page |
| FR-16 | Survey actual harus dimuat dari backend. | IMPLEMENTED as FE integration | Engineer, Admin | `sessionId`, `stationType=actual` | Survey rows | `/api/surveys` |
| FR-17 | Survey create/update/delete harus memakai backend. | IMPLEMENTED as FE integration | Engineer, Admin | Survey payload | Saved/deleted row | `/api/surveys` |
| FR-18 | Projection survey harus disimpan ke backend. | IMPLEMENTED as FE integration | Engineer, Admin | Projection payload | Saved survey | `/api/surveys` |
| FR-19 | Generate survey from MWD harus memakai backend. | IMPLEMENTED as FE integration | Engineer, Admin | `sessionId`, `verticalSectionAzimuth=90` | Generated surveys | `/api/surveys/from-mwd-data` |
| FR-20 | Recalculate survey harus memakai backend. | IMPLEMENTED as FE integration | Engineer, Admin | `sessionId`, station type, VS azimuth | Recalculated surveys | `/api/surveys/recalculate` |
| FR-21 | Default vertical section azimuth harus intentional constant 90. | IMPLEMENTED | Engineer, Admin | Survey generation/recalculate/import | Payload memakai default 90 | `DEFAULT_VERTICAL_SECTION_AZIMUTH` |
| FR-22 | Log Data edit tools harus preview/apply melalui backend. | IMPLEMENTED as FE integration | Engineer, Admin | Depth/action payload | Preview/apply result | `/api/mwd-data/edit/*` |
| FR-23 | Log Data import CSV/LAS harus jelas sebagai backend-unavailable sampai endpoint tersedia. | UPDATED / BLOCKED BY BACKEND | Engineer, Admin | File review only | Unavailable state, no local runtime mutation | CSV/LAS import endpoint pending |
| FR-24 | Log Data memory import harus diarahkan ke backend memory workflow. | UPDATED | Engineer, Admin | Active WITS context | Navigation to `/data-management/memory-import` | `/api/memory-files/*` |
| FR-25 | Well Plot harus mendukung multi-track/window navigation. | IMPLEMENTED | All | Plot template tracks | Track tabs/window controls | `well-plot-panel.tsx` |
| FR-26 | Vertical trajectory harus render depth-down. | IMPLEMENTED | All | Survey TVD | Depth-down SVG | `vertical-trajectory.tsx` |
| FR-27 | Plan View legend tidak boleh overlap dengan chart. | IMPLEMENTED | All | Planned/actual data | Legend outside chart | `trajectory/page.tsx` |
| FR-28 | Historical data load harus memakai backend date/depth filters. | IMPLEMENTED as FE integration | All | `sessionId`, measured range, depth range | Historical chart data | `/api/historical-data` |
| FR-29 | Historical export harus mendukung date range dan depth range. | FRONTEND IMPLEMENTED / NEEDS BACKEND VERIFICATION | Engineer, Admin | `measuredFrom`, `measuredTo`, `depthMin`, `depthMax`, `format` | Filtered blob/file export | `/api/exports/historical` |
| FR-30 | Serial lifecycle tidak boleh dikontrol manual dari FE. | IMPLEMENTED | All | Backend/system state | Status only | `/api/serial/status`, connection state |
| FR-31 | ESP raw packet stream harus ditampilkan jika payload/backend menyediakan. | FRONTEND READY / BACKEND GAP IF ABSENT | Admin, Engineer | `esp-gateway-status` raw fields | Read-only raw packet/debug view or unavailable state | WebSocket/ESP payload |
| FR-32 | Admin user management harus memakai backend. | IMPLEMENTED as FE integration | Admin | User payload | User list/action result | `/api/users` |
| FR-33 | Admin audit logs harus menampilkan unavailable state sampai API tersedia. | PLANNED / BLOCKED BY BACKEND | Admin | N/A | `Audit logs API belum tersedia.` | Audit logs API pending |
| FR-34 | System Utilities harus dibatasi untuk admin. | IMPLEMENTED | Admin | Role | Restricted page/actions | Auth role |
| FR-35 | Runtime mock data tidak boleh dipakai sebagai data aktual. | IMPLEMENTED | All | Runtime app | Backend/empty state | App/context audit |

## 7. Non-Functional Requirements

| ID | Requirement | Status | Description |
|---|---|---:|---|
| NFR-01 | Backend-driven runtime | IMPLEMENTED | Runtime utama menggunakan REST/WebSocket, bukan mock. |
| NFR-02 | Realtime readiness | IMPLEMENTED | WebSocket reconnect dan session subscribe tersedia. |
| NFR-03 | Empty-state transparency | IMPLEMENTED | Data kosong tidak diganti dengan data palsu. |
| NFR-04 | Error-state transparency | IMPLEMENTED | Backend failure ditampilkan dengan pesan error. |
| NFR-05 | Role-based access | PARTIAL | UI membatasi action; backend authorization tetap harus memastikan. |
| NFR-06 | Data safety | IMPLEMENTED / PARTIAL | Banyak action destructive memakai confirm; perlu audit backend. |
| NFR-07 | Visual robustness | REQUIRED / NEEDS VERIFICATION | Screenshot regression tetap diperlukan untuk Dashboard, Rig WITS, Well Plot, Trajectory/Vertical Section, dan Export karena layout/chart correctness tidak cukup diverifikasi oleh lint/build. |
| NFR-08 | Maintainability | IMPLEMENTED | API client dipisah per domain. |
| NFR-09 | Performance | PARTIAL | Banyak endpoint memakai session/depth/date/limit, tetapi rendering data besar tetap perlu profiling. |

## 8. Data and Integration Requirements

| Data / Integration | Frontend Usage | Endpoint / Client | Status |
|---|---|---|---:|
| REST API base | Semua API client | `NEXT_PUBLIC_API_BASE_URL=https://be-mwd.vercel.app` | IMPLEMENTED |
| WebSocket realtime | AppContext | `NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws` | IMPLEMENTED |
| MWD sessions | Active session | `/api/mwd-sessions` | IMPLEMENTED as FE integration |
| MWD data | Dashboard, Rig WITS Received Data, Plot, Log, History | `/api/mwd-data`, `/api/historical-data` | IMPLEMENTED as FE integration |
| WITS config | Config, Log, Plot, Dashboard | `/api/wits-config` | PARTIAL |
| WITS values | Log/debug | `/api/wits-data-values` | PARTIAL |
| WITS alarms | Alerts/AppContext | `/api/wits-alarms` | PARTIAL |
| WITS output queue | Rig WITS | `/api/wits-output/*` | IMPLEMENTED as FE integration |
| Surveys | Survey/Trajectory | `/api/surveys`, `/api/surveys/from-mwd-data`, `/api/surveys/recalculate` | IMPLEMENTED as FE integration |
| Plot templates | Plotting/Well Plot | `/api/plot-templates` | PARTIAL |
| Exports | Export/Survey/Plot | `/api/exports/*` | PARTIAL |
| System utilities | Admin utilities | `/api/system-utilities/*` | PARTIAL |
| Users/Roles | Admin | `/api/users`, `/api/roles` | PARTIAL |
| Local backend repo | Development placeholder | `mwd-app-be/src/server.ts` only `GET /` | NOT IMPLEMENTED for production API |

## 9. Workflow Requirements

### 9.1 Startup and Session

1. User login.
2. Frontend loads user/session context.
3. Active session is stored in local storage.
4. REST data loaders run for active session.
5. Realtime client connects and subscribes to active session.

### 9.2 Realtime Monitoring

1. WebSocket receives `mwd-data`.
2. AppContext normalizes the record and updates chart/latest values.
3. WebSocket receives `esp-gateway-status`.
4. AppContext updates ESP gateway status.
5. WebSocket receives `connection-status`.
6. AppContext updates connection state and event stream.

### 9.3 Dashboard No-Data Handling

1. If startup fails, dashboard shows backend error block.
2. If no session exists, dashboard asks user to create/select session.
3. If session exists but MWD data is empty, dashboard shows no-data alert and still renders KPI cards.

### 9.4 Rig WITS Received Data and Output Queue

1. User opens Rig WITS.
2. Frontend loads Received Data from `GET /api/mwd-data?sessionId=<activeSessionId>`.
3. Frontend loads Output Queue from `GET /api/wits-output/queue?sessionId=<activeSessionId>`.
4. If Received Data is empty, UI shows `Belum ada received data untuk session ini.`
5. If Output Queue is empty, UI shows `Belum ada output queue untuk session ini.`
6. Engineer/Admin can generate output from latest MWD data.
7. Engineer/Admin can mark queue item as sent/skipped.

### 9.5 Survey and Trajectory

1. Survey Data loads actual survey rows.
2. Engineer/Admin creates/updates/deletes survey rows.
3. Generate from MWD and recalculate call backend endpoints.
4. Trajectory loads actual and plan surveys.
5. Vertical and plan views render from backend survey records.

### 9.6 Plotting and Well Plot

1. Plotting loads templates and WITS config.
2. Engineer/Admin edits and saves templates.
3. Preview loads MWD data by depth range.
4. Well Plot renders selected template tracks.
5. Multi-track window navigation controls visible track count.
6. PDF export requires backend export endpoint and preview data.

### 9.7 History and Export

1. History loads historical data with date range and depth range filters when provided.
2. History export sends only filled filters to `/api/exports/historical`.
3. Export page historical export supports `measuredFrom`, `measuredTo`, `depthMin`, `depthMax`, and `format`.
4. If date range and depth range are both provided, backend is expected to apply AND filtering.
5. Export response is processed as blob/file.
6. If backend rejects unsupported filters, frontend surfaces the backend error without dummy export fallback.

## 10. UI/UX Requirements

- Dashboard must show operational status without substituting mock data.
- KPI cards must remain visible when values are missing.
- Rig WITS must stay focused on Received Data and Output Queue.
- Received Data and Output Queue must render one column on mobile and two columns on desktop.
- Output Queue must expose status filter, refresh, and role-gated generate/update actions.
- Well Plot must support multi-track navigation for dense templates.
- Vertical Section must render depth-down and prevent label/SVG overflow.
- Plan View legend must be outside chart area and non-overlapping.
- Empty/error states must use clear operational language.
- Placeholder actions must explicitly say endpoint/backend is unavailable.

## 11. Risks / Constraints / Dependencies

- Backend production is referenced by env, but backend implementation is not present in local `mwd-app-be`.
- Historical export date/depth payload is implemented in frontend, but backend support for `measuredFrom`, `measuredTo`, `depthMin`, and `depthMax` still needs runtime verification.
- ESP raw packet stream is frontend-ready, but depends on backend sending raw packet fields in `esp-gateway-status` or a future endpoint/event.
- Snapshot/export/3D trajectory remain placeholder.
- Log Data CSV/LAS import remains backend-blocked; Log Data memory flow routes to backend memory workflow instead of local-only mutation.
- Admin audit logs remain PLANNED / BLOCKED BY BACKEND.
- System Info diagnostics remain backend-blocked and must not use static simulated diagnostics.
- Visual fixes for trajectory, legend, Well Plot tracks, Rig WITS layout, Dashboard compact status, and Export filters should still be verified with screenshots across viewport sizes.
- Role restrictions in frontend must be backed by backend authorization.

## 12. Out of Scope

Current scope does not include:

- Local backend implementation of all production API endpoints in `mwd-app-be`.
- Manual serial connect/disconnect control from browser UI.
- Physical serial device write from browser UI.
- ESP raw packet stream backend/API implementation when backend does not provide raw packet fields.
- 3D trajectory viewer.
- Trajectory snapshot/export backend integration.
- Admin audit logs implementation until audit logs API is available.
- Backend-side implementation of historical export filters if production backend does not yet accept the updated payload.

## 13. Open Questions / Needs Clarification

| Area | Status | Clarification / Decision |
|---|---:|---|
| Backend source repo | RESOLVED | Frontend uses the backend URL from environment as the source of truth. Local `mwd-app-be` is not used as the main backend source. |
| Rig WITS Received Data | RESOLVED | Received Data is sourced from `/api/mwd-data`. Incoming WITS/raw WITS data is translated by backend using `/api/wits-config` mapping into MWD Data fields. |
| Historical export filters | FRONTEND IMPLEMENTED / NEEDS BACKEND VERIFICATION | Historical export UI and payload support `measuredFrom`, `measuredTo`, `depthMin`, and `depthMax`. If both date and depth filters are provided, backend should apply AND filtering. |
| Serial lifecycle | RESOLVED | Serial connection is backend/system-managed. FE does not need manual connect/disconnect controls and only displays Connected/Disconnected/Reconnecting/Error status. |
| ESP raw packet stream | FRONTEND READY / BACKEND GAP IF PAYLOAD ABSENT | FE displays raw ESP packet content if backend provides it through event/endpoint fields such as `lastRawMessage`, `lastPayload`, `lastLine`, `rawPacket`, `raw`, `message`, `packet`, `lastReceivedAt`, or `signal.*`. If not available, UI shows backend gap/unavailable state. |
| Survey VS azimuth | RESOLVED | `verticalSectionAzimuth` remains default 90 for current scope and is defined as `DEFAULT_VERTICAL_SECTION_AZIMUTH`, not an accidental hardcode. |
| Visual regression | REQUIRED | Screenshot checks remain required because chart/layout correctness cannot be verified by lint/typecheck/build alone. |
| Admin audit logs | PLANNED / BLOCKED BY BACKEND | A new audit logs API will be added later. Until then, Admin audit logs show unavailable/backend-blocked state and do not use mock data. |

## 14. Change Summary / Update Notes

Latest updates reflected in this PRD:

- REST production backend URL is now verified in `.env.local` and `.env.example`.
- WebSocket production URL is now verified in `.env.local` and `.env.example`.
- Realtime client and AppContext processing are documented as implemented.
- Mock runtime removal is reflected as implemented.
- Dashboard no-data/error/KPI behavior is updated.
- Rig WITS status is revised: simplified UI is implemented, Output Queue is backend-driven, and Received Data is loaded from `/api/mwd-data`.
- Well Plot multi-track/window navigation is documented as implemented.
- Vertical Section depth-down/overflow handling and Plan View legend placement are documented as implemented at code level.
- Historical export date range and depth range are now implemented in frontend payload; backend support still needs production verification.
- Serial lifecycle clarification is resolved: frontend displays backend/system status only and does not provide manual serial connect/disconnect controls.
- ESP raw packet stream is frontend-ready when backend payload provides raw packet fields; otherwise the UI shows backend gap.
- Survey VS azimuth clarification is resolved through `DEFAULT_VERTICAL_SECTION_AZIMUTH = 90`.
- Admin audit logs are documented as planned/backend-blocked and the UI does not show mock audit logs.
- System Info diagnostics no longer use static simulated data and remain backend-blocked.
- Log Data import/memory flow was cleaned up: CSV/LAS import is unavailable until a backend endpoint exists, and memory import/correlation routes to `/data-management/memory-import`.
- Backend local repository limitation remains documented.
