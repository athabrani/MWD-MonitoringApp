# Product Requirements Document - MWD Monitoring App

Versi: V2.1  
Tanggal audit: 2026-06-05  
Basis audit: repository frontend/backend lokal, service API frontend, environment usage, realtime client, dan implementasi UI terbaru.

## 1. Document Overview

Dokumen ini adalah pembaruan PRD MWD Monitoring App setelah integrasi backend REST production, setup WebSocket realtime, penghapusan beberapa mock runtime pada flow utama, refinement UI, peningkatan Admin Panel, klarifikasi system health, perbaikan trajectory/well plot, serta investigasi role/session access.

PRD ini tidak ditulis sebagai dokumen ideal. Seluruh status fitur di bawah dibedakan berdasarkan bukti implementasi:

| Status | Definisi |
|---|---|
| DONE | Fitur sudah ada dan terhubung ke backend atau state runtime yang relevan. |
| PARTIAL | Fitur sudah ada tetapi belum lengkap, masih ada fallback/local flow, atau perlu backend contract lebih kuat. |
| NEEDS FIX | Fitur berjalan tetapi tidak sesuai policy, UX, role, atau source of truth yang diinginkan. |
| NEEDS VERIFICATION | Kode frontend sudah ada, tetapi butuh uji end-to-end dengan backend production. |
| BLOCKED BY BACKEND | UI atau service membutuhkan endpoint/response shape backend yang belum tersedia atau belum pasti. |
| LOCAL-PREFERENCE | Data hanya boleh dianggap preferensi UI lokal, bukan source of truth operasional. |
| UI REFINED | Perubahan terutama di layout/UX, bukan perubahan integrasi data. |
| REALTIME-ENABLED | Modul menerima update dari WebSocket. |
| BACKEND-DRIVEN | Modul mengambil/menyimpan data melalui backend API production. |

Audience utama dokumen:

- Product owner dan pembimbing Capstone.
- Frontend engineer.
- Backend engineer.
- QA/tester.
- Admin/operator/engineer sebagai reviewer workflow.

## 2. Product Overview

MWD Monitoring App adalah aplikasi web/PWA untuk monitoring Measurement While Drilling. Sistem ini ditujukan untuk meningkatkan workflow Polaris dengan UI yang lebih modern, akses lintas perangkat, backend production sebagai source of truth, REST API, WebSocket realtime, role-based access, dan status koneksi yang lebih eksplisit.

Fungsi utama sistem:

- Monitoring data drilling/MWD.
- Visualisasi realtime dashboard, chart, dan status koneksi.
- Rig WITS handling: received data dan output queue.
- WITS configuration dan WITS data values.
- Survey data, planned survey, trajectory, dan well plot.
- Historical data, export CSV/JSON/LAS/PDF plot.
- Memory file workflow untuk import, preview points, dry-run/apply correlation.
- Admin panel untuk user, role, audit log, dan system health.
- Settings, threshold, alerts, dan system utilities.

Sistem mempertahankan modul yang familiar dari Polaris. Fitur seperti WITS Configuration, Log Data, Survey Data, Trajectory, Well Plot, Plotting, Export, LAS Export, Memory Import, Settings, System Utilities, dan Admin Panel tidak dianggap scope creep selama status integrasinya ditulis jujur.

## 3. Product Goals

| Goal | Deskripsi | Status Saat Ini |
|---|---|---|
| Monitoring MWD realtime berbasis web | Menampilkan data dan status drilling dari backend production. | PARTIAL, REALTIME-ENABLED |
| Backend sebagai source of truth | Data operasional berasal dari REST/WebSocket backend, bukan mock runtime. | PARTIAL, BACKEND-DRIVEN |
| Runtime mock removal | Jika backend kosong/error, UI menampilkan empty/error/unavailable state. | PARTIAL |
| KPI dashboard tetap tampil | KPI tetap terlihat meski sebagian value kosong/unavailable. | DONE |
| WebSocket realtime | Menerima `mwd-data`, `esp-gateway-status`, `connection-status`. | DONE, NEEDS VERIFICATION |
| Role-based access | Admin/Engineer/Operator dibedakan pada UI route/action. | PARTIAL |
| Export | Historical, survey, LAS, PDF plot via backend blob. | PARTIAL |
| Admin panel | Users, roles, audit logs, system health. | PARTIAL, BACKEND-DRIVEN |
| Trajectory/well plot | Planned/actual trajectory dan multi-track well plot. | PARTIAL, UI REFINED |
| UI responsive dan readable | Layout dashboard, Rig WITS, Admin, Well Plot lebih rapi. | PARTIAL |

## 4. Users and Roles

### Admin

Admin memiliki akses penuh ke halaman dan action. Admin dapat mengelola user, role, page access preference, audit log, system health, dan system utilities.

Evidence:

- Admin page guard: `mwd-app-fe/app/admin/page.tsx`.
- User API: `mwd-app-fe/lib/admin-users-api.ts`.
- Role API: `mwd-app-fe/lib/admin-roles-api.ts`.
- Audit logs API: `mwd-app-fe/lib/admin-audit-logs-api.ts`.
- Backend reachability: `mwd-app-fe/lib/admin-backend-health-api.ts`.
- Action permission helper: `mwd-app-fe/lib/security/permissions.ts`.

Status: PARTIAL, BACKEND-DRIVEN.

Catatan password security:

- Existing password tidak ditampilkan di UI.
- Create user meminta password baru.
- Edit user memakai field `New Password` dengan placeholder "Leave blank to keep current password".
- Frontend mengirim password hanya jika diisi pada update.
- Backend tetap harus menyimpan password hash dan tidak mengembalikan password/hash ke frontend.

### Engineer

Engineer adalah role operasional untuk membaca monitoring data, mengelola konfigurasi, survey, plotting, export, dan edit tools bila diizinkan.

Status: PARTIAL.

Catatan:

- Engineer secara default mendapat semua page kecuali Admin pada `mwd-app-fe/lib/page-access.ts`.
- Enforcement final tetap harus dilakukan backend. Frontend guard bukan security boundary.

### Operator

Operator adalah role read-only monitoring. Operator harus bisa membaca session/job aktif dan data monitoring yang relevan, tetapi tidak boleh menjalankan mutation destruktif.

Requirement penting:

- Operator harus dapat memanggil `GET /api/mwd-sessions`.
- Jika operator tidak mendapat session aktif, dashboard dan monitoring tidak akan memuat data.
- Issue operator tidak boleh diselesaikan dengan hardcoded `sessionId` atau mock session.
- Operator boleh melihat dashboard, Rig WITS, Log Data, Survey, Well Plot, Charts, Alerts, dan History sesuai access.
- Operator tidak boleh menjalankan create/update/delete config, survey mutation, output queue generation, export jika dibatasi, memory correlation apply, clear/restore data, atau admin actions.

