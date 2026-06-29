# Central Server Troubleshooting

## Frontend opens but data does not appear

Check:

- Backend is reachable: `http://127.0.0.1:5001/api/health`
- `NEXT_PUBLIC_API_BASE_URL` points to the central backend.
- `CORS_ORIGIN` includes the frontend origin.
- User token/session is still valid.

## 401 after valid login

Problem:

```text
POST /api/auth/login -> 200 OK
GET /api/auth/me -> 401 Unauthorized
GET /api/mwd-sessions -> 401 Unauthorized
```

Common causes:

- frontend was built with LAN env while backend is running LocalOnly, or the reverse;
- browser opened `localhost:3000` while backend cookies were set on `127.0.0.1`, or the reverse;
- frontend requests are not using `credentials: "include"`;
- CSRF token is missing on mutating requests;
- backend cookie is marked `Secure` while using plain HTTP.

Fix for LocalOnly:

```powershell
npm run central:stop
npm run central:env:local
npm run central:start:local:build
```

Open one consistent URL, preferably:

```text
http://127.0.0.1:3000
```

Fix for LAN:

```powershell
npm run central:stop
npm run central:env:lan
npm run central:start:lan:build
```

Open:

```text
http://192.168.18.75:3000
```

For HTTP LocalOnly/LAN, cookie env should remain:

```env
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=Lax
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
AUTH_EXPOSE_TOKEN=false
```

## API still points to localhost

For LAN mode, update `mwd-app-fe/.env`:

```env
NEXT_PUBLIC_API_BASE_URL=http://<SERVER_HOST>:5001
NEXT_PUBLIC_API_URL=http://<SERVER_HOST>:5001
NEXT_PUBLIC_WS_URL=ws://<SERVER_HOST>:5001/ws
```

Then rebuild frontend with `-ForceBuild`.

The helper script can prepare these values:

```powershell
.\scripts\generate-central-env.ps1 -ServerHost <SERVER_HOST> -DryRun
```

Apply only after confirming the real server IP:

```powershell
.\scripts\generate-central-env.ps1 -ServerHost <SERVER_HOST> -Apply
```

## Login API on server IP returns `ERR_CONNECTION_REFUSED`

Problem:

```text
http://192.168.x.x:5001/api/auth/login ERR_CONNECTION_REFUSED
```

Cause:

The frontend was rebuilt with the LAN API URL, but the backend is not listening on the LAN interface. It may be stopped, bound only to `127.0.0.1`, or blocked by an old local-only frontend/backend process.

Fix:

1. Stop central processes:

```powershell
npm run central:stop
```

2. If a remaining listener is reported on `127.0.0.1:3000` or `127.0.0.1:5001` and it was not started from a central PID file, close it manually before starting LAN mode.

3. Confirm backend env contains LAN binding:

```env
HOST=0.0.0.0
BACKEND_HOST=0.0.0.0
PORT=5001
```

4. Confirm frontend env uses the server IP and rebuild:

```env
NEXT_PUBLIC_API_BASE_URL=http://192.168.18.75:5001
NEXT_PUBLIC_API_URL=http://192.168.18.75:5001
NEXT_PUBLIC_WS_URL=ws://192.168.18.75:5001/ws
```

```powershell
npm run central:frontend:build
```

5. Start LAN mode:

```powershell
.\scripts\start-central-server.ps1 -LanMode -ServerHost 192.168.18.75
```

6. Verify bindings:

```powershell
netstat -ano -p tcp | Select-String ':5001|:3000'
```

Expected:

- backend: `0.0.0.0:5001` or `192.168.18.75:5001`
- frontend: `0.0.0.0:3000` or `192.168.18.75:3000`

If bindings are correct but another laptop cannot access the server, check firewall rules. Do not open PostgreSQL port `5432`.

## Login returns `200 OK` but frontend still shows request failed

Problem:

```text
POST /api/auth/login -> 200 OK
Frontend message: Request gagal diproses. Silakan coba lagi.
```

Cause:

The backend is using cookie auth and returns:

```json
{
  "user": {},
  "csrfToken": "...",
  "authMode": "cookie"
}
```

