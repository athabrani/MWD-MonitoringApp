import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  activeSession,
  ingestMwdData,
  loginAsEngineer,
  mean,
  percentile,
  selectActiveSession,
  waitForConnected,
} from "../helpers/mwd-test-helpers";

type LatencyRow = {
  run_id: string;
  sequence_id: string;
  session_id: string;
  source_timestamp_ms: number;
  backend_received_timestamp_ms: number | "";
  client_received_timestamp_ms: number | "";
  displayed_timestamp_ms: number | "";
  source_to_backend_ms: number | "";
  backend_to_client_ms: number | "";
  client_to_display_ms: number | "";
  end_to_end_delay_ms: number | "";
  ingest_http_status: number;
  ingest_response_message: string;
  ingest_status: "accepted" | "failed";
  display_status: "displayed" | "lost" | "not_attempted";
};

const outputDir = path.resolve(process.cwd(), "..", "tests", "results", "latency");

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function csvValue(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath: string, rows: LatencyRow[]) {
  const headers = [
    "run_id",
    "sequence_id",
    "session_id",
    "source_timestamp_ms",
    "backend_received_timestamp_ms",
    "client_received_timestamp_ms",
    "displayed_timestamp_ms",
    "source_to_backend_ms",
    "backend_to_client_ms",
    "client_to_display_ms",
    "end_to_end_delay_ms",
    "ingest_http_status",
    "ingest_response_message",
    "ingest_status",
    "display_status",
  ] as const;

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
  ];

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function summarize(runId: string, rows: LatencyRow[]) {
  const generated = rows.length;
  const acceptedRows = rows.filter((row) => row.ingest_status === "accepted");
  const displayedRows = rows.filter((row) => row.display_status === "displayed");
  const delayValues = displayedRows
    .map((row) => Number(row.end_to_end_delay_ms))
    .filter((value) => Number.isFinite(value));
  const sequences = displayedRows.map((row) => row.sequence_id);
  const uniqueSequences = new Set(sequences);
  const duplicates = sequences.length - uniqueSequences.size;
  const invalidRecords = displayedRows.filter(
    (row) =>
      row.backend_received_timestamp_ms === "" ||
      row.client_received_timestamp_ms === "" ||
      row.displayed_timestamp_ms === "",
  ).length;
  const accepted = acceptedRows.length;
  const displayed = displayedRows.length;

  return {
    runId,
    generated,
    accepted,
    displayed,
    duplicates,
    invalidRecords,
    meanDelayMs: Number(mean(delayValues).toFixed(3)),
    medianDelayMs: Number(percentile(delayValues, 50).toFixed(3)),
    p95DelayMs: Number(percentile(delayValues, 95).toFixed(3)),
    p99DelayMs: Number(percentile(delayValues, 99).toFixed(3)),
    maximumDelayMs:
      delayValues.length > 0 ? Number(Math.max(...delayValues).toFixed(3)) : 0,
    deliveryRatePercent:
      accepted > 0 ? Number(((displayed / accepted) * 100).toFixed(3)) : 0,
    dataLossRatePercent:
      accepted > 0
        ? Number((((accepted - displayed) / accepted) * 100).toFixed(3))
        : 0,
    ingestionFailureRatePercent:
      generated > 0
        ? Number((((generated - accepted) / generated) * 100).toFixed(3))
        : 0,
  };
}

