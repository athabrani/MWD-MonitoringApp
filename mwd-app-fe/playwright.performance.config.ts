import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/performance",
  timeout: 0,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3002",
    timezoneId: "UTC",
    acceptDownloads: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "../tests/results/performance/test-artifacts",
});
