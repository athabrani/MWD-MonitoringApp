# MWD Monitoring App Testing Audit Report

Generated: 2026-06-17  
Repository: `C:\Users\athallah\Documents\Code\MWD-MonitoringApp`  
Current branch observed locally: `testing`  
Current commit observed locally: `dc9789e`

> Note: the user request refers to branch `paper-testing`, but the repository currently reports branch `testing`. This report audits the checked-out working tree and existing evidence files.

## 1. Executive Summary

The repository contains a broad local test program covering functional end-to-end behavior, authentication and RBAC, active-session isolation, dashboard and real-time updates, historical filtering and CSV export, API performance, concurrent API load, end-to-end monitoring latency, record integrity, recovery behavior, compatibility, database verification, and security testing.

The strongest evidence is available for:

- Functional Playwright suite: 15/15 passed.
- Concurrent-user API suite: 1, 5, and 10 VU groups passed with 0% errors and p95 below 500 ms.
- End-to-end latency and integrity: 20, 100, and 1000 generated records all accepted and displayed, with no duplicates or invalid records.
- Recovery testing: network loss, WebSocket interruption, and backend restart each have 3/3 passed runs.
- Compatibility testing: 5 platforms x 4 cases = 20/20 passed.
- Security testing: 31 PASS, 2 N/A, 0 FAIL; no open Critical or High findings, but 4 Medium dependency findings remain open.

Important audit findings:

- Current Git history confirms testing-related commits: `e6af0fd` for functional testing, `ebb3780` for compatibility/performance/recovery work, and `dc9789e` for security testing.
- No uncommitted diff is currently available, so change causality is based on commit stats, current source, and test evidence, not on an active working-tree diff.
- API baseline has no single checked-in aggregate summary. Recomputing current p95 values from raw k6 files gives values different from the table values used in the paper draft. This should be rerun or regenerated before final publication.
- Some API result summary files still contain a `setup_data.token` field. This report does not reproduce token values, but raw evidence should be sanitized before sharing externally.
- The record-consistency summarizer expects `sql-verification-E2E-FINAL-1000.txt`, while the existing SQL evidence file is named `sql-E2E-FINAL-1000.txt`; therefore, the master record-consistency JSON was not present.
- Security environment evidence is stale relative to current HEAD: it records commit `ebb3780`, while the current HEAD is `dc9789e`.

## 2. Repository Testing Inventory

| Area | Implemented Evidence |
| --- | --- |
| Functional E2E | `mwd-app-fe/tests/e2e/mwd-monitoring.spec.ts`, `mwd-app-fe/playwright.config.ts`, `tests/results/functional/` |
| Authentication/RBAC | Functional FT-01, FT-02, FT-11, FT-12 and security SEC-01 to SEC-08 |
| Active-session isolation | FT-03, FT-04, SEC-10, SEC-11 |
| Dashboard and realtime visualization | FT-04, FT-05, FT-13, FT-14, latency and recovery specs |
| Historical filtering/export | FT-07 to FT-10, compatibility COMP-04, API export evidence |
| API baseline performance | `tests/load/api-load.js`, `tests/scripts/run-api-performance.ps1`, `tests/results/api/` |
| Concurrent-user/load | `tests/load/concurrent-api.js`, `tests/scripts/run-concurrent-api.ps1`, `tests/scripts/summarize-concurrent-results.mjs` |
| E2E latency | `mwd-app-fe/tests/performance/realtime-monitoring.spec.ts`, `tests/results/latency/` |
| Data integrity/database verification | `tests/sql/record-consistency.sql`, `tests/scripts/count-api-records.mjs`, `tests/results/integrity/` |
| Recovery | `mwd-app-fe/tests/performance/recovery.spec.ts`, `tests/scripts/run-recovery-tests.ps1`, `tests/scripts/run-backend-restart-recovery.ps1` |
| Compatibility | `mwd-app-fe/tests/compatibility/monitoring-compatibility.spec.ts`, `mwd-app-fe/playwright.compatibility.config.ts` |
| Security | `mwd-app-fe/tests/security/mwd-security.spec.ts`, `mwd-app-fe/playwright.security.config.ts`, `tests/scripts/run-security-tests.ps1` |

