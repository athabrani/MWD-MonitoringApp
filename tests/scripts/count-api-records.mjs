import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "tests", "results", "integrity");
const baseUrl = (process.env.BASE_URL || process.env.E2E_API_URL || "http://localhost:5002").replace(/\/+$/, "");
const token = (process.env.TEST_TOKEN || process.env.E2E_TEST_TOKEN || "").trim();
const sessionId = String(process.env.SESSION_ID || process.env.E2E_ACTIVE_SESSION_ID || "1");
const runId = process.env.MONITORING_RUN_ID || "E2E-FINAL-1000";
const sequencePrefix = `${runId}-`;

if (!token) {
  throw new Error("TEST_TOKEN or E2E_TEST_TOKEN environment variable is required.");
}

function unwrapList(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.value)) return body.value;
  return [];
}

async function fetchPage(page) {
  const url = new URL(`${baseUrl}/api/mwd-data`);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("limit", "1000");
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API count request failed: ${response.status}`);
  }

  return response.json();
}

function sequenceOf(record) {
  const value = record.gatewaySequence ?? record.sequence ?? record.seq;
  return typeof value === "string" ? value : "";
}

const allRecords = [];
const seenPageKeys = new Set();

for (let page = 1; page <= 100; page += 1) {
  const body = await fetchPage(page);
  const records = unwrapList(body);

  if (records.length === 0) {
    break;
  }

  const pageKey = records.map((record) => String(record.id ?? "")).join("|");
  if (seenPageKeys.has(pageKey)) {
    break;
  }
  seenPageKeys.add(pageKey);
  allRecords.push(...records);

  const total = Number(body?.total ?? body?.count ?? body?.pagination?.total);
  if (Number.isFinite(total) && allRecords.length >= total) {
    break;
  }

  if (records.length < 1000) {
    break;
  }
}

const matchingRecords = allRecords.filter((record) =>
  sequenceOf(record).startsWith(sequencePrefix),
);
const sequenceCounts = new Map();
let missingSequence = 0;
let sessionMismatch = 0;

for (const record of matchingRecords) {
  const sequence = sequenceOf(record);
  if (!sequence) {
    missingSequence += 1;
  } else {
    sequenceCounts.set(sequence, (sequenceCounts.get(sequence) || 0) + 1);
  }

  if (String(record.sessionId ?? record.session_id) !== sessionId) {
    sessionMismatch += 1;
  }
}

const duplicates = [...sequenceCounts.values()].reduce(
  (sum, count) => sum + Math.max(0, count - 1),
  0,
);

const result = {
  runId,
  sessionId,
  totalReturned: matchingRecords.length,
  uniqueSequences: sequenceCounts.size,
  duplicates,
  missingSequence,
  sessionMismatch,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, `api-count-${runId}.json`),
  `${JSON.stringify(result, null, 2)}\n`,
);

console.log(JSON.stringify(result, null, 2));
