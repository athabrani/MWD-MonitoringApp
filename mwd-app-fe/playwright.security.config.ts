import { defineConfig, devices } from "@playwright/test";

const securityResultsDir = "../tests/results/security";

export default defineConfig({
  testDir: "./tests/security",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: `${securityResultsDir}/reports/html-report`, open: "never" }],
    ["json", { outputFile: `${securityResultsDir}/security-playwright-results.json` }],
    ["junit", { outputFile: `${securityResultsDir}/security-junit.xml` }],
  ],
  outputDir: `${securityResultsDir}/test-artifacts`,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3002",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "security-chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