## 3. Detailed Testing Matrix

| ID | Testing | Tool | File | Scope | Configuration | Pass Criteria | Latest Result | Evidence |
| -- | ------- | ---- | ---- | ----- | ------------- | ------------- | ------------- | -------- |
| T01 | Functional end-to-end | Playwright 1.60.0 Chromium | `mwd-app-fe/tests/e2e/mwd-monitoring.spec.ts` | Login, session, dashboard, chart, well plot, history, export, RBAC, connection, empty state | `playwright.config.ts`, workers 1, retries 0, baseURL `http://localhost:3002` | 15 FT cases pass | Passed: 15/15 | `tests/results/functional/playwright-summary.json` |
| T02 | Authentication and RBAC | Playwright | Same as T01 plus security spec | Valid/invalid login, admin allowed, operator denied | Functional and security configs | Expected UI/API access decisions | Passed in FT and SEC | Functional summary; `security-test-cases.csv` |
| T03 | Active-session isolation | Playwright | `mwd-monitoring.spec.ts` | TEST-MWD-001 selection and dashboard data scoping | Session env defaults ID 1/name TEST-MWD-001 | Active label visible; rows scoped to session | Passed | FT-03, FT-04 |
| T04 | Dashboard realtime visualization | Playwright + gateway ingest helper | `mwd-monitoring.spec.ts`; `mwd-test-helpers.ts` | New gateway record updates chart/latest value | Gateway API key/HMAC env | Sequence appears in latest chart value | Passed | FT-05 |
| T05 | Well-plot ordering | Playwright | `mwd-monitoring.spec.ts`; `well-plot-panel.tsx` | Depth-ordered visual points | Seeded MWD data | At least plotted points and correct order | Passed | FT-06 |
| T06 | Historical filters and export | Playwright + API helper | `mwd-monitoring.spec.ts`; `history/page.tsx` | Time, depth, combined filters, CSV export | Seed data from `seed.testing.mjs` | Filters return expected scoped rows; CSV nonempty | Passed | FT-07 to FT-10; `manual-export-summary.json` |
| T07 | Baseline API performance | k6 | `tests/load/api-load.js`; `run-api-performance.ps1` | Sessions, current MWD data, historical data; optional export | 30 requests/run, 3 runs/endpoint, p95 < 500 ms, error < 1% | 0 failed requests and p95 < 500 ms | Passed functionally, but aggregate mismatch noted | `tests/results/api/*summary.json`, raw recomputation |
| T08 | Concurrent-user API | k6 | `tests/load/concurrent-api.js`; `run-concurrent-api.ps1` | 1, 5, 10 VU; 25% sessions, 50% MWD, 25% historical | 60 s per run, 3 runs per user level, pre-issued token | p95 < 500 ms, error < 1%, no 429 | Passed | `tests/results/load/concurrent-user-summary.json` |
| T09 | End-to-end monitoring latency | Playwright | `mwd-app-fe/tests/performance/realtime-monitoring.spec.ts` | Source-to-display delay for 20, 100, 1000 records | `playwright.performance.config.ts`; message count env | Generated=accepted=displayed; no duplicates; delay metrics recorded | Passed delivery; 1000-record p95 exceeds 500 ms target | `tests/results/latency/*summary.json` |
| T10 | Data integrity | SQL + Node scripts | `tests/sql/record-consistency.sql`; `count-api-records.mjs` | Generated, stored, API-returned, displayed sequence consistency | Run ID `E2E-FINAL-1000` | Counts equal; no duplicates/null/session mismatch | Passed by available SQL/API evidence | `api-count-E2E-FINAL-1000.json`, `sql-E2E-FINAL-1000.txt` |
| T11 | Network-loss recovery | Playwright | `recovery.spec.ts`; `run-recovery-tests.ps1` | Browser offline/online behavior | 3 runs | Disconnected detected, connected restored, valid post-recovery record, no lost/duplicates | Passed 3/3 | `recovery-results.json` |
| T12 | WebSocket-interruption recovery | Playwright | `recovery.spec.ts`; realtime E2E hook | Forced socket close | 3 runs | Same as T11 | Passed 3/3 | `recovery-results.json` |
| T13 | Backend-restart recovery | Playwright + PowerShell orchestration | `run-backend-restart-recovery.ps1`; `recovery.spec.ts` | Stop backend PID, verify port down, restart backend, reconnect without reload | Default 3 runs; port 5002; `/ws` readiness | 3 passed, active session restored, post-recovery record displayed, lost=0, duplicates=0 | Passed 3/3 | `backend-restart-run-01/02/03.json`, `recovery-results.csv` |
| T14 | Browser/device compatibility | Playwright | `monitoring-compatibility.spec.ts`; `playwright.compatibility.config.ts` | Chrome, Edge, Firefox, Pixel 7 Chromium emulation, iPhone 14 WebKit emulation | 4 cases/project, workers 1, retries 0 | 20 passed, no critical/major layout defects | Passed 20/20 | `compatibility-summary.json` |
| T15 | Security negative testing | Playwright + npm audit + optional ZAP | `mwd-security.spec.ts`; `run-security-tests.ps1` | Auth, RBAC, session isolation, validation, gateway, WS, CORS/headers, error handling, sensitive data | Chromium only, workers 1, retries 0; local env only | No Critical/High open; app security cases pass | Approved with 4 open Medium dependencies and 2 N/A cases | `security-summary.json`, `security-findings.json` |

