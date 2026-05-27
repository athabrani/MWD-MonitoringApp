# Product Requirements Document: MWD Monitoring App

Revisi terakhir: 2026-05-25

## Ringkasan Hasil Pembaruan Terbaru

Tabel berikut membandingkan status pada PRD sebelumnya dengan kondisi terbaru berdasarkan audit codebase frontend, backend lokal, dan dokumen endpoint `docs/MWD_FE_API_Routemap_Rapih.md`.

| Module / Feature | Previous Status | Current Status | What Changed | Notes |
|---|---:|---:|---|---|
| Backend endpoint documentation | Needs Clarification | Updated | Dokumen routemap API tersedia dan menjelaskan auth, session/job, MWD data, WITS config, survey, plot template, export, memory, serial, ESP WS, system utilities, gateway ingest, dan email reports. | Implementasi backend lokal di repo masih hanya `GET /`; endpoint docs adalah kontrak integrasi, bukan bukti implementasi lokal. |
| Authentication | Implemented / dependency | Implemented | Kontrak `/api/auth/login` dan `/api/auth/me` kini terdokumentasi termasuk bearer token dan default test accounts. | Tetap bergantung pada backend eksternal/API target. |
| AppContext data source | Partial / mock fallback | Updated | Mock startup data dihapus dari context utama. State awal sekarang kosong/offline dan refresh data bergantung pada token + active session. | Settings UI masih local preference. |
| Dashboard | Partial backend + mock fallback | Updated / Partial | Dashboard sekarang memakai active session, latest MWD data, WITS config, connection status, failover, serial status, ESP WS status, dan blocking state ketika session/data belum tersedia. | Metrics display masih banyak berasal dari normalisasi/derived frontend. |
| Session / Job selection | Implemented | Implemented | Session/job tetap menjadi konteks utama `sessionId`; dokumentasi API memperjelas bahwa `sessionId` adalah internal backend ID. | Backend lokal belum menyediakan endpoint. |
| Rig WITS manual raw input | Needs Clarification | Updated / Partial | Tombol raw test sekarang POST ke `/api/mwd-data` dengan `{ sessionId, raw }`, lalu refresh MWD/WITS debug. | Ini bukan physical serial write. |
| Serial port integration | Needs Clarification | In Progress / Partial | Client baru `serial-api.ts` menambah GET ports, POST connect, GET status. Rig WITS dan Dashboard memakai status serial. | `/api/serial/disconnect` terdokumentasi tetapi belum ada client/frontend action. Local backend only menurut docs. |
| ESP WebSocket status | Needs Clarification | In Progress / Partial | Client baru `esp-ws-api.ts` dan AppContext/Dashboard membaca `/api/esp-ws/status`. | Belum ada stream WebSocket frontend; hanya status backend gateway. |
| Gateway ingest | Needs Clarification | Clarified / Not user FE endpoint | Docs menjelaskan `/api/gateway/mwd-data` memakai `x-gateway-key`; Rig WITS menandai bahwa UI tidak memanggil endpoint ini. | Tidak menjadi user-facing frontend endpoint. |
| Aux Port | Mock / unclear | Needs Clarification | Halaman Aux Port sekarang eksplisit menyatakan endpoint backend AUX belum tersedia dan action dinonaktifkan. | Tidak lagi menyajikan data lokal sebagai aktual. |
| WITS Config | Implemented / Partial | Updated | AppContext memuat global WITS config; settings threshold menjadi read-only dan mengarahkan source of truth ke `/api/wits-config`. | CRUD WITS config tetap via configuration page/API client. |
| WITS Data Values debug | Partial | Updated | Rig WITS menambah debug per WITS ID melalui `/api/wits-data-values?sessionId&witsId&limit=20`. | Dipakai untuk raw/debug, bukan source utama dashboard. |
| Log Data | Partial / mixed mock | Updated / Partial | Log Data memakai `/api/wits-data-values`, `/api/mwd-data`, dan edit tools backend untuk preview/apply move/copy/rescale/delete/hide. | CSV/LAS import dialog, batch settings, dan export log masih placeholder/local. |
| MWD edit tools | Partial / Needs Clarification | Implemented as frontend integration | Endpoint edit tools `/api/mwd-data/edit/*` sudah dipakai untuk operations, move-depth, copy-depth, rescale, hide/unhide, delete range. | Perlu validasi terhadap backend aktual. |
| Memory import/correlate/copy depths | Local state only | Mixed: Backend API client + local UI workflow | `memory-files-api.ts` tersedia untuk `/api/memory-files/*`, tetapi panel Log Data memory import masih parser lokal, correlation lokal, dan copy depth lokal/staged. | Docs memiliki routemap backend memory; UI belum memakai seluruh flow backend tersebut di panel utama. |
| Survey Data actual | Partial / Needs Clarification | Updated / Partial | Manual survey, update, generate from MWD, recalculate, import CSV plan, dan export surveys sekarang memakai endpoint survey/export. | Projection dan resend last survey masih local/disabled. |
| Well Plan Surveys | Mock / local | Updated / Partial | Halaman Well Plan Surveys sekarang memakai `/api/surveys` dengan `stationType=plan` untuk read/create/update/delete dan import CSV. | Status naik dari mock ke backend-integrated UI, tetapi tetap perlu backend runtime. |
| Trajectory | Mock / local | Updated / Partial | Trajectory memuat actual dan plan survey dari backend lalu membangun visualisasi 2D/metric. | 3D trajectory, snapshot, dan export masih placeholder. |
| Historical Data | Partial | Updated / Partial | History memakai `/api/historical-data` dengan `sessionId`, `measuredFrom`, dan `measuredTo`; frontend juga memfilter tanggal. | Export historical dari halaman export belum mengirim date range. |
| Export | Partial | Partial | `exportSurveys` ditambahkan; historical/LAS/PDF tetap ada. | Export page historical masih hanya mengirim `sessionId` dan `format`, belum date range/depth UI. |
| Plotting / Well Plot | Partial | Updated / Partial | Plot template CRUD dan PDF export memakai backend; detail template metadata-only ditangani dengan fallback konfigurasi lokal. | Beberapa action seperti upload template/file, color-map preview, dan label/template file metadata masih local/placeholder. |
| System Utilities | Partial | Updated / Partial | Halaman sekarang admin-only dan refresh data pasca clear/restore mencakup MWD data, WITS values, actual survey, dan plan survey. | Tetap bergantung pada endpoint system utilities; backend lokal belum implement. |
| Admin Panel | Partial / mock system health | Updated / Partial | User management dan role list menggunakan `/api/users` dan `/api/roles`; akses admin-only. | Audit logs dan system health masih placeholder endpoint belum tersedia. |
| Settings | Local state | Clarified / Local preferences only | UI menjelaskan bahwa settings hanya local UI preferences; threshold operasional berasal dari `/api/wits-config`. | Notifications/email masih placeholder. |
| Email reports | Needs Clarification | Documented / Not integrated in FE | Docs mencantumkan `/api/reports/email/*` dan flag `EMAIL_REPORTS_ENABLED`. | Tidak terlihat frontend client/page yang memakai endpoint ini. |

