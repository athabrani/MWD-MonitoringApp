import { defineConfig, devices } from "@playwright/test";

const projectOutput = process.env.COMPAT_PROJECT_NAME ?? "all-projects";
const firefoxLaunchOptions = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH }
  : undefined;

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
        launchOptions: firefoxLaunchOptions,
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