## 4. Commands to Reproduce Every Test

Run from repository root unless noted. Required secrets are environment variables and are not listed here.

```powershell
# Functional E2E
cd .\mwd-app-fe
npx playwright test -c ".\playwright.config.ts" --workers=1 --max-failures=0

# Baseline API performance
cd ..
.\tests\scripts\run-api-performance.ps1

# Concurrent-user API performance
.\tests\scripts\run-concurrent-api.ps1
node .\tests\scripts\summarize-concurrent-results.mjs

# E2E latency, example
cd .\mwd-app-fe
$env:MONITORING_RUN_ID="E2E-PILOT-20"
$env:LATENCY_MESSAGE_COUNT="20"
npx playwright test -c ".\playwright.performance.config.ts" tests/performance/realtime-monitoring.spec.ts --workers=1

# Recovery except backend restart
cd ..
.\tests\scripts\run-recovery-tests.ps1

# Backend-restart recovery
$env:BACKEND_RESTART_RUNS="3"
.\tests\scripts\run-backend-restart-recovery.ps1

# Compatibility
.\tests\scripts\run-compatibility-tests.ps1

# Security
.\tests\scripts\run-security-tests.ps1

# Functional regression after security patches
cd .\mwd-app-fe
npm run build
npx playwright test -c ".\playwright.config.ts" --workers=1 --max-failures=0
```

## 5. Test Environment Requirements

- Frontend: `http://localhost:3002`
- Backend: `http://localhost:5002`
- Database: `mwd_test`
- Node/npm from latest security environment: Node.js `v25.0.0`, npm `10.9.2`
- Playwright: `1.60.0`
- Test users: `admin_test`, `engineer_test`, `operator_test`, security rate-limit account prefix
- Test sessions: `TEST-MWD-001`, `TEST-MWD-002`, `TEST-MWD-EMPTY`
- Gateway tests require API key/HMAC environment variables; values must not be printed.
- Compatibility desktop tests require installed Chrome and Edge browser channels.
- ZAP baseline requires Docker; latest evidence marks ZAP as skipped because Docker was unavailable.

## 6. Latest Verified Results

### Functional

