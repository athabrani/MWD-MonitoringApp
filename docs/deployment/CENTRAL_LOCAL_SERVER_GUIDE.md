# Central Local Server Guide

Update 2026-06-29: LocalOnly runtime, LAN runtime, LAN access dari device lain, cookie-based auth, login, dan dashboard sudah READY pada central local server yang dikonfigurasi.

Status final:

```text
Operational deployment on the configured central local server: READY.
Admin-assisted installer pipeline: READY.
Installer release status: RELEASE CANDIDATE.
Final stable installer status: pending clean-machine installation test.
```

Dokumen final utama: `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md`.

## Architecture

MWD Monitoring App production/local deployment uses one central server:

```text
User browser -> Frontend web service -> Backend API/WebSocket -> PostgreSQL
                                      -> Receiver/Gateway MWD-WITS
```

The server can be an industrial PC or the main laptop. It runs PostgreSQL, backend, frontend, receiver/gateway, logs, and backups. The server can also open the app locally.

Other laptops are UI clients only. They open the server URL in a browser or app-mode shortcut.

## Why not install database on every laptop

Do not install full Level 3 on every user laptop. Multiple databases fragment active sessions, historical data, export data, roles, and WITS records. A single database gives all users the same source of truth.

## Why receiver only runs on the server

Receiver/WITS input must have one operational source. Running gateway/receiver on multiple laptops risks duplicate packets, inconsistent active session mapping, and conflicting historical records.

## Env files

Operational env files:

- Backend: `mwd-app-be/.env`
- Frontend: `mwd-app-fe/.env`

Ignored for central local server runtime:

- `mwd-app-fe/.env.local`
- `mwd-app-fe/.env.testing`
- `mwd-app-be/.env.testing`
- `.env.example` files

Central start/package scripts temporarily move `mwd-app-fe/.env.local` aside during frontend build/start and restore it afterward, so operational central builds use `mwd-app-fe/.env`.

Current deployment/package branch:

```text
package
```

## LocalOnly vs LAN

LocalOnly is for the server laptop itself:

```text
Frontend URL : http://127.0.0.1:3000
Backend URL  : http://127.0.0.1:5001
Backend host : 127.0.0.1
Frontend host: 127.0.0.1
```

LAN mode is for other laptops on the same network:

```text
Frontend URL : http://192.168.18.75:3000
Backend URL  : http://192.168.18.75:5001
Backend host : 0.0.0.0
Frontend host: 0.0.0.0
```

Do not mix these modes. `NEXT_PUBLIC_*` values are compiled into the frontend build, so regenerate env and rebuild whenever switching modes.

## Start local-only

```powershell
npm run central:env:local
npm run central:start:local:build
npm run central:check:local
```

Server opens:

```text
http://127.0.0.1:3000
```

## Start LAN mode

Set frontend env before build:

```env
NEXT_PUBLIC_API_BASE_URL=http://<SERVER_HOST>:5001
NEXT_PUBLIC_API_URL=http://<SERVER_HOST>:5001
NEXT_PUBLIC_WS_URL=ws://<SERVER_HOST>:5001/ws
```

Dry-run LAN env generation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-central-env.ps1 -LanMode -ServerHost <SERVER_HOST> -DryRun
```

Apply only after confirming the server IP/hostname:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-central-env.ps1 -LanMode -ServerHost <SERVER_HOST> -Apply
```

The apply mode backs up existing `mwd-app-be/.env` and `mwd-app-fe/.env` first. It does not touch `.env.local`, `.env.testing`, or `.env.example`.

Set backend CORS:

```env
CORS_ORIGIN=http://127.0.0.1:3000,http://localhost:3000,http://<SERVER_HOST>:3000
```

Then run:

```powershell
npm run central:env:lan
npm run central:start:lan:build
npm run central:check:lan
```

Client laptops open:

```text
http://<SERVER_HOST>:3000
```

If the frontend opens through the server IP but login fails with `ERR_CONNECTION_REFUSED` to `http://<SERVER_HOST>:5001/api/auth/login`, the backend is not reachable on the LAN interface. Verify the backend is started with `HOST=0.0.0.0` and `BACKEND_HOST=0.0.0.0`, then check binding:

```powershell
netstat -ano -p tcp | Select-String ':5001|:3000'
```

Do not expose PostgreSQL to the LAN. The intended path stays:

```text
User browser -> Frontend -> Backend -> PostgreSQL
```

## Check readiness

```powershell
npm run central:check:local
npm run central:check:lan
```

## Final LAN readiness

Validated LAN URL:

```text
http://192.168.18.75:3000
```

IP server harus stabil. Gunakan DHCP reservation atau static IP. Jika IP berubah, generate LAN env ulang dan rebuild frontend sebelum digunakan oleh client device.

Jangan expose PostgreSQL port `5432` ke LAN clients.
