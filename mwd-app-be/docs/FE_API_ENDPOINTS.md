# MWD Backend API Documentation for Frontend

Base URL local:

```txt
http://localhost:5001
```

Production example:

```txt
https://be-mwd.vercel.app
```

All protected endpoints need:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Default users from seed/env:

```json
{
  "admin": { "identifier": "admin", "password": "admin12345" },
  "engineer": { "identifier": "engineer", "password": "engineer12345" },
  "operator": { "identifier": "operator", "password": "operator12345" }
}
```

Role notes:

```txt
admin     : full access
engineer  : create/update monitoring data, configs, exports
operator  : mostly view/read access
```

## Penjelasan Konsep Untuk FE

Bagian ini penting supaya istilah backend tidak tertukar dengan istilah di UI/operator.

### Session / Job

`sessionId` adalah ID internal backend untuk satu job/sesi monitoring MWD.

Di UI sebaiknya jangan minta user mengetik `sessionId`. User cukup pilih job berdasarkan:

```txt
sessionCode
wellName
rigName
company
jobNumber
```

Setelah user memilih job, FE simpan `id` dari session itu dan kirim sebagai `sessionId` di request berikutnya.

Contoh:

```txt
User pilih: MWD-FE-TEST-001 / Well FE Test / Rig Test
Backend id: 5
FE kirim: sessionId = 5
```

Satu akun user bisa punya banyak session/job. Relasinya:

```txt
User -> banyak MWDSession
MWDSession -> banyak MWDData, WITS values, Survey, Depth Tracking, Memory File, Export
```

### MWD Data

`MWD Data` adalah data utama monitoring/realtime. Ini tempat data sensor/log masuk dan disimpan.

Sumber data bisa dari:

```txt
- input manual FE/Postman
- raw Serial WITS
- gateway hardware
- serial ESP/LoRa
- memory/correlation update
```

Dipakai untuk:

```txt
- dashboard realtime
- card latest value
- plot/log curve
- historical data
- LAS/PDF export
- sumber untuk generate survey
```

Contoh field:

```txt
depthMd, hole_depth, inclination, azimuth, gammaRay,
pressure, rop, hookLoad, batteryVoltage, temperature,
shock, vibration, mudWeight, ecd
```

### Survey Data

`Survey` bukan data realtime mentah. Survey adalah data station/trajectory yang dipakai untuk menghitung posisi lubang sumur.

Input dasar survey:

```txt
measuredDepth
inclination
azimuth
```

Hasil olahan survey:

```txt
tvd
northing
easting
verticalSection
doglegSeverity
buildRate
turnRate
closureDistance
closureAzimuth
```

Jadi pembagiannya:

```txt
MWD Data = data sensor/log monitoring
Survey   = data trajectory/posisi sumur
```

`POST /api/surveys/from-mwd-data` tidak menerima value manual. Endpoint itu mengambil data yang sudah ada di `MWD_Data`, lalu membuat `Survey_Station` dari field `depthMd + inclination + azimuth`.

Kalau FE ingin user input survey manual, pakai `POST /api/surveys`.

### WITS Config vs WITS Data Values

`WITS Config` adalah kamus/setting WITS ID.

Contoh:

```txt
0824 = Gamma API, unit API, mappedField gammaRay, alarm max 150, warna plot biru
0715 = Azimuth, unit deg, mappedField azimuth
0108 = Bit Depth, mappedField depthMd
```

Dipakai FE untuk:

```txt
- label parameter
- unit
- dropdown curve/parameter
- warna plot
- scale factor dan bias offset
- alarm min/max
- mapping WITS ID ke field MWD
```

`WITS Data Values` adalah nilai aktual/history yang masuk per WITS ID.

Contoh:

```txt
WITS ID 0824 pada depth 1000.5 nilainya 82.4
WITS ID 0715 pada depth 1000.5 nilainya 240.1
```

Jadi:

```txt
GET /api/wits-config      = ambil kamus/setting WITS ID
GET /api/wits-data-values = ambil nilai aktual/history WITS ID
```

`/api/wits-data-values` tidak dipakai untuk input raw packet. Raw WITS masuk lewat:

```txt
POST /api/mwd-data
POST /api/gateway/mwd-data
Serial gateway lokal
```

### Recalculate vs Rescale


`POST /api/surveys/recalculate` dipakai untuk menghitung ulang hasil olahan survey/trajectory.

Yang dihitung ulang:

```txt
tvd, northing, easting, verticalSection,
doglegSeverity, buildRate, turnRate
```

Dipakai setelah survey diedit, data survey digenerate ulang, atau `verticalSectionAzimuth` berubah.

`POST /api/mwd-data/edit/rescale` dipakai untuk koreksi nilai sensor/log di `MWD_Data`.

Rumus:

```txt
newValue = oldValue * scaleFactor + biasOffset
```

Contoh:

```txt
gammaRay 80 dengan scaleFactor 1.1 menjadi 88
pressure 3200 dengan biasOffset -50 menjadi 3150
```

### Backup / Restore Data

Backup data bukan disimpan ke tabel backup di database. Backend hanya membuat object JSON backup di response.

Flow FE:

```txt
1. FE call POST /api/system-utilities/backup-session
2. Backend return response.backup
3. FE download response.backup sebagai file .json lokal
4. Saat restore, user pilih file .json lokal
5. FE baca isi file lalu kirim ke POST /api/system-utilities/restore-session
```

Jadi label UI yang disarankan:

```txt
Download Backup
Restore From Backup File
```

## Alur Utama FE

Bagian ini menjelaskan urutan kerja yang disarankan untuk frontend. Tujuannya supaya FE tahu endpoint mana yang dipanggil dulu, data apa yang disimpan di state, dan data mana yang dipakai untuk dashboard, plot, survey, export, dan konfigurasi.

### 1. Login dan Simpan Token

Alur pertama selalu login.

```txt
POST /api/auth/login
```

Body:

```json
{
  "identifier": "engineer",
  "password": "engineer12345"
}
```

Response login berisi token JWT. FE simpan token ini, misalnya di memory state atau localStorage sesuai kebutuhan aplikasi.

Setelah login, semua endpoint protected wajib memakai header:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Untuk cek user aktif:

```txt
GET /api/auth/me
```

Data dari `/api/auth/me` dipakai FE untuk menentukan role user, misalnya:

```txt
admin    -> tampilkan semua menu
engineer -> tampilkan menu input/edit/config
operator -> tampilkan menu monitoring/view
```

### 2. Ambil Daftar Job / Session

Setelah login, FE ambil daftar job/session:

```txt
GET /api/mwd-sessions
```

Session adalah container utama data. Semua data monitoring, survey, WITS value, plot, export, depth tracking, dan memory file akan terkait ke `sessionId`.

Di UI, user sebaiknya memilih job berdasarkan informasi yang manusiawi:

```txt
sessionCode
wellName
rigName
company
jobNumber
```

Contoh response session:

```json
{
  "id": 5,
  "sessionCode": "MWD-FE-TEST-001",
  "wellName": "Well FE Test",
  "rigName": "Rig Test"
}
```

FE simpan:

```txt
selectedSessionId = 5
```

Setelah itu semua request data memakai `sessionId=5`.

Penting:

```txt
User tidak perlu melihat atau mengetik sessionId.
sessionId cukup jadi state internal FE.
```

### 3. Ambil Konfigurasi WITS

Setelah session dipilih, FE sebaiknya ambil WITS config:

```txt
GET /api/wits-config
```

Data ini bukan data sensor realtime. Ini adalah master/kamus konfigurasi WITS ID.

Dipakai FE untuk:

```txt
- nama parameter
- unit parameter
- mapping witsId ke field MWD
- warna line plot
- scale kiri/kanan plot
- alarm min/max
- pilihan field untuk dashboard atau plot
```

Contoh:

```txt
0824 -> Gamma API -> mappedField gammaRay -> unit API
0715 -> Azimuth   -> mappedField azimuth  -> unit deg
0108 -> Bit Depth -> mappedField depthMd  -> unit m
0110 -> Hole Depth -> mappedField hole_depth -> unit m
```

Jadi kalau FE ingin menampilkan label yang rapi, jangan hardcode semua label di frontend. Ambil dari `GET /api/wits-config` jika memungkinkan.

### 4. Ambil Data MWD untuk Dashboard

