import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import wsPackage from "../mwd-app-be/node_modules/ws/index.js";

const { WebSocket } = wsPackage;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(repoRoot, "mwd-app-be", ".env.testing"));
loadEnvFile(path.join(repoRoot, "mwd-app-be", ".env"));

const { PrismaClient } = await import("../mwd-app-be/node_modules/@prisma/client/index.js");
const prisma = new PrismaClient();

const CONFIG = {
  backendUrl: process.env.E2E_API_URL || process.env.BASE_URL || "http://localhost:5002",
  frontendUrl: process.env.E2E_BASE_URL || "http://localhost:3002",
  frontendOrigin: process.env.E2E_FRONTEND_ORIGIN || process.env.E2E_BASE_URL || "http://localhost:3002",
  username: process.env.E2E_ENGINEER_USERNAME || process.env.TEST_USERNAME || "engineer_test",
  password: process.env.E2E_ENGINEER_PASSWORD || process.env.E2E_TEST_PASSWORD || process.env.TEST_PASSWORD || "TestPassword123!",
  token: process.env.E2E_ENGINEER_TOKEN || process.env.TEST_TOKEN || "",
  activeSessionId: String(process.env.E2E_ACTIVE_SESSION_ID || process.env.SESSION_ID || "1"),
  sessionCodes: [
    process.env.E2E_ACTIVE_SESSION_NAME || "TEST-MWD-001",
    process.env.E2E_COMPARISON_SESSION_NAME || "TEST-MWD-002",
    process.env.E2E_EMPTY_SESSION_NAME || "TEST-MWD-EMPTY",
  ],
  timeoutMs: Number(process.env.TEST_ENV_TIMEOUT_MS || 120_000),
  intervalMs: Number(process.env.TEST_ENV_POLL_MS || 1_000),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/, "");
}

function parseHostPort(value) {
  const url = new URL(normalizeBaseUrl(value));
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
  };
}

async function checkPort(name, baseUrl) {
  const { host, port } = parseHostPort(baseUrl);
  const hosts = host === "localhost" ? ["localhost", "127.0.0.1"] : [host];
  const errors = [];

  for (const candidateHost of hosts) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: candidateHost, port });
        const timer = setTimeout(() => {
          socket.destroy();
          reject(new Error(`${name} port ${port} is not listening on ${candidateHost}`));
        }, 2_500);

        socket.once("connect", () => {
          clearTimeout(timer);
          socket.end();
          resolve(true);
        });
        socket.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      return true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join("; "));
}