## 1. Document Overview

**Nama sistem:** MWD Monitoring App / MWD Monitor

**Tujuan dokumen:**

Mendefinisikan kebutuhan produk berdasarkan kondisi aktual repository setelah pembaruan terbaru. Dokumen ini adalah revisi PRD, bukan PRD baru dari nol. Status fitur dibedakan antara implemented, updated, partial, in progress, mock/local state only, dan needs clarification.

**Ruang lingkup audit:**

- Frontend Next.js pada `mwd-app-fe`.
- Backend Express lokal pada `mwd-app-be`.
- API client frontend pada `mwd-app-fe/lib`.
- Context, provider, dan state orchestration pada `mwd-app-fe/context`.
- Halaman/modul utama pada `mwd-app-fe/app` dan `mwd-app-fe/components`.
- Dokumentasi endpoint terbaru pada `docs/MWD_FE_API_Routemap_Rapih.md`.
- PRD sebelumnya pada `docs/PRD.md`.

**Catatan sumber audit:**

- Dokumentasi endpoint sekarang tersedia dan cukup rinci.
- Backend lokal di repository masih hanya berisi Express root endpoint `GET /` pada `mwd-app-be/src/server.ts`.
- Karena itu, endpoint backend dalam dokumen ini diperlakukan sebagai kontrak integrasi yang digunakan/direncanakan oleh frontend, bukan sebagai implementasi backend lokal yang sudah diverifikasi.

**Audience utama dokumen:**

- Product owner / stakeholder teknis.
- Frontend engineer.
- Backend engineer.
- QA engineer.
- Operator dan engineer domain yang memvalidasi workflow MWD.

## 2. Product Overview

MWD Monitoring App adalah aplikasi web untuk monitoring Measurement While Drilling, pengelolaan session/job, konfigurasi WITS, validasi raw WITS data, pengelolaan MWD data, survey, log data, plotting, export, system utilities, dan admin user management.

Masalah utama yang diselesaikan:

- Menyediakan workspace monitoring MWD berbasis session/job.
- Menghubungkan data utama MWD dengan WITS config, WITS data values, alarm, survey, plotting, dan export.
- Memisahkan kebutuhan operator, engineer, dan admin melalui role-based navigation/action.
- Menyediakan tool koreksi dan validasi data seperti edit depth range, move/copy depth, rescale, survey recalculation, memory import, dan plotting.

User utama sistem:

- Operator: monitoring dan awareness.
- Engineer: konfigurasi, koreksi data, survey, plotting, dan export.
- Admin: user/role management dan system utilities.

Nilai utama sistem:

- Visibility terhadap data MWD terbaru dan status koneksi.
- Source of truth yang lebih jelas untuk MWD data, WITS config, WITS values, dan survey.
- Workflow teknis untuk validasi, koreksi, dan export data drilling.

## 3. Product Goals

**Goal utama sistem:**

- Menjadi workspace operasional untuk monitoring MWD dan pengelolaan data terkait dari satu aplikasi web.

**Goal operasional:**

- Operator dapat memantau dashboard, WITS status, alarm, connection health, serial status, dan ESP WS status.
- Engineer dapat mengelola session, WITS config, survey, log data, edit tools, plotting, LAS/PDF/export, dan memory workflow.
- Admin dapat mengelola user/role dan menjalankan utilities yang berisiko seperti backup, clear, restore, dan config restore.

**Goal teknis:**

- Frontend memakai API client terpusat dengan bearer token.
- `sessionId` menjadi konteks utama untuk MWD data, WITS values, survey, export, depth tracking, connection status, failover, serial, dan utilities.
- Mock startup data tidak digunakan sebagai data aktual pada AppContext utama.
- Integrasi backend disusun berdasarkan endpoint routemap terbaru.

**Goal usability, monitoring, dan reliability:**