Untuk dashboard utama, card latest value, table monitoring, dan plot realtime, sumber utamanya adalah:

```txt
GET /api/mwd-data?sessionId=<selectedSessionId>
```

Contoh:

```txt
GET /api/mwd-data?sessionId=5
```

Data ini berasal dari tabel `MWD_Data`.

`MWD_Data` bisa terisi dari:

```txt
- input manual via POST /api/mwd-data
- raw Serial WITS via POST /api/mwd-data
- hardware gateway via POST /api/gateway/mwd-data
- serial gateway lokal dari COM port
- memory file correlation
```

Untuk dashboard card seperti gambar mobile, FE cukup ambil row terbaru dari response `GET /api/mwd-data`.

Contoh mapping card:

```txt
Inclination      -> mwdData.inclination
Azimuth          -> mwdData.azimuth
Dip Angle        -> mwdData.dipAngle
G Total          -> mwdData.totalGravity
Magnetic Field   -> mwdData.magneticField
Gamma            -> mwdData.gammaRay
Confidence       -> mwdData.confidence
WOB              -> mwdData.weightOnBit / hookLoad, sesuai field yang dipakai UI
Gamma Depth      -> mwdData.depthMd atau custom depth, tergantung desain FE
Bit Depth        -> mwdData.depthMd
Hole Depth       -> mwdData.hole_depth
Decoder Pressure -> mwdData.decoderPressure
Pump Pressure    -> mwdData.standpipePressure
```

Catatan:

```txt
depthMd = Bit Depth, biasanya WITS ID 0108
hole_depth = Hole Depth, biasanya WITS ID 0110
```

Kalau butuh data berdasarkan range depth:

```txt
GET /api/mwd-data?sessionId=5&depthMin=1000&depthMax=1100
```

Kalau butuh data terbaru saja, FE bisa:

```txt
GET /api/mwd-data?sessionId=5&limit=1
```

Jika backend mengurutkan data ascending di tampilan tertentu, FE boleh ambil item terakhir sebagai latest. Jika endpoint memakai `limit=1` dan response sudah latest, pakai item pertama.

### 5. Alur Input Data MWD Manual / Raw WITS

Untuk testing FE tanpa hardware, FE atau Postman bisa input data manual:

```txt
POST /api/mwd-data
```

Body manual:

```json
{
  "sessionId": 5,
  "measuredAt": "2026-05-18T01:00:00.000Z",
  "depthMd": 1000.5,
  "hole_depth": 1001.2,
  "inclination": 7.48,
  "azimuth": 234.89,
  "dipAngle": 13.3,
  "totalGravity": 1.0566,
  "magneticField": 58.2349,
  "gammaRay": 78,
  "confidence": 94,
  "standpipePressure": 3195.9,
  "decoderPressure": 2940.2
}
```

Untuk raw WITS:

```json
{
  "sessionId": 5,
  "raw": "&&\n01089545.00\n0110945.00\n0715234.89\n071607.48\n082478\n08362940.2\n!!"
}
```

Alur backend saat menerima raw WITS:

```txt
1. Backend baca raw text.
2. Parser cari blok dari && sampai !!.
3. Setiap line dipotong:
   - 4 digit pertama = witsId
   - sisa string = value
4. Backend cek WITS Config.
5. Kalau witsId punya mappedField, value masuk ke field MWD_Data.
6. Backend simpan raw line/raw block untuk audit/debug WITS.
7. FE ambil hasilnya lagi lewat GET /api/mwd-data.
```

Jadi FE tidak perlu parse WITS sendiri kecuali hanya untuk preview/debug UI. Parsing utama sudah di backend.

### 6. Alur WITS Data Values

Selain masuk ke `MWD_Data`, raw WITS juga bisa tersimpan sebagai history per WITS ID di `WITS_Data_Value`.

Untuk baca history WITS value:

```txt
GET /api/wits-data-values?sessionId=5
```

Untuk filter satu WITS ID:

```txt
GET /api/wits-data-values?sessionId=5&witsId=0715&limit=20
```

Gunanya untuk:

```txt
- debug apakah WITS ID tertentu masuk atau tidak
- menampilkan history raw/configured WITS
- alarm berdasarkan WITS ID
- validasi mapping WITS ID ke MWD field
```

Bedanya dengan `GET /api/mwd-data`:

```txt
GET /api/mwd-data
-> data sudah dalam bentuk field aplikasi: azimuth, gammaRay, pressure, depthMd

GET /api/wits-data-values
-> data masih berbasis WITS ID: 0715, 0824, 0108
```

Untuk dashboard utama, biasanya FE pakai `GET /api/mwd-data`.
Untuk halaman raw/debug WITS, FE pakai `GET /api/wits-data-values`.

### 7. Alur Survey

Survey dipakai untuk trajectory/posisi sumur, bukan untuk semua card dashboard.

Ada dua cara membuat survey:

```txt
1. Manual input survey
2. Generate dari MWD data
```

Manual input:

```txt
POST /api/surveys
```

Body:

```json
{
  "sessionId": 5,
  "stationType": "actual",
  "measuredDepth": 1000.5,
  "inclination": 7.48,
  "azimuth": 234.89,
  "verticalSectionAzimuth": 90
}
```

Generate dari MWD data:

```txt
POST /api/surveys/from-mwd-data
```

Body:

```json
{
  "sessionId": 5,
  "stationType": "actual",
  "verticalSectionAzimuth": 90
}
```

Alur `from-mwd-data`:

```txt
1. Backend ambil data dari MWD_Data.
2. Backend cari row yang punya depthMd, inclination, azimuth.
3. Backend buat Survey_Station.
4. Backend hitung TVD, northing, easting, dogleg, build rate, turn rate.
5. FE ambil hasilnya lewat GET /api/surveys.
```

Ambil survey:

```txt
GET /api/surveys?sessionId=5&stationType=actual
```

Import well plan CSV:

```txt
POST /api/surveys/well-plan/import-csv?sessionId=5&stationType=plan&verticalSectionAzimuth=90
```

Body raw text:

```txt
1000,12.3,240.1
1010,13.1,241.2
1020,14.0,242.0
```

Recalculate:

```txt
POST /api/surveys/recalculate
```

Body:

```json
{
  "sessionId": 5,
  "stationType": "actual",
  "verticalSectionAzimuth": 90
}
```

Recalculate dipakai kalau survey sudah ada, lalu FE/user mengubah inc/azimuth/MD atau vertical section azimuth, sehingga hasil TVD/dogleg perlu dihitung ulang.

### 8. Alur Plot Template dan PDF Plot

Plot template adalah layout/konfigurasi tampilan plot. Data template berasal dari tabel `Plot_Template`, bukan dari `MWD_Data`.

Ambil template default:

```txt
GET /api/plot-templates/default
```

Ambil semua template:

```txt
GET /api/plot-templates
```

Template dipakai untuk menentukan:

```txt
- jumlah track/kolom plot
- curve apa saja di setiap track
- warna line
- scale kiri/kanan
- header dan metadata
- opsi survey/projection
- logo/company metadata
```

Data kurva plot tetap diambil dari `MWD_Data` berdasarkan `sessionId` dan range depth.

Alur FE untuk preview plot:

```txt
1. FE ambil selected session.
2. FE ambil template default atau template pilihan user.
3. FE ambil MWD data sesuai depth range.
4. FE render preview di browser.
```

Alur FE untuk export PDF plot:

```txt
1. FE ambil/siapkan template config.
2. FE kirim request ke POST /api/exports/pdf-plot.
3. Backend ambil MWD_Data sesuai sessionId dan depth range.
4. Backend render PDF memakai template.
5. FE download file PDF.
```

Contoh body:

```json
{
  "sessionId": 5,
  "templateId": 1,
  "depthMin": 0,
  "depthMax": 99999,
  "scale": "1:500"
}
```

### 9. Alur Export LAS dan Survey CSV

Export LAS dipakai untuk mengirim data log ke software lain.

```txt
POST /api/exports/las
```

Body:

```json
{
  "sessionId": 5,
  "depthMin": 0,
  "depthMax": 99999
}
```

Export survey CSV dipakai untuk download data trajectory/station.

```txt
POST /api/exports/surveys
```

Body:

```json
{
  "sessionId": 5,
  "stationType": "actual",
  "format": "csv"
}
```

Alur export:

```txt
1. FE kirim request export.
2. Backend ambil data dari database.
3. Backend return file.
4. FE trigger download.
```

