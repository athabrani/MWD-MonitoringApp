# Central Server Service Guide

Update 2026-06-29: Backend service WinSW and frontend service WinSW are running. `npm run central:services:check` reports READY on the configured central local server. Windows restart test has PASSED.

Dokumen final utama: `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`.

## Service manager

The default Windows Service wrapper is:

```text
WinSW / Windows Service Wrapper
```

NSSM is no longer the default service manager. Any old NSSM references are legacy/alternative context only.

## Services

Planned Windows services:

- `MWDMonitoringBackend`
- `MWDMonitoringFrontend`
- `MWDMonitoringReceiver`

`MWDMonitoringReceiver` is pending and skipped by installer scripts until a standalone receiver command is manually verified. Current receiver/gateway logic starts inside the backend process.

PostgreSQL is expected to run as its own PostgreSQL service. Do not expose PostgreSQL port `5432` to LAN clients.

## WinSW setup

Primary WinSW location for the validated server:

```text
C:\Tools\winsw\WinSW-x64.exe
```

Supported WinSW locations:

```text
WINSW_PATH
C:\Tools\winsw\WinSW-x64.exe
C:\winsw\WinSW-x64.exe
.\tools\winsw\WinSW-x64.exe
```

Download WinSW x64 manually from the official GitHub Releases page through the approved admin process. The deployment scripts do not download WinSW.

## Dry-run install

```powershell
npm run central:services:dryrun
```

## Install

Requires:

- WinSW available;
- LAN env applied;
- backend build found;
- frontend build found;
- manual runtime stopped on ports `3000` and `5001`.

```powershell
npm run central:reset
npm run central:services:dryrun
npm run central:services:install
```

The install command asks for interactive confirmation. Type:

```text
INSTALL
```

before it creates services.

## Start, stop, restart, and check

```powershell
npm run central:services:status
npm run central:services:check
npm run central:services:start
npm run central:services:stop
npm run central:services:restart
```

## Uninstall

Uninstall is explicit and interactive:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\manage-central-services.ps1 -Uninstall
```

Then type:

```text
UNINSTALL
```

## WinSW files

Templates:

```text
service/winsw/backend/MWDMonitoringBackend.xml.template
service/winsw/frontend/MWDMonitoringFrontend.xml.template
```

Generated during install:

```text
service/winsw/backend/MWDMonitoringBackend.exe
service/winsw/backend/MWDMonitoringBackend.xml
service/winsw/frontend/MWDMonitoringFrontend.exe
service/winsw/frontend/MWDMonitoringFrontend.xml
```

Generated `.exe` and final `.xml` files are machine-local and ignored by git.

## Restart validation

1. Install service.
2. Start services.
3. Restart laptop/server.
4. Wait 30-60 seconds.
5. Open `http://192.168.18.75:3000` from the server.
6. Open `http://192.168.18.75:3000` from a client device.
7. Login.
8. Confirm dashboard opens.
9. Run `npm run central:services:check`.

Expected ready status:

```text
Backend service       : running
Frontend service      : running
Backend health        : OK
Frontend health       : OK
Final status          : READY
```

Do not run manual LocalOnly/LAN runtime at the same time as service mode.