- Dashboard harus terbaca cepat dan menampilkan empty/error state jika session/data tidak tersedia.
- Modul Log Data harus mendukung grouped WITS browser, selected detail view, dan action destruktif dengan confirmation.
- Plotting editor harus tetap terstruktur saat jumlah track/curve/label banyak.
- System utilities harus membatasi action berisiko pada admin.

## 4. Users and Roles

| Role | Tanggung Jawab Utama | Fitur yang Diakses | Batasan Akses |
|---|---|---|---|
| Operator | Monitoring operasional, membaca dashboard, alarm, WITS status, dan history dasar. | Dashboard, Monitoring, Rig WITS read/debug, Alerts, History, beberapa view data. | Tidak boleh melakukan action konfigurasi/edit/destruktif yang membutuhkan engineer/admin. |
| Engineer | Konfigurasi teknis, input/edit data, survey, plotting, export, WITS config, log correction. | Dashboard, Session/Job, WITS Config, Rig WITS raw test, Survey Data, Log Data edit tools, Plotting, LAS/Export, Well Plan Surveys. | Tidak boleh mengakses admin-only utilities dan user management. |
| Admin | Pengelolaan user/role, system utilities, dan action berisiko tinggi. | Admin Panel, System Utilities, semua modul engineer/operator jika navigation mengizinkan. | System health/audit log masih placeholder meskipun halaman admin tersedia. |

## 5. Core Product Scope

### 5.1 Authentication / Login

**Status:** Implemented as frontend-backend integration.

Tujuan modul adalah mengautentikasi user dan memuat profile aktif. Frontend bergantung pada `/api/auth/login` dan `/api/auth/me`, lalu memakai bearer token untuk endpoint protected.

Input utama: username/password.

Output utama: token, user profile, role.

Keterhubungan: seluruh API protected, role-based UI, admin utilities.

### 5.2 Session / Job Management

**Status:** Implemented / backend dependency.

Session/job menjadi konteks utama aplikasi. Dokumentasi memperjelas bahwa `sessionId` adalah internal backend ID, bukan selalu well name/job number.

Input utama: data session/job dan active session selection.

Output utama: active session context untuk dashboard, MWD data, WITS values, survey, export, utilities, serial ingest.

Keterhubungan: hampir semua modul data operasional.

### 5.3 Dashboard

**Status:** Updated / Partial.

Dashboard menampilkan KPI, latest MWD record, chart, connection status, failover, serial status, ESP WS status, depth tracking, WITS config status, dan active session status.

Input utama: active session, MWD data, WITS config, connection status, failover events, serial status, ESP WS status.

Output utama: operational overview, empty/error/blocking state, derived KPI display.

Catatan: dashboard sudah tidak mengandalkan mock startup data, tetapi sebagian tampilan masih derived/normalized di frontend dan perlu divalidasi terhadap model backend aktual.

### 5.4 Monitoring - Rig WITS

**Status:** Updated / Partial.

Rig WITS sekarang berisi:

- Manual raw WITS test melalui POST `/api/mwd-data`.
- Serial port list/connect/status melalui `/api/serial/*`.
- WITS raw debug melalui `/api/wits-data-values`.
- Penjelasan gateway ingest sebagai non-user FE endpoint.
- WITS output queue untuk queue backend, bukan physical serial write.

Input utama: raw WITS text, selected port, baud rate, selected WITS ID.

Output utama: refresh MWD data, WITS values, serial status, debug raw values.

Catatan: physical serial write, incoming packet stream UI, dan gateway hardware ingest belum menjadi user-facing flow penuh.

### 5.5 Monitoring - Aux Port

**Status:** Needs Clarification.

Halaman Aux Port sekarang sengaja menonaktifkan action dan menyatakan endpoint backend khusus AUX belum tersedia.

Input utama: tidak ada input aktif.

Output utama: placeholder state yang jujur.

Catatan: modul ini tidak boleh diperlakukan sebagai implemented sampai ada endpoint AUX atau kontrak yang jelas.

### 5.6 WITS Configuration

**Status:** Updated / Partial.

WITS Config menjadi source of truth untuk label, unit, scale, alarm threshold, curve scale, data source type, dan mapping WITS ID. AppContext memuat WITS config global. Settings tidak lagi mengedit threshold operasional secara lokal.

Input utama: WITS ID, label, units, LAS mnemonic, thresholds, curve config, source type.

Output utama: config rows untuk dashboard, log browser, plotting, alarms, settings read-only threshold display.

### 5.7 WITS Data Values

**Status:** Updated / Partial.

WITS Data Values dipakai untuk debug/history per WITS ID dan raw value validation. Docs memperjelas bahwa endpoint ini bukan jalur ingest langsung; ingest masuk melalui MWD data, gateway, serial gateway, atau ESP WS gateway.

Input utama: `sessionId`, optional `witsId`, depth range, limit.

Output utama: raw value, parsed value, depth, source, timestamp.

### 5.8 Data Management - Log Data

**Status:** Updated / Partial.

Log Data memuat WITS channels, WITS values, MWD data, selected detail view, grouped browser, dan edit tools. Move depth, copy depth, rescale, hide/unhide, delete depth range, dan operations history diarahkan ke `/api/mwd-data/edit/*`.

Input utama: selected WITS ID, selected depth range, edit action payload, import file.

Output utama: preview backend, apply result, refreshed MWD/WITS data, edit history.

Catatan: import CSV/LAS, batch settings editor, beberapa export action, dan memory import panel masih local/placeholder.

### 5.9 Memory Import / Correlate / Copy Depths

**Status:** Mixed: API client exists, primary panel still local.

