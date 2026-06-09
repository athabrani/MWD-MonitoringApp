# Product Requirements Document - MWD Monitoring App

Versi: V2.3 Final Draft  
Tanggal audit: 2026-06-08  
Basis audit: repository frontend/backend lokal, service API frontend, environment usage, realtime client, AppContext, Admin Panel, System Health, Gateway Raw Packet diagnostics, Memory Files, Export/History, Rig WITS, Survey/Trajectory, Well Plot, halaman operasional utama, build production, dan hasil lint terbaru.

## 1. Document Overview

Dokumen ini adalah PRD terbaru untuk MWD Monitoring App setelah beberapa perbaikan dan integrasi besar:

- Integrasi backend REST production.
- Integrasi WebSocket realtime.
- Penggunaan centralized API client.
- Penghapusan mock runtime sebagai source utama untuk data operasional core.
- Perbaikan Dashboard dan status summary.
- Perbaikan Rig WITS menjadi Received Data dan Output Queue.
- Perbaikan Well Plot multi-track dan track navigation.
- Perbaikan Trajectory/Vertical Section.
- Integrasi Audit Logs.
- Integrasi System Health melalui `/api/health`.
- Integrasi Gateway Raw Packet diagnostics melalui `/api/gateway-raw-packets`.
- Perbaikan Gateway Raw Packet diagnostics agar request dapat dikirim dengan `sessionId` aktif dan normalizer membaca field raw/signal yang lebih luas.
- Perbaikan WebSocket client agar event dari socket lama tidak memicu reconnect/update setelah socket baru dibuat.
- Perbaikan Memory Files menuju backend-driven workflow.
- Perbaikan Admin Panel, password update behavior, dan role/session access visibility.
- Verifikasi build production berhasil.
- Audit lint terbaru masih menunjukkan error lama di area non-patch yang perlu dibereskan sebelum lint clean.

PRD ini mendokumentasikan current implemented state, completed improvements, alignment with product needs, remaining mismatch, critical gaps, backend dependencies, testing needs, visual regression needs, dan prioritas pengembangan berikutnya.

Status yang digunakan:

| Status | Definisi |
|---|---|
| DONE | Fitur sudah tersedia dan sesuai arah produk pada level frontend/integrasi yang diaudit. |
| PARTIAL | Fitur sudah ada tetapi belum lengkap, butuh E2E, backend contract, atau refinement. |
| NEEDS FIX | Fitur ada tetapi masih berisiko atau tidak sepenuhnya sesuai policy. |
| NEEDS VERIFICATION | Kode frontend sudah ada, tetapi butuh uji backend production/end-to-end. |
| BLOCKED BY BACKEND | Fitur membutuhkan endpoint/response/backend behavior tambahan. |
| BACKEND-DRIVEN | Data utama berasal dari REST/backend API. |
| REALTIME-ENABLED | Modul menerima atau menampilkan update WebSocket/realtime. |
| UI REFINED | Perbaikan dominan pada layout/UX/visual state. |
| LOCAL-PREFERENCE | Data hanya preferensi UI lokal, bukan source of truth/security boundary. |

Audience dokumen: product owner, frontend engineer, backend engineer, QA/tester, pembimbing Capstone, dan reviewer sistem operasional.

## 2. Product Overview

MWD Monitoring App adalah aplikasi monitoring Measurement While Drilling berbasis web/PWA yang mencakup realtime MWD monitoring, WITS data handling, Rig WITS received/output queue, dashboard KPI, depth tracking, survey, trajectory analysis, well plot, plotting template, LAS/PDF/CSV export, memory file import/correlation, admin user/role management, audit logs, system health, hardware/realtime connection monitoring, dan workflow data historis.

Sistem diarahkan menjadi aplikasi yang lebih profesional, backend-driven, dan siap dikembangkan menuju production-grade system. Sistem tetap mempertahankan workflow yang familiar dari Polaris, tetapi dengan peningkatan pada:

- Akses web lintas perangkat.
- Backend production sebagai source of truth.
- REST API untuk initial load, CRUD, export, dan historical data.
- WebSocket untuk realtime update.
- Role-based access untuk Admin, Engineer, dan Operator.
- Empty/error/unavailable state yang lebih jujur.
- UI yang lebih modern dan lebih mudah dipantau.
- System health dan raw packet diagnostics yang lebih eksplisit.

## 3. Product Goals

| Goal | Deskripsi | Status |
|---|---|---|
| Monitoring MWD realtime berbasis web | Menampilkan data MWD, status koneksi, dan chart dari backend/realtime. | PARTIAL, REALTIME-ENABLED |
| Backend source of truth | Data operasional tidak berasal dari mock runtime. | PARTIAL, BACKEND-DRIVEN |
| Mengurangi mock runtime | Empty/error/unavailable menggantikan dummy data untuk data core. | PARTIAL |
| Dashboard KPI stabil | KPI tetap tampil walaupun sebagian value kosong/unavailable. | DONE |
| WebSocket realtime | Event `mwd-data`, `esp-gateway-status`, `connection-status`, reconnect, subscribe session, dan stale socket guard. | DONE, NEEDS VERIFICATION |
| Role access benar | Admin/Engineer/Operator dibedakan pada route/action. | PARTIAL |
| Session/job flow konsisten | `activeMwdSessionId` menjadi scope data utama. | DONE, NEEDS VERIFICATION |
| Export data | Historical, survey, LAS, PDF plot memakai backend blob. | PARTIAL |
| Admin panel matang | Users, roles, audit logs, server status, system health. | PARTIAL, BACKEND-DRIVEN |
| Visualisasi drilling | Trajectory dan Well Plot mengikuti konsep planned/actual dan depth-based plot. | PARTIAL, UI REFINED |
| UI usable/responsive | Layout monitoring dan admin lebih rapi dan tidak misleading. | PARTIAL |
| Fondasi production-ready | API client, auth, session, realtime, health, audit, export, raw packet diagnostics, dan utilities siap diuji. | PARTIAL |

## 4. Users and Roles

### Admin

Admin memiliki akses penuh untuk:

- User management.
- Role management.
- Audit logs.
- System utilities.
- Configuration.
- Session management.
- Backup, restore, clear data.
- Full Admin Panel.
- System Health Dashboard.

Evidence:

- Admin page: `mwd-app-fe/app/admin/page.tsx`.
- User API: `mwd-app-fe/lib/admin-users-api.ts`.
- Role API: `mwd-app-fe/lib/admin-roles-api.ts`.
- Audit logs API: `mwd-app-fe/lib/admin-audit-logs-api.ts`.
- Backend reachability: `mwd-app-fe/lib/admin-backend-health-api.ts`.
- System health panel: `mwd-app-fe/components/system-health-panel.tsx`.

Password security:

- Admin boleh membuat password saat create user.
- Admin boleh mengisi password baru saat edit user.
- Current password tidak ditampilkan.
- Password hash tidak ditampilkan.
- Jika password kosong saat edit, `admin-users-api.ts` tidak mengirim field `password`.
- Backend tetap wajib menyimpan password sebagai hash dan tidak mengembalikan hash/password.

Status: PARTIAL, BACKEND-DRIVEN, NEEDS VERIFICATION.