Evidence:

- Default access operator tidak mencakup `export`, `system-utilities`, dan `admin`: `mwd-app-fe/lib/page-access.ts`.
- Rig WITS generate output dibatasi admin/engineer: `mwd-app-fe/app/monitoring/rig-wits/page.tsx`.
- History export dibatasi admin/engineer: `mwd-app-fe/app/history/page.tsx`.

Status: PARTIAL, NEEDS VERIFICATION.

## 5. Updated Architecture Overview

### Frontend

| Komponen | Fungsi | Evidence | Status |
|---|---|---|---|
| Next.js App Router | Route/page utama aplikasi. | `mwd-app-fe/app/**/page.tsx` | DONE |
| Centralized API client | Semua REST request memakai base URL env, bearer token, no-store. | `mwd-app-fe/lib/api-client.ts` | DONE |
| AuthContext | Login, token, user restore, logout, invalid session handling. | `mwd-app-fe/context/AuthContext.tsx` | DONE |
| FrontendSecurityGate | Redirect auth/unauth route. | `mwd-app-fe/components/frontend-security-gate.tsx` | DONE |
| AppContext | Session, MWD data, config, alarms, connection, realtime orchestration. | `mwd-app-fe/context/AppContext.tsx` | PARTIAL |
| Realtime client | WebSocket singleton, reconnect, subscribe/unsubscribe session. | `mwd-app-fe/lib/realtime-client.ts` | DONE |
| Role page access | Route/page access preference per role. | `mwd-app-fe/lib/page-access.ts` | LOCAL-PREFERENCE |
| UI components | shadcn/Radix-style reusable UI. | `mwd-app-fe/components/ui/*` | DONE |

### REST Backend

Production REST backend:

```env
NEXT_PUBLIC_API_BASE_URL=https://be-mwd.vercel.app
```

Frontend evidence:

- `mwd-app-fe/lib/api-client.ts` membaca `process.env.NEXT_PUBLIC_API_BASE_URL`.
- `getApiBaseUrl()` melempar configuration error jika env kosong.
- `normalizeApiPath()` menolak absolute URL per request.
- Runtime hardcoded `http://localhost:5001` atau `127.0.0.1` tidak ditemukan pada file runtime frontend. Localhost hanya muncul di README/dev/backend stub.

### WebSocket Backend

Production WebSocket backend:

```env
NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws
```

Frontend evidence:

- `mwd-app-fe/lib/realtime-client.ts` membaca `process.env.NEXT_PUBLIC_WS_URL`.
- Jika env kosong, status menjadi error "Missing NEXT_PUBLIC_WS_URL."

### Data Flow Utama

```text
Login
-> POST /api/auth/login
-> GET /api/auth/me
-> GET /api/mwd-sessions
-> set activeMwdSessionId
-> REST initial load
-> connect WebSocket
-> subscribe session
-> receive realtime events
-> update dashboard/chart/log/status
```

REST dipakai untuk initial load, CRUD, export, historical, admin, settings, dan utilities. WebSocket dipakai untuk realtime update. REST polling atau refresh boleh menjadi fallback data backend saat WebSocket disconnect, tetapi WebSocket failure tidak boleh memicu mock fallback.

## 6. Source of Truth and Data Policy

Policy data:

1. Backend production adalah source of truth untuk data operasional.
2. Frontend tidak boleh memakai mock/dummy/generated/simulated data sebagai runtime source untuk core data.
3. Jika backend data kosong, tampilkan empty state.
4. Jika backend error, tampilkan error state.
5. Jika endpoint belum ada, tampilkan unavailable state.
6. LocalStorage hanya boleh untuk token/session cache, active session selection, role page access preference, dan UI preference ringan.
7. LocalStorage tidak boleh menjadi source of truth untuk MWD data, WITS config, survey, alerts, audit logs, system health, atau export records.

Source mapping:

| Data | Source of Truth | Frontend Evidence | Status |
|---|---|---|---|
| Auth | `/api/auth/login`, `/api/auth/me` | `lib/auth-api.ts` | DONE |
| Sessions | `/api/mwd-sessions` | `lib/mwd-sessions-api.ts`, `context/AppContext.tsx` | DONE, NEEDS VERIFICATION for operator access |
| MWD Data | `/api/mwd-data`, WS `mwd-data` | `lib/mwd-data-api.ts`, `AppContext.tsx` | DONE, REALTIME-ENABLED |
| Historical Data | `/api/historical-data`, `/api/wits-data-values` | `lib/historical-data-api.ts`, `app/history/page.tsx` | PARTIAL |
| WITS Config | `/api/wits-config` | `lib/api/wits.ts` | DONE |
| WITS Values | `/api/wits-data-values` | `lib/api/wits.ts`, Log Data, History | PARTIAL |
| WITS Alarms | `/api/wits-alarms` | `lib/api/wits.ts`, Alerts/AppContext | PARTIAL |
| Surveys | `/api/surveys`, `/api/surveys/from-mwd-data`, `/api/surveys/recalculate` | `lib/surveys-api.ts` | PARTIAL |
| Plot Templates | `/api/plot-templates` | `lib/plot-templates-api.ts` | PARTIAL |
| Exports | `/api/exports/*` | `lib/exports-api.ts`, Export/History | PARTIAL |
| Memory Files | `/api/memory-files/*` | `lib/memory-files-api.ts`, Memory Import Wizard | PARTIAL |
| Depth Tracking | `/api/depth-tracking/*` | `lib/depth-tracking-api.ts` | PARTIAL |
| WITS Output | `/api/wits-output/*` | `lib/wits-output-api.ts`, Rig WITS | DONE, NEEDS VERIFICATION |
| Serial | `/api/serial/status` | `lib/serial-api.ts`, AppContext/SystemHealthPanel | PARTIAL |
| ESP WS | `/api/esp-ws/status`, WS `esp-gateway-status` | `lib/esp-ws-api.ts`, AppContext/SystemHealthPanel | PARTIAL |
| Connection | `/api/connection-status`, WS `connection-status` | `lib/connection-api.ts`, AppContext | DONE, REALTIME-ENABLED |
| Failover | `/api/failover-events` | `lib/connection-api.ts` | PARTIAL |
| Audit Logs | `/api/audit-logs` | `lib/admin-audit-logs-api.ts` | PARTIAL, NEEDS VERIFICATION |
| Gateway Raw Packets | expected `/api/gateway-raw-packets` or ESP payload fields | SystemHealthPanel displays raw if available | BLOCKED BY BACKEND / NEEDS VERIFICATION |
| System Health | Reachability fallback via `/api/roles` | `lib/admin-backend-health-api.ts` | PARTIAL |