- Total: 15
- Passed: 15
- Failed/skipped/interrupted: 0
- Execution time: 29.66 s
- Evidence: `tests/results/functional/playwright-summary.json`

### Baseline API

Per-run k6 summaries exist for sessions, MWD data, historical data, login, and export. Recomputed aggregate from current raw k6 files:

| Endpoint | Samples | Avg ms | Median ms | P95 ms | Max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sessions | 90 | 4.419 | 4.097 | 6.144 | 16.602 |
| MWD data | 90 | 28.515 | 23.618 | 45.280 | 90.342 |
| Historical data | 90 | 19.817 | 18.222 | 31.205 | 42.618 |

All values remain below the 500 ms threshold. However, these recomputed values do not exactly match the paper-table values currently present in drafts; regenerate one canonical baseline API summary before publication.

### Concurrent Users

| Users | Runs | Requests | P95 ms | Throughput | Error | 429 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 177 | 32.656 | 0.997 req/s | 0% | 0 |
| 5 | 3 | 885 | 27.745 | 4.982 req/s | 0% | 0 |
| 10 | 3 | 1770 | 33.895 | 9.942 req/s | 0% | 0 |

Evidence: `tests/results/load/concurrent-user-summary.json`

### End-to-End Latency

| Run | Generated | Accepted | Displayed | P95 ms | Max ms | Duplicates | Invalid |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| E2E-PILOT-20 | 20 | 20 | 20 | 319 | 491 | 0 | 0 |
| E2E-PILOT-100 | 100 | 100 | 100 | 499 | 5361 | 0 | 0 |
| E2E-FINAL-1000 | 1000 | 1000 | 1000 | 6273 | 10338 | 0 | 0 |

The 1000-record run validates delivery and integrity but does not meet the 500 ms p95 latency target.

### Data Integrity

- API returned: 1000 records, 1000 unique sequences.
- SQL evidence: 1000 stored, 1000 unique, 0 duplicates, 0 null sequence, 0 null timestamp, 0 invalid required fields, 0 session mismatch, 0 missing sequence.
- Evidence files: `tests/results/integrity/api-count-E2E-FINAL-1000.json`, `tests/results/integrity/sql-E2E-FINAL-1000.txt`

### Recovery

| Scenario | Runs | Passed | Mean Detect ms | P95 Detect ms | Mean Recover ms | P95 Recover ms | Lost | Duplicates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Network loss | 3 | 3 | 3402.667 | 6583 | 13179.333 | 13899 | 0 | 0 |
| WebSocket interruption | 3 | 3 | 4438.667 | 4744 | 9045.667 | 9504 | 0 | 0 |
| Backend restart | 3 | 3 | 5600.667 | 5683 | 504.667 | 594 | 0 | 0 |

Recovery definitions in `recovery.spec.ts` align with the requested definitions:

- `disconnect_detection_ms = disconnect_detected_ms - interruption_start_ms`
- `recovery_ms = first_valid_post_recovery_record_ms - service_restored_ms` when service restoration marker is available, otherwise connected timestamp fallback is used.

### Compatibility

| Platform | Browser/version | Device/viewport | Login | Dashboard | Plot | Export | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome desktop | 149.0.7827.104 | 1440x900 | PASS | PASS | PASS | PASS | PASS |
| Edge desktop | 149.0.4022.69 | 1440x900 | PASS | PASS | PASS | PASS | PASS |
| Firefox desktop | 150.0.2 | 1440x900 | PASS | PASS | PASS | PASS | PASS |
| Android Chrome emulation | 148.0.7778.96 | Pixel 7 | PASS | PASS | PASS | PASS | PASS |
| Safari Mobile WebKit emulation | 26.4 | iPhone 14 | PASS | PASS | PASS | PASS | PASS |

Totals: 20/20 passed, 0 critical/major/minor layout defects.

### Security