### Engineer

Engineer adalah operational user. Engineer harus dapat:

- Membaca session/job.
- Melihat dashboard dan monitoring.
- Mengelola WITS config, survey, log edit tools, plotting, export, dan memory workflow sesuai permission.
- Mengakses fitur operasional tanpa full admin privilege.

Status: PARTIAL.

### Operator

Operator adalah read-only monitoring user. Operator harus dapat:

- Membaca session/job yang sama agar dashboard berjalan.
- Melihat dashboard, Rig WITS, Log Data, Survey, Well Plot, Charts, Alerts, dan History sesuai access.
- Tidak melakukan destructive action, mutation config, export jika dibatasi, memory apply, clear/restore, atau admin actions.

Mismatch penting:

- Jika operator tidak dapat mengakses `GET /api/mwd-sessions`, `activeMwdSessionId` kosong dan monitoring tidak berjalan. Ini P0 bila masih terjadi pada backend production.
- Issue operator tidak boleh diselesaikan dengan hardcoded sessionId atau mock session.

Evidence:

- Route access registry: `mwd-app-fe/lib/page-access.ts`.
- Admin page access preference disimpan local: `saveRolePageAccess()`.
- Action permission helper: `mwd-app-fe/lib/security/permissions.ts`.

Status: PARTIAL, NEEDS VERIFICATION, LOCAL-PREFERENCE for page access preference.

## 5. Updated Architecture Overview

### Frontend

| Komponen | Fungsi | Evidence | Status |
|---|---|---|---|
| Next.js frontend | Route dan page aplikasi. | `mwd-app-fe/app/**/page.tsx` | DONE |
| Centralized API client | Base URL env, bearer token, no-store, safe API path. | `mwd-app-fe/lib/api-client.ts` | DONE |
| AuthContext | Login, token, user restore, invalid session handling. | `mwd-app-fe/context/AuthContext.tsx` | DONE |
| FrontendSecurityGate | Authenticated/unauthenticated route redirect. | `mwd-app-fe/components/frontend-security-gate.tsx` | DONE |
| AppContext/global provider | Session, MWD data, WITS, alarms, connection, realtime orchestration. | `mwd-app-fe/context/AppContext.tsx` | PARTIAL |
| Realtime client | WebSocket singleton, event parser, reconnect, subscribe session, stale socket event guard. | `mwd-app-fe/lib/realtime-client.ts` | DONE |
| Role/page guard | Route/page access by role. | `mwd-app-fe/lib/page-access.ts` | PARTIAL/LOCAL-PREFERENCE |
| System health | Backend health, serial, ESP, realtime, raw packet diagnostics with session-aware request and expanded raw/signal metadata display. | `mwd-app-fe/components/system-health-panel.tsx`, `mwd-app-fe/lib/gateway-raw-packets-api.ts` | PARTIAL |

### Backend REST

Production REST backend:

```env
NEXT_PUBLIC_API_BASE_URL=https://be-mwd.vercel.app
```

Evidence:

- `getApiBaseUrl()` reads `process.env.NEXT_PUBLIC_API_BASE_URL`.
- Missing env throws clear configuration error.
- Absolute per-request API URLs are rejected.
- Runtime frontend hardcoded `http://localhost:5001` or `127.0.0.1` was not found. Localhost reference found only in README/dev/backend stub context.

### WebSocket

Production WebSocket:

```env
NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws
```

Evidence:

- `mwd-app-fe/lib/realtime-client.ts` reads `NEXT_PUBLIC_WS_URL`.
- Missing env becomes realtime error, not mock fallback.
- The client ignores `open`, `message`, `close`, and `error` events from stale socket instances so reconnect/session switch does not accidentally create duplicate update paths.

### Data Flow

```text
Login
-> POST /api/auth/login
-> GET /api/auth/me
-> GET /api/mwd-sessions
-> set activeMwdSessionId
-> REST initial load
-> WebSocket connect
-> subscribe active session
-> realtime update
-> render dashboard/log/plot/status
```

REST is used for initial load, CRUD, export, historical, admin, settings, and utilities. WebSocket is used for realtime update. Backend API remains source of truth. WebSocket failure must not trigger mock fallback. REST refresh/polling can remain backend-backed fallback data path when WebSocket is disconnected.

## 6. Source of Truth and Data Policy

Policy:

1. Backend is source of truth for operational data.
2. Mock data must not be used as production runtime source.
3. Empty backend response must show empty state.
4. Backend error must show error state.
5. Missing endpoint must show unavailable state.
6. LocalStorage is allowed for token/session cache, selected active session, role page access preference, and light UI preference.
7. LocalStorage must not become primary source for MWD data, WITS config, survey, alerts, audit logs, system health, export records, or raw packet logs.

Source mapping:

| Data | Source | Evidence | Status |
|---|---|---|---|
| Auth | `/api/auth/login`, `/api/auth/me` | `lib/auth-api.ts` | DONE |
| Sessions | `/api/mwd-sessions` | `lib/mwd-sessions-api.ts`, AppContext | DONE, NEEDS VERIFICATION for operator |
| MWD Data | `/api/mwd-data`, WS `mwd-data` | `lib/mwd-data-api.ts`, AppContext | BACKEND-DRIVEN, REALTIME-ENABLED |
| WITS Config | `/api/wits-config` | `lib/api/wits.ts` | BACKEND-DRIVEN |
| WITS Data Values | `/api/wits-data-values` | `lib/api/wits.ts`, Log Data, History | PARTIAL |
| WITS Alarms | `/api/wits-alarms` | `lib/api/wits.ts`, Alerts/AppContext | PARTIAL |
| Survey | `/api/surveys` and survey actions | `lib/surveys-api.ts` | PARTIAL |
| Plot Templates | `/api/plot-templates` | `lib/plot-templates-api.ts` | PARTIAL |
| Exports | `/api/exports/*` | `lib/exports-api.ts` | PARTIAL |
| Memory Files | `/api/memory-files/*` | `lib/memory-files-api.ts` | PARTIAL/BACKEND-DRIVEN |
| Depth Tracking | `/api/depth-tracking/*` | `lib/depth-tracking-api.ts` | PARTIAL |
| WITS Output | `/api/wits-output/*` | `lib/wits-output-api.ts` | PARTIAL/BACKEND-DRIVEN |
| Audit Logs | `/api/audit-logs` | `lib/admin-audit-logs-api.ts` | PARTIAL/NEEDS VERIFICATION |
| Raw Gateway Packets | `/api/gateway-raw-packets` with optional `sessionId` query | `lib/gateway-raw-packets-api.ts`, AppContext, SystemHealthPanel | PARTIAL/NEEDS VERIFICATION |
| Serial | `/api/serial/status` | `lib/serial-api.ts` | PARTIAL |
| ESP WS | `/api/esp-ws/status`, WS `esp-gateway-status` | `lib/esp-ws-api.ts`, AppContext | PARTIAL |
| Connection | `/api/connection-status`, WS `connection-status` | `lib/connection-api.ts` | PARTIAL/REALTIME-ENABLED |
| Failover | `/api/failover-events` | `lib/connection-api.ts` | PARTIAL |
| System Health | `/api/health` | `lib/system-health-api.ts`, `admin-backend-health-api.ts` | PARTIAL/NEEDS VERIFICATION |

