# MWD Monitoring App Central Server Deployment

Branch: `package`  
Status lingkungan utama: operationally ready  
Dokumen detail final: `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`

## Current Status

```text
Operational deployment on the configured central local server: READY.
Admin-assisted installer pipeline: READY.
Installer release status: RELEASE CANDIDATE.
Final stable installer status: pending clean-machine installation test.
```

Validated state:

- LocalOnly runtime: READY.
- LAN runtime: READY.
- LAN access dari device lain: READY.
- Cookie-based auth: READY.
- Login berhasil.
- Dashboard berhasil terbuka.
- Tidak ada error 401 setelah login.
- Backend service WinSW: running.
- Frontend service WinSW: running.
- `npm run central:services:check`: READY.
- Restart test Windows: PASSED.
- Database backup manual: READY.
- Backup scheduler: READY.
- Scheduled task: `MWDMonitoringDailyDatabaseBackup`.
- Restore guide: READY.
- Inno Setup `.iss`: generated and valid.
- Inno Setup compiler detection: READY.
- Installer compile pipeline: READY.
- Installer `.exe`: sudah berhasil dicompile dari GUI/user-confirmed.
- Installer status: admin-assisted release candidate.
- Clean-machine installer test: pending.
- Receiver service: pending karena standalone receiver entrypoint belum verified.
- Firewall: unchanged.
- Database destructive operation: none.

## Architecture

```text
Industrial PC / Laptop Server Utama
├── PostgreSQL
├── Backend API Service
├── Frontend Web Service
├── Receiver / Gateway MWD-WITS
├── Logs
├── Backups
└── LAN URL

User Device
└── Browser / app-mode shortcut ke server
```

PostgreSQL tetap lokal di server dan tidak diekspos ke LAN clients.

## LocalOnly Mode

Dipakai untuk testing/operasi dari server sendiri.

```powershell
npm run central:env:local
npm run central:start:local:build
npm run central:check:local
```

Open:

```text
http://127.0.0.1:3000
```

Jangan campur `localhost` dan `127.0.0.1` saat cookie auth.

## LAN Mode

Dipakai agar device lain dapat mengakses aplikasi.

```powershell
npm run central:env:lan
npm run central:start:lan:build
npm run central:check:lan
```

Open:

```text
http://192.168.18.75:3000
```

Catatan:

- IP server harus stabil.
- Gunakan DHCP reservation atau static IP.
- Jika IP berubah, env harus digenerate ulang dan frontend harus rebuild.

## WinSW Service Mode

Service manager: WinSW.

Path WinSW:

```text
C:\Tools\winsw\WinSW-x64.exe
```

Commands:

```powershell
npm run central:services:dryrun
npm run central:services:install
npm run central:services:start
npm run central:services:check
npm run central:services:restart
npm run central:services:stop
```

Expected ready status:

```text
Backend service       : running
Frontend service      : running
Backend health        : OK
Frontend health       : OK
Final status          : READY
```

Jangan menjalankan manual runtime bersamaan dengan service mode.

## Restart Test

1. Pastikan service mode READY.
2. Restart laptop/server.
3. Tunggu 30-60 detik.
4. Jalankan:

```powershell
npm run central:services:check
```

5. Buka dari server dan device lain:

```text
http://192.168.18.75:3000
```

6. Login dan dashboard harus berhasil.

Current status: PASSED.

## Backup Database

Manual backup:

```powershell
npm run central:backup:dryrun
npm run central:backup
```

Backup folder:

```text
backups/database
```

File format:

```text
mwd-db-backup-YYYYMMDD-HHMMSS.dump
```

Scheduler:

```powershell
npm run central:backup:schedule
```

Task name:

```text
MWDMonitoringDailyDatabaseBackup
```

Restore default adalah dry-run. Production restore diblokir kecuali ada explicit confirmation. Jangan restore ke production tanpa backup tambahan.

## Installer

Installer type: admin-assisted installer.

Files:

```text
installer/inno/MWDMonitoringCentralServer.iss.template
installer/inno/MWDMonitoringCentralServer.iss
installer/output/
```

Commands:

```powershell
npm run central:installer:check
npm run central:installer:compile:dryrun
npm run central:installer:compile
```

Inno Setup compiler detection:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
C:\Program Files\Inno Setup 6\ISCC.exe
$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe
$env:INNO_SETUP_ISCC
```

Installer `.exe` sudah berhasil dicompile dari GUI/user-confirmed. Status installer adalah RELEASE CANDIDATE sampai clean-machine installation test selesai.

Prerequisites yang kemungkinan dibutuhkan:

- Node.js.
- PostgreSQL.
- WinSW.
- PowerShell.
- Correct database/env setup.

## Troubleshooting

### 401 Unauthorized after login

- Check cookie mode.
- Confirm requests use credentials include.
- Use the same host consistently.
- Do not mix `localhost` and `127.0.0.1`.

### ERR_CONNECTION_REFUSED

- Check LocalOnly vs LAN env mismatch.
- Check backend host binding.
- Check backend port `5001`.

### ISCC found: no

- Check per-user Inno Setup path.
- Set `$env:INNO_SETUP_ISCC` if needed.

### Service stopped

```powershell
npm run central:services:start
npm run central:services:check
```

Then check `service-logs`.

### Port conflict

```powershell
npm run central:reset:dryrun
```

Do not stop PostgreSQL.

### PostgreSQL exposure

Do not expose PostgreSQL `5432` to LAN clients.

## Git Safety

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
service/winsw/**/*.exe
service/winsw/**/*.xml
tools/winsw/*.exe
```

Safe to commit:

```text
scripts/*.ps1
docs/deployment/*.md
README.md
README-CENTRAL-SERVER-DEPLOYMENT.md
service/winsw/**/*.xml.template
package.json
```

## More Documentation

- `README.md`
- `docs/PROJECT_CONTEXT_PRD.md`
- `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`
- `docs/deployment/CENTRAL_LOCAL_SERVER_GUIDE.md`
- `docs/deployment/CENTRAL_SERVICE_MODE_GUIDE.md`
- `docs/deployment/CENTRAL_DATABASE_BACKUP_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_INSTALLER_GUIDE.md`
- `docs/deployment/CENTRAL_SERVER_TROUBLESHOOTING.md`