### 10. Alur Data Edit Tools

Data edit tools dipakai untuk memperbaiki data log yang sudah tersimpan.

Fitur:

```txt
- hide depth range
- unhide depth range
- delete depth range
- move depth
- copy depth
- rescale
```

Saran alur FE:

```txt
1. User pilih session.
2. User pilih depth range.
3. User pilih operasi edit.
4. FE panggil endpoint preview GET terlebih dahulu jika tersedia.
5. FE tampilkan affectedCount dan sample data.
6. User confirm.
7. FE panggil POST untuk apply.
8. FE reload GET /api/mwd-data.
9. FE tampilkan edit history.
```

Contoh preview move depth:

```txt
GET /api/mwd-data/edit/move-depth?sessionId=5&depthMin=1000&depthMax=1100&targetStartDepth=1200
```

Contoh apply rescale:

```txt
POST /api/mwd-data/edit/rescale
```

Body:

```json
{
  "sessionId": 5,
  "depthMin": 1000,
  "depthMax": 1100,
  "field": "gammaRay",
  "scaleFactor": 1.1,
  "biasOffset": 0,
  "note": "gamma calibration"
}
```

Setelah edit, FE bisa ambil history:

```txt
GET /api/mwd-data/edit/history?sessionId=5
```

### 11. Alur Memory File Import dan Correlation

Memory file adalah data tambahan dari memory tool yang bisa dicocokkan dengan data MWD berdasarkan depth atau time.

Alur FE:

```txt
1. User upload/import memory file.
2. Backend simpan memory file dan points.
3. FE tampilkan preview points.
4. User pilih field mapping.
5. FE jalankan correlation preview dengan dryRun=true.
6. FE tampilkan matchedCount, skippedCount, sample.
7. User confirm.
8. FE jalankan correlation apply dengan dryRun=false.
9. Backend update field tertentu di MWD_Data.
10. FE reload MWD data.
```

Endpoint penting:

```txt
POST /api/memory-files/import
GET  /api/memory-files/:id/points
POST /api/memory-files/:id/correlate
```

### 12. Alur Hardware Lokal: Serial / ESP / LoRa

Untuk local deployment, backend berjalan di PC yang terhubung ke ESP/LoRa via COM port.

PC lain di network lokal bisa akses FE/backend lewat IP PC server, tetapi serial port tetap dibaca oleh PC yang menjalankan backend.

Alur FE untuk serial lokal:

```txt
1. FE panggil GET /api/serial/ports
2. User pilih COM port, misalnya COM9
3. FE panggil POST /api/serial/connect
4. Backend buka COM port dan baca raw WITS stream
5. Backend parse raw WITS
6. Backend simpan ke MWD_Data dan WITS_Data_Value
7. FE poll GET /api/mwd-data dan GET /api/serial/status
```

Catatan penting:

```txt
/api/serial/ports hanya valid untuk local backend.
Endpoint ini tidak cocok dites di Vercel karena Vercel tidak punya akses COM port.
```

Untuk WebSocket ESP:

```txt
GET /api/esp-ws/status
```

Jika WebSocket dan serial aktif bersamaan, backend perlu menghindari duplicate berdasarkan transmitter/sequence. Untuk UI, FE cukup tampilkan status masing-masing source:

```txt
- Serial status
- ESP WebSocket status
- last packet
- RSSI/SNR untuk monitoring komunikasi
```

RSSI/SNR tidak wajib disimpan sebagai data log utama. Nilainya lebih cocok ditampilkan sebagai monitoring kualitas komunikasi.

### 13. Alur Backup, Clear, dan Restore Session

Backup tidak otomatis disimpan ke database. Backend membuat JSON backup dan FE menyimpannya sebagai file lokal.

Backup:

```txt
POST /api/system-utilities/backup-session
```

Alur backup:

```txt
1. FE kirim request backup.
2. Backend return response.backup.
3. FE download response.backup sebagai file .json.
4. File disimpan lokal oleh user.
```

Clear session data:

```txt
POST /api/system-utilities/clear-session-data
```

Alur clear:

```txt
1. FE minta user confirm.
2. FE panggil backup dulu jika ingin aman.
3. FE panggil clear-session-data dengan confirm text.
4. Backend menghapus target data di session tersebut.
5. FE reload dashboard/table.
```

Restore:

```txt
POST /api/system-utilities/restore-session
```

Alur restore:

```txt
1. User pilih file backup .json lokal.
2. FE baca isi file.
3. FE kirim object backup asli ke backend.
4. Backend restore data ke session.
5. FE reload data.
```

Jangan kirim:

```json
{
  "backup": {}
}
```

Karena itu akan menghasilkan:

```txt
Invalid backup format
```

Yang harus dikirim adalah object `backup` asli dari response `backup-session`.

### 14. Ringkasan Alur Data End-to-End

Alur normal tanpa hardware:

```txt
Login
-> GET sessions
-> pilih session
-> POST /api/mwd-data untuk input test
-> GET /api/mwd-data untuk dashboard
-> GET /api/wits-config untuk label/unit/config
-> POST /api/surveys/from-mwd-data jika butuh survey
-> GET /api/surveys untuk table trajectory
-> GET /api/plot-templates/default untuk layout plot
-> POST /api/exports/pdf-plot atau /api/exports/las jika butuh export
```

Alur normal dengan hardware lokal:

```txt
Login
-> GET sessions
-> pilih session
-> GET /api/serial/ports
-> POST /api/serial/connect
-> backend baca COM port
-> backend parse raw WITS
-> backend simpan MWD_Data dan WITS_Data_Value
-> FE poll GET /api/mwd-data untuk dashboard
-> FE poll GET /api/wits-data-values untuk debug/history WITS
-> FE poll serial/ESP status untuk komunikasi
```

Alur plot:

```txt
GET /api/plot-templates/default
-> GET /api/mwd-data?sessionId=...&depthMin=...&depthMax=...
-> render preview di FE
-> POST /api/exports/pdf-plot untuk download PDF
```

Alur survey:

```txt
POST /api/surveys/from-mwd-data
-> GET /api/surveys
-> POST /api/surveys/recalculate kalau ada perubahan survey
-> POST /api/exports/surveys untuk export CSV
```

## Ringkasan Fungsi Semua Endpoint

Bagian ini menjelaskan fungsi setiap folder endpoint dari sudut pandang FE.

### Auth

Endpoint auth dipakai untuk login dan mengecek user yang sedang aktif.

```txt
POST /api/auth/login = login, menghasilkan JWT token
GET  /api/auth/me    = cek user aktif dari token
```

FE wajib menyimpan token dari login, lalu mengirim:

```http
Authorization: Bearer <token>
```

ke endpoint protected.

### Roles

Roles adalah master hak akses.

```txt
admin    = akses penuh
engineer = bisa input/edit data monitoring
operator = mayoritas view/read
```

Endpoint ini dipakai untuk halaman admin/user management.

```txt
GET    /api/roles     = list role
POST   /api/roles     = tambah role
GET    /api/roles/:id = detail role
PUT    /api/roles/:id = update role
DELETE /api/roles/:id = hapus role
```

Untuk FE umum, role biasanya hanya dipakai untuk menentukan menu mana yang boleh tampil.

### Users

Users adalah akun aplikasi.

```txt
GET    /api/users     = list user
POST   /api/users     = buat user baru
GET    /api/users/:id = detail user
PUT    /api/users/:id = update user
DELETE /api/users/:id = hapus user
```

Dipakai di halaman admin untuk mengelola akun engineer/operator.

### MWD Sessions / Jobs

Session adalah job/sesi monitoring. Di UI sebaiknya dilabeli sebagai `Job`, bukan `Session ID`.

```txt
GET    /api/mwd-sessions     = list job/session
POST   /api/mwd-sessions     = buat job baru
GET    /api/mwd-sessions/:id = detail job
PUT    /api/mwd-sessions/:id = update metadata job
DELETE /api/mwd-sessions/:id = hapus job
```

FE flow yang disarankan:

```txt
1. User login
2. FE load /api/mwd-sessions
3. User pilih job/well
4. FE simpan selected session.id sebagai sessionId aktif
5. Semua endpoint data memakai sessionId aktif itu
```

### MWD Data

MWD Data adalah data utama monitoring/realtime.

