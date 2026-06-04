# Product Requirements Document - MWD Monitoring App

**Versi:** V2  
**Tanggal audit:** 2026-06-04  
**Tujuan dokumen:** pembaruan PRD berbasis audit aktual repository frontend, backend lokal, dan integrasi backend production.  
**Posisi produk:** aplikasi web/PWA MWD Monitoring App sebagai peningkatan dari workflow Polaris, bukan dashboard sederhana yang berdiri terpisah dari kebiasaan operasional pengguna Polaris.

## 1. Ringkasan Eksekutif

MWD Monitoring App saat ini sudah memiliki fondasi frontend yang kuat untuk menjadi aplikasi monitoring MWD berbasis web/PWA: authentication, session management, centralized API client, realtime WebSocket client, AppContext untuk orchestration data, role-based navigation, dashboard, Rig WITS, WITS configuration, survey, trajectory, well plot, plotting, export, settings, admin, dan system utilities.

Sistem sudah diarahkan ke backend production melalui environment variable:

| Area | Nilai / Status | Evidence |
|---|---|---|
| REST API production | `https://be-mwd.vercel.app` | `mwd-app-fe/.env`, `mwd-app-fe/.env.example`, `mwd-app-fe/lib/api-client.ts` |
| WebSocket production | `wss://be-mwd-production.up.railway.app/ws` | `mwd-app-fe/.env`, `mwd-app-fe/.env.example`, `mwd-app-fe/lib/realtime-client.ts` |
| Backend lokal dalam repo | Stub minimal, hanya `GET /` | `mwd-app-be/src/server.ts` |
| API cache behavior | REST request default `cache: "no-store"` | `mwd-app-fe/lib/api-client.ts` |
| Realtime events | `mwd-data`, `esp-gateway-status`, `connection-status` | `mwd-app-fe/lib/realtime-client.ts`, `mwd-app-fe/context/AppContext.tsx` |

Kesesuaian utama terhadap target peningkatan Polaris:

- Modul yang familiar bagi pengguna Polaris tetap ada: WITS Config, Log Data, Survey, Trajectory, Well Plot, Plotting, Export, LAS, Memory Import, Settings, Utilities.
- Sistem meningkatkan pengalaman lama dengan UI web modern, role-based navigation, active MWD Session, status connection/ESP/realtime yang lebih eksplisit, REST/WebSocket integration, dan empty/error/unavailable state yang jujur.
- Data core seperti session, MWD data, WITS values, WITS alarms, surveys, plot templates, exports, users, roles, dan system utilities sudah diarahkan ke service backend, bukan mock runtime umum.

Fitur yang sudah kuat:

- Auth flow dengan token restore, remember me, invalid session event, safe error message, dan redirect protected route.
- API client terpusat yang memaksa relative path, env base URL, bearer token, no-store fetch, dan handling 401/403 token invalid.
- WebSocket client dengan reconnect dan subscribe session.
- Dashboard, Rig WITS, Survey, Log Data, Trajectory, Well Plot, Export, Settings, Admin, dan Utilities memiliki integrasi backend yang jelas.
- Empty/error/unavailable state sudah terlihat di banyak modul.

Fitur yang masih partial:

- Memory Import masih campuran backend memory file API dan local demo/helper workflow.
- Generate LAS memakai backend export untuk file, tetapi preset dan preview masih local.
- Plotting memiliki CRUD template dan PDF export, tetapi upload/attachment masih placeholder/local metadata.
- System Utilities memiliki backup/restore/clear/config backup, tetapi process/system-log diagnostics belum punya endpoint.
- Admin Audit Logs sudah punya client dan UI, tetapi production backend endpoint perlu verifikasi end-to-end.
- PWA masih berupa install/update prompt UI, belum service worker/cache/offline strategy production.

Fitur mock/fallback/placeholder yang harus ditandai:

- Aux Port frontend-only unavailable.
- Log Data CSV/LAS direct import blocked until backend endpoint tersedia.
- Memory Import local storage channel, local dataset import, local-only correlation/gap-fill helper.
- Configuration SMTP/report, survey report, database backup trigger placeholders.
- Settings notification toggles/event view belum menjadi delivery pipeline.
- Plotting upload file dan beberapa builder actions masih endpoint unavailable/local metadata.
- Charts export masih berupa toast prepared, belum export file nyata.

Risiko terbesar:

1. Backend production source tidak tersedia di repository ini; backend lokal hanya stub. Artinya endpoint, authorization, response shape, dan production behavior tidak bisa diverifikasi dari repo lokal.
2. Frontend role guard belum cukup sebagai security boundary. Backend wajib enforce role untuk admin/system utilities/edit/export/config actions.
3. Beberapa workflow Polaris yang relevan masih local/demo/placeholder. Bila tidak diberi label jelas, pengguna bisa mengira data local sebagai data produksi.
4. PWA belum punya cache strategy resmi. Data MWD realtime tidak boleh ditampilkan sebagai live jika berasal dari cache stale.

Prioritas berikutnya:

- P0: validasi backend production contract, authz backend per role, session/token expired flow, dashboard/core data stability.
- P1: verifikasi export filters, audit logs endpoint, operator read-only enforcement, Memory Import production vs demo separation.
- P2: LAS/PDF polish, plotting upload endpoint, notification delivery, diagnostics endpoint.
- P3: Aux Port jika backend tersedia, advanced offline/PWA, visual regression automation.

## 2. Latar Belakang Sistem

Sistem ini dibuat sebagai peningkatan dari aplikasi Polaris. Polaris menjadi referensi workflow karena pengguna MWD sudah familiar dengan modul seperti WITS configuration, log data, survey, trajectory, well plot, plotting, export, LAS, memory, settings, dan utilities. Karena itu, keberadaan modul-modul tersebut tidak otomatis dianggap scope creep; modul tersebut perlu dinilai berdasarkan:

- Apakah mewakili workflow Polaris yang memang dibutuhkan pengguna.
- Apakah sudah terhubung ke backend production.
- Apakah masih partial, local state, placeholder, atau belum siap production.
- Apakah UI memberikan sinyal jujur saat backend belum tersedia.

Masalah yang ingin diperbaiki dari pendekatan lama:

- Keterbatasan platform desktop/lokal.
- UI/UX yang kurang modern untuk penggunaan lintas perangkat.
- Kebutuhan realtime monitoring melalui WebSocket.
- Kebutuhan status koneksi yang lebih jelas: backend, serial, ESP, realtime, failover.
- Kebutuhan akses multi-user dan role-based access.
- Kebutuhan historical data dan export yang diproses backend.
- Kebutuhan active MWD Session sebagai konteks tunggal data.
- Kebutuhan empty/error/unavailable state, bukan tampilan data palsu.

## 3. Prinsip Desain Berbasis Polaris Workflow

Prinsip desain sistem adalah mempertahankan mental model Polaris sambil memperbarui platform, data flow, dan pengalaman pengguna. Navigasi dan modul disusun sebagai workspace operasi MWD, bukan hanya dashboard.

Peningkatan dibanding Polaris:

- Web/PWA lintas perangkat.
- UI modern berbasis React/Next.js, Tailwind, dan shadcn/Radix style components.
- Backend production via REST API.
- Realtime update via WebSocket.
- Role-based access untuk Admin, Engineer, Operator.
- Active MWD Session sebagai konteks utama.
- Status koneksi yang lebih informatif.
- Data error/empty/unavailable state yang eksplisit.
- Workflow data lebih terstruktur melalui service API domain.

| Modul | Hubungan dengan Polaris | Peningkatan yang Diberikan | Status Implementasi | Catatan |
|---|---|---|---|---|
| Dashboard | Polaris monitoring overview | KPI, connection summary, chart, event stream, backend-driven empty/error state | Implemented/Partially Implemented | Data dari AppContext dan backend; stale data marker masih perlu diperkuat. |
| Rig WITS | Workflow monitoring rig input/output | Received Data dari `/api/mwd-data`, Output Queue dari `/api/wits-output/*` | Implemented/Partially Implemented | Output queue bukan bukti hardware serial write. |
| Aux Port | Polaris-style auxiliary monitoring | Unavailable state jujur | Frontend Only | Endpoint backend belum tersedia. |
| WITS Configuration | Core Polaris configuration | CRUD WITS config via backend, metadata untuk label/unit/threshold/plot | Partially Implemented | Beberapa panel config lain masih placeholder. |
| Log Data | Polaris log browser/editor | Grouped WITS browser, backend edit tools, preview-before-apply | Partially Implemented | CSV/LAS direct import belum ada backend. |
| Survey Data | Polaris survey workflow | Actual/plan survey, generate from MWD, recalculate, export | Partially Implemented | Backend contract perlu diuji end-to-end. |
| Trajectory | Polaris trajectory analysis | Planned vs actual, vertical/plan view, generate actual surveys | Partially Implemented | Snapshot clipboard ada; backend export/3D belum core. |
| Well Plot | Polaris log/well plot view | Multi-track, navigation, responsive rendering | Partially Implemented | Perlu visual/performance test large track. |
| Plotting | Polaris plot template/export | Plot template CRUD, preview, PDF export | Partially Implemented | Upload/attachment actions masih placeholder/local. |
| Generate LAS | Polaris LAS export | Backend LAS blob, local preset/preview | Partially Implemented | Preset belum persisted backend. |
| Memory Import | Polaris memory workflow | Backend memory files + local scan helper | Advanced/Experimental | Harus dipisahkan jelas production vs demo. |
| Settings | Polaris operational settings | Theme/density/units, backend WITS threshold edit | Partially Implemented | Notification delivery belum ada. |
| System Utilities | Polaris utility/admin workflow | Backup/restore/clear/config backup, diagnostics panel | Partially Implemented | Process/system log endpoint belum tersedia. |
| Admin | Multi-user administration | Users/roles/audit/backend health | Partially Implemented/Needs Verification | Audit endpoint perlu verifikasi backend production. |

## 4. Tujuan Produk

