import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const resultsRoot = path.join(root, "tests", "results", "compatibility");
const rawRoot = path.join(resultsRoot, "raw");

const platforms = [
  { projectName: "chrome-desktop", platform: "Chrome desktop" },
  { projectName: "edge-desktop", platform: "Edge desktop" },
  { projectName: "firefox-desktop", platform: "Firefox desktop" },
  { projectName: "android-chrome-emulated", platform: "Android Chrome emulation" },
  {
    projectName: "safari-mobile-emulated",
    platform: "Safari Mobile WebKit emulation",
  },
];

function csv(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function passFail(status) {
  return status === "passed" ? "PASS" : "FAIL";
}

function readRaw(projectName, platform) {
  const filePath = path.join(rawRoot, `${projectName}.json`);
  if (!fs.existsSync(filePath)) {
    return {
      platform,
      projectName,
      browserVersion: "missing",
      deviceProfile: "missing",
      viewport: { width: 0, height: 0 },
      testType: "missing",
      tests: {
        login: { status: "failed", failureReason: "Raw result missing" },
        dashboard: { status: "failed", failureReason: "Raw result missing" },
        plot: { status: "failed", failureReason: "Raw result missing" },
        export: { status: "failed", failureReason: "Raw result missing" },
      },
      layoutDefects: [],
      consoleErrors: [],
      pageErrors: ["Raw result missing"],
      overallResult: "failed",
      missing: true,
    };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

fs.mkdirSync(resultsRoot, { recursive: true });

const rawResults = platforms.map(({ projectName, platform }) =>
  readRaw(projectName, platform),
);

let playwrightTotals = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  interrupted: 0,
};

const playwrightJsonPath = path.join(
  resultsRoot,
  "compatibility-playwright-results.json",
);
const projectResultsRoot = path.join(resultsRoot, "project-results");
const projectReports = fs.existsSync(projectResultsRoot)
  ? fs
      .readdirSync(projectResultsRoot)
      .filter((name) => name.endsWith(".json"))
      .map((name) => JSON.parse(fs.readFileSync(path.join(projectResultsRoot, name), "utf8")))
  : [];
if (projectReports.length > 0) {
  for (const report of projectReports) {
  const specs = [];
  for (const suite of report.suites ?? []) {
    for (const specFile of suite.suites ?? []) {
      for (const spec of specFile.specs ?? []) {
        specs.push(spec);
      }
    }
  }
  for (const spec of specs) {
    for (const test of spec.tests ?? []) {
      playwrightTotals.total += 1;
      const result = test.outcome ?? test.results?.at(-1)?.status ?? "unknown";
      if (result === "expected" || result === "passed") playwrightTotals.passed += 1;
      else if (result === "skipped") playwrightTotals.skipped += 1;
      else if (result === "interrupted" || result === "timedOut") {
        playwrightTotals.interrupted += 1;
      } else {
        playwrightTotals.failed += 1;
      }
    }
  }
}
} else if (fs.existsSync(playwrightJsonPath)) {
  const report = JSON.parse(fs.readFileSync(playwrightJsonPath, "utf8"));
  const specs = [];
  for (const suite of report.suites ?? []) {
    for (const specFile of suite.suites ?? []) {
      for (const spec of specFile.specs ?? []) {
        specs.push(spec);
      }
    }
  }
  for (const spec of specs) {
    for (const test of spec.tests ?? []) {
      playwrightTotals.total += 1;
      const result = test.outcome ?? test.results?.at(-1)?.status ?? "unknown";
      if (result === "expected" || result === "passed") playwrightTotals.passed += 1;
      else if (result === "skipped") playwrightTotals.skipped += 1;
      else if (result === "interrupted" || result === "timedOut") {
        playwrightTotals.interrupted += 1;
      } else {
        playwrightTotals.failed += 1;
      }
    }
  }
}

const summaryRows = rawResults.map((raw) => {
  const viewport =
    raw.deviceProfile && raw.deviceProfile !== "1440x900"
      ? raw.deviceProfile
      : `${raw.viewport?.width ?? 0}x${raw.viewport?.height ?? 0}`;
  return {
    platform: raw.platform,
    browser_version: raw.browserVersion ?? "unknown",
    device_or_viewport: viewport,
    test_type: raw.testType ?? (raw.emulated ? "emulation" : "native desktop"),
    login: passFail(raw.tests?.login?.status),
    dashboard: passFail(raw.tests?.dashboard?.status),
    plot: passFail(raw.tests?.plot?.status),
    export: passFail(raw.tests?.export?.status),
    layout_defects: raw.layoutDefects?.length ?? 0,
    console_errors: raw.consoleErrors?.length ?? 0,
    overall_result: passFail(raw.overallResult),
  };
});

const allDefects = rawResults.flatMap((raw) =>
  (raw.layoutDefects ?? []).map((defect) => ({
    platform: raw.platform,
    severity: defect.severity,
    page: defect.page,
    element: defect.element,
    description: defect.description,
    screenshot: defect.screenshot,
  })),
);

const testStatuses = rawResults.flatMap((raw) =>
  ["login", "dashboard", "plot", "export"].map((key) => raw.tests?.[key]?.status),
);
const totals = {
  platformsTested: rawResults.length,
  totalTestCases: testStatuses.length,
  passed: testStatuses.filter((status) => status === "passed").length,
  failed: testStatuses.filter((status) => status === "failed").length,
  skipped: playwrightTotals.skipped,
  interrupted: playwrightTotals.interrupted,
  passRate:
    testStatuses.length > 0
      ? Number(
          (
            (testStatuses.filter((status) => status === "passed").length /
              testStatuses.length) *
            100
          ).toFixed(2),
        )
      : 0,
  criticalDefects: allDefects.filter((defect) => defect.severity === "critical").length,
  majorDefects: allDefects.filter((defect) => defect.severity === "major").length,
  minorDefects: allDefects.filter((defect) => defect.severity === "minor").length,
};

const approved =
  totals.platformsTested === 5 &&
  totals.totalTestCases === 20 &&
  totals.passed === 20 &&
  totals.failed === 0 &&
  totals.skipped === 0 &&
  totals.interrupted === 0 &&
  totals.criticalDefects === 0 &&
  totals.majorDefects === 0 &&
  rawResults.every((raw) => (raw.pageErrors ?? []).length === 0);

const summary = {
  status: approved ? "APPROVED" : "NOT APPROVED",
  generatedAt: new Date().toISOString(),
  totals,
  playwrightTotals,
  methodology:
    "Desktop Chrome and Edge tests used installed browser channels. Android Chrome was evaluated using the Playwright Pixel 7 device profile. Safari Mobile compatibility was evaluated using Playwright WebKit with an iPhone 14 device profile. The mobile results represent browser-engine and viewport emulation, not physical-device testing.",
  platforms: rawResults,
  paperTable: summaryRows.map((row) => ({
    Platform: row.platform,
    Login: row.login,
    Dashboard: row.dashboard,
    Plot: row.plot,
    Export: row.export,
  })),
};

fs.writeFileSync(
  path.join(resultsRoot, "compatibility-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);

fs.writeFileSync(
  playwrightJsonPath,
  `${JSON.stringify(
    {
      aggregate: true,
      generatedAt: summary.generatedAt,
      totals: playwrightTotals,
      projectReports: projectReports.map((report) => ({
        config: report.config,
        stats: report.stats,
      })),
    },
    null,
    2,
  )}\n`,
);

fs.writeFileSync(
  path.join(resultsRoot, "compatibility-junit.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="compatibility" tests="${totals.totalTestCases}" failures="${totals.failed}" skipped="${totals.skipped}"></testsuite>\n`,
);

fs.writeFileSync(
  path.join(resultsRoot, "compatibility-summary.csv"),
  [
    "platform,browser_version,device_or_viewport,test_type,login,dashboard,plot,export,layout_defects,console_errors,overall_result",
    ...summaryRows.map((row) =>
      [
        row.platform,
        row.browser_version,
        row.device_or_viewport,
        row.test_type,
        row.login,
        row.dashboard,
        row.plot,
        row.export,
        row.layout_defects,
        row.console_errors,
        row.overall_result,
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n") + "\n",
);

fs.writeFileSync(
  path.join(resultsRoot, "layout-defects.csv"),
  [
    "platform,severity,page,element,description,screenshot",
    ...allDefects.map((defect) =>
      [
        defect.platform,
        defect.severity,
        defect.page,
        defect.element,
        defect.description,
        defect.screenshot,
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n") + "\n",
);

console.log(
  `Compatibility summary: ${summary.status} (${totals.passed}/${totals.totalTestCases} passed)`,
);

if (!approved) {
  process.exitCode = 1;
}
