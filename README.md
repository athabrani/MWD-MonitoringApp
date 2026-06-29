# MWD Monitoring App

## Quick Start for Existing Server

Use this when the central server has already been configured and services are installed.

```powershell
npm run central:services:check
```

Open:

```text
http://192.168.18.75:3000
```

Expected status:

```text
Backend service       : running
Frontend service      : running
Backend health        : OK
Frontend health       : OK
Final status          : READY
```

## Quick Start for Fresh Development Setup

Use this when the repository is newly cloned or the branch has just been checked out.

```powershell
npm install
npm run install:all
npm run central:env:local
npm run central:start:local:build
npm run central:check:local
```

Open:

```text
http://127.0.0.1:3000
```

## Overview

MWD Monitoring App is a web/PWA-style central local server application for MWD/WITS monitoring, session/job management, dashboard drilling data, Rig WITS, historical data, well plot, export, admin/settings, service runtime, and database backup.

The final deployment model uses one main server as the operational source of truth. User devices access the app through a browser or app-mode shortcut on the same LAN.

Current final status:

```text
Operational deployment on configured central local server: READY.
Admin-assisted installer pipeline: READY.
Installer release: release candidate.
Final stable installer: pending clean-machine installation test.
```

## Current Status

| Area | Status |
|---|---|
| Branch | `package` |
| Operational central local server | READY |
| LocalOnly runtime | READY |
| LAN runtime and client access | READY |
| Cookie-based auth | READY |
| Login and dashboard | READY |
| Backend WinSW service | running |
| Frontend WinSW service | running |
| Windows restart test | PASSED |
| Manual database backup | READY |
| Backup scheduler | READY |
| Installer pipeline | READY |
| Installer release status | RELEASE CANDIDATE |
| Final stable installer | pending clean-machine installation test |
| Receiver service | pending standalone receiver entrypoint verification |

## Architecture

```text
Industrial PC / Laptop Server Utama
|-- PostgreSQL
|-- Backend API Service
|-- Frontend Web Service
|-- Receiver / Gateway MWD-WITS
|-- Logs
|-- Backups
`-- LAN URL

User Device
`-- Browser / app-mode shortcut ke server
```

PostgreSQL runs only on the server. LAN clients must not connect directly to PostgreSQL. Client access goes through the frontend and backend API/WebSocket.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Node.js, Express, Prisma |
| Database | PostgreSQL |
| Realtime | WebSocket |
| Service manager | WinSW |
| Installer | Inno Setup |
| Backup | PostgreSQL custom dump via deployment scripts |

## Main Features

- Login/auth with cookie-based auth.
- Dashboard monitoring for MWD data.
- MWD sessions/job context.
- Rig WITS monitoring.
- Historical data.
- Well plot.
- Connection status and failover events.
- Export workflow.
- Admin/settings.
- Manual and scheduled database backup.
- Windows service runtime for backend/frontend.

## Deployment Modes

| Mode | Purpose | URL |
|---|---|---|
| LocalOnly | Testing/operation from server itself | `http://127.0.0.1:3000` |
| LAN | Access from other devices on same LAN | `http://192.168.18.75:3000` |
| Windows Service | Auto-start backend/frontend with Windows | Managed by WinSW |
| Installer | Admin-assisted server installation package | Release candidate |

## Prerequisites

Server utama membutuhkan:

```text
Windows 10/11
PowerShell
Git
Node.js
npm
PostgreSQL
WinSW
Inno Setup only for building installer
```

WinSW path used by deployment docs:

```text
C:\Tools\winsw\WinSW-x64.exe
```

Inno Setup compiler is only required for developers/admins who build the installer:

```text
C:\Users\<user>\AppData\Local\Programs\Inno Setup 6\ISCC.exe
```

or through:

```powershell
$env:INNO_SETUP_ISCC
```

## Setup from Fresh Clone / Pull Request

### 1. Prerequisites

Install or verify:

- Windows 10/11.
- PowerShell.
- Git.
- Node.js and npm.
- PostgreSQL.
- WinSW at `C:\Tools\winsw\WinSW-x64.exe` if using Windows Service mode.
- Inno Setup 6 only if compiling the installer.