- Menyediakan monitoring data MWD realtime berbasis web/PWA.
- Menyediakan workflow yang familiar bagi pengguna Polaris.
- Meningkatkan keterbacaan data drilling, WITS, survey, trajectory, dan export.
- Meningkatkan visibility status koneksi backend/serial/ESP/WebSocket.
- Mendukung akses berdasarkan role Admin, Engineer, Operator.
- Mendukung historical data, export CSV/JSON/LAS/PDF, dan blob download.
- Mendukung konfigurasi WITS, survey, trajectory, well plot, plotting, memory import, settings, dan utilities sebagai bagian dari workflow MWD.
- Menampilkan status backend kosong/error/unavailable dengan jujur.

## 5. Ruang Lingkup Sistem

### 5.1 Core Monitoring Features

| Fitur | Status | Evidence | Catatan |
|---|---|---|---|
| Login/Auth | Implemented | `app/login/page.tsx`, `context/AuthContext.tsx`, `lib/auth-api.ts` | Direct `/login` route sudah ditangani via optional `onLoginSuccess` dan router replace. |
| MWD Session | Implemented/Partial | `lib/mwd-sessions-api.ts`, `context/AppContext.tsx` | Backend production harus tersedia. |
| Dashboard | Implemented/Partial | `app/dashboard/page.tsx`, `context/AppContext.tsx` | KPI tetap render saat MWD data kosong. |
| Rig WITS/MWD Data | Implemented/Partial | `app/monitoring/rig-wits/page.tsx`, `lib/mwd-data-api.ts` | Received Data dari `/api/mwd-data`. |
| Realtime WebSocket | Implemented | `lib/realtime-client.ts`, `context/AppContext.tsx` | Handles three known events and session subscribe. |
| Connection Status | Implemented/Partial | `lib/connection-api.ts`, `context/AppContext.tsx` | REST + derived UI events. |
| ESP/Gateway Status | Implemented/Partial | `lib/esp-ws-api.ts`, `components/system-health-panel.tsx` | Raw packet displayed if backend provides payload fields. |
| Alerts | Partially Implemented | `app/alerts/page.tsx`, `lib/api/wits.ts` | Backend WITS alarms + derived events. |
| Charts | Partially Implemented | `app/charts/page.tsx` | Data from AppContext; export is toast/prepared, not file. |
| History | Partially Implemented | `app/history/page.tsx`, `lib/mwd-data-api.ts` | Date/depth filter; backend filter semantics need verification. |
| Export Historical | Partially Implemented/Needs Verification | `app/export/page.tsx`, `lib/exports-api.ts` | Blob handling; AND filtering needs backend test. |
| Role-based access | Partially Implemented | `lib/page-access.ts`, `components/frontend-security-gate.tsx`, `components/role-page-access-guard.tsx` | Frontend guard only; backend authz required. |

### 5.2 Polaris Workflow Features

| Fitur | Status | Evidence | Catatan |
|---|---|---|---|
| WITS Configuration | Partially Implemented | `app/configuration/page.tsx`, `lib/api/wits.ts` | CRUD connected; sub-panels partial. |
| WITS Data Values | Partially Implemented | `app/data-management/log-data/page.tsx`, `lib/api/wits.ts` | Browser/debug, not direct raw packet input. |
| Log Data | Partially Implemented | `app/data-management/log-data/page.tsx`, `lib/mwd-edit-tools-api.ts` | Backend edit tools; direct import unavailable. |
| Survey Data | Partially Implemented | `app/data-management/survey-data/page.tsx`, `lib/surveys-api.ts` | Actual/plan/generate/recalculate/export. |
| Wellplan Survey | Partially Implemented | `app/configuration/wellplan-surveys/page.tsx` | CRUD/import CSV through survey endpoints. |
| Trajectory | Partially Implemented | `app/trajectory/page.tsx` | Vertical/plan views; snapshot clipboard. |
| Well Plot | Partially Implemented | `components/well-plot-panel.tsx`, `app/trajectory/well-plot/page.tsx` | Multi-track navigation exists. |
| Plotting | Partially Implemented | `app/data-management/plotting/page.tsx`, `lib/plot-templates-api.ts` | Template CRUD + PDF export; upload placeholder. |
| Generate LAS | Partially Implemented | `app/data-management/generate-las/page.tsx`, `lib/exports-api.ts` | Backend export; local preset/preview. |
| Settings/Threshold | Partially Implemented | `app/settings/page.tsx`, `lib/dashboard-thresholds.ts` | Threshold via WITS config; notifications partial. |
| Memory Import | Advanced/Experimental | `components/contents/data-management/memory-import-wizard.tsx` | Backend files + local demo workflow. |
| System Utilities | Partially Implemented | `app/system-utilities/page.tsx`, `lib/api/system-utilities.ts` | Admin-only; diagnostics partial. |

### 5.3 Administrative Features

| Fitur | Status | Evidence | Catatan |
|---|---|---|---|
| Admin user management | Partially Implemented | `app/admin/page.tsx`, `lib/admin-users-api.ts` | Connected to `/api/users`; needs backend authz verification. |
| Role management | Partially Implemented | `app/admin/page.tsx`, `lib/admin-roles-api.ts` | Connected to `/api/roles`. |
| Audit logs | Needs Verification | `app/admin/page.tsx`, `lib/admin-audit-logs-api.ts` | Client calls `/api/audit-logs`; backend availability must be tested. |
| System utilities | Partially Implemented | `app/system-utilities/page.tsx` | Backup/restore/clear/config backup. |
| Backup/restore | Partially Implemented | `lib/api/system-utilities.ts` | Requires backend behavior validation. |

### 5.4 Extended / Partial / Future Features

- Aux Port: Frontend Only, endpoint unavailable.
- Direct CSV/LAS import into Log Data: Placeholder/Blocked by backend.
- Memory Import local storage/correlation/gap-fill: Advanced/Experimental, local demo workflow.
- Plotting upload/attachment persistence: Placeholder.
- Charts PNG export: Placeholder/toast, not confirmed file output.
- System diagnostics process/system logs: Placeholder/Unavailable.
- PWA service worker/offline cache: Missing.
- Email/SMTP reports: Placeholder/unavailable.
- Audit logs: Needs backend verification.

## 6. Stakeholder dan Role

### Admin

Tujuan penggunaan:

- Mengelola user, role, system utilities, backup/restore/clear, dan konfigurasi berisiko.

Fitur yang boleh diakses:

- Semua fitur engineer/operator.
- Admin page.
- System Utilities.

Risiko:

- Jika hanya mengandalkan frontend guard, user non-admin dapat mencoba memanggil endpoint langsung. Backend wajib enforce admin authorization.

### Engineer

Tujuan penggunaan:

- Mengelola konfigurasi WITS, survey, log data, plotting, export, LAS, memory workflow, dan data operasional.

Fitur write yang boleh:

- WITS Config, Survey, Log Data edit tools, Export, Plotting, Rig WITS output queue generate/status update bila backend mengizinkan.

Risiko:

- Endpoint destructive seperti delete depth range, clear data, delete user, delete config harus tetap server-side protected.

### Operator

Tujuan penggunaan:

- Monitoring read-only: dashboard, Rig WITS view, charts, alerts, history, trajectory, well plot.

Fitur yang harus read-only/disembunyikan:

- WITS Config edit/delete.
- Survey create/edit/delete/generate.
- Log Data edit tools.
- Memory import/correlation apply.
- Export jika kebijakan default tetap melarang.
- System Utilities.
- Admin.

| Fitur | Admin | Engineer | Operator | Status Implementasi | Catatan |
|---|---:|---:|---:|---|---|
| Dashboard | Yes | Yes | Yes | Implemented | View. |
| Rig WITS View | Yes | Yes | Yes | Implemented/Partial | Operator can view. |
| Rig WITS Generate/Status | Yes | Yes | No | Partial | UI checks role; backend must enforce. |
| WITS Config | Manage | Manage | View/No write | Partial | `canPerformAction` and role checks exist. |
| Survey Data | Manage | Manage | View | Partial | UI warnings/disabled actions. |
| Log Data Edit Tools | Manage | Manage | View | Partial | Operator sees read-only message. |
| Memory Import | Manage | Manage | No/limited | Advanced/Experimental | Local workflow should be restricted in production. |
| Export | Yes | Yes | Default No | Partial | `page-access.ts` excludes operator from Export by default. |
| Settings Threshold | Manage | Manage | View | Partial | Operator warning on save. |
| Admin | Yes | No | No | Partial | Frontend + page guard; backend authz needed. |
| System Utilities | Yes | No | No | Partial | Admin-only UI. |

**Security note:** `FrontendSecurityGate` and `RolePageAccessGuard` are navigation/UI controls, not security boundaries. Backend production must perform authorization for every protected endpoint.

## 7. Arsitektur Frontend

| Komponen Frontend | Fungsi | File/Folder Terkait | Status | Masalah/GAP | Rekomendasi |
|---|---|---|---|---|---|
| Next.js App Router | Page routing and root layout | `mwd-app-fe/app/*` | Implemented | Root page uses SPA-like `currentPage` plus route files | Keep route behavior consistent and test direct routes. |
| Login page | Auth form, remember me, direct route fallback | `app/login/page.tsx` | Implemented | None major after optional `onLoginSuccess` fix | Add integration test. |
| FrontendSecurityGate | Redirect protected routes if unauthenticated | `components/frontend-security-gate.tsx` | Implemented | Public `/` still root app decides auth | Keep protected path registry updated. |
| RolePageAccessGuard | Role page access denial | `components/role-page-access-guard.tsx`, `lib/page-access.ts` | Partial | Local storage role access editable client-side | Backend authz required. |
| API client | Centralized REST, env base URL, bearer, no-store | `lib/api-client.ts` | Implemented | Backend source not in repo | Add contract tests. |
| AuthContext | Token/user restore, expired token event handling | `context/AuthContext.tsx`, `lib/security/storage.ts` | Implemented | Token stored in browser storage | Consider HttpOnly cookie future. |
| AppContext | Session/data/realtime/settings orchestration | `context/AppContext.tsx` | Implemented/Large | Very large context and many responsibilities | Split into domain providers/hooks. |
| Realtime client | WebSocket events and subscribe session | `lib/realtime-client.ts` | Implemented | No auth token in WS message visible; backend policy unknown | Verify WS auth/session security. |
| Security helpers | Safe error and input sanitation | `lib/security/errors.ts`, `lib/security/input.ts` | Implemented | Coverage unknown | Unit test sanitizer/error mapping. |
| UI components | shadcn/Radix style | `components/ui/*` | Implemented | Some duplicate legacy components exist | Consolidate old `components/contents/*` if unused. |
| PWA prompt | Install/update UI prompt | `context/AppContext.tsx`, `app/page.tsx` | Partial | No service worker/manifest found | Define PWA strategy before claiming full PWA. |

