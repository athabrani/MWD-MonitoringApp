# Central Database Backup Guide

Update 2026-06-29: manual database backup is READY, backup scheduler is READY, and scheduled task `MWDMonitoringDailyDatabaseBackup` is configured. Restore guide is READY; production restore remains blocked unless explicit confirmation is used.

Dokumen final utama: `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`.

## Goal

Backup central PostgreSQL database from server laptop/industrial PC. Backup does not modify database and does not print password.

## Manual dry-run

```powershell
npm run central:backup:dryrun
```

Shows:

- database host/user/name without password;
- backup directory;
- backup filename pattern;
- `pg_dump` availability;
- retention candidates.

## Manual backup

```powershell
npm run central:backup
```

Default output:

```text
backups/database/
```

Filename:

```text
mwd-db-backup-YYYYMMDD-HHMMSS.dump
```

Format is PostgreSQL custom dump format, restored with `pg_restore`.

## Retention

Default retention:

```text
14 days
```

Run custom retention:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-central-db.ps1 -Backup -RetentionDays 30
```

Backups older than retention window are removed after successful backup.

## Scheduled daily backup

Dry-run:

```powershell
npm run central:backup:schedule:dryrun
```

Install task:

```powershell
npm run central:backup:schedule
```

Script asks for:

```text
SCHEDULE
```

Task name:

```text
MWDMonitoringDailyDatabaseBackup
```

Default schedule:

```text
daily 02:00
```

Task arguments do not include database password. Backup script reads `mwd-app-be/.env` at runtime.

Check task:

```powershell
Get-ScheduledTask -TaskName MWDMonitoringDailyDatabaseBackup
Get-ScheduledTaskInfo -TaskName MWDMonitoringDailyDatabaseBackup
```

## Restore safe path

Default restore command is dry-run:

```powershell
npm run central:restore:dryrun
```

Recommended restore verification uses a new database, for example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-central-db.ps1 -BackupFile ".\backups\database\mwd-db-backup-YYYYMMDD-HHMMSS.dump" -TargetDatabase "mwd_restore_verify" -DryRun
```

Create target database manually first with PostgreSQL tools, then run restore only after review:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore-central-db.ps1 -BackupFile ".\backups\database\mwd-db-backup-YYYYMMDD-HHMMSS.dump" -TargetDatabase "mwd_restore_verify" -Restore
```

Do not restore to production database unless:

1. extra fresh backup exists;
2. maintenance window approved;
3. operator accepts data overwrite risk;
4. command uses `-AllowProductionRestore`;
5. prompt confirmation `RESTORE PRODUCTION` is typed.

The restore script does not drop database automatically.

## Verify backup

Check file exists and size > 0:

```powershell
Get-ChildItem .\backups\database\mwd-db-backup-*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name,Length,LastWriteTime
```

Then verify app still works:

```powershell
npm run central:services:check
```

Open:

```text
http://192.168.18.75:3000
```

Login and confirm dashboard opens.
