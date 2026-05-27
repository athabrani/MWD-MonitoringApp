# MWD Frontend API Integration Guide

Dokumen ini merapikan dokumentasi endpoint backend MWD agar lebih mudah dibaca dan dipakai oleh tim frontend. Fokus utama dokumen ini adalah: struktur data utama, daftar endpoint, fungsi endpoint, dan routemap integrasi yang seharusnya berjalan di frontend.

---

## 1. Informasi Dasar API

### Base URL

Local development:

```txt
http://localhost:5001
```

Production example:

```txt
https://be-mwd.vercel.app
```

### Header untuk Protected Endpoint

Sebagian besar endpoint membutuhkan JWT token dari login.

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Akun Default Testing

| Role | Identifier | Password | Fungsi Umum |
|---|---|---|---|
| admin | admin | admin12345 | Full access, user management, config, clear/restore data |
| engineer | engineer | engineer12345 | Input/edit monitoring data, konfigurasi, export |
| operator | operator | operator12345 | Mayoritas read/view monitoring |

---

## 2. Konsep Data Utama untuk Frontend

### 2.1 Session / Job

`sessionId` adalah ID internal backend untuk satu job atau sesi monitoring MWD.

Di frontend, user sebaiknya tidak diminta mengetik `sessionId`. User cukup memilih job berdasarkan data yang mudah dibaca:

- `sessionCode`
- `wellName`
- `rigName`
- `company`
- `jobNumber`

Setelah user memilih job, frontend menyimpan `id` dari session tersebut sebagai `activeSessionId` atau `selectedSessionId`. Nilai ini wajib dikirim ke endpoint lain yang membutuhkan konteks job.

Contoh:

```txt
User memilih: MWD-FE-TEST-001 / Well FE Test / Rig Test
Backend id  : 5
FE kirim    : sessionId = 5
```

Relasi utama:

```txt
User
└── MWD Session / Job
    ├── MWD Data
    ├── WITS Data Values
    ├── Surveys
    ├── Depth Tracking
    ├── Memory Files
    ├── Export Records
    └── Edit History
```

---

### 2.2 MWD Data

`MWD Data` adalah sumber utama data monitoring/realtime. Ini adalah data sensor/log yang dipakai untuk dashboard, plot, historical data, export LAS/PDF, dan sumber pembuatan survey.

Sumber data MWD dapat berasal dari:

- input manual frontend/Postman
- raw Serial WITS
- hardware gateway
- ESP/LoRa serial
- memory file correlation

Field umum:

```txt
depthMd, hole_depth, inclination, azimuth, gammaRay,
pressure, rop, hookLoad, batteryVoltage, temperature,
shock, vibration, mudWeight, ecd
```

Mapping penting:

| WITS ID | Arti | Field MWD |
|---|---|---|
| 0108 | Bit Depth | depthMd |
| 0110 | Hole Depth | hole_depth |
| 0713 / 0716 | Inclination | inclination |
| 0715 | Azimuth | azimuth |
| 0823 / 0824 | Gamma | gammaRay |

---

### 2.3 WITS Config

`WITS Config` adalah kamus atau master konfigurasi WITS ID. Endpoint ini tidak berisi nilai sensor realtime.

Dipakai frontend untuk:

- label parameter
- unit
- dropdown parameter/curve
- mapping `witsId` ke field MWD
- warna plot
- scale factor dan bias offset
- batas alarm min/max
- konfigurasi LAS tag

Contoh konsep:

```txt
0824 = Gamma API, unit API, mappedField gammaRay
0715 = Azimuth, unit deg, mappedField azimuth
0108 = Bit Depth, mappedField depthMd
```

---

### 2.4 WITS Data Values

`WITS Data Values` adalah history nilai aktual per WITS ID. Endpoint ini bukan endpoint untuk input raw packet.

Contoh:

```txt
WITS ID 0824 pada depth 1000.5 nilainya 82.4
WITS ID 0715 pada depth 1000.5 nilainya 240.1
```

Perbedaan utama:

| Endpoint | Isi Data | Kegunaan FE |
|---|---|---|
| `GET /api/mwd-data` | Data sudah berbentuk field aplikasi seperti `gammaRay`, `azimuth`, `depthMd` | Dashboard, card latest value, plot utama, export |
| `GET /api/wits-data-values` | Data masih berbasis WITS ID seperti `0715`, `0824`, `0108` | Debug WITS, raw history, validasi mapping, alarm per WITS ID |

---

### 2.5 Survey

`Survey` bukan data realtime mentah. Survey adalah station/trajectory untuk menghitung posisi lubang sumur.

Input dasar survey:

```txt
measuredDepth, inclination, azimuth
```

Hasil olahan survey:

```txt
tvd, northing, easting, verticalSection,
doglegSeverity, buildRate, turnRate,
closureDistance, closureAzimuth
```

Pembagian tanggung jawab:

```txt
MWD Data = data sensor/log monitoring
Survey   = data trajectory/posisi sumur
```

---

## 3. Endpoint Registry untuk Frontend

### 3.1 Auth

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| POST | `/api/auth/login` | Login dan menghasilkan JWT token | Halaman login |
| GET | `/api/auth/me` | Cek user aktif dari token | Load user profile, role guard |

---

### 3.2 Roles

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/roles` | List role | Admin page |
| POST | `/api/roles` | Tambah role | Admin only |
| GET | `/api/roles/:id` | Detail role | Admin only |
| PUT | `/api/roles/:id` | Update role | Admin only |
| DELETE | `/api/roles/:id` | Hapus role | Admin only |

---

### 3.3 Users

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/users` | List user | Admin user management |
| POST | `/api/users` | Buat user baru | Admin user management |
| GET | `/api/users/:id` | Detail user | Admin user management |
| PUT | `/api/users/:id` | Update user | Admin user management |
| DELETE | `/api/users/:id` | Hapus user | Admin user management |

---

### 3.4 MWD Sessions / Jobs

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/mwd-sessions` | List job/session | Session selector, dashboard startup |
| POST | `/api/mwd-sessions` | Buat job/session baru | Job setup page |
| GET | `/api/mwd-sessions/:id` | Detail job/session | Job detail, metadata header |
| PUT | `/api/mwd-sessions/:id` | Update metadata job | Job edit page |
| DELETE | `/api/mwd-sessions/:id` | Hapus job | Admin/engineer only |

Frontend harus menjadikan endpoint ini sebagai sumber `activeSessionId`.

---

### 3.5 MWD Data

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/mwd-data` | Ambil data monitoring per session | Dashboard, plot, table, latest card |
| POST | `/api/mwd-data` | Input data manual atau raw WITS | Testing, manual input, ingest raw |
| GET | `/api/mwd-data/:id` | Detail satu row MWD | Detail/edit row |
| PUT | `/api/mwd-data/:id` | Edit satu row MWD | Data correction |
| DELETE | `/api/mwd-data/:id` | Hapus satu row MWD | Data correction/admin |
| GET | `/api/historical-data` | Ambil historical data dengan filter waktu/depth | History page, export source |

Query umum:

```txt
GET /api/mwd-data?sessionId=5
GET /api/mwd-data?sessionId=5&depthMin=1000&depthMax=1100
GET /api/mwd-data?sessionId=5&limit=1
```

---

### 3.6 WITS Config

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/wits-config` | List kamus/config WITS ID | Dropdown parameter, label, unit, mapping, plot config |
| POST | `/api/wits-config` | Tambah config WITS ID | Configuration page |
| GET | `/api/wits-config/:id` | Detail config | Configuration detail |
| PUT | `/api/wits-config/:id` | Update config | Configuration editor |
| DELETE | `/api/wits-config/:id` | Hapus config | Configuration editor |

Endpoint ini sebaiknya dipanggil setelah login atau setelah session dipilih, lalu disimpan sebagai referensi global FE.

---

### 3.7 WITS Data Values

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/wits-data-values` | Ambil history nilai per WITS ID | Debug WITS, raw history, validation, alarm |

