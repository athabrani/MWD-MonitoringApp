# MWD Monitoring App Central Server Deployment

This repository now targets a Central Local Server deployment for production/local operation.

Current deployment/package branch:

```text
package
```

Current validation notes:

- Backend Prisma Client generation and TypeScript build: passed.
- Frontend production build: passed.
- Package scaffold creation: passed.
- Production security env: passed.
- Local-only central runtime: READY.
- LAN env generated for `192.168.18.75`.
- LAN start requires ports `3000` and `5001` to be free from old local-only listeners.
- If login from `http://192.168.18.75:3000` calls `http://192.168.18.75:5001/api/auth/login` and gets `ERR_CONNECTION_REFUSED`, restart in LAN mode and verify backend binding on `0.0.0.0:5001` or `192.168.18.75:5001`.
- Cookie auth mode is supported: login may return `authMode: "cookie"` with `user` and `csrfToken`, without exposing a token in the response body.
- Frontend backend calls must use cookies with `credentials: "include"`; mutating requests send `x-csrf-token`.
- Central package build ignores `mwd-app-fe/.env.local` and uses `mwd-app-fe/.env`.
- Windows service installation: dry-run only; WinSW is the default service wrapper.

Selected architecture:

```text
Central local server
+ Level 3 installer/package only for the server utama
+ Browser/app-mode shortcut for server and user laptops
```

Not selected:

```text
Full isolated Level 3 install on every user laptop
```

## Quick commands

Check local-only:

```powershell
npm run central:check:local
```

Start local-only:

```powershell
npm run central:stop
npm run central:reset:dryrun
npm run central:reset
npm run central:env:local
npm run central:start:local:build
```

If `central:reset` reports `Access denied`, open PowerShell as Administrator and run the printed `Stop-Process -Id <PID> -Force` command. Do not stop PostgreSQL.

LocalOnly browser validation:

```text
Open http://127.0.0.1:3000
Do not mix localhost and 127.0.0.1 during cookie testing
Use Incognito/InPrivate or clear site data
POST /api/auth/login -> 200
Response includes authMode: cookie
Response headers include Set-Cookie
/api/auth/me is not 401
/api/mwd-sessions is not 401
Dashboard opens
```

Start LAN mode:

```powershell
npm run central:stop
npm run central:env:lan
npm run central:start:lan:build
```

Stop before switching between LocalOnly and LAN mode:

```powershell
npm run central:stop
npm run central:reset
```

Check LAN binding:

```powershell
npm run central:check:lan
netstat -ano -p tcp | Select-String ':5001|:3000'
```

Create server shortcut:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-central-shortcut.ps1 -AppUrl "http://127.0.0.1:3000" -Desktop -StartMenu
```

Create user shortcut:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-central-shortcut.ps1 -AppUrl "http://192.168.1.10:3000" -Desktop
```

Dry-run service install:

```powershell
npm run central:services:dryrun
```

Install Windows services only after LAN runtime and client access are verified:

```powershell
npm run central:reset
npm run central:services:dryrun
npm run central:services:install
```

`central:services:install` still asks for interactive confirmation and requires WinSW. The script does not download WinSW, apply firewall rules, open PostgreSQL, run migrations/seeds, or compile the installer.

Provide WinSW manually at:

```text
C:\Tools\winsw\WinSW-x64.exe
```

or set:

```powershell
$env:WINSW_PATH="D:\path\to\WinSW-x64.exe"
```

Manage service mode:

```powershell
npm run central:services:check
npm run central:services:start
npm run central:services:stop
npm run central:services:restart
```

If Windows reports `Cannot open ... service on computer '.'`, rerun the same service command from PowerShell as Administrator.

Service restart test:

1. Install service.
2. Restart laptop/server.
3. Wait 30-60 seconds.
4. Open `http://192.168.18.75:3000` from the server.
5. Open `http://192.168.18.75:3000` from a client device.
6. Login.
7. Confirm dashboard opens.
8. Run `npm run central:services:check`.

Dry-run firewall:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-central-firewall.ps1 -DryRun
```

Apply firewall only after explicit approval:

```powershell
npm run central:firewall:apply
```

The apply command still asks for confirmation in PowerShell. It must only open frontend `3000` and backend API/WebSocket `5001`. PostgreSQL `5432` must remain closed to LAN clients.

Dry-run LAN env:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-central-env.ps1 -LanMode -ServerHost 192.168.1.10 -DryRun
```

Apply LAN env only after confirming the real server IP, then rebuild frontend:

```powershell
npm run central:env:lan
```

## LAN client test

After the server laptop passes LAN mode, test from another laptop on the same LAN/VLAN:

1. Open `http://192.168.18.75:3000`.
2. Login.
3. Confirm the dashboard opens.
4. Confirm API requests target `http://192.168.18.75:5001`.
5. If the page does not open, check frontend port `3000` and Windows Firewall.
6. If the page opens but login/API fails, check backend port `5001`, backend LAN binding, and firewall.
7. Do not expose PostgreSQL `5432`.

## Stable IP

The current LAN address `192.168.18.75` can change if DHCP assigns a new address. For production use, configure either a DHCP reservation in the router or a static IP on the server laptop/industrial PC.

If the IP changes:

```powershell
npm run central:stop
powershell -ExecutionPolicy Bypass -File .\scripts\generate-central-env.ps1 -LanMode -ServerHost <NEW_SERVER_IP> -Apply
npm run central:start:lan:build
```

Then update user shortcuts to the new server URL.

Backup database:

```powershell
npm run central:backup:dryrun
npm run central:backup
```

Backup output:

```text
backups/database/mwd-db-backup-YYYYMMDD-HHMMSS.dump
```

Default retention:

```text
14 days
```

Schedule daily backup:

```powershell
npm run central:backup:schedule:dryrun
npm run central:backup:schedule
```

`central:backup:schedule` asks for `SCHEDULE`. Task name:

```text
MWDMonitoringDailyDatabaseBackup
```

Restore dry-run:

```powershell
npm run central:restore:dryrun
```

Restore to production is blocked unless extra flag and typed confirmation are used. Prefer restore to a new verification database first.

Prepare package:

```powershell
npm run central:package
```

## Documentation

Read:

- `docs/deployment/CENTRAL_LOCAL_SERVER_ANALYSIS.md`
- `docs/deployment/CENTRAL_LOCAL_SERVER_GUIDE.md`
- `docs/deployment/IP_BASED_CLIENT_ACCESS_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_SERVICE_GUIDE.md`
- `docs/deployment/CENTRAL_SERVICE_MODE_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_SECURITY_NOTES.md`
- `docs/deployment/CENTRAL_SERVER_BACKUP_GUIDE.md`
- `docs/deployment/CENTRAL_DATABASE_BACKUP_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_TROUBLESHOOTING.md`
- `docs/deployment/CENTRAL_SERVER_INSTALLER_GUIDE.md`