- Total cases: 33
- PASS: 31
- N/A: 2 (`SEC-09`, `SEC-18`)
- FAIL: 0
- Open Critical/High: 0
- Open Medium: 4 dependency findings (`next`, `postcss`, `exceljs`, `uuid`)
- ZAP: skipped because Docker unavailable
- Status: APPROVED under current rule because no Critical/High findings are open.

## 7. Application Improvements Caused by Testing

| File | Change | Reason | Test That Exposed/Validated It | Classification | Evidence |
| --- | --- | --- | --- | --- | --- |
| `mwd-app-fe/app/login/page.tsx`, `components/auth/login-screen.tsx` | Added stable test IDs and login interaction support | Enable deterministic login automation | FT-01, FT-02, COMP-01 | APPLICATION_FIX | Commit `e6af0fd`; functional tests |
| `mwd-app-fe/app/dashboard/page.tsx` | Added active-session selectors, hidden data rows, chart latest sequence attributes, responsive data scaffolding | Verify session isolation, realtime update, compatibility layout | FT-03 to FT-05, COMP-02, latency/recovery | APPLICATION_FIX | Commit `e6af0fd`, `ebb3780`; selectors in source |
| `mwd-app-fe/context/AppContext.tsx` | Active session persistence/resolution, realtime event handling, record deduplication, REST refresh hooks after realtime events | Preserve session and reconcile state after reconnect/restart | FT-04, FT-14, recovery backend restart | APPLICATION_FIX | Commit `ebb3780`, `dc9789e`; recovery 3/3 |
| `mwd-app-fe/lib/realtime-client.ts` | WebSocket reconnect state machine, tokenized URL, subscription/resubscription, diagnostics, E2E close/reconnect hooks | Backend restart and WebSocket interruption initially required robust reconnect | FT-13, FT-14, recovery, SEC-24 to SEC-26 | APPLICATION_FIX | Commits `ebb3780`, `dc9789e`; security/recovery results |
| `mwd-app-be/src/services/websocket.service.ts` | WebSocket authentication, subscription authorization, session-scoped broadcast | Prevent unauthenticated WS and session leakage | SEC-24, SEC-25, SEC-26; recovery resubscribe | APPLICATION_FIX | Commit `dc9789e`; `security-test-cases.csv` |
| `mwd-app-be/src/middlewares/error.middleware.ts` | Return sanitized 413 for oversized payload | Oversized payload should not return internal 500 | SEC-15 | APPLICATION_FIX | Commit `dc9789e`; SEC-15 PASS |
| `mwd-app-fe/components/well-plot-panel.tsx` | Well-plot layout/scrollbar and depth rendering improvements | Prevent layout overflow and verify plot bounds/depth order | FT-06, COMP-03 | APPLICATION_FIX | Commit `60c74fe`, `ebb3780`; compatibility 20/20 |
| `mwd-app-fe/app/history/page.tsx` | Added stable history row/export IDs and export affordance | Historical filtering/export automation and compatibility export | FT-07 to FT-10, COMP-04 | APPLICATION_FIX | Commits `e6af0fd`, `ebb3780` |
| `mwd-app-fe/components/layouts/app-layout.tsx` | Navigation test IDs and responsive/mobile navigation support | Compatibility helper needed mobile navigation | COMP-02 to COMP-04 | APPLICATION_FIX | Commit `ebb3780`; compatibility summary |
| `mwd-app-be/src/services/gateway-ingest.service.ts` | Gateway sequence handling/dedup support | Realtime, replay, integrity, and recovery record tracking | FT-05, latency, SEC-23 | APPLICATION_FIX | Commits `e6af0fd`, `ebb3780`; SEC-23 PASS |

## 8. Test-Script and Environment Improvements

