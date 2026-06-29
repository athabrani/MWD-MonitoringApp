# Central Server Backup Guide

Use `docs/deployment/CENTRAL_DATABASE_BACKUP_GUIDE.md` as primary guide.

Quick commands:

```powershell
npm run central:backup:dryrun
npm run central:backup
npm run central:backup:schedule:dryrun
npm run central:restore:dryrun
```

Backup output:

```text
backups/database/mwd-db-backup-YYYYMMDD-HHMMSS.dump
```

Default retention:

```text
14 days
```

Never restore to production database without extra backup, maintenance window, `-AllowProductionRestore`, and typed confirmation:

```text
RESTORE PRODUCTION
```
