import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.E2E_API_URL || "http://localhost:5002";
const LOGIN_PATH = process.env.E2E_LOGIN_PATH || "/login";
const DASHBOARD_PATH = process.env.E2E_DASHBOARD_PATH || "/dashboard";
const HISTORICAL_PATH = process.env.E2E_HISTORICAL_PATH || "/history";
const WELL_PLOT_PATH =
  process.env.E2E_WELL_PLOT_PATH || "/trajectory/well-plot";
const ADMIN_PATH = process.env.E2E_ADMIN_PATH || "/admin";

const USERS = {
  admin: {
    username: process.env.E2E_ADMIN_USERNAME || "admin_test",
    password: process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_PASSWORD || "",
  },
  engineer: {
    username: process.env.E2E_ENGINEER_USERNAME || "engineer_test",
    password: process.env.E2E_ENGINEER_PASSWORD || process.env.E2E_TEST_PASSWORD || "",
  },
  operator: {
    username: process.env.E2E_OPERATOR_USERNAME || "operator_test",
    password: process.env.E2E_OPERATOR_PASSWORD || process.env.E2E_TEST_PASSWORD || "",
  },
} as const;

const SESSION_NAMES = {
  active: process.env.E2E_ACTIVE_SESSION_NAME || "TEST-MWD-001",
  comparison:
    process.env.E2E_COMPARISON_SESSION_NAME || "TEST-MWD-002",
  empty: process.env.E2E_EMPTY_SESSION_NAME || "TEST-MWD-EMPTY",
} as const;

const SELECTORS = {
  loginIdentifier: "login-identifier",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  loginError: "login-error",
  dashboardPage: "dashboard-page",
  activeSessionSelect: "active-session-select",
  activeSessionLabel: "active-session-label",
  dashboardDataRow: "dashboard-data-row",
  dashboardChart: "dashboard-chart",
  chartLatestValue: "chart-latest-value",
  wellPlotPage: "well-plot-page",
  wellPlotPoint: "well-plot-point",
  historicalPage: "historical-page",
  historicalTimeFrom: "historical-time-from",
  historicalTimeTo: "historical-time-to",
  historicalDepthMin: "historical-depth-min",
  historicalDepthMax: "historical-depth-max",
  historicalApplyFilter: "historical-apply-filter",
  historicalResetFilter: "historical-reset-filter",
  historicalRow: "historical-row",
  historicalExportCsv: "historical-export-csv",
  adminPage: "admin-page",
  userManagementPage: "user-management-page",
  accessDenied: "access-denied",
  connectionStatus: "connection-status",
  emptyState: "empty-state",
  navAdmin: "nav-admin",
  navWellPlot: "nav-well-plot",
  navUserManagement: "nav-user-management",
} as const;

type Role = keyof typeof USERS;

type TestSession = {
  id: string;
  name: string;
};

type FilterData = {
  timeFrom: string;
  timeTo: string;
  depthMin: string;
  depthMax: string;
  combinedTimeFrom: string;
  combinedTimeTo: string;
  combinedDepthMin: string;
  combinedDepthMax: string;
};

type RuntimeConfig = {
  sessions: {
    active: TestSession;
    comparison: TestSession;
    empty: TestSession;
  };
  filters?: FilterData;
};

type TokenPayload = {
  token?: string;
  accessToken?: string;
  data?: {
    token?: string;
    accessToken?: string;
  };
};

type PersistedToken = {
  apiUrl: string;
  username: string;
  token: string;
};

type PersistedTokenStore = Partial<Record<Role, PersistedToken>>;

type HistoricalRecord = {
  timestamp: string;
  timestampMs: number;
  depth: number;
  sessionId: string;
};

type HistoricalFilterResult = {
  url: URL;
  responseBody: string;
};

let runtimeConfig: RuntimeConfig;

const TOKEN_CACHE_FILE =
  process.env.E2E_TOKEN_CACHE_FILE ||
  path.resolve(process.cwd(), ".playwright", "mwd-token-cache.json");

const inMemoryTokens = new Map<Role, string>();
const validatedTokens = new Set<string>();
let persistedTokens = readPersistedTokens();

function apiPath(apiRoute: string): string {
  return `${API_URL}${apiRoute}`;
}

function byTestId(page: Page, testId: string) {
  return page.getByTestId(testId);
}

function normalizeSessionId(value: string | undefined): string {
  const id = value?.trim() ?? "";

  if (!id || /GANTI|PLACEHOLDER|ACTUAL|SESSION_ID/i.test(id)) {
    return "";
  }

  return id;
}

function getEnvironmentSessions(): RuntimeConfig["sessions"] {
  return {
    active: {
      id: normalizeSessionId(process.env.E2E_ACTIVE_SESSION_ID),
      name: SESSION_NAMES.active,
    },
    comparison: {
      id: normalizeSessionId(process.env.E2E_COMPARISON_SESSION_ID),
      name: SESSION_NAMES.comparison,
    },
    empty: {
      id: normalizeSessionId(process.env.E2E_EMPTY_SESSION_ID),
      name: SESSION_NAMES.empty,
    },
  };
}