async function request(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body ?? "";
    const req = http.request(
      parsed,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
          ...(options.headers ?? {}),
        },
        timeout: options.timeoutMs ?? 5_000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error(`Timed out: ${method} ${url}`)));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitFor(name, fn) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < CONFIG.timeoutMs) {
    try {
      const result = await fn();
      if (result) {
        console.log(`[ready] ${name}`);
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(CONFIG.intervalMs);
  }

  throw new Error(`[not ready] ${name}. ${lastError}`);
}

async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

async function checkFixtures() {
  const users = await prisma.user.findMany({
    where: { username: { in: ["admin_test", "engineer_test", "operator_test"] } },
    select: { username: true, isActive: true },
  });
  const sessions = await prisma.mWDSession.findMany({
    where: { sessionCode: { in: CONFIG.sessionCodes } },
    select: { id: true, sessionCode: true },
  });

  const activeUsers = new Set(users.filter((user) => user.isActive).map((user) => user.username));
  const sessionCodes = new Set(sessions.map((session) => session.sessionCode));
  const missingUsers = ["admin_test", "engineer_test", "operator_test"].filter((user) => !activeUsers.has(user));
  const missingSessions = CONFIG.sessionCodes.filter((session) => !sessionCodes.has(session));

  if (missingUsers.length || missingSessions.length) {
    throw new Error(
      [
        missingUsers.length ? `missing users=${missingUsers.join(",")}` : "",
        missingSessions.length ? `missing sessions=${missingSessions.join(",")}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }

  return Object.fromEntries(sessions.map((session) => [session.sessionCode, String(session.id)]));
}

async function checkBackend() {
  const response = await request("GET", `${normalizeBaseUrl(CONFIG.backendUrl)}/api/health`);
  if (response.status !== 200) {
    throw new Error(`backend health returned ${response.status}: ${response.body.slice(0, 200)}`);
  }
  return true;
}

async function checkBackendPort() {
  return checkPort("backend", CONFIG.backendUrl);
}

async function checkFrontendPort() {
  return checkPort("frontend", CONFIG.frontendUrl);
}

async function checkCorsPreflight() {
  const response = await request("OPTIONS", `${normalizeBaseUrl(CONFIG.backendUrl)}/api/auth/login`, {
    headers: {
      Origin: normalizeBaseUrl(CONFIG.frontendOrigin),
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allowOrigin = response.headers["access-control-allow-origin"];
  if (response.status < 200 || response.status >= 300 || allowOrigin !== normalizeBaseUrl(CONFIG.frontendOrigin)) {
    throw new Error(
      `CORS preflight status=${response.status}, allow-origin=${allowOrigin ?? "missing"}, body=${response.body.slice(0, 200)}`,
    );
  }
  return true;
}

async function login() {
  if (CONFIG.token.trim()) {
    return CONFIG.token.trim();
  }

  const response = await request("POST", `${normalizeBaseUrl(CONFIG.backendUrl)}/api/auth/login`, {
    headers: { Origin: normalizeBaseUrl(CONFIG.frontendOrigin) },
    body: JSON.stringify({ identifier: CONFIG.username, password: CONFIG.password }),
  });

  if (response.status !== 200) {
    throw new Error(`login returned ${response.status}: ${response.body.slice(0, 200)}`);
  }

  const payload = JSON.parse(response.body);
  const token = payload.token || payload.accessToken || payload.data?.token || payload.data?.accessToken;
  if (!token) {
    throw new Error("login succeeded but did not return token; enable AUTH_EXPOSE_TOKEN for testing");
  }
  return token;
}

async function checkFrontend() {
  const response = await request("GET", `${normalizeBaseUrl(CONFIG.frontendUrl)}/login`);
  if (response.status !== 200 || !response.body.includes("MWD")) {
    throw new Error(`frontend login returned ${response.status}`);
  }
  return true;
}

async function checkSessionsEndpoint(token) {
  const response = await request("GET", `${normalizeBaseUrl(CONFIG.backendUrl)}/api/mwd-sessions`, {
    headers: {
      Origin: normalizeBaseUrl(CONFIG.frontendOrigin),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(`/api/mwd-sessions returned ${response.status}: ${response.body.slice(0, 200)}`);
  }

  const payload = JSON.parse(response.body);
  const list =
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload.sessions)
        ? payload.sessions
        : Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.data?.sessions)
            ? payload.data.sessions
            : [];

  const hasActiveSession = list.some((session) => String(session?.id ?? session?.sessionId ?? "") === CONFIG.activeSessionId);
  if (!hasActiveSession) {
    throw new Error(`active session ${CONFIG.activeSessionId} was not returned by /api/mwd-sessions`);
  }

  return true;
}

async function checkWebSocket(token) {
  const backend = new URL(normalizeBaseUrl(CONFIG.backendUrl));
  backend.protocol = backend.protocol === "https:" ? "wss:" : "ws:";
  backend.pathname = "/ws";
  backend.searchParams.set("token", token);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(backend.toString(), {
      headers: { Origin: normalizeBaseUrl(CONFIG.frontendOrigin) },
      handshakeTimeout: 5_000,
    });
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("WebSocket handshake timed out"));
    }, 5_000);

    ws.once("open", () => undefined);
    ws.on("message", (rawMessage) => {
      const text = rawMessage.toString();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        return;
      }

      const event = payload?.event ?? payload?.type;
      const sessionId = payload?.sessionId ?? payload?.payload?.sessionId;
      if (event === "connected") {
        ws.send(JSON.stringify({ type: "subscribe", sessionId: CONFIG.activeSessionId }));
        return;
      }
      if (event === "subscribed" && String(sessionId) === CONFIG.activeSessionId) {
        clearTimeout(timer);
        ws.close();
        resolve(true);
      }
      if (event === "error") {
        clearTimeout(timer);
        ws.close();
        reject(new Error(`WebSocket subscribe failed: ${payload?.message ?? payload?.payload?.message ?? text}`));
      }
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    ws.once("close", (code, reason) => {
      if (code === 1008) {
        clearTimeout(timer);
        reject(new Error(`WebSocket unauthorized: ${reason.toString()}`));
      }
    });
  });
}

async function main() {
  await waitFor("database", checkDatabase);
  const sessions = await waitFor("test fixtures", checkFixtures);
  await waitFor("backend port", checkBackendPort);
  await waitFor("backend health", checkBackend);
  await waitFor("CORS preflight", checkCorsPreflight);
  await waitFor("frontend port", checkFrontendPort);
  await waitFor("frontend", checkFrontend);
  const token = await waitFor("API login", login);
  await waitFor("MWD sessions endpoint", () => checkSessionsEndpoint(token));
  await waitFor("WebSocket subscribe", () => checkWebSocket(token));

  console.log(
    JSON.stringify(
      {
        status: "ready",
        backendUrl: normalizeBaseUrl(CONFIG.backendUrl),
        frontendUrl: normalizeBaseUrl(CONFIG.frontendUrl),
        activeSessionId: CONFIG.activeSessionId,
        sessions,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
