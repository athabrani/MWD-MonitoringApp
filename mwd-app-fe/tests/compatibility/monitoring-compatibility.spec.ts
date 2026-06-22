import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  activeSession,
  LOGIN_PATH,
  selectActiveSession,
  SELECTORS,
} from "../helpers/mwd-test-helpers";

type TestKey = "login" | "dashboard" | "plot" | "export";
type TestStatus = "passed" | "failed" | "pending";
type DefectSeverity = "critical" | "major" | "minor" | "none";

type CompatibilityTestResult = {
  status: TestStatus;
  durationMs: number;
  failureReason: string;
  fileSizeBytes?: number;
  headerCount?: number;
  rowCount?: number;
  invalidRowCount?: number;
};

type LayoutDefect = {
  severity: DefectSeverity;
  page: string;
  element: string;
  description: string;
  screenshot: string;
  browserProject: string;
  viewport: string;
};

type RawCompatibilityResult = {
  platform: string;
  projectName: string;
  browserName: string;
  browserEngine: string;
  browserVersion: string;
  deviceProfile: string;
  viewport: {
    width: number;
    height: number;
  };
  operatingSystem: string;
  testType: "native desktop" | "emulation";
  emulated: boolean;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent: string;
  tests: Record<TestKey, CompatibilityTestResult>;
  layoutDefects: LayoutDefect[];
  consoleErrors: string[];
  pageErrors: string[];
  failedNetworkRequests: string[];
  overallResult: TestStatus;
};

const resultsDir = path.resolve(
  process.cwd(),
  "..",
  "tests",
  "results",
  "compatibility",
);
const rawDir = path.join(resultsDir, "raw");
const screenshotsDir = path.join(resultsDir, "screenshots");
const downloadsDir = path.join(resultsDir, "downloads");

const projectMetadata: Record<
  string,
  { platform: string; deviceProfile: string; emulated: boolean; engine: string }
> = {
  "chrome-desktop": {
    platform: "Chrome desktop",
    deviceProfile: "1440x900",
    emulated: false,
    engine: "Chromium",
  },
  "edge-desktop": {
    platform: "Edge desktop",
    deviceProfile: "1440x900",
    emulated: false,
    engine: "Chromium",
  },
  "firefox-desktop": {
    platform: "Firefox desktop",
    deviceProfile: "1440x900",
    emulated: false,
    engine: "Firefox",
  },
  "android-chrome-emulated": {
    platform: "Android Chrome emulation",
    deviceProfile: "Pixel 7",
    emulated: true,
    engine: "Chromium",
  },
  "safari-mobile-emulated": {
    platform: "Safari Mobile WebKit emulation",
    deviceProfile: "iPhone 14",
    emulated: true,
    engine: "WebKit",
  },
};

let cachedEngineerToken = "";

function extractToken(payload: Record<string, unknown> | null) {
  const data =
    payload && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : {};
  return String(
    payload?.token ??
      payload?.accessToken ??
      data.token ??
      data.accessToken ??
      "",
  );
}

