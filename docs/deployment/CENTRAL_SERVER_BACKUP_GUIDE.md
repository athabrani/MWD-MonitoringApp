# Central Server Backup Guide

## Manual backup

```powershell
.\scripts\backup-central-db.ps1
```

Default output:

```text
backups/database
```

Installed mode output:

```powershell
.\scripts\backup-central-db.ps1 -InstalledMode
```

```text
C:\ProgramData\MWDMonitoringApp\backups\database
```

## Requirements

`pg_dump` must be available in `PATH`. The script reads `DATABASE_URL` from `mwd-app-be/.env`, redacts password in output, and refuses `mwd_test`.

## Scheduled backup

Use Windows Task Scheduler to run:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Path\To\scripts\backup-central-db.ps1
```

Recommended schedule:

- Before job/session start.
- At least once per day during operation.
- Before application upgrade.

## Restore notes

Restore is intentionally not automated by this scaffold. Restore can overwrite production data and must be done manually with a verified backup, maintenance window, and operator approval.

Recommended approach:

1. Stop backend/frontend/receiver services.
2. Create a fresh backup of the current database.
3. Verify target database name.
4. Restore with PostgreSQL tools under DBA/operator supervision.
5. Start services and verify `/api/health`.