`memory-files-api.ts` menyediakan client untuk import, detail, points, correlate, correlation history, dan delete memory files. Namun panel memory import pada Log Data masih membaca CSV lokal, segment detection lokal, correlation lokal, dan copy depths lokal/staged.

Input utama: memory CSV, field mapping, depth/time correlation settings, target WITS ID.

Output utama: local parsed dataset, local correlation preview, local copy request rows.

Catatan: backend routemap memory sudah jelas, tetapi UI utama belum sepenuhnya memakai endpoint memory backend.

### 5.10 Survey Data

**Status:** Updated / Partial.

Survey Data mendukung actual station dari `/api/surveys`, manual create/update, generate from MWD data, recalculate, import well plan CSV, dan export surveys.

Input utama: survey station, `stationType`, active session, vertical section azimuth, CSV content.

Output utama: actual/plan survey rows, recalculated trajectory values, survey export file.

Catatan: projection record masih local, resend last survey disabled/local, plot request queue masih UI/local.

### 5.11 Well Plan Surveys

**Status:** Updated / Partial.

Halaman Well Plan Surveys sekarang memakai `/api/surveys` dengan `stationType=plan` untuk read/create/update/delete dan `/api/surveys/well-plan/import-csv` untuk import CSV.

Input utama: planned station values, CSV content, active session.

Output utama: planned survey list untuk trajectory comparison.

### 5.12 Trajectory

**Status:** Updated / Partial.

Trajectory memuat actual dan plan surveys dari backend lalu membangun 2D trajectory dan metric summary.

Input utama: active session, actual surveys, plan surveys.

Output utama: trajectory visualization/summary.

Catatan: 3D visualization, snapshot, dan export trajectory masih placeholder.

### 5.13 Plotting / Well Plot

**Status:** Updated / Partial.

Plotting mendukung template CRUD melalui `/api/plot-templates`, default/detail template, local editing state, well plot preview, dan PDF plot export melalui `/api/exports/pdf-plot`.

Input utama: plot template config, tracks, curves, labels, depth range, active session.

Output utama: plot preview, saved template, PDF export blob.

Catatan: beberapa action seperti color-map preview, upload template/file metadata, dan label/file metadata masih local/placeholder.

### 5.14 History / Export

**Status:** Updated / Partial.

History membaca `/api/historical-data` dengan session dan date range. Export mendukung historical, surveys, LAS, dan PDF plot melalui client API.

Input utama: active session, date range, export format, plot/template payload.

Output utama: historical table, downloadable export blob.

Catatan: halaman Export historical belum mengirim date range/depth range meskipun docs menyebut filter historical data. Ini adalah mismatch frontend-backend docs.

### 5.15 Alerts

**Status:** Implemented as frontend integration / Partial.

WITS alarms menggunakan `/api/wits-alarms`, acknowledge, dan resolve. Role/action tetap perlu backend enforcement.

Input utama: session, alarm ID, acknowledge/resolve action.

Output utama: alarm list dan status update.

### 5.16 System Utilities

**Status:** Updated / Partial.

System Utilities sekarang admin-only di halaman. Utility mencakup backup session, clear data targets/preview/confirm, restore session, config backup/restore, dan refresh data setelah mutation.

Input utama: selected targets, backup/restore files, confirmation flag.

Output utama: backup file/result, clear preview/result, restored data refresh.

Catatan: bergantung penuh pada backend system utilities; backend lokal repo belum implement.

### 5.17 Admin Panel

**Status:** Updated / Partial.

Admin Panel memakai `/api/users` dan `/api/roles` untuk list/create/update/delete user dan role list untuk form.

Input utama: user data, role ID, active flag, password.

Output utama: backend user list, role list, create/update/delete result.

Catatan: audit logs dan system health masih endpoint-not-available placeholder.

### 5.18 Settings

**Status:** Clarified / Local preferences only.

Settings hanya mengatur local UI preferences seperti density, auto-refresh, refresh interval, dan units. Threshold operasional ditandai read-only dan harus berasal dari `/api/wits-config`.

Catatan: notifications/email alerts masih placeholder dan belum terhubung ke email reports backend.

## 6. Functional Requirements