```txt
GET    /api/mwd-data          = list data monitoring per session
POST   /api/mwd-data          = input data monitoring/manual/raw WITS
GET    /api/mwd-data/:id      = detail satu data
PUT    /api/mwd-data/:id      = edit satu data
DELETE /api/mwd-data/:id      = hapus satu data
GET    /api/historical-data   = ambil data historical dengan filter waktu/depth
```

Dipakai untuk:

```txt
- dashboard latest value
- realtime plot
- historical trend
- source export LAS/PDF
- source generate survey
```

Jika FE ingin card dashboard seperti `Inclination`, `Azimuth`, `Gamma`, `Pump Pressure`, `Bit Depth`, ambil dari row terakhir `GET /api/mwd-data?sessionId=...`.

### WITS Config

WITS Config adalah kamus/setting WITS ID.

```txt
GET    /api/wits-config     = list semua konfigurasi WITS ID
POST   /api/wits-config     = tambah WITS ID/config baru
GET    /api/wits-config/:id = detail config
PUT    /api/wits-config/:id = update config
DELETE /api/wits-config/:id = hapus config
```

Dipakai FE untuk:

```txt
- label parameter
- unit
- dropdown curve
- mapping witsId ke field MWD
- scale factor
- bias offset
- sensor-to-bit spacing
- alarm min/max
- warna plot
- LAS tag
```

Contoh: FE menerima data WITS `0824`, lalu melihat config bahwa `0824 = Gamma API`, unit `API`, mappedField `gammaRay`.

### WITS Data Values

WITS Data Values adalah history nilai aktual per WITS ID.

```txt
GET /api/wits-data-values = baca history WITS value
```

Endpoint ini tidak untuk input data. Data WITS masuk dari `POST /api/mwd-data`, `POST /api/gateway/mwd-data`, atau serial gateway.

Dipakai untuk:

```txt
- plot per WITS ID
- debug raw WITS line/block
- melihat rawValue vs scaled value
- history parameter tertentu
```

Contoh:

```txt
GET /api/wits-data-values?sessionId=5&witsId=0715&limit=100
```

Artinya ambil history Azimuth WITS `0715`.

### WITS Alarms

WITS Alarm adalah event alarm saat value melewati batas di WITS Config.

```txt
GET /api/wits-alarms = list alarm
PUT /api/wits-alarms/:id/acknowledge = tandai alarm sudah dibaca
PUT /api/wits-alarms/:id/resolve = tandai alarm selesai
```

Flow FE:

```txt
1. Backend menerima WITS value
2. Backend cek alarm min/max dari WITS Config
3. Jika melewati batas, backend membuat alarm
4. FE tampilkan alarm
5. User klik acknowledge atau resolve
```

### Surveys

Survey dipakai untuk station/trajectory, bukan dashboard realtime.

```txt
GET    /api/surveys                       = list survey station
POST   /api/surveys                       = input survey manual
POST   /api/surveys/from-mwd-data         = generate survey dari MWD_Data
POST   /api/surveys/recalculate           = hitung ulang trajectory/projection
POST   /api/surveys/well-plan/import-csv  = import well plan CSV
GET    /api/surveys/:id                   = detail survey
PUT    /api/surveys/:id                   = edit survey
DELETE /api/surveys/:id                   = hapus survey
```

Perbedaan penting:

```txt
POST /api/surveys
= input survey manual

POST /api/surveys/from-mwd-data
= ambil depth/inc/azimuth dari MWD_Data lalu generate Survey_Station

POST /api/surveys/recalculate
= hitung ulang TVD, northing, easting, dogleg, build rate, turn rate
```

Halaman FE yang memakai survey:

```txt
- well trajectory
- plan vs actual
- survey table
- directional report
```

### Plot Templates

Plot Templates menyimpan konfigurasi layout PDF plot/log.

```txt
GET    /api/plot-templates         = list template
GET    /api/plot-templates/default = template default
POST   /api/plot-templates         = buat template baru
GET    /api/plot-templates/:id     = detail template
PUT    /api/plot-templates/:id     = update template
DELETE /api/plot-templates/:id     = hapus template
```

Dipakai untuk menentukan:

```txt
- judul plot
- logo company
- track/kolom plot
- curve apa saja yang ditampilkan
- min/max scale
- warna line
```

FE bisa menyediakan editor template, atau minimal memakai default template untuk export PDF plot.

### Exports

Exports dipakai untuk download file.

```txt
POST /api/exports/historical = export data historical ke JSON/CSV
POST /api/exports/surveys    = export survey station ke CSV
POST /api/exports/las        = export LAS file
POST /api/exports/pdf-plot   = export PDF plot/log
GET  /api/exports/records    = history export
```

FE harus menangani response sebagai file/blob untuk LAS, CSV, dan PDF.

### MWD Data Edit Tools

Edit tools dipakai untuk operasi massal pada data MWD berdasarkan range depth.

```txt
GET  /api/mwd-data/edit/operations          = history operasi edit
POST /api/mwd-data/edit/hide-range          = sembunyikan interval depth
POST /api/mwd-data/edit/unhide-range        = tampilkan kembali interval depth
POST /api/mwd-data/edit/delete-depth-range  = hapus data dalam interval depth
GET  /api/mwd-data/edit/move-depth          = preview move depth
POST /api/mwd-data/edit/move-depth          = geser depth data
GET  /api/mwd-data/edit/copy-depth          = preview copy depth
POST /api/mwd-data/edit/copy-depth          = copy data ke depth baru
GET  /api/mwd-data/edit/rescale             = preview rescale field
POST /api/mwd-data/edit/rescale             = kalibrasi field sensor/log
```

Kegunaan:

```txt
hide-range   = data buruk tidak ditampilkan tapi tidak dihapus
delete-range = hapus interval data
move-depth   = koreksi posisi depth
copy-depth   = duplikasi interval data
rescale      = koreksi nilai sensor, misalnya gamma/pressure
```

FE sebaiknya memanggil endpoint preview `GET` dulu sebelum apply `POST`.

### Memory Files

Memory file adalah data offline/memory dari alat yang diimport lalu dikorelasikan ke MWD data.

```txt
GET    /api/memory-files                 = list memory file
POST   /api/memory-files/import          = import CSV/text/rows memory file
GET    /api/memory-files/:id             = detail memory file
GET    /api/memory-files/:id/points      = data points dari memory file
POST   /api/memory-files/:id/correlate   = preview/apply correlation
GET    /api/memory-files/correlations    = history correlation
DELETE /api/memory-files/:id             = hapus memory file
```

Dipakai saat ada data memory/offline seperti APWD/ECD memory yang harus dicocokkan ke MWD data berdasarkan depth atau time.

### Depth Tracking / DTS

Depth tracking menyimpan state kedalaman aktif.

```txt
GET  /api/depth-tracking/state       = state depth terbaru
GET  /api/depth-tracking/samples     = history sample depth tracking
POST /api/depth-tracking/update      = update manual/current depth state
POST /api/depth-tracking/recalculate = hitung ulang depth state dari MWD data
```

Dipakai untuk:

```txt
- bit depth
- hole depth
- block depth
- ROP
- status drilling
```

### WITS Output Queue

WITS output adalah antrean data yang akan dikirim ke Rig WITS port. Saat ini backend baru membuat queue, belum menulis fisik ke serial rig port.

```txt
GET  /api/wits-output/queue                = list queue output
POST /api/wits-output/generate-from-latest = generate output dari MWD data terbaru
PUT  /api/wits-output/:id/status           = update status queue
```

Status:

```txt
queued, sent, failed, skipped
```

### Serial Port Manager

Serial endpoint hanya untuk backend lokal yang jalan di PC rig dan punya akses ke COM port.

```txt
GET  /api/serial/ports      = list COM port lokal
POST /api/serial/connect    = connect COM port dan mulai ingest WITS
GET  /api/serial/status     = status koneksi serial dan sinyal
POST /api/serial/disconnect = disconnect serial
```

Jangan test endpoint ini di Vercel karena Vercel tidak punya akses ke COM port lokal.

### ESP WebSocket Monitor

Endpoint ini untuk monitoring koneksi backend ke ESP WebSocket gateway.

```txt
GET /api/esp-ws/status = status koneksi websocket ESP
```

Dipakai kalau hardware juga mengirim data via WebSocket selain serial.

### System Utilities

System utilities dipakai untuk operasi admin seperti clear data, backup, restore, dan backup konfigurasi.

