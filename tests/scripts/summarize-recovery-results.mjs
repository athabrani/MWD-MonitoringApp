import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultsDir = path.join(root, "tests", "results", "recovery");
const scenarios = ["network-loss", "websocket-interruption", "backend-restart"];

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Number(value.toFixed(3));
}

const summaries = [];

for (const scenario of scenarios) {
  const runs = [];

  for (let run = 1; run <= 3; run += 1) {
    const filePath = path.join(
      resultsDir,
      `${scenario}-run-${String(run).padStart(2, "0")}.json`,
    );

    if (fs.existsSync(filePath)) {
      runs.push(JSON.parse(fs.readFileSync(filePath, "utf8")));
    }
  }

  const detectValues = runs
    .map((run) => Number(run.disconnect_detection_ms))
    .filter(Number.isFinite);
  const recoverValues = runs
    .map((run) => Number(run.recovery_ms))
    .filter(Number.isFinite);
  const totalLost = runs.reduce((sum, run) => sum + Number(run.lost_records || 0), 0);
  const totalDuplicates = runs.reduce(
    (sum, run) => sum + Number(run.duplicate_records || 0),
    0,
  );
  const passedRuns = runs.filter((run) => run.result === "passed").length;

  summaries.push({
    scenario,
    runs: runs.length,
    mean_detect_ms: round(mean(detectValues)),
    median_detect_ms: round(percentile(detectValues, 50)),
    p95_detect_ms: round(percentile(detectValues, 95)),
    mean_recover_ms: round(mean(recoverValues)),
    median_recover_ms: round(percentile(recoverValues, 50)),
    p95_recover_ms: round(percentile(recoverValues, 95)),
    total_lost: totalLost,
    total_duplicates: totalDuplicates,
    passed_runs: passedRuns,
    result:
      runs.length === 3 &&
      passedRuns === 3 &&
      totalLost === 0 &&
      totalDuplicates === 0
        ? "passed"
        : "failed",
  });
}

fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(
  path.join(resultsDir, "recovery-results.json"),
  `${JSON.stringify({ scenarios: summaries }, null, 2)}\n`,
);

const csvRows = [
  "scenario,runs,mean_detect_ms,median_detect_ms,p95_detect_ms,mean_recover_ms,median_recover_ms,p95_recover_ms,total_lost,total_duplicates,passed_runs,result",
  ...summaries.map((summary) =>
    [
      summary.scenario,
      summary.runs,
      summary.mean_detect_ms,
      summary.median_detect_ms,
      summary.p95_detect_ms,
      summary.mean_recover_ms,
      summary.median_recover_ms,
      summary.p95_recover_ms,
      summary.total_lost,
      summary.total_duplicates,
      summary.passed_runs,
      summary.result,
    ].join(","),
  ),
];

fs.writeFileSync(
  path.join(resultsDir, "recovery-results.csv"),
  `${csvRows.join("\n")}\n`,
);

console.log(JSON.stringify({ scenarios: summaries }, null, 2));