| ID | Judul Requirement | Deskripsi | Actor/Role | Input Utama | Output/Hasil | Dependency |
|---|---|---|---|---|---|---|
| FR-01 | Login | Sistem harus mengizinkan user login dan mendapatkan bearer token. | Operator, Engineer, Admin | Username, password | Token, user profile | `/api/auth/login`, `/api/auth/me` |
| FR-02 | Role-based UI | Sistem harus membatasi navigation/action berdasarkan role. | All | User role | Menu/action sesuai role | Auth profile |
| FR-03 | Active Session Context | Sistem harus menyimpan dan memakai active session/job sebagai konteks data. | All | Selected session | `activeMwdSessionId` | `/api/mwd-sessions` |
| FR-04 | Dashboard Data Load | Dashboard harus memuat latest MWD data dan historical chart berdasarkan active session. | All | `sessionId` | KPI/chart/latest values | `/api/mwd-data` |
| FR-05 | Dashboard Empty State | Dashboard harus menampilkan blocking/empty state jika tidak ada token, session, atau MWD data. | All | Auth/session/data state | Pesan error/kosong | AppContext |
| FR-06 | Connection Status | Sistem harus memuat connection status per session. | All | `sessionId` | Connected/degraded/offline, latency, packet loss | `/api/connection-status` |
| FR-07 | Failover Events | Sistem harus memuat failover events untuk dashboard/monitoring. | All | `sessionId`, limit | Event list | `/api/failover-events` |
| FR-08 | Serial Ports | Rig WITS harus dapat membaca daftar serial port lokal. | Engineer, Admin | Token | COM port list | `/api/serial/ports` |
| FR-09 | Serial Connect | Rig WITS harus dapat meminta backend connect ke selected port dan baud rate. | Engineer, Admin | `sessionId`, port, baudRate | Connect result/status | `/api/serial/connect` |
| FR-10 | Serial Status | Dashboard/Rig WITS harus membaca status serial gateway. | All | Token/session | Connected/error/status | `/api/serial/status` |
| FR-11 | ESP WS Status | Dashboard harus membaca status backend ke ESP WebSocket gateway. | All | Token/session | ESP WS status | `/api/esp-ws/status` |
| FR-12 | Manual Raw WITS Test | Engineer/Admin harus dapat post raw WITS test ke MWD data endpoint. | Engineer, Admin | `sessionId`, raw string | MWD/WITS refresh | `POST /api/mwd-data` |
| FR-13 | WITS Config List | Sistem harus memuat WITS config untuk label, unit, scale, alarm, dan plotting. | All | Token | WITS config rows | `/api/wits-config` |
| FR-14 | WITS Config CRUD | Engineer/Admin harus dapat mengelola WITS config. | Engineer, Admin | WITS config payload | Saved/updated/deleted config | `/api/wits-config` |
| FR-15 | WITS Data Values Debug | Rig WITS/Log Data harus dapat membaca raw WITS values per WITS ID. | Engineer, Admin | `sessionId`, `witsId`, limit | Raw/parsed values | `/api/wits-data-values` |
| FR-16 | WITS Alarms | Sistem harus menampilkan, acknowledge, dan resolve alarms. | Operator, Engineer, Admin | `sessionId`, alarm ID | Alarm status | `/api/wits-alarms` |
| FR-17 | Log Data Browser | Log Data harus menampilkan grouped WITS browser dan selected detail view. | Engineer, Admin | WITS config, values | Grouped channels/detail | `/api/wits-config`, `/api/wits-data-values` |
| FR-18 | MWD Edit Preview | Sistem harus menyediakan preview untuk move/copy/rescale sebelum apply. | Engineer, Admin | Depth range/action payload | Preview rows/affected count | `/api/mwd-data/edit/*` |
| FR-19 | MWD Edit Apply | Sistem harus apply edit tools setelah preview/confirmation. | Engineer, Admin | Confirmed payload | Updated MWD data | `/api/mwd-data/edit/*` |
| FR-20 | Delete/Hide Depth Range | Sistem harus mendukung hide/unhide/delete depth range dengan confirmation. | Engineer, Admin | Depth range | Updated visibility/data | `/api/mwd-data/edit/*` |
| FR-21 | Memory File API Readiness | Sistem harus memiliki client untuk memory files backend. | Engineer, Admin | File/correlation payload | File/correlation result | `/api/memory-files/*` |
| FR-22 | Memory Local Workflow | Log Data memory panel harus menandai parser/correlation/copy depths sebagai local jika belum backend-integrated. | Engineer, Admin | Local CSV | Local dataset/preview | Local state |
| FR-23 | Manual Survey Create | Engineer/Admin harus dapat membuat actual survey station. | Engineer, Admin | Survey station, `stationType=actual` | Created survey | `/api/surveys` |
| FR-24 | Survey Update/Recalculate | Sistem harus update survey lalu recalculate trajectory. | Engineer, Admin | Survey edit, VS azimuth | Recalculated survey | `/api/surveys/:id`, `/api/surveys/recalculate` |
| FR-25 | Generate Survey from MWD | Sistem harus generate actual survey dari MWD data jika data memiliki field yang diperlukan. | Engineer, Admin | `sessionId`, `stationType=actual` | Survey records | `/api/surveys/from-mwd-data` |
| FR-26 | Well Plan Survey CRUD | Engineer/Admin harus mengelola plan survey dengan `stationType=plan`. | Engineer, Admin | Planned station | Plan survey list | `/api/surveys` |
| FR-27 | Well Plan CSV Import | Sistem harus import plan CSV sebagai raw text dengan query metadata. | Engineer, Admin | CSV content, `sessionId`, `stationType=plan`, VS azimuth | Imported plan surveys | `/api/surveys/well-plan/import-csv` |
| FR-28 | Trajectory View | Sistem harus menampilkan actual vs plan trajectory dari survey backend. | All | Actual/plan surveys | 2D trajectory/metrics | `/api/surveys` |
| FR-29 | Plot Template CRUD | Engineer/Admin harus membuat, update, delete plot template. | Engineer, Admin | Plot template config | Saved template | `/api/plot-templates` |
| FR-30 | Plot Preview | Sistem harus menampilkan well plot preview dari MWD data dan plot config. | Engineer, Admin | MWD data, plot config | Preview plot | Frontend renderer, `/api/mwd-data` |
| FR-31 | PDF Plot Export | Sistem harus export plot ke PDF. | Engineer, Admin | Session/template payload | PDF blob | `/api/exports/pdf-plot` |
| FR-32 | LAS Export | Sistem harus export LAS. | Engineer, Admin | Session/depth/config | LAS blob | `/api/exports/las` |
| FR-33 | Survey Export | Sistem harus export surveys. | Engineer, Admin | Session, format, station type | Export blob | `/api/exports/surveys` |
| FR-34 | Historical Data Load | History harus memuat historical data dengan session dan date range. | All | `sessionId`, measuredFrom, measuredTo | Historical table | `/api/historical-data` |
| FR-35 | Historical Export | Sistem harus export historical data. | Engineer, Admin | Session, format | Export blob | `/api/exports/historical` |
| FR-36 | System Backup/Clear/Restore | Admin harus dapat menjalankan backup, clear, restore, dan config restore. | Admin | Targets/files/confirm | Mutation result + refresh | `/api/system-utilities/*` |
| FR-37 | Admin User Management | Admin harus dapat list/create/update/delete users. | Admin | User payload | User list updated | `/api/users` |
| FR-38 | Admin Role List | Admin harus dapat memuat roles untuk form user. | Admin | Token | Role options | `/api/roles` |
| FR-39 | Settings Local Preferences | User harus dapat mengubah UI density, refresh interval, auto-refresh, dan units secara lokal. | All | Preferences | Updated local UI | AppContext/local state |
| FR-40 | Placeholder Disclosure | Modul yang belum punya backend harus menampilkan status placeholder/endpoint belum tersedia. | All | N/A | Tidak ada data palsu sebagai aktual | UI state |