```txt
GET  /api/system-utilities/clear-data/targets   = list target clear data
POST /api/system-utilities/clear-data/preview   = preview jumlah data yang akan dihapus
POST /api/system-utilities/backup-session       = generate backup JSON session
POST /api/system-utilities/clear-data           = hapus data session sesuai target
POST /api/system-utilities/restore-session      = restore dari file backup JSON
GET  /api/system-utilities/config-backup/targets = list target config backup
POST /api/system-utilities/config-backup        = backup konfigurasi
POST /api/system-utilities/config-restore       = restore konfigurasi
```

Backup session/config tidak otomatis tersimpan ke DB. FE harus download `backup` sebagai file `.json`.

### Connection Status

Connection status menyimpan log status koneksi sistem.

```txt
GET    /api/connection-status     = list status koneksi
POST   /api/connection-status     = buat log status koneksi
GET    /api/connection-status/:id = detail status
PUT    /api/connection-status/:id = update status
DELETE /api/connection-status/:id = hapus status
```

Dipakai untuk monitoring koneksi serial/websocket/backend.

### Failover Events

Failover event menyimpan log perpindahan/masalah koneksi.

```txt
GET    /api/failover-events     = list failover event
POST   /api/failover-events     = buat failover event
GET    /api/failover-events/:id = detail event
PUT    /api/failover-events/:id = update event
DELETE /api/failover-events/:id = hapus event
```

Dipakai jika ada koneksi utama gagal dan pindah ke jalur lain, misalnya serial ke websocket.

### Gateway Ingest

Gateway ingest adalah endpoint khusus hardware/backend gateway, bukan endpoint user FE biasa.

```txt
POST /api/gateway/mwd-data = ingest payload MWD/raw WITS dari hardware service
```

Endpoint ini tidak pakai JWT user, tapi pakai:

```http
x-gateway-key: <GATEWAY_API_KEY>
```

### Email Reports

Email reports adalah fitur laporan via SMTP. Saat ini disabled by default.

```txt
POST /api/reports/email/test = test SMTP/email
POST /api/reports/email/send = kirim report email
GET  /api/reports/email/logs = history email report
```

Jika `EMAIL_REPORTS_ENABLED` belum `true`, endpoint ini akan return `503`.

## Auth

### POST /api/auth/login

Login and get JWT token.

```json
{
  "identifier": "engineer",
  "password": "engineer12345"
}
```

Response includes token and user.

### GET /api/auth/me

Get current logged-in user.

## Roles

### GET /api/roles

List roles.

### POST /api/roles

Admin only.

```json
{
  "name": "engineer"
}
```

### GET /api/roles/:id
### PUT /api/roles/:id
### DELETE /api/roles/:id

## Users

### GET /api/users

List users.

### POST /api/users

```json
{
  "username": "fieldeng",
  "email": "fieldeng@example.com",
  "password": "fieldeng12345",
  "roleId": 4
}
```

### GET /api/users/:id
### PUT /api/users/:id
### DELETE /api/users/:id

## MWD Sessions

Session adalah representasi backend untuk job/sesi monitoring. FE boleh menampilkan ini sebagai `Job`.

### GET /api/mwd-sessions

List sessions.

### POST /api/mwd-sessions

```json
{
  "sessionCode": "MWD-TEST-001",
  "company": "Company Name",
  "wellName": "Well Test",
  "wellId": "WELL-001",
  "rigName": "Rig Test",
    "fieldName": "Field Name",
  "jobNumber": "JOB-001",
  "province": "Province",
  "countyParish": "County/Parish",
  "country": "Indonesia",
  "location": "Pad A",
  "latitude": -6.2,
  "longitude": 106.8,
  "notes": "job notes",
  "startedAt": "2026-05-15T00:00:00.000Z",
  "endedAt": null,
  "userId": 8
}
```

### GET /api/mwd-sessions/:id
### PUT /api/mwd-sessions/:id
### DELETE /api/mwd-sessions/:id

MWD session is the backend name for a field job. UI can label it as `Job`.

## MWD Data

Main monitoring data table. This is what FE usually plots. Untuk dashboard card seperti inclination, azimuth, gamma, pressure, bit depth, hole depth, battery, dan temperature, sumber utama biasanya `MWD Data`.

### GET /api/mwd-data

Query:

```txt
sessionId=11
includeHidden=false
```

Example:

```http
GET /api/mwd-data?sessionId=11
```

### POST /api/mwd-data

Create one MWD row. Supports direct fields and raw WITS.

Direct field example:

```json
{
  "sessionId": 11,
  "measuredAt": "2026-05-14T10:00:00.000Z",
  "depthMd": 1000.5,
  "hole_depth": 1001.0,
  "inclination": 12.3,
  "azimuth": 240.1,
  "gammaRay": 80,
  "standpipePressure": 3200,
  "rop": 25,
  "hookLoad": 120
}
```

Raw WITS example:

```json
{
  "sessionId": 11,
  "raw": "SEQ=12|TS=100|0715,242.55|RX_TS=200|RSSI=-58|SNR=12.0"
}
```

Serial WITS block example:

```json
{
  "sessionId": 11,
  "raw": "&&\n01089545.00\n0110945.00\n!!\n&&\n071700\n0824109516\n071612.0\n0836122.3\n!!"
}
```

Input realtime uses plain Serial WITS raw text, not WITSML/XML/SOAP/ETP.

Nested WITS example:

```json
{
  "sessionId": 11,
  "wits": {
    "0108": 1000.5,
    "0110": 1001.0,
    "0713": 12.3,
    "0715": 240.1,
    "0824": 80
  }
}
```

Common MWD fields returned:

```txt
id, sessionId, measuredAt, toolRunTime, slideIndicator,
depthMd, hole_depth, inclination, continuousInclination,
azimuth, continuousAzimuth, verticalSection,
rawSensorAx, rawSensorAy, rawSensorAz,
rawSensorMx, rawSensorMy, rawSensorMz,
magneticToolface, gravityToolface, totalGravity,
dipAngle, magneticField, gammaRay, temperature,
batteryVoltage, battery2OnOff, rotationSpeed, downholeRpm,
rotaryTorque, shock, shockAxial, shockLateral,
vibration, vibrationAxial, vibrationLateral,
rop, hookLoad, hookPosition, standpipePressure,
flowOut, flowIn, gasAverage,
annularPressure, borePressure, mwdPressure, kpwd2,
differentialPressure, annularDifferentialPressure,
mudWeight, ecd, ecd2, ecdTvd, ecdDd,
ssi, tvdCalc, confidence, pulseAmplitude,
decoderPressure, avo, shallowResistivity,
isHidden, hiddenAt, hiddenById, editNote, createdAt
```

Important depth mapping:

```txt
0108 Bit Depth  -> depthMd
0110 Hole Depth -> hole_depth
0713 Inc        -> inclination
0715 Azimuth    -> azimuth
0823/0824 Gamma -> gammaRay
```

### GET /api/mwd-data/:id
### PUT /api/mwd-data/:id
### DELETE /api/mwd-data/:id

PUT body can contain any MWD field above.

## Historical Data

### GET /api/historical-data

Query:

```txt
sessionId=11
measuredFrom=2026-05-14T00:00:00.000Z
measuredTo=2026-05-14T23:59:59.999Z
depthMin=1000
depthMax=1200
```

Example:

```http
GET /api/historical-data?sessionId=11&depthMin=1000&depthMax=1200
```

## WITS Config

Configuration editor for WITS IDs. Ini adalah master/kamus WITS ID, bukan history value.

### GET /api/wits-config

List all WITS IDs and config. FE memakai endpoint ini untuk label, unit, dropdown parameter, warna plot, scale factor, bias offset, sensor spacing, alarm min/max, dan mapping `witsId -> mappedField`.

### POST /api/wits-config

```json
{
  "witsId": "0824",
  "name": "Gamma API",
  "units": "API",
  "mappedField": "gammaRay",
  "decimalPlaces": 0,
  "scaleFactor": 1,
  "biasOffset": 0,
  "sensorToBitSpacing": 37,
  "plotScaleLeft": 0,
  "plotScaleRight": 150,
  "lineColor": "#0000ff",
  "wrapColor": "#ff0000",
  "depthTrackingMode": "bit_depth",
  "depthTrackingField": "depth",
  "enableLogging": true,
  "alarmEnabled": false,
  "alarmMin": -9999.9,
  "alarmMax": 99999.9,
  "customDepthWitsId": null,
  "dataSource": "serial_port_wits",
  "dataInputValue": 70,
  "sendToRigWitsPort": true,
  "doNotRepeat": false,
  "lasTag": "gamma",
  "lasDescription": "Gamma API reading",
  "lasFilter": 0
}
```