Audit conclusions:

- API base URL sudah dari `.env`; no hardcoded localhost runtime pada frontend core.
- `api-client.ts` menolak absolute URL pada per-request path, sehingga endpoint harus lewat centralized base URL.
- Protected requests memakai `Authorization: Bearer <token>` saat token diberikan.
- Core data utama memakai `activeMwdSessionId` pada banyak endpoint: MWD data, WITS values, surveys, export, output queue, memory correlations, system utilities.
- AppContext terlalu besar untuk jangka panjang, tetapi masih berfungsi sebagai orchestration layer.
- Banyak page besar perlu refactor: `configuration/page.tsx`, `log-data/page.tsx`, `plotting/page.tsx`, `memory-import-wizard.tsx`, `system-utilities/page.tsx`.
- Mock runtime core tidak terlihat, tetapi local/demo workflow masih ada pada Memory Import, LAS preset/preview, plotting upload metadata, dan beberapa placeholders.

## 8. Arsitektur Integrasi Backend Production

Backend production adalah source of truth operasional. Frontend tidak boleh mengandalkan mock data untuk fitur core. REST API digunakan untuk auth, sessions, MWD data, WITS config/values/alarms, surveys, plot templates, exports, memory files, depth tracking, connection status, ESP status, admin, dan system utilities. WebSocket digunakan untuk update realtime.

Jika backend error, UI harus menampilkan error state. Jika endpoint belum tersedia, UI harus menampilkan unavailable state. Jika backend kosong, UI harus menampilkan empty state.

| Frontend Page | Service/API File | Endpoint Backend | Method | Status Integrasi | Masalah/GAP | Rekomendasi |
|---|---|---|---|---|---|---|
| Login | `lib/auth-api.ts` | `/api/auth/login`, `/api/auth/me` | POST/GET | Implemented | Backend auth policy external | Test expired token/role payload. |
| App startup | `lib/mwd-sessions-api.ts` | `/api/mwd-sessions` | GET | Implemented/Partial | Backend local stub | Verify production shape. |
| Dashboard | `mwd-data-api`, `depth-tracking-api`, `connection-api`, `serial-api`, `esp-ws-api` | `/api/mwd-data`, `/api/depth-tracking/state`, `/api/connection-status`, `/api/failover-events`, `/api/serial/status`, `/api/esp-ws/status` | GET | Implemented/Partial | Stale/live indicator can improve | Add last update age. |
| Rig WITS | `mwd-data-api`, `wits-output-api` | `/api/mwd-data`, `/api/wits-output/queue`, `/api/wits-output/generate-from-latest`, `/api/wits-output/:id/status` | GET/POST/PUT | Implemented/Partial | Hardware write not proven | Label as queue, not serial write. |
| Aux Port | None | Not found | N/A | Frontend Only | Endpoint unavailable | Hide from production demo or keep unavailable. |
| Configuration | `mwd-sessions-api`, `api/wits.ts` | `/api/mwd-sessions`, `/api/wits-config` | CRUD | Partial | SMTP/report placeholders | Split production vs planned panels. |
| Log Data | `mwd-data-api`, `api/wits.ts`, `mwd-edit-tools-api.ts` | `/api/mwd-data`, `/api/wits-data-values`, `/api/mwd-data/edit/*` | GET/POST/DELETE | Partial | CSV/LAS direct import missing | Keep unavailable until backend endpoint. |
| Survey Data | `surveys-api.ts`, `exports-api.ts` | `/api/surveys*`, `/api/exports/surveys` | CRUD/POST | Partial | End-to-end backend calc needs test | Add survey workflow tests. |
| Trajectory | `surveys-api.ts` | `/api/surveys`, `/api/surveys/from-mwd-data` | GET/POST | Partial | Snapshot clipboard, not backend export | Add export endpoint if required. |
| Well Plot | AppContext/plot templates | `/api/mwd-data`, `/api/plot-templates*` | GET | Partial | Performance test needed | Add large data visual test. |
| Charts | AppContext | `/api/mwd-data` via AppContext | GET/WS | Partial | Export is toast, not file | Implement actual image/export if required. |
| History | `mwd-data-api`, `exports-api.ts` | `/api/historical-data`, `/api/exports/historical` | GET/POST | Partial/Needs Verification | Date/depth AND filtering backend unknown | Contract test filters. |
| Export | `exports-api.ts` | `/api/exports/historical` | POST | Partial/Needs Verification | Backend format behavior unknown | Test CSV/JSON blobs. |
| Memory Import | `memory-files-api.ts` | `/api/memory-files*` | GET/POST/DELETE | Partial/Advanced | Local workflow mixed | Separate production mode. |
| Generate LAS | `exports-api.ts` | `/api/exports/las` | POST | Partial | Preset/preview local | Persist presets if needed. |
| Plotting | `plot-templates-api.ts`, `exports-api.ts` | `/api/plot-templates*`, `/api/exports/pdf-plot` | CRUD/POST | Partial | Upload placeholders | Add file endpoint. |
| Settings | `api/wits.ts` | `/api/wits-config/:id` | PUT | Partial | Notifications not delivery | Add notification backend if needed. |
| Admin | `admin-users-api`, `admin-roles-api`, `admin-audit-logs-api` | `/api/users`, `/api/roles`, `/api/audit-logs` | CRUD/GET | Partial/Needs Verification | Audit backend unknown | Verify `/api/audit-logs`. |
| System Utilities | `api/system-utilities.ts` | `/api/system-utilities/*` | GET/POST | Partial | Process/system-log endpoint missing | Add diagnostics API. |

## 9. PWA Requirements

### PWA Scope

PWA dalam sistem ini bertujuan sebagai installable app shell dan akses cepat lintas perangkat. PWA bukan mekanisme untuk menyimpan data operasional realtime secara offline tanpa peringatan.

Evidence saat ini:

- Install/update prompt UI ada di `app/page.tsx`.
- State `showInstallPrompt` dan `updateAvailable` ada di `context/AppContext.tsx`.
- Tidak ditemukan manifest, service worker, Workbox, atau `next-pwa` integration pada audit `public`, `next.config.ts`, dan `package.json`.

### PWA Cache Strategy

| Resource/Data | Cache Strategy | Alasan | Risiko | Rekomendasi |
|---|---|---|---|---|
| Static assets | Cache allowed | Aman untuk UI shell | Versi lama jika update handling buruk | Tambahkan versioned assets/service worker bila PWA resmi. |
| App shell | Cache allowed with update | Installability dan load cepat | User pakai UI lama | Implement update prompt yang benar dengan SW lifecycle. |
| Help/static docs | Cache allowed | Tidak memengaruhi data operasional | Konten lama | Version info. |
| MWD data `/api/mwd-data` | Network only/no-store | Data realtime/historis harus fresh | Stale data dikira live | Pertahankan `cache: "no-store"` dan tambahkan stale indicator. |
| Connection status | Network only | Status harus aktual | False connected/offline | Jangan cache. |
| WITS values | Network only | Operasional data | Data lama menyesatkan | Jangan cache. |
| WebSocket events | No cache | Realtime stream | Tidak relevan untuk cache | Tampilkan disconnected/degraded jika offline. |
| Auth/session payload | Do not cache response | Sensitive | Token/user leak | Gunakan secure storage strategy; pertimbangkan HttpOnly cookie. |

### PWA Offline Behavior

Jika offline:

- UI boleh menampilkan app shell.
- Data live harus ditandai offline/degraded, bukan live.
- Request gagal harus menghasilkan error/unavailable state.
- WebSocket disconnected harus terlihat di dashboard/status.

### PWA Update Handling

Saat ini update prompt UI ada, tetapi belum ada service worker lifecycle. Jika PWA resmi ditambahkan, sistem harus:

- Detect new service worker.
- Prompt refresh.
- Hindari user stuck pada versi lama yang salah kontrak API.

### Risiko PWA terhadap realtime monitoring

Risiko terbesar adalah stale data tampil sebagai live. Karena itu, semua data MWD, connection status, WITS values, historical request, dan export harus network-first atau network-only dengan stale indicator.

## 10. Klasifikasi Status Fitur

### Login/Auth

- Kategori fitur: Core Monitoring.
- Deskripsi: login username/email + password, remember me, token restore, expired token handling.
- Hubungan dengan Polaris: menggantikan akses lokal/single-user dengan multi-user web auth.
- Peningkatan dibanding Polaris: role-aware, safe errors, protected route redirect.
- User role: Admin, Engineer, Operator.
- Route/page: `/`, `/login`.
- Komponen terkait: `LoginPage`, `FrontendSecurityGate`, `AuthContext`.
- API/service terkait: `POST /api/auth/login`, `GET /api/auth/me`.
- Input: username/email, password, remember me.
- Output: token, user profile, authenticated app.
- Data source: backend production.
- Status implementasi: Implemented.
- Evidence dari kode: `app/login/page.tsx`, `context/AuthContext.tsx`, `lib/security/storage.ts`, `lib/api-client.ts`.
- Mock/fallback/placeholder: tidak ada mock login.
- Error/empty state: invalid credentials, safe request error, session expired toast.
- Masalah/gap: token masih browser storage, bukan HttpOnly cookie.
- Risiko: XSS dapat membaca token jika vulnerability muncul.
- Rekomendasi perbaikan: pertimbangkan HttpOnly cookie untuk production hardening.
- Acceptance criteria: valid login masuk app; invalid login error; expired token logout dan redirect `/login`.

