# Central Server Security Notes

Update 2026-06-29: operational central server is READY with cookie-based auth and no 401 after login on the configured server. PostgreSQL must remain unexposed to LAN clients. Firewall status is unchanged in the final deployment record. See `docs/deployment/CENTRAL_SERVER_FINAL_DEPLOYMENT_GUIDE.md` for current deployment status.

## Network exposure

Do not expose PostgreSQL to user laptops. Keep this flow:

```text
User -> Frontend -> Backend -> PostgreSQL
```

Do not use this flow:

```text
User -> PostgreSQL
```

## Env and secrets

- Do not commit `.env` files containing secrets.
- Do not print database passwords, JWT secrets, gateway keys, or admin passwords.
- Do not use `.env.testing`, port `5002`, frontend port `3002`, or database `mwd_test` for production/local server deployment.
- Rebuild the frontend after changing any `NEXT_PUBLIC_*` values because they are build-time variables.
- In production runtime, `GATEWAY_API_KEY` must be at least 32 characters when configured.
- `AUTH_EXPOSE_TOKEN` must be disabled in production.
- Do not print actual secret values in terminal output, logs, package output, or deployment reports.

## CORS

Set `CORS_ORIGIN` explicitly for production/local server origins:

```env
CORS_ORIGIN=http://127.0.0.1:3000,http://localhost:3000,http://192.168.1.10:3000
```

Avoid unrestricted CORS for production. Cookie-based auth requires:

- `credentials: true` in backend CORS options;
- explicit origins, not wildcard `*`;
- the active frontend LAN origin, for example `http://192.168.18.75:3000`.

## Cookie Auth

Production/local central deployment uses cookie auth by default:

- `AUTH_EXPOSE_TOKEN=false`
- login response may contain `authMode: "cookie"` without a token in the response body;
- frontend requests to the backend must use `credentials: "include"`;
- mutating cookie-auth requests must include `x-csrf-token`;
- do not manually store or print JWT cookies.

For HTTP local/LAN deployment, cookie settings should be:

```env
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=Lax
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

Use `AUTH_COOKIE_SECURE=true` only after serving the app over HTTPS. Do not set an explicit cookie domain for IP-based LAN deployment unless there is a validated DNS/hostname plan.

## Firewall

Firewall changes are dry-run by default:

```powershell
.\scripts\configure-central-firewall.ps1 -DryRun
```

Apply only with explicit confirmation:

```powershell
.\scripts\configure-central-firewall.ps1 -ConfirmApply
```

The firewall script does not open port `5432`.

## Backup

Backups may contain sensitive operational data. Store database dumps in a restricted folder and copy them to external storage controlled by the operation team.
