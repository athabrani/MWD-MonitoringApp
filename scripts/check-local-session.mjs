const backendUrl = (process.env.E2E_API_URL || process.env.BACKEND_URL || "http://localhost:5002").replace(/\/+$/, "");
const frontendUrl = (process.env.E2E_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3002").replace(/\/+$/, "");
const frontendOrigin = (process.env.E2E_FRONTEND_ORIGIN || frontendUrl).replace(/\/+$/, "");

const failures = [];

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function recordFailure(check, error) {
  const message = error instanceof Error ? error.message : String(error);
  failures.push({ check, message });
  console.error(`[FAIL] ${check}: ${message}`);
}

async function checkBackendReadiness() {
  const response = await fetchWithTimeout(`${backendUrl}/api/readiness`);
  if (!response.ok) {
    throw new Error(`readiness returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.database?.connected !== true) {
    throw new Error("database is not connected");
  }

  console.log(`[OK] Backend readiness: ${backendUrl}`);
  console.log(`[OK] Database: ${payload.database.name ?? "unknown"}`);
}

async function checkCors() {
  const response = await fetchWithTimeout(`${backendUrl}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: frontendOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  const allowOrigin = response.headers.get("access-control-allow-origin");
  if (!response.ok || allowOrigin !== frontendOrigin) {
    throw new Error(`preflight status=${response.status}, allow-origin=${allowOrigin ?? "missing"}`);
  }

  console.log(`[OK] CORS preflight: ${frontendOrigin}`);
}

async function checkFrontend() {
  const response = await fetchWithTimeout(frontendUrl);
  if (!response.ok) {
    throw new Error(`frontend returned HTTP ${response.status}`);
  }

  console.log(`[OK] Frontend readiness: ${frontendUrl}`);
}

async function checkAuthEndpoint() {
  const response = await fetchWithTimeout(`${backendUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: frontendOrigin,
    },
    body: JSON.stringify({
      identifier: "admin",
      password: "wrong-password-for-check",
    }),
  });

  if (response.status >= 500) {
    throw new Error(`auth endpoint returned HTTP ${response.status}`);
  }

  console.log(`[OK] Auth endpoint reachable: HTTP ${response.status}`);
}

for (const [name, check] of [
  ["backend readiness", checkBackendReadiness],
  ["CORS preflight", checkCors],
  ["frontend readiness", checkFrontend],
  ["auth endpoint", checkAuthEndpoint],
]) {
  try {
    await check();
  } catch (error) {
    recordFailure(name, error);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("Local session is not ready.");
  console.error(`Backend : ${backendUrl}`);
  console.error(`Frontend: ${frontendUrl}`);
  process.exit(1);
}

console.log("");
console.log("Local session ready.");
console.log(`Backend : ${backendUrl}`);
console.log(`Frontend: ${frontendUrl}`);
