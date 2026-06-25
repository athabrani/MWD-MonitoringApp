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
- Windows service installation: dry-run only; NSSM is not installed.

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

Dry-run firewall:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-central-firewall.ps1 -DryRun
```

Dry-run LAN env:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-central-env.ps1 -LanMode -ServerHost 192.168.1.10 -DryRun
```

Apply LAN env only after confirming the real server IP, then rebuild frontend:

```powershell
npm run central:env:lan
```

Backup database:

```powershell
npm run central:backup
```

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
- `docs/deployment/CENTRAL_SERVER_SECURITY_NOTES.md`
- `docs/deployment/CENTRAL_SERVER_BACKUP_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_TROUBLESHOOTING.md`
- `docs/deployment/CENTRAL_SERVER_INSTALLER_GUIDE.md`
