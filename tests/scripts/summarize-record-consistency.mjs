import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runId = process.env.MONITORING_RUN_ID || "E2E-FINAL-1000";
const resultsDir = path.join(root, "tests", "results", "integrity");
const latencyCsv = path.join(
  root,
  "tests",
  "results",
  "latency",
  `realtime-latency-${runId}.csv`,
);
const apiCountPath = path.join(resultsDir, `api-count-${runId}.json`);
const latencySummaryPath = path.join(
  root,
  "tests",
  "results",
  "latency",
  `realtime-latency-${runId}-summary.json`,
);
const sqlVerificationPath = path.join(
  resultsDir,
  `sql-verification-${runId}.txt`,
);

const requiredEvidence = [
  latencyCsv,
  latencySummaryPath,
  apiCountPath,
  sqlVerificationPath,
];

const missingEvidence = requiredEvidence.filter((filePath) => !fs.existsSync(filePath));
if (missingEvidence.length > 0) {
  console.error(
    JSON.stringify(
      {
        status: "MISSING_EVIDENCE",
        runId,
        missingEvidence: missingEvidence.map((filePath) => path.relative(root, filePath)),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function readLatencyRows() {
  const lines = fs.readFileSync(latencyCsv, "utf8").trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function readSqlMetrics() {
  if (!fs.existsSync(sqlVerificationPath)) {
    return {};
  }

  const metrics = {};
  const content = fs.readFileSync(sqlVerificationPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([a-z_]+)\s+\|\s+([0-9]+)\s*$/i);
    if (match) {
      metrics[match[1]] = Number(match[2]);
    }
  }

  return metrics;
}

fs.mkdirSync(resultsDir, { recursive: true });

const rows = readLatencyRows();
const generated = rows.length;
const acceptedRows = rows.filter((row) => row.ingest_status === "accepted");
const displayedRows = rows.filter((row) => row.display_status === "displayed");
const acceptedSequences = new Set(acceptedRows.map((row) => row.sequence_id));
const displayedSequences = displayedRows.map((row) => row.sequence_id);
const uniqueDisplayedSequences = new Set(displayedSequences);
const frontendDuplicates =
  displayedSequences.length - uniqueDisplayedSequences.size;
const lostAcceptedSequences = [...acceptedSequences].filter(
  (sequence) => !uniqueDisplayedSequences.has(sequence),
);
const invalidFrontendRows = displayedRows.filter(
  (row) =>
    !row.sequence_id ||
    !row.source_timestamp_ms ||
    !row.backend_received_timestamp_ms ||
    !row.client_received_timestamp_ms ||
    !row.displayed_timestamp_ms,
).length;

const backendCount = {
  runId,
  acceptedRows: acceptedRows.length,
  uniqueAcceptedSequences: acceptedSequences.size,
};
const frontendCount = {
  runId,
  displayedRows: displayedRows.length,
  uniqueDisplayedSequences: uniqueDisplayedSequences.size,
  duplicates: frontendDuplicates,
  lostAcceptedSequences,
};

fs.writeFileSync(
  path.join(resultsDir, `backend-ingest-count-${runId}.json`),
  `${JSON.stringify(backendCount, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(resultsDir, `frontend-display-count-${runId}.json`),
  `${JSON.stringify(frontendCount, null, 2)}\n`,
);

const latencySummary = JSON.parse(fs.readFileSync(latencySummaryPath, "utf8"));
if (latencySummary.runId && latencySummary.runId !== runId) {
  throw new Error(`Latency summary runId mismatch: expected ${runId}, got ${latencySummary.runId}`);
}

const apiCount = JSON.parse(fs.readFileSync(apiCountPath, "utf8"));
const sqlMetrics = readSqlMetrics();
const stored = sqlMetrics.total_stored_records ?? 0;
const duplicateRecords =
  (sqlMetrics.duplicate_records ?? 0) +
  (apiCount.duplicates ?? 0) +
  frontendDuplicates;
const invalidOrNull =
  (sqlMetrics.null_sequence_id ?? 0) +
  (sqlMetrics.null_measured_timestamp ?? 0) +
  (sqlMetrics.invalid_required_fields ?? 0) +
  invalidFrontendRows;
const sessionMismatch =
  (sqlMetrics.session_mismatch ?? 0) + (apiCount.sessionMismatch ?? 0);
const missingSequence =
  (sqlMetrics.missing_sequence ?? 0) +
  (apiCount.missingSequence ?? 0) +
  lostAcceptedSequences.length;

const summary = {
  runId,
  generated,
  backendReceived: acceptedRows.length,
  storedPostgreSQL: stored,
  returnedApi: apiCount.totalReturned ?? 0,
  displayedFrontend: displayedRows.length,
  duplicateRecords,
  invalidOrNullRecords: invalidOrNull,
  sessionMismatch,
  missingSequence,
  approved:
    generated === acceptedRows.length &&
    acceptedRows.length === stored &&
    stored === (apiCount.totalReturned ?? 0) &&
    (apiCount.totalReturned ?? 0) === displayedRows.length &&
    duplicateRecords === 0 &&
    invalidOrNull === 0 &&
    sessionMismatch === 0 &&
    missingSequence === 0,
};

fs.writeFileSync(
  path.join(resultsDir, `record-consistency-${runId}.json`),
  `${JSON.stringify(summary, null, 2)}\n`,
);

const csvRows = [
  "stage,record_count",
  `Generated by source,${generated}`,
  `Received by backend,${acceptedRows.length}`,
  `Stored in PostgreSQL,${stored}`,
  `Returned by API,${apiCount.totalReturned ?? 0}`,
  `Displayed by frontend,${displayedRows.length}`,
  `Duplicate records,${duplicateRecords}`,
  `Invalid or null records,${invalidOrNull}`,
  `Session mismatch,${sessionMismatch}`,
  `Missing sequence ID,${missingSequence}`,
];

fs.writeFileSync(
  path.join(resultsDir, `record-consistency-${runId}.csv`),
  `${csvRows.join("\n")}\n`,
);

console.log(JSON.stringify(summary, null, 2));