### MWD Session

- Kategori fitur: Core Monitoring.
- Deskripsi: memuat daftar MWD Session dan menyimpan session aktif.
- Hubungan dengan Polaris: job/session operational context.
- Peningkatan: user tidak perlu mengetik sessionId manual.
- User role: semua role.
- Route/page: global AppContext, Dashboard, Configuration, History, Export, Survey.
- API/service: `GET /api/mwd-sessions`, CRUD session via `lib/mwd-sessions-api.ts`.
- Input: token, selected session.
- Output: `activeMwdSessionId`.
- Data source: backend production.
- Status implementasi: Implemented/Partially Implemented.
- Evidence: `context/AppContext.tsx`, `lib/mwd-sessions-api.ts`, `lib/security/storage.ts`.
- Mock/fallback/placeholder: fallback name normalization bukan mock runtime.
- Error/empty state: session kosong/error ditangani di AppContext/Dashboard.
- Gap: backend local stub tidak menyediakan sessions.
- Risiko: jika backend response shape berubah, active session gagal.
- Rekomendasi: contract test `/api/mwd-sessions`.
- Acceptance criteria: session aktif digunakan semua endpoint session-scoped.

### Dashboard

- Kategori fitur: Core Monitoring.
- Deskripsi: pusat monitoring KPI, chart, connection status, events, well plot summary.
- Hubungan dengan Polaris: main monitoring screen.
- Peningkatan: compact health status, empty/error state, realtime integration.
- User role: semua role.
- Route/page: `/`, `/dashboard`.
- Komponen: `app/dashboard/page.tsx`, `RealTimeChart`, `EventStream`, `WellPlotPanel`.
- API/service: MWD data, depth tracking, connection, failover, serial, ESP, WITS config/value/alarm.
- Input: active session.
- Output: KPI, chart, status, alarm/event.
- Data source: REST + WebSocket.
- Status implementasi: Implemented/Partially Implemented.
- Evidence: `app/dashboard/page.tsx`, `context/AppContext.tsx`.
- Mock/fallback/placeholder: generated status/threshold events are derived frontend events, not backend audit records.
- Error/empty state: no MWD data alert, status unavailable labels.
- Gap: stale data visibility bisa diperkuat.
- Risiko: derived event bisa disalahartikan sebagai backend event.
- Rekomendasi: beri source label `frontend-derived` atau kirim audit/event backend.
- Acceptance criteria: KPI tetap render saat data kosong; WS status visible.

### Rig WITS / Monitoring

- Kategori fitur: Core Monitoring / Polaris Workflow.
- Deskripsi: Received Data dan Output Queue.
- Hubungan dengan Polaris: Rig WITS input/output workflow.
- Peningkatan: backend-driven, container fit, empty states, output queue actions.
- User role: semua role view; admin/engineer generate/update queue.
- Route/page: `/monitoring/rig-wits`.
- API/service: `GET /api/mwd-data`, `GET /api/wits-output/queue`, `POST /api/wits-output/generate-from-latest`, `PUT /api/wits-output/:id/status`.
- Input: active session.
- Output: received rows and queue rows.
- Data source: backend production.
- Status implementasi: Implemented/Partially Implemented.
- Evidence: `app/monitoring/rig-wits/page.tsx`, `lib/wits-output-api.ts`.
- Mock/fallback/placeholder: no mock packet stream.
- Error/empty state: `Belum ada received data...`, `Belum ada output queue...`.
- Gap: output queue belum membuktikan physical hardware write.
- Risiko: user mengira queue = sent to rig.
- Rekomendasi: label queue status jelas, tambahkan hardware sent confirmation jika backend ada.
- Acceptance criteria: received data source `/api/mwd-data?sessionId=...`; output queue source `/api/wits-output/queue`.

### Aux Port

- Kategori fitur: Core/Extended.
- Deskripsi: Aux monitoring placeholder.
- Hubungan dengan Polaris: auxiliary port workflow.
- Status implementasi: Frontend Only.
- Evidence: `app/monitoring/aux-port/page.tsx`.
- Mock/fallback/placeholder: unavailable state; disabled buttons.
- Gap: no backend endpoint.
- Risiko: jika tampil di demo utama, terlihat belum selesai.
- Rekomendasi: hide from production demo or keep explicit unavailable label.
- Acceptance criteria: no local data shown as actual.

### WITS Configuration

- Kategori fitur: Polaris Workflow.
- Deskripsi: CRUD WITS ID/config, mapping, labels, thresholds, LAS metadata.
- API/service: `/api/wits-config`.
- Status: Partially Implemented.
- Evidence: `app/configuration/page.tsx`, `lib/api/wits.ts`, `app/settings/page.tsx`.
- Placeholder: SMTP/report/system info sub-panels, backup trigger, wellplan import placeholder in configuration page.
- Gap: some configuration tabs are local UI only.
- Rekomendasi: split production-backed WITS Config from future/report/email panels.

### Log Data

- Kategori fitur: Polaris Workflow.
- Deskripsi: MWD/WITS browser and backend edit tools.
- API/service: `/api/mwd-data`, `/api/wits-data-values`, `/api/mwd-data/edit/*`.
- Status: Partially Implemented.
- Evidence: `app/data-management/log-data/page.tsx`, `lib/mwd-edit-tools-api.ts`.
- Placeholder: CSV/LAS direct import unavailable, Batch Settings Editor placeholder, local export request not backend file generation.
- Gap: direct import endpoint absent.
- Rekomendasi: keep unavailable state; define backend import endpoint if required.

### Survey Data

- Kategori fitur: Polaris Workflow.
- API/service: `/api/surveys`, `/api/surveys/from-mwd-data`, `/api/surveys/recalculate`, `/api/surveys/well-plan/import-csv`, `/api/exports/surveys`.
- Status: Partially Implemented.
- Evidence: `app/data-management/survey-data/page.tsx`, `app/configuration/wellplan-surveys/page.tsx`, `lib/survey-defaults.ts`.
- Gap: backend calculation/CSV import should be verified.
- Rekomendasi: end-to-end tests with actual survey data.

### Trajectory

- Kategori fitur: Polaris Workflow.
- API/service: `GET /api/surveys`, `POST /api/surveys/from-mwd-data`.
- Status: Partially Implemented.
- Evidence: `app/trajectory/page.tsx`.
- Improvement: snapshot now copies text to clipboard; generate actual survey from MWD exists.
- Gap: no backend trajectory export, no full 3D view in current tab.
- Rekomendasi: add export endpoint if required in Capstone/demo.

### Well Plot

- Kategori fitur: Polaris Workflow.
- Status: Partially Implemented.
- Evidence: `components/well-plot-panel.tsx`, `app/trajectory/well-plot/page.tsx`.
- Gap: performance and visual regression for many tracks not automated.
- Rekomendasi: screenshot tests desktop/tablet/mobile and large data.

### Charts

- Kategori fitur: Core Monitoring / Analysis.
- Status: Partially Implemented.
- Evidence: `app/charts/page.tsx`, `components/contents/charts/real-time-chart.tsx`.
- Mock/fallback/placeholder: PNG export currently toast/prepared message, not confirmed file generation.
- Gap: no backend export endpoint for chart image.
- Rekomendasi: either implement actual PNG export or label as prepared/coming soon.

### Alerts

- Kategori fitur: Core Monitoring.
- Status: Partially Implemented.
- Evidence: `app/alerts/page.tsx`, `context/AppContext.tsx`, `lib/api/wits.ts`.
- Data source: WITS alarms, failover/connection events, frontend-derived status/threshold events.
- Gap: derived events not backend audit; notification delivery not complete.
- Rekomendasi: add event source labels and backend audit/event persistence.

### History

- Kategori fitur: Core Monitoring.
- Status: Partially Implemented/Needs Verification.
- Evidence: `app/history/page.tsx`, `lib/mwd-data-api.ts`, `lib/exports-api.ts`.
- Gap: filtering partly frontend for loaded records; backend historical filtering must be verified.
- Rekomendasi: backend filter contract tests.

### Export

- Kategori fitur: Core Monitoring.
- Status: Partially Implemented/Needs Verification.
- Evidence: `app/export/page.tsx`, `lib/exports-api.ts`.
- Gap: backend support for combined `measuredFrom/measuredTo/depthMin/depthMax` AND filtering must be verified.
- Acceptance criteria: empty/null filter fields not sent, response downloaded as blob.

### Memory Import

- Kategori fitur: Advanced/Experimental Polaris Workflow.
- Status: Partially Implemented / Mock-Fallback / Advanced.
- Evidence: `components/contents/data-management/memory-import-wizard.tsx`, `lib/memory-files-api.ts`, `lib/memory-import.ts`.
- Backend connected: memory files list/import/detail/points/correlate/correlations/delete.
- Local/demo: storage WITS ID registration, local segment import, local-only correlation settings, local gap fill.
- Gap: production vs demo mode mixed in one wizard.
- Rekomendasi: explicit production mode toggle or separate screens.

### Generate LAS

- Kategori fitur: Polaris Workflow.
- Status: Partially Implemented.
- Evidence: `app/data-management/generate-las/page.tsx`, `lib/exports-api.ts`.
- Backend: `POST /api/exports/las`.
- Local: preset state and preview generated locally.
- Gap: LAS preset persistence backend absent.
- Rekomendasi: persist presets or label local preset.

### Plotting

- Kategori fitur: Polaris Workflow.
- Status: Partially Implemented.
- Evidence: `app/data-management/plotting/page.tsx`, `lib/plot-templates-api.ts`, `lib/exports-api.ts`.
- Backend: plot template CRUD, MWD data preview, PDF plot export.
- Placeholder/local: file upload endpoint unavailable, uploaded file metadata local, curve settings saved locally in some UI, color-map placeholder.
- Rekomendasi: add file upload/persistence endpoint and clarify local-only states.

### Settings

- Kategori fitur: Polaris Workflow / Administration.
- Status: Partially Implemented.
- Evidence: `app/settings/page.tsx`, `lib/dashboard-thresholds.ts`, `lib/api/wits.ts`.
- Backend: threshold save via WITS config update.
- Local: display/theme/units/refresh settings in local storage.
- Gap: notification delivery absent.
- Rekomendasi: separate display preferences from operational backend config.

