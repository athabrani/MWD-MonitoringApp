import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function readEnvFile(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return { path: relativePath, exists: false, values: {} };
  }

  const values = {};
  const content = fs.readFileSync(absolutePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return { path: relativePath, exists: true, values };
}

function fail(reasons) {
  console.log("Status: FAILED");
  console.log("Reason:");
  for (const reason of reasons) {
    console.log(`- ${reason}`);
  }
  process.exit(1);
}

function getDatabaseName(databaseUrl) {
  if (!databaseUrl) return "not set";

  try {
    const parsed = new URL(databaseUrl);
    return parsed.pathname.replace(/^\//, "") || "unknown";
  } catch {
    const match = databaseUrl.match(/\/([^/?]+)(?:\?|$)/);
    return match?.[1] ?? "unknown";
  }
}

function getUrlPort(value, fallbackPort) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.port || fallbackPort[String(parsed.protocol)] || null;
  } catch {
    return null;
  }
}

const backendEnv = readEnvFile("mwd-app-be/.env");
const frontendLocalEnv = readEnvFile("mwd-app-fe/.env.local");
const frontendEnv = readEnvFile("mwd-app-fe/.env");
const frontendSelectedEnv = frontendLocalEnv.exists ? frontendLocalEnv : frontendEnv;

const reasons = [];
const backendPort = backendEnv.values.PORT || "5001";
const databaseName = getDatabaseName(backendEnv.values.DATABASE_URL);
const apiBaseUrl = frontendSelectedEnv.values.NEXT_PUBLIC_API_BASE_URL;
const apiUrl = frontendSelectedEnv.values.NEXT_PUBLIC_API_URL;
const wsUrl = frontendSelectedEnv.values.NEXT_PUBLIC_WS_URL;
const e2eMode = frontendSelectedEnv.values.NEXT_PUBLIC_E2E_MODE;

if (!backendEnv.exists) {
  reasons.push("Missing backend development env file: mwd-app-be/.env.");
}

if (!frontendSelectedEnv.exists) {
  reasons.push("Missing frontend development env file: mwd-app-fe/.env.local or mwd-app-fe/.env.");
}

if (!/^\d+$/.test(String(backendPort))) {
  reasons.push(`Backend PORT must be numeric, received '${backendPort}'.`);
}

const expectedPort = String(backendPort);
const httpFallbackPorts = { "http:": "80", "https:": "443" };
const wsFallbackPorts = { "ws:": "80", "wss:": "443" };

for (const [label, value, fallbackPorts] of [
  ["NEXT_PUBLIC_API_BASE_URL", apiBaseUrl, httpFallbackPorts],
  ["NEXT_PUBLIC_API_URL", apiUrl, httpFallbackPorts],
  ["NEXT_PUBLIC_WS_URL", wsUrl, wsFallbackPorts],
]) {
  if (!value) {
    reasons.push(`${label} is not set in ${frontendSelectedEnv.path}.`);
    continue;
  }

  const port = getUrlPort(value, fallbackPorts);
  if (!port) {
    reasons.push(`${label} must be an absolute URL, received '${value}'.`);
    continue;
  }

  if (port !== expectedPort) {
    reasons.push(`${label} points to port ${port}, but backend PORT is ${expectedPort}.`);
  }

  if (value.includes("localhost:5002") || value.includes("127.0.0.1:5002")) {
    reasons.push(`${label} still points to testing backend port 5002.`);
  }
}

if (String(e2eMode).toLowerCase() === "true") {
  reasons.push("NEXT_PUBLIC_E2E_MODE=true is active in development frontend env.");
}

if (databaseName === "mwd_test") {
  reasons.push("Backend development DATABASE_URL points to mwd_test.");
}

console.log(`Backend env           : ${backendEnv.path}`);
console.log(`Frontend env          : ${frontendSelectedEnv.path}`);
console.log(`Backend PORT          : ${backendPort}`);
console.log(`Frontend API base URL : ${apiBaseUrl ?? "not set"}`);
console.log(`Frontend API URL      : ${apiUrl ?? "not set"}`);
console.log(`Frontend WS URL       : ${wsUrl ?? "not set"}`);
console.log(`Database              : ${databaseName}`);
console.log(`Mode                  : ${backendEnv.values.NODE_ENV || "development"}`);

if (reasons.length > 0) {
  fail(reasons);
}

console.log("Status: OK - frontend and backend ports are aligned.");
