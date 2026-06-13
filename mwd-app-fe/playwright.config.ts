import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "e2e/mwd-monitoring.spec.ts",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "../tests/results/functional/playwright-report",
        open: "never",
      },
    ],
    [
      "json",
      {
        outputFile: "../tests/results/functional/playwright-results.json",
      },
    ],
    [
      "junit",
      {
        outputFile: "../tests/results/functional/playwright-junit.xml",
      },
    ],
  ],

use: {
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3002",
  timezoneId: "UTC",
  acceptDownloads: true,
  screenshot: "only-on-failure",
  video: "retain-on-failure",
  trace: "retain-on-failure",
},

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  outputDir: "../tests/results/functional/test-artifacts",
});