## 7. REST API Integration

All frontend REST requests must use `apiRequest` or `apiFetch` from `mwd-app-fe/lib/api-client.ts`.

Important implementation evidence:

- `apiRequest` and `apiFetch` always combine relative path with `getApiBaseUrl()`.
- Absolute request paths are rejected.
- `cache` defaults to `no-store`.
- Bearer token is attached when token exists.
- 401 and invalid token-like failures notify auth invalid session and redirect through `AuthContext`.

Endpoint integration table:

| Module | Endpoint | Method | Service/Page | Status | Notes |
|---|---|---:|---|---|---|
| Auth | `/api/auth/login` | POST | `lib/auth-api.ts` | DONE | Login with identifier/password. |
| Auth | `/api/auth/me` | GET | `lib/auth-api.ts` | DONE | Session restore/profile. |
| Users | `/api/users` | GET/POST | `lib/admin-users-api.ts` | PARTIAL | Admin UI uses backend users. |
| Users | `/api/users/:id` | GET/PUT/DELETE | `lib/admin-users-api.ts` | PARTIAL | Update can send new password only when filled. |
| Roles | `/api/roles` | GET/POST | `lib/admin-roles-api.ts` | PARTIAL | Admin page currently loads roles; page access remains local preference. |
| Roles | `/api/roles/:id` | GET/PUT/DELETE | `lib/admin-roles-api.ts` | BACKEND-DRIVEN service | UI role CRUD not fully exposed. |
| Audit Logs | `/api/audit-logs` | GET | `lib/admin-audit-logs-api.ts` | PARTIAL | UI exists, response shape normalized, needs backend verification. |
| MWD Sessions | `/api/mwd-sessions` | GET/POST | `lib/mwd-sessions-api.ts` | DONE | Must be available to operator read-only. |
| MWD Sessions | `/api/mwd-sessions/:id` | GET/PUT/DELETE | `lib/mwd-sessions-api.ts` | PARTIAL | Used by config/session workflows. |
| MWD Data | `/api/mwd-data` | GET/POST/DELETE | `lib/mwd-data-api.ts` | DONE/PARTIAL | GET is core; mutations role-gated if used. |
| Historical Data | `/api/historical-data` | GET | `lib/historical-data-api.ts` | PARTIAL | Used with `/api/wits-data-values` in History. |
| WITS Config | `/api/wits-config` | GET/POST/PUT/DELETE | `lib/api/wits.ts` | DONE | Backend-driven. |
| WITS Values | `/api/wits-data-values` | GET | `lib/api/wits.ts` | PARTIAL | Backend should derive from incoming MWD/WITS data. |
| WITS Alarms | `/api/wits-alarms` | GET | `lib/api/wits.ts` | PARTIAL | Alarm source. |
| WITS Alarms | `/api/wits-alarms/:id/acknowledge` | POST | `lib/api/wits.ts` | PARTIAL | Needs E2E role verification. |
| WITS Alarms | `/api/wits-alarms/:id/resolve` | POST | `lib/api/wits.ts` | PARTIAL | Needs E2E role verification. |
| Surveys | `/api/surveys` | GET/POST | `lib/surveys-api.ts` | PARTIAL | Survey CRUD. |
| Surveys | `/api/surveys/:id` | GET/PUT/DELETE | `lib/surveys-api.ts` | PARTIAL | Survey row editing. |
| Surveys | `/api/surveys/from-mwd-data` | POST | `lib/surveys-api.ts` | PARTIAL | Uses default VS azimuth 90. |
| Surveys | `/api/surveys/recalculate` | POST | `lib/surveys-api.ts` | PARTIAL | Uses default VS azimuth 90. |
| Surveys | `/api/surveys/well-plan/import-csv` | POST | `lib/surveys-api.ts` | PARTIAL | Query-based import endpoint. |
| Plot Templates | `/api/plot-templates` | GET/POST | `lib/plot-templates-api.ts` | PARTIAL | Template persistence. |
| Plot Templates | `/api/plot-templates/default` | GET | `lib/plot-templates-api.ts` | PARTIAL | Default config. |
| Plot Templates | `/api/plot-templates/:id` | GET/PUT/DELETE | `lib/plot-templates-api.ts` | PARTIAL | Plotting config. |
| Export Historical | `/api/exports/historical` | POST | `lib/exports-api.ts`, Export/History | PARTIAL | Date+depth filter supported by frontend; backend AND behavior needs verification. |
| Export Surveys | `/api/exports/surveys` | POST | `lib/exports-api.ts` | PARTIAL | Blob handling. |
| Export LAS | `/api/exports/las` | POST | `lib/exports-api.ts` | PARTIAL | Generate LAS page has local preview/preset. |
| Export PDF Plot | `/api/exports/pdf-plot` | POST | `lib/exports-api.ts` | PARTIAL | Requires template/depth range. |
| Export Records | `/api/exports/records` | GET | `lib/exports-api.ts` | PARTIAL | Export history list. |
| MWD Edit Tools | `/api/mwd-data/edit/*` | GET/POST | `lib/mwd-edit-tools-api.ts` | PARTIAL | Preview-before-apply pattern. |
| Memory Files | `/api/memory-files` | GET | `lib/memory-files-api.ts` | PARTIAL | Backend list. |
| Memory Import | `/api/memory-files/import` | POST | `lib/memory-files-api.ts` | PARTIAL | Browser parses CSV then sends content. |
| Memory Detail | `/api/memory-files/:id` | GET/DELETE | `lib/memory-files-api.ts` | PARTIAL | Detail/delete. |
| Memory Points | `/api/memory-files/:id/points` | GET | `lib/memory-files-api.ts` | PARTIAL | Points preview. |
| Memory Correlate | `/api/memory-files/:id/correlate` | POST | `lib/memory-files-api.ts` | PARTIAL | dryRun/apply supported. |
| Memory Correlations | `/api/memory-files/correlations` | GET | `lib/memory-files-api.ts` | PARTIAL | History after apply. |
| Depth Tracking | `/api/depth-tracking/state` | GET | `lib/depth-tracking-api.ts` | PARTIAL | Dashboard status. |
| Depth Tracking | `/api/depth-tracking/samples` | GET | `lib/depth-tracking-api.ts` | PARTIAL | Samples. |
| Depth Tracking | `/api/depth-tracking/update` | POST | `lib/depth-tracking-api.ts` | PARTIAL | Manual update if exposed. |
| Depth Tracking | `/api/depth-tracking/recalculate` | POST | `lib/depth-tracking-api.ts` | PARTIAL | Recalculation. |
| WITS Output | `/api/wits-output/queue` | GET | `lib/wits-output-api.ts` | DONE/PARTIAL | Rig WITS output queue. |
| WITS Output | `/api/wits-output/generate-from-latest` | POST | `lib/wits-output-api.ts` | DONE/PARTIAL | Admin/engineer action. |
| WITS Output | `/api/wits-output/:id/status` | PUT | `lib/wits-output-api.ts` | DONE/PARTIAL | Status update. |
| Serial | `/api/serial/status` | GET | `lib/serial-api.ts` | PARTIAL | FE displays status only in main health. |
| Serial | `/api/serial/ports`, `/api/serial/connect` | GET/POST | `lib/serial-api.ts` | SERVICE EXISTS | Manual lifecycle should not be primary FE workflow. |
| ESP | `/api/esp-ws/status` | GET | `lib/esp-ws-api.ts` | PARTIAL | Status and raw fields if available. |
| Connection | `/api/connection-status` | GET | `lib/connection-api.ts` | DONE/PARTIAL | Status. |
| Failover | `/api/failover-events` | GET | `lib/connection-api.ts` | PARTIAL | Events/diagnostics. |
| System Utilities | `/api/system-utilities/*` | GET/POST | `lib/api/system-utilities.ts` | PARTIAL | Backup/restore/clear/config backup. |

