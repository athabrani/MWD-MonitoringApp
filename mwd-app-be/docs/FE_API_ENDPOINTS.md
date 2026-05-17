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
  "field": "Field Name",
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

Main monitoring data table. This is what FE usually plots.

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

Configuration editor for WITS IDs.

### GET /api/wits-config

List all WITS IDs and config.

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

Raw/configured WITS values stored by WITS ID.

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

## Surveys

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

Generate survey stations from MWD data rows with depth, inc, azimuth.

```json
{
  "sessionId": 11,
  "stationType": "actual",
  "verticalSectionAzimuth": 90,
  "replaceExisting": true
}
```

### POST /api/surveys/recalculate

Recalculate projection values.

```json
{
  "sessionId": 11,
  "stationType": "actual",
  "verticalSectionAzimuth": 90
}
```

### POST /api/surveys/import-csv

Import well plan survey CSV.

```json
{
  "sessionId": 11,
  "stationType": "plan",
  "verticalSectionAzimuth": 90,
  "csv": "1000,12.3,240.1\n1001.2,13.4,241.5"
}
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

### POST /api/wits-output/queue-latest

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
2. Backup session and let user download JSON
3. Clear data with confirmation
4. Restore later from the saved backup JSON if needed
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