async function getEngineerToken(request: APIRequestContext) {
  if (cachedEngineerToken) {
    return cachedEngineerToken;
  }

  const environmentToken = process.env.E2E_ENGINEER_TOKEN?.trim();
  if (environmentToken) {
    cachedEngineerToken = environmentToken;
    return cachedEngineerToken;
  }

  const username = process.env.E2E_ENGINEER_USERNAME || "engineer_test";
  const password = process.env.E2E_ENGINEER_PASSWORD || process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error("E2E_ENGINEER_PASSWORD or E2E_TEST_PASSWORD is required.");
  }

  const response = await request.post(`${process.env.E2E_API_URL ?? "http://localhost:5002"}/api/auth/login`, {
    headers: {
      Authorization: "Bearer e2e-login-bootstrap",
    },
    data: {
      identifier: username,
      password,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(`API engineer authentication failed: HTTP ${response.status()}`);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const token = extractToken(payload);
  if (!token) {
    throw new Error("API engineer authentication did not return an exposed token.");
  }

  cachedEngineerToken = token;
  return token;
}

async function authenticateEngineerSession(
  page: Page,
  request: APIRequestContext,
) {
  const token = await getEngineerToken(request);
  await page.addInitScript(
    ({ authToken, sessionId }) => {
      window.localStorage.setItem("mwd_auth_token", authToken);
      window.localStorage.setItem("mwd_active_session_id", sessionId);
    },
    {
      authToken: token,
      sessionId: activeSession().id,
    },
  );
}

function readTimestamp(record: Record<string, unknown>) {
  return String(
    record.measuredAt ??
      record.measured_at ??
      record.timestamp ??
      record.createdAt ??
      record.created_at ??
      "",
  );
}

function readDepth(record: Record<string, unknown>) {
  const value =
    record.depthMd ??
    record.depth_md ??
    record.measuredDepth ??
    record.measured_depth ??
    record.depth ??
    record.holeDepth ??
    record.hole_depth;
  return typeof value === "number" ? value : Number(value);
}

function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "records", "items", "rows"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
}

function floorUtcMinute(timestampMs: number) {
  return new Date(Math.floor(timestampMs / 60_000) * 60_000).toISOString().slice(0, 16);
}

function ceilUtcMinute(timestampMs: number) {
  return new Date((Math.floor(timestampMs / 60_000) + 1) * 60_000).toISOString().slice(0, 16);
}

async function getHistoricalFilterValues(request: APIRequestContext) {
  const token = await getEngineerToken(request);
  const url = new URL(`${process.env.E2E_API_URL ?? "http://localhost:5002"}/api/historical-data`);
  url.searchParams.set("sessionId", activeSession().id);
  url.searchParams.set("limit", "1000");

  const response = await request.get(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    throw new Error(`Historical seed lookup failed: HTTP ${response.status()}`);
  }

  const records = extractRecords(await response.json()).flatMap((record) => {
    const timestamp = readTimestamp(record);
    const timestampMs = new Date(timestamp).getTime();
    const depth = readDepth(record);
    return timestamp && Number.isFinite(timestampMs) && Number.isFinite(depth)
      ? [{ timestampMs, depth }]
      : [];
  });

  if (records.length === 0) {
    throw new Error("No historical records available for compatibility export filter.");
  }

  const byTime = [...records].sort((left, right) => left.timestampMs - right.timestampMs);
  const byDepth = [...records].sort((left, right) => left.depth - right.depth);

  return {
    timeFrom: floorUtcMinute(byTime[0].timestampMs),
    timeTo: ceilUtcMinute(byTime[byTime.length - 1].timestampMs),
    depthMin: Number(byDepth[0].depth.toFixed(6)).toString(),
    depthMax: Number(byDepth[byDepth.length - 1].depth.toFixed(6)).toString(),
    minimumDepth: byDepth[0].depth,
    maximumDepth: byDepth[byDepth.length - 1].depth,
  };
}

const emptyTest = (): CompatibilityTestResult => ({
  status: "pending",
  durationMs: 0,
  failureReason: "",
});

test.beforeAll(async ({}, workerInfo) => {
  ensureDirs();
  const filePath = rawPath(workerInfo.project.name);
  if (!fs.existsSync(filePath)) {
    writeRaw({
      platform: projectMetadata[workerInfo.project.name]?.platform ?? workerInfo.project.name,
      projectName: workerInfo.project.name,
      browserName: "pending",
      browserEngine: projectMetadata[workerInfo.project.name]?.engine ?? "pending",
      browserVersion: "pending",
      deviceProfile: projectMetadata[workerInfo.project.name]?.deviceProfile ?? "pending",
      viewport: { width: 0, height: 0 },
      operatingSystem: `${process.platform} ${process.arch}`,
      testType: projectMetadata[workerInfo.project.name]?.emulated ? "emulation" : "native desktop",
      emulated: projectMetadata[workerInfo.project.name]?.emulated ?? false,
      deviceScaleFactor: 0,
      isMobile: projectMetadata[workerInfo.project.name]?.emulated ?? false,
      hasTouch: false,
      userAgent: "pending",
      tests: {
        login: emptyTest(),
        dashboard: emptyTest(),
        plot: emptyTest(),
        export: emptyTest(),
      },
      layoutDefects: [],
      consoleErrors: [],
      pageErrors: [],
      failedNetworkRequests: [],
      overallResult: "pending",
    });
  }
});

function rawPath(projectName: string) {
  return path.join(rawDir, `${projectName}.json`);
}

function ensureDirs() {
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(downloadsDir, { recursive: true });
}

async function getRuntimeMetadata(page: Page, testInfo: TestInfo) {
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const project = projectMetadata[testInfo.project.name] ?? {
    platform: testInfo.project.name,
    deviceProfile: `${viewport.width}x${viewport.height}`,
    emulated: /emulated/i.test(testInfo.project.name),
    engine: testInfo.project.name,
  };
  const runtime = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    deviceScaleFactor: window.devicePixelRatio,
    hasTouch: navigator.maxTouchPoints > 0,
  }));

  return {
    project,
    viewport,
    runtime,
  };
}