### GET /api/wits-config/:id
### PUT /api/wits-config/:id
### DELETE /api/wits-config/:id

## WITS Data Values

Raw/configured WITS values stored by WITS ID. Ini adalah history nilai aktual per WITS ID, bukan endpoint input raw packet.

Untuk grafik:

```txt
time series  : x = measuredAt, y = value
depth series : x = value, y = depthMd
```

Untuk dashboard latest value, FE lebih praktis mengambil row terakhir dari `GET /api/mwd-data?sessionId=...`. `wits-data-values` lebih cocok untuk history/debug per WITS ID.

### GET /api/wits-data-values

Query:

```txt
sessionId=11
witsId=0715
measuredFrom=2026-05-14T00:00:00.000Z
measuredTo=2026-05-14T23:59:59.999Z
depthMin=1000
depthMax=1200
limit=20
```

Example:

```http
GET /api/wits-data-values?sessionId=11&witsId=0715&limit=20
```

Response shape:

```json
{
  "filters": {},
  "count": 1,
  "data": [
    {
      "id": "1",
      "sessionId": 11,
      "witsId": "0715",
      "rawValue": "242.55",
      "rawText": "242.55",
      "rawLine": "0715242.55",
      "rawBlock": "&&\n0715242.55\n!!",
      "value": "242.55",
      "depthMd": "1000.5",
      "measuredAt": "2026-05-14T10:00:00.000Z"
    }
  ]
}
```

## WITS Alarms

Alarm dibuat otomatis ketika value WITS melewati min/max di WITS Config.

### GET /api/wits-alarms

Query:

```txt
sessionId=11
witsId=0824
acknowledged=false
limit=50
```

### PUT /api/wits-alarms/:id/acknowledge
### PUT /api/wits-alarms/:id/resolve

`acknowledge` berarti alarm sudah dibaca operator/engineer. `resolve` berarti alarm dianggap selesai/normal kembali.

## Surveys

Survey adalah data station/trajectory. Survey bukan sumber dashboard realtime, tapi hasil input/perhitungan untuk posisi sumur.

### GET /api/surveys

Query:

```txt
sessionId=11
stationType=actual
```

### POST /api/surveys

```json
{
  "sessionId": 11,
  "stationType": "actual",
  "measuredDepth": 1000.5,
  "inclination": 12.3,
  "azimuth": 240.1,
  "verticalSectionAzimuth": 90,
  "source": "manual",
  "notes": "survey station"
}
```

Optional fields:

```txt
tvd, northing, easting, verticalSectionAzimuth, source, notes
```

### POST /api/surveys/from-mwd-data

Generate survey stations from MWD data rows with depth, inc, azimuth. Endpoint ini tidak menerima value survey satu-satu. Backend mengambil data dari `MWD_Data`, lalu membuat `Survey_Station`.

```json
{
  "sessionId": 11,
  "stationType": "actual",
  "verticalSectionAzimuth": 90,
  "replaceExisting": true
}
```

### POST /api/surveys/recalculate

Recalculate projection values. Endpoint ini menghitung ulang field olahan seperti `tvd`, `northing`, `easting`, `verticalSection`, `doglegSeverity`, `buildRate`, dan `turnRate`. Nilai dasar `measuredDepth`, `inclination`, dan `azimuth` tidak diubah.

```json
{
  "sessionId": 11,
  "stationType": "actual",
  "verticalSectionAzimuth": 90
}
```

### POST /api/surveys/well-plan/import-csv

Import well plan survey CSV. Body endpoint ini berupa raw text CSV, sedangkan `sessionId` dikirim lewat query params.

```http
POST /api/surveys/well-plan/import-csv?sessionId=11&stationType=plan&verticalSectionAzimuth=90
```

Body raw text:

```txt
1000,12.3,240.1
1001.2,13.4,241.5
```

### GET /api/surveys/:id
### PUT /api/surveys/:id
### DELETE /api/surveys/:id

## Plot Templates

### GET /api/plot-templates

### GET /api/plot-templates/default

### POST /api/plot-templates

`name` and `config` are required.

```json
{
  "name": "Default MWD Plot",
  "description": "4 track MD plot",
  "isDefault": true,
  "config": {
    "title": "Well Test",
    "scaleLabel": "MD 1:500",
    "logoDataUrl": "data:image/png;base64,...",
    "header": {
      "company": "Company Name",
      "field": "",
      "wellName": "Well Test",
      "rigId": "Rig Test"
    },
    "tracks": [
      {
        "title": "Pressure",
        "curves": [
          { "key": "annularPressure", "label": "Pressure - Annular", "unit": "psi", "min": 0, "max": 4000, "color": "#008000" },
          { "key": "borePressure", "label": "Pressure - Bore", "unit": "psi", "min": 0, "max": 4000, "color": "#1f77b4" }
        ]
      }
    ]
  }
}
```

Logo is supplied by FE as `logoDataUrl`.

### GET /api/plot-templates/:id
### PUT /api/plot-templates/:id
### DELETE /api/plot-templates/:id

## Exports

All export endpoints return downloadable file responses.

### POST /api/exports/historical

`format` must be `json` or `csv`.

```json
{
  "sessionId": 11,
  "format": "csv",
  "depthMin": 1000,
  "depthMax": 1200
}
```

### POST /api/exports/surveys

Export survey station ke CSV. Dipakai untuk download tabel survey actual atau well plan.

```json
{
  "sessionId": 11,
  "stationType": "actual",
  "format": "csv"
}
```

Untuk well plan:

```json
{
  "sessionId": 11,
  "stationType": "plan",
  "format": "csv"
}
```

Kolom CSV:

```txt
id, sessionId, stationType, measuredDepth, inclination, azimuth,
tvd, northing, easting, verticalSection,
doglegSeverity, buildRate, turnRate,
closureDistance, closureAzimuth, courseLength,
verticalSectionAzimuth, source, notes, createdAt, updatedAt
```

### POST /api/exports/las

```json
{
  "sessionId": 11,
  "startDepth": 0,
  "endDepth": 99999,
  "stepDepth": 1,
  "depthPrecision": 4,
  "maxGap": 25,
  "nullValue": -9999,
  "includeWits": true,
  "includeSurvey": true,
  "includeProjectedSurvey": true,
  "includeSurveysInOtherSection": false,
  "stopAtLastSurveyDepth": false,
  "dateTimeInFirstColumn": false,
  "correctDepthColumnForTvd": false,
  "interpolateSurvey": false,
  "surveyStationType": "actual",
  "depthUnit": "m",
  "columns": [
    { "field": "depthMd", "mnemonic": "DEPT", "unit": "m", "description": "Bit Depth" },
    { "field": "hole_depth", "mnemonic": "HDEPT", "unit": "m", "description": "Hole Depth" },
    { "field": "inclination", "mnemonic": "INCL", "unit": "deg", "description": "Inclination" },
    { "field": "azimuth", "mnemonic": "AZIM", "unit": "deg", "description": "Azimuth" },
    { "field": "gammaRay", "mnemonic": "GR", "unit": "API", "description": "Gamma Ray" }
  ],
  "wellInfo": [
    { "name": "COMP", "unit": "", "data": "Company", "description": "Company" }
  ]
}
```

### POST /api/exports/pdf-plot

```json
{
  "sessionId": 11,
  "templateId": 1,
  "depthMin": 0,
  "depthMax": 500
}
```

Inline template override:

```json
{
  "sessionId": 11,
  "depthMin": 0,
  "depthMax": 500,
  "template": {
    "title": "Well Test",
    "logoDataUrl": "data:image/png;base64,...",
    "tracks": []
  }
}
```

### GET /api/exports/records

Export history.

## MWD Data Edit Tools

Base fields:

```txt
sessionId, depthMin/startDepth, depthMax/endDepth, includeHidden, note
```

### GET /api/mwd-data/edit/operations

Query:

```txt
sessionId=11
limit=20
```

### POST /api/mwd-data/edit/hide-range