In this mode the backend does not expose `token` or `accessToken` in the response body. The frontend must not treat the missing token as a login failure.

Fix:

- keep `AUTH_EXPOSE_TOKEN=false`;
- ensure frontend login uses `credentials: "include"`;
- accept `authMode: "cookie"` as a valid login response when `user` exists;
- store the returned CSRF token in frontend auth state/storage;
- send cookies on later API calls with `credentials: "include"`;
- send `x-csrf-token` on `POST`, `PUT`, `PATCH`, and `DELETE` requests;
- keep backend CORS `credentials: true` with explicit origins;
- for HTTP LAN, set `AUTH_COOKIE_SECURE=false` and `AUTH_COOKIE_SAME_SITE=Lax`.

If `Set-Cookie` is missing from the login response, check backend cookie setup. If `Set-Cookie` exists but later requests do not include cookies, check frontend credentials mode and origin/hostname consistency.

## Port 3000 or 5001 is used

Run:

```powershell
.\scripts\check-central-server.ps1
```

The start script prints PID, process name, and command line when a required port is already occupied.

To inspect runtime processes safely:

```powershell
npm run central:reset:dryrun
```

To stop only listeners on central runtime ports `3000` and `5001`:

```powershell
npm run central:reset
```

If Windows returns `Access denied`, open PowerShell as Administrator and run the command printed by the script:

```powershell
Stop-Process -Id <PID> -Force
```

Do not stop PostgreSQL.

## LocalOnly Browser Validation

After changing auth or `NEXT_PUBLIC_*` env values, restart from a clean LocalOnly build:

```powershell
npm run central:stop
npm run central:reset:dryrun
npm run central:reset
npm run central:env:local
npm run central:start:local:build
```

Manual browser checklist:

1. Open `http://127.0.0.1:3000`.
2. Do not mix `localhost` and `127.0.0.1` while testing cookies.
3. Clear site data or use an Incognito/InPrivate window.
4. Login.
5. In DevTools Network, confirm `POST /api/auth/login` returns `200`.
6. Confirm login response includes `authMode: "cookie"`.
7. Confirm response headers include `Set-Cookie`.
8. Confirm `/api/auth/me` is not `401`.
9. Confirm `/api/mwd-sessions` is not `401`.
10. Confirm dashboard opens.

## PostgreSQL is down

Check the PostgreSQL Windows service and verify `DATABASE_URL` in `mwd-app-be/.env`. Do not switch to `mwd_test`.

## Backend exits immediately on production start

Check `service-logs/backend-error.log`. If it reports a security env error, fix `mwd-app-be/.env` before restarting:

- `JWT_SECRET` must be at least 32 characters.
- `GATEWAY_API_KEY` must be at least 32 characters when configured.
- `GATEWAY_HMAC_SECRET` must be at least 32 characters when configured.
- `AUTH_EXPOSE_TOKEN` must be disabled in production.
- `CORS_ORIGIN` must be explicit and must not contain `*`.

## Firewall blocks users

Run dry-run:

```powershell
.\scripts\configure-central-firewall.ps1 -DryRun
```

If local-only works but `http://<SERVER_IP>:3000` or `http://<SERVER_IP>:5001/api/health` is not reachable, verify:

- frontend/backend were started in LAN mode;
- Windows firewall allows only the required frontend/backend ports;
- PostgreSQL port `5432` remains closed to LAN clients;
- client and server are on the same LAN/VLAN.

Apply only if approved:

```powershell
.\scripts\configure-central-firewall.ps1 -ConfirmApply
```

## Service mode does not install

Run:

```powershell
npm run central:services:dryrun
```

Common blockers:

- WinSW is not installed.
- Manual runtime is still using `3000` or `5001`.
- LAN env is not applied.
- Backend or frontend build is missing.

Fix manual runtime first:

```powershell
npm run central:reset
```

Install WinSW manually through the approved admin process. Supported locations include:

```text
WINSW_PATH
C:\Tools\winsw\WinSW-x64.exe
C:\winsw\WinSW-x64.exe
.\tools\winsw\WinSW-x64.exe
```

The deployment script does not download WinSW.

