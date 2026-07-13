# Native WebSocket Implementation for MWD Monitoring App

Backend realtime channel menggunakan native WebSocket melalui package `ws`.
Frontend cukup memakai API `WebSocket` bawaan browser.

## Connection URL

Local:

```txt
ws://localhost:5001/ws
```

Production dengan HTTPS:

```txt
wss://<backend-domain>/ws
```

## Message Format

Semua pesan dari backend dikirim sebagai JSON string dengan format:

```json
{
  "event": "mwd-data",
  "payload": {},
  "timestamp": "2026-05-27T00:00:00.000Z"
}
```

## Events From Backend

```txt
connected          = dikirim saat FE berhasil connect
pong               = response dari event ping
mwd-data           = data MWD terbaru
connection-status  = status koneksi sistem
esp-gateway-status = status gateway ESP WebSocket
wits-data          = data WITS terbaru
alert              = alarm/notifikasi
error              = error message
```

## Events From Frontend

Ping:

```json
{
  "event": "ping",
  "payload": {}
}
```

Request latest data:

```json
{
  "event": "request-latest-data",
  "payload": {
    "sessionId": 5
  }
}
```

Catatan: event `request-latest-data` sudah diterima oleh WebSocket service.
Jika FE membutuhkan response latest data penuh via WS, tambahkan listener di backend
yang membaca data terbaru dari database lalu mengirim event balik ke client.

## Frontend Usage

Contoh implementasi ada di:

```txt
docs/NATIVE_WS_CLIENT_EXAMPLE.js
```

## Backend Source

```txt
src/services/websocket.service.ts
src/server.ts
```

Backend menginisialisasi WebSocket di HTTP server yang sama dengan Express, dengan path `/ws`.