### Admin

- Kategori fitur: Administrative.
- Status: Partially Implemented / Needs Verification.
- Evidence: `app/admin/page.tsx`, `lib/admin-users-api.ts`, `lib/admin-roles-api.ts`, `lib/admin-audit-logs-api.ts`.
- Backend: `/api/users`, `/api/roles`, `/api/audit-logs`.
- Gap: endpoint availability and backend authz need production verification.
- Rekomendasi: test all admin endpoints as admin/engineer/operator.

### System Utilities

- Kategori fitur: Administrative.
- Status: Partially Implemented.
- Evidence: `app/system-utilities/page.tsx`, `lib/api/system-utilities.ts`.
- Backend: clear-data targets/preview, backup-session, clear-data, restore-session, config-backup/restore.
- Placeholder: process/system log diagnostics endpoint unavailable.
- Rekomendasi: add diagnostics endpoint or keep unavailable.

### Help

- Kategori fitur: Support.
- Status: Frontend Only.
- Evidence: `app/help/page.tsx`.
- Gap: static documentation not yet deeply Polaris-specific.
- Rekomendasi: add role-specific Polaris-to-web workflow guidance.

## 11. Analisis Modul Frontend

### 11.1 Login/Auth

- Login flow: `LoginPage` normalizes identifier, validates non-empty credentials, calls `login`, and redirects via prop or `router.replace("/")`.
- Token storage: `lib/security/storage.ts` writes token/user to localStorage or sessionStorage based on remember me.
- Token expired handling: `api-client.ts` calls `notifyAuthSessionInvalid`; `AuthContext` subscribes and clears session, then redirects `/login`.
- Direct `/login` route: fixed compared prior audit because `onLoginSuccess` optional.
- Error handling: `getSafeErrorMessage` prevents leaking stack/SQL/token/password-like messages.
- Gap: token is still accessible to JS storage; security hardening should consider HttpOnly cookie.

### 11.2 MWD Session

- Source: `/api/mwd-sessions`.
- Active state: `activeMwdSessionId` in AppContext and `mwd_active_session_id` storage.
- Session switching: AppContext resolves valid active session and updates local storage.
- Empty/error: dashboard and session selectors show unavailable/empty states.
- Gap: production backend source unavailable locally; response shape normalized defensively.

### 11.3 Dashboard

- KPI and latest MWD data: AppContext builds KPI from `/api/mwd-data`, WITS values, thresholds.
- Connection status: REST + WebSocket status.
- ESP/WebSocket status: `/api/esp-ws/status` and realtime event.
- Empty: no MWD data alert and empty KPI values.
- Stale data: not yet strong enough; last received exists but stale threshold UX could improve.
- Data source: backend production via AppContext, no mock core runtime.

### 11.4 Rig WITS / Monitoring

- Received Data source: `/api/mwd-data`.
- Output Queue source: `/api/wits-output/queue`.
- Actions: generate latest output, update queue status for allowed roles.
- Operator read-only: `canGenerateLatestOutput` restricts manual generation to admin/engineer.
- Gap: hardware write not verifiable; queue must not be marketed as actual serial output.

### 11.5 Aux Port

- Endpoint: not found.
- UI: unavailable state and disabled actions.
- Recommendation: keep hidden or explicitly unavailable in production demo.

### 11.6 Configuration

- WITS Config: backend CRUD exists.
- Session metadata: create/update MWD Session exists.
- Wellplan: dedicated page connected; main configuration has older wellplan placeholder sections.
- SMTP/report: local UI-only placeholders.
- Operator: can view; write functions warn/disable.
- Gap: large page and mixed production/future panels.

### 11.7 Log Data

- Data browser: `/api/mwd-data`, `/api/wits-data-values`, grouped WITS.
- Edit tools: hide/unhide/delete-depth/move/copy/rescale via backend preview/apply.
- CSV/LAS direct import: blocked by backend unavailable state.
- Batch settings editor: placeholder action.
- Destructive confirmation: present for delete/hide/unhide/apply flows.
- Mock/local: rescale local estimate shown, but backend preview required before apply.

### 11.8 Survey Data

- Actual survey CRUD via `/api/surveys`.
- Plan survey via stationType `plan`.
- Generate from MWD via `/api/surveys/from-mwd-data`.
- Recalculate via `/api/surveys/recalculate`.
- CSV import via `/api/surveys/well-plan/import-csv`.
- Export survey via `/api/exports/surveys`.
- Validation: numeric input and active session checks.
- Operator access: read-only warnings and disabled actions.

### 11.9 Trajectory

- Source: `/api/surveys` for actual and plan.
- Generate: can call `/api/surveys/from-mwd-data`.
- Empty: no trajectory survey data message.
- Snapshot: clipboard/text snapshot, not backend file.
- Visual accuracy: vertical/plan views need visual regression for depth-down and overlap.

### 11.10 Well Plot

- Multi-track and navigation exist.
- Depends on AppContext MWD data and plot template configuration.
- Needs visual/performance check for many tracks/large records.

### 11.11 Charts

- Data source: `chartData` from AppContext.
- Parameter selection and normalized/raw views exist.
- Empty message exists in `RealTimeChart`.
- Export: currently toast/prepared, not file export.
- Gap: no actual PNG/blob output.

### 11.12 Alerts

- Sources: WITS alarms, connection events, failover events, derived threshold/status events.
- Acknowledge/resolve: AppContext updates local event state and calls backend for known WITS alarm IDs.
- Notification placeholders: notification tab is event list; delivery pipeline not implemented.
- Gap: derived frontend events not persisted.

### 11.13 History

- Date/depth filters exist.
- Uses active session.
- Loads historical/MWD data and exports historical selection.
- Pagination not clearly implemented.
- Backend query/filter behavior needs end-to-end test.

### 11.14 Export

- Historical CSV/JSON formats.
- Date range and depth range payload builder.
- Blob handling via `downloadBlob`.
- No dummy fallback.
- Gap: backend combined filter semantics.

### 11.15 Memory Import

- Backend memory file endpoints implemented in client.
- Local scan/helper remains prominent.
- Dry-run/apply correlation backend exists.
- Production vs demo separation is not strong enough.
- Should be labeled Advanced/Experimental until local workflow is cleaned.

### 11.16 Generate LAS

- Uses backend WITS config to build available LAS columns.
- Local preset and preview.
- Backend export uses `/api/exports/las`.
- Role access: admin/engineer export.
- Status: partial.

### 11.17 Plotting

- Plot templates persisted via backend endpoints.
- MWD preview from backend data.
- PDF export via backend.
- Upload/attachment and some label/file actions endpoint unavailable/local metadata.
- Needs backend file store.

### 11.18 Settings

- Thresholds from WITS Config and saved through WITS config update.
- Display/theme/units local settings.
- Notifications tab lists events, not notification delivery configuration.
- Operator read-only.

### 11.19 Admin

- User management and role management connected.
- Audit logs client/page connected but needs backend verification.
- Backend health uses `/api/roles` reachability.
- Admin-only protection present in UI.

### 11.20 System Utilities

- Backup, restore, clear data, config backup/restore connected.
- Admin-only checks and confirmation present.
- Diagnostics panel uses available status and honestly marks process/system-log endpoint unavailable.

### 11.21 Help

- Static help page exists.
- Needs stronger Polaris workflow guidance and role-specific instructions.

## 12. Functional Requirements

