# IP-Based Client Access Guide

## Find server IP

On the server:

```powershell
ipconfig
```

Use the IPv4 address of the active LAN/Wi-Fi adapter, for example:

```text
192.168.1.10
```

If more than one IP appears, choose the active rig LAN/Wi-Fi/Ethernet interface. Do not permanently hardcode an uncertain IP; pass it as `-ServerHost` first and validate with the check script.

Client URL:

```text
http://192.168.1.10:3000
```

## Switch to LAN mode

On the server, use the LAN command set. Do not use LocalOnly commands for client laptop access.

```powershell
npm run central:stop
npm run central:env:lan
npm run central:start:lan:build
npm run central:check:lan
```

Expected binding:

```text
Backend  : 0.0.0.0:5001
Frontend : 0.0.0.0:3000
```

If the app is only for the server laptop, switch back to LocalOnly:

```powershell
npm run central:stop
npm run central:env:local
npm run central:start:local:build
npm run central:check:local
```

Current validated candidate on this machine:

```text
192.168.18.75
```

Use it only while the Wi-Fi adapter keeps that address. If DHCP changes it, regenerate LAN env with the new server IP and rebuild frontend.

## Create server shortcut

```powershell
.\scripts\create-central-shortcut.ps1 -AppUrl "http://127.0.0.1:3000" -Desktop -StartMenu
```

## Create user shortcut

On the user laptop, run the shortcut script if the repository/package script is available, or create a shortcut manually to:

```text
msedge.exe --app=http://192.168.1.10:3000
```

Script example:

```powershell
.\scripts\create-central-shortcut.ps1 -AppUrl "http://192.168.1.10:3000" -Desktop
```

## Static IP and hostname

Use a static IP reservation on the router or IT-managed DHCP reservation for the server. A local hostname such as `mwd-monitoring.local` is acceptable if DNS/mDNS is reliable on the rig network.

## Troubleshooting

- If the page does not open, check that the server frontend is running on port `3000`.
- If the page opens but data does not load, check `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WS_URL`, and backend CORS.
- If only the server can open the page, check Windows firewall and LAN profile.
- Do not expose PostgreSQL port `5432` to client laptops.

### Login calls `192.168.x.x:5001` but returns `ERR_CONNECTION_REFUSED`

Problem:

```text
http://192.168.x.x:5001/api/auth/login ERR_CONNECTION_REFUSED
```

Cause:

The frontend is using the correct LAN API URL, but the backend is not listening on the LAN interface. It is usually still bound to `127.0.0.1`, not running, or blocked by an old local-only process.

Fix:

1. Stop the central app:

```powershell
npm run central:stop
```

2. If `central:stop` reports a remaining listener that was not started from a central PID file, close that process manually before switching LocalOnly/LAN mode.

3. Generate LAN env and rebuild frontend:

```powershell
.\scripts\generate-central-env.ps1 -ServerHost 192.168.18.75 -Apply
npm run central:frontend:build
```

4. Start LAN mode:

```powershell
.\scripts\start-central-server.ps1 -LanMode -ServerHost 192.168.18.75
```

5. Verify backend and frontend bindings:

```powershell
netstat -ano -p tcp | Select-String ':5001|:3000'
```

The backend should listen on `0.0.0.0:5001` or `192.168.18.75:5001`. The frontend should listen on `0.0.0.0:3000` or `192.168.18.75:3000`. If another laptop still cannot access it after bindings are correct, the next likely blocker is Windows Firewall.

### Login returns `200 OK` but the UI still shows a failed request

For central LAN deployment, backend login uses HTTP-only cookies. A valid login response can use:

```json
{
  "user": {},
  "csrfToken": "...",
  "authMode": "cookie"
}
```

The response body should not expose the JWT when `AUTH_EXPOSE_TOKEN=false`. Frontend requests must therefore use browser cookies:

- login request: `credentials: "include"`;
- authenticated API requests: `credentials: "include"`;
- mutating requests: include `x-csrf-token`;
- backend CORS: `credentials: true` and explicit origins;
- HTTP LAN cookie config: `AUTH_COOKIE_SECURE=false`, `AUTH_COOKIE_SAME_SITE=Lax`.

If the cookie is not stored, check the browser Network tab for `Set-Cookie`, then verify secure/sameSite/domain attributes and CORS credentials.
