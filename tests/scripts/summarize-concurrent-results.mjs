import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const root = process.cwd();
const resultsDir = path.join(root, "tests", "results", "load");
const outputJson = path.join(resultsDir, "concurrent-user-summary.json");
const outputCsv = path.join(resultsDir, "concurrent-user-summary.csv");
const userLevels = [1, 5, 10];
const runLabels = ["01", "02", "03"];

function readJsonFile(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""),
  );
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

async function readRun(rawPath) {
  const durations = [];
  const successfulDurations = [];
  const failedSamples = [];
  const status429Samples = [];
  const endpointCounts = {
    sessions: 0,
    "mwd-data": 0,
    "historical-data": 0,
  };
  let firstSampleTime = null;
  let lastSampleTime = null;

  const stream = fs.createReadStream(rawPath, { encoding: "utf8" });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== "Point" || !entry.data) {
      continue;
    }

    const metric = entry.metric;
    const value = Number(entry.data.value || 0);
    const tags = entry.data.tags || {};

    if (metric === "core_api_duration_ms") {
      durations.push(value);

      const sampleTime = Date.parse(entry.data.time);
      if (Number.isFinite(sampleTime)) {
        firstSampleTime =
          firstSampleTime === null
            ? sampleTime
            : Math.min(firstSampleTime, sampleTime);
        lastSampleTime =
          lastSampleTime === null
            ? sampleTime
            : Math.max(lastSampleTime, sampleTime);
      }
    } else if (metric === "successful_api_duration_ms") {
      successfulDurations.push(value);
    } else if (metric === "core_api_error_rate") {
      failedSamples.push(value);
    } else if (metric === "response_status_429") {
      status429Samples.push(value);
    } else if (metric === "sessions_requests") {
      endpointCounts.sessions += value;
    } else if (metric === "mwd_data_requests") {
      endpointCounts["mwd-data"] += value;
    } else if (metric === "historical_data_requests") {
      endpointCounts["historical-data"] += value;
    }
  }

  const durationSeconds =
    firstSampleTime !== null &&
    lastSampleTime !== null &&
    lastSampleTime > firstSampleTime
      ? (lastSampleTime - firstSampleTime) / 1000
      : 0;

  const failedRequests = failedSamples.reduce(
    (sum, value) => sum + (value > 0 ? 1 : 0),
    0,
  );
  const status429 = status429Samples.reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    file: path.basename(rawPath),
    requests: durations.length,
    failedRequests,
    status429,
    durationSeconds,
    requestRate:
      durationSeconds > 0 ? durations.length / durationSeconds : 0,
    durations,
    successfulDurations,
    endpointCounts,
  };
}