| ID | Requirement | Aktor | Trigger | Precondition | Main Flow | Alternative Flow | API/Service | Input | Output | Status | Gap | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FR-01 | Authentication and Session Restore | All | Login/open app | Backend auth available | Login, store token, fetch user | 401 returns invalid, expired token clears session | `/api/auth/login`, `/api/auth/me` | Credentials | User/token | Implemented | Token JS storage | Valid login opens app; expired token redirects login. |
| FR-02 | Role-Based Access Control | All | Navigate | User role loaded | Check page access | Denied page shown | `page-access.ts` | Role/page | Access/denial | Partial | Backend authz unknown | Operator cannot access admin/system utilities UI. |
| FR-03 | MWD Session Management | All | Startup/session switch | Token | Load sessions, resolve active | Empty/error state | `/api/mwd-sessions` | Token | Active session | Partial | Backend source external | All data requests use active session. |
| FR-04 | Realtime Dashboard Monitoring | All | Data event/poll | Active session | REST load + WS update | WS disconnected status | `/api/mwd-data`, WS `mwd-data` | Session | KPI/chart | Implemented/Partial | Stale indicator | Live/disconnected visible. |
| FR-05 | Rig WITS Data Monitoring | All | Open Rig WITS | Active session | Load MWD data and queue | Empty/error state | `/api/mwd-data`, `/api/wits-output/*` | Session | Received/queue | Partial | Hardware write unverified | Queue labeled as queue. |
| FR-06 | WITS Configuration | Admin/Engineer | Edit config | Role/token | CRUD WITS config | Operator read-only | `/api/wits-config` | WITS fields | Config row | Partial | Mixed placeholders | Save calls backend. |
| FR-07 | Log Data Management | Admin/Engineer | Edit log | Active session | Preview/apply backend edit tools | Operator read-only | `/api/mwd-data/edit/*` | Range/field | Result | Partial | Import missing | Apply requires backend preview. |
| FR-08 | Survey Data Management | Admin/Engineer | Survey action | Active session | CRUD/generate/recalc/import/export | Operator view | `/api/surveys*` | Survey/depth | Survey rows/blob | Partial | E2E calc verification | Operator cannot mutate. |
| FR-09 | Trajectory Analysis | All | Open trajectory | Active session | Load actual/plan survey | Empty state | `/api/surveys` | Session | Charts | Partial | Export/3D not full | No data message if empty. |
| FR-10 | Well Plot Visualization | All | Open well plot | Data/template | Render multi-track | Empty state | AppContext/plot templates | MWD data | Plot | Partial | Performance test | Multi-track navigation works. |
| FR-11 | Charts and Parameter Analysis | All | Open charts | Chart data | Render parameter charts | Empty chart message | AppContext | ChartData | Charts | Partial | PNG export placeholder | No data message shown. |
| FR-12 | Connection Status Monitoring | All | Poll/WS | Token | Load connection/failover | Derived status event | `/api/connection-status`, `/api/failover-events` | Session | Status/events | Partial | Backend semantics | Offline/degraded visible. |
| FR-13 | ESP/Gateway/WebSocket Status Monitoring | All | Poll/WS | Token | Load ESP/WS status | Raw packet unavailable state | `/api/esp-ws/status`, WS event | Status payload | Gateway status | Partial | Raw packet backend payload unknown | Raw shown only if backend sends. |
| FR-14 | Alerts and Events | All | Alarm/status event | AppContext events | Filter active/ack/resolved | Empty notifications | `/api/wits-alarms*` | Event ID/note | Event state | Partial | Derived events local | WITS alarm ack calls backend. |
| FR-15 | Historical Data Browser | All | Open History | Session | Filter/load records | No result state | `/api/historical-data` | Filters | Records | Partial | Pagination unclear | Filters visible. |
| FR-16 | Historical Data Export | Admin/Engineer | Export | Session/token | Send date/depth payload, download blob | Backend error state | `/api/exports/historical` | Filters/format | CSV/JSON blob | Needs Verification | AND filter backend | No dummy fallback. |
| FR-17 | LAS Export | Admin/Engineer | Generate LAS | WITS config/session | Build payload, download LAS | Backend error | `/api/exports/las` | Preset/session | LAS blob | Partial | Preset local | Preview labeled local. |
| FR-18 | PDF/Plot Export | Admin/Engineer | Download PDF | PDF format/session | Send payload, download PDF | Endpoint error | `/api/exports/pdf-plot` | Template/data | PDF blob | Partial | File uploads local | PDF export calls backend. |
| FR-19 | Memory File Workflow | Admin/Engineer | Import/correlate | Token/session | Backend import/detail/points/correlate | Local demo helper | `/api/memory-files*` | CSV/mapping | File/correlation | Advanced/Partial | Production/demo mixed | Local flow labeled. |
| FR-20 | Settings and Threshold Management | Admin/Engineer | Save setting | Role/token | Update local display or WITS thresholds | Operator view | `/api/wits-config/:id` | Thresholds | Config | Partial | Notifications partial | Threshold search/save works. |
| FR-21 | Admin User Management | Admin | Admin page | Admin token | CRUD users/roles | Access denied | `/api/users`, `/api/roles` | User/role | User/role list | Partial | Backend authz | Non-admin blocked UI. |
| FR-22 | System Utilities | Admin | Backup/restore/clear | Admin/session | Execute utility endpoints | Confirmation/validation | `/api/system-utilities/*` | Targets/backup | JSON/action result | Partial | Diagnostics missing | Clear requires preview/confirm. |
| FR-23 | Help and User Guidance | All | Open Help | None | Show help docs | N/A | None | N/A | Static content | Frontend Only | Needs Polaris-specific docs | Help accessible. |
| FR-24 | PWA Installable Shell | All | Prompt after delay | Browser | Show install prompt UI | Dismiss | AppContext state | User action | Prompt | Partial | No SW/manifest | Prompt shown, not full PWA. |
| FR-25 | PWA Offline/Degraded State | All | Offline | App shell | Show offline/degraded | No stale live data | API no-store/WS status | Network state | Status | Missing/Partial | No SW strategy | Realtime data not silently cached. |
| FR-26 | Backend Production Integration | Engineers | Deploy/configure | Env vars | Use env base URL | Missing env error | `api-client.ts` | Env | Requests | Implemented | Backend external | Absolute per-request URL rejected. |
| FR-27 | Operator Read-Only Mode | Operator | Open write pages | Role operator | Hide/disable/warn | Backend denies | Role checks | Role | View-only | Partial | Backend enforcement unknown | Operator cannot mutate through UI. |
| FR-28 | Error/Empty/Unavailable State Handling | All | Backend empty/error/missing | Request fails/empty | Render message | Toast/alert | All service pages | Response | User-visible state | Partial | Not fully standardized | No fake production data. |

## 13. Non-Functional Requirements

| ID | NFR | Deskripsi | Alasan | Target/Indikator | Implementasi Saat Ini | Gap | Risiko | Rekomendasi Pengujian |
|---|---|---|---|---|---|---|---|---|
| NFR-01 | Realtime Responsiveness | UI update quickly from WS/REST | Monitoring MWD needs low latency | WS connected, data updates < few seconds | WS client + polling | Latency metric missing | Late decisions | Simulate WS events. |
| NFR-02 | Data Freshness | Stale data visible | Avoid false live state | Last received + stale badge | Last received exists | Stale UX weak | Old data treated live | Add stale threshold test. |
| NFR-03 | Backend Availability Handling | Error/unavailable state | Backend may fail | No fake fallback | Many error states | Not standardized | Confusing UX | Force 500/404 tests. |
| NFR-04 | WebSocket Reliability | Reconnect and subscription | Realtime stream unstable | Auto reconnect, resubscribe | Implemented in `realtime-client.ts` | Auth policy unknown | Unauthorized stream | Test reconnect/session switch. |
| NFR-05 | Security and Token Handling | Protect token/session | Multi-user app | Clear invalid token | Implemented with invalid event | JS storage | XSS token risk | Security review. |
| NFR-06 | Role-Based Security | Backend enforces role | Frontend guard insufficient | 403 on forbidden endpoints | UI guards exist | Backend unknown | Privilege escalation | Role endpoint test matrix. |
| NFR-07 | PWA Installability | Installable shell | Field access | Manifest/SW/prompt | Prompt only | No manifest/SW | Not true PWA | PWA audit. |
| NFR-08 | PWA Cache Safety | Avoid stale realtime | Safety critical | Network-only data | API no-store | No SW policy | Stale live data | Offline/cache tests. |
| NFR-09 | Cross-Device Compatibility | Desktop/tablet/mobile | Rig/site devices vary | Responsive layouts | Tailwind responsive | Visual regression manual | Broken charts/cards | Screenshot tests. |
| NFR-10 | Usability/Polaris Familiarity | Familiar workflow | User adoption | Polaris-like modules | Modules present | Some placeholders | Confusion | User workflow review. |
| NFR-11 | Maintainability | Manageable code | Long-term changes | Feature components | API services modular | Large pages | High churn | Refactor tests. |
| NFR-12 | Modularity | Domain service files | Clear integration | Services per endpoint | Present | AppContext large | Coupling | Split providers. |
| NFR-13 | API Consistency | Contract consistency | FE/BE mismatch risk | Typed/OpenAPI | Normalizers defensive | No shared schema | Runtime mismatch | Contract tests. |
| NFR-14 | Error Handling | Safe, clear errors | Avoid leaks/confusion | Safe messages | `getSafeErrorMessage` | Some toasts generic | Poor diagnosis | Error-state snapshots. |
| NFR-15 | Data Integrity | Accurate depth/time/survey | Operational correctness | Backend validation | UI validates | Backend unknown | Wrong export/plot | E2E compare known data. |
| NFR-16 | Export Reliability | Blob/file correct | Reporting | Valid file and filters | Blob handling | Backend filter unknown | Incorrect report | Export contract tests. |
| NFR-17 | Large Data Performance | Tables/charts scale | Historical MWD can be large | Pagination/windowing | In-memory rendering common | No virtualization | Slow UI | Load test large records. |
| NFR-18 | Accessibility/Readability | Usable in field | Low error operation | Clear contrast, labels | Many labels/alerts | Full a11y not audited | Accessibility gaps | Keyboard/screen reader tests. |
| NFR-19 | Observability/Diagnostics | Troubleshoot system | Backend/hardware issues | Logs/process/status | Status panels | Process logs unavailable | Hard debugging | Add diagnostics API tests. |
| NFR-20 | Configuration Safety | Safe config changes | WITS/settings critical | Confirmation/audit | Some confirms | Audit logs unverified | Bad config changes | Audit/rollback tests. |

## 14. Data Flow Frontend

| Flow | Trigger | Actor | Frontend State | API Endpoint | Input | Output | UI Result | Error State | Role Restriction | Gap |
|---|---|---|---|---|---|---|---|---|---|---|
| A. Login Flow | Submit credentials | All | username/password/loading/error | `/api/auth/login`, `/api/auth/me` | credentials | token/user | app opens | safe error | none | token storage hardening |
| B. Token Restore Flow | App load | Returning user | bootstrap token/user | `/api/auth/me` | token | user | restored session | clear session | none | backend token TTL unknown |
| C. Token Expired Flow | 401/expired message | Any | auth invalid event | Any protected API | token | logout | redirect `/login` | toast warning | none | needs E2E |
| D. MWD Session Load | Authenticated | All | mwdSessions/loading/error | `/api/mwd-sessions` | token | sessions | selector/session context | session error | role via backend | backend source external |
| E. Dashboard Data | Active session | All | KPI/chart/status/events | many GET endpoints | sessionId | data/status | dashboard | empty/error | view | stale marker weak |
| F. WebSocket Flow | Auth/session | All | realtimeStatus/subscribedSession | WS URL | sessionId | realtime event | data/status update | disconnected/error | backend policy | WS auth unknown |
| G. Rig WITS Flow | Page load/refresh | All | received/queue | `/api/mwd-data`, `/api/wits-output/*` | sessionId | rows | panels | empty/error | action role | hardware write unverified |
| H. WITS Config Flow | Config/settings | Admin/Engineer | config list/draft | `/api/wits-config` | WITS fields | config | table/editor | error | operator read-only | mixed placeholder panels |
| I. Survey Flow | Survey page/action | Admin/Engineer | surveyRecords | `/api/surveys*` | station/payload | records | table/trajectory | error | operator read-only | backend calc test |
| J. Trajectory Flow | Open/generate | All/Engineer | actual/plan surveys | `/api/surveys`, `/api/surveys/from-mwd-data` | sessionId | points | charts | empty/error | generate restricted by token/role expectation | export missing |
| K. History Flow | Filter/load | All | historicalRecords | `/api/historical-data` | filters | records | history view | no result/error | view | pagination unclear |
| L. Export Flow | Export click | Admin/Engineer | export loading | `/api/exports/*` | filters/format | blob | download | backend error | operator restricted | backend filter verify |
| M. Alerts Flow | Alarm/status | All | events | `/api/wits-alarms*` | eventId/note | ack/resolve | tabs/counts | error | actions should backend role | derived events local |
| N. Settings Flow | Edit settings | Admin/Engineer | settings/thresholdDrafts | `/api/wits-config/:id` | thresholds/local prefs | config/local storage | saved state | error | operator read-only | notification delivery missing |
| O. Admin Flow | Admin page | Admin | users/roles/audit | `/api/users`, `/api/roles`, `/api/audit-logs` | admin token | lists | admin tabs | backend error | admin only | audit needs verification |
| P. PWA Install/Update | Timer/update state | All | showInstallPrompt/updateAvailable | none visible | click | dismissed/refresh | prompt | none | none | no service worker |
| Q. Offline/Degraded | Network fail | All | errors/realtime status | failed REST/WS | none | error state | offline/degraded | unavailable | none | no full offline mode |