### 2. Clone Repository from Scratch

Use `<repo-url>` as a placeholder if the repository URL is not known.

```powershell
cd "C:\Users\<username>\Documents\Code"
git clone <repo-url> MWD-MonitoringApp
cd MWD-MonitoringApp
git checkout package
```

### 3. Pull Latest Update from Branch

Use this flow if the repository already exists locally.

```powershell
cd "C:\Users\athallah\Documents\Code\MWD-MonitoringApp"
git status
git checkout package
git pull origin package
```

Notes:

- Make sure there are no important local changes before pulling.
- Do not commit `.env`, logs, backups, dump files, or installer output.
- Resolve conflicts before building or starting the app.

### 4. Install Dependencies

Root package has `install:all`, so the recommended install flow is:

```powershell
npm install
npm run install:all
```

Manual equivalent:

```powershell
npm install

cd mwd-app-be
npm install

cd ..\mwd-app-fe
npm install

cd ..
```

### 5. Environment Setup

Environment files are not stored in Git and must not be committed.

Backend and frontend env files are created/generated by central deployment scripts. Choose exactly one runtime mode.

#### LocalOnly

```powershell
npm run central:env:local
```

Use for:

```text
http://127.0.0.1:3000
```

#### LAN

```powershell
npm run central:env:lan
```

Use for:

```text
http://192.168.18.75:3000
```

Notes:

- If the server IP changes, regenerate LAN env and rebuild the frontend.
- Do not mix `localhost`, `127.0.0.1`, and LAN IP during cookie auth testing.
- Use one consistent host for login and authenticated requests.

### 6. Database Setup

PostgreSQL must be available on the central server. The operational database is expected to be `mwd_db` unless the generated backend env uses another configured database name.

Safety rules:

- Do not expose PostgreSQL port `5432` to LAN clients.
- All application access to database data must go through the backend API.
- Do not run destructive database commands for normal setup.

If needed, generate Prisma Client safely:

```powershell
cd mwd-app-be
npx prisma generate
cd ..
```

If migrations or seed are needed for a new local development database, review backend env first and use the existing non-destructive project scripts carefully:

```powershell
npm run setup:local
npm run seed:local
```

Do not run `prisma migrate reset` for this deployment flow.

### 7. Build Application

Recommended root build:

```powershell
npm run build
```

Manual equivalent:

```powershell
cd mwd-app-be
npx prisma generate
npx tsc

cd ..\mwd-app-fe
npm run build

cd ..
```

For central runtime, the `central:start:*:build` scripts also force the correct central build for the selected mode.

### 8. Run LocalOnly Mode

Use LocalOnly for server-only testing.

```powershell
npm run central:reset
npm run central:env:local
npm run central:start:local:build
npm run central:check:local
```

Open:

```text
http://127.0.0.1:3000
```

Validation:

- Login succeeds.
- Dashboard opens.
- `/api/auth/me` is not `401`.
- No `ERR_CONNECTION_REFUSED`.

### 9. Run LAN Mode

Use LAN mode when other devices need to access the server.

```powershell
npm run central:reset
npm run central:env:lan
npm run central:start:lan:build
npm run central:check:lan
```

Open:

```text
http://192.168.18.75:3000
```

Validation:

- Opens from the server.
- Opens from another device on the same network.
- Login succeeds.
- Dashboard opens.
- Backend health is OK.

Notes:

- Do not expose PostgreSQL.
- Server IP should be static or reserved by DHCP.

### 10. Windows Service Mode with WinSW

Stop manual runtime first. WinSW must be available at:

```text
C:\Tools\winsw\WinSW-x64.exe
```

Commands:

```powershell
npm run central:reset
npm run central:services:dryrun
npm run central:services:install
npm run central:services:start
npm run central:services:check
```

Expected:

```text
Backend service       : running
Frontend service      : running
Backend health        : OK
Frontend health       : OK
Final status          : READY
```

Restart test:

```text
Restart laptop/server -> wait 30-60 seconds -> npm run central:services:check -> open LAN URL.
```