| File | Change | Reason | Test Area | Classification | Evidence |
| --- | --- | --- | --- | --- | --- |
| `mwd-app-fe/playwright.config.ts` | Dedicated functional config with one worker, no retries, Chromium | Stable FT execution | Functional | CONFIGURATION_FIX | Commit `e6af0fd` |
| `mwd-app-fe/playwright.performance.config.ts` | Separate performance/recovery config | Avoid coupling with functional suite | Latency/recovery | CONFIGURATION_FIX | Commit `ebb3780` |
| `mwd-app-fe/playwright.compatibility.config.ts` | Five-project compatibility matrix | Browser/device evidence | Compatibility | CONFIGURATION_FIX | Commit `ebb3780` |
| `mwd-app-fe/playwright.security.config.ts` | Separate Chromium security config | Negative security suite isolation | Security | CONFIGURATION_FIX | Commit `dc9789e` |
| `mwd-app-fe/tests/helpers/mwd-test-helpers.ts` | Shared login, session, gateway HMAC, selector helpers | Prevent duplicated brittle test code | Functional/performance/compatibility/security | TEST_SCRIPT_FIX | Commit `ebb3780` |
| `tests/scripts/run-backend-restart-recovery.ps1` | PID-controlled backend restart, readiness probes, marker synchronization, non-zero failure exit | Ensure real backend restart recovery is measured | Backend restart | TEST_ENVIRONMENT_FIX | Commit `ebb3780`; recovery 3/3 |
| `tests/scripts/run-compatibility-tests.ps1` | Browser channel checks, per-project execution, summary aggregation | Avoid silent Chromium substitution and preserve platform evidence | Compatibility | TEST_ENVIRONMENT_FIX | Commit `ebb3780` |
| `tests/scripts/run-security-tests.ps1` | Preflight, npm audit, secret scan, Playwright security, optional ZAP, summary exit policy | Security evidence pipeline | Security | TEST_SCRIPT_FIX | Commit `dc9789e` |
| `tests/scripts/summarize-concurrent-results.mjs` | Recalculate p95 from raw samples; reject token in concurrent summaries | Avoid averaging run percentiles and leaking tokens | Load | TEST_SCRIPT_FIX | Commit `ebb3780` |
| `mwd-app-be/prisma/seed.testing.mjs` | Dedicated test roles, users, sessions, MWD records | Deterministic FT/API/export/recovery/compatibility data | All suites | TEST_DATA_FIX | Commit `e6af0fd` |
| `.gitignore`, app `.gitignore` files | Ignore env/result artifacts | Reduce accidental secret/result churn | Security/config | CONFIGURATION_FIX | Commit `e6af0fd`; security commit removed tracked env files |

## 9. Inconsistencies or Invalid Results Found

1. **Branch mismatch:** request says `paper-testing`; local branch reports `testing`.
2. **Current commit mismatch in security environment:** `security-environment.txt` records commit `ebb3780`; current HEAD is `dc9789e`.
3. **API baseline aggregate mismatch:** current raw k6 recomputation gives p95 values `6.144`, `45.280`, `31.205` ms for sessions/MWD/historical, not the paper values `5.72`, `42.30`, `29.64` ms.
4. **No canonical API aggregate summary:** baseline API has per-run raw/summary files but no checked-in aggregate JSON/CSV equivalent to concurrent-user summary.
5. **API summary token exposure:** several `tests/results/api/*summary.json` files contain a `setup_data.token` field. The token value is not reproduced here. Sanitize before publishing evidence.
6. **Record consistency summary missing:** `record-consistency-E2E-FINAL-1000.json` is not present. The script expects `sql-verification-E2E-FINAL-1000.txt`, but available SQL evidence is `sql-E2E-FINAL-1000.txt`.
7. **Compatibility aggregate Playwright totals:** `compatibility-summary.json` has correct raw-derived totals, but `playwrightTotals` is `0`. The project result files exist, so this appears to be an aggregation limitation rather than a test failure.
8. **ZAP not executed:** security summary is approved, but ZAP baseline evidence is a skipped placeholder due Docker unavailable. Do not claim ZAP found zero issues from an executed scan.
9. **Security N/A cases:** IDOR owner-only test and stored XSS execution are N/A due missing least-privileged session fixture and missing stored text input path. Do not claim those exact risks were fully tested.