## 15. Mock, Fallback, Placeholder, dan Mismatch Audit

| Area/Fitur | Jenis Masalah | Lokasi File | Deskripsi Masalah | Dampak | Prioritas | Rekomendasi |
|---|---|---|---|---|---:|---|
| Backend lokal | Mismatch | `mwd-app-be/src/server.ts` | Backend repo lokal hanya `GET /`; production backend source tidak ada | Endpoint/security tidak bisa diaudit lokal | P0 Critical | Sediakan backend production source atau OpenAPI + tests. |
| Frontend role guard | Security gap | `components/frontend-security-gate.tsx`, `components/role-page-access-guard.tsx`, `lib/page-access.ts` | Guard frontend bukan boundary security | User bisa call API langsung | P0 Critical | Backend authz per endpoint. |
| PWA | Missing/Partial | `app/page.tsx`, `context/AppContext.tsx`, `public`, `next.config.ts` | Prompt ada, service worker/manifest tidak ditemukan | Klaim PWA penuh belum valid | P1 High | Tambah PWA strategy, manifest, SW. |
| Aux Port | Placeholder | `app/monitoring/aux-port/page.tsx` | Endpoint backend unavailable, buttons disabled | Feature incomplete | P2 Medium | Hide or define AUX endpoint. |
| Memory local storage | Mock/Fallback/Advanced | `memory-import-wizard.tsx`, `lib/memory-import.ts` | Storage WITS ID, local dataset, gap fill local | User confusion production vs demo | P1 High | Separate backend production workflow. |
| Memory local-only correlation | Mock/Fallback | `memory-import-wizard.tsx` | UI says apply local-only correlation | Could be mistaken as backend data mutation | P1 High | Disable in production or label strongly. |
| Configuration SMTP/reports | Placeholder | `app/configuration/page.tsx` | SMTP/report settings local UI-only | Feature appears but not operational | P2 Medium | Create backend endpoints or keep disabled. |
| Configuration backup trigger | Placeholder | `app/configuration/page.tsx` | Phase 2 placeholder toast | No backend action | P3 Low | Route to System Utilities or remove. |
| Log Data direct import | Placeholder/Blocked | `app/data-management/log-data/page.tsx` | CSV/LAS import endpoint unavailable | Import workflow incomplete | P1 High | Define backend import endpoint. |
| Log Data batch settings | Placeholder | `app/data-management/log-data/page.tsx` | Batch Settings Editor toast only | Action incomplete | P2 Medium | Persist batch settings or disable. |
| Log Data local export request | Placeholder | `app/data-management/log-data/page.tsx` | File generation backend integration point | User may expect file | P2 Medium | Wire to export endpoint. |
| Generate LAS preset | Local state | `app/data-management/generate-las/page.tsx` | Preset add/duplicate/delete local | Lost on reload | P2 Medium | Persist preset backend/local clearly. |
| Generate LAS preview | Local preview | `app/data-management/generate-las/page.tsx` | Preview generated locally | May differ from backend LAS output | P2 Medium | Label preview approximate or backend preview endpoint. |
| Plotting upload | Placeholder | `app/data-management/plotting/page.tsx` | Upload endpoint unavailable | PDF builder incomplete | P2 Medium | Add upload/file store endpoint. |
| Plotting uploaded metadata | Local state | `app/data-management/plotting/page.tsx` | Uploaded files stored local metadata | Not production persistence | P2 Medium | Persist attachment metadata/files. |
| Plotting curve settings local toast | Local state | `app/data-management/plotting/page.tsx` | Some curve settings saved locally | Inconsistent persistence | P2 Medium | Persist all template edits through backend. |
| Charts export | Placeholder | `app/charts/page.tsx` | Export toast says prepared, no file confirmed | Misleading export | P2 Medium | Implement PNG/blob export. |
| System diagnostics | Unavailable | `app/system-utilities/page.tsx` | Process/system log endpoint not integrated | Admin troubleshooting limited | P2 Medium | Add diagnostics/process-log API. |
| Admin audit logs | Needs Verification | `app/admin/page.tsx`, `lib/admin-audit-logs-api.ts` | Client calls endpoint but backend availability unknown | Auditability uncertain | P1 High | Verify/implement `/api/audit-logs`. |
| Derived events | Frontend-derived | `context/AppContext.tsx` | `generated-*` threshold/status events generated in FE | Not backend audit/source of truth | P2 Medium | Label source or persist to backend. |
| Stale data visibility | Missing/Partial | `app/dashboard/page.tsx`, `context/AppContext.tsx` | Last received exists but stale state not consistently emphasized | Old data may be treated as live | P1 High | Add stale badge/timer. |

## 16. Kelebihan dan Kecocokan Sistem

| Kelebihan | Bukti dari Kode/PRD | Dampak Positif | Catatan Penguatan |
|---|---|---|---|
| Polaris workflow retained | Routes for WITS, Log Data, Survey, Trajectory, Well Plot, Plotting, Export, Memory, Utilities | User lama tidak mulai dari nol | Tambahkan narasi Polaris di Help. |
| Backend production env-driven | `.env`, `.env.example`, `api-client.ts` | Deployment lebih fleksibel | Tambah env validation docs. |
| Centralized API client | `lib/api-client.ts` | Auth/cache/error konsisten | Tambah request tracing if needed. |
| No-store API requests | `api-client.ts` | Mengurangi risiko stale data | Tetap jangan cache realtime data PWA. |
| WebSocket realtime | `lib/realtime-client.ts`, `AppContext.tsx` | Data/status update lebih cepat | Tambah latency metric. |
| Active MWD Session | `AppContext`, `mwd-sessions-api.ts` | Data tidak salah session | Contract test. |
| Role-based navigation | `page-access.ts`, guards | UI sesuai role | Backend authz mandatory. |
| Dashboard as control center | `dashboard/page.tsx` | Monitoring lebih terpadu | Stale status enhancement. |
| Empty/error/unavailable honest | Multiple pages, Aux, Log Data, System Utilities | Tidak menampilkan data palsu | Standarisasi component. |
| Export blob handling | `exports-api.ts`, Export/LAS/Plot pages | Report backend-driven | Backend tests. |
| Operator read-only direction | Survey/Log/Settings/Rig WITS checks | Mengurangi risiko accidental write | Enforce server-side. |
| Modular service API | `lib/*-api.ts` | Integrasi jelas per domain | Add generated API types. |
| PWA potential | install/update prompt | Akses lebih cepat | Butuh manifest/SW. |

## 17. Kekurangan, Kecacatan, dan Risiko

| No | Kekurangan/Kecacatan | Modul | Dampak | Tingkat Risiko | Perbaikan yang Dibutuhkan | Prioritas |
|---:|---|---|---|---|---|---:|
| 1 | Backend production source tidak ada di repo | Backend | Endpoint/security tidak bisa diaudit lokal | Critical | Tambah backend source/OpenAPI/tests | P0 |
| 2 | Backend authorization belum terbukti | Security | Privilege escalation | Critical | Test per endpoint/role | P0 |
| 3 | Token di browser storage | Auth | XSS token exposure | High | HttpOnly cookie/secure storage review | P1 |
| 4 | AppContext terlalu besar | Frontend architecture | Maintenance sulit | Medium | Split domain providers | P1 |
| 5 | Page terlalu panjang | Configuration/Log/Plotting/Memory/System | Bug risk | Medium | Refactor components | P1 |
| 6 | Operator mode bergantung UI | RBAC | Bypass via API | Critical | Backend authz | P0 |
| 7 | Memory local/demo mixed | Memory | User confusion/data risk | High | Separate production/demo | P1 |
| 8 | Aux Port frontend-only | Aux Port | Incomplete feature visible | Medium | Hide or implement endpoint | P2 |
| 9 | Diagnostics missing | Utilities | Troubleshooting limited | Medium | Process/log endpoints | P2 |
| 10 | Audit logs unverified | Admin | Low auditability | High | Verify/implement endpoint | P1 |
| 11 | Export filters need verification | Export/History | Incorrect reports | High | Backend AND filter tests | P1 |
| 12 | LAS/PDF partial | Export/Plotting | Report workflow incomplete | Medium | Persist templates/files, backend preview | P2 |
| 13 | Notification placeholder | Settings/Alerts | Alert delivery incomplete | Medium | Notification backend/browser integration | P2 |
| 14 | PWA not full | PWA | Overclaim install/offline capability | Medium | Manifest/SW/cache policy | P1 |
| 15 | Stale data not prominent | Dashboard | Old data seen as live | High | Stale timer/badge | P1 |
| 16 | Large tables no virtualization | Log/History/Memory | Slow UI | Medium | Pagination/virtualized table | P2 |
| 17 | Charts export toast only | Charts | Misleading action | Medium | Implement actual export | P2 |
| 18 | Some local settings not backend persisted | Settings/Plot/LAS | State lost/inconsistent | Medium | Persist or label local preferences | P2 |
| 19 | Response normalizers are defensive | API | Hidden backend contract drift | Medium | Contract tests/shared schema | P1 |
| 20 | Visual correctness untested | Trajectory/Well Plot/Rig WITS | Demo bugs missed | Medium | Screenshot regression tests | P1 |