## 7. REST API Integration

All REST requests must use centralized API client:

- `apiRequest()`
- `apiFetch()`
- `getApiBaseUrl()`

Evidence:

- REST service files import `apiRequest`/`apiFetch`.
- `api-client.ts` sets bearer token when available.
- `api-client.ts` defaults `cache` to `no-store`.
- `api-client.ts` rejects absolute paths so endpoint calls must remain relative to `NEXT_PUBLIC_API_BASE_URL`.

Endpoint usage:

| Module | Endpoint | Method | Service/Page | Status | Notes |
|---|---|---:|---|---|---|
| Auth | `/api/auth/login` | POST | `lib/auth-api.ts` | DONE | Login. |
| Auth | `/api/auth/me` | GET | `lib/auth-api.ts` | DONE | Restore profile. |
| Users | `/api/users` | GET/POST | `lib/admin-users-api.ts` | PARTIAL | Admin user list/create. |
| Users | `/api/users/:id` | GET/PUT/DELETE | `lib/admin-users-api.ts` | PARTIAL | Update/delete, optional new password. |
| Roles | `/api/roles` | GET/POST | `lib/admin-roles-api.ts` | PARTIAL | Role list/service. |
| Roles | `/api/roles/:id` | GET/PUT/DELETE | `lib/admin-roles-api.ts` | SERVICE READY | Full UI role CRUD not fully exposed. |
| Audit Logs | `/api/audit-logs` | GET | `lib/admin-audit-logs-api.ts` | PARTIAL | Loading/empty/error/refresh UI exists. |
| Sessions | `/api/mwd-sessions` | GET/POST | `lib/mwd-sessions-api.ts` | DONE/PARTIAL | Operator read access needs verification. |
| Sessions | `/api/mwd-sessions/:id` | GET/PUT/DELETE | `lib/mwd-sessions-api.ts` | PARTIAL | Config/session lifecycle. |
| MWD Data | `/api/mwd-data` | GET/POST/DELETE | `lib/mwd-data-api.ts` | PARTIAL | GET is core operational path. |
| Historical Data | `/api/historical-data` | GET | `lib/historical-data-api.ts` | PARTIAL | History browser source. |
| WITS Config | `/api/wits-config` | GET/POST/PUT/DELETE | `lib/api/wits.ts` | PARTIAL | Backend-driven config. |
| WITS Values | `/api/wits-data-values` | GET | `lib/api/wits.ts` | PARTIAL | Generated by backend from MWD/WITS mapping. |
| WITS Alarms | `/api/wits-alarms` | GET | `lib/api/wits.ts` | PARTIAL | Alerts source. |
| WITS Alarm Action | `/api/wits-alarms/:id/acknowledge`, `/resolve` | POST | `lib/api/wits.ts` | PARTIAL | Needs E2E role verification. |
| Surveys | `/api/surveys` | GET/POST | `lib/surveys-api.ts` | PARTIAL | Survey list/create. |
| Surveys | `/api/surveys/:id` | GET/PUT/DELETE | `lib/surveys-api.ts` | PARTIAL | Row edit/delete. |
| Survey Actions | `/api/surveys/from-mwd-data`, `/recalculate`, `/well-plan/import-csv` | POST | `lib/surveys-api.ts` | PARTIAL | Uses default VS azimuth 90. |
| Plot Templates | `/api/plot-templates` | GET/POST | `lib/plot-templates-api.ts` | PARTIAL | Normalizes `config` and `plotConfig`. |
| Plot Template Default | `/api/plot-templates/default` | GET | `lib/plot-templates-api.ts` | PARTIAL | Default template. |
| Export Historical | `/api/exports/historical` | POST | `lib/exports-api.ts`, Export/History | PARTIAL | Date/depth filters sent; AND support needs backend verification. |
| Export Surveys | `/api/exports/surveys` | POST | `lib/exports-api.ts` | PARTIAL | Blob handling. |
| Export LAS | `/api/exports/las` | POST | `lib/exports-api.ts` | PARTIAL | LAS preview/preset still partly local. |
| Export PDF Plot | `/api/exports/pdf-plot` | POST | `lib/exports-api.ts` | PARTIAL | Requires template/depth range. |
| Export Records | `/api/exports/records` | GET | `lib/exports-api.ts` | PARTIAL | Export record list. |
| MWD Edit Tools | `/api/mwd-data/edit/*` | GET/POST | `lib/mwd-edit-tools-api.ts` | PARTIAL | Preview before apply. |
| Memory Files | `/api/memory-files` | GET | `lib/memory-files-api.ts` | PARTIAL | Backend list. |
| Memory Import | `/api/memory-files/import` | POST | `lib/memory-files-api.ts` | PARTIAL | Browser parses file then sends content. |
| Memory Detail/Points | `/api/memory-files/:id`, `/points` | GET | `lib/memory-files-api.ts` | PARTIAL | Detail and point preview. |
| Memory Correlate | `/api/memory-files/:id/correlate` | POST | `lib/memory-files-api.ts` | PARTIAL | Supports `dryRun: true/false`. |
| Memory Correlations | `/api/memory-files/correlations` | GET | `lib/memory-files-api.ts` | PARTIAL | Correlation history. |
| Depth Tracking | `/api/depth-tracking/*` | GET/POST | `lib/depth-tracking-api.ts` | PARTIAL | Dashboard/status support. |
| WITS Output | `/api/wits-output/queue` | GET | `lib/wits-output-api.ts` | PARTIAL | Rig WITS queue. |
| WITS Output | `/api/wits-output/generate-from-latest` | POST | `lib/wits-output-api.ts` | PARTIAL | Admin/Engineer action. |
| WITS Output | `/api/wits-output/:id/status` | PUT | `lib/wits-output-api.ts` | PARTIAL | Queue status mutation. |
| Serial | `/api/serial/status` | GET | `lib/serial-api.ts` | PARTIAL | Status display. |
| ESP WS | `/api/esp-ws/status` | GET | `lib/esp-ws-api.ts` | PARTIAL | Status plus raw fields if provided. |
| Connection | `/api/connection-status` | GET | `lib/connection-api.ts` | PARTIAL | Connection state. |
| Failover | `/api/failover-events` | GET | `lib/connection-api.ts` | PARTIAL | Diagnostics/events. |
| System Health | `/api/health` | GET | `lib/system-health-api.ts` | PARTIAL/NEEDS VERIFICATION | Uptime/version/database/dependency normalization. |
| Gateway Raw Packets | `/api/gateway-raw-packets` | GET | `lib/gateway-raw-packets-api.ts`, AppContext, SystemHealthPanel | PARTIAL/NEEDS VERIFICATION | Latest packet/detail diagnostics; frontend sends `limit` and active `sessionId` when available; normalizes raw packet, payload/message, timestamp, source, transmitter, RSSI, SNR, sequence, parse status, and error fields. |
| System Utilities | `/api/system-utilities/*` | GET/POST | `lib/api/system-utilities.ts` | PARTIAL | Backup/restore/clear/config backup. |

Important verification items:

- Historical export dual filter: `measuredFrom`, `measuredTo`, `depthMin`, `depthMax`.
- Gateway raw packet response shape, session filter support, and permission.
- Audit logs pagination/filter if log volume grows.
- Connection-status and failover endpoint availability per role.
- `/api/health` support on production backend.

## 8. WebSocket Realtime Integration

Endpoint:

```env
NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws
```

Frontend event types:

- `mwd-data`
- `esp-gateway-status`
- `connection-status`

Subscribe payload:

```json
{
  "type": "subscribe",
  "sessionId": "activeMwdSessionId"
}
```

Evidence:

- Known event set: `mwd-app-fe/lib/realtime-client.ts`.
- Reconnect and anti double connection: `RealtimeClient.connect()` and `scheduleReconnect()`.
- Stale socket guard: event listener pada socket lama diabaikan setelah `this.socket` mengarah ke instance baru.
- Session subscribe/unsubscribe: `subscribeSession()` and `clearSessionSubscription()`.
- AppContext receives events and routes them by type.

Status: DONE, REALTIME-ENABLED, NEEDS VERIFICATION.

Remaining verification:

- Production WS accepts subscribe message without additional auth payload.
- Event payload shape matches normalizers in AppContext.
- Production reconnect/session-switch behavior must still be tested end-to-end even though stale socket events are now guarded on frontend.

## 9. Core Feature Scope

### Core Monitoring Features

- Login/Auth.
- MWD Session/Job.
- Dashboard KPI.
- Rig WITS Received Data.
- WITS Output Queue.
- Realtime WebSocket.
- Connection/Serial/ESP status.
- Gateway Raw Packet diagnostics.
- Alerts.
- Charts.
- History.
- Historical export.
- Role-based access.

### MWD/Polaris Workflow Features

- WITS Configuration.
- WITS Data Values.
- Log Data.
- Survey Data.
- Wellplan Survey.
- Trajectory.
- Well Plot.
- Plotting Template.
- Generate LAS.
- Memory Import/Correlation.
- Settings/Threshold.
- System Utilities.

### Administrative Features

- User management.
- Role management.
- Frontend page access preference.
- Audit logs.
- System Health Dashboard.
- Server status and API latency.
- Backup/restore/clear/config utilities.

### Extended / Partial / Future Scope

- Aux Port until backend endpoint exists.
- Full PWA manifest/service worker/cache strategy.
- Advanced diagnostics process/system logs.
- Plot attachment upload persistence.
- Notification delivery mechanism.
- Visual regression automation.

## 10. Functional Requirements

| ID | Requirement | Actor | Main Flow | Status | Gap/Notes |
|---|---|---|---|---|---|
| FR-01 | Authentication and Session Restore | All | Login via `/api/auth/login`; restore via `/api/auth/me`. | DONE | Token expiry E2E required. |
| FR-02 | Role-Based Access Control | All | Route/action access by Admin/Engineer/Operator. | PARTIAL | Backend authorization must be verified. |
| FR-03 | MWD Session Management | All | Load `/api/mwd-sessions`; set `activeMwdSessionId`. | DONE/PARTIAL | Operator read access is P0 verification. |
| FR-04 | Realtime Dashboard Monitoring | All | Load backend data and update through WS. | PARTIAL | Stale/live semantics need test. |
| FR-05 | Rig WITS Data Monitoring | All | Show Received Data and Output Queue. | DONE/PARTIAL | Backend payload E2E required. |
| FR-06 | WITS Configuration | Admin/Engineer | CRUD `/api/wits-config`. | PARTIAL | Operator must be read-only. |
| FR-07 | WITS Data Values | All | Show values from `/api/wits-data-values`. | PARTIAL | Backend mapping/generation timing needs verification. |
| FR-08 | Log Data Management | Admin/Engineer | Browse MWD/WITS values and preview/apply edit tools. | PARTIAL | CSV/LAS direct import still unavailable. |
| FR-09 | Survey Data Management | Admin/Engineer | Survey CRUD, generate from MWD, recalculate, import/export. | PARTIAL | Backend/visual validation required. |
| FR-10 | Trajectory Analysis | All | Plot planned vs actual from `/api/surveys`. | PARTIAL/UI REFINED | Visual regression required. |
| FR-11 | Well Plot Visualization | All | Multi-track plot from selected Plotting config. | PARTIAL/UI REFINED | Large data performance test. |
| FR-12 | Charts and Parameter Analysis | All | Display parameter/time/depth chart. | PARTIAL | Export/large data behavior needs verification. |
| FR-13 | Connection Status Monitoring | All | REST/WS status display. | PARTIAL/REALTIME-ENABLED | Role/status E2E required; 401/403 must be treated as auth/permission, not disconnected hardware. |
| FR-14 | ESP/Gateway Status Monitoring | All | `/api/esp-ws/status`, WS `esp-gateway-status`, raw packets. | PARTIAL | Raw packet frontend normalization improved; backend response shape/session filter/permissions still need verification. |
| FR-15 | Alerts and Events | All | WITS alarms and status events. | PARTIAL | Generated events are frontend-derived. |
| FR-16 | Historical Data Browser | All | Query `/api/historical-data` and `/api/wits-data-values`. | PARTIAL | Dual source consistency needs test. |
| FR-17 | Historical Data Export | Admin/Engineer | POST `/api/exports/historical` with optional filters. | PARTIAL | Backend AND filter needs verification. |
| FR-18 | LAS Export | Admin/Engineer | POST `/api/exports/las`. | PARTIAL | Preview/preset partly local. |
| FR-19 | PDF/Plot Export | Admin/Engineer | POST `/api/exports/pdf-plot`. | PARTIAL | Plot attachment placeholder remains. |
| FR-20 | Memory File Workflow | Admin/Engineer | Import, points, dryRun/apply correlation via backend. | PARTIAL/BACKEND-DRIVEN | Gap-fill staging still needs decision. |
| FR-21 | Settings and Threshold | Admin/Engineer | Edit threshold/WITS config settings. | PARTIAL | Notification delivery absent. |
| FR-22 | Admin User Management | Admin | CRUD `/api/users`. | PARTIAL | Backend auth/password hash verification. |
| FR-23 | Admin Role Management | Admin | Load roles and assign roleId. | PARTIAL | Page access is local preference. |
| FR-24 | Audit Logs | Admin | Load `/api/audit-logs`. | PARTIAL/NEEDS VERIFICATION | Pagination/filter future. |
| FR-25 | System Health | Admin/Engineer where allowed | Load `/api/health` and status endpoints. | PARTIAL/NEEDS VERIFICATION | Production endpoint support must be tested; uptime must only be displayed if backend provides it. |
| FR-26 | Gateway Raw Packets | Admin/Engineer | Load `/api/gateway-raw-packets` with `limit` and active `sessionId` when available. | PARTIAL/NEEDS VERIFICATION | Frontend supports raw/signal metadata; backend permission/shape/session filtering test required. |
| FR-27 | System Utilities | Admin | Backup/restore/clear/config backup. | PARTIAL | Diagnostics process logs blocked. |
| FR-28 | Operator Read-Only Mode | Operator | View monitoring without destructive mutation. | PARTIAL | Backend enforcement must be verified. |
| FR-29 | Empty/Error/Unavailable Policy | All | Use honest UI state for empty/error/missing endpoint. | PARTIAL | Some placeholders remain. |