Endpoint improvements needed:

- Dedicated `/api/health` or `/api/system-health` for uptime, version, DB status, and service dependencies. Current Admin health uses `/api/roles` reachability.
- Confirm backend supports historical export AND filtering for `measuredFrom`, `measuredTo`, `depthMin`, `depthMax`.
- Confirm gateway raw packet shape for `/api/gateway-raw-packets` or enrich `esp-gateway-status`.
- Confirm operator can access `/api/mwd-sessions` and read-only data endpoints.

## 8. WebSocket Realtime Integration

Endpoint:

```env
NEXT_PUBLIC_WS_URL=wss://be-mwd-production.up.railway.app/ws
```

Supported events in frontend:

1. `mwd-data`
2. `esp-gateway-status`
3. `connection-status`

Subscribe message:

```json
{
  "type": "subscribe",
  "sessionId": "activeMwdSessionId"
}
```

Implementation evidence:

- Event types and parser: `mwd-app-fe/lib/realtime-client.ts`.
- Reconnect with exponential backoff: `scheduleReconnect()`.
- Anti double connection: `connect()` returns if socket is OPEN or CONNECTING.
- Subscribe/unsubscribe session: `subscribeSession()` and `clearSessionSubscription()`.
- AppContext lifecycle: `mwd-app-fe/context/AppContext.tsx` connects when authenticated/token exists and subscribes when `activeMwdSessionId` exists.
- Cleanup on auth/session loss: AppContext clears subscription/disconnect path.

Realtime handling policy:

- WebSocket failure should display degraded/offline/error state.
- WebSocket failure must not generate mock MWD data.
- REST data remains allowed as backend-backed latest/historical load.
- Unknown realtime event is ignored and debug-logged.

Status: DONE, REALTIME-ENABLED, NEEDS VERIFICATION.

## 9. Core Feature Scope

### Core Monitoring

- Login/Auth.
- MWD Session.
- Dashboard.
- Rig WITS Received Data.
- WITS Output Queue.
- Realtime WebSocket.
- Connection/serial/ESP status.
- Alerts.
- Charts.
- History.
- Historical export.
- Role-based access.

### Polaris Workflow

- WITS Configuration.
- WITS Data Values.
- Log Data.
- Survey Data.
- Wellplan Survey.
- Trajectory.
- Well Plot.
- Plotting.
- Generate LAS.
- Memory Import.
- Settings/Threshold.
- System Utilities.

### Administrative

- User management.
- Role management.
- Frontend page access preference.
- Audit logs.
- System health dashboard.
- Backend reachability/API latency.

### Extended / Partial / Future

- Aux Port.
- Gateway raw packet stream if backend endpoint/event supports it.
- Dedicated system health endpoint.
- Full PWA service worker/manifest/cache strategy.
- Visual regression automation.
- Notification delivery.
- Plot attachment upload persistence.
- Memory local demo workflow separation from production workflow.

## 10. Functional Requirements

| ID | Requirement | Actor | Main Flow | Status | Gap/Notes |
|---|---|---|---|---|---|
| FR-01 | Authentication and session restore | All | Login via `/api/auth/login`, restore via `/api/auth/me`. | DONE | E2E token expiry still required. |
| FR-02 | Role-based route access | All | Route/page guard based on role and page access. | PARTIAL | Backend authorization must enforce final security. |
| FR-03 | MWD Session Management | All | Load `/api/mwd-sessions`, set `activeMwdSessionId`. | DONE/PARTIAL | Operator access must be verified. |
| FR-04 | Realtime Dashboard Monitoring | All | Load backend data and update via WS. | PARTIAL | Stale data visibility can be stronger. |
| FR-05 | Rig WITS Data Monitoring | All | Show Received Data from `/api/mwd-data` and Output Queue from `/api/wits-output/queue`. | DONE/PARTIAL | Backend payload shape needs E2E verification. |
| FR-06 | WITS Configuration | Admin/Engineer | CRUD `/api/wits-config`. | PARTIAL | Operator must remain read-only. |
| FR-07 | WITS Data Values | All | Show `/api/wits-data-values` derived from MWD/WITS backend mapping. | PARTIAL | Backend generation timing needs verification. |
| FR-08 | Log Data Management | Admin/Engineer | Browse MWD/WITS, preview/apply edit tools. | PARTIAL | CSV/LAS direct import endpoint unavailable. |
| FR-09 | Survey Data Management | Admin/Engineer | CRUD `/api/surveys`, generate/recalculate/import/export. | PARTIAL | Full backend contract and visual result need verification. |
| FR-10 | Trajectory Analysis | All | Plot actual/plan from `/api/surveys`. | PARTIAL | Visual regression required. |
| FR-11 | Well Plot Visualization | All | Multi-track from selected Plotting config. | PARTIAL/UI REFINED | Performance large data needs verification. |
| FR-12 | Charts and Parameter Analysis | All | Display parameter chart from backend/AppContext values. | PARTIAL | Chart export is not robust file export. |
| FR-13 | Connection Status Monitoring | All | REST and WS status cards. | DONE/PARTIAL | Stale/reconnect semantics need E2E. |
| FR-14 | ESP/Gateway Status Monitoring | All | `/api/esp-ws/status` and WS `esp-gateway-status`. | PARTIAL | Raw packet shape blocked/needs verification. |
| FR-15 | Alerts and Events | All | Display WITS alarms and generated status events. | PARTIAL | Generated events are frontend-derived, not audit source. |
| FR-16 | Historical Data Browser | All | Query `/api/historical-data` and `/api/wits-data-values`. | PARTIAL | Dual source mismatch possible. |
| FR-17 | Historical Data Export | Admin/Engineer | POST `/api/exports/historical` with optional date/depth filters. | PARTIAL | History page has local fallback export behavior needing policy review. |
| FR-18 | LAS Export | Admin/Engineer | POST `/api/exports/las`. | PARTIAL | Preset/preview partly local. |
| FR-19 | PDF/Plot Export | Admin/Engineer | POST `/api/exports/pdf-plot`. | PARTIAL | Plot upload/attachment metadata partial. |
| FR-20 | Memory File Workflow | Admin/Engineer | Import/list/detail/points/correlate via `/api/memory-files/*`. | PARTIAL | Local demo/gap fill remains. |
| FR-21 | Settings and Threshold | Admin/Engineer | Edit WITS config threshold fields. | PARTIAL | Notification delivery not implemented. |
| FR-22 | Admin User Management | Admin | CRUD `/api/users`. | PARTIAL | Needs backend authorization/password hash verification. |
| FR-23 | Admin Role Management | Admin | Load `/api/roles`, use roleId in user forms. | PARTIAL | Page access is local preference. |
| FR-24 | Audit Logs | Admin | Load `/api/audit-logs`. | PARTIAL/NEEDS VERIFICATION | Endpoint shape normalized but backend must be verified. |
| FR-25 | System Utilities | Admin | Backup/restore/clear/config backup endpoints. | PARTIAL | Diagnostics/process log unavailable. |
| FR-26 | Gateway Raw Packets | Admin/Engineer | Display raw packet if backend sends it. | BLOCKED BY BACKEND | UI shows unavailable when absent. |
| FR-27 | Operator Read-Only Mode | Operator | View monitoring without destructive mutation. | PARTIAL | Must verify route/action and backend permissions. |
| FR-28 | Empty/Error/Unavailable Policy | All | Empty for empty data, error for failed backend, unavailable for missing endpoint. | PARTIAL | Some local fallback export remains. |