## 7. Non-Functional Requirements

| ID | Requirement | Deskripsi |
|---|---|---|
| NFR-01 | Accuracy | Data dashboard, log, survey, plot, dan export harus berasal dari backend atau dinyatakan sebagai local/mock jika belum terintegrasi. |
| NFR-02 | Integration Readiness | API client harus menormalisasi response fleksibel tetapi tetap menjaga kontrak endpoint yang jelas. |
| NFR-03 | Role-based Access | Action engineer/admin harus dibatasi di UI dan tetap perlu backend authorization. |
| NFR-04 | Reliability | Dashboard dan monitoring harus memiliki empty/error state saat backend/session/data tidak tersedia. |
| NFR-05 | Performance | MWD data, WITS values, dan plotting harus mendukung filter session, limit, depth range, dan date range untuk mengurangi beban data. |
| NFR-06 | Maintainability | API client per domain harus dipisah seperti auth, MWD data, WITS, surveys, exports, serial, ESP WS, system utilities, users, roles. |
| NFR-07 | Auditability | Edit tools, clear/restore, export, dan admin actions sebaiknya memiliki audit trail; sebagian endpoint docs ada, tetapi UI audit log masih placeholder. |
| NFR-08 | Usability | Modul kompleks harus memakai grouping, tabs, detail panel, confirmation dialog, dan status badge agar operator/engineer dapat bekerja cepat. |
| NFR-09 | Data Safety | Action destructive seperti delete depth range, clear data, delete user, dan delete template harus membutuhkan confirmation. |
| NFR-10 | Responsiveness | UI harus tetap usable pada dashboard, log data, plotting, dan admin table dengan layout responsive. |

## 8. Data and Integration Requirements

### 8.1 Data Utama

| Data | Source of Truth | Digunakan oleh | Status |
|---|---|---|---|
| Auth user/token | Backend auth | Semua protected API | Implemented integration |
| Roles/users | `/api/roles`, `/api/users` | Admin Panel | Partial, backend dependency |
| Session/job | `/api/mwd-sessions` | Semua modul operasional | Implemented integration |
| MWD Data | `/api/mwd-data`, `/api/historical-data` | Dashboard, History, Plot, Log, Survey generation, Export | Updated / Partial |
| WITS Config | `/api/wits-config` | Label/unit/scale/alarm/plot/log/settings | Updated / Partial |
| WITS Data Values | `/api/wits-data-values` | Rig WITS debug, Log Data raw values | Updated / Partial |
| WITS Alarms | `/api/wits-alarms` | Alerts/Dashboard | Partial |
| Survey actual/plan | `/api/surveys` | Survey Data, Well Plan, Trajectory | Updated / Partial |
| Plot Templates | `/api/plot-templates` | Plotting, Well Plot | Partial |
| Exports | `/api/exports/*` | Export pages, Plotting, Survey | Partial |
| Memory Files | `/api/memory-files/*` | Planned memory backend workflow | API client exists, UI partly local |
| Serial Gateway | `/api/serial/*` | Rig WITS, Dashboard | In Progress / local backend only |
| ESP WS Gateway | `/api/esp-ws/status` | Dashboard | In Progress / status only |
| System Utilities | `/api/system-utilities/*` | Admin utilities | Partial |
| Gateway Ingest | `/api/gateway/mwd-data` | Hardware service | Documented, not user FE endpoint |
| Email Reports | `/api/reports/email/*` | Future reports/settings | Documented, no FE integration |

### 8.2 Frontend-Backend Relationship

- Frontend menggunakan `NEXT_PUBLIC_API_BASE_URL`.
- Protected endpoint menggunakan bearer token.
- `sessionId` harus dikirim untuk data yang session-scoped.
- MWD Data adalah sumber utama dashboard, plot, historical, LAS/PDF export, dan survey generation.
- WITS Data Values dipakai untuk debug/raw validation, bukan sebagai sumber utama dashboard.
- WITS Config adalah sumber label, unit, alarm threshold, dan plotting curve metadata.

### 8.3 Integration Gaps

- Backend lokal di repo belum mengimplementasikan endpoint yang didokumentasikan.
- Serial disconnect terdokumentasi tetapi belum ada frontend client/action.
- ESP WS baru status endpoint; belum ada stream data realtime di frontend.
- Memory backend endpoints sudah ada client, tetapi UI panel utama masih local workflow.
- Export historical belum mengirim date range/depth range dari halaman Export.
- Email reports terdokumentasi tetapi tidak terlihat frontend integration.