```json
{
  "sessionId": 11,
  "depthMin": 1000,
  "depthMax": 1100,
  "note": "bad sensor interval"
}
```

### POST /api/mwd-data/edit/unhide-range

Same body as hide.

### POST /api/mwd-data/edit/delete-depth-range

```json
{
  "sessionId": 11,
  "depthMin": 1000,
  "depthMax": 1100,
  "note": "delete bad interval"
}
```

### GET /api/mwd-data/edit/move-depth

Preview only. Query:

```txt
sessionId=11&depthMin=1000&depthMax=1100&targetStartDepth=1200
```

### POST /api/mwd-data/edit/move-depth

```json
{
  "sessionId": 11,
  "depthMin": 1000,
  "depthMax": 1100,
  "targetStartDepth": 1200,
  "note": "move interval"
}
```

Alternative:

```json
{
  "sessionId": 11,
  "depthMin": 1000,
  "depthMax": 1100,
  "depthOffset": 200
}
```

### GET /api/mwd-data/edit/copy-depth

Preview only.

### POST /api/mwd-data/edit/copy-depth

```json
{
  "sessionId": 11,
  "depthMin": 1000,
  "depthMax": 1100,
  "targetStartDepth": 1200,
  "measuredAtOffsetMs": 0
}
```

### GET /api/mwd-data/edit/rescale

Preview only.

### POST /api/mwd-data/edit/rescale

Rescale dipakai untuk kalibrasi/koreksi nilai sensor/log di `MWD_Data`, misalnya gamma dikali 1.1 atau pressure dikurangi offset tertentu. Ini berbeda dari survey recalculation.

```json
{
  "sessionId": 11,
  "depthMin": 1000,
  "depthMax": 1100,
  "field": "gammaRay",
  "scaleFactor": 1.1,
  "biasOffset": 0
}
```

## Memory Files

### GET /api/memory-files

Query:

```txt
sessionId=11
limit=20
```

### POST /api/memory-files/import

Import CSV/text memory file.

```json
{
  "sessionId": 11,
  "fileName": "memory.csv",
  "source": "memory_file",
  "content": "depth,APWD,ECDMEM\n1005,3300,1.61\n1006,3310,1.62",
  "delimiter": ",",
  "hasHeader": true,
  "depthField": "depth",
  "fieldMappings": {
    "APWD": "mwdPressure",
    "ECDMEM": "ecd2"
  }
}
```

Rows alternative:

```json
{
  "sessionId": 11,
  "fileName": "memory-json",
  "rows": [
    { "depth": 1005, "APWD": 3300, "ECDMEM": 1.61 },
    { "depth": 1006, "APWD": 3310, "ECDMEM": 1.62 }
  ],
  "depthField": "depth",
  "fieldMappings": {
    "APWD": "mwdPressure",
    "ECDMEM": "ecd2"
  }
}
```

### GET /api/memory-files/:id
### GET /api/memory-files/:id/points

### POST /api/memory-files/:id/correlate

Dry run preview:

```json
{
  "sessionId": 11,
  "mode": "depth",
  "dryRun": true,
  "depthOffset": 0,
  "maxDepthDifference": 10,
  "fieldMappings": [
    { "source": "APWD", "target": "mwdPressure" },
    { "source": "ECDMEM", "target": "ecd2" }
  ]
}
```

Apply:

```json
{
  "sessionId": 11,
  "mode": "depth",
  "dryRun": false,
  "depthOffset": 0,
  "maxDepthDifference": 10,
  "fieldMappings": [
    { "source": "APWD", "target": "mwdPressure" }
  ]
}
```

Time mode:

```json
{
  "sessionId": 11,
  "mode": "time",
  "dryRun": true,
  "measuredAtOffsetMs": 0,
  "maxTimeDifferenceMs": 60000,
  "fieldMappings": [
    { "source": "APWD", "target": "mwdPressure" }
  ]
}
```

### GET /api/memory-files/correlations
### DELETE /api/memory-files/:id

## Depth Tracking / DTS

Depth tracking menyimpan state kedalaman aktif seperti bit depth, hole depth, block depth, dan ROP. Ini dipakai untuk tracking posisi drilling saat data realtime masuk.

### GET /api/depth-tracking/state

```http
GET /api/depth-tracking/state?sessionId=11
```

### GET /api/depth-tracking/samples

Query:

```txt
sessionId=11
measuredFrom=2026-05-14T00:00:00.000Z
measuredTo=2026-05-14T23:59:59.999Z
limit=100
```

### POST /api/depth-tracking/update

```json
{
  "sessionId": 11,
  "measuredAt": "2026-05-14T10:00:00.000Z",
  "bitDepth": 1000.5,
  "holeDepth": 1001.0,
  "blockDepth": 999.5,
  "rop": 25,
  "mode": "bit_depth",
  "status": "drilling",
  "source": "manual",
  "settings": {
    "note": "manual update"
  }
}
```

### POST /api/depth-tracking/recalculate

```json
{
  "sessionId": 11
}
```

## WITS Output Queue

This is backend queue only. Real physical Rig WITS serial writing is hardware phase.

### GET /api/wits-output/queue

Query:

```txt
sessionId=11
targetPort=rig
status=queued
witsId=0824
limit=50
```

### POST /api/wits-output/generate-from-latest

Queue output messages from latest MWD row based on WITS config flags.

```json
{
  "sessionId": 11
}
```

### PUT /api/wits-output/:id/status

```json
{
  "status": "sent",
  "reason": "written to rig port"
}
```

Allowed status:

```txt
queued, sent, failed, skipped
```

## Serial Port Manager

Use this only when backend runs on the local rig/server PC that has the ESP/LoRa plugged in. This will not work on Vercel because Vercel cannot see local COM ports.

Jika endpoint ini dipanggil di Vercel, scanning serial port bisa error karena Vercel tidak punya akses ke COM port lokal. Gunakan endpoint ini hanya di backend lokal, misalnya `http://localhost:5001`.

### GET /api/serial/ports

List available serial ports on the backend machine.

Example response:

```json
{
  "count": 1,
  "data": [
    {
      "path": "COM9",
      "manufacturer": "Silicon Labs",
      "serialNumber": "...",
      "vendorId": "10C4",
      "productId": "EA60"
    }
  ]
}
```

### POST /api/serial/connect

Open selected serial port and start ingesting WITS/MWD lines.

Supported realtime input format:

```txt
&&
01089545.00
0110945.00
!!
&&
071700
0824109516
071612.0
0836122.3
!!
```

The parser reads chunked serial data, buffers partial chunks, detects `&&` to `!!` blocks, parses the first 4 digits as `witsId`, stores the rest as raw value, and stores raw line/block metadata for debugging.

```json
{
  "path": "COM9",
  "baudRate": 115200,
  "sessionId": 11,
  "source": "esp32-serial",
  "transmitterId": "tx-1",
  "reconnectMs": 5000,
  "verbose": true
}
```

Response:

```json
{
  "message": "Serial gateway connect requested",
  "status": {
    "enabled": true,
    "connected": false,
    "reconnecting": false,
    "path": "COM9",
    "baudRate": 115200,
    "sessionId": 11,
    "source": "esp32-serial",
    "transmitterId": "tx-1",
    "lastLine": null,
    "lastPayload": null,
    "lastError": null,
    "signal": {
      "rssi": null,
      "snr": null,
      "sequence": null,
      "quality": "unknown",
      "lastUpdatedAt": null
    },
    "ingestedCount": 0,
    "ignoredCount": 0
  }
}
```

`connected` may still be `false` immediately after connect because serial open happens asynchronously. Poll status after clicking connect.

### GET /api/serial/status

Get current serial gateway state.

```json
{
  "enabled": true,
  "connected": true,
  "reconnecting": false,
  "path": "COM9",
  "baudRate": 115200,
  "sessionId": 11,
  "source": "esp32-serial",
  "transmitterId": "tx-1",
  "startedAt": "2026-05-14T12:00:00.000Z",
  "connectedAt": "2026-05-14T12:00:01.000Z",
  "lastReceivedAt": "2026-05-14T12:00:10.000Z",
  "lastIngestedAt": "2026-05-14T12:00:10.000Z",
  "lastLine": "SEQ=12|TS=100|0715,242.55|RX_TS=200|RSSI=-58|SNR=12.0",
  "lastPayload": "0715,242.55",
  "lastError": null,
  "signal": {
    "rssi": -58,
    "snr": 12,
    "sequence": "12",
    "quality": "good",
    "lastUpdatedAt": "2026-05-14T12:00:10.000Z"
  },
  "ingestedCount": 1,
  "ignoredCount": 0
}
```