async function readOrCreateRaw(page: Page, testInfo: TestInfo): Promise<RawCompatibilityResult> {
  ensureDirs();
  const filePath = rawPath(testInfo.project.name);
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawCompatibilityResult;
    const { project, viewport, runtime } = await getRuntimeMetadata(page, testInfo);
    const projectUse = testInfo.project.use as {
      browserName?: string;
      hasTouch?: boolean;
      isMobile?: boolean;
    };
    existing.platform = project.platform;
    existing.browserName = projectUse.browserName?.toString() ?? existing.browserName;
    existing.browserEngine = project.engine;
    existing.browserVersion = page.context().browser()?.version() ?? existing.browserVersion;
    existing.deviceProfile = project.deviceProfile;
    existing.viewport = viewport;
    existing.operatingSystem = `${process.platform} ${process.arch}`;
    existing.testType = project.emulated ? "emulation" : "native desktop";
    existing.emulated = project.emulated;
    existing.deviceScaleFactor = Number(runtime.deviceScaleFactor) || existing.deviceScaleFactor;
    existing.isMobile = Boolean(projectUse.isMobile ?? project.emulated);
    existing.hasTouch = Boolean(projectUse.hasTouch ?? runtime.hasTouch);
    existing.userAgent = runtime.userAgent;
    return existing;
  }

  const { project, viewport, runtime } = await getRuntimeMetadata(page, testInfo);
  const projectUse = testInfo.project.use as {
    browserName?: string;
    hasTouch?: boolean;
    isMobile?: boolean;
  };
  const isMobile = Boolean(projectUse.isMobile ?? project.emulated);

  return {
    platform: project.platform,
    projectName: testInfo.project.name,
    browserName: projectUse.browserName?.toString() ?? "chromium",
    browserEngine: project.engine,
    browserVersion: page.context().browser()?.version() ?? "unknown",
    deviceProfile: project.deviceProfile,
    viewport,
    operatingSystem: `${process.platform} ${process.arch}`,
    testType: project.emulated ? "emulation" : "native desktop",
    emulated: project.emulated,
    deviceScaleFactor: Number(runtime.deviceScaleFactor) || 1,
    isMobile,
    hasTouch: Boolean(projectUse.hasTouch ?? runtime.hasTouch),
    userAgent: runtime.userAgent,
    tests: {
      login: emptyTest(),
      dashboard: emptyTest(),
      plot: emptyTest(),
      export: emptyTest(),
    },
    layoutDefects: [],
    consoleErrors: [],
    pageErrors: [],
    failedNetworkRequests: [],
    overallResult: "pending",
  };
}