## 9. Workflow Requirements

### 9.1 Login dan Startup

1. User login melalui `/api/auth/login`.
2. Frontend memuat `/api/auth/me`.
3. Frontend memuat session/job.
4. User memilih active session.
5. AppContext memuat WITS config, MWD data, WITS values, alarms, connection/failover, serial status, dan ESP WS status sesuai kebutuhan.

### 9.2 Monitoring Dashboard

1. User membuka Dashboard.
2. Sistem memvalidasi token dan active session.
3. Sistem memuat latest MWD data dan chart data.
4. Sistem menampilkan status connection, failover, serial, ESP WS, depth tracking, dan WITS config state.
5. Jika session/data tidak tersedia, sistem menampilkan blocking/empty state.

### 9.3 Rig WITS Manual Raw Test

1. Engineer/Admin memilih active session.
2. User memasukkan raw WITS text.
3. Frontend POST ke `/api/mwd-data` dengan `{ sessionId, raw }`.
4. Frontend refresh MWD data dan WITS data values.

### 9.4 Serial Hardware Flow

1. Engineer/Admin memuat `/api/serial/ports`.
2. User memilih port dan baud rate.
3. Frontend POST `/api/serial/connect`.
4. Frontend polling `/api/serial/status`.
5. Jika connected, frontend refresh MWD/WITS values.

Catatan: disconnect belum tersedia di frontend; physical serial behavior bergantung backend lokal hardware.

### 9.5 WITS Config dan WITS Debug

1. User membuka configuration/Rig WITS/Log Data.
2. Frontend memuat `/api/wits-config`.
3. Untuk debug raw values, user memilih WITS ID.
4. Frontend memuat `/api/wits-data-values?sessionId=&witsId=&limit=20`.

### 9.6 Log Data Edit Tools

1. Engineer/Admin memilih WITS channel dan depth range.
2. User memilih edit action: hide, unhide, delete, move, copy, rescale.
3. Untuk preview action, frontend memanggil endpoint preview.
4. User mengonfirmasi apply.
5. Frontend memanggil endpoint apply dan refresh MWD/WITS data.

### 9.7 Survey Handling

1. Engineer/Admin dapat membuat survey manual actual melalui `/api/surveys`.
2. User dapat generate actual survey dari MWD Data melalui `/api/surveys/from-mwd-data`.
3. Setelah edit atau perubahan kalkulasi, frontend memanggil `/api/surveys/recalculate`.
4. Well plan CSV diimport sebagai `stationType=plan`.
5. Trajectory memuat actual dan plan survey untuk perbandingan.

### 9.8 Plotting dan Export Plot

1. User memuat plot templates.
2. User mengedit template di local UI state.
3. User menyimpan template melalui create/update plot template.
4. User preview well plot.
5. User export PDF plot melalui `/api/exports/pdf-plot`.

### 9.9 History dan Export

1. User memilih active session dan date range.
2. History memuat `/api/historical-data`.
3. Export historical/survey/LAS/PDF dilakukan melalui `/api/exports/*`.

Catatan: Export page historical belum meneruskan date range/depth range dari UI.

### 9.10 Admin User Management

1. Admin membuka Admin Panel.
2. Frontend memuat `/api/users` dan `/api/roles`.
3. Admin create/update/delete user.
4. Frontend refresh user list.

### 9.11 System Utilities

1. Admin memilih utility: backup, clear data, restore session, config backup/restore.
2. Untuk clear, frontend memuat targets, preview, lalu confirmation.
3. Setelah mutation, frontend refresh MWD data, WITS values, actual surveys, dan plan surveys.

## 10. UI/UX Requirements

- Dashboard harus menampilkan data readiness dengan jelas: no session, no MWD data, backend error, WITS config loading/error.
- Dashboard harus membedakan status connection, serial, ESP WS, dan failover tanpa menyamakan semua menjadi satu status.
- Rig WITS harus membedakan raw test via `/api/mwd-data`, serial gateway connect/status, dan gateway ingest hardware yang bukan endpoint user FE.
- Aux Port harus tetap menampilkan disabled/placeholder state sampai endpoint AUX tersedia.
- Log Data harus mempertahankan grouped WITS browser, search, selected detail view, dan action confirmation.
- Edit tools harus menampilkan preview sebelum apply untuk operasi yang mengubah banyak row.
- Survey Data harus membedakan actual survey, plan survey, projection local, generate from MWD, recalculate, dan export.
- Plotting editor harus tetap mendukung track/curve navigation ketika konfigurasi besar.
- Settings harus jelas sebagai local UI preference, bukan operational backend config.
- Admin Panel harus jelas membedakan user/role management yang terintegrasi dengan system health/audit logs yang masih placeholder.

## 11. Risks / Constraints / Dependencies

- Backend lokal di repository tidak mencerminkan endpoint docs; risiko utama adalah false confidence pada integrasi jika hanya menjalankan `mwd-app-be`.
- Ada mismatch antara frontend dan docs untuk historical export date range/depth range.
- Serial integration bergantung backend lokal/hardware dan tidak cocok untuk deployment Vercel jika membutuhkan port fisik.
- ESP WS integration baru berupa status; belum ada bukti stream realtime ke frontend.
- Memory file backend workflow terdokumentasi dan client tersedia, tetapi UI panel utama masih local workflow.
- Gateway ingest memakai `x-gateway-key` dan tidak boleh dipakai sebagai endpoint user FE biasa.
- Email reports terdokumentasi tetapi belum ada frontend integration.
- Admin audit logs/system health masih placeholder.
- Role-based restriction di UI harus tetap diperkuat backend authorization.
- Normalisasi response fleksibel di API client membantu toleransi, tetapi dapat menyembunyikan mismatch data model jika backend field tidak konsisten.