## 11. Non-Functional Requirements

| ID | Requirement | Target | Current Implementation | Gap |
|---|---|---|---|---|
| NFR-01 | Realtime Responsiveness | WS events update UI quickly. | Realtime client and AppContext handlers exist. | Need measured latency. |
| NFR-02 | Data Freshness | Live/stale/offline is visible. | Status summary exists. | Stale age policy can improve. |
| NFR-03 | Backend Availability | Backend failure is visible. | API errors and health panel exist. | E2E production health required. |
| NFR-04 | WebSocket Reliability | Reconnect, cleanup, no duplicate sockets. | Realtime client includes idempotent connect and stale socket event guard. | Production disconnect/session-switch tests. |
| NFR-05 | Security and Token Handling | Safe auth errors and session invalidation. | AuthContext/API client/security helpers. | Token storage risk review. |
| NFR-06 | Role-Based Security | Backend enforces role actions. | Frontend guard exists. | Backend enforcement verification. |
| NFR-07 | Data Integrity | No fake operational data. | Core mostly backend-driven. | Placeholders/local helpers must stay labeled. |
| NFR-08 | Export Accuracy | Export data matches filters/session. | Blob export implemented. | Historical AND filter verification. |
| NFR-09 | Visual Accuracy | Charts/trajectory/well plot correct. | UI refined. | Visual regression required. |
| NFR-10 | Performance | Large logs/history/well plot remain usable. | Tables and filters exist. | Virtualization/pagination not universal. |
| NFR-11 | Maintainability | Service files are modular. | Many API modules separated. | AppContext and long pages need refactor later. |
| NFR-12 | API Consistency | Centralized client and normalization. | Implemented. | Normalizers may hide backend shape mismatch. |
| NFR-13 | Auditability | Admin can review audit logs. | `/api/audit-logs` UI exists. | Pagination/filter/retention verification. |
| NFR-14 | Observability | Health, latency, serial, ESP, raw packet diagnostics. | `/api/health`, raw packet metadata, signal details, status cards. | Backend support E2E and field contract. |
| NFR-15 | Configuration Safety | Destructive actions have preview/confirmation. | Clear-data preview and confirm exist. | Backend audit/enforcement verification. |
| NFR-16 | Usability | UI is readable and not misleading. | Dashboard/Rig/Admin improvements. | Visual checks needed. |
| NFR-17 | PWA Safety | No stale realtime data as live. | API no-store. | Full PWA SW/manifest not implemented. |

## 12. UI/UX Requirements

| Area | Requirement | Current Status | Evidence |
|---|---|---|---|
| Dashboard | KPI cards remain visible even with unavailable values. | DONE | `app/dashboard/page.tsx`, `emptyKpiDefinitions` |
| Dashboard | Depth/DTS/Serial/ESP WS/Realtime summary readable. | PARTIAL/UI REFINED | `app/dashboard/page.tsx`, AppContext |
| Rig WITS | Main view only Received Data and Output Queue. | DONE | `app/monitoring/rig-wits/page.tsx` |
| Rig WITS | Desktop 2 columns, mobile stacked. | DONE | `xl:grid-cols-2` |
| Rig WITS | No mock packet stream. | DONE | Received Data source `/api/mwd-data` |
| Admin | Users/Roles/Audit/System Health tabs. | DONE/PARTIAL | `app/admin/page.tsx` |
| Admin | Password edit does not show current password. | DONE | Optional `New Password` field |
| System Health | Health cards include backend, serial, ESP, realtime, raw packets, session-aware raw packet query, and signal metadata display. | PARTIAL/UI REFINED | `components/system-health-panel.tsx`, `lib/gateway-raw-packets-api.ts`, AppContext |
| Trajectory | Planned/Actual legend and current metrics readable. | UI REFINED/PARTIAL | `app/trajectory/page.tsx` |
| Well Plot | Multi-track and navigation for hidden tracks. | DONE/PARTIAL | `components/well-plot-panel.tsx` |
| Export/History | Date and depth filters are visible. | DONE/PARTIAL | `app/export/page.tsx`, `app/history/page.tsx` |
| Empty/Error | Empty/error/unavailable state should be explicit. | PARTIAL | Multiple pages |
| Build Verification | Production build must compile after integration changes. | DONE | `npm run build` passed on 2026-06-08 audit. |
| Lint Verification | Project lint should be clean before release. | NEEDS FIX | `npm run lint` still fails due existing issues in unrelated files such as `configuration`, `help`, `ConnectionStatus`, `EventStream`, layout, UI primitives, and Well Plot effect rules. |

## 13. Workflow / Routemap

| Workflow | Trigger | API/Source | UI Result | Status |
|---|---|---|---|---|
| Login | Submit credentials | `/api/auth/login`, `/api/auth/me` | Authenticated app. | DONE |
| Session selection | App startup/session switch | `/api/mwd-sessions` | `activeMwdSessionId`. | DONE/PARTIAL |
| Dashboard monitoring | Active session | `/api/mwd-data`, status endpoints, WS | KPI/chart/status. | PARTIAL |
| WebSocket realtime | Auth/session available | `NEXT_PUBLIC_WS_URL` | Live updates; stale socket events ignored after reconnect/session switch. | DONE/NEEDS VERIFICATION |
| Rig WITS | Open Rig WITS | `/api/mwd-data`, `/api/wits-output/*` | Received/queue panels. | DONE/PARTIAL |
| Admin | Open Admin | `/api/users`, `/api/roles`, `/api/audit-logs`, `/api/health` | Admin management/health. | PARTIAL |
| System Health | Refresh health | `/api/health`, `/api/gateway-raw-packets`, status endpoints | Health cards/raw packet diagnostics with session/signal metadata when backend provides it. | PARTIAL |
| History | Load filters | `/api/historical-data`, `/api/wits-data-values` | Historical chart/table. | PARTIAL |
| Historical Export | Export CSV/JSON | `/api/exports/historical` | Blob download. | PARTIAL |
| Survey | Manage survey | `/api/surveys`, survey actions | Survey CRUD/action. | PARTIAL |
| Trajectory | Open page | `/api/surveys` | Planned/actual views. | PARTIAL |
| Well Plot | Open page | Plot templates + MWD data | Multi-track plot. | PARTIAL |
| Memory | Import/correlate | `/api/memory-files/*` | File detail/points/dryRun/apply. | PARTIAL |
| Utilities | Backup/restore/clear | `/api/system-utilities/*` | JSON backup/restore/preview/confirm. | PARTIAL |

## 14. Empty State and Error State Policy

Implemented examples:

- Missing API env throws configuration error in `lib/api-client.ts`.
- Rig WITS empty state: "Belum ada received data untuk session ini" and "Belum ada output queue untuk session ini."
- History export now throws error if backend export blob is empty rather than silently using unrelated dummy data.
- Admin audit logs show loading, empty, and error states.
- System Health raw packet section distinguishes returned no packet logs from backend unavailable/error.
- Gateway Raw Packet diagnostics reads optional `sessionId`, packet/message/payload, transmitter, RSSI, SNR, sequence, parse status, and error fields without creating fake packet content.
- Aux Port explicitly shows backend endpoint unavailable.
- Log Data import states that CSV/LAS direct import endpoint is unavailable and no local fallback import is created.

