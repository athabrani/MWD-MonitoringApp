import fs from "node:fs";
import path from "node:path";

const inputPath =
  process.argv[2] || "../tests/results/functional/playwright-results.json";
const outputPath =
  process.argv[3] || "../tests/results/functional/playwright-summary.json";

const emptySummary = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  interrupted: 0,
  passRate: 0,
  executionTimeSeconds: 0,
};

if (!fs.existsSync(inputPath)) {
  console.error(`File hasil tidak ditemukan: ${inputPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const testResults = [];

function visitSuite(suite) {
  for (const spec of suite.specs || []) {
    for (const testCase of spec.tests || []) {
      const lastResult = testCase.results?.at(-1);
      const status = lastResult?.status || testCase.status || "unknown";
      testResults.push({
        id: spec.title.match(/FT-\d+/)?.[0] || spec.title,
        title: spec.title,
        status,
        durationMs: (testCase.results || []).reduce(
          (sum, result) => sum + (result.duration || 0),
          0,
        ),
      });
    }
  }

  for (const childSuite of suite.suites || []) {
    visitSuite(childSuite);
  }
}

for (const suite of report.suites || []) {
  visitSuite(suite);
}

const total = testResults.length;
const passed = testResults.filter((item) => item.status === "passed").length;
const failed = testResults.filter((item) =>
  ["failed", "timedOut"].includes(item.status),
).length;
const skipped = testResults.filter((item) => item.status === "skipped").length;
const interrupted = testResults.filter(
  (item) => item.status === "interrupted",
).length;
const executionTimeMs = testResults.reduce(
  (sum, item) => sum + item.durationMs,
  0,
);

const summary = {
  ...emptySummary,
  total,
  passed,
  failed,
  skipped,
  interrupted,
  passRate: total === 0 ? 0 : Number(((passed / total) * 100).toFixed(2)),
  executionTimeSeconds: Number((executionTimeMs / 1000).toFixed(2)),
  tests: testResults,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

console.table(testResults);
console.log("\nRingkasan Playwright");
console.log(`Total test case : ${summary.total}`);
console.log(`Passed          : ${summary.passed}`);
console.log(`Failed          : ${summary.failed}`);
console.log(`Skipped         : ${summary.skipped}`);
console.log(`Interrupted     : ${summary.interrupted}`);
console.log(`Pass rate       : ${summary.passRate.toFixed(2)}%`);
console.log(`Execution time  : ${summary.executionTimeSeconds.toFixed(2)} detik`);
console.log(`Summary JSON    : ${outputPath}`);
