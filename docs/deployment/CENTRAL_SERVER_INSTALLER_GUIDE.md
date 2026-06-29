# Central Server Installer Guide

Update 2026-06-29: Inno Setup `.iss` is generated and valid, compiler detection is READY, compile pipeline is READY, and installer `.exe` has been compiled via GUI/user-confirmed. Installer release status is RELEASE CANDIDATE. Final stable installer status is pending clean-machine installation test.

Dokumen final utama: `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`.

## Files

Template source:

```text
installer/inno/MWDMonitoringCentralServer.iss.template
```

Generated final script:

```text
installer/inno/MWDMonitoringCentralServer.iss
```

Do not edit generated `.iss` by hand. Update template or generator script.

## Generate `.iss`

Dry-run:

```powershell
npm run central:installer:generate:dryrun
```

Generate:

```powershell
npm run central:installer:generate
```

Check:

```powershell
npm run central:installer:check
```

## Package prerequisite

Installer source is:

```text
dist-central-server-package
```

Build package first:

```powershell
npm run central:package
```

Package must not contain:

```text
.env
.env.local
.env.testing
*.env.backup
service-logs/
backups/
*.dump
*.log
*.sqlite
*.db
```

## WinSW

Service manager is WinSW. Current installer treats WinSW as prerequisite, not bundled binary.

Supported manual WinSW location:

```text
C:\Tools\winsw\WinSW-x64.exe
```

or:

```powershell
$env:WINSW_PATH="D:\path\to\WinSW-x64.exe"
```

Do not bundle WinSW unless package policy explicitly approves it.

## Compile manually

Install Inno Setup 6, then run:

```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" ".\installer\inno\MWDMonitoringCentralServer.iss"
```

Inno Setup can also be installed per-user:

```text
$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe
```

If detection fails, check:

```powershell
Test-Path "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
```

or set:

```powershell
setx INNO_SETUP_ISCC "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
```

Then:

```powershell
npm run central:installer:check
npm run central:installer:compile:dryrun
```

Compile through script only when ready:

```powershell
npm run central:installer:compile
```

Supported compiler detection locations:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
C:\Program Files\Inno Setup 6\ISCC.exe
$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe
$env:INNO_SETUP_ISCC
```

Output installer:

```text
installer/output/
```

Clean-machine installation test remains pending. Until that test passes, the installer is an admin-assisted release candidate, not a final stable installer.

Likely prerequisites:

- Node.js;
- PostgreSQL;
- WinSW;
- PowerShell;
- correct database/env setup.

## Safety

Installer must not:

- include real `.env`;
- include backup dumps;
- include logs;
- open firewall;
- restore database;
- drop/truncate database;
- install service without reviewed WinSW flow.

Current `[Run]` entry only runs service installer dry-run.