## Service start says Cannot open service

Problem:

```text
Start-Service : Service 'MWD Monitoring Backend (MWDMonitoringBackend)' cannot be started
Cannot open MWDMonitoringBackend service on computer '.'
```

Cause:

Windows Service Control usually requires an Administrator PowerShell session to start, stop, restart, or uninstall services.

Fix:

1. Open PowerShell as Administrator.
2. Run:

```powershell
cd "C:\Users\athallah\Documents\Code\MWD-MonitoringApp"
npm run central:services:start
npm run central:services:check
```

If services start but health still fails, check WinSW logs in `service-logs`.

## Service restart validation

After service install:

1. Restart the server laptop.
2. Wait 30-60 seconds.
3. Open `http://192.168.18.75:3000` from the server.
4. Open `http://192.168.18.75:3000` from a client device.
5. Login.
6. Confirm the dashboard opens.
7. Run `npm run central:services:check`.

If services are running but the app is unavailable, inspect:

```text
service-logs/backend-service-error.log
service-logs/frontend-service-error.log
```

The firewall dry-run should only plan these ports:

```text
TCP 3000  frontend
TCP 5001  backend API/WebSocket
```

It must not open:

```text
TCP 5432  PostgreSQL
TCP 3002  frontend testing
TCP 5002  backend testing
```

## User laptops cannot access IP

Check:

- Server and client are on the same LAN/VLAN.
- Server IP did not change.
- Windows network profile is Private or firewall rule allows the frontend port.
- Frontend was started with LAN mode.
- Backend listens on `0.0.0.0:5001` or the server IP.
- Frontend listens on `0.0.0.0:3000` or the server IP.

Client laptop checklist:

1. Open `http://192.168.18.75:3000`.
2. Login.
3. Confirm the dashboard opens.
4. Confirm API calls target `http://192.168.18.75:5001`.
5. If the page is unreachable, check frontend port `3000`.
6. If login/API is unreachable, check backend port `5001`.
7. Never expose PostgreSQL `5432` to client laptops.

For stable operations, reserve the server IP in DHCP or configure a static IP on the server. If the IP changes, regenerate LAN env, rebuild frontend, restart LAN runtime, and update user shortcuts.

## Receiver is down

Check `/api/health` gateway status and backend logs. Current serial/ESP gateway startup is inside the backend process.

## WebSocket fails

Check:

- `NEXT_PUBLIC_WS_URL=ws://<SERVER_HOST>:5001/ws`
- Backend `/ws` is reachable from client network.
- Firewall allows backend port when browser connects directly to backend.

## `.env.local` causes confusion

Central local server scripts ignore `mwd-app-fe/.env.local`. Use `mwd-app-fe/.env` for operational deployment.

## Backup fails because pg_dump not found

Problem:

```text
pg_dump found         : no
```

Fix:

- Install PostgreSQL client tools on server, or
- pass explicit path:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-central-db.ps1 -Backup -PgDumpPath "C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe"
```

The script also searches PostgreSQL and pgAdmin install folders.

## Backup file empty

If backup file size is `0`, backup is invalid. Do not use it for restore. Re-run:

```powershell
npm run central:backup:dryrun
npm run central:backup
```

Then verify:

```powershell
Get-ChildItem .\backups\database\mwd-db-backup-*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name,Length,LastWriteTime
```

## Scheduled backup not running

Check task:

```powershell
Get-ScheduledTask -TaskName MWDMonitoringDailyDatabaseBackup
Get-ScheduledTaskInfo -TaskName MWDMonitoringDailyDatabaseBackup
```

If task missing, dry-run then install:

```powershell
npm run central:backup:schedule:dryrun
npm run central:backup:schedule
```

Type `SCHEDULE` only after reviewing plan.

## Restore safety

Default restore is dry-run. Prefer restore to a new verification database:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-central-db.ps1 -BackupFile ".\backups\database\<file>.dump" -TargetDatabase "mwd_restore_verify" -DryRun
```

Production restore is blocked unless `-AllowProductionRestore` is used and `RESTORE PRODUCTION` is typed. Script does not drop database automatically.