function writeRaw(result: RawCompatibilityResult) {
  const statuses = Object.values(result.tests).map((item) => item.status);
  const hasFailedTest = statuses.includes("failed");
  const hasPendingTest = statuses.includes("pending");
  const hasCriticalDefect = result.layoutDefects.some(
    (defect) => defect.severity === "critical" || defect.severity === "major",
  );

  result.overallResult =
    hasFailedTest || hasCriticalDefect
      ? "failed"
      : hasPendingTest
        ? "pending"
        : "passed";

  const destination = rawPath(result.projectName);
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`);
  fs.renameSync(temporary, destination);
}

function uniquePush(list: string[], value: string) {
  if (!value || list.includes(value)) return;
  list.push(value);
}

function isCriticalConsoleError(message: string) {
  return /uncaught|typeerror|referenceerror|syntaxerror|failed to fetch/i.test(message);
}

async function attachCollectors(
  page: Page,
  raw: RawCompatibilityResult,
  failedApiRequests: string[],
) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    uniquePush(raw.consoleErrors, message.text().slice(0, 500));
  });

  page.on("pageerror", (error) => {
    uniquePush(raw.pageErrors, `${error.message}\n${error.stack ?? ""}`.slice(0, 1000));
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.includes("/api/")) return;
    const failure = `${request.method()} ${url} ${request.failure()?.errorText ?? ""}`.trim();
    uniquePush(raw.failedNetworkRequests, failure.slice(0, 500));
    if (/ERR_ABORTED/i.test(failure)) return;
    failedApiRequests.push(failure);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    if (response.status() < 400) return;
    const failure = `${response.request().method()} ${url} HTTP ${response.status()}`;
    uniquePush(raw.failedNetworkRequests, failure.slice(0, 500));
    failedApiRequests.push(failure);
  });
}

async function runMeasuredTest(
  page: Page,
  testInfo: TestInfo,
  key: TestKey,
  body: (raw: RawCompatibilityResult, failedApiRequests: string[]) => Promise<void>,
) {
  const raw = await readOrCreateRaw(page, testInfo);
  const failedApiRequests: string[] = [];
  await attachCollectors(page, raw, failedApiRequests);
  const startedAt = Date.now();

  try {
    await body(raw, failedApiRequests);
    if (raw.pageErrors.length > 0) {
      throw new Error(`Uncaught page errors: ${raw.pageErrors.join(" | ")}`);
    }
    const criticalConsoleErrors = raw.consoleErrors.filter(isCriticalConsoleError);
    if (criticalConsoleErrors.length > 0) {
      throw new Error(`Critical console errors: ${criticalConsoleErrors.join(" | ")}`);
    }
    if (failedApiRequests.length > 0) {
      throw new Error(`Required API request failed: ${failedApiRequests[0]}`);
    }
    raw.tests[key] = {
      ...raw.tests[key],
      status: "passed",
      durationMs: Date.now() - startedAt,
      failureReason: "",
    };
  } catch (error) {
    raw.tests[key] = {
      ...raw.tests[key],
      status: "failed",
      durationMs: Date.now() - startedAt,
      failureReason: error instanceof Error ? error.message : "Unknown failure",
    };
    writeRaw(raw);
    throw error;
  }

  writeRaw(raw);
}

async function loginAndCapture(page: Page) {
  const username = process.env.E2E_ENGINEER_USERNAME || "engineer_test";
  const password = process.env.E2E_ENGINEER_PASSWORD || process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error("E2E_ENGINEER_PASSWORD or E2E_TEST_PASSWORD is required.");
  }

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") && response.request().method() === "POST",
    { timeout: 30_000 },
  );

  await page.goto(LOGIN_PATH);
  await page.getByTestId(SELECTORS.loginIdentifier).fill(username);
  await page.getByTestId(SELECTORS.loginPassword).fill(password);
  await page.getByTestId(SELECTORS.loginSubmit).click();
  const response = await loginResponse;
  expect(response.status()).toBe(200);
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const token = extractToken(payload);
  if (token) {
    cachedEngineerToken = token;
  }
  await expect(page.getByTestId(SELECTORS.dashboardPage)).toBeVisible({
    timeout: 30_000,
  });
  expect(page.url()).not.toContain("/login");

  return response.status();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickShellNavigationItem(
  page: Page,
  targetTestId: string,
  desktopGroupLabel: string | null,
  mobileGroupLabel: string | null,
  mobileItemLabel: string,
  fallbackPath: string,
) {
  const target = page.getByTestId(targetTestId);
  if (await target.first().isVisible().catch(() => false)) {
    await target.first().click();
    return;
  }

  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobile primary navigation",
  });

  if (!(await mobileNavigation.isVisible().catch(() => false))) {
    if (desktopGroupLabel) {
      const primaryNavigation = page.getByRole("navigation", {
        name: "Primary navigation",
      });
      await primaryNavigation.getByRole("button", { name: desktopGroupLabel, exact: true }).click();
      await expect(target.first()).toBeVisible({ timeout: 30_000 });
      await target.first().click();
      return;
    }

    await page.goto(fallbackPath);
    return;
  }

  await mobileNavigation.getByRole("button").first().click();

  const dialog = page.getByRole("dialog");
  const mobileTarget = dialog.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(mobileItemLabel)}$`),
  });

  if (await mobileTarget.first().isVisible().catch(() => false)) {
    await mobileTarget.first().click();
    return;
  }

  if (!mobileGroupLabel) {
    throw new Error(`Mobile navigation item "${mobileItemLabel}" was not visible.`);
  }

  await dialog.getByRole("button", { name: mobileGroupLabel, exact: true }).click();
  await expect(mobileTarget.first()).toBeVisible({ timeout: 30_000 });
  await mobileTarget.first().click();
}