## 10. Remaining Risks and Untested Areas

- Physical Android/iOS devices were not tested; mobile results are Playwright emulation.
- Wide-area network, cloud deployment, long-duration field testing, and high-latency links were not tested.
- Concurrent-user testing is limited to 10 VUs and read-heavy endpoints.
- 1000-record latency exceeds the normal 500 ms p95 target despite full delivery.
- Security has 4 open Medium dependency findings and skipped ZAP baseline.
- True owner-only session IDOR requires a fixture where a non-admin/non-engineer user cannot view a session.
- Stored XSS execution needs a real stored text/comment field fixture.
- API baseline evidence should be regenerated into a canonical aggregate file and sanitized.

## 11. Recommended Final Folder Structure for Test Evidence

```text
tests/results/
  functional/
    playwright-summary.json
    playwright-results.json
  api/
    baseline-api-summary.json
    baseline-api-summary.csv
    raw/
  load/
    concurrent-user-summary.json
    concurrent-user-summary.csv
    raw/
  latency/
    realtime-latency-*.csv
    realtime-latency-*-summary.json
  integrity/
    api-count-E2E-FINAL-1000.json
    sql-verification-E2E-FINAL-1000.txt
    record-consistency-E2E-FINAL-1000.json
  recovery/
    recovery-results.json
    recovery-results.csv
    *-run-*.json
  compatibility/
    compatibility-summary.json
    compatibility-summary.csv
    raw/
    screenshots/
    downloads/
  security/
    security-summary.json
    security-findings.json
    security-test-cases.csv
    dependency/
    zap/
```

## 12. Final Markdown Report

### Testing Valid for Paper Claims

- Functional FT-01 to FT-15: safe to claim 15/15 passed.
- Concurrent-user API performance: safe to claim 1/5/10 VU results from `concurrent-user-summary.json`.
- E2E delivery/integrity: safe to claim 100% delivery for 20, 100, 1000 workloads and no duplicates/invalid records.
- Recovery: safe to claim three passed runs for network loss, WebSocket interruption, and backend restart, with the measured times in `recovery-results.csv`.
- Compatibility: safe to claim 20/20 passed across the five listed platforms, with mobile explicitly described as emulation.
- Security: safe to claim automated security tests found no open Critical/High findings, with 4 Medium dependency findings and ZAP skipped due Docker unavailable.

### Testing That Should Be Rerun or Regenerated

- Baseline API aggregate summary should be regenerated from raw files or rerun to produce a canonical `baseline-api-summary.json/csv`.
- Record consistency summarizer should be rerun after aligning the SQL evidence filename.
- Security environment report should be regenerated at current HEAD.
- ZAP baseline should be run if Docker is available, otherwise state clearly that it was skipped.

### Proven Application Fixes

- Stable test IDs and deterministic UI state for login, dashboard, history, well plot, and navigation.
- Active-session preservation and dashboard/session-scoped rendering.
- WebSocket reconnect/resubscribe and frontend REST refresh behavior.
- WebSocket authentication and subscription/session authorization.
- Gateway replay/deduplication validation.
- Sanitized oversized-payload error handling.
- Responsive/mobile navigation and well-plot layout improvements.

### Test-Only or Environment Fixes

- Separate Playwright configs for functional, performance, compatibility, and security.
- PowerShell runners for API, concurrent load, recovery, backend restart, compatibility, and security.
- Summary scripts for Playwright, concurrent load, recovery, compatibility, record consistency, and security.
- Testing seed data and deterministic sessions/users.

### Claims Not Safe Yet

- Do not claim physical mobile-device verification.
- Do not claim ZAP baseline found zero alerts from an executed scan unless Docker/ZAP is rerun successfully.
- Do not use the exact old baseline API p95 values without regenerating a canonical aggregate.
- Do not claim complete IDOR owner-isolation coverage until a true unauthorized session fixture exists.
- Do not claim stored XSS coverage until a real stored text rendering path is tested.