## 12. Out of Scope

Berdasarkan codebase dan dokumentasi saat ini, hal berikut tidak termasuk ruang lingkup implemented saat ini:

- Physical serial write dari UI ke Rig WITS device.
- AUX port real monitoring dan send AUX data.
- LoRa/ESP physical layer management dari frontend.
- ESP WebSocket live stream langsung di frontend.
- Gateway ingest sebagai endpoint user-facing UI.
- SMTP/email reports UI, kecuali backend docs yang menyebut endpoint dan feature flag.
- Admin audit log dan system health dashboard aktual.
- 3D trajectory final, trajectory snapshot, dan trajectory export.
- Full backend memory import/correlation flow di panel Log Data utama.
- Export historical dengan date range/depth range dari halaman Export sampai payload UI diperbarui.

## 13. Open Questions / Needs Clarification

| Area | Status | Pertanyaan / Klarifikasi yang Dibutuhkan |
|---|---:|---|
| Backend implementation location | Needs Clarification | Endpoint docs lengkap, tetapi backend lokal repo hanya `GET /`. Apakah implementasi backend aktual berada di repo lain/deployment terpisah? |
| Serial disconnect | Still In Progress | Docs mencantumkan `/api/serial/disconnect`, tetapi frontend client/action belum ada. Perlu ditambahkan atau memang tidak dipakai? |
| ESP WS stream | Needs Clarification | Apakah frontend hanya perlu status `/api/esp-ws/status`, atau akan ada realtime stream data ke UI? |
| AUX port | Needs Clarification | Belum ada endpoint AUX khusus. Apakah AUX akan memakai WITS output/serial/gateway yang sama atau endpoint baru? |
| Historical export filters | Backend/Frontend mismatch | Docs menyebut historical data filter waktu/depth, tetapi Export page belum mengirim date range/depth range ke `/api/exports/historical`. |
| Memory backend workflow | Still In Progress | Client `/api/memory-files/*` ada, tetapi UI panel masih local. Apakah panel perlu dipindahkan penuh ke backend memory endpoints? |
| Plot template metadata-only | Needs Clarification | Frontend menangani response template detail yang hanya metadata. Apakah backend wajib mengembalikan config penuh? |
| Email reports | Needs Clarification | Endpoint docs ada, tetapi FE belum memakai. Apakah fitur report email akan masuk Settings, Export, atau modul Reports terpisah? |
| Admin audit/system health | Needs Clarification | UI placeholder ada. Endpoint aktual untuk audit logs/system health belum terlihat di docs selain utilities/log export terkait. |
| Survey vertical section defaults | Needs Clarification | FE memakai `verticalSectionAzimuth: 90` di beberapa flow. Apakah ini default domain yang benar atau harus configurable per session/job? |
| Projection survey | Needs Clarification | Projection di Survey Data masih local. Apakah perlu disimpan sebagai survey type/record backend atau hanya perhitungan sementara UI? |
| WITS output queue | Needs Clarification | Docs menyebut queue backend dan physical write fase hardware. Perlu definisi status queue, retry, dan failure model. |

## 14. Change Summary / Update Notes

Pembaruan yang ditemukan:

- Dokumentasi endpoint/routemap sekarang tersedia dan menjawab banyak clarification lama.
- AppContext utama berpindah dari mock startup data ke backend-driven empty/offline state.
- Dashboard diperbarui untuk active session readiness, serial status, ESP WS status, WITS config, dan backend data state.
- Rig WITS diperbarui dengan serial API, raw test ke `/api/mwd-data`, WITS values debug, dan penjelasan gateway ingest.
- Survey actual, well plan survey, trajectory, dan survey export lebih terintegrasi dengan backend.
- Well Plan Surveys naik status dari mock/local menjadi partial backend integration.
- Log Data edit tools lebih jelas memakai backend preview/apply.
- Admin Panel user/role management lebih nyata via `/api/users` dan `/api/roles`.
- Settings diperjelas sebagai local UI preferences saja.

Clarification yang sekarang terjawab:

- `sessionId` adalah internal backend session/job ID.
- Raw WITS manual test masuk melalui `POST /api/mwd-data` dengan `{ sessionId, raw }`.
- `POST /api/surveys/from-mwd-data` mengambil data dari MWD Data, bukan menerima station manual satu per satu.
- `POST /api/surveys/recalculate` hanya menghitung ulang survey/trajectory, bukan mengubah sensor/log MWD.
- Well plan CSV import memakai raw text/plain CSV dengan query `sessionId`, `stationType`, dan `verticalSectionAzimuth`.
- Gateway ingest `/api/gateway/mwd-data` adalah endpoint hardware service dengan `x-gateway-key`, bukan endpoint user FE biasa.
- WITS Config dan WITS Data Values punya peran berbeda: config untuk metadata/mapping, values untuk raw/debug/history per WITS ID.

Clarification yang masih tersisa:

- Lokasi/implementasi backend aktual untuk endpoint docs.
- AUX endpoint/flow.
- Serial disconnect dan lifecycle hardware.
- ESP WebSocket live stream requirement.
- Full backend integration untuk memory import/correlation/copy depths panel.
- Historical export filter parity.
- Email reports frontend placement.
- Admin audit/system health endpoint.
- Default vertical section azimuth dan konfigurasi per session.