Policy:

- Empty data: show empty state.
- Backend error: show safe error state.
- Missing endpoint: show unavailable state.
- WebSocket disconnected: show disconnected/reconnecting/degraded.
- Do not create fake live data.

## 15. Role and Permission Policy

Frontend policy:

- Route/page access improves navigation and usability.
- Action buttons should be hidden/disabled for unauthorized roles.
- Operator should be read-only.
- Admin-only page should reject non-admin in UI.

Security policy:

- Frontend role guard is not a security boundary.
- Backend must enforce authorization on every protected endpoint.
- Local page access preference is not backend permission.

Evidence:

- `mwd-app-fe/lib/page-access.ts`.
- `mwd-app-fe/lib/security/permissions.ts`.
- `mwd-app-fe/app/admin/page.tsx`.

Critical verification:

- Operator read access to `/api/mwd-sessions`.
- Operator cannot mutate survey/config/export/admin/clear-data/memory apply.
- Engineer has operational access but not admin-only user management.
- Admin endpoint rejects non-admin.

## 16. Mock Data Removal Policy

Current status:

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Core MWD data | BACKEND-DRIVEN | `lib/mwd-data-api.ts` | No mock packet source found. |
| Rig WITS | BACKEND-DRIVEN | `/api/mwd-data`, `/api/wits-output/*` | Main page cleaned. |
| Dashboard KPI | PARTIAL | `emptyKpiDefinitions`; runtime fake-data audit | Empty parameter definitions are placeholders for UI structure, not fake operational values. Keyword audit did not find `Math.random`/`generateMock` runtime dashboard data. |
| Alerts/status events | PARTIAL | `generated-*` events in AppContext/Dashboard | Derived from backend/status/threshold state, not backend audit. |
| Memory import | PARTIAL/BACKEND-DRIVEN | `/api/memory-files/*` | Local runtime memory dataset removal improved; gap-fill staging still needs decision. |
| History export | IMPROVED | Backend blob export, empty blob error | Local fallback export issue from previous audit appears removed. |
| Generate LAS | PARTIAL | Local preview/preset remains | Backend LAS export exists. |
| Plotting attachments | PLACEHOLDER | Endpoint unavailable toasts | Still not production complete. |
| Aux Port | BLOCKED BY BACKEND | `app/monitoring/aux-port/page.tsx` | Honest unavailable state. |

## 17. Module-by-Module Implementation Status

| Module | Status | Evidence | Main Remaining Gap |
|---|---|---|---|
| Environment/API Client | DONE | `lib/api-client.ts` | None critical. |
| Authentication | DONE/PARTIAL | `AuthContext.tsx`, `auth-api.ts` | Token expiry E2E. |
| Role Access | PARTIAL | `page-access.ts`, `permissions.ts` | Backend enforcement. |
| Session/Job | DONE/PARTIAL | `mwd-sessions-api.ts`, AppContext | Operator visibility. |
| Dashboard | PARTIAL/REALTIME-ENABLED | `app/dashboard/page.tsx`, AppContext | Stale data policy/test. |
| WebSocket | DONE/NEEDS VERIFICATION | `realtime-client.ts` | Production stream E2E. |
| Rig WITS | DONE/PARTIAL/UI REFINED | `app/monitoring/rig-wits/page.tsx` | Queue/status E2E. |
| Admin Panel | PARTIAL/BACKEND-DRIVEN | `app/admin/page.tsx` | Backend auth, pagination/filter. |
| Audit Logs | PARTIAL/NEEDS VERIFICATION | `admin-audit-logs-api.ts` | Backend shape/volume. |
| System Health | PARTIAL/NEEDS VERIFICATION | `system-health-api.ts`, SystemHealthPanel | `/api/health` production support. |
| Gateway Raw Packets | PARTIAL/NEEDS VERIFICATION | `gateway-raw-packets-api.ts`, AppContext, SystemHealthPanel | Backend permission/shape/session filter. |
| Historical Export | PARTIAL | `exports-api.ts`, Export/History | Combined filter backend behavior. |
| Survey | PARTIAL | `survey-data/page.tsx`, `surveys-api.ts` | E2E and visual validation. |
| Trajectory | PARTIAL/UI REFINED | `trajectory/page.tsx` | Visual regression. |
| Well Plot | PARTIAL/UI REFINED | `well-plot-panel.tsx` | Large data/performance. |
| Plotting | PARTIAL | `plotting/page.tsx`, `plot-templates-api.ts` | Attachments/color map placeholders. |
| Log Data | PARTIAL | `log-data/page.tsx`, `mwd-edit-tools-api.ts` | CSV/LAS import endpoint. |
| Charts | PARTIAL | `charts/page.tsx` | Export/performance. |
| Alerts | PARTIAL | `alerts/page.tsx`, WITS alarms | Backend alarm action E2E. |
| Memory Files | PARTIAL/BACKEND-DRIVEN | `memory-files-api.ts`, MemoryImportWizard | Gap fill/local staging decision. |
| System Utilities | PARTIAL | `system-utilities/page.tsx` | Process/system-log diagnostics. |
| Hardware/Connection | PARTIAL/REALTIME-ENABLED | `serial-api.ts`, `esp-ws-api.ts`, `connection-api.ts` | End-to-end device state. |
| Aux Port | BLOCKED BY BACKEND | `monitoring/aux-port/page.tsx` | Endpoint not available. |

## 18. Completed Improvements and Alignment

| Improvement | Evidence | Alignment |
|---|---|---|
| Runtime REST backend uses env and centralized API client. | `lib/api-client.ts` | Matches source-of-truth policy. |
| No runtime hardcoded local backend found in frontend. | env audit | Matches production integration requirement. |
| WebSocket event parser supports required event types. | `lib/realtime-client.ts` | Matches realtime requirement. |
| WebSocket stale socket guard added. | `lib/realtime-client.ts` | Reduces risk of duplicate reconnect/update paths after reconnect or session switch. |
| Session subscribe is sent after `activeMwdSessionId`. | AppContext + realtime client | Matches session-scoped realtime requirement. |
| Rig WITS simplified to Received Data and Output Queue. | `app/monitoring/rig-wits/page.tsx` | Matches operational clarity requirement. |
| Gateway ingest/raw debug removed from main Rig WITS view. | Rig WITS audit | Reduces UI overload. |
| Historical export includes date and depth filters. | Export/History pages | Matches export requirement. |
| History backend export no longer silently falls back to dummy/local data. | `app/history/page.tsx` empty blob errors | Aligns with no mock/fallback policy. |
| VS azimuth default 90 is intentional constant. | `lib/survey-defaults.ts` | Matches survey clarification. |
| Well Plot supports multi-track and responsive navigation. | `well-plot-panel.tsx` | Matches visual workflow requirement. |
| Plot template normalization supports `config` and `plotConfig`. | `plot-templates-api.ts` | Reduces backend/frontend shape mismatch risk. |
| Admin users/roles/audit logs are backend-driven. | Admin API libs | Supports admin production workflow. |
| Admin password edit avoids displaying current password. | `admin/page.tsx`, `admin-users-api.ts` | Matches security requirement. |
| System health `/api/health` integration exists. | `system-health-api.ts` | Improves observability. |
| Gateway raw packet API integration exists and now supports active session query plus expanded metadata normalization. | `gateway-raw-packets-api.ts`, AppContext, SystemHealthPanel | Improves hardware/debug visibility without using fake raw packet content. |
| Memory files import/points/correlation use backend endpoints. | `memory-files-api.ts`, MemoryImportWizard | Moves Memory workflow closer to production. |
| System utilities include preview/confirmation for clear data. | `system-utilities/page.tsx` | Supports destructive action safety. |
| Log Data local import/correlation placeholder is removed or marked unavailable. | `log-data/page.tsx` | Aligns with no local fallback policy. |
| Production build passes after latest frontend changes. | `npm run build` | Confirms current code compiles for production bundle. |