### 11. Backup and Restore

Manual backup:

```powershell
npm run central:backup:dryrun
npm run central:backup
```

Scheduled backup:

```powershell
npm run central:backup:schedule
```

Backup folder:

```text
backups/database
```

Scheduled task:

```text
MWDMonitoringDailyDatabaseBackup
```

Retention:

```text
14 days
```

Restore:

- Restore defaults to dry-run through `npm run central:restore:dryrun`.
- Production restore requires explicit confirmation.
- Do not restore production without an additional fresh backup.

### 12. Installer Build

The installer is admin-assisted, not fully one-click. Prerequisites are still required. Clean-machine installation test is pending.

Commands:

```powershell
npm run central:package
npm run central:installer:generate
npm run central:installer:check
npm run central:installer:compile:dryrun
npm run central:installer:compile
```

Output:

```text
installer/output/
```

Files:

```text
installer/inno/MWDMonitoringCentralServer.iss.template
installer/inno/MWDMonitoringCentralServer.iss
```

`.iss.template` is the template source. `.iss` is the generated final script.

Inno Setup compiler can be located at:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
C:\Program Files\Inno Setup 6\ISCC.exe
$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe
$env:INNO_SETUP_ISCC
```

### 13. Fresh Machine Test Checklist

Use this checklist when testing another laptop as a new server:

```text
1. Install prerequisites.
2. Clone repo or run installer.
3. Setup PostgreSQL/database.
4. Place WinSW binary.
5. Generate env according to server IP.
6. Build/start service.
7. Open LAN URL.
8. Login.
9. Dashboard.
10. Backup.
11. Restart test.
12. Uninstall behavior.
```

Normal client laptops do not need full installation. They only need to open the LAN URL in a browser or app-mode shortcut.

### 14. Git Safety

Do not commit:

```text
.env
.env.local
.env.testing
*.env.backup
*.env.bak
service-logs/
backups/
*.dump
*.log
dist-central-server-package/
installer/output/
service/winsw/**/*.exe
service/winsw/**/*.xml
tools/winsw/*.exe
```

Safe to commit:

```text
README.md
docs/
scripts/*.ps1
service/winsw/**/*.xml.template
package.json
.gitignore
```

Safe checks before commit:

```powershell
git status --short
git diff --cached --name-only
git diff --cached --name-only | Select-String -Pattern "\.env|service-logs|backups|\.dump|\.log|\.exe|dist-central-server-package|installer/output"
```

Prefer selective `git add <file>` instead of `git add .`, unless `.gitignore` and staged files have been reviewed.

## Environment Safety

- `.env` files contain credentials and must not be committed.
- PostgreSQL port `5432` must not be exposed to LAN clients.
- Logs, backups, dumps, generated package output, and local WinSW binaries must remain uncommitted.
- Frontend must use generated `NEXT_PUBLIC_*` values that match LocalOnly or LAN mode.
- If LAN IP changes, regenerate env and rebuild frontend.

## Useful Commands

```powershell
npm run install:all
npm run build

npm run central:env:local
npm run central:start:local:build
npm run central:check:local

npm run central:env:lan
npm run central:start:lan:build
npm run central:check:lan

npm run central:services:dryrun
npm run central:services:install
npm run central:services:start
npm run central:services:check
npm run central:services:restart
npm run central:services:stop

npm run central:backup:dryrun
npm run central:backup
npm run central:backup:schedule:dryrun
npm run central:backup:schedule
npm run central:restore:dryrun

npm run central:package
npm run central:installer:generate
npm run central:installer:check
npm run central:installer:compile:dryrun
npm run central:installer:compile
```

## Documentation

- `README-CENTRAL-SERVER-DEPLOYMENT.md`
- `docs/PROJECT_CONTEXT_PRD.md`
- `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`
- `docs/deployment/CENTRAL_LOCAL_SERVER_GUIDE.md`
- `docs/deployment/CENTRAL_SERVICE_MODE_GUIDE.md`
- `docs/deployment/CENTRAL_DATABASE_BACKUP_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_INSTALLER_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_TROUBLESHOOTING.md`