## 11. Non-Functional Requirements

| ID | Requirement | Target | Current Implementation | Gap |
|---|---|---|---|---|
| NFR-01 | Realtime responsiveness | WS updates visible quickly. | Realtime client and AppContext handlers exist. | Need latency measurement. |
| NFR-02 | Data freshness visibility | UI distinguishes live/stale/offline. | Status cards exist. | Stale thresholds need strengthening. |
| NFR-03 | Backend availability handling | Backend error shown clearly. | API errors sanitized; health panel exists. | Dedicated health endpoint missing. |
| NFR-04 | WebSocket reliability | Reconnect, cleanup, no duplicate socket. | Implemented in `realtime-client.ts`. | E2E WS failure test needed. |
| NFR-05 | Security and token handling | Token invalidation and safe errors. | `AuthContext`, `api-client`, `security/*`. | Token is still JS storage; review risk. |
| NFR-06 | Role-based security | Backend enforces role. | Frontend guard and action helper exist. | Backend authorization must be verified. |
| NFR-07 | PWA installability | Manifest/SW/installable shell. | Prompt state only. | Full PWA missing. |
| NFR-08 | PWA cache safety | Do not show stale MWD as live. | API `no-store`. | No service worker strategy yet. |
| NFR-09 | Cross-device compatibility | Responsive layouts. | Tailwind responsive grids. | Visual regression needed. |
| NFR-10 | Polaris familiarity | Preserve familiar workflow. | Modules retained. | Help docs should map Polaris-to-web. |
| NFR-11 | Maintainability | Modular service files. | Good service separation. | AppContext is large. |
| NFR-12 | Modularity | Pages/components split. | Many modules split. | Plotting/Log pages still long. |
| NFR-13 | API consistency | Central API client. | Implemented. | Some response normalization hides backend inconsistency. |
| NFR-14 | Error handling | Safe, actionable errors. | Safe error helper. | Some module-specific errors need refinement. |
| NFR-15 | Data integrity | No mock source for core data. | Core mostly backend-driven. | History export local fallback and Memory local demo need policy cleanup. |
| NFR-16 | Export reliability | Blob handling and clear errors. | `lib/exports-api.ts`. | Backend filter/export semantics need E2E. |
| NFR-17 | Large table performance | Log/history/well plot remain usable. | Tables and filters exist. | Virtualization/pagination not universal. |
| NFR-18 | Accessibility/readability | Compact readable UI. | Improved layout. | Full a11y audit not done. |
| NFR-19 | Observability/diagnostics | Health/connection/audit visibility. | Admin SystemHealthPanel and audit logs. | Dedicated system health endpoint missing. |
| NFR-20 | Configuration safety | Destructive actions confirmed. | Clear/delete dialogs and preview-before-apply. | Backend authorization/audit verification needed. |

## 12. UI/UX Requirements

| Area | Requirement | Current Status | Evidence |
|---|---|---|---|
| Dashboard | KPI cards remain visible even when values unavailable. | DONE | `app/dashboard/page.tsx` |
| Dashboard | Status summary for Depth/DTS/Serial/ESP WS/Realtime compact and readable. | PARTIAL/UI REFINED | `app/dashboard/page.tsx`, `SystemHealthPanel` |
| Rig WITS | Main view only Received Data and Output Queue. | DONE | `app/monitoring/rig-wits/page.tsx` |
| Rig WITS | Desktop layout 2 columns, mobile stacked. | DONE | `grid grid-cols-1 ... lg:grid-cols-2` |
| Rig WITS | Received/output content fits container and does not look clipped. | UI REFINED/PARTIAL | Needs visual check. |
| Trajectory | Vertical Section depth-down and line remains in container. | UI REFINED/PARTIAL | Needs visual regression. |
| Trajectory | Planned/Actual legend does not overlap. | UI REFINED/PARTIAL | Needs visual regression. |
| Well Plot | Multi-track visible on desktop and navigation if tracks exceed visible count. | DONE/PARTIAL | `WellPlotPanel`, `TrackWindowControls` |
| Admin | Server status, API latency, active users, audit logs, system health visible. | PARTIAL | `app/admin/page.tsx` |
| Empty/Error | Empty/error/unavailable states are explicit. | PARTIAL | Many pages; some fallback remains. |

## 13. Workflow / Routemap

