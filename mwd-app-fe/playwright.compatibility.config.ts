import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const projectOutput = process.env.COMPAT_PROJECT_NAME ?? "all-projects";

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
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const repoRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(repoRoot, "mwd-app-be", ".env.testing"));
loadEnvFile(path.join(repoRoot, "mwd-app-be", ".env"));
loadEnvFile(path.join(repoRoot, "mwd-app-fe", ".env"));
loadEnvFile(path.join(repoRoot, "mwd-app-fe", ".env.local"));

process.env.E2E_GATEWAY_API_KEY ??= process.env.GATEWAY_API_KEY;
process.env.E2E_GATEWAY_HMAC_SECRET ??= process.env.GATEWAY_HMAC_SECRET;
process.env.E2E_TEST_PASSWORD ??= "TestPassword123!";

export default defineConfig({
  testDir: "./tests/compatibility",
  timeout: 90_000,
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
        outputFolder: `../tests/results/compatibility/html-report/${projectOutput}`,
        open: "never",
      },
    ],
    [
      "json",
      {
        outputFile:
          `../tests/results/compatibility/project-results/${projectOutput}.json`,
      },
    ],
    [
      "junit",
      {
        outputFile:
          `../tests/results/compatibility/project-results/${projectOutput}.xml`,
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
      name: "chrome-desktop",
      use: {
        channel: "chrome",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "edge-desktop",
      use: {
        channel: "msedge",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "firefox-desktop",
      use: {
        browserName: "firefox",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "android-chrome-emulated",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
      },
    },
    {
      name: "safari-mobile-emulated",
      use: {
        ...devices["iPhone 14"],
        browserName: "webkit",
      },
    },
  ],
  outputDir: `../tests/results/compatibility/test-artifacts/${projectOutput}`,
});