### POST /api/serial/disconnect

Close current serial port and stop automatic reconnect.

## ESP WebSocket Monitor

Use this when backend also connects to the ESP WebSocket gateway. This status is separate from serial status.

### GET /api/esp-ws/status

```json
{
  "enabled": true,
  "connected": true,
  "reconnecting": false,
  "url": "ws://192.168.137.243:81",
  "sessionId": 11,
  "source": "esp32-websocket",
  "transmitterId": "tx-1",
  "startedAt": "2026-05-14T12:00:00.000Z",
  "connectedAt": "2026-05-14T12:00:01.000Z",
  "lastReceivedAt": "2026-05-14T12:00:10.000Z",
  "lastIngestedAt": "2026-05-14T12:00:10.000Z",
  "lastMessageType": "raw",
  "lastRawMessage": "SEQ=12|0715,242.55|RSSI=-58|SNR=12.0",
  "lastPayload": "0715,242.55",
  "lastError": null,
  "signal": {
    "rssi": -58,
    "snr": 12,
    "sequence": "12",
    "quality": "good",
    "lastUpdatedAt": "2026-05-14T12:00:10.000Z"
  },
  "ingestedCount": 1,
  "ignoredCount": 0
}
```

Signal quality is calculated only for live monitoring:

```txt
good : RSSI above -80 and SNR >= 7
fair : RSSI above -95 or SNR >= 3
poor : RSSI <= -95 or SNR < 3
```

## System Utilities / Clear Data

Admin only. This is the backend version of Polaris `System Utilities -> Clear Data`.

### GET /api/system-utilities/clear-data/targets

List clearable operational data targets.

```json
{
  "data": [
    "mwd_data",
    "wits_values",
    "wits_alarms",
    "surveys",
    "depth_tracking",
    "wits_output",
    "edit_history"
  ]
}
```

### POST /api/system-utilities/clear-data/preview

Preview affected counts before deleting anything.

```json
{
  "sessionId": 11,
  "startDepth": 0,
  "endDepth": 99999,
  "targets": [
    "mwd_data",
    "wits_values",
    "wits_alarms",
    "surveys",
    "depth_tracking",
    "wits_output",
    "edit_history"
  ]
}
```

Response includes `requiredConfirm`, for example:

```json
{
  "message": "Clear data preview",
  "requiredConfirm": "CLEAR_DATA_SESSION_11",
  "counts": {
    "mwd_data": 10,
    "wits_values": 20
  }
}
```

### POST /api/system-utilities/backup-session

Generate JSON backup before clearing data. FE can download/save the `backup` object as a `.json` file.

Backend tidak menyimpan backup ini ke database. FE harus mengambil `response.backup`, lalu menyimpannya sebagai file lokal `.json`.

```json
{
  "sessionId": 11,
  "startDepth": 0,
  "endDepth": 99999,
  "targets": ["mwd_data", "wits_values", "surveys", "depth_tracking"]
}
```

### POST /api/system-utilities/clear-data

Deletes selected data for one session/job. This also returns a `backup` object in the response.

```json
{
  "sessionId": 11,
  "startDepth": 0,
  "endDepth": 99999,
  "targets": ["mwd_data", "wits_values", "surveys", "depth_tracking"],
  "confirm": "CLEAR_DATA_SESSION_11"
}
```

### POST /api/system-utilities/restore-session

Restore from backup JSON generated by `backup-session` or `clear-data`.

`backup` tidak boleh `{}` kosong. Isinya harus object backup asli dari response `backup-session` atau file `.json` backup lokal yang dibaca FE.

```json
{
  "sessionId": 11,
  "replaceExisting": true,
  "targets": ["mwd_data", "wits_values", "surveys", "depth_tracking"],
  "backup": {
    "version": 1,
    "createdAt": "2026-05-15T00:00:00.000Z",
    "sessionId": 11,
    "depthRange": { "startDepth": 0, "endDepth": 99999 },
    "targets": ["mwd_data"],
    "data": {}
  },
  "confirm": "RESTORE_DATA_SESSION_11"
}
```

Recommended flow:

```txt
1. Preview clear data
2. Backup session and let user download JSON to local file
3. Clear data with confirmation
4. Restore later from the saved local backup JSON if needed
```

## System Utilities / Configuration Backup

Admin only. This backs up and restores application configuration, not job/session data.

### GET /api/system-utilities/config-backup/targets

```json
{
  "data": ["wits_configs", "plot_templates"]
}
```

### POST /api/system-utilities/config-backup

Generate configuration backup JSON. FE can download/save the `backup` object.

```json
{
  "targets": ["wits_configs", "plot_templates"]
}
```

Response includes:

```json
{
  "message": "Configuration backup generated",
  "counts": {
    "wits_configs": 80,
    "plot_templates": 1
  },
  "backup": {
    "version": 1,
    "type": "configuration_backup",
    "createdAt": "2026-05-15T00:00:00.000Z",
    "targets": ["wits_configs", "plot_templates"],
    "data": {}
  }
}
```

### POST /api/system-utilities/config-restore

Restore WITS config and plot templates from backup JSON. Existing records are upserted by WITS ID or template name.

```json
{
  "targets": ["wits_configs", "plot_templates"],
  "backup": {
    "version": 1,
    "type": "configuration_backup",
    "createdAt": "2026-05-15T00:00:00.000Z",
    "targets": ["wits_configs", "plot_templates"],
    "data": {}
  },
  "confirm": "RESTORE_CONFIGURATION"
}
```

## Connection Status

### GET /api/connection-status
### POST /api/connection-status

```json
{
  "source": "esp32-serial",
  "status": "connected",
  "description": "Serial connected to COM9"
}
```

### GET /api/connection-status/:id
### PUT /api/connection-status/:id
### DELETE /api/connection-status/:id

## Failover Events

### GET /api/failover-events
### POST /api/failover-events

```json
{
  "source": "esp32-serial",
  "eventType": "serial_disconnect",
  "description": "COM9 disconnected"
}
```

### GET /api/failover-events/:id
### PUT /api/failover-events/:id
### DELETE /api/failover-events/:id

## Gateway Ingest

Hardware/backend service can use this endpoint without user JWT. It needs gateway key.

Header:

```http
x-gateway-key: <GATEWAY_API_KEY>
```

### POST /api/gateway/mwd-data

```json
{
  "sessionId": 11,
  "wits": {
    "0715": 242.55
  }
}
```

or:

```json
{
  "sessionId": 11,
  "raw": "SEQ=12|TS=100|0715,242.55|RX_TS=200|RSSI=-58|SNR=12.0"
}
```

## Email Reports

Currently disabled by default with feature flag.

If `EMAIL_REPORTS_ENABLED=true`:

```txt
POST /api/reports/email/test
POST /api/reports/email/send
GET  /api/reports/email/logs
```

If disabled, these return `503`.

## Recommended FE Test Order

1. Login: `POST /api/auth/login`
2. Load sessions: `GET /api/mwd-sessions`
3. Load monitoring data: `GET /api/mwd-data?sessionId=11`
4. Load WITS config: `GET /api/wits-config`
5. Load WITS value by ID: `GET /api/wits-data-values?sessionId=11&witsId=0715&limit=20`
6. Load survey: `GET /api/surveys?sessionId=11&stationType=actual`
7. Load plot template: `GET /api/plot-templates/default`
8. Test exports: `POST /api/exports/las`, `POST /api/exports/pdf-plot`
9. Test edit tools with preview GET first, then POST apply.
10. Local hardware only: list serial ports, connect COM port, then poll serial status.
11. WebSocket hardware only: poll `GET /api/esp-ws/status`.

## Notes for Frontend

- Dates from backend are UTC ISO strings ending with `Z`. Convert to local timezone in UI.
- BigInt IDs are returned as strings in JSON.
- Decimal fields may return as strings from Prisma/PostgreSQL.
- `depthMd` is Bit Depth (`0108`).
- `hole_depth` is Hole Depth (`0110`).
- Hidden MWD data is excluded by default. Use `includeHidden=true` if needed.
- Hardware serial/LoRa behavior is not required for FE testing; FE can use Postman/manual data or existing seeded data.
