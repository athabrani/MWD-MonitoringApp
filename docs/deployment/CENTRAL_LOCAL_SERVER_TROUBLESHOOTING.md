# Central Local Server Troubleshooting

This file tracks LAN/local runtime issues specific to the central server deployment. The broader troubleshooting guide is `CENTRAL_SERVER_TROUBLESHOOTING.md`.

## Login returns 200 but UI shows request failed

Cause:

The backend is using cookie auth. A valid response can include `user`, `csrfToken`, and `authMode: "cookie"` without returning `token` or `accessToken`.

Fix:

- keep `AUTH_EXPOSE_TOKEN=false`;
- frontend login must use `credentials: "include"`;
- frontend must accept `authMode: "cookie"` without requiring a token in the response body;
- authenticated API calls must use `credentials: "include"`;
- mutating requests must send `x-csrf-token`;
- backend CORS must use `credentials: true` and explicit origins;
- HTTP LAN deployment should use `AUTH_COOKIE_SECURE=false` and `AUTH_COOKIE_SAME_SITE=Lax`.

For IP-based access, use a single browser origin consistently, for example:

```text
http://192.168.18.75:3000
```

If login succeeds but the next request is unauthorized, check whether the browser stored the auth cookie and whether later requests include cookies.
