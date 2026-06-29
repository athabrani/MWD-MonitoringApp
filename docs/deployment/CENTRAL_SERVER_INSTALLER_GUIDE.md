# Central Server Installer Guide

## Purpose

The Level 3 installer/package target is only the central server utama. It is not for user laptops.

User laptops only need:

- Server URL, for example `http://192.168.1.10:3000`.
- Browser shortcut or app-mode shortcut.

## Prepare package

```powershell
.\scripts\prepare-central-server-package.ps1
```

Output:

```text
dist-central-server-package
```

The package script does not copy:

- `.env` secrets
- `.env.local`
- `.env.testing`
- `.git`
- old logs
- database dumps

## Inno template

Template:

```text
installer/inno/MWDMonitoringCentralServer.iss.template
```

This is not compiled automatically. Review PostgreSQL prerequisites, WinSW availability, service commands, env templates, and firewall policy before compiling an installer.

## Safety defaults

- Service install command remains dry-run in the template.
- No database restore is performed.
- Firewall is not changed.
- PostgreSQL port `5432` is not opened.