async function pause(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRealtimeSubscription(page: Page, sessionId: string, afterTimestampMs: number) {
  await page.waitForFunction(
    ({ expectedSessionId, afterIso }) => {
      const e2eWindow = window as typeof window & {
        __MWD_E2E__?: {
          getRealtimeDiagnostics?: () => Array<{ event?: string; sessionId?: string; timestamp?: string }>;
        };
      };
      const diagnostics = e2eWindow.__MWD_E2E__?.getRealtimeDiagnostics?.() ?? [];
      return diagnostics.some(
        (entry) =>
          entry.event === "subscription-ack" &&
          String(entry.sessionId) === String(expectedSessionId) &&
          typeof entry.timestamp === "string" &&
          entry.timestamp >= afterIso,
      );
    },
    { expectedSessionId: sessionId, afterIso: new Date(afterTimestampMs).toISOString() },
    { timeout: 15_000 },
  );
}

type DisplayedRecordEvidence = {
  sequence_id: string;
  session_id: string;
  source_timestamp_ms: number;
  backend_received_timestamp_ms: number | null;
  client_received_timestamp_ms: number | null;
  displayed_timestamp_ms: number;
};

async function waitForDisplayedSequence(page: Page, sequenceId: string, timeout: number) {
  await page.waitForFunction(
    (expectedSequenceId) => {
      const displayed = (window as typeof window & {
        __mwdDisplayedRecords?: Record<string, DisplayedRecordEvidence>;
      }).__mwdDisplayedRecords ?? {};
      return Boolean(displayed[expectedSequenceId]);
    },
    sequenceId,
    { timeout },
  );
}

test("End-to-end monitoring delay", async ({ page, request }) => {
  const runId =
    process.env.MONITORING_RUN_ID || `E2E-PILOT-${Date.now()}`;
  const messageCount = envNumber("LATENCY_MESSAGE_COUNT", 20);
  const intervalMs = envNumber("LATENCY_INTERVAL_MS", 1000);
  const displayTimeoutMs = envNumber("LATENCY_DISPLAY_TIMEOUT_MS", 10_000);
  const p95ThresholdMs = envNumber("LATENCY_P95_THRESHOLD_MS", 500);
  const ingestConcurrency = Math.max(
    1,
    Math.floor(envNumber("LATENCY_INGEST_CONCURRENCY", intervalMs > 0 ? 1 : messageCount >= 1000 ? 50 : 10)),
  );
  const session = activeSession();
  const rows = new Array<LatencyRow>(messageCount);

  test.setTimeout(
    Math.max(180_000, messageCount * Math.max(intervalMs, 20) + 240_000),
  );

  fs.mkdirSync(outputDir, { recursive: true });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "mwd_settings",
      JSON.stringify({
        display: {
          autoRefresh: false,
          refreshInterval: 60,
        },
      }),
    );
  });

  await loginAsEngineer(page);
  await selectActiveSession(page, session);
  await waitForConnected(page);
  const reconnectStartedAt = Date.now();
  await page.evaluate(() => {
    (window as typeof window & {
      __MWD_E2E__?: { forceReconnect?: () => void };
    }).__MWD_E2E__?.forceReconnect?.();
  });
  await waitForConnected(page);
  await waitForRealtimeSubscription(page, session.id, reconnectStartedAt);
  await expect(page.getByRole("button", { name: /refresh all/i })).toBeEnabled({
    timeout: 30_000,
  });
  await page.evaluate(() => {
    (window as typeof window & {
      __mwdDisplayedRecords?: Record<string, DisplayedRecordEvidence>;
    }).__mwdDisplayedRecords = {};
  });

  const sequenceIdFor = (index: number) => `${runId}-${String(index).padStart(6, "0")}`;

  const submitRecord = async (index: number) => {
    const sequenceId = sequenceIdFor(index);
    const sourceTimestampMs = Date.now();
    const depth = 3000 + index;
    const ingestResult = await ingestMwdData(request, {
      session,
      sequenceId,
      sourceTimestampMs,
      depth,
    });
    const accepted = ingestResult.status >= 200 && ingestResult.status < 300;
    const row: LatencyRow = {
      run_id: runId,
      sequence_id: sequenceId,
      session_id: session.id,
      source_timestamp_ms: sourceTimestampMs,
      backend_received_timestamp_ms:
        ingestResult.backendReceivedTimestamp ?? "",
      client_received_timestamp_ms: "",
      displayed_timestamp_ms: "",
      source_to_backend_ms:
        ingestResult.backendReceivedTimestamp !== undefined
          ? ingestResult.backendReceivedTimestamp - sourceTimestampMs
          : "",
      backend_to_client_ms: "",
      client_to_display_ms: "",
      end_to_end_delay_ms: "",
      ingest_http_status: ingestResult.status,
      ingest_response_message:
        typeof ingestResult.responseBody?.message === "string"
          ? ingestResult.responseBody.message
          : "",
      ingest_status: accepted ? "accepted" : "failed",
      display_status: accepted ? "lost" : "not_attempted",
    };

    rows[index - 1] = row;
    return row;
  };

  if (ingestConcurrency === 1) {
    for (let index = 1; index <= messageCount; index += 1) {
      const iterationStartedAt = Date.now();
      const row = await submitRecord(index);
      if (row.ingest_status === "accepted") {
        await waitForDisplayedSequence(page, row.sequence_id, displayTimeoutMs).catch(() => undefined);
      }
      await pause(Math.max(0, intervalMs - (Date.now() - iterationStartedAt)));
    }
  } else {
    const pending = new Set<Promise<LatencyRow>>();
    for (let index = 1; index <= messageCount; index += 1) {
      const recordPromise = submitRecord(index).finally(() => {
        pending.delete(recordPromise);
      });
      pending.add(recordPromise);

      if (pending.size >= ingestConcurrency) {
        await Promise.race(pending);
      }

      await pause(intervalMs);
    }
    await Promise.all(pending);
  }

  await page.waitForFunction(
    ({ expectedCount, expectedRunId }) => {
      const displayed = (window as typeof window & {
        __mwdDisplayedRecords?: Record<string, DisplayedRecordEvidence>;
      }).__mwdDisplayedRecords ?? {};
      return Object.keys(displayed).filter((sequenceId) => sequenceId.startsWith(`${expectedRunId}-`)).length >= expectedCount;
    },
    { expectedCount: messageCount, expectedRunId: runId },
    { timeout: Math.max(displayTimeoutMs, messageCount * 100) },
  ).catch(() => undefined);

  const displayedRecords = await page.evaluate((expectedRunId) => {
    const displayed = (window as typeof window & {
      __mwdDisplayedRecords?: Record<string, DisplayedRecordEvidence>;
    }).__mwdDisplayedRecords ?? {};
    return Object.fromEntries(
      Object.entries(displayed).filter(([sequenceId]) => sequenceId.startsWith(`${expectedRunId}-`)),
    );
  }, runId);

  for (const row of rows) {
    if (!row || row.ingest_status !== "accepted") continue;

    const displayedRecord = displayedRecords[row.sequence_id];
    if (!displayedRecord) continue;

    const backendReceivedTimestampMs =
      typeof displayedRecord.backend_received_timestamp_ms === "number"
        ? displayedRecord.backend_received_timestamp_ms
        : row.backend_received_timestamp_ms;
    const clientReceivedTimestampMs =
      typeof displayedRecord.client_received_timestamp_ms === "number"
        ? displayedRecord.client_received_timestamp_ms
        : "";
    const displayedTimestampMs = displayedRecord.displayed_timestamp_ms;

    row.session_id = displayedRecord.session_id || session.id;
    row.backend_received_timestamp_ms = backendReceivedTimestampMs;
    row.client_received_timestamp_ms = clientReceivedTimestampMs;
    row.displayed_timestamp_ms = displayedTimestampMs;
    row.source_to_backend_ms =
      typeof row.backend_received_timestamp_ms === "number"
        ? row.backend_received_timestamp_ms - row.source_timestamp_ms
        : "";
    row.backend_to_client_ms =
      typeof row.backend_received_timestamp_ms === "number" &&
      typeof row.client_received_timestamp_ms === "number"
        ? row.client_received_timestamp_ms - row.backend_received_timestamp_ms
        : "";
    row.client_to_display_ms =
      typeof row.client_received_timestamp_ms === "number"
        ? displayedTimestampMs - row.client_received_timestamp_ms
        : "";
    row.end_to_end_delay_ms = displayedTimestampMs - row.source_timestamp_ms;
    row.display_status = "displayed";
  }

  const csvPath = path.join(outputDir, `realtime-latency-${runId}.csv`);
  const summaryPath = path.join(
    outputDir,
    `realtime-latency-${runId}-summary.json`,
  );
  const summary = summarize(runId, rows);

  writeCsv(csvPath, rows);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  expect(summary.generated).toBe(messageCount);
  expect(summary.accepted).toBe(messageCount);
  expect(summary.displayed).toBe(messageCount);
  expect(summary.duplicates).toBe(0);
  expect(summary.invalidRecords).toBe(0);
  expect(summary.p95DelayMs).toBeLessThan(p95ThresholdMs);
});
