import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

export const API_URL = process.env.E2E_API_URL || "http://localhost:5002";
export const LOGIN_PATH = process.env.E2E_LOGIN_PATH || "/login";
export const DASHBOARD_PATH = process.env.E2E_DASHBOARD_PATH || "/dashboard";
export const WELL_PLOT_PATH =
  process.env.E2E_WELL_PLOT_PATH || "/trajectory/well-plot";
export const HISTORICAL_PATH = process.env.E2E_HISTORICAL_PATH || "/history";

export const SELECTORS = {
  loginIdentifier: "login-identifier",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  dashboardPage: "dashboard-page",
  activeSessionSelect: "active-session-select",
  activeSessionLabel: "active-session-label",
  chartLatestValue: "chart-latest-value",
  connectionStatus: "connection-status",
  wellPlotPage: "well-plot-page",
  wellPlotPoint: "well-plot-point",
  historicalPage: "historical-page",
  historicalTimeFrom: "historical-time-from",
  historicalTimeTo: "historical-time-to",
  historicalDepthMin: "historical-depth-min",
  historicalDepthMax: "historical-depth-max",
  historicalApplyFilter: "historical-apply-filter",
  historicalExportCsv: "historical-export-csv",
} as const;

export type TestSession = {
  id: string;
  name: string;
};

export type IngestResult = {
  payload: Record<string, unknown>;
  status: number;
  responseBody: Record<string, unknown> | null;
  backendReceivedTimestamp?: number;
};

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
}

export function apiPath(apiRoute: string): string {
  return `${API_URL}${apiRoute}`;
}

export function activeSession(): TestSession {
  return {
    id: process.env.E2E_ACTIVE_SESSION_ID || "1",
    name: process.env.E2E_ACTIVE_SESSION_NAME || "TEST-MWD-001",
  };
}

export async function loginAsEngineer(page: Page) {
  const username = process.env.E2E_ENGINEER_USERNAME || "engineer_test";
  const password =
    process.env.E2E_ENGINEER_PASSWORD || process.env.E2E_TEST_PASSWORD;

  if (!password) {
    throw new Error(
      "E2E_ENGINEER_PASSWORD or E2E_TEST_PASSWORD environment variable is required.",
    );
  }

  await page.goto(LOGIN_PATH);
  await page.getByTestId(SELECTORS.loginIdentifier).fill(username);
  await page.getByTestId(SELECTORS.loginPassword).fill(password);
  await page.getByTestId(SELECTORS.loginSubmit).click();

  try {
    await expect(page.getByTestId(SELECTORS.dashboardPage)).toBeVisible({
      timeout: 30_000,
    });
  } catch (error) {
    const loginError = await page
      .getByTestId("login-error")
      .textContent()
      .catch(() => "");
    const currentUrl = page.url();

    throw new Error(
      [
        "Login did not reach dashboard.",
        `Current URL: ${currentUrl}.`,
        loginError ? `Login error: ${loginError.trim()}.` : "",
        "Check backend reachability, CORS_ORIGIN, and NEXT_PUBLIC_API_BASE_URL/NEXT_PUBLIC_API_URL.",
      ]
        .filter(Boolean)
        .join(" "),
      { cause: error },
    );
  }
}

export async function selectActiveSession(page: Page, session = activeSession()) {
  await page.goto(DASHBOARD_PATH);
  await expect(page.getByTestId(SELECTORS.dashboardPage)).toBeVisible();

  const select = page.getByTestId(SELECTORS.activeSessionSelect);
  await select.click();

  const nativeTagName = await select.evaluate((element) =>
    element.tagName.toLowerCase(),
  );

  if (nativeTagName === "select") {
    await select.selectOption({ label: session.name });
  } else {
    await page.getByRole("option", { name: session.name }).click();
  }

  await expect(page.getByTestId(SELECTORS.activeSessionLabel)).toContainText(
    session.name,
    { timeout: 30_000 },
  );
}

export async function waitForConnected(page: Page, timeout = 30_000) {
  await expect
    .poll(
      async () =>
        (await page.getByTestId(SELECTORS.connectionStatus).textContent()) ?? "",
      { timeout },
    )
    .toMatch(/connected/i);
}

export function buildGatewayHeaders(payload: Record<string, unknown>) {
  const gatewayKey =
    process.env.E2E_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY;
  const gatewayHmacSecret =
    process.env.E2E_GATEWAY_HMAC_SECRET || process.env.GATEWAY_HMAC_SECRET || "";
  const gatewayHeaderName =
    process.env.E2E_GATEWAY_HEADER_NAME || "x-gateway-key";
  const gatewayAuthMode = process.env.E2E_GATEWAY_AUTH_MODE || "header";

  if (!gatewayKey) {
    throw new Error(
      "E2E_GATEWAY_API_KEY or GATEWAY_API_KEY environment variable is required.",
    );
  }

  const headers: Record<string, string> = {};
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

  return headers;
}

export async function ingestMwdData(
  request: APIRequestContext,
  options: {
    session: TestSession;
    sequenceId: string;
    sourceTimestampMs: number;
    depth: number;
  },
): Promise<IngestResult> {
  const ingestionPath = process.env.E2E_INGEST_PATH || "/api/gateway/mwd-data";
  const payload = {
    sessionId: Number(options.session.id),
    measuredAt: new Date(options.sourceTimestampMs).toISOString(),
    depthMd: options.depth,
    hole_depth: options.depth + 2,
    inclination: 12.25,
    azimuth: 143.5,
    gammaRay: 85.2,
    temperature: 74.5,
    standpipePressure: 2600,
    rop: 22.5,
    gatewaySequence: options.sequenceId,
  };

  const response = await request.post(apiPath(ingestionPath), {
    headers: buildGatewayHeaders(payload),
    data: payload,
    failOnStatusCode: false,
  });
  const status = response.status();
  const responseBody = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const data = Array.isArray(responseBody?.data)
    ? (responseBody.data[0] as Record<string, unknown> | undefined)
    : undefined;
  const backendReceivedTimestamp =
    typeof data?.backendReceivedTimestamp === "number"
      ? data.backendReceivedTimestamp
      : undefined;

  return {
    payload,
    status,
    responseBody,
    backendReceivedTimestamp,
  };
}

export function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