## 19. Known Mismatches and Critical Gaps

| Area | Gap | Impact | Priority | Recommendation |
|---|---|---|---|---|
| Operator session access | Need verify operator can read `/api/mwd-sessions`. | Dashboard/monitoring may fail for operator. | P0 | Backend role test and fix. |
| Backend authorization | Frontend guard exists but not security boundary. | Unauthorized mutation risk if backend weak. | P0 | Verify every protected endpoint by role. |
| WebSocket production behavior | Event auth/subscribe/session filtering needs E2E; frontend stale socket guard is fixed but production stream still unverified. | Realtime reliability risk. | P0 | Test WS connect/reconnect/subscription with real session and inspect duplicate events. |
| Historical export AND filter | Frontend sends date/depth filters, backend behavior unverified. | Incorrect export. | P1 | Contract test backend filter logic. |
| System Health `/api/health` | Frontend service exists; production support/shape must be verified. | Admin health may show unsupported/error. | P1 | Confirm backend endpoint and fields. |
| Gateway raw packet logs | Frontend service supports `sessionId` query and broad field mapping; backend support/permission/session filter still unverified. | Debug visibility may still fail. | P1 | Verify `/api/gateway-raw-packets?sessionId=<active>&limit=10` and detail endpoint. |
| Audit logs scale | Logs list exists; pagination/filter unclear. | Admin audit may become slow/noisy. | P1 | Add pagination/filter contract. |
| Memory gap fill | Backend import/correlation exists, but gap-fill staging still needs product/backend decision. | Memory workflow ambiguity. | P1 | Decide production behavior or mark advanced. |
| Plotting placeholders | Attachments/color map/upload actions still placeholder. | PDF/plot workflow incomplete. | P2 | Add backend endpoints or disable. |
| System diagnostics | Process/system logs unavailable. | Troubleshooting incomplete. | P2 | Add diagnostics endpoints. |
| PWA | Full manifest/service worker/cache strategy not verified as implemented. | Cannot claim full offline PWA. | P2 | Add PWA only with network-only operational data. |
| Large data performance | No universal virtualization. | Risk for long jobs. | P2 | Add pagination/virtualization/sampling. |
| Lint readiness | Production build passes, but lint still fails from existing non-patch issues. | CI/release quality risk. | P1 | Fix existing lint errors before release gating. |

## 20. Backend Dependencies / Required Endpoint Improvements

| Endpoint/Area | Required Improvement | Reason | Priority |
|---|---|---|---|
| `/api/mwd-sessions` | Confirm operator read-only access. | Session context is required for monitoring. | P0 |
| Auth/role enforcement | Enforce Admin/Engineer/Operator server-side. | Frontend guard is not enough. | P0 |
| WebSocket `/ws` | Confirm auth/session subscribe, event shape, session filtering, and reconnect behavior. | Realtime correctness. | P0 |
| `/api/exports/historical` | Confirm AND logic for date + depth filters. | Export accuracy. | P1 |
| `/api/health` | Confirm status, uptime, version, DB status, dependencies. | System health accuracy. | P1 |
| `/api/gateway-raw-packets` | Confirm list/detail shape, `sessionId` filter support, signal fields, and permissions. | ESP/gateway debugging. | P1 |
| `/api/audit-logs` | Add/confirm pagination, filters, retention. | Audit scalability. | P1 |
| `/api/wits-data-values` | Confirm mapping from WITS/raw to values and MWD data. | Log Data correctness. | P1 |
| `/api/wits-alarms/:id/*` | Confirm acknowledge/resolve persistence and roles. | Alert workflow. | P1 |
| `/api/memory-files/:id/correlate` | Confirm dryRun/apply mutation semantics. | Memory workflow integrity. | P1 |
| Plot attachments | Add upload/list/delete endpoints if in scope. | Plotting/PDF workflow. | P2 |
| Diagnostics/process logs | Add process/system logs endpoint. | Admin troubleshooting. | P2 |

## 21. Testing and Verification Requirements

| Test Area | Scenario | Expected Result | Priority |
|---|---|---|---|
| Env config | Missing API base URL. | Configuration error; no local fallback. | P0 |
| Auth | Expired token. | Session clears and login required. | P0 |
| Operator session | Operator calls `/api/mwd-sessions`. | Sessions returned read-only. | P0 |
| Role enforcement | Operator attempts mutation endpoint. | Backend rejects. | P0 |
| WebSocket | Connect, subscribe, disconnect, reconnect, session switch. | Status correct, stale socket events ignored, no duplicate updates. | P0 |
| Dashboard empty | No MWD data. | KPI shell remains, no fake values. | P0 |
| Rig WITS empty | Empty data and empty queue. | Explicit empty states. | P0 |
| Export filters | Date-only, depth-only, both. | Payload correct; backend returns correct blob. | P1 |
| System Health | `/api/health` online/unsupported/error. | Admin status and health panel accurate. | P1 |
| Gateway raw packets | Empty/list/detail/error/session-filtered query. | Raw diagnostics UI displays backend-provided packet/signal metadata and never generates raw packet content. | P1 |
| Audit logs | Empty/logs/error. | Table states correct. | P1 |
| Survey | Generate/recalculate with VS azimuth 90. | Correct backend request and visual result. | P1 |
| Memory | Import, points, dryRun, apply. | Backend state changes only after apply. | P1 |
| Utilities | Clear data preview then confirm. | No destructive action without preview/confirm. | P1 |
| Large data | Long history/log/well plot. | UI remains usable. | P2 |
| Build | Production build. | `npm run build` succeeds. | P0 |
| Lint | Project lint. | `npm run lint` has no errors before release. | P1 |

## 22. Visual Regression Requirements

Visual regression remains required because lint/build cannot validate chart correctness, layout overflow, or drilling visual semantics.