## 18. Acceptance Criteria

| ID | Modul | Scenario | Given | When | Then | Status Saat Ini | Gap |
|---|---|---|---|---|---|---|---|
| AC-01 | Auth | Login valid | Valid credentials | Submit login | Token saved and dashboard/root opens | Implemented | Needs E2E |
| AC-02 | Auth | Login invalid | Invalid credentials | Submit login | Safe error shown | Implemented | None |
| AC-03 | Auth | Token expired | Stored expired token | Any API returns 401/expired | Session cleared, redirect `/login` | Implemented | Needs backend test |
| AC-04 | Session | Load MWD sessions | Authenticated user | App starts | `/api/mwd-sessions` loads | Implemented/Partial | Backend source external |
| AC-05 | Session | No active session | No sessions/invalid selected | Dashboard opens | Clear empty state shown | Implemented | Need visual test |
| AC-06 | Dashboard | Live data | Active session + MWD data | REST/WS data arrives | KPI/chart update | Implemented/Partial | Stale marker |
| AC-07 | Dashboard | No data | Active session, empty MWD data | Dashboard renders | KPI cards still shown with empty values | Implemented | None |
| AC-08 | WebSocket | Disconnected | WS closes | Client detects close | Status disconnected/reconnecting | Implemented | Needs E2E |
| AC-09 | WebSocket | Reconnect | WS recovers | Socket opens | Subscribe session resent | Implemented | Needs E2E |
| AC-10 | Rig WITS | Data tampil | Backend returns MWD data | Page loads | Received Data shown | Implemented | None |
| AC-11 | Operator | Read-only | Operator user | Opens write module | Write controls hidden/disabled/warn | Partial | Backend authz |
| AC-12 | WITS Config | Engineer edit | Engineer + config | Save | `PUT /api/wits-config/:id` | Partial | Backend validation |
| AC-13 | Survey | Create/edit | Engineer/admin | Save survey | Backend survey saved/refreshed | Partial | E2E |
| AC-14 | Trajectory | No data | No surveys | Open trajectory | No trajectory message | Implemented | None |
| AC-15 | Well Plot | Multi-track | Many tracks | Open Well Plot | Track navigation/multi-track visible | Implemented/Partial | Visual test |
| AC-16 | Alerts | Acknowledge | Active WITS alarm | Acknowledge | Backend called for known WITS alarm | Partial | Derived events local |
| AC-17 | History | Filter | Date/depth input | Apply/export | Filter payload used | Partial | Backend AND verification |
| AC-18 | Export | CSV/JSON | Export form | Submit | Blob downloaded, no dummy fallback | Partial | Backend verification |
| AC-19 | Export | Backend error | Backend returns error | Export submit | Safe error shown | Implemented | None |
| AC-20 | Memory | Local/demo labeled | Memory workflow | User uses local scan | UI clearly says local/demo | Partial | Separation needed |
| AC-21 | Aux Port | Unavailable | Open Aux | No endpoint | Unavailable state and disabled actions | Implemented | None |
| AC-22 | Admin | Non-admin blocked | Engineer/operator | Open `/admin` | Access denied/restricted | Partial | Backend authz |
| AC-23 | Utilities | Confirmation | Admin clear data | Preview and confirm | Confirm destructive action before clear | Implemented/Partial | Backend E2E |
| AC-24 | PWA | Installable | Supported browser | Prompt appears | Install prompt shown | Partial | No real SW/manifest |
| AC-25 | PWA | Offline state | Network offline | App opens | Offline/degraded state, no stale live data | Missing/Partial | Needs SW/offline design |
| AC-26 | PWA | No stale live data | Cached shell | API unavailable | Data not shown as live from cache | Partial | API no-store; no SW |
| AC-27 | Role navigation | Operator role | Sidebar/root navigation | User navigates | Restricted pages not accessible | Partial | Local storage guard |
| AC-28 | State handling | Empty/error/unavailable | Backend empty/error/missing | Page loads | Clear message shown | Partial | Standardization |

## 19. Roadmap Perbaikan

| Prioritas | Item | Modul | Alasan | Tindakan Teknis | Output yang Diharapkan |
|---|---|---|---|---|---|
| P0 | Backend production contract | Backend/API | Source backend tidak ada di repo | Tambah backend source/OpenAPI/contract tests | Endpoint dan role jelas |
| P0 | Backend role authorization | Security | Frontend guard bypassable | Test admin/engineer/operator per endpoint | Operator read-only aman |
| P0 | Core data no mock guarantee | Dashboard/Rig WITS/Session | Demo harus production-faithful | Audit runtime fallback dan disable fake data | Core trustable |
| P0 | Token expired E2E | Auth | Session invalid harus aman | Test 401/403 invalid token | Redirect login konsisten |
| P1 | Stale data visibility | Dashboard/WebSocket | Realtime safety | Add stale timer/badge | User tahu data live/stale |
| P1 | Export filter verification | Export/History | Report accuracy | Backend AND filter test | Export akurat |
| P1 | Memory production/demo separation | Memory | Local workflow risk | Split backend workflow and local demo | Clear operational boundary |
| P1 | Admin audit verification | Admin | Auditability | Test/implement `/api/audit-logs` | Audit logs valid |
| P1 | AppContext refactor | Architecture | Maintainability | Split session/realtime/wits/mwd/status contexts | Lower complexity |
| P1 | Visual regression | Dashboard/Rig WITS/Well Plot/Trajectory | Visual bugs common | Screenshot checks desktop/tablet/mobile | Safer demo |
| P2 | LAS/PDF persistence | Export/Plotting | Export workflow partial | Persist LAS presets/upload files | Stable reporting |
| P2 | Notifications delivery | Alerts/Settings | Placeholder | Browser/sound/email/report backend | Alerting complete |
| P2 | Diagnostics API | System Utilities | Troubleshooting | Add process/system log endpoints | Admin diagnostics real |
| P2 | Large data performance | Log/History/Charts | MWD history can be large | Pagination/virtualization | Better performance |
| P3 | Aux Port backend | Aux | Future extension | Define endpoints | Feature activated |
| P3 | Advanced offline | PWA | Future field mode | Cache app shell only + offline queue if approved | Safe offline UX |
| P3 | Help Polaris guide | Help | Onboarding | Add Polaris-to-web workflows | Better adoption |

## 20. Rekomendasi Dokumentasi CD/PRD

- Tambahkan narasi eksplisit bahwa sistem adalah peningkatan Polaris, bukan dashboard baru yang memotong workflow lama.
- Jelaskan bahwa navigasi mengikuti workflow Polaris untuk familiaritas: Dashboard, Monitoring, Configuration, Data Management, Trajectory, Operations, Support.
- Jangan menyebut WITS Config, Log Data, Survey, Trajectory, Well Plot, Plotting, Export, LAS, Memory, Settings, Utilities sebagai scope creep; jelaskan sebagai workflow Polaris yang dipertahankan.
- Tandai status fitur partial secara jujur, terutama Memory, Plotting upload, LAS preset, Diagnostics, Notifications, Aux Port, Audit Logs, PWA.
- Tambahkan mapping fitur ke workflow Polaris seperti pada Section 3.
- Tambahkan strategi PWA dengan prinsip network-only untuk data realtime.
- Tambahkan backend production sebagai arsitektur final, dan backend lokal repo sebagai stub/non-source-of-truth.
- Tambahkan test plan untuk auth/token expired, session consistency, WebSocket reconnect, role access, export filters, visual regression, dan PWA cache safety.

## 21. Ringkasan Akhir

Dari sisi frontend, sistem sudah cukup kuat sebagai basis aplikasi MWD Monitoring berbasis web yang mempertahankan banyak workflow Polaris. Fondasi penting seperti auth, session, backend production integration, no-store API client, WebSocket realtime, role-aware navigation, dashboard, Rig WITS, WITS Config, Survey, Log Data, Trajectory, Well Plot, Export, Settings, Admin, dan Utilities sudah ada.

Yang sudah kuat:

- Arsitektur REST/WebSocket production via environment variable.
- Centralized API client dengan safe error, no-store, bearer token, dan invalid session event.
- Direct login route dan protected route gate sudah lebih rapi.
- Core monitoring memakai backend/AppContext, bukan mock packet runtime.
- Polaris workflow modules sudah luas dan relevan.

Yang belum selesai:

- Backend production source/contract tidak tersedia di repository.
- Backend authorization belum bisa dibuktikan dari repo lokal.
- PWA belum penuh; baru prompt, belum manifest/service worker/cache strategy.
- Memory workflow masih campuran backend dan local demo.
- Several Polaris workflow modules masih partial/placeholder: Aux Port, plotting upload, diagnostics, notification delivery, chart export, SMTP/report settings.
- Stale data visibility perlu diperkuat.

Yang harus diperbaiki sebelum demo:

- Pastikan backend production endpoint dan role authorization benar.
- Pastikan dashboard, Rig WITS, History/Export, Survey, Trajectory, Well Plot berjalan dengan active session production.
- Label semua placeholder/local/demo secara jelas.
- Jalankan visual regression untuk Dashboard, Rig WITS, Well Plot, Trajectory, Export.
- Jangan klaim PWA offline/live data jika belum ada cache strategy aman.

Future development:

- Full PWA install/offline shell dengan network-only operational data.
- Backend diagnostics/process logs.
- Admin audit logs production.
- Aux Port backend integration.
- Persistent LAS presets and plotting attachments.
- Large data virtualization and export verification suite.

Keputusan prioritas: sistem layak diposisikan sebagai peningkatan Polaris dari sisi frontend dan workflow, tetapi belum boleh diklaim production-ready penuh sampai backend production contract, role authorization, PWA cache strategy, and partial/local workflows selesai diverifikasi dan dirapikan.