async function openWellPlotViaNavigation(page: Page) {
  await clickShellNavigationItem(
    page,
    "nav-well-plot",
    null,
    "Trajectory Analysis",
    "Well Plots",
    "/trajectory/well-plot",
  );
  await expect(page.getByTestId(SELECTORS.wellPlotPage).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function openHistoricalViaNavigation(page: Page) {
  await clickShellNavigationItem(
    page,
    "nav-historical",
    "System Utilities",
    null,
    "History",
    "/history",
  );
  await expect(page.getByTestId(SELECTORS.historicalPage).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function evaluatePageOverflow(page: Page) {
  return page.evaluate(() => ({
    documentOverflow:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
  }));
}

async function collectDashboardDefects(
  page: Page,
  raw: RawCompatibilityResult,
  screenshotPath: string,
) {
  const overflow = await evaluatePageOverflow(page);
  if (overflow.documentOverflow > 4 || overflow.bodyOverflow > 4) {
    raw.layoutDefects.push({
      severity: "critical",
      page: "dashboard",
      element: "document",
      description: `Whole-page horizontal overflow detected: document=${overflow.documentOverflow}px, body=${overflow.bodyOverflow}px.`,
      screenshot: screenshotPath,
      browserProject: raw.projectName,
      viewport: `${raw.viewport.width}x${raw.viewport.height}`,
    });
  }

  const clippedElements = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const selectors = [
      '[data-testid="dashboard-page"]',
      '[data-testid="dashboard-chart"]',
      '[data-testid="chart-latest-value"]',
      '[data-testid="connection-status"]',
    ];

    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          clipped: rect.left < -4 || rect.right > viewportWidth + 4,
        };
      }),
    );
  });

  for (const element of clippedElements) {
    if (!element.clipped) continue;
    raw.layoutDefects.push({
      severity: "critical",
      page: "dashboard",
      element: element.selector,
      description: `Element outside viewport: left=${element.left.toFixed(1)}, right=${element.right.toFixed(1)}.`,
      screenshot: screenshotPath,
      browserProject: raw.projectName,
      viewport: `${raw.viewport.width}x${raw.viewport.height}`,
    });
  }
}