| Workflow | Trigger | Backend/API | Output UI | Status |
|---|---|---|---|---|
| Login | Submit credentials | `POST /api/auth/login`, `GET /api/auth/me` | User enters app/root. | DONE |
| Session selection | App startup or user switch | `GET /api/mwd-sessions` | `activeMwdSessionId` set/persisted. | DONE/PARTIAL |
| Dashboard monitoring | Active session available | `/api/mwd-data`, `/api/connection-status`, `/api/depth-tracking/state`, `/api/serial/status`, `/api/esp-ws/status`, WS | KPI, chart, alarms/status. | PARTIAL |
| WebSocket realtime | Auth/session available | `NEXT_PUBLIC_WS_URL`, subscribe session | Live update. | DONE/NEEDS VERIFICATION |
| Rig WITS | Open Rig WITS | `/api/mwd-data`, `/api/wits-output/queue` | Received Data and Output Queue. | DONE/PARTIAL |
| WITS config | Open Configuration/Settings | `/api/wits-config` | Config rows/thresholds. | PARTIAL |
| Log data | Open Log Data | `/api/mwd-data`, `/api/wits-data-values`, `/api/mwd-data/edit/*` | Browser and edit tools. | PARTIAL |
| Survey | Open Survey Data | `/api/surveys`, survey action endpoints | Survey CRUD/action/export. | PARTIAL |
| Trajectory | Open Trajectory | `/api/surveys` | Plan/actual charts. | PARTIAL |
| Well Plot | Open Well Plot | Plot templates + MWD data from context | Multi-track well plot. | PARTIAL |
| History | Load filters | `/api/historical-data`, `/api/wits-data-values` | Historical table/chart. | PARTIAL |
| Export | Run export | `/api/exports/*` | Blob download. | PARTIAL |
| Alerts | Open Alerts | WITS alarms/AppContext events | Active/ack/resolved cards. | PARTIAL |
| Memory import | Upload/select file | `/api/memory-files/*` plus local parser | Backend file points and local demo stages. | PARTIAL |
| Admin | Open Admin | `/api/users`, `/api/roles`, `/api/audit-logs`, reachability check | Users/roles/audit/system health. | PARTIAL |
| System utilities | Open Utilities | `/api/system-utilities/*` | Backup/restore/clear/config utilities. | PARTIAL |

## 14. Empty State and Error State Policy

Required policy:

- Backend returns empty list: show empty state, not mock data.
- Backend request fails: show error state with safe message.
- Endpoint not available: show unavailable/backend gap state.
- WebSocket disconnected: show disconnected/reconnecting/degraded, not fake live data.
- Missing env: show configuration error, not fallback localhost.

Implemented examples:

- API env missing throws explicit error in `lib/api-client.ts`.
- Rig WITS empty: "Belum ada received data untuk session ini." and "Belum ada output queue untuk session ini."
- Trajectory empty: explains no planned/actual survey stations returned.
- Admin audit empty: "No audit logs returned by the backend."
- Aux Port: explicit backend unavailable page.
- ESP raw packet: SystemHealthPanel shows "ESP raw packet stream belum tersedia dari backend."

Known issue:

- `app/history/page.tsx` can export loaded filtered dataset locally if backend CSV export fails or returns empty. This is not dummy data, but it is a local fallback that should be reviewed against the no-fallback production policy.

## 15. Role and Permission Policy

Policy:

- Frontend role guard improves UX but is not security boundary.
- Backend must enforce authorization for every protected endpoint.
- Operator must be read-only.
- Admin-only endpoints must reject non-admin at backend.
- Engineer mutations must be explicitly permitted.

Frontend evidence:

- Route/page access: `mwd-app-fe/lib/page-access.ts`.
- Admin-only page UI guard: `mwd-app-fe/app/admin/page.tsx`.
- Action permission helper: `mwd-app-fe/lib/security/permissions.ts`.
- Admin page access editor saves to localStorage via `saveRolePageAccess()`.

Risk:

- `rolePageAccess` is local preference and can be edited client-side. It must not be treated as backend authorization.
- Need backend verification that operator cannot mutate config, survey, exports, memory correlation apply, clear data, or admin resources.

## 16. Mock Data Removal Policy

Core policy:

- No runtime mock/dummy/generated/simulated data for MWD operational data.
- Frontend-derived status/alarm events may exist only as UI events derived from real backend status or threshold checks, not as backend audit/source data.
- Local demo workflows must be labeled clearly and must not mutate production data.

Current audit:

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Core MWD data | BACKEND-DRIVEN | `lib/mwd-data-api.ts`, AppContext | No mock packet stream found. |
| Rig WITS Received Data | BACKEND-DRIVEN | `/api/mwd-data` in `app/monitoring/rig-wits/page.tsx` | DONE. |
| Output Queue | BACKEND-DRIVEN | `/api/wits-output/*` | DONE/PARTIAL. |
| Alerts status events | FRONTEND-DERIVED | `generated-*` in AppContext/Dashboard | Not backend audit; acceptable if labeled. |
| Memory import local parser | PARTIAL/LOCAL DEMO | `memory-import-wizard.tsx`, `lib/memory-import.ts` | Still local demo for storage/correlation/gap fill. |
| History export fallback | NEEDS FIX | `app/history/page.tsx` | Local export fallback should be policy-reviewed. |
| Generate LAS preview/preset | PARTIAL | `app/data-management/generate-las/page.tsx` | Backend export exists, preview/preset local. |
| Plotting upload/attachments | PLACEHOLDER | `app/data-management/plotting/page.tsx` | Endpoint unavailable toasts. |
| Aux Port | BLOCKED BY BACKEND | `app/monitoring/aux-port/page.tsx` | Unavailable state. |

## 17. Module-by-Module Implementation Status

