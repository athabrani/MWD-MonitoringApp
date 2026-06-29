# Central Service Mode Guide

This guide covers Windows Service mode for the MWD Monitoring App Central Local Server.

Update 2026-06-29: service mode is READY on the configured server. Backend and frontend WinSW services are running, `npm run central:services:check` is READY, and the Windows restart test has PASSED.

Dokumen final utama: `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`.

Service mode is only for the main server laptop/industrial PC. User laptops still access the app through a browser or app-mode shortcut.

## Service manager

Default service manager:

```text
WinSW / Windows Service Wrapper
```

WinSW is preferred for this deployment because it is a modern Windows Service wrapper with XML-based service configuration. NSSM is no longer the default service manager for this project and is treated only as a legacy/alternative reference.

## Target services

```text
MWDMonitoringBackend
MWDMonitoringFrontend
MWDMonitoringReceiver
```

Current receiver status:

```text
MWDMonitoringReceiver: pending
```

The receiver service is not installed until a standalone receiver/gateway entrypoint is verified. Current gateway/receiver behavior is started by the backend process.

## WinSW location

The scripts search these locations:

```text
WINSW_PATH environment variable
C:\Tools\winsw\WinSW-x64.exe
C:\winsw\WinSW-x64.exe
.\tools\winsw\WinSW-x64.exe
```

If WinSW is missing, download the x64 binary manually from the official WinSW GitHub Releases page through the approved admin process, then place it at:

```text
C:\Tools\winsw\WinSW-x64.exe
```

or set:

```powershell
$env:WINSW_PATH="D:\path\to\WinSW-x64.exe"
```

The deployment scripts do not download WinSW.

## Prerequisites

Before installing services:

1. LAN mode must be working manually.
2. Backend build must exist.
3. Frontend build must exist.
4. `mwd-app-be/.env` must use LAN binding:

```env
HOST=0.0.0.0
BACKEND_HOST=0.0.0.0
PORT=5001
```

5. `mwd-app-fe/.env` must point to the server IP:

```env
NEXT_PUBLIC_API_BASE_URL=http://192.168.18.75:5001
NEXT_PUBLIC_API_URL=http://192.168.18.75:5001
NEXT_PUBLIC_WS_URL=ws://192.168.18.75:5001/ws
```

6. Manual runtime must be stopped:

```powershell
npm run central:reset
```

## Dry-run service install

```powershell
npm run central:services:dryrun
```

Dry-run checks:

- WinSW availability;
- LAN env;
- backend build;
- frontend build;
- manual runtime listeners on `3000` and `5001`;
- planned service names;
- WinSW executable target paths;
- XML template and generated XML paths.

## Install services

Run only after dry-run is clean:

```powershell
npm run central:services:install
```

The script asks for interactive confirmation. Type:

```text
INSTALL
```

Install behavior:

- copies WinSW to `service/winsw/backend/MWDMonitoringBackend.exe`;
- copies WinSW to `service/winsw/frontend/MWDMonitoringFrontend.exe`;
- generates final XML files beside each executable;
- installs backend and frontend services;
- skips receiver until a standalone receiver entrypoint is verified.

The script does not:

- start services automatically;
- apply firewall rules;
- open PostgreSQL `5432`;
- run migration/seed;
- modify or clear database data;
- compile installer `.exe`.

## Manage services

```powershell
npm run central:services:status
npm run central:services:check
npm run central:services:start
npm run central:services:stop
npm run central:services:restart
```

Starting, stopping, restarting, and uninstalling Windows services may require an Administrator PowerShell session. If Windows returns `Cannot open ... service on computer '.'`, open PowerShell as Administrator and rerun the same command.

Uninstall requires explicit confirmation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\manage-central-services.ps1 -Uninstall
```

Then type:

```text
UNINSTALL
```

## Logs

WinSW writes logs under:

```text
service-logs
```

The backend/frontend services also use these service-specific log names from the generated XML and wrapper:

```text
MWDMonitoringBackend*.log
MWDMonitoringFrontend*.log
```

## Restart validation checklist

1. Install service.
2. Start services.
3. Restart laptop/server.
4. Wait 30-60 seconds.
5. Open `http://192.168.18.75:3000` from the server.
6. Open `http://192.168.18.75:3000` from a client device.
7. Login.
8. Confirm dashboard opens.
9. Run:

```powershell
npm run central:services:check
```

Expected:

```text
Service manager       : WinSW
Backend service       : running
Frontend service      : running
Backend health        : OK
Frontend health       : OK
Final status          : READY
```