function allSessionIdsAvailable(
  sessions: RuntimeConfig["sessions"],
): boolean {
  return Boolean(
    sessions.active.id && sessions.comparison.id && sessions.empty.id,
  );
}

function readPersistedTokens(): PersistedTokenStore {
  try {
    if (!fs.existsSync(TOKEN_CACHE_FILE)) {
      return {};
    }

    const content = fs.readFileSync(TOKEN_CACHE_FILE, "utf8");
    const parsed = JSON.parse(content) as PersistedTokenStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistedTokens(): void {
  fs.mkdirSync(path.dirname(TOKEN_CACHE_FILE), { recursive: true });
  fs.writeFileSync(
    TOKEN_CACHE_FILE,
    `${JSON.stringify(persistedTokens, null, 2)}\n`,
    "utf8",
  );
}

function roleEnvironmentToken(role: Role): string {
  const variableNames: Record<Role, string> = {
    admin: "E2E_ADMIN_TOKEN",
    engineer: "E2E_ENGINEER_TOKEN",
    operator: "E2E_OPERATOR_TOKEN",
  };

  return process.env[variableNames[role]]?.trim() ?? "";
}

function extractToken(payload: TokenPayload): string {
  return (
    payload.token ??
    payload.accessToken ??
    payload.data?.token ??
    payload.data?.accessToken ??
    ""
  );
}

function saveToken(role: Role, token: string): void {
  if (!token) {
    return;
  }

  inMemoryTokens.set(role, token);
  persistedTokens[role] = {
    apiUrl: API_URL,
    username: USERS[role].username,
    token,
  };
  writePersistedTokens();
}

function removeToken(role: Role): void {
  const token = inMemoryTokens.get(role) ?? persistedTokens[role]?.token;

  if (token) {
    validatedTokens.delete(token);
  }

  inMemoryTokens.delete(role);
  delete persistedTokens[role];
  writePersistedTokens();
}

async function tokenIsValid(
  request: APIRequestContext,
  token: string,
): Promise<boolean> {
  if (validatedTokens.has(token)) {
    return true;
  }

  const response = await request.get(apiPath("/api/auth/me"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    failOnStatusCode: false,
  });

  if (response.ok()) {
    validatedTokens.add(token);
    return true;
  }

  return false;
}

async function performApiLogin(
  request: APIRequestContext,
  role: Role,
): Promise<string> {
  if (!USERS[role].password) {
    throw new Error(
      `Password E2E untuk ${role} belum diset. Gunakan E2E_${role.toUpperCase()}_PASSWORD atau E2E_TEST_PASSWORD.`,
    );
  }

  const response = await request.post(apiPath("/api/auth/login"), {
    headers: {
      Authorization: "Bearer e2e-login-bootstrap",
    },
    data: {
      identifier: USERS[role].username,
      password: USERS[role].password,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(
      `API login ${role} gagal: ${response.status()} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as TokenPayload;
  const token = extractToken(payload);

  if (!token) {
    throw new Error(
      `API login ${role} tidak mengembalikan token. ` +
        "Pastikan AUTH_EXPOSE_TOKEN aktif pada environment testing.",
    );
  }

  saveToken(role, token);
  validatedTokens.add(token);
  return token;
}

async function getApiToken(
  request: APIRequestContext,
  role: Role,
): Promise<string> {
  const candidates = [
    inMemoryTokens.get(role) ?? "",
    roleEnvironmentToken(role),
    persistedTokens[role]?.apiUrl === API_URL &&
    persistedTokens[role]?.username === USERS[role].username
      ? persistedTokens[role]?.token ?? ""
      : "",
  ].filter(Boolean);

  for (const token of [...new Set(candidates)]) {
    if (await tokenIsValid(request, token)) {
      saveToken(role, token);
      return token;
    }
  }

  removeToken(role);
  return performApiLogin(request, role);
}

function readSessionName(session: Record<string, unknown>): string {
  return String(
    session.name ??
      session.sessionName ??
      session.sessionCode ??
      session.code ??
      session.wellName ??
      "",
  );
}

function readSessionId(session: Record<string, unknown>): string {
  const value =
    session.id ??
    session.sessionId ??
    session.mwdSessionId ??
    session._id;

  return value === undefined || value === null ? "" : String(value);
}

async function resolveSessions(
  request: APIRequestContext,
  token: string,
): Promise<RuntimeConfig["sessions"]> {
  const environmentSessions = getEnvironmentSessions();

  if (allSessionIdsAvailable(environmentSessions)) {
    return environmentSessions;
  }

  const response = await request.get(apiPath("/api/mwd-sessions"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(
      `Gagal mengambil session testing: ${response.status()} ` +
        `${await response.text()}`,
    );
  }

  const payload = await response.json();
  const rawSessions = Array.isArray(payload)
    ? payload
    : payload.data ??
      payload.items ??
      payload.sessions ??
      payload.results ??
      payload.records ??
      [];

  const sessions = Array.isArray(rawSessions)
    ? (rawSessions as Record<string, unknown>[])
    : [];

  const findByName = (name: string): TestSession => {
    const session = sessions.find((item) => readSessionName(item) === name);
    const id = session ? readSessionId(session) : "";

    if (!session || !id) {
      throw new Error(
        `Session testing ${name} tidak ditemukan. ` +
          "Jalankan seed testing atau set E2E_*_SESSION_ID.",
      );
    }

    return { id, name };
  };

  return {
    active: environmentSessions.active.id
      ? environmentSessions.active
      : findByName(environmentSessions.active.name),
    comparison: environmentSessions.comparison.id
      ? environmentSessions.comparison
      : findByName(environmentSessions.comparison.name),
    empty: environmentSessions.empty.id
      ? environmentSessions.empty
      : findByName(environmentSessions.empty.name),
  };
}

async function loginViaUi(page: Page, role: Role): Promise<void> {
  if (!USERS[role].password) {
    throw new Error(
      `Password E2E untuk ${role} belum diset. Gunakan E2E_${role.toUpperCase()}_PASSWORD atau E2E_TEST_PASSWORD.`,
    );
  }

  await page.goto(LOGIN_PATH);

  await byTestId(page, SELECTORS.loginIdentifier).fill(
    USERS[role].username,
  );
  await byTestId(page, SELECTORS.loginPassword).fill(
    USERS[role].password,
  );

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") &&
      response.request().method() === "POST",
  );

  await byTestId(page, SELECTORS.loginSubmit).click();

  const loginResponse = await loginResponsePromise;
  const responseText = await loginResponse.text();

  expect(
    loginResponse.ok(),
    `UI login ${role} gagal: ${loginResponse.status()} ${responseText}`,
  ).toBeTruthy();

  try {
    const payload = JSON.parse(responseText) as TokenPayload;
    const token = extractToken(payload);

    if (token) {
      saveToken(role, token);
      validatedTokens.add(token);
    }
  } catch {
    // UI login tetap valid walaupun response bukan JSON yang memuat token.
  }

  await expect(byTestId(page, SELECTORS.dashboardPage)).toBeVisible({
    timeout: 15_000,
  });
}

async function authenticate(
  page: Page,
  role: Role,
  session?: TestSession,
): Promise<void> {
  const token = await getApiToken(page.request, role);

  await page.addInitScript(
    ({ authToken, sessionId }) => {
      window.localStorage.setItem("mwd_auth_token", authToken);

      if (sessionId) {
        window.localStorage.setItem("mwd_active_session_id", sessionId);
      } else {
        window.localStorage.removeItem("mwd_active_session_id");
      }
    },
    {
      authToken: token,
      sessionId: session?.id ?? "",
    },
  );
}

async function selectSession(
  page: Page,
  session: TestSession,
): Promise<void> {
  const trigger = byTestId(page, SELECTORS.activeSessionSelect);

  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  await page.getByRole("option", { name: session.name }).click();

  await expect(byTestId(page, SELECTORS.activeSessionLabel)).toContainText(
    session.name,
    { timeout: 15_000 },
  );
}

async function loginAndSelectActive(page: Page): Promise<void> {
  await authenticate(page, "engineer", runtimeConfig.sessions.active);
  await page.goto(DASHBOARD_PATH);

  await expect(byTestId(page, SELECTORS.dashboardPage)).toBeVisible({
    timeout: 15_000,
  });

  const activeLabel = byTestId(page, SELECTORS.activeSessionLabel);
  const labelText = await activeLabel.textContent();

  if (!labelText?.includes(runtimeConfig.sessions.active.name)) {
    await selectSession(page, runtimeConfig.sessions.active);
  }

  await expect(activeLabel).toContainText(
    runtimeConfig.sessions.active.name,
    { timeout: 15_000 },
  );
}

async function openHistorical(page: Page): Promise<void> {
  await page.goto(HISTORICAL_PATH);
  await expect(byTestId(page, SELECTORS.historicalPage)).toBeVisible({
    timeout: 15_000,
  });
}

async function openWellPlot(page: Page): Promise<void> {
  await page.evaluate((sessionId) => {
    window.localStorage.setItem("mwd_active_session_id", sessionId);
    window.sessionStorage.setItem("mwd_active_session_id", sessionId);
  }, runtimeConfig.sessions.active.id);

  await page.goto(WELL_PLOT_PATH);

  await expect(byTestId(page, SELECTORS.wellPlotPage)).toBeVisible({
    timeout: 15_000,
  });
}

function extractRecordArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidateKeys = [
    "data",
    "items",
    "records",
    "results",
    "rows",
    "historicalData",
    "history",
  ];

  for (const key of candidateKeys) {
    const candidate = objectPayload[key];

    if (Array.isArray(candidate)) {
      return extractRecordArray(candidate);
    }

    if (candidate && typeof candidate === "object") {
      const nested = extractRecordArray(candidate);

      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function readHistoricalTimestamp(record: Record<string, unknown>): string {
  const value =
    record.measuredAt ??
    record.measured_at ??
    record.timestamp ??
    record.time ??
    record.createdAt ??
    record.created_at;

  return value === undefined || value === null ? "" : String(value);
}

function readHistoricalDepth(record: Record<string, unknown>): number {
  const value =
    record.depthMd ??
    record.depth_md ??
    record.measuredDepth ??
    record.measured_depth ??
    record.depth ??
    record.hole_depth ??
    record.holeDepth ??
    record.md;

  return Number(value);
}

function readHistoricalSessionId(record: Record<string, unknown>): string {
  const value =
    record.sessionId ??
    record.session_id ??
    record.mwdSessionId ??
    record.mwd_session_id;

  return value === undefined || value === null ? "" : String(value);
}

function floorUtcMinute(timestampMs: number): string {
  const date = new Date(Math.floor(timestampMs / 60_000) * 60_000);
  return date.toISOString().slice(0, 16);
}

function ceilUtcMinute(timestampMs: number): string {
  const date = new Date((Math.floor(timestampMs / 60_000) + 1) * 60_000);
  return date.toISOString().slice(0, 16);
}

function formatDepth(value: number): string {
  return Number(value.toFixed(6)).toString();
}

async function loadHistoricalRecords(
  request: APIRequestContext,
): Promise<HistoricalRecord[]> {
  const token = await getApiToken(request, "engineer");
  const url = new URL(apiPath("/api/historical-data"));
  url.searchParams.set("sessionId", runtimeConfig.sessions.active.id);
  url.searchParams.set("limit", "1000");

  const response = await request.get(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(
      `Gagal membaca data historical awal: ${response.status()} ` +
        `${await response.text()}`,
    );
  }

  const payload = await response.json();
  const rawRecords = extractRecordArray(payload);

  const records = rawRecords
    .map((record): HistoricalRecord | null => {
      const timestamp = readHistoricalTimestamp(record);
      const timestampMs = new Date(timestamp).getTime();
      const depth = readHistoricalDepth(record);
      const sessionId = readHistoricalSessionId(record);

      if (!timestamp || Number.isNaN(timestampMs) || !Number.isFinite(depth)) {
        return null;
      }

      if (
        sessionId &&
        String(sessionId) !== String(runtimeConfig.sessions.active.id)
      ) {
        return null;
      }

      return {
        timestamp,
        timestampMs,
        depth,
        sessionId,
      };
    })
    .filter((record): record is HistoricalRecord => record !== null);

  if (records.length === 0) {
    throw new Error(
      `Session ${runtimeConfig.sessions.active.name} tidak memiliki data ` +
        "historical yang dapat dipakai. Periksa seed.testing.mjs.",
    );
  }

  return records;
}

async function ensureFilterData(
  request: APIRequestContext,
): Promise<FilterData> {
  if (runtimeConfig.filters) {
    return runtimeConfig.filters;
  }

  const records = await loadHistoricalRecords(request);
  const byTime = [...records].sort(
    (left, right) => left.timestampMs - right.timestampMs,
  );
  const byDepth = [...records].sort((left, right) => left.depth - right.depth);
  const pivot = byTime[Math.floor(byTime.length / 2)];
  const minimumTime = byTime[0].timestampMs;
  const maximumTime = byTime[byTime.length - 1].timestampMs;
  const minimumDepth = byDepth[0].depth;
  const maximumDepth = byDepth[byDepth.length - 1].depth;
  const depthPadding = Math.max(Math.abs(pivot.depth) * 0.000001, 0.001);

  runtimeConfig.filters = {
    timeFrom: process.env.E2E_TIME_FROM || floorUtcMinute(minimumTime),
    timeTo: process.env.E2E_TIME_TO || ceilUtcMinute(maximumTime),
    depthMin: process.env.E2E_DEPTH_MIN || formatDepth(minimumDepth),
    depthMax: process.env.E2E_DEPTH_MAX || formatDepth(maximumDepth),
    combinedTimeFrom:
      process.env.E2E_COMBINED_TIME_FROM ||
      floorUtcMinute(pivot.timestampMs),
    combinedTimeTo:
      process.env.E2E_COMBINED_TIME_TO || ceilUtcMinute(pivot.timestampMs),
    combinedDepthMin:
      process.env.E2E_COMBINED_DEPTH_MIN ||
      formatDepth(pivot.depth - depthPadding),
    combinedDepthMax:
      process.env.E2E_COMBINED_DEPTH_MAX ||
      formatDepth(pivot.depth + depthPadding),
  };

  return runtimeConfig.filters;
}

function datetimeLocalToUtcIso(value: string): string {
  const normalized = value.length === 16 ? `${value}:00.000Z` : `${value}Z`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Nilai datetime-local tidak valid: ${value}`);
  }

  return parsed.toISOString();
}

function datetimeLocalToUtcMs(value: string): number {
  return new Date(datetimeLocalToUtcIso(value)).getTime();
}

async function fillHistoricalCombinedFilter(
  page: Page,
  filters: FilterData,
): Promise<void> {
  await byTestId(page, SELECTORS.historicalTimeFrom).fill(
    filters.combinedTimeFrom,
  );
  await byTestId(page, SELECTORS.historicalTimeTo).fill(
    filters.combinedTimeTo,
  );
  await byTestId(page, SELECTORS.historicalDepthMin).fill(
    filters.combinedDepthMin,
  );
  await byTestId(page, SELECTORS.historicalDepthMax).fill(
    filters.combinedDepthMax,
  );
}

async function applyHistoricalFilter(
  page: Page,
): Promise<HistoricalFilterResult> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/historical-data") &&
      response.request().method() === "GET",
  );

  await byTestId(page, SELECTORS.historicalApplyFilter).click();

  const response = await responsePromise;
  const responseBody = await response.text();

  expect(
    response.ok(),
    `Historical request gagal: ${response.status()} ${responseBody}`,
  ).toBeTruthy();

  return {
    url: new URL(response.url()),
    responseBody,
  };
}

function parseNumericAttribute(
  value: string | null,
  attributeName: string,
): number {
  expect(value, `${attributeName} harus tersedia`).not.toBeNull();

  const parsed = Number(value);
  expect(
    Number.isFinite(parsed),
    `${attributeName} harus angka valid: ${value}`,
  ).toBeTruthy();

  return parsed;
}

async function waitForHistoricalRows(
  page: Page,
  responseBody: string,
): Promise<void> {
  await expect
    .poll(
      async () => byTestId(page, SELECTORS.historicalRow).count(),
      {
        timeout: 15_000,
        message:
          "Menunggu baris historical selesai dirender. " +
          `Response API: ${responseBody.slice(0, 1000)}`,
      },
    )
    .toBeGreaterThan(0);
}

async function expectHistoricalRowsWithinTime(
  page: Page,
  from: string,
  to: string,
  responseBody: string,
): Promise<void> {
  await waitForHistoricalRows(page, responseBody);

  const rows = await byTestId(page, SELECTORS.historicalRow).all();
  const fromMs = datetimeLocalToUtcMs(from);
  const toMs = datetimeLocalToUtcMs(to);

  for (const row of rows) {
    const timestamp = await row.getAttribute("data-timestamp");
    expect(timestamp).toBeTruthy();

    const valueMs = new Date(timestamp!).getTime();
    expect(Number.isNaN(valueMs)).toBeFalsy();
    expect(valueMs).toBeGreaterThanOrEqual(fromMs);
    expect(valueMs).toBeLessThanOrEqual(toMs);
  }
}

async function expectHistoricalRowsWithinDepth(
  page: Page,
  minimum: string,
  maximum: string,
  responseBody: string,
): Promise<void> {
  await waitForHistoricalRows(page, responseBody);

  const rows = await byTestId(page, SELECTORS.historicalRow).all();
  const minimumDepth = Number(minimum);
  const maximumDepth = Number(maximum);

  for (const row of rows) {
    const depth = parseNumericAttribute(
      await row.getAttribute("data-depth"),
      "data-depth",
    );

    expect(depth).toBeGreaterThanOrEqual(minimumDepth);
    expect(depth).toBeLessThanOrEqual(maximumDepth);
  }
}

async function ingestMwdData(
  request: APIRequestContext,
  session: TestSession,
  depth: number,
) {
  const gatewayKey =
    process.env.E2E_GATEWAY_API_KEY || "mwd-test-gateway-key";
  const ingestionPath =
    process.env.E2E_INGEST_PATH || "/api/gateway/mwd-data";
  const gatewayHeaderName =
    process.env.E2E_GATEWAY_HEADER_NAME || "x-gateway-key";
  const gatewayAuthMode =
    process.env.E2E_GATEWAY_AUTH_MODE || "header";
  const measuredAt = new Date().toISOString();

  const payload = {
    sessionId: Number(session.id),
    measuredAt,
    depthMd: depth,
    hole_depth: depth,
    inclination: 12.5,
    azimuth: 145.2,
    gammaRay: 82.4,
    temperature: 74.5,
    standpipePressure: 2600,
    rop: 22.5,
    gatewaySequence: `${Date.now()}-${Math.random()}`,
  };

  const headers: Record<string, string> = {};
  const gatewayHmacSecret = process.env.E2E_GATEWAY_HMAC_SECRET || "";
  const timestamp = String(Date.now());

  if (gatewayAuthMode === "header" || gatewayAuthMode === "both") {
    headers[gatewayHeaderName] = gatewayKey;
  }

  if (gatewayAuthMode === "bearer" || gatewayAuthMode === "both") {
    headers.Authorization = `Bearer ${gatewayKey}`;
  }

  if (gatewayHmacSecret) {
    headers["x-gateway-timestamp"] = timestamp;
    headers["x-gateway-signature"] = createHmac("sha256", gatewayHmacSecret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex");
  }

  const response = await request.post(apiPath(ingestionPath), {
    headers,
    data: payload,
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(
      `Ingestion gagal: ${response.status()} ${await response.text()}. ` +
        `Pastikan backend dan Playwright memakai gateway key yang sama. ` +
        `Path=${ingestionPath}, header=${gatewayHeaderName}, ` +
        `mode=${gatewayAuthMode}.`,
    );
  }

  return payload;
}

async function ensureWellPlotPoints(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  const initialCount = await byTestId(page, SELECTORS.wellPlotPoint).count();

  if (initialCount > 1) {
    return;
  }

  const depthBase = 1800 + Math.floor(Math.random() * 100);

  for (const offset of [0, 10, 20]) {
    await ingestMwdData(
      request,
      runtimeConfig.sessions.active,
      depthBase + offset,
    );
  }

  await page.reload();
  await expect(byTestId(page, SELECTORS.wellPlotPage)).toBeVisible({
    timeout: 15_000,
  });

  await expect
    .poll(
      async () => byTestId(page, SELECTORS.wellPlotPoint).count(),
      {
        timeout: 30_000,
        message:
          "Menunggu minimal dua data-testid=well-plot-point. " +
          "Jika tetap 0, tambahkan selector tersebut pada array data aktual " +
          "di components/well-plot-panel.tsx.",
      },
    )
    .toBeGreaterThan(1);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const headers = lines[0] ? parseCsvLine(lines[0]) : [];
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

function normalizeCsvHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCsvColumn(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeCsvHeader);
  const index = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeCsvHeader(header)),
  );

  expect(
    index,
    `CSV header harus memiliki salah satu kolom: ${aliases.join(", ")}`,
  ).toBeGreaterThanOrEqual(0);

  return index;
}

function expectCsvRowsMatchCombinedFilter(
  csv: { headers: string[]; rows: string[][] },
  session: TestSession,
  filters: FilterData,
): void {
  const timestampIndex = findCsvColumn(csv.headers, [
    "timestamp",
    "measuredAt",
    "measured_at",
    "time",
  ]);
  const depthIndex = findCsvColumn(csv.headers, [
    "depth",
    "measuredDepth",
    "measured_depth",
    "depthMd",
    "depth_md",
    "md",
  ]);
  const sessionIndex = findCsvColumn(csv.headers, [
    "sessionId",
    "session_id",
    "mwdSessionId",
    "mwd_session_id",
  ]);

  const fromMs = datetimeLocalToUtcMs(filters.combinedTimeFrom);
  const toMs = datetimeLocalToUtcMs(filters.combinedTimeTo);
  const minimumDepth = Number(filters.combinedDepthMin);
  const maximumDepth = Number(filters.combinedDepthMax);

  for (const row of csv.rows) {
    const timestampMs = new Date(row[timestampIndex]).getTime();
    const depth = Number(row[depthIndex]);
    const sessionId = row[sessionIndex];

    expect(
      Number.isNaN(timestampMs),
      `Timestamp CSV tidak valid: ${row[timestampIndex]}`,
    ).toBeFalsy();
    expect(
      Number.isFinite(depth),
      `Depth CSV tidak valid: ${row[depthIndex]}`,
    ).toBeTruthy();
    expect(timestampMs).toBeGreaterThanOrEqual(fromMs);
    expect(timestampMs).toBeLessThanOrEqual(toMs);
    expect(depth).toBeGreaterThanOrEqual(minimumDepth);
    expect(depth).toBeLessThanOrEqual(maximumDepth);
    expect(String(sessionId)).toBe(session.id);
  }
}

test.describe("MWD Monitoring System - Functional Testing", () => {
  test.beforeAll(async ({ request }) => {
    const environmentSessions = getEnvironmentSessions();

    if (allSessionIdsAvailable(environmentSessions)) {
      runtimeConfig = {
        sessions: environmentSessions,
      };
      return;
    }

    const engineerToken = await getApiToken(request, "engineer");
    runtimeConfig = {
      sessions: await resolveSessions(request, engineerToken),
    };
  });

  test.afterEach(async ({ page }, testInfo) => {
    await testInfo.attach("final-page", {
      body: Buffer.from(await page.content()),
      contentType: "text/html",
    });
  });

  test("FT-01 Login valid", async ({ page }) => {
    await loginViaUi(page, "engineer");

    await expect(byTestId(page, SELECTORS.dashboardPage)).toBeVisible();
    await expect(byTestId(page, SELECTORS.loginError)).toHaveCount(0);
  });

  test("FT-02 Login tidak valid", async ({ page }) => {
    await page.goto(LOGIN_PATH);

    await byTestId(page, SELECTORS.loginIdentifier).fill("invalid_user");
    await byTestId(page, SELECTORS.loginPassword).fill("wrong-password");
    await byTestId(page, SELECTORS.loginSubmit).click();

    await expect(byTestId(page, SELECTORS.loginError)).toBeVisible();
    await expect(byTestId(page, SELECTORS.dashboardPage)).toHaveCount(0);
  });

  test("FT-03 Pemilihan active MWD session", async ({ page }) => {
    await authenticate(page, "engineer");
    await page.goto(DASHBOARD_PATH);

    await expect(byTestId(page, SELECTORS.dashboardPage)).toBeVisible({
      timeout: 15_000,
    });

    const expectedSession = runtimeConfig.sessions.comparison;
    const dataResponsePromise = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());

        return (
          url.pathname === "/api/mwd-data" &&
          url.searchParams.get("sessionId") === expectedSession.id &&
          response.request().method() === "GET"
        );
      },
      { timeout: 30_000 },
    );

    await selectSession(page, expectedSession);

    const dataResponse = await dataResponsePromise;
    expect(
      dataResponse.ok(),
      `Request data session gagal: ${dataResponse.status()}`,
    ).toBeTruthy();

    await expect(
      byTestId(page, SELECTORS.activeSessionLabel),
    ).toContainText(expectedSession.name);
  });

  test("FT-04 Dashboard hanya menampilkan data session aktif", async ({
    page,
  }) => {
    await loginAndSelectActive(page);

    await expect
      .poll(
        async () => byTestId(page, SELECTORS.dashboardDataRow).count(),
        {
          timeout: 15_000,
          message: "Menunggu data dashboard session aktif",
        },
      )
      .toBeGreaterThan(0);

    const rows = await byTestId(page, SELECTORS.dashboardDataRow).all();

    for (const row of rows) {
      expect(await row.getAttribute("data-session-id")).toBe(
        runtimeConfig.sessions.active.id,
      );
    }

    await expect(
      page.locator(
        `[data-testid="${SELECTORS.dashboardDataRow}"]` +
          `[data-session-id="${runtimeConfig.sessions.comparison.id}"]`,
      ),
    ).toHaveCount(0);
  });

  test("FT-05 Chart diperbarui saat data baru masuk", async ({
    page,
    request,
  }) => {
    await loginAndSelectActive(page);
    await expect(byTestId(page, SELECTORS.dashboardChart)).toBeVisible();

    const latestValue = byTestId(page, SELECTORS.chartLatestValue);
    const before = await latestValue.textContent();
    const depth = 1500 + Math.floor(Math.random() * 100);

    await ingestMwdData(request, runtimeConfig.sessions.active, depth);

    await expect(latestValue).not.toHaveText(before ?? "", {
      timeout: 30_000,
    });
    await expect(latestValue).toContainText(String(depth), {
      timeout: 30_000,
    });
  });

  test("FT-06 Well plot menampilkan urutan depth dengan benar", async ({
    page,
    request,
  }) => {
    await loginAndSelectActive(page);
    await openWellPlot(page);
    await ensureWellPlotPoints(page, request);

    const points = await byTestId(page, SELECTORS.wellPlotPoint).all();
    const depths: number[] = [];

    for (const point of points) {
      depths.push(
        parseNumericAttribute(
          await point.getAttribute("data-depth"),
          "data-depth",
        ),
      );
    }

    expect(depths).toEqual([...depths].sort((left, right) => left - right));
  });

  test("FT-07 Historical filter berdasarkan waktu", async ({
    page,
    request,
  }) => {
    const filters = await ensureFilterData(request);
    await loginAndSelectActive(page);
    await openHistorical(page);

    await byTestId(page, SELECTORS.historicalTimeFrom).fill(
      filters.timeFrom,
    );
    await byTestId(page, SELECTORS.historicalTimeTo).fill(filters.timeTo);

    const result = await applyHistoricalFilter(page);

    expect(result.url.searchParams.get("measuredFrom")).toBe(
      datetimeLocalToUtcIso(filters.timeFrom),
    );
    expect(result.url.searchParams.get("measuredTo")).toBe(
      datetimeLocalToUtcIso(filters.timeTo),
    );

    await expectHistoricalRowsWithinTime(
      page,
      filters.timeFrom,
      filters.timeTo,
      result.responseBody,
    );
  });

  test("FT-08 Historical filter berdasarkan depth", async ({
    page,
    request,
  }) => {
    const filters = await ensureFilterData(request);
    await loginAndSelectActive(page);
    await openHistorical(page);

    await byTestId(page, SELECTORS.historicalDepthMin).fill(
      filters.depthMin,
    );
    await byTestId(page, SELECTORS.historicalDepthMax).fill(
      filters.depthMax,
    );

    const result = await applyHistoricalFilter(page);

    expect(result.url.searchParams.get("depthMin")).toBe(filters.depthMin);
    expect(result.url.searchParams.get("depthMax")).toBe(filters.depthMax);

    await expectHistoricalRowsWithinDepth(
      page,
      filters.depthMin,
      filters.depthMax,
      result.responseBody,
    );
  });

  test("FT-09 Filter waktu dan depth bekerja bersamaan", async ({
    page,
    request,
  }) => {
    const filters = await ensureFilterData(request);
    await loginAndSelectActive(page);
    await openHistorical(page);
    await fillHistoricalCombinedFilter(page, filters);

    const result = await applyHistoricalFilter(page);

    expect(result.url.searchParams.get("measuredFrom")).toBe(
      datetimeLocalToUtcIso(filters.combinedTimeFrom),
    );
    expect(result.url.searchParams.get("measuredTo")).toBe(
      datetimeLocalToUtcIso(filters.combinedTimeTo),
    );
    expect(result.url.searchParams.get("depthMin")).toBe(
      filters.combinedDepthMin,
    );
    expect(result.url.searchParams.get("depthMax")).toBe(
      filters.combinedDepthMax,
    );

    await expectHistoricalRowsWithinTime(
      page,
      filters.combinedTimeFrom,
      filters.combinedTimeTo,
      result.responseBody,
    );
    await expectHistoricalRowsWithinDepth(
      page,
      filters.combinedDepthMin,
      filters.combinedDepthMax,
      result.responseBody,
    );
  });

  test("FT-10 Export CSV berhasil", async ({ page, request }) => {
    const filters = await ensureFilterData(request);
    await loginAndSelectActive(page);
    await openHistorical(page);
    await fillHistoricalCombinedFilter(page, filters);
    await applyHistoricalFilter(page);

    const downloadPromise = page.waitForEvent("download");
    await byTestId(page, SELECTORS.historicalExportCsv).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);

    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();

    const csvContent = fs.readFileSync(downloadedPath!, "utf8");
    expect(csvContent.trim().length).toBeGreaterThan(0);

    const csv = parseCsv(csvContent);
    expect(csv.headers.length).toBeGreaterThan(0);
    expect(csv.rows.length).toBeGreaterThan(0);

    expectCsvRowsMatchCombinedFilter(
      csv,
      runtimeConfig.sessions.active,
      filters,
    );
  });

  test("FT-11 Admin dapat membuka user management", async ({ page }) => {
    await authenticate(page, "admin");
    await page.goto(ADMIN_PATH);

    await expect(byTestId(page, SELECTORS.adminPage)).toBeVisible();
    await byTestId(page, SELECTORS.navUserManagement).click();
    await expect(
      byTestId(page, SELECTORS.userManagementPage),
    ).toBeVisible();
  });

  test("FT-12 Operator tidak dapat membuka halaman admin", async ({
    page,
  }) => {
    await authenticate(page, "operator");
    await page.goto(DASHBOARD_PATH);

    await expect(byTestId(page, SELECTORS.dashboardPage)).toBeVisible();
    await expect(byTestId(page, SELECTORS.navAdmin)).toHaveCount(0);

    await page.goto(ADMIN_PATH);

    await expect(byTestId(page, SELECTORS.accessDenied)).toBeVisible();
    await expect(
      byTestId(page, SELECTORS.userManagementPage),
    ).toHaveCount(0);
  });

  test("FT-13 Status disconnected muncul saat koneksi putus", async ({
    page,
    context,
  }) => {
    await loginAndSelectActive(page);

    await expect(byTestId(page, SELECTORS.connectionStatus)).toContainText(
      /connected|degraded/i,
      { timeout: 30_000 },
    );

    await context.setOffline(true);

    await expect(byTestId(page, SELECTORS.connectionStatus)).toContainText(
      /offline|disconnected/i,
      { timeout: 30_000 },
    );
  });

  test("FT-14 Data kembali diperbarui setelah reconnect", async ({
    page,
    context,
    request,
  }) => {
    await loginAndSelectActive(page);

    const latestValue = byTestId(page, SELECTORS.chartLatestValue);

    await context.setOffline(true);
    await expect(byTestId(page, SELECTORS.connectionStatus)).toContainText(
      /offline|disconnected/i,
      { timeout: 30_000 },
    );

    await context.setOffline(false);
    await expect(byTestId(page, SELECTORS.connectionStatus)).toContainText(
      /connected|degraded/i,
      { timeout: 30_000 },
    );

    const depth = 1700 + Math.floor(Math.random() * 100);
    await ingestMwdData(request, runtimeConfig.sessions.active, depth);

    await expect(latestValue).toContainText(String(depth), {
      timeout: 30_000,
    });
    await expect(
      byTestId(page, SELECTORS.dashboardDataRow).last(),
    ).toHaveAttribute(
      "data-session-id",
      runtimeConfig.sessions.active.id,
    );
  });

  test("FT-15 Empty state muncul ketika session tidak memiliki data", async ({
    page,
  }) => {
    await authenticate(page, "engineer");
    await page.goto(DASHBOARD_PATH);

    await expect(byTestId(page, SELECTORS.dashboardPage)).toBeVisible();
    await selectSession(page, runtimeConfig.sessions.empty);

    await expect(byTestId(page, SELECTORS.emptyState)).toBeVisible({
      timeout: 15_000,
    });
    await expect(byTestId(page, SELECTORS.dashboardDataRow)).toHaveCount(0);
    await expect(byTestId(page, SELECTORS.chartLatestValue)).toContainText(
      "-",
    );
  });
});