| Module | Status | Evidence | Main Gap |
|---|---|---|---|
| API Client / Env | DONE | `lib/api-client.ts`, `.env`, `.env.example` | None major. |
| Authentication | DONE/PARTIAL | `context/AuthContext.tsx`, `lib/auth-api.ts`, login page | E2E token expiry. |
| Session / Job | DONE/PARTIAL | `lib/mwd-sessions-api.ts`, AppContext | Operator backend access verification. |
| Dashboard | PARTIAL/REALTIME-ENABLED | `app/dashboard/page.tsx`, AppContext | Stale data/visual regression. |
| WebSocket Realtime | DONE/NEEDS VERIFICATION | `lib/realtime-client.ts` | Production stream E2E. |
| Rig WITS | DONE/PARTIAL/UI REFINED | `app/monitoring/rig-wits/page.tsx` | Backend queue/status E2E. |
| Admin Panel | PARTIAL/BACKEND-DRIVEN | `app/admin/page.tsx`, admin API libs | Health endpoint missing; role access local. |
| Historical Export | PARTIAL | `app/export/page.tsx`, `lib/exports-api.ts` | Backend AND filter verification. |
| History | PARTIAL/NEEDS FIX | `app/history/page.tsx` | Local fallback export policy. |
| Survey | PARTIAL | `app/data-management/survey-data/page.tsx`, `lib/surveys-api.ts` | E2E and role checks. |
| Trajectory | PARTIAL/UI REFINED | `app/trajectory/page.tsx` | Visual regression. |
| Well Plot | PARTIAL/UI REFINED | `components/well-plot-panel.tsx` | Large data performance. |
| Plotting | PARTIAL | `app/data-management/plotting/page.tsx`, `lib/plot-templates-api.ts` | Upload/attachments placeholder. |
| Log Data | PARTIAL | `app/data-management/log-data/page.tsx`, `lib/mwd-edit-tools-api.ts` | CSV/LAS import blocked. |
| Charts | PARTIAL | `app/charts/page.tsx` | Export/large data needs work. |
| Alerts | PARTIAL | `app/alerts/page.tsx`, AppContext | Backend alarm action E2E. |
| Memory Files | PARTIAL | `memory-import-wizard.tsx`, `lib/memory-files-api.ts` | Local demo remains. |
| System Utilities | PARTIAL | `app/system-utilities/page.tsx`, `lib/api/system-utilities.ts` | Diagnostics unavailable. |
| Hardware/Connection | PARTIAL | `serial-api.ts`, `esp-ws-api.ts`, `connection-api.ts`, SystemHealthPanel | Raw packet endpoint/shape. |
| PWA | MISSING/PARTIAL | `app/page.tsx`, AppContext, no manifest/SW | Full PWA not implemented. |

## 18. Known Mismatches and Gaps

| Area | Gap | Impact | Priority | Recommendation |
|---|---|---|---|---|
| Operator session access | Need verify operator can call `/api/mwd-sessions`. | Dashboard blank for operator if denied. | P0 | Backend authorization test. |
| Backend health | No dedicated `/api/health` or `/api/system-health`. | Admin health is reachability only. | P1 | Add health endpoint with uptime/version/DB/service statuses. |
| Historical export AND filter | Frontend sends date/depth filters, backend behavior not verified. | Incorrect exports. | P1 | Contract test for combined filter. |
| History local export fallback | Local loaded dataset exported if backend export fails/empty. | Violates strict no-fallback policy if treated as production export. | P1 | Remove fallback or label as local loaded-data export. |
| Gateway raw packets | UI displays raw if ESP payload has fields, endpoint shape uncertain. | Debug gap. | P1 | Add `/api/gateway-raw-packets` or enrich WS/ESP payload. |
| Role page access | Stored localStorage. | Not security final. | P1 | Move permissions to backend or document as UI preference only. |
| Memory import | Backend endpoints exist, but local demo/correlation/gap fill remains. | User may confuse local with production mutation. | P1 | Separate production backend path from demo helper. |
| PWA | No manifest/service worker. | Cannot claim full PWA. | P2 | Add manifest/SW/cache policy after data stability. |
| Diagnostics | Process/system logs unavailable. | Admin troubleshooting incomplete. | P2 | Add diagnostics endpoints. |
| Plotting attachments | Placeholder toasts. | PDF workflow incomplete. | P2 | Add attachment upload endpoints or disable action. |
| Charts export | Not robust file export. | Analysis export limited. | P2 | Implement PNG/CSV export with backend or clear frontend-only label. |
| Large data | No universal virtualization. | Performance risk. | P2 | Add pagination/virtualization for log/history/well plot. |

## 19. Backend Dependencies / Required Endpoint Improvements

Required backend work:

| Endpoint/Area | Required Improvement | Reason | Priority |
|---|---|---|---|
| `/api/mwd-sessions` | Allow operator read-only access. | Core monitoring requires session context. | P0 |
| `/api/exports/historical` | Confirm/support `measuredFrom`, `measuredTo`, `depthMin`, `depthMax` with AND logic. | Export accuracy. | P1 |
| `/api/health` or `/api/system-health` | Add uptime, version, DB, queue, WS, serial, ESP, storage status. | Admin health dashboard. | P1 |
| `/api/gateway-raw-packets` or ESP event payload | Provide raw packet fields and timestamp/signal. | ESP debugging. | P1 |
| `/api/audit-logs` | Confirm response shape and admin-only access. | Auditability. | P1 |
| `/api/wits-data-values` | Confirm mapping from incoming WITS/raw to WITS values/MWD data. | Log Data correctness. | P1 |
| `/api/wits-alarms/:id/*` | Confirm ack/resolve role access and persistence. | Alert workflow. | P1 |
| `/api/memory-files/*` | Confirm dryRun/apply semantics and production data mutation. | Memory workflow. | P1 |
| `/api/system-utilities/*` | Confirm backup/restore/clear behavior and audit logs. | Admin safety. | P1 |
| Plot attachment endpoints | Add upload/delete/list if attachments are production scope. | Plotting completeness. | P2 |
| Diagnostics endpoints | Add process/system logs. | Troubleshooting. | P2 |

## 20. Testing and Verification Requirements

Required tests:

| Test Area | Scenario | Expected Result | Priority |
|---|---|---|---|
| Env config | Remove `NEXT_PUBLIC_API_BASE_URL`. | Clear configuration error, no localhost fallback. | P0 |
| Auth | Token expired/invalid. | Session cleared, redirect login. | P0 |
| Operator session | Operator calls `/api/mwd-sessions`. | Receives sessions/job context read-only. | P0 |
| Dashboard empty | Backend returns no MWD data. | KPI cards remain, empty/unavailable shown. | P0 |
| WebSocket | Disconnect/reconnect backend WS. | Reconnecting/disconnected state, no mock data. | P0 |
| Rig WITS | Empty `/api/mwd-data` and empty queue. | Empty states shown. | P0 |
| Rig WITS | Queue generate as operator. | Action hidden/disabled or backend rejects. | P0 |
| Export | Date-only, depth-only, date+depth filters. | Payload omits empty fields and backend returns correct blob. | P1 |
| History export | Backend export fails. | No misleading production fallback. | P1 |
| Survey | Generate/recalculate with default VS azimuth 90. | Backend receives 90 and returns correct trajectory. | P1 |
| Admin users | Create/edit/delete user. | Backend mutation, password not displayed. | P1 |
| Audit logs | Backend returns logs/empty/error. | Table, empty, error states correct. | P1 |
| System utilities | Clear data preview/confirm. | Preview before destructive action. | P1 |
| Memory | Dry-run/apply correlation. | dryRun preview before apply; local demo clearly labeled. | P1 |
| PWA | Offline behavior when added. | No stale realtime data as live. | P2 |