| Page | Required Checks | Breakpoints |
|---|---|---|
| Dashboard | KPI cards, status summary, chart, active alarms, no excessive negative space. | 1440 desktop, tablet, mobile |
| Rig WITS | Received Data and Output Queue 2 columns on desktop; no clipped content. | 1440 desktop, tablet, mobile |
| Admin | Users/Roles/Audit/System Health tabs and dialogs fit viewport. | 1440 desktop, tablet, mobile |
| System Health | Raw packet diagnostics, health cards, refresh behavior. | 1440 desktop, tablet, mobile |
| Trajectory | Depth-down behavior, planned/actual legend, Current MD/TVD placement, no overflow. | 1440 desktop, tablet, mobile |
| Well Plot | Multi-track display, track navigation, scale labels, no track clipping. | 1440 desktop, tablet, mobile |
| Export/History | Date/depth filters readable and buttons stable. | 1440 desktop, tablet, mobile |
| Memory Import | File detail/points/correlation panels fit screen. | 1440 desktop, tablet, mobile |

Current status: REQUIRED, not yet confirmed as automated in repository audit.

## 23. Open Questions / Needs Clarification

| Area | Status | Clarification / Decision |
|---|---:|---|
| Operator session access | NEEDS VERIFICATION | Confirm backend allows operator to read `/api/mwd-sessions` and read-only data endpoints. |
| Backend authorization | NEEDS VERIFICATION | Confirm backend enforces role restrictions beyond frontend guard. |
| Historical export filters | NEEDS VERIFICATION | Confirm backend applies `measuredFrom`/`measuredTo` and `depthMin`/`depthMax` with AND logic. |
| WebSocket auth/session filtering | NEEDS VERIFICATION | Frontend stale socket guard is fixed. Confirm production WS accepts subscribe session and only returns scoped data without duplicate events after reconnect/session switch. |
| `/api/health` | NEEDS VERIFICATION | Frontend service exists; confirm production endpoint response and fields. |
| Gateway raw packet logs | NEEDS VERIFICATION | Frontend sends active `sessionId` when available and normalizes raw/signal fields. Confirm backend supports `/api/gateway-raw-packets` list/detail response, `sessionId` filtering, signal fields, and permissions. |
| Audit logs | NEEDS VERIFICATION | Frontend uses `/api/audit-logs`; confirm backend pagination/filter/retention requirements. |
| Memory gap fill | NEEDS CLARIFICATION | Decide if gap-fill staging remains frontend helper or becomes backend mutation endpoint. |
| Plot attachments/color map | BLOCKED BY BACKEND / PLANNED | Upload/attachment/color-map placeholder requires endpoint or scope reduction. |
| Aux Port | BLOCKED BY BACKEND | Keep unavailable until backend endpoint exists. |
| PWA scope | NEEDS CLARIFICATION | Full PWA needs manifest/SW/cache policy; operational data must remain network-only/no stale live cache. |
| Lint readiness | NEEDS FIX | Production build passes, but project lint still fails due existing issues outside latest WebSocket/raw packet changes. Fix lint before treating the app as release-ready. |

## 24. Next Improvement Plan

### P0 - Critical

| Item | Module | Action |
|---|---|---|
| Verify operator session/data access | Session/RBAC | Test `/api/mwd-sessions` and read-only endpoints as operator. |
| Verify backend role authorization | Auth/RBAC/Backend | Attempt protected mutations per role and confirm backend rejects. |
| Verify WebSocket production behavior | Realtime | Test connect, subscribe, event scope, reconnect, cleanup. |
| Verify core dashboard no fake data | Dashboard/AppContext | Confirm empty/error states with empty backend. |

### P1 - High

| Item | Module | Action |
|---|---|---|
| Verify historical AND filter | Export/Backend | Add contract test for date+depth filters. |
| Stabilize `/api/health` | Admin/System Health | Confirm response shape and add backend fields if missing. |
| Stabilize raw packet diagnostics | Hardware/Gateway | Frontend session query and field normalization are in place; verify backend support for `sessionId`, list/detail shape, and permissions. |
| Improve audit logs | Admin | Add pagination/filter if backend supports. |
| Finalize Memory production workflow | Memory Files | Clarify gap fill and dryRun/apply semantics. |
| Visual regression checks | UI | Add screenshot tests for Dashboard, Rig WITS, Admin, Trajectory, Well Plot, Export/History. |
| Clean lint baseline | Code quality | Fix existing lint errors unrelated to the latest patch so lint can become release gate. |

### P2 - Medium

| Item | Module | Action |
|---|---|---|
| Plot attachment persistence | Plotting | Add backend upload/list/delete or disable actions. |
| LAS preset persistence | Generate LAS | Persist presets if production scope. |
| Charts export/performance | Charts | Implement file export and large data handling. |
| Diagnostics/process logs | System Utilities | Add backend process/system log endpoints. |
| Large data rendering | Log/History/Well Plot | Add pagination/virtualization/sampling. |
| PWA foundation | PWA | Add manifest/SW with no stale operational data cache. |

### P3 - Future

| Item | Module | Action |
|---|---|---|
| Aux Port | Monitoring | Implement when backend endpoint exists. |
| Advanced offline | PWA | Consider app-shell-only degraded mode. |
| Polaris migration guide | Help/Docs | Add workflow mapping for users moving from Polaris. |

## 25. Conclusion

MWD Monitoring App sudah berkembang menjadi sistem yang jauh lebih matang dibanding draft awal. Fondasi penting sudah sesuai arah produk: centralized API client, backend production source policy, auth/session handling, WebSocket client dengan stale socket guard, active session scope, Dashboard KPI, Rig WITS backend-driven layout, Admin users/roles/audit logs, `/api/health` system health integration, `/api/gateway-raw-packets` diagnostics yang session-aware di frontend, survey/trajectory/well plot workflow, export blob handling, dan Memory Files yang semakin backend-driven.

Bagian yang sudah kuat dan sesuai:

- REST API production integration.
- WebSocket event setup.
- WebSocket stale socket guard untuk mengurangi risiko duplicate reconnect/update.
- Session-scoped data flow.
- Rig WITS Received Data dan Output Queue.
- Dashboard status summary dan KPI stability.
- Admin Panel untuk user/role/audit/system health.
- Password security UI untuk admin user edit.
- Survey default VS azimuth 90 sebagai intentional constant.
- Well Plot multi-track/navigation.
- Export date/depth UI and blob handling.
- System Utilities preview/confirmation.
- Gateway raw packet normalizer yang membaca raw payload/message, session, transmitter, RSSI, SNR, sequence, parse status, dan error tanpa membuat data palsu.
- Production build berhasil setelah update terbaru.

Bagian yang belum boleh diklaim selesai penuh:

- Operator read-only backend access.
- Backend authorization enforcement.
- WebSocket production event scope and reconnect behavior, walaupun stale socket guard sudah diperbaiki di frontend.
- Historical export AND filter correctness.
- `/api/health` production response.
- `/api/gateway-raw-packets` production response, session filter, permission, dan field contract.
- Audit logs pagination/filter/retention.
- Memory gap-fill production decision.
- Plotting attachment/color map placeholders.
- Full PWA strategy.
- Visual regression automation.
- Lint readiness karena `npm run lint` masih gagal pada error existing di beberapa area non-patch.

Keputusan prioritas: sistem sudah layak diposisikan sebagai MWD Monitoring App backend-driven yang matang secara frontend dan cukup lengkap secara workflow. Namun production readiness masih bergantung pada verifikasi backend authorization, session visibility per role, realtime event behavior, export accuracy, health/raw packet endpoints, lint baseline, dan visual regression pada chart/trajectory/well plot.