async function collectPlotDefects(
  page: Page,
  raw: RawCompatibilityResult,
  screenshotPath: string,
) {
  const check = await page.evaluate(() => {
    const pageElement = document.querySelector('[data-testid="well-plot-page"]');
    const containerRect = pageElement?.getBoundingClientRect();
    const container = containerRect
      ? {
          left: containerRect.left,
          right: containerRect.right,
          top: containerRect.top,
          bottom: containerRect.bottom,
        }
      : null;
    const plotRects = pageElement
      ? Array.from(pageElement.querySelectorAll("svg,canvas"))
          .map((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              visible:
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 8 &&
                rect.height > 8,
            };
          })
          .filter((rect) => rect.visible)
      : [];
    const labels = Array.from(document.querySelectorAll("text,span,div"))
      .filter((element) => /planned|actual/i.test(element.textContent ?? ""))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() ?? "",
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0);

    return {
      container,
      plotRects,
      labels,
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  if (check.overflow > 4) {
    raw.layoutDefects.push({
      severity: "critical",
      page: "well plot",
      element: "document",
      description: `Whole-page horizontal overflow detected: ${check.overflow}px.`,
      screenshot: screenshotPath,
      browserProject: raw.projectName,
      viewport: `${raw.viewport.width}x${raw.viewport.height}`,
    });
  }

  if (check.container) {
    for (const rect of check.plotRects) {
      const outside =
        rect.left < check.container.left - 12 ||
        rect.right > check.container.right + 12;
      if (!outside) continue;
      raw.layoutDefects.push({
        severity: "critical",
        page: "well plot",
        element: "plot graphic",
        description: "Plot graphic overflows horizontally outside the well plot page container tolerance.",
        screenshot: screenshotPath,
        browserProject: raw.projectName,
        viewport: `${raw.viewport.width}x${raw.viewport.height}`,
      });
      break;
    }
  }

  const planned = check.labels.find((label) => /planned/i.test(label.text));
  const actual = check.labels.find((label) => /actual/i.test(label.text));
  if (planned && actual) {
    const overlap = !(
      planned.right < actual.left - 4 ||
      actual.right < planned.left - 4 ||
      planned.bottom < actual.top - 4 ||
      actual.bottom < planned.top - 4
    );
    if (overlap) {
      raw.layoutDefects.push({
        severity: "major",
        page: "well plot",
        element: "Planned/Actual labels",
        description: "Planned and Actual labels overlap.",
        screenshot: screenshotPath,
        browserProject: raw.projectName,
        viewport: `${raw.viewport.width}x${raw.viewport.height}`,
      });
    }
  }
}

async function saveScreenshot(page: Page, testInfo: TestInfo, stem: string) {
  const filePath = path.join(screenshotsDir, `${stem}-${testInfo.project.name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

test("COMP-01 Login", async ({ page }, testInfo) => {
  await runMeasuredTest(page, testInfo, "login", async (raw) => {
    await loginAndCapture(page);
    const metadata = await getRuntimeMetadata(page, testInfo);
    raw.browserVersion = page.context().browser()?.version() ?? raw.browserVersion;
    raw.userAgent = metadata.runtime.userAgent;
  });
});

test("COMP-02 Dashboard monitoring", async ({ page, request }, testInfo) => {
  await runMeasuredTest(page, testInfo, "dashboard", async (raw) => {
    await authenticateEngineerSession(page, request);
    await selectActiveSession(page, activeSession());
    await expect(page.getByTestId(SELECTORS.dashboardPage)).toBeVisible();
    await expect(page.getByTestId(SELECTORS.activeSessionLabel)).toContainText(
      activeSession().name,
    );
    await expect(page.getByTestId(SELECTORS.chartLatestValue)).toBeVisible();
    await expect(
      page
        .getByTestId(SELECTORS.dashboardPage)
        .getByTestId(SELECTORS.connectionStatus)
        .first(),
    ).toBeVisible();
    await expect(page.getByTestId("dashboard-data-row").first()).toBeAttached();

    const screenshotPath = await saveScreenshot(page, testInfo, "dashboard");
    await collectDashboardDefects(page, raw, screenshotPath);
    const blockingDefect = raw.layoutDefects.find(
      (defect) =>
        defect.browserProject === raw.projectName &&
        defect.page === "dashboard" &&
        (defect.severity === "critical" || defect.severity === "major"),
    );
    if (blockingDefect) {
      throw new Error(blockingDefect.description);
    }
  });
});

test("COMP-03 Well plot", async ({ page, request }, testInfo) => {
  await runMeasuredTest(page, testInfo, "plot", async (raw) => {
    await authenticateEngineerSession(page, request);
    await selectActiveSession(page, activeSession());
    await openWellPlotViaNavigation(page);
    const wellPlotPage = page.getByTestId(SELECTORS.wellPlotPage).first();
    await expect(wellPlotPage).toBeVisible();
    await expect(wellPlotPage.getByTestId(SELECTORS.wellPlotPoint).first()).toBeVisible();
    const points = wellPlotPage.getByTestId(SELECTORS.wellPlotPoint);
    await expect.poll(async () => points.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);

    const depths = await points.evaluateAll((elements) =>
      elements
        .map((element) => Number(element.getAttribute("data-depth")))
        .filter((value) => Number.isFinite(value)),
    );
    expect(depths.length).toBeGreaterThanOrEqual(2);
    const sortedDepths = [...depths].sort((left, right) => left - right);
    expect(depths).toEqual(sortedDepths);

    const screenshotPath = await saveScreenshot(page, testInfo, "well-plot");
    await collectPlotDefects(page, raw, screenshotPath);
    const blockingDefect = raw.layoutDefects.find(
      (defect) =>
        defect.browserProject === raw.projectName &&
        defect.page === "well plot" &&
        (defect.severity === "critical" || defect.severity === "major"),
    );
    if (blockingDefect) {
      throw new Error(blockingDefect.description);
    }
  });
});

test("COMP-04 Historical CSV export", async ({ page, request }, testInfo) => {
  await runMeasuredTest(page, testInfo, "export", async (raw) => {
    const filters = await getHistoricalFilterValues(request);
    await authenticateEngineerSession(page, request);
    await selectActiveSession(page, activeSession());
    await openHistoricalViaNavigation(page);
    await expect(page.getByTestId(SELECTORS.historicalPage).first()).toBeVisible();
    await page.getByTestId(SELECTORS.historicalTimeFrom).fill(filters.timeFrom);
    await page.getByTestId(SELECTORS.historicalTimeTo).fill(filters.timeTo);
    await page.getByTestId(SELECTORS.historicalDepthMin).fill(filters.depthMin);
    await page.getByTestId(SELECTORS.historicalDepthMax).fill(filters.depthMax);
    await page.getByTestId(SELECTORS.historicalApplyFilter).click();
    await expect(page.getByTestId("historical-row").first()).toBeVisible({
      timeout: 30_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(SELECTORS.historicalExportCsv).click();
    const download = await downloadPromise;
    const projectDownloadDir = path.join(downloadsDir, testInfo.project.name);
    fs.mkdirSync(projectDownloadDir, { recursive: true });
    const downloadPath = path.join(projectDownloadDir, "historical-export.csv");
    await download.saveAs(downloadPath);

    const contents = fs.readFileSync(downloadPath, "utf8");
    const rows = contents.trim().split(/\r?\n/);
    const headerCount = rows[0]?.split(",").length ?? 0;
    const dataRows = rows.slice(1).filter((row) => row.trim().length > 0);
    const invalidRows = dataRows.filter((row) => row.split(",").length !== headerCount);
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);
    expect(headerCount).toBeGreaterThan(1);
    expect(dataRows.length).toBeGreaterThan(0);
    expect(invalidRows.length).toBe(0);

    raw.tests.export.fileSizeBytes = fs.statSync(downloadPath).size;
    raw.tests.export.headerCount = headerCount;
    raw.tests.export.rowCount = dataRows.length;
    raw.tests.export.invalidRowCount = invalidRows.length;
  });
});