Query umum:

```txt
GET /api/wits-data-values?sessionId=5
GET /api/wits-data-values?sessionId=5&witsId=0715&limit=20
GET /api/wits-data-values?sessionId=5&depthMin=1000&depthMax=1100
```

Catatan: data tidak masuk langsung lewat endpoint ini. Data masuk melalui `/api/mwd-data`, `/api/gateway/mwd-data`, serial gateway, atau ESP WebSocket gateway.

---

### 3.8 WITS Alarms

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/wits-alarms` | List alarm WITS | Alarm panel |
| PUT | `/api/wits-alarms/:id/acknowledge` | Tandai alarm sudah dibaca | Alarm action |
| PUT | `/api/wits-alarms/:id/resolve` | Tandai alarm selesai | Alarm action |

Flow alarm:

```txt
WITS value masuk
-> backend cek min/max dari WITS Config
-> jika melewati batas, backend buat WITS Alarm
-> FE tampilkan alarm
-> user acknowledge/resolve
```

---

### 3.9 Surveys

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/surveys` | List survey station | Survey table, trajectory page |
| POST | `/api/surveys` | Input survey manual | Manual survey input |
| POST | `/api/surveys/from-mwd-data` | Generate survey dari MWD Data | Generate actual trajectory |
| POST | `/api/surveys/recalculate` | Hitung ulang trajectory/projection | Setelah edit survey/VS azimuth |
| POST | `/api/surveys/well-plan/import-csv` | Import well plan CSV | Well plan import |
| GET | `/api/surveys/:id` | Detail survey | Detail/edit station |
| PUT | `/api/surveys/:id` | Edit survey | Survey correction |
| DELETE | `/api/surveys/:id` | Hapus survey | Survey management |

Perbedaan penting:

```txt
POST /api/surveys
= user menginput survey manual

POST /api/surveys/from-mwd-data
= backend mengambil depthMd + inclination + azimuth dari MWD_Data, lalu membuat Survey_Station

POST /api/surveys/recalculate
= backend menghitung ulang TVD, northing, easting, verticalSection, dogleg, build rate, turn rate
```

---

### 3.10 Plot Templates

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/plot-templates` | List template plot | Plot template selector |
| GET | `/api/plot-templates/default` | Ambil template default | Dashboard/well plot default layout |
| POST | `/api/plot-templates` | Buat template baru | Plot configuration editor |
| GET | `/api/plot-templates/:id` | Detail template | Template editor |
| PUT | `/api/plot-templates/:id` | Update template | Template editor |
| DELETE | `/api/plot-templates/:id` | Hapus template | Template management |

Template menentukan layout visual, bukan data kurva. Data kurva tetap diambil dari `GET /api/mwd-data`.

---

### 3.11 Exports

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| POST | `/api/exports/historical` | Export historical data ke JSON/CSV | Export historical page |
| POST | `/api/exports/surveys` | Export survey station CSV | Survey export |
| POST | `/api/exports/las` | Export LAS file | LAS export |
| POST | `/api/exports/pdf-plot` | Export PDF plot/log | Plot export |
| GET | `/api/exports/records` | History export | Export history page |

Frontend harus menangani response export sebagai file/blob.

---

### 3.12 MWD Data Edit Tools

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/mwd-data/edit/operations` | History operasi edit | Edit history panel |
| POST | `/api/mwd-data/edit/hide-range` | Sembunyikan data pada depth range | Data cleaning |
| POST | `/api/mwd-data/edit/unhide-range` | Tampilkan kembali hidden data | Data cleaning |
| POST | `/api/mwd-data/edit/delete-depth-range` | Hapus data pada depth range | Data cleaning |
| GET | `/api/mwd-data/edit/move-depth` | Preview geser depth | Preview before apply |
| POST | `/api/mwd-data/edit/move-depth` | Apply geser depth | Data correction |
| GET | `/api/mwd-data/edit/copy-depth` | Preview copy depth | Preview before apply |
| POST | `/api/mwd-data/edit/copy-depth` | Apply copy depth | Data correction |
| GET | `/api/mwd-data/edit/rescale` | Preview rescale field | Preview before apply |
| POST | `/api/mwd-data/edit/rescale` | Apply rescale field | Sensor/log calibration |

