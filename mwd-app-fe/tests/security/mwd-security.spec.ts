import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

const fs = (process as any).getBuiltinModule("fs") as typeof import("node:fs");

type ResultStatus = "PASS" | "FAIL" | "N/A";
type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";

type SecurityCaseResult = {
  id: string;
  category: string;
  title: string;
  endpoint: string;
  method: string;
  role: string;
  expected: string;
  actualStatus: number | string;
  result: ResultStatus;
  severityIfFailed: Severity;
  evidence: string;
  remediation: string;
};

const repoRoot = process.cwd().replace(/[\\/]mwd-app-fe$/, "");
const outputDir = `${repoRoot}\\tests\\results\\security`;
const rawDir = `${outputDir}\\raw`;
const evidenceDir = `${outputDir}\\evidence`;
const rawResultsPath = `${rawDir}\\playwright-security-cases.json`;
const casesCsvPath = `${outputDir}\\security-test-cases.csv`;

const API_URL = process.env.E2E_API_URL || "http://localhost:5002";
const FRONTEND_URL = process.env.E2E_BASE_URL || "http://localhost:3002";
const ACTIVE_SESSION_ID = Number(process.env.E2E_ACTIVE_SESSION_ID || "1");
const ACTIVE_SESSION_NAME = process.env.E2E_ACTIVE_SESSION_NAME || "TEST-MWD-001";