async function main() {
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`Results directory not found: ${resultsDir}`);
  }

  const files = fs.readdirSync(resultsDir);
  const expectedSummaryFiles = [];
  const expectedRawFiles = [];

  for (const vu of userLevels) {
    for (const run of runLabels) {
      expectedSummaryFiles.push(
        `concurrent-${vu}-vu-run-${run}-summary.json`,
      );
      expectedRawFiles.push(`concurrent-${vu}-vu-run-${run}-raw.json`);
    }
  }

  const missing = [...expectedSummaryFiles, ...expectedRawFiles].filter(
    (file) => !files.includes(file),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing measured concurrent result files: ${missing.join(", ")}`,
    );
  }

  const measuredSummaryFiles = files.filter((file) =>
    /^concurrent-(1|5|10)-vu-run-(01|02|03)-summary\.json$/.test(file),
  );
  const measuredRawFiles = files.filter((file) =>
    /^concurrent-(1|5|10)-vu-run-(01|02|03)-raw\.json$/.test(file),
  );

  if (measuredSummaryFiles.length !== 9 || measuredRawFiles.length !== 9) {
    throw new Error(
      [
        "Expected exactly 9 measured summary files and 9 measured raw files.",
        `Found summaries=${measuredSummaryFiles.length}, raw=${measuredRawFiles.length}.`,
      ].join(" "),
    );
  }

  const summariesWithToken = measuredSummaryFiles.filter((file) => {
    const summary = readJsonFile(path.join(resultsDir, file));
    return typeof summary?.setup_data?.token === "string";
  });

  if (summariesWithToken.length > 0) {
    throw new Error(
      [
        "Measured k6 summary files must not contain setup_data.token.",
        "Rerun with the patched script or sanitize token fields first:",
        summariesWithToken.join(", "),
      ].join(" "),
    );
  }

  const byUsers = [];

  for (const vu of userLevels) {
    const runs = [];

    for (const run of runLabels) {
      runs.push(
        await readRun(
          path.join(resultsDir, `concurrent-${vu}-vu-run-${run}-raw.json`),
        ),
      );
    }

    const durations = runs.flatMap((run) => run.durations);
    const successfulDurations = runs.flatMap(
      (run) => run.successfulDurations,
    );
    const totalRequests = runs.reduce(
      (sum, run) => sum + run.requests,
      0,
    );
    const failedRequests = runs.reduce(
      (sum, run) => sum + run.failedRequests,
      0,
    );
    const status429 = runs.reduce(
      (sum, run) => sum + run.status429,
      0,
    );
    const totalDurationSeconds = runs.reduce(
      (sum, run) => sum + run.durationSeconds,
      0,
    );

    const endpointCounts = runs.reduce(
      (counts, run) => {
        counts.sessions += run.endpointCounts.sessions;
        counts["mwd-data"] += run.endpointCounts["mwd-data"];
        counts["historical-data"] +=
          run.endpointCounts["historical-data"];
        return counts;
      },
      {
        sessions: 0,
        "mwd-data": 0,
        "historical-data": 0,
      },
    );

    const errorRate =
      totalRequests > 0 ? failedRequests / totalRequests : 0;
    const requestRate =
      totalDurationSeconds > 0
        ? totalRequests / totalDurationSeconds
        : 0;

    byUsers.push({
      users: vu,
      runs: runs.length,
      totalRequests,
      failedRequests,
      errorRate: round(errorRate),
      errorRatePercent: round(errorRate * 100),
      status429,
      requestRate: round(requestRate),
      avgResponseTimeMs: round(average(durations)),
      medianResponseTimeMs: round(percentile(durations, 50)),
      p90ResponseTimeMs: round(percentile(durations, 90)),
      p95ResponseTimeMs: round(percentile(durations, 95)),
      p99ResponseTimeMs: round(percentile(durations, 99)),
      maxResponseTimeMs: round(Math.max(...durations)),
      successfulP95ResponseTimeMs: round(
        percentile(successfulDurations, 95),
      ),
      endpointCounts,
      thresholds: {
        errorRateLt1Percent: errorRate < 0.01,
        p95Lt500Ms: percentile(durations, 95) < 500,
        no429: status429 === 0,
      },
      runFiles: runs.map((run) => run.file),
    });
  }

  const approved = byUsers.every(
    (group) =>
      group.thresholds.errorRateLt1Percent &&
      group.thresholds.p95Lt500Ms &&
      group.thresholds.no429,
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    methodology:
      "Aggregate p95 is recalculated from measured raw k6 samples across three runs per user level.",
    measuredFiles: {
      summary: expectedSummaryFiles,
      raw: expectedRawFiles,
    },
    byUsers,
    approved,
  };

  fs.writeFileSync(outputJson, `${JSON.stringify(summary, null, 2)}\n`);

  const csvRows = [
    [
      "users",
      "runs",
      "total_requests",
      "mean_ms",
      "median_ms",
      "p95_ms",
      "p99_ms",
      "max_ms",
      "requests_per_second",
      "failed_requests",
      "error_rate_percent",
      "status_429",
    ].join(","),
    ...byUsers.map((group) =>
      [
        group.users,
        group.runs,
        group.totalRequests,
        group.avgResponseTimeMs,
        group.medianResponseTimeMs,
        group.p95ResponseTimeMs,
        group.p99ResponseTimeMs,
        group.maxResponseTimeMs,
        group.requestRate,
        group.failedRequests,
        group.errorRatePercent,
        group.status429,
      ].join(","),
    ),
  ];

  fs.writeFileSync(outputCsv, `${csvRows.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        outputJson,
        outputCsv,
        approved,
        byUsers: byUsers.map((group) => ({
          users: group.users,
          requests: group.totalRequests,
          errorRatePercent: group.errorRatePercent,
          status429: group.status429,
          p95ResponseTimeMs: group.p95ResponseTimeMs,
          requestRate: group.requestRate,
          approved:
            group.thresholds.errorRateLt1Percent &&
            group.thresholds.p95Lt500Ms &&
            group.thresholds.no429,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