Rekomendasi FE:

```txt
Pilih session
-> pilih depth range
-> pilih operasi edit
-> panggil preview GET jika tersedia
-> tampilkan affectedCount/sample
-> user confirm
-> panggil POST apply
-> reload /api/mwd-data
-> reload edit history
```

---

### 3.13 Memory Files

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/memory-files` | List memory file | Memory file page |
| POST | `/api/memory-files/import` | Import CSV/text/rows memory file | Memory import |
| GET | `/api/memory-files/:id` | Detail memory file | File detail |
| GET | `/api/memory-files/:id/points` | Preview points memory file | Preview data |
| POST | `/api/memory-files/:id/correlate` | Preview/apply correlation | Correlate memory to MWD Data |
| GET | `/api/memory-files/correlations` | History correlation | Correlation history |
| DELETE | `/api/memory-files/:id` | Hapus memory file | File management |

Flow correlation:

```txt
Upload memory file
-> preview points
-> pilih field mapping
-> correlate dryRun=true
-> tampilkan matched/skipped/sample
-> user confirm
-> correlate dryRun=false
-> backend update MWD_Data
-> FE reload /api/mwd-data
```

---

### 3.14 Depth Tracking / DTS

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/depth-tracking/state` | State depth terbaru | Dashboard depth status |
| GET | `/api/depth-tracking/samples` | History sample depth tracking | Depth tracking chart/table |
| POST | `/api/depth-tracking/update` | Update manual/current depth state | Manual correction |
| POST | `/api/depth-tracking/recalculate` | Hitung ulang depth state dari MWD data | Recalculate depth status |

Dipakai untuk status:

- bit depth
- hole depth
- block depth
- ROP
- drilling status

---

### 3.15 WITS Output Queue

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/wits-output/queue` | List queue output WITS | Rig output monitoring |
| POST | `/api/wits-output/generate-from-latest` | Generate output dari MWD data terbaru | Generate output queue |
| PUT | `/api/wits-output/:id/status` | Update status queue | Mark sent/failed/skipped |

Catatan: ini baru queue backend. Penulisan fisik ke Rig WITS serial port adalah fase hardware.

---

### 3.16 Serial Port Manager

Endpoint ini hanya valid untuk backend lokal yang berjalan di PC/server rig dan punya akses COM port.

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/serial/ports` | List COM port lokal | Hardware setup page |
| POST | `/api/serial/connect` | Connect COM port dan mulai ingest WITS | Start serial ingest |
| GET | `/api/serial/status` | Status serial gateway | Connection monitor |
| POST | `/api/serial/disconnect` | Disconnect serial | Stop serial ingest |

Jangan dipakai di Vercel karena Vercel tidak punya akses ke COM port lokal.

---

### 3.17 ESP WebSocket Monitor

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/esp-ws/status` | Status koneksi backend ke ESP WebSocket gateway | Hardware connection monitor |

---

### 3.18 System Utilities

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/system-utilities/clear-data/targets` | List target clear data | System utilities page |
| POST | `/api/system-utilities/clear-data/preview` | Preview jumlah data yang akan dihapus | Confirmation step |
| POST | `/api/system-utilities/backup-session` | Generate backup JSON session | Download backup file |
| POST | `/api/system-utilities/clear-data` | Hapus data session sesuai target | Admin clear data |
| POST | `/api/system-utilities/restore-session` | Restore dari backup JSON | Restore data |
| GET | `/api/system-utilities/config-backup/targets` | List target backup config | Config backup page |
| POST | `/api/system-utilities/config-backup` | Backup konfigurasi | Download config backup |
| POST | `/api/system-utilities/config-restore` | Restore konfigurasi | Restore WITS config/plot template |