const results: SecurityCaseResult[] = [];

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for security testing.`);
  }
  return value;
}

function apiPath(route: string) {
  return `${API_URL}${route}`;
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function writeResults() {
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(rawResultsPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  const header = [
    "id",
    "category",
    "title",
    "endpoint",
    "method",
    "role",
    "expected",
    "actual_status",
    "result",
    "severity_if_failed",
    "evidence",
    "remediation",
  ];
  const rows = results.map((item) =>
    [
      item.id,
      item.category,
      item.title,
      item.endpoint,
      item.method,
      item.role,
      item.expected,
      item.actualStatus,
      item.result,
      item.severityIfFailed,
      item.evidence,
      item.remediation,
    ].map(csvValue).join(","),
  );
  fs.writeFileSync(casesCsvPath, [header.join(","), ...rows].join("\n"));
}

function record(input: SecurityCaseResult) {
  results.push(input);
  writeResults();
}

function noSensitiveText(text: string) {
  const lowered = text.toLowerCase();
  return ![
    "jwt_secret",
    "gateway_api_key",
    "gateway_hmac_secret",
    "database_url",
    "passwordhash",
    "bearer ",
    "prisma.",
    "node_modules",
    "c:\\",
  ].some((needle) => lowered.includes(needle));
}

async function textOf(response: { text(): Promise<string> }) {
  return await response.text().catch(() => "");
}

async function jsonOf(response: { json(): Promise<unknown> }) {
  return await response.json().catch(() => null);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function loginToken(request: APIRequestContext, username: string, password: string) {
  const response = await request.post(apiPath("/api/auth/login"), {
    data: { identifier: username, password },
    failOnStatusCode: false,
  });
  const body = (await jsonOf(response)) as { token?: string } | null;
  if (response.status() !== 200 || typeof body?.token !== "string") {
    throw new Error(`Unable to acquire ${username} test token. Status ${response.status()}.`);
  }
  return body.token;
}

function gatewayHeaders(payload: Record<string, unknown>, options: { key?: string; hmac?: string; timestamp?: string; signature?: string } = {}) {
  const key = options.key ?? requiredEnv("E2E_GATEWAY_API_KEY");
  const hmacSecret = options.hmac ?? process.env.E2E_GATEWAY_HMAC_SECRET ?? "";
  const timestamp = options.timestamp ?? String(Date.now());
  const headers: Record<string, string> = {
    "x-gateway-key": key,
  };

  if (options.signature !== undefined) {
    headers["x-gateway-timestamp"] = timestamp;
    headers["x-gateway-signature"] = options.signature;
    return headers;
  }

  if (hmacSecret) {
    headers["x-gateway-timestamp"] = timestamp;
    headers["x-gateway-signature"] = createHmac("sha256", hmacSecret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex");
  }

  return headers;
}

function gatewayPayload(sequence: string) {
  return {
    sessionId: ACTIVE_SESSION_ID,
    measuredAt: new Date(Date.UTC(2026, 5, 15, 0, 0, 0)).toISOString(),
    depthMd: 1900 + Math.random(),
    hole_depth: 1902,
    inclination: 11.2,
    azimuth: 140.5,
    gammaRay: 88.1,
    gatewaySequence: sequence,
  };
}

let adminToken = "";
let engineerToken = "";
let operatorToken = "";
let testPassword = "";

test.beforeAll(async ({ playwright }) => {
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  results.splice(0, results.length);
  writeResults();

  testPassword = process.env.E2E_TEST_PASSWORD || process.env.E2E_ENGINEER_PASSWORD || "";
  if (!testPassword) {
    throw new Error("E2E_TEST_PASSWORD or E2E_ENGINEER_PASSWORD is required.");
  }

  const loginWithFreshContext = async (username: string) => {
    const request = await playwright.request.newContext();
    try {
      return await loginToken(request, username, testPassword);
    } finally {
      await request.dispose();
    }
  };

  adminToken = await loginWithFreshContext(process.env.E2E_ADMIN_USERNAME || "admin_test");
  engineerToken = await loginWithFreshContext(process.env.E2E_ENGINEER_USERNAME || "engineer_test");
  operatorToken = await loginWithFreshContext(process.env.E2E_OPERATOR_USERNAME || "operator_test");
});

test.afterAll(() => {
  writeResults();
});

test("SEC-01 API without token is rejected", async ({ request }) => {
  const endpoints = ["/api/auth/me", "/api/mwd-sessions", "/api/mwd-data", "/api/historical-data", "/api/audit-logs"];
  const statuses: number[] = [];
  for (const endpoint of endpoints) {
    const response = await request.get(apiPath(endpoint), { failOnStatusCode: false });
    statuses.push(response.status());
  }
  const passed = statuses.every((status) => status === 401);
  record({
    id: "SEC-01",
    category: "Authentication",
    title: "API without token is rejected",
    endpoint: endpoints.join(";"),
    method: "GET",
    role: "anonymous",
    expected: "401 Unauthorized for protected endpoints",
    actualStatus: statuses.join(";"),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Statuses: ${statuses.join(", ")}`,
    remediation: "Apply authenticate middleware to all protected routes.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-02 malformed token is rejected", async ({ request }) => {
  const response = await request.get(apiPath("/api/auth/me"), {
    headers: authHeaders("invalid-token"),
    failOnStatusCode: false,
  });
  record({
    id: "SEC-02",
    category: "Authentication",
    title: "Malformed token is rejected",
    endpoint: "/api/auth/me",
    method: "GET",
    role: "malformed-token",
    expected: "401",
    actualStatus: response.status(),
    result: response.status() === 401 ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()}`,
    remediation: "Reject malformed bearer tokens in auth middleware.",
  });
  expect(response.status()).toBe(401);
});

test("SEC-03 modified token is rejected", async ({ request }) => {
  const modifiedToken = `${engineerToken.slice(0, -1)}x`;
  const response = await request.get(apiPath("/api/auth/me"), {
    headers: authHeaders(modifiedToken),
    failOnStatusCode: false,
  });
  record({
    id: "SEC-03",
    category: "Authentication",
    title: "Modified token is rejected",
    endpoint: "/api/auth/me",
    method: "GET",
    role: "tampered-token",
    expected: "401",
    actualStatus: response.status(),
    result: response.status() === 401 ? "PASS" : "FAIL",
    severityIfFailed: "Critical",
    evidence: `Status ${response.status()} for one-character token modification`,
    remediation: "Verify JWT signature and reject tampered tokens.",
  });
  expect(response.status()).toBe(401);
});

test("SEC-04 account enumeration does not occur", async ({ request }) => {
  const invalidA = await request.post(apiPath("/api/auth/login"), {
    data: { identifier: `missing_${Date.now()}`, password: "wrong-password" },
    failOnStatusCode: false,
  });
  const invalidB = await request.post(apiPath("/api/auth/login"), {
    data: { identifier: "engineer_test", password: "wrong-password" },
    failOnStatusCode: false,
  });
  const bodyA = (await jsonOf(invalidA)) as { message?: string } | null;
  const bodyB = (await jsonOf(invalidB)) as { message?: string } | null;
  const passed = invalidA.status() === invalidB.status() && bodyA?.message === bodyB?.message;
  record({
    id: "SEC-04",
    category: "Authentication",
    title: "Account enumeration does not occur",
    endpoint: "/api/auth/login",
    method: "POST",
    role: "anonymous",
    expected: "Same status and generic message",
    actualStatus: `${invalidA.status()};${invalidB.status()}`,
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Messages equivalent: ${bodyA?.message === bodyB?.message}`,
    remediation: "Return identical generic login failures.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-06 operator cannot access admin UI", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill("operator_test");
  await page.getByTestId("login-password").fill(testPassword);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  const adminMenuCount = await page.getByText(/^Admin$/).count();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mwd:navigate-page", { detail: { page: "admin" } }));
  });
  const denied = await page.getByText(/access denied|not authorized|permission/i).first().isVisible().catch(() => false);
  const passed = adminMenuCount === 0 || denied;
  record({
    id: "SEC-06",
    category: "Authorization and RBAC",
    title: "Operator cannot access admin UI",
    endpoint: "/admin",
    method: "UI",
    role: "operator",
    expected: "Admin menu hidden or direct admin view denied",
    actualStatus: passed ? "denied" : "visible",
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Admin menu count ${adminMenuCount}; denied view ${denied}`,
    remediation: "Hide and block admin UI for operator role.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-07 operator cannot access admin API", async ({ request }) => {
  const endpoints = ["/api/users", "/api/audit-logs"];
  const statuses: number[] = [];
  for (const endpoint of endpoints) {
    const response = await request.get(apiPath(endpoint), {
      headers: authHeaders(operatorToken),
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }
  const passed = statuses.every((status) => status === 403);
  record({
    id: "SEC-07",
    category: "Authorization and RBAC",
    title: "Operator cannot access admin API",
    endpoint: endpoints.join(";"),
    method: "GET",
    role: "operator",
    expected: "403",
    actualStatus: statuses.join(";"),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Statuses: ${statuses.join(", ")}`,
    remediation: "Restrict admin APIs to authorized roles.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-08 engineer cannot run admin-only operation", async ({ request }) => {
  const response = await request.post(apiPath("/api/users"), {
    headers: authHeaders(engineerToken),
    data: {
      roleId: 1,
      username: `security_engineer_forbidden_${Date.now()}`,
      email: `security_engineer_forbidden_${Date.now()}@mwd.local`,
      password: "TestPassword123!",
    },
    failOnStatusCode: false,
  });
  record({
    id: "SEC-08",
    category: "Authorization and RBAC",
    title: "Engineer cannot run admin-only operation",
    endpoint: "/api/users",
    method: "POST",
    role: "engineer",
    expected: "403",
    actualStatus: response.status(),
    result: response.status() === 403 ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()}`,
    remediation: "Restrict user management writes to admin role.",
  });
  expect(response.status()).toBe(403);
});

test("SEC-09 IDOR session is evaluated against available model", async () => {
  record({
    id: "SEC-09",
    category: "Session and data isolation",
    title: "IDOR session denied for unauthorized session",
    endpoint: "/api/mwd-data;/api/historical-data;/api/exports/historical",
    method: "GET/POST",
    role: "engineer/operator",
    expected: "403 or 404 for session outside user's authorization",
    actualStatus: "N/A",
    result: "N/A",
    severityIfFailed: "High",
    evidence: "Seeded testing roles are intentionally permitted to view all seeded sessions by canViewAllSessions(). No unauthorized seeded session exists.",
    remediation: "Add a least-privileged user/session fixture before testing true owner-only IDOR behavior.",
  });
});

test("SEC-10 cross-session data isolation by filter", async ({ request }) => {
  const response = await request.get(apiPath("/api/historical-data?sessionId=1&limit=20"), {
    headers: authHeaders(engineerToken),
    failOnStatusCode: false,
  });
  const body = (await jsonOf(response)) as { data?: Array<{ sessionId?: number | string }> } | null;
  const rows = Array.isArray(body?.data) ? body.data : [];
  const leaked = rows.some((row) => Number(row.sessionId) !== 1);
  const passed = response.status() === 200 && !leaked;
  record({
    id: "SEC-10",
    category: "Session and data isolation",
    title: "Cross-session data isolation by filter",
    endpoint: "/api/historical-data?sessionId=1&limit=20",
    method: "GET",
    role: "engineer",
    expected: "Only requested session rows returned",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Rows ${rows.length}; leaked other sessions ${leaked}`,
    remediation: "Apply sessionId filter and authorization before querying data.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-11 export does not leak other sessions or secrets", async ({ request }) => {
  const response = await request.post(apiPath("/api/exports/historical"), {
    headers: authHeaders(engineerToken),
    data: { sessionId: ACTIVE_SESSION_ID, format: "csv" },
    failOnStatusCode: false,
  });
  const csv = await textOf(response);
  const containsOtherSession = /(^|\n)(?!.*sessionId).*TEST-MWD-002/i.test(csv);
  const containsSensitive = /password|token|jwt_secret|gateway_api_key|gateway_hmac_secret|database_url/i.test(csv);
  const passed = response.status() === 200 && !containsOtherSession && !containsSensitive;
  record({
    id: "SEC-11",
    category: "Session and data isolation",
    title: "Export does not leak other sessions or secrets",
    endpoint: "/api/exports/historical",
    method: "POST",
    role: "engineer",
    expected: "CSV for active session only, no secrets",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `CSV bytes ${csv.length}; contains sensitive marker ${containsSensitive}; contains TEST-MWD-002 ${containsOtherSession}`,
    remediation: "Scope export query to requested authorized session and exclude sensitive fields.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-12 SQL injection on login is rejected", async ({ request }) => {
  const response = await request.post(apiPath("/api/auth/login"), {
    data: { identifier: "' OR '1'='1", password: "' OR '1'='1" },
    failOnStatusCode: false,
  });
  const bodyText = await textOf(response);
  const passed = response.status() === 401 && noSensitiveText(bodyText);
  record({
    id: "SEC-12",
    category: "Input validation",
    title: "SQL injection on login is rejected",
    endpoint: "/api/auth/login",
    method: "POST",
    role: "anonymous",
    expected: "401, no token, no database error",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Critical",
    evidence: `Status ${response.status()}; sensitive error leakage ${!noSensitiveText(bodyText)}`,
    remediation: "Use parameterized ORM queries and generic login failures.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-13 SQL injection on query parameters is rejected", async ({ request }) => {
  const response = await request.get(apiPath("/api/historical-data?sessionId=1%20OR%201=1&depthMin=0%20OR%201=1"), {
    headers: authHeaders(engineerToken),
    failOnStatusCode: false,
  });
  const bodyText = await textOf(response);
  const passed = response.status() === 400 && noSensitiveText(bodyText);
  record({
    id: "SEC-13",
    category: "Input validation",
    title: "SQL injection on query parameters is rejected",
    endpoint: "/api/historical-data",
    method: "GET",
    role: "engineer",
    expected: "400 validation error",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()}; sensitive error leakage ${!noSensitiveText(bodyText)}`,
    remediation: "Validate numeric query parameters before database access.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-14 invalid numeric input is rejected or bounded", async ({ request }) => {
  const queries = ["sessionId=-1", "sessionId=abc", "depthMin=NaN", "depthMax=Infinity", "limit=-100", "limit=100000000"];
  const statuses: number[] = [];
  for (const query of queries) {
    const response = await request.get(apiPath(`/api/historical-data?${query}`), {
      headers: authHeaders(engineerToken),
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }
  const passed = statuses.slice(0, 5).every((status) => status === 400) && [200, 400].includes(statuses[5] ?? 0);
  record({
    id: "SEC-14",
    category: "Input validation",
    title: "Invalid numeric input is rejected or bounded",
    endpoint: "/api/historical-data",
    method: "GET",
    role: "engineer",
    expected: "400 for invalid values; safe handling for large limit",
    actualStatus: statuses.join(";"),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Statuses: ${statuses.join(", ")}`,
    remediation: "Reject invalid numeric values and enforce upper bounds for limits.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-15 oversized payload is rejected or bounded", async ({ request }) => {
  const oversized = "x".repeat(11 * 1024 * 1024);
  const response = await request.post(apiPath("/api/mwd-data"), {
    headers: authHeaders(engineerToken),
    data: { sessionId: ACTIVE_SESSION_ID, notes: oversized },
    failOnStatusCode: false,
  });
  const passed = [400, 413].includes(response.status());
  record({
    id: "SEC-15",
    category: "Input validation",
    title: "Oversized payload is rejected or bounded",
    endpoint: "/api/mwd-data",
    method: "POST",
    role: "engineer",
    expected: "413 or validation error",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Status ${response.status()} for 11MB dummy payload`,
    remediation: "Keep request body limit and validation in place.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-16 missing required ingestion fields are rejected", async ({ request }) => {
  const variants = [
    { measuredAt: new Date().toISOString(), depthMd: 1 },
    { sessionId: ACTIVE_SESSION_ID, gatewaySequence: `sec-missing-${Date.now()}` },
    { sessionId: ACTIVE_SESSION_ID, measuredAt: new Date().toISOString(), depthMd: 1 },
  ];
  const statuses: number[] = [];
  for (const payload of variants) {
    const response = await request.post(apiPath("/api/gateway/mwd-data"), {
      headers: gatewayHeaders(payload),
      data: payload,
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }
  const passed = statuses[0] === 400 && [201, 400].includes(statuses[1] ?? 0) && [201, 400].includes(statuses[2] ?? 0);
  record({
    id: "SEC-16",
    category: "Input validation",
    title: "Missing required ingestion fields are rejected",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "Invalid missing session rejected; optional timestamp/sequence handled by configured ingestion behavior",
    actualStatus: statuses.join(";"),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Statuses: ${statuses.join(", ")}`,
    remediation: "Require sessionId and validate configured ingestion fields.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-17 invalid or null drilling values are rejected", async ({ request }) => {
  const payloads = [
    { sessionId: ACTIVE_SESSION_ID, measuredAt: "invalid-date", depthMd: 1, gatewaySequence: `sec-invalid-date-${Date.now()}` },
    { sessionId: ACTIVE_SESSION_ID, measuredAt: new Date().toISOString(), depthMd: "not-a-number", gatewaySequence: `sec-invalid-num-${Date.now()}` },
  ];
  const statuses: number[] = [];
  for (const payload of payloads) {
    const response = await request.post(apiPath("/api/gateway/mwd-data"), {
      headers: gatewayHeaders(payload),
      data: payload,
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }
  const passed = statuses.every((status) => status === 400);
  record({
    id: "SEC-17",
    category: "Input validation",
    title: "Invalid drilling values are rejected",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "400",
    actualStatus: statuses.join(";"),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Statuses: ${statuses.join(", ")}`,
    remediation: "Validate timestamp and numeric measurement fields before persistence.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-18 stored/reflected XSS control is not applicable", async () => {
  record({
    id: "SEC-18",
    category: "XSS and output encoding",
    title: "Stored/reflected XSS payload execution",
    endpoint: "N/A",
    method: "N/A",
    role: "engineer",
    expected: "Payload not executed",
    actualStatus: "N/A",
    result: "N/A",
    severityIfFailed: "High",
    evidence: "No tested operational text input is rendered back in the evaluated monitoring pages. API validation and React default escaping remain in scope for other tests.",
    remediation: "Add a dedicated stored-text UI fixture before evaluating stored XSS execution.",
  });
});

test("SEC-19 gateway API key wrong is rejected", async ({ request }) => {
  const payload = gatewayPayload(`sec-wrong-key-${Date.now()}`);
  const response = await request.post(apiPath("/api/gateway/mwd-data"), {
    headers: gatewayHeaders(payload, { key: "wrong-local-test-key" }),
    data: payload,
    failOnStatusCode: false,
  });
  record({
    id: "SEC-19",
    category: "Gateway security",
    title: "Gateway API key wrong is rejected",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "401",
    actualStatus: response.status(),
    result: response.status() === 401 ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()}`,
    remediation: "Reject gateway requests with invalid key.",
  });
  expect(response.status()).toBe(401);
});

test("SEC-20 HMAC signature wrong is rejected", async ({ request }) => {
  const payload = gatewayPayload(`sec-bad-hmac-${Date.now()}`);
  const response = await request.post(apiPath("/api/gateway/mwd-data"), {
    headers: gatewayHeaders(payload, { signature: "bad-signature" }),
    data: payload,
    failOnStatusCode: false,
  });
  record({
    id: "SEC-20",
    category: "Gateway security",
    title: "HMAC signature wrong is rejected",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "401",
    actualStatus: response.status(),
    result: response.status() === 401 ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()}`,
    remediation: "Validate gateway HMAC signatures.",
  });
  expect(response.status()).toBe(401);
});

test("SEC-21 old gateway timestamp is rejected", async ({ request }) => {
  const payload = gatewayPayload(`sec-old-ts-${Date.now()}`);
  const timestamp = String(Date.now() - 10 * 60 * 1000);
  const signature = createHmac("sha256", requiredEnv("E2E_GATEWAY_HMAC_SECRET"))
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest("hex");
  const response = await request.post(apiPath("/api/gateway/mwd-data"), {
    headers: gatewayHeaders(payload, { timestamp, signature }),
    data: payload,
    failOnStatusCode: false,
  });
  record({
    id: "SEC-21",
    category: "Gateway security",
    title: "Old gateway timestamp is rejected",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "401",
    actualStatus: response.status(),
    result: response.status() === 401 ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()} for timestamp outside tolerance`,
    remediation: "Reject stale signed gateway requests.",
  });
  expect(response.status()).toBe(401);
});

test("SEC-22 gateway request without timestamp or signature is rejected", async ({ request }) => {
  const payload = gatewayPayload(`sec-no-sig-${Date.now()}`);
  const response = await request.post(apiPath("/api/gateway/mwd-data"), {
    headers: { "x-gateway-key": requiredEnv("E2E_GATEWAY_API_KEY") },
    data: payload,
    failOnStatusCode: false,
  });
  record({
    id: "SEC-22",
    category: "Gateway security",
    title: "Gateway request without timestamp or signature is rejected",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "401",
    actualStatus: response.status(),
    result: response.status() === 401 ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Status ${response.status()}`,
    remediation: "Require HMAC timestamp and signature when HMAC is configured.",
  });
  expect(response.status()).toBe(401);
});

test("SEC-23 duplicate replay ingestion is deduplicated", async ({ request }) => {
  const payload = gatewayPayload(`sec-replay-${Date.now()}`);
  const first = await request.post(apiPath("/api/gateway/mwd-data"), {
    headers: gatewayHeaders(payload),
    data: payload,
    failOnStatusCode: false,
  });
  const second = await request.post(apiPath("/api/gateway/mwd-data"), {
    headers: gatewayHeaders(payload),
    data: payload,
    failOnStatusCode: false,
  });
  const secondBody = (await jsonOf(second)) as { count?: number } | null;
  const passed = first.status() === 201 && second.status() === 201 && secondBody?.count === 0;
  record({
    id: "SEC-23",
    category: "Gateway security",
    title: "Duplicate replay ingestion is deduplicated",
    endpoint: "/api/gateway/mwd-data",
    method: "POST",
    role: "gateway",
    expected: "Second identical request creates zero rows",
    actualStatus: `${first.status()};${second.status()}`,
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Second response count ${secondBody?.count}`,
    remediation: "Preserve gateway replay/deduplication by sequence and payload signature.",
  });
  expect(passed).toBeTruthy();
});

async function websocketOutcome(page: Page, url: string, message?: unknown) {
  return await page.evaluate(
    ({ wsUrl, outbound }) =>
      new Promise<{ opened: boolean; closed: boolean; closeCode: number; messages: string[] }>((resolve) => {
        const messages: string[] = [];
        const ws = new WebSocket(wsUrl);
        const timer = window.setTimeout(() => {
          ws.close();
          resolve({ opened: ws.readyState === WebSocket.OPEN, closed: false, closeCode: 0, messages });
        }, 2500);
        ws.addEventListener("open", () => {
          if (outbound) ws.send(JSON.stringify(outbound));
        });
        ws.addEventListener("message", (event) => {
          if (typeof event.data === "string") messages.push(event.data);
        });
        ws.addEventListener("close", (event) => {
          window.clearTimeout(timer);
          resolve({ opened: true, closed: true, closeCode: event.code, messages });
        });
        ws.addEventListener("error", () => {
          window.clearTimeout(timer);
          resolve({ opened: false, closed: true, closeCode: 0, messages });
        });
      }),
    { wsUrl: url, outbound: message ?? null },
  );
}

test("SEC-24 WebSocket without authentication is rejected", async ({ page }) => {
  const outcome = await websocketOutcome(page, `${API_URL.replace(/^http/, "ws")}/ws`);
  const passed = outcome.closed;
  record({
    id: "SEC-24",
    category: "WebSocket security",
    title: "WebSocket without authentication is rejected",
    endpoint: "/ws",
    method: "WS",
    role: "anonymous",
    expected: "Connection closed or rejected",
    actualStatus: outcome.closeCode,
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Closed ${outcome.closed}; close code ${outcome.closeCode}`,
    remediation: "Require authenticated token for WebSocket connection.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-25 WebSocket invalid token is rejected", async ({ page }) => {
  const outcome = await websocketOutcome(page, `${API_URL.replace(/^http/, "ws")}/ws?token=invalid-token`);
  const passed = outcome.closed;
  record({
    id: "SEC-25",
    category: "WebSocket security",
    title: "WebSocket invalid token is rejected",
    endpoint: "/ws",
    method: "WS",
    role: "invalid-token",
    expected: "Connection closed or rejected",
    actualStatus: outcome.closeCode,
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Closed ${outcome.closed}; close code ${outcome.closeCode}`,
    remediation: "Reject invalid WebSocket tokens.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-26 WebSocket subscription requires valid session", async ({ page }) => {
  const encodedToken = encodeURIComponent(engineerToken);
  const outcome = await websocketOutcome(
    page,
    `${API_URL.replace(/^http/, "ws")}/ws?token=${encodedToken}`,
    { type: "subscribe", sessionId: -999 },
  );
  const sawError = outcome.messages.some((message) => {
    try {
      const parsed = JSON.parse(message) as { event?: string; payload?: { message?: string } };
      return parsed.event === "error";
    } catch {
      return message.toLowerCase().includes("error");
    }
  });
  const sawSubscribed = outcome.messages.some((message) => message.includes("subscribed"));
  const passed = (sawError || outcome.closed) && !sawSubscribed;
  record({
    id: "SEC-26",
    category: "WebSocket security",
    title: "WebSocket cannot subscribe invalid or unauthorized session",
    endpoint: "/ws",
    method: "WS subscribe",
    role: "engineer",
    expected: "Subscription error for invalid session",
    actualStatus: sawError ? "error-event" : outcome.closed ? "closed" : "no-error-event",
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Subscription error observed ${sawError}; closed ${outcome.closed}; subscribed ${sawSubscribed}; message count ${outcome.messages.length}`,
    remediation: "Validate session authorization before accepting subscriptions.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-27 unauthorized CORS origin is not allowed", async ({ request }) => {
  const response = await request.fetch(apiPath("/api/auth/me"), {
    method: "OPTIONS",
    headers: {
      Origin: "https://unauthorized.example",
      "Access-Control-Request-Method": "GET",
    },
    failOnStatusCode: false,
  });
  const allowOrigin = response.headers()["access-control-allow-origin"] ?? "";
  const passed = allowOrigin !== "https://unauthorized.example";
  record({
    id: "SEC-27",
    category: "CORS and headers",
    title: "Unauthorized CORS origin is not allowed",
    endpoint: "/api/auth/me",
    method: "OPTIONS",
    role: "anonymous",
    expected: "No Access-Control-Allow-Origin for unauthorized origin",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Access-Control-Allow-Origin matched unauthorized origin: ${!passed}`,
    remediation: "Keep CORS allowlist explicit.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-28 frontend testing origin is allowed", async ({ request }) => {
  const response = await request.fetch(apiPath("/api/auth/me"), {
    method: "OPTIONS",
    headers: {
      Origin: FRONTEND_URL,
      "Access-Control-Request-Method": "GET",
    },
    failOnStatusCode: false,
  });
  const headers = response.headers();
  const passed = headers["access-control-allow-origin"] === FRONTEND_URL && headers["access-control-allow-credentials"] === "true";
  record({
    id: "SEC-28",
    category: "CORS and headers",
    title: "Frontend testing origin is allowed",
    endpoint: "/api/auth/me",
    method: "OPTIONS",
    role: "anonymous",
    expected: "Allowed configured origin with credentials policy",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Origin allowed ${headers["access-control-allow-origin"] === FRONTEND_URL}; credentials ${headers["access-control-allow-credentials"]}`,
    remediation: "Configure CORS_ORIGIN for the local frontend URL.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-29 security headers are present", async ({ request }) => {
  const response = await request.get(apiPath("/health"), { failOnStatusCode: false });
  const headers = response.headers();
  const required = ["x-content-type-options", "content-security-policy", "referrer-policy", "x-frame-options"];
  const missing = required.filter((header) => !headers[header]);
  const passed = missing.length === 0;
  record({
    id: "SEC-29",
    category: "CORS and headers",
    title: "Security headers are present",
    endpoint: "/health",
    method: "GET",
    role: "anonymous",
    expected: "Security headers present; HSTS not required on HTTP localhost",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Missing headers: ${missing.join(", ") || "none"}`,
    remediation: "Set baseline security headers through middleware.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-30 error response does not leak sensitive information", async ({ request }) => {
  const response = await request.get(apiPath("/api/historical-data?sessionId=abc"), {
    headers: authHeaders(engineerToken),
    failOnStatusCode: false,
  });
  const bodyText = await textOf(response);
  const passed = response.status() === 400 && noSensitiveText(bodyText);
  record({
    id: "SEC-30",
    category: "Error handling",
    title: "Error response does not leak sensitive information",
    endpoint: "/api/historical-data",
    method: "GET",
    role: "engineer",
    expected: "Validation error without sensitive internals",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Sensitive leakage detected ${!noSensitiveText(bodyText)}`,
    remediation: "Return sanitized validation errors.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-31 unsupported method is handled safely", async ({ request }) => {
  const deleteResponse = await request.delete(apiPath("/api/historical-data"), {
    headers: authHeaders(engineerToken),
    failOnStatusCode: false,
  });
  const traceResponse = await request.fetch(apiPath("/api/historical-data"), {
    method: "TRACE",
    headers: authHeaders(engineerToken),
    failOnStatusCode: false,
  });
  const bodyText = `${await textOf(deleteResponse)} ${await textOf(traceResponse)}`;
  const passed = [404, 405].includes(deleteResponse.status()) && [404, 405].includes(traceResponse.status()) && noSensitiveText(bodyText);
  record({
    id: "SEC-31",
    category: "Error handling",
    title: "Unsupported method is handled safely",
    endpoint: "/api/historical-data",
    method: "DELETE/TRACE",
    role: "engineer",
    expected: "404 or 405, no stack trace",
    actualStatus: `${deleteResponse.status()};${traceResponse.status()}`,
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Low",
    evidence: `Sensitive leakage detected ${!noSensitiveText(bodyText)}`,
    remediation: "Handle unsupported methods without internal details.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-32 user API does not return password or hash", async ({ request }) => {
  const response = await request.get(apiPath("/api/users"), {
    headers: authHeaders(adminToken),
    failOnStatusCode: false,
  });
  const bodyText = await textOf(response);
  const passed = response.status() === 200 && !/password|passwordHash|resetToken|jwt/i.test(bodyText);
  record({
    id: "SEC-32",
    category: "Sensitive response data",
    title: "User API does not return password or hash",
    endpoint: "/api/users",
    method: "GET",
    role: "admin",
    expected: "No password/hash/reset token fields",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "High",
    evidence: `Sensitive field marker detected ${!/password|passwordHash|resetToken|jwt/i.test(bodyText) ? "false" : "true"}`,
    remediation: "Keep service select list excluding passwordHash and secrets.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-33 audit log does not expose secrets", async ({ request }) => {
  const response = await request.get(apiPath("/api/audit-logs?limit=25"), {
    headers: authHeaders(adminToken),
    failOnStatusCode: false,
  });
  const bodyText = await textOf(response);
  const passed = response.status() === 200 && !/Bearer\s+|jwt_secret|gateway_api_key|gateway_hmac_secret|database_url|passwordHash/i.test(bodyText);
  record({
    id: "SEC-33",
    category: "Sensitive response data",
    title: "Audit log does not expose secrets",
    endpoint: "/api/audit-logs",
    method: "GET",
    role: "admin",
    expected: "No tokens or configured secrets in audit logs",
    actualStatus: response.status(),
    result: passed ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Sensitive marker detected ${!passed}`,
    remediation: "Never store request credentials or secret values in audit metadata.",
  });
  expect(passed).toBeTruthy();
});

test("SEC-05 login route rate limiter works", async ({ request }) => {
  const firstResponse = await request.post(apiPath("/api/auth/login"), {
    data: {
      identifier: `security_rate_limit_test_${Date.now()}_0`,
      password: "wrong-password",
    },
    failOnStatusCode: false,
  });
  const headerLimit = Number(firstResponse.headers()["ratelimit-limit"] || firstResponse.headers()["x-ratelimit-limit"]);
  const authRouteLimit = Number.isFinite(headerLimit) && headerLimit > 0
    ? headerLimit
    : Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 10);
  const attempts = Math.max(2, authRouteLimit + 1);
  let lastStatus = firstResponse.status();

  for (let index = 1; index < attempts; index += 1) {
    const response = await request.post(apiPath("/api/auth/login"), {
      data: {
        identifier: `security_rate_limit_test_${Date.now()}_${index}`,
        password: "wrong-password",
      },
      failOnStatusCode: false,
    });
    lastStatus = response.status();
  }

  record({
    id: "SEC-05",
    category: "Authentication",
    title: "Login route rate limiter works",
    endpoint: "/api/auth/login",
    method: "POST",
    role: "anonymous",
    expected: "429 on threshold + 1",
    actualStatus: lastStatus,
    result: lastStatus === 429 ? "PASS" : "FAIL",
    severityIfFailed: "Medium",
    evidence: `Configured route threshold ${authRouteLimit}; last status ${lastStatus}`,
    remediation: "Keep route-level login rate limiter enabled.",
  });
  expect(lastStatus).toBe(429);
});
