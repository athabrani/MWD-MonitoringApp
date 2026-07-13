# Central Local Server Final Deployment Guide

Tanggal update: 2026-06-29  
Branch: `package`  
Status lingkungan utama: operationally ready

Dokumen ini adalah panduan final untuk menjalankan MWD Monitoring App sebagai Central Local Server setelah deployment LocalOnly, LAN, service mode, backup, dan installer pipeline berhasil divalidasi pada server yang dikonfigurasi.

## Current Status

| Area | Status | Catatan |
|---|---|---|
| Operational deployment on configured central local server | READY | Login berhasil, dashboard terbuka, tidak ada 401 setelah login. |
| LocalOnly runtime | READY | Akses server sendiri melalui `http://127.0.0.1:3000`. |
| LAN runtime | READY | Device lain dapat akses melalui `http://192.168.18.75:3000`. |
| Cookie-based auth | READY | Browser memakai cookie auth; jangan campur host saat login. |
| Backend WinSW service | running | Dicek melalui `npm run central:services:check`. |
| Frontend WinSW service | running | Dicek melalui `npm run central:services:check`. |
| Restart test Windows | PASSED | Service otomatis hidup setelah laptop/server menyala kembali. |
| Manual database backup | READY | Backup ke `backups/database`. |
| Backup scheduler | READY | Scheduled task: `MWDMonitoringDailyDatabaseBackup`. |
| Restore guide | READY | Default restore adalah dry-run dan production restore diblokir tanpa konfirmasi eksplisit. |
| Inno Setup `.iss` | READY | Template dan generated final script valid. |
| Installer compile pipeline | READY | Compiler detection dan compile script tersedia. |
| Installer release status | RELEASE CANDIDATE | `.exe` sudah berhasil dicompile via GUI/user-confirmed. |
| Final stable installer status | PENDING | Clean-machine installation test belum dilakukan. |
| Receiver service | PENDING | Standalone receiver entrypoint belum verified. |
| Firewall | unchanged | Tidak ada perubahan firewall pada status final ini. |
| Database destructive operation | none | Tidak ada restore/drop/clear/migration destructive. |

Status ringkas:

```text
Operational deployment on the configured central local server: READY.
Admin-assisted installer pipeline: READY.
Installer release status: RELEASE CANDIDATE.
Final stable installer status: pending clean-machine installation test.
```

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

PostgreSQL hanya berjalan di server. Device user tidak mengakses database langsung; semua akses data melewati frontend dan backend API.

## LocalOnly Mode

LocalOnly dipakai untuk testing atau operasional dari server itu sendiri.

URL:

```text
http://127.0.0.1:3000
```

Command:

```powershell
npm run central:env:local
npm run central:start:local:build
npm run central:check:local
```

Catatan:

- Jangan mencampur `localhost` dan `127.0.0.1` saat cookie auth diuji.
- Jika sebelumnya LAN mode dipakai, regenerate env LocalOnly dan rebuild frontend.

## LAN Mode

LAN mode dipakai agar device lain pada jaringan yang sama dapat mengakses aplikasi.

URL tervalidasi:

```text
http://192.168.18.75:3000
```

Command:

```powershell
npm run central:env:lan
npm run central:start:lan:build
npm run central:check:lan
```

Catatan IP:

- IP server harus stabil untuk operasional.
- Gunakan DHCP reservation atau static IP.
- Jika IP berubah, generate env ulang dan rebuild frontend:

```powershell
npm run central:env:lan
npm run central:start:lan:build
```

## WinSW Service Mode

Service manager:

```text
WinSW / Windows Service Wrapper
```

Path WinSW yang digunakan:

```text
C:\Tools\winsw\WinSW-x64.exe
```

Command:

```powershell
npm run central:services:dryrun
npm run central:services:install
npm run central:services:start
npm run central:services:check
npm run central:services:restart
npm run central:services:stop
```

Status berhasil:

```text
Backend service       : running
Frontend service      : running
Backend health        : OK
Frontend health       : OK
Final status          : READY
```

Jangan menjalankan manual runtime bersamaan dengan service mode. Jika service mode aktif, gunakan command service untuk start/stop/restart.

## Restart Test

Prosedur restart validation:

1. Pastikan service mode `READY`.
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

6. Login dan pastikan dashboard berhasil terbuka.

Status saat ini: PASSED pada server yang dikonfigurasi.

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

Format file:

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

Restore:

- default restore adalah dry-run;
- production restore diblokir kecuali memakai flag dan confirmation eksplisit;
- jangan restore ke production tanpa backup tambahan terbaru.

## Installer

Installer type:

```text
admin-assisted installer
```

File:

```text
installer/inno/MWDMonitoringCentralServer.iss.template
installer/inno/MWDMonitoringCentralServer.iss
```

`*.iss.template` adalah template. `*.iss` adalah generated final script.

Command:

```powershell
npm run central:installer:check
npm run central:installer:compile:dryrun
npm run central:installer:compile
```

Inno Setup compiler detection mendukung:

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

Status:

- Installer `.exe` sudah berhasil dicompile dari GUI/user-confirmed.
- Release status: RELEASE CANDIDATE.
- Clean-machine installation test: pending.

Prerequisites yang kemungkinan dibutuhkan pada clean-machine install:

- Node.js;
- PostgreSQL;
- WinSW;
- PowerShell;
- database/env setup yang benar.

## Troubleshooting

### 401 Unauthorized setelah login

Periksa:

- cookie auth mode;
- request frontend memakai `credentials: include`;
- host konsisten;
- jangan campur `localhost` dan `127.0.0.1`;
- LocalOnly gunakan `http://127.0.0.1:3000`;
- LAN gunakan `http://192.168.18.75:3000`.

### ERR_CONNECTION_REFUSED

Periksa:

- LocalOnly vs LAN env mismatch;
- backend host binding;
- backend port `5001`;
- frontend rebuild setelah env diganti.

### ISCC found: no

Periksa lokasi Inno Setup:

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
C:\Program Files\Inno Setup 6\ISCC.exe
$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe
$env:INNO_SETUP_ISCC
```

### Service stopped

Jalankan:

```powershell
npm run central:services:start
npm run central:services:check
```

Lalu cek `service-logs` jika status belum ready.

### Port conflict

Gunakan dry-run terlebih dahulu:

```powershell
npm run central:reset:dryrun
```

Jangan stop PostgreSQL.

### PostgreSQL exposure

Jangan expose PostgreSQL `5432` ke LAN. Client hanya perlu akses frontend `3000` dan backend API/WebSocket `5001` sesuai kebijakan jaringan.

## Git Safety

Jangan commit:

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

Boleh commit:

```text
scripts/*.ps1
docs/deployment/*.md
README.md
README-CENTRAL-SERVER-DEPLOYMENT.md
service/winsw/**/*.xml.template
package.json
```

