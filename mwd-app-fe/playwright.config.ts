import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function parseEnvValue(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const repoRoot = path.resolve(__dirname, "..");

loadEnvFile(path.join(repoRoot, "mwd-app-be", ".env"));
loadEnvFile(path.join(repoRoot, "mwd-app-fe", ".env"));
loadEnvFile(path.join(repoRoot, "mwd-app-fe", ".env.local"));

process.env.E2E_GATEWAY_HMAC_SECRET ??= process.env.GATEWAY_HMAC_SECRET;
process.env.E2E_TEST_PASSWORD ??= "TestPassword123!";

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
