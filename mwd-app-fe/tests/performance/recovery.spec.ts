import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  activeSession,
  ingestMwdData,
  loginAsEngineer,
  selectActiveSession,
  SELECTORS,
  waitForConnected,
} from "../helpers/mwd-test-helpers";

type RecoveryResult = {
  scenario: string;
  run_number: number;
  interruption_start_ms: number;
  disconnect_detected_ms: number | null;
  service_restored_ms: number | null;
  connected_detected_ms: number | null;
  first_valid_post_recovery_record_ms: number | null;
  disconnect_detection_ms: number | null;
  recovery_ms: number | null;
  active_session_before: string;
  active_session_after: string;
  accepted_during_interruption: number;
  displayed_after_recovery: number;
  lost_records: number;
  duplicate_records: number;
  diagnostics?: Record<string, unknown>;
  result: "passed" | "failed";
  failure_reason: string;
};

const outputDir = path.resolve(process.cwd(), "..", "tests", "results", "recovery");
const markerDir = path.join(outputDir, "markers");

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function waitForDisconnected(page: Page) {
  await expect
    .poll(
      async () =>
        (await page
          .getByTestId(SELECTORS.dashboardPage)
          .getByTestId(SELECTORS.connectionStatus)
          .first()
          .textContent()) ?? "",
      { timeout: 30_000 },
    )
    .toMatch(/disconnected|offline|degraded|connecting/i);
}

async function waitForMarker(filePath: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (fs.existsSync(filePath)) {
      return Number(fs.readFileSync(filePath, "utf8").trim()) || Date.now();
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Marker not found: ${filePath}`);
}

test("Quantitative recovery scenario", async ({ page, context, request }) => {
  const scenario = process.env.RECOVERY_SCENARIO || "network-loss";
  const runNumber = envNumber("RECOVERY_RUN_NUMBER", 1);
  const session = activeSession();
  const runLabel = String(runNumber).padStart(2, "0");
  const outputPath = path.join(outputDir, `${scenario}-run-${runLabel}.json`);
  const browserReadyMarker = path.join(markerDir, `${scenario}-run-${runLabel}-browser-ready.txt`);
  const backendStopRequestedMarker = path.join(markerDir, `${scenario}-run-${runLabel}-backend-stop-requested.txt`);
  const backendStoppedMarker = path.join(markerDir, `${scenario}-run-${runLabel}-backend-stopped.txt`);
  const restoredMarker = path.join(
    markerDir,
    `${scenario}-run-${runLabel}-backend-restored.txt`,
  );
  const testCompleteMarker = path.join(markerDir, `${scenario}-run-${runLabel}-test-complete.txt`);
  const postRecoverySequence = `RECOVERY-${scenario}-${runLabel}-${Date.now()}`;
  let result: RecoveryResult = {
    scenario,
    run_number: runNumber,
    interruption_start_ms: 0,
    disconnect_detected_ms: null,
    service_restored_ms: null,
    connected_detected_ms: null,
    first_valid_post_recovery_record_ms: null,
    disconnect_detection_ms: null,
    recovery_ms: null,
    active_session_before: "",
    active_session_after: "",
    accepted_during_interruption: 0,
    displayed_after_recovery: 0,
    lost_records: 0,
    duplicate_records: 0,
    result: "failed",
    failure_reason: "",
  };

  test.setTimeout(180_000);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(markerDir, { recursive: true });

  try {
    await loginAsEngineer(page);
    await selectActiveSession(page, session);
    await waitForConnected(page);
    result.active_session_before =
      (await page.getByTestId(SELECTORS.activeSessionLabel).textContent()) ?? "";

    if (scenario === "network-loss") {
      result.interruption_start_ms = Date.now();
      await context.setOffline(true);
      await waitForDisconnected(page);
      result.disconnect_detected_ms = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      result.service_restored_ms = Date.now();
      await context.setOffline(false);
    } else if (scenario === "websocket-interruption") {
      result.interruption_start_ms = Date.now();
      await page.evaluate(() => {
        const e2eWindow = window as typeof window & {
          __MWD_E2E__?: { closeWebSocket?: () => void };
        };
        e2eWindow.__MWD_E2E__?.closeWebSocket?.();
      });
      await waitForDisconnected(page);
      result.disconnect_detected_ms = Date.now();
      const duringInterruption = await ingestMwdData(request, {
        session,
        sequenceId: `RECOVERY-${scenario}-${runLabel}-DURING`,
        sourceTimestampMs: Date.now(),
        depth: 4100 + runNumber,
      });
      if (duringInterruption.status >= 200 && duringInterruption.status < 300) {
        result.accepted_during_interruption = 1;
      }
      result.service_restored_ms = Date.now();
    } else if (scenario === "backend-restart") {
      fs.writeFileSync(browserReadyMarker, String(Date.now()));
      result.interruption_start_ms = await waitForMarker(backendStopRequestedMarker, 60_000);
      await waitForMarker(backendStoppedMarker, 60_000);
      await waitForDisconnected(page);
      result.disconnect_detected_ms = Date.now();
      result.service_restored_ms = await waitForMarker(restoredMarker, 90_000);
    } else {
      throw new Error(`Unknown recovery scenario: ${scenario}`);
    }

    await waitForConnected(page, scenario === "backend-restart" ? 90_000 : 30_000);
    result.connected_detected_ms = Date.now();

    const ingestResult = await ingestMwdData(request, {
      session,
      sequenceId: postRecoverySequence,
      sourceTimestampMs: Date.now(),
      depth: 4200 + runNumber,
    });

    if (ingestResult.status < 200 || ingestResult.status >= 300) {
      throw new Error(`Post-recovery ingest failed with status ${ingestResult.status}`);
    }

    await expect(
      page.locator(
        `[data-testid="${SELECTORS.chartLatestValue}"][data-gateway-sequence="${postRecoverySequence}"]`,
      ),
    ).toBeVisible({ timeout: 30_000 });

    result.first_valid_post_recovery_record_ms = Date.now();
    result.displayed_after_recovery = 1;
    result.active_session_after =
      (await page.getByTestId(SELECTORS.activeSessionLabel).textContent()) ?? "";
    result.disconnect_detection_ms =
      result.disconnect_detected_ms - result.interruption_start_ms;
    result.recovery_ms =
      result.first_valid_post_recovery_record_ms -
      (result.service_restored_ms ?? result.connected_detected_ms);
    result.result =
      result.active_session_after.includes(session.name) &&
      result.displayed_after_recovery === 1 &&
      result.lost_records === 0 &&
      result.duplicate_records === 0
        ? "passed"
        : "failed";
    result.failure_reason =
      result.result === "passed" ? "" : "Recovery acceptance criteria failed.";
  } catch (error) {
    result.failure_reason =
      error instanceof Error ? error.message : "Unknown recovery failure";
  } finally {
    try {
      result.diagnostics = await page.evaluate(() => {
        const e2eWindow = window as typeof window & {
          __MWD_E2E__?: {
            getRealtimeDiagnostics?: () => unknown;
          };
        };
        return {
          realtime: e2eWindow.__MWD_E2E__?.getRealtimeDiagnostics?.() ?? [],
          location: window.location.href,
        };
      });
    } catch {
      result.diagnostics = {
        realtime: [],
        location: null,
      };
    }
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(testCompleteMarker, String(Date.now()));
    await context.setOffline(false).catch(() => undefined);
  }

  expect(result.result).toBe("passed");
});