## 21. Visual Regression Requirements

Screenshot/visual checks remain required because many defects cannot be caught by lint/build:

| Page | Checks | Breakpoints |
|---|---|---|
| Dashboard | KPI cards, Depth/DTS/Serial/ESP WS/Realtime status summary, active alarm cards, chart spacing. | desktop 1440, tablet, mobile |
| Rig WITS | Received Data and Output Queue 2 columns on desktop, stacked on mobile, text not clipped. | desktop 1440, tablet, mobile |
| Admin | Users/Roles/Audit/System Health tabs readable, dialogs fit viewport. | desktop 1440, tablet, mobile |
| Trajectory | Vertical Section stays in container, depth-down, Current TVD/MD placement, Planned/Actual legend no overlap. | desktop 1440, tablet, mobile |
| Well Plot | Multi-track desktop layout, track navigation visible when needed, labels not clipped. | desktop 1440, tablet, mobile |
| Export/History | Date range and depth range inputs clear, export buttons state correct. | desktop 1440, tablet, mobile |
| System Utilities | Preview/confirm panels and health cards readable. | desktop 1440, tablet, mobile |

Current status: REQUIRED, not yet automated in repository audit.

## 22. Open Questions / Needs Clarification

| Area | Status | Clarification / Decision Needed |
|---|---:|---|
| Operator backend access | NEEDS VERIFICATION | Confirm backend allows operator to read `/api/mwd-sessions`, `/api/mwd-data`, `/api/wits-data-values`, `/api/surveys`, alarms/history as read-only. |
| Historical export filter semantics | NEEDS VERIFICATION | Confirm backend applies date range and depth range using AND when both are present. |
| Gateway raw packets | BLOCKED BY BACKEND / NEEDS VERIFICATION | Confirm whether raw packet stream is provided by `/api/gateway-raw-packets`, `/api/esp-ws/status`, or WS `esp-gateway-status`. |
| System health endpoint | BLOCKED BY BACKEND | Dedicated `/api/health` or `/api/system-health` not found in frontend. Current health is reachability via `/api/roles`. |
| Audit logs endpoint | NEEDS VERIFICATION | Frontend uses `/api/audit-logs`; backend availability and shape must be verified. |
| Role/page access source | NEEDS CLARIFICATION | Current per-page access is local UI preference. Decide whether backend should persist/enforce feature permissions. |
| History local export fallback | NEEDS FIX / DECISION | Decide whether local loaded-dataset export fallback is allowed or must be removed for production policy. |
| Memory local workflow | NEEDS CLARIFICATION | Decide whether local parser/correlation/gap fill remains demo/advanced or becomes backend-enforced production workflow. |
| PWA scope | NEEDS CLARIFICATION | Decide whether full PWA service worker/manifest is required before demo or future work. |
| Serial lifecycle | RESOLVED | FE should display serial status, not provide manual primary connect/disconnect lifecycle. Service functions exist but main UI should remain status-oriented. |
| VS azimuth | RESOLVED | Default vertical section azimuth remains 90 via `DEFAULT_VERTICAL_SECTION_AZIMUTH`. |

## 23. Next Improvement Plan

### P0 - Critical

| Item | Module | Action |
|---|---|---|
| Verify operator session/read-only access | Auth/Session/RBAC | Test backend role permissions; fix backend if operator cannot load sessions. |
| Remove misleading fallback data behavior | History/Export | Review local export fallback and align with no runtime fallback policy. |
| Realtime disconnect behavior | Dashboard/AppContext | Test WS disconnect/reconnect; ensure no mock data and status is clear. |
| Core backend env consistency | API Client/Deployment | Ensure production env is set in all deployments and missing env fails clearly. |

### P1 - High

| Item | Module | Action |
|---|---|---|
| Historical export contract | Export/Backend | Add tests for date/depth AND filter. |
| Admin health endpoint | Admin/System Health | Add `/api/health` or `/api/system-health`. |
| Gateway raw packet stream | Hardware/ESP | Define endpoint/event payload and display raw packet logs. |
| Memory production separation | Memory Import | Separate backend-backed workflow from local demo helpers. |
| Audit logs verification | Admin | Confirm endpoint access/shape and add filters/pagination if needed. |
| Role permission backend enforcement | Backend/Admin | Move page/feature permissions to backend if required. |
| Visual regression checks | UI | Add Playwright screenshots for Dashboard, Rig WITS, Trajectory, Well Plot, Export. |

### P2 - Medium

| Item | Module | Action |
|---|---|---|
| Plot attachments | Plotting | Add backend attachment upload/list/delete or disable production action. |
| LAS preset persistence | Generate LAS | Persist presets if production scope. |
| Chart export | Charts | Implement real PNG/CSV export or document as frontend-only. |
| Large data performance | Log/History/Well Plot | Add pagination/virtualization and sampling strategy. |
| Diagnostics | System Utilities | Add process/system logs endpoint. |
| PWA foundation | PWA | Add manifest/SW only with network-only policy for operational data. |

### P3 - Lower/Future

| Item | Module | Action |
|---|---|---|
| Aux Port | Monitoring | Implement only when backend endpoint exists. |
| Advanced offline | PWA | Consider app-shell-only offline with degraded state. |
| Polaris user guide | Help | Add workflow mapping for old Polaris users. |

## 24. Conclusion

MWD Monitoring App terbaru sudah memiliki fondasi yang kuat untuk menggantikan dan meningkatkan workflow Polaris. Bagian yang paling kuat adalah centralized API client, backend production URL policy, token/session handling, WebSocket client, active session orchestration, Rig WITS backend-driven view, survey/trajectory/well plot workflow, admin users/roles/audit/system health UI, dan explicit empty/error/unavailable states pada banyak modul.

Namun sistem belum boleh diklaim production-ready penuh. Area terbesar yang masih perlu diperbaiki adalah verifikasi operator read-only backend access, historical export filter semantics, local fallback pada History export, pemisahan Memory local demo dari production workflow, dedicated system health endpoint, gateway raw packet stream, backend-enforced authorization, PWA strategy, dan visual regression checks.

Keputusan produk yang direkomendasikan:

1. Perlakukan backend production sebagai source of truth final.
2. Pertahankan workflow Polaris sebagai scope sah, tetapi beri status jujur pada fitur partial.
3. Jangan menyelesaikan gap data dengan hardcoded session, mock data, atau fallback lokal.
4. Prioritaskan P0/P1 sebelum klaim production-ready atau demo final.
5. Jadikan visual regression sebagai bagian wajib untuk chart, trajectory, well plot, Rig WITS, dashboard, dan export/history.