Catatan penting: backup tidak otomatis disimpan ke database. FE harus menyimpan `response.backup` sebagai file `.json` lokal.

---

### 3.19 Connection Status

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/connection-status` | List status koneksi | Connection monitor |
| POST | `/api/connection-status` | Buat log status koneksi | System-generated/manual log |
| GET | `/api/connection-status/:id` | Detail status koneksi | Detail log |
| PUT | `/api/connection-status/:id` | Update status koneksi | Admin/system update |
| DELETE | `/api/connection-status/:id` | Hapus status koneksi | Admin cleanup |

---

### 3.20 Failover Events

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| GET | `/api/failover-events` | List failover event | Failover monitor |
| POST | `/api/failover-events` | Buat failover event | System-generated/manual log |
| GET | `/api/failover-events/:id` | Detail event | Detail log |
| PUT | `/api/failover-events/:id` | Update event | Admin/system update |
| DELETE | `/api/failover-events/:id` | Hapus event | Admin cleanup |

---

### 3.21 Gateway Ingest

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| POST | `/api/gateway/mwd-data` | Ingest payload MWD/raw WITS dari hardware service | Bukan endpoint user FE biasa |

Endpoint ini tidak memakai JWT user. Header yang dipakai:

```http
x-gateway-key: <GATEWAY_API_KEY>
```

---

### 3.22 Email Reports

| Method | Endpoint | Fungsi | FE Usage |
|---|---|---|---|
| POST | `/api/reports/email/test` | Test SMTP/email | Email report settings |
| POST | `/api/reports/email/send` | Kirim report email | Report page |
| GET | `/api/reports/email/logs` | History email report | Report history |

Jika `EMAIL_REPORTS_ENABLED` belum `true`, endpoint akan mengembalikan `503`.

---

## 4. Routemap Integrasi Frontend

### 4.1 Routemap Startup Aplikasi

```txt
POST /api/auth/login
-> simpan token
-> GET /api/auth/me
-> ambil user + role
-> GET /api/mwd-sessions
-> user pilih job/session
-> simpan activeSessionId
-> GET /api/wits-config
-> GET /api/mwd-data?sessionId=<activeSessionId>
-> render dashboard
```

Tujuan FE:

- login valid
- role user diketahui
- session aktif tersedia
- WITS config tersedia untuk label/unit/dropdown
- MWD data tersedia untuk dashboard

---

### 4.2 Routemap Data Masuk Manual / Testing

```txt
POST /api/mwd-data
-> backend simpan row ke MWD_Data
-> GET /api/mwd-data?sessionId=<activeSessionId>
-> dashboard/table/plot refresh
```

Jika payload berbentuk raw WITS:

```txt
POST /api/mwd-data dengan body { sessionId, raw }
-> backend parse raw WITS
-> backend cek /wits-config sebagai mapping internal
-> value mappedField masuk ke MWD_Data
-> value per WITS ID masuk ke WITS_Data_Value
-> FE refresh GET /api/mwd-data
-> FE opsional refresh GET /api/wits-data-values
```

Routemap sesuai contoh yang diminta:

```txt
Data masuk pertama lewat /api/mwd-data
-> backend membaca /api/wits-config sebagai kamus WITS ID
-> value dari WITS ID tersimpan ke /api/wits-data-values
-> value yang punya mappedField juga masuk ke MWD_Data
-> FE menampilkan dashboard dari /api/mwd-data
```

---

### 4.3 Routemap Data Masuk dari Hardware Lokal Serial

```txt
GET /api/serial/ports
-> user pilih COM port
-> POST /api/serial/connect
-> backend membaca raw WITS dari COM port
-> backend parse raw WITS
-> backend simpan MWD_Data
-> backend simpan WITS_Data_Value
-> FE polling GET /api/serial/status
-> FE polling GET /api/mwd-data?sessionId=<activeSessionId>
-> FE opsional polling GET /api/wits-data-values?sessionId=<activeSessionId>
```

Frontend tidak perlu parse raw WITS untuk proses utama. Parsing utama dilakukan backend.

---

### 4.4 Routemap Data Masuk dari Gateway Hardware

```txt
Hardware service / gateway
-> POST /api/gateway/mwd-data dengan x-gateway-key
-> backend parse/simpan data
-> MWD_Data terisi
-> WITS_Data_Value terisi jika payload berbasis WITS
-> FE GET /api/mwd-data?sessionId=<activeSessionId>
-> FE render dashboard/plot
```

Endpoint ini bukan untuk tombol input user biasa di frontend.

---

### 4.5 Routemap Dashboard Monitoring

```txt
activeSessionId tersedia
-> GET /api/mwd-data?sessionId=<activeSessionId>&limit=1
-> ambil latest row
-> render card dashboard
-> GET /api/mwd-data?sessionId=<activeSessionId>&depthMin=&depthMax=
-> render plot/table monitoring
-> GET /api/depth-tracking/state?sessionId=<activeSessionId>
-> render bit depth/hole depth/ROP/status drilling
-> GET /api/serial/status atau /api/esp-ws/status
-> render status koneksi hardware
```

Mapping dashboard card:

| UI Card | Field utama |
|---|---|
| Inclination | `mwdData.inclination` |
| Azimuth | `mwdData.azimuth` |
| Gamma | `mwdData.gammaRay` |
| Bit Depth | `mwdData.depthMd` |
| Hole Depth | `mwdData.hole_depth` |
| Pump Pressure | `mwdData.standpipePressure` |
| Decoder Pressure | `mwdData.decoderPressure` |
| Battery | `mwdData.batteryVoltage` |
| Temperature | `mwdData.temperature` |
| ROP | `mwdData.rop` |
| Hook Load | `mwdData.hookLoad` |

---

### 4.6 Routemap WITS Configuration Page

```txt
GET /api/wits-config
-> render table/list WITS ID
-> user add/edit/delete config
-> POST/PUT/DELETE /api/wits-config
-> reload GET /api/wits-config
```

WITS Config sebaiknya menjadi sumber dropdown curve pada plotting dan mapping field.

---

### 4.7 Routemap WITS Debug / Raw Values Page

```txt
activeSessionId tersedia
-> GET /api/wits-config
-> user pilih WITS ID dari dropdown
-> GET /api/wits-data-values?sessionId=<activeSessionId>&witsId=<witsId>&limit=20
-> render raw value/history/debug table
```

Gunakan halaman ini untuk memeriksa apakah WITS ID tertentu benar-benar masuk.

---

### 4.8 Routemap Survey Manual

```txt
activeSessionId tersedia
-> user input measuredDepth, inclination, azimuth, stationType
-> POST /api/surveys
-> GET /api/surveys?sessionId=<activeSessionId>&stationType=actual
-> render survey table/trajectory
```

---

### 4.9 Routemap Survey dari MWD Data

```txt
activeSessionId tersedia
-> pastikan MWD_Data punya depthMd + inclination + azimuth
-> POST /api/surveys/from-mwd-data
-> backend generate Survey_Station
-> backend hitung trajectory/projection
-> GET /api/surveys?sessionId=<activeSessionId>&stationType=actual
-> render survey table/trajectory
```

Endpoint ini tidak menerima nilai survey satu per satu. Ia mengambil data dari `MWD_Data`.

---

### 4.10 Routemap Recalculate Survey

```txt
User edit survey atau verticalSectionAzimuth berubah
-> PUT /api/surveys/:id jika ada perubahan station
-> POST /api/surveys/recalculate
-> GET /api/surveys?sessionId=<activeSessionId>&stationType=actual
-> refresh trajectory/table
```

`recalculate` bukan untuk mengubah sensor/log MWD. Itu hanya menghitung ulang hasil olahan survey.

---

### 4.11 Routemap Plot Preview

```txt
activeSessionId tersedia
-> GET /api/plot-templates/default atau GET /api/plot-templates/:id
-> GET /api/mwd-data?sessionId=<activeSessionId>&depthMin=&depthMax=
-> FE menggabungkan template + data MWD
-> render plot preview di browser
```

Plot template menentukan layout. Data kurva tetap berasal dari `MWD_Data`.

---

### 4.12 Routemap Plot Template Editor

```txt
GET /api/wits-config
-> tampilkan pilihan curve berdasarkan config/mappedField
-> GET /api/plot-templates/default atau GET /api/plot-templates/:id
-> user edit track/curve/scale/color
-> PUT /api/plot-templates/:id atau POST /api/plot-templates
-> reload template
-> dashboard/well plot memakai template terbaru
```

Jika frontend ingin plotting, dashboard, dan well plot saling terhubung, maka sumber layout harus sama-sama memakai `Plot_Template` aktif/default.

---

### 4.13 Routemap Export LAS

```txt
activeSessionId tersedia
-> user pilih depth range dan column config
-> POST /api/exports/las
-> backend mengambil MWD_Data + optional WITS/Survey
-> backend return file LAS
-> FE download blob/file
-> GET /api/exports/records untuk history export
```

---

### 4.14 Routemap Export PDF Plot

```txt
activeSessionId tersedia
-> pilih templateId atau inline template
-> pilih depthMin/depthMax
-> POST /api/exports/pdf-plot
-> backend render PDF dari MWD_Data + Plot_Template
-> FE download blob/file PDF
```

---

### 4.15 Routemap Data Edit Tools

```txt
activeSessionId tersedia
-> user pilih depth range
-> user pilih operasi: hide/unhide/delete/move/copy/rescale
-> jika operasi punya preview, panggil GET preview
-> tampilkan affectedCount/sample
-> user confirm
-> panggil POST apply
-> GET /api/mwd-data?sessionId=<activeSessionId>
-> GET /api/mwd-data/edit/operations?sessionId=<activeSessionId>
```

Pola aman:

```txt
Preview dulu -> Confirm -> Apply -> Refresh data
```

---

### 4.16 Routemap Memory File Import dan Correlation

```txt
activeSessionId tersedia
-> POST /api/memory-files/import
-> GET /api/memory-files/:id/points
-> user pilih field mapping
-> POST /api/memory-files/:id/correlate dengan dryRun=true
-> tampilkan matchedCount/skippedCount/sample
-> user confirm
-> POST /api/memory-files/:id/correlate dengan dryRun=false
-> backend update field tertentu di MWD_Data
-> GET /api/mwd-data?sessionId=<activeSessionId>
-> GET /api/memory-files/correlations
```

---

### 4.17 Routemap Backup, Clear, Restore Session

Backup session:

```txt
POST /api/system-utilities/backup-session
-> backend return response.backup
-> FE download response.backup sebagai .json lokal
```

Clear data:

```txt
GET /api/system-utilities/clear-data/targets
-> user pilih target
-> POST /api/system-utilities/clear-data/preview
-> tampilkan counts + requiredConfirm
-> optional POST /api/system-utilities/backup-session
-> POST /api/system-utilities/clear-data dengan confirm
-> reload dashboard/table
```

Restore:

```txt
User pilih file backup .json lokal
-> FE baca isi file
-> POST /api/system-utilities/restore-session
-> backend restore data
-> reload /api/mwd-data, /api/surveys, /api/wits-data-values sesuai target
```

Jangan kirim backup kosong:

```json
{ "backup": {} }
```

Yang benar adalah mengirim object backup asli dari response `backup-session`.

---

## 5. Urutan Test Integrasi Frontend yang Disarankan

1. `POST /api/auth/login`
2. `GET /api/auth/me`
3. `GET /api/mwd-sessions`
4. Pilih session dan simpan `activeSessionId`
5. `GET /api/wits-config`
6. `POST /api/mwd-data` untuk input data manual/raw testing
7. `GET /api/mwd-data?sessionId=<activeSessionId>`
8. `GET /api/wits-data-values?sessionId=<activeSessionId>&witsId=0715&limit=20`
9. `POST /api/surveys/from-mwd-data`
10. `GET /api/surveys?sessionId=<activeSessionId>&stationType=actual`
11. `GET /api/plot-templates/default`
12. `POST /api/exports/las`
13. `POST /api/exports/pdf-plot`
14. Test edit tools dengan preview `GET` lebih dulu, lalu apply `POST`
15. Jika backend lokal hardware tersedia: `GET /api/serial/ports`, `POST /api/serial/connect`, `GET /api/serial/status`
16. Jika ESP WebSocket dipakai: `GET /api/esp-ws/status`

---

## 6. Catatan Teknis Penting untuk Frontend

- Semua protected endpoint harus memakai `Authorization: Bearer <token>`.
- `sessionId` jangan dijadikan input manual user. Simpan sebagai state internal dari session/job yang dipilih.
- `depthMd` adalah Bit Depth, umumnya WITS ID `0108`.
- `hole_depth` adalah Hole Depth, umumnya WITS ID `0110`.
- `GET /api/mwd-data` adalah sumber utama dashboard, latest card, plot, dan export.
- `GET /api/wits-config` adalah sumber label, unit, dropdown curve, mapping, dan alarm config.
- `GET /api/wits-data-values` lebih cocok untuk debug/history per WITS ID, bukan dashboard utama.
- `POST /api/surveys/from-mwd-data` mengambil data dari `MWD_Data`, bukan menerima nilai survey manual.
- `POST /api/surveys/recalculate` hanya menghitung ulang trajectory, bukan rescale sensor.
- `POST /api/mwd-data/edit/rescale` dipakai untuk koreksi nilai sensor/log.
- Export endpoint harus ditangani sebagai blob/file download.
- Serial endpoint hanya valid untuk backend lokal, bukan Vercel.
- Backup session/config harus diunduh oleh frontend sebagai file `.json`; backend tidak menyimpan backup otomatis ke database.
- BigInt ID bisa dikirim sebagai string.
- Decimal dari database bisa muncul sebagai string; frontend perlu normalisasi ke number jika dipakai untuk chart.
- Tanggal dari backend berbentuk UTC ISO string. Konversi ke timezone lokal untuk tampilan UI.

---

## 7. Integrasi Minimum yang Harus Jalan

Jika frontend ingin dianggap sudah terintegrasi secara inti, minimal flow berikut harus berjalan:

```txt
Login
-> Ambil user aktif
-> Ambil session/job
-> Pilih activeSessionId
-> Ambil WITS config
-> Ambil MWD data
-> Tampilkan dashboard/card/plot
-> Generate atau ambil survey
-> Ambil plot template
-> Export LAS/PDF
```

Minimum endpoint:

```txt
POST /api/auth/login
GET  /api/auth/me
GET  /api/mwd-sessions
GET  /api/wits-config
GET  /api/mwd-data
POST /api/mwd-data
GET  /api/wits-data-values
GET  /api/surveys
POST /api/surveys/from-mwd-data
GET  /api/plot-templates/default
POST /api/exports/las
POST /api/exports/pdf-plot
```

