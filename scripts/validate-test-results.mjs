import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultsRoot = path.join(root, "tests", "results");

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { missing: true, path: relativePath, value: null };
  }

  try {
    return {
      missing: false,
      path: relativePath,
      value: JSON.parse(fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "")),
    };
  } catch (error) {
    return {
      missing: false,
      path: relativePath,
      value: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function fail(failures, category, message, evidence = "") {
  failures.push({ category, message, evidence });
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateFunctional(failures) {
  const summary = readJson("tests/results/functional/playwright-summary.json");
  if (summary.missing) {
    fail(failures, "functional", "Functional summary is missing.", summary.path);
    return;
  }
  if (!summary.value) {
    fail(failures, "functional", "Functional summary is not valid JSON.", summary.path);
    return;
  }

  const total = number(summary.value.totalTestCases ?? summary.value.total);
  const passed = number(summary.value.passed);
  const failed = number(summary.value.failed);
  const skipped = number(summary.value.skipped);
  const interrupted = number(summary.value.interrupted);
  const timedOut = summary.value.tests?.filter?.((item) => item.status === "timedOut").length ?? 0;

  if (total !== passed + failed + skipped + interrupted) {
    fail(
      failures,
      "functional",
      `Functional counts are inconsistent: total=${total}, passed+failed+skipped+interrupted=${passed + failed + skipped + interrupted}.`,
      summary.path,
    );
  }
  if (total !== 15 || passed !== 15 || failed !== 0 || skipped !== 0 || interrupted !== 0 || timedOut !== 0) {
    fail(
      failures,
      "functional",
      `Functional result is not clean: total=${total}, passed=${passed}, failed=${failed}, skipped=${skipped}, interrupted=${interrupted}, timedOut=${timedOut}.`,
      summary.path,
    );
  }
  for (const required of [
    "tests/results/functional/playwright-results.json",
    "tests/results/functional/playwright-junit.xml",
    "tests/results/functional/playwright-report/index.html",
  ]) {
    if (!fileExists(required)) {
      fail(failures, "functional", "Required functional evidence file is missing.", required);
    }
  }
}

function validateBaselineApi(failures) {
  const summary = readJson("tests/results/api/baseline-api-summary.json");
  if (summary.missing || !summary.value) {
    fail(failures, "baselineApi", "Baseline API summary is missing or invalid.", summary.path);
    return;
  }
  if (summary.value.approved !== true || summary.value.missing?.length) {
    fail(failures, "baselineApi", "Baseline API aggregate is not approved or has missing files.", summary.path);
  }
  for (const endpoint of summary.value.endpoints ?? []) {
    if (endpoint.requestCount !== 90) {
      fail(failures, "baselineApi", `${endpoint.endpoint} request count is ${endpoint.requestCount}, expected 90.`, summary.path);
    }
    if (endpoint.failedRequests !== 0 || endpoint.errorRate >= 0.01 || endpoint.p95Ms >= 500) {
      fail(
        failures,
        "baselineApi",
        `${endpoint.endpoint} threshold failed: failed=${endpoint.failedRequests}, errorRate=${endpoint.errorRate}, p95=${endpoint.p95Ms}.`,
        summary.path,
      );
    }
    for (const file of endpoint.runFiles ?? []) {
      if (!fileExists(`tests/results/api/${file}`)) {
        fail(failures, "baselineApi", `Missing baseline API raw or summary file: ${file}.`, `tests/results/api/${file}`);
      }
    }
  }
}

function validateConcurrentUsers(failures) {
  const summary = readJson("tests/results/load/concurrent-user-summary.json");
  if (summary.missing || !summary.value) {
    fail(failures, "concurrentUsers", "Concurrent-user summary is missing or invalid.", summary.path);
    return;
  }
  if (summary.value.approved !== true) {
    fail(failures, "concurrentUsers", "Concurrent-user aggregate is not approved.", summary.path);
  }
  const levels = new Set((summary.value.byUsers ?? []).map((item) => number(item.users)));
  for (const expected of [1, 5, 10]) {
    if (!levels.has(expected)) {
      fail(failures, "concurrentUsers", `Missing concurrent-user level ${expected}.`, summary.path);
    }
  }
  for (const item of summary.value.byUsers ?? []) {
    if (item.runs !== 3 || item.failedRequests !== 0 || item.status429 !== 0 || item.errorRate >= 0.01 || item.p95ResponseTimeMs >= 500) {
      fail(
        failures,
        "concurrentUsers",
        `${item.users} VU threshold failed: runs=${item.runs}, failed=${item.failedRequests}, 429=${item.status429}, errorRate=${item.errorRate}, p95=${item.p95ResponseTimeMs}.`,
        summary.path,
      );
    }
    for (const file of item.runFiles ?? []) {
      if (!fileExists(`tests/results/load/${file}`)) {
        fail(failures, "concurrentUsers", `Missing concurrent raw file: ${file}.`, `tests/results/load/${file}`);
      }
    }
  }
}

function validateLatency(failures) {
  const expected = [
    ["E2E-PILOT-20", 20],
    ["E2E-PILOT-100", 100],
    ["E2E-FINAL-1000", 1000],
  ];
  for (const [runId, count] of expected) {
    const relative = `tests/results/latency/realtime-latency-${runId}-summary.json`;
    const summary = readJson(relative);
    if (summary.missing || !summary.value) {
      fail(failures, "endToEndLatency", `Latency summary is missing for ${runId}.`, relative);
      continue;
    }
    const csvPath = `tests/results/latency/realtime-latency-${runId}.csv`;
    if (!fileExists(csvPath)) {
      fail(failures, "endToEndLatency", `Latency raw CSV is missing for ${runId}.`, csvPath);
    }
    const generated = number(summary.value.generated);
    const accepted = number(summary.value.accepted);
    const displayed = number(summary.value.displayed);
    const p95 = number(summary.value.p95DelayMs);
    const ingestionFailureRate = number(summary.value.ingestionFailureRatePercent);
    if (
      generated !== count ||
      accepted !== count ||
      displayed !== count ||
      number(summary.value.duplicates) !== 0 ||
      number(summary.value.invalidRecords) !== 0 ||
      p95 >= 500 ||
      ingestionFailureRate !== 0
    ) {
      fail(
        failures,
        "endToEndLatency",
        `${runId} is not clean: generated=${generated}, accepted=${accepted}, displayed=${displayed}, duplicates=${summary.value.duplicates}, invalid=${summary.value.invalidRecords}, p95=${p95}, ingestionFailureRate=${ingestionFailureRate}.`,
        relative,
      );
    }
  }
}

function validateIntegrity(failures) {
  const summary = readJson("tests/results/integrity/record-consistency-E2E-FINAL-1000.json");
  if (summary.missing || !summary.value) {
    fail(failures, "dataIntegrity", "Record-consistency summary is missing or invalid.", summary.path);
    return;
  }
  if (summary.value.approved !== true) {
    fail(failures, "dataIntegrity", "Record-consistency summary is not approved.", summary.path);
  }
}

function validateRecovery(failures) {
  const summary = readJson("tests/results/recovery/recovery-results.json");
  if (summary.missing || !summary.value) {
    fail(failures, "recovery", "Recovery summary is missing or invalid.", summary.path);
    return;
  }
  const scenarios = summary.value.scenarios ?? [];
  if (scenarios.length !== 3) {
    fail(failures, "recovery", `Recovery scenario count is ${scenarios.length}, expected 3.`, summary.path);
  }
  for (const scenario of scenarios) {
    if (
      number(scenario.runs) !== 3 ||
      number(scenario.passed_runs) !== 3 ||
      number(scenario.total_lost) !== 0 ||
      number(scenario.total_duplicates) !== 0 ||
      scenario.result !== "passed"
    ) {
      fail(
        failures,
        "recovery",
        `${scenario.scenario ?? "unknown"} is not clean: runs=${scenario.runs}, passed=${scenario.passed_runs}, lost=${scenario.total_lost}, duplicates=${scenario.total_duplicates}, result=${scenario.result}.`,
        summary.path,
      );
    }
  }
}

function validateCompatibility(failures) {
  const summary = readJson("tests/results/compatibility/compatibility-summary.json");
  if (summary.missing || !summary.value) {
    fail(failures, "compatibility", "Compatibility summary is missing or invalid.", summary.path);
    return;
  }
  const totals = summary.value.totals ?? {};
  if (
    summary.value.status !== "APPROVED" ||
    number(totals.totalTestCases) !== 20 ||
    number(totals.passed) !== 20 ||
    number(totals.failed) !== 0 ||
    number(totals.skipped) !== 0
  ) {
    fail(
      failures,
      "compatibility",
      `Compatibility result is not clean: status=${summary.value.status}, total=${totals.totalTestCases}, passed=${totals.passed}, failed=${totals.failed}, skipped=${totals.skipped}.`,
      summary.path,
    );
  }
  for (const project of ["chrome-desktop", "edge-desktop", "firefox-desktop", "android-chrome-emulated", "safari-mobile-emulated"]) {
    if (!fileExists(`tests/results/compatibility/raw/${project}.json`)) {
      fail(failures, "compatibility", `Missing compatibility raw project result for ${project}.`, `tests/results/compatibility/raw/${project}.json`);
    }
  }
}

function validateSecurity(failures) {
  const summary = readJson("tests/results/security/security-summary.json");
  if (summary.missing || !summary.value) {
    fail(failures, "security", "Security summary is missing or invalid.", summary.path);
    return;
  }
  if (
    summary.value.status !== "APPROVED" ||
    number(summary.value.criticalFindings) !== 0 ||
    number(summary.value.highFindings) !== 0 ||
    number(summary.value.failed) !== 0
  ) {
    fail(
      failures,
      "security",
      `Security summary is not clean: status=${summary.value.status}, critical=${summary.value.criticalFindings}, high=${summary.value.highFindings}, failed=${summary.value.failed}.`,
      summary.path,
    );
  }

  const headers = readJson("tests/results/security/security-headers.json");
  if (headers.missing || !headers.value) {
    fail(failures, "securityHeaders", "Security header verification evidence is missing or invalid.", headers.path);
  } else if (headers.value.approved !== true) {
    fail(failures, "securityHeaders", "Security header verification is not approved.", headers.path);
  }

  const zap = readJson("tests/results/security/zap/zap-summary.json");
  if (zap.missing || !zap.value) {
    fail(failures, "zap", "ZAP retest summary is missing or invalid.", zap.path);
  } else if (
    zap.value.status !== "APPROVED" ||
    number(zap.value.openCritical) !== 0 ||
    number(zap.value.openHigh) !== 0 ||
    number(zap.value.openCspFindings) !== 0 ||
    number(zap.value.openClickjackingFindings) !== 0
  ) {
    fail(
      failures,
      "zap",
      `ZAP retest is not clean: status=${zap.value.status}, critical=${zap.value.openCritical}, high=${zap.value.openHigh}, csp=${zap.value.openCspFindings}, clickjacking=${zap.value.openClickjackingFindings}.`,
      zap.path,
    );
  }
}

function main() {
  const failures = [];
  if (!fs.existsSync(resultsRoot)) {
    fail(failures, "results", "tests/results directory is missing.", "tests/results");
  }

  validateFunctional(failures);
  validateBaselineApi(failures);
  validateConcurrentUsers(failures);
  validateLatency(failures);
  validateIntegrity(failures);
  validateRecovery(failures);
  validateCompatibility(failures);
  validateSecurity(failures);

  const output = {
    generatedAt: new Date().toISOString(),
    status: failures.length === 0 ? "APPROVED" : "NOT_APPROVED",
    failures,
  };

  fs.mkdirSync(path.join(resultsRoot, "validation"), { recursive: true });
  const json = `${JSON.stringify(output, null, 2)}\n`;
  const text = [
    `Status: ${output.status}`,
    `Generated: ${output.generatedAt}`,
    "",
    ...failures.map((item) => `[${item.category}] ${item.message} (${item.evidence})`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(resultsRoot, "validation", "test-results-validation.json"), json);
  fs.writeFileSync(path.join(resultsRoot, "final-validation.json"), json);
  fs.writeFileSync(path.join(resultsRoot, "final-validation.txt"), text);

  console.log(JSON.stringify(output, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main();
