import fs from "node:fs";
import path from "node:path";

const inputPath =
  process.argv[2] || "../tests/results/functional/playwright-results.json";
const outputPath =
  process.argv[3] || "../tests/results/functional/playwright-summary.json";

if (!fs.existsSync(inputPath)) {
  console.error(`File hasil tidak ditemukan: ${inputPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const testResults = [];

function visitSuite(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const lastResult = test.results?.at(-1);
      testResults.push({
        id: spec.title.match(/FT-\d+/)?.[0] || spec.title,
        title: spec.title,
        status: lastResult?.status || test.status || "unknown",
        durationMs: (test.results || []).reduce(
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
const failed = testResults.filter((item) => item.status === "failed").length;
const skipped = testResults.filter((item) => item.status === "skipped").length;
const interrupted = testResults.filter(
  (item) => item.status === "interrupted" || item.status === "timedOut",
).length;
const executionTimeMs = testResults.reduce(
  (sum, item) => sum + item.durationMs,
  0,
);
const passRate = total === 0 ? 0 : (passed / total) * 100;

const summary = {
  generatedAt: new Date().toISOString(),
  totalTestCases: total,
  passed,
  failed,
  skipped,
  interrupted,
  passRatePercent: Number(passRate.toFixed(2)),
  executionTimeMs,
  executionTimeSeconds: Number((executionTimeMs / 1000).toFixed(2)),
  tests: testResults,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

console.table(testResults);
console.log("\nRingkasan Playwright");
console.log(`Total test case : ${total}`);
console.log(`Passed          : ${passed}`);
console.log(`Failed          : ${failed}`);
console.log(`Skipped         : ${skipped}`);
console.log(`Interrupted     : ${interrupted}`);
console.log(`Pass rate       : ${passRate.toFixed(2)}%`);
console.log(`Execution time  : ${(executionTimeMs / 1000).toFixed(2)} detik`);
console.log(`Summary JSON    : ${outputPath}`);
