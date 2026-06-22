import cors from "cors";
import express from "express";
import { corsOptions } from "./config/cors.js";
import auditLogRoutes from "./routes/audit-log.route.js";
import authRoutes from "./routes/auth.route.js";
import connectionStatusRoutes from "./routes/connection-status.route.js";
import depthTrackingRoutes from "./routes/depth-tracking.route.js";
import emailReportRoutes from "./routes/email-report.route.js";
import espWebSocketRoutes from "./routes/esp-websocket.route.js";
import exportRoutes from "./routes/export.route.js";
import failoverEventRoutes from "./routes/failover-event.route.js";
import gatewayRawPacketLogRoutes from "./routes/gateway-raw-packet-log.route.js";
import gatewayRoutes from "./routes/gateway.route.js";
import historicalDataRoutes from "./routes/historical-data.route.js";
import memoryFileRoutes from "./routes/memory-file.route.js";
import mwdDataRoutes from "./routes/mwd-data.route.js";
import mwdSessionRoutes from "./routes/mwd-session.route.js";
import plotTemplateRoutes from "./routes/plot-template.route.js";
import roleRoutes from "./routes/role.route.js";
import serialPortRoutes from "./routes/serial-port.route.js";
import surveyRoutes from "./routes/survey.route.js";
import surveyConfigRoutes from "./routes/survey-config.route.js";
import systemUtilityRoutes from "./routes/system-utility.route.js";
import userRoutes from "./routes/user.route.js";
import witsConfigRoutes from "./routes/wits-config.route.js";
import { witsAlarmRouter, witsDataRouter } from "./routes/wits-data.route.js";
import witsOutputRoutes from "./routes/wits-output.route.js";
import { prisma } from "./lib/prisma.js";
import { getEspWebSocketGatewayStatus } from "./services/esp-websocket.service.js";
import { getSerialGatewayStatus } from "./services/serial-gateway.service.js";
import {
  getConnectedClientCount,
  getWebSocketInstance,
} from "./services/websocket.service.js";
import {
  csrfProtection,
  rateLimit,
  securityHeaders,
} from "./middlewares/security.middleware.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { validateSecurityEnvironment } from "./utils/security-env.js";

const app = express();

validateSecurityEnvironment();

const envPositiveInt = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const testAwarePositiveInt = (
  name: string,
  normalDefault: number,
  testDefault: number,
  testName = `TEST_${name}`,
) =>
  process.env.NODE_ENV === "test"
    ? envPositiveInt(testName, envPositiveInt(name, testDefault))
    : envPositiveInt(name, normalDefault);

const isDecimalLike = (value: unknown): value is { toString: () => string } => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const decimal = value as {
    s?: unknown;
    e?: unknown;
    d?: unknown;
    toString?: unknown;
  };

  return (
    typeof decimal.s === "number" &&
    typeof decimal.e === "number" &&
    Array.isArray(decimal.d) &&
    typeof decimal.toString === "function"
  );
};

const normalizeJsonValue = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (isDecimalLike(value)) {
    return value.toString();
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeJsonValue(item)]),
    );
  }

  return value;
};

const getGatewayHealthStatus = (gateway: {
  enabled: boolean;
  connected: boolean;
  reconnecting: boolean;
}) => {
  if (!gateway.enabled) return "disabled";
  if (gateway.connected) return "connected";
  return "disconnected";
};

const getSystemHealth = async () => {
  const checkedAt = new Date().toISOString();
  const databaseStartedAt = Date.now();
  let databaseStatus = "ok";
  let databaseLatencyMs: number | null = null;
  let databaseError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseLatencyMs = Date.now() - databaseStartedAt;
  } catch (error: unknown) {
    databaseStatus = "error";
    databaseError = error instanceof Error ? error.message : "Database health check failed";
  }

  const serial = getSerialGatewayStatus();
  const espWebSocket = getEspWebSocketGatewayStatus();
  const serialStatus = getGatewayHealthStatus(serial);
  const espWebSocketStatus = getGatewayHealthStatus(espWebSocket);
  const hardwareDegraded =
    (serial.enabled && !serial.connected) ||
    (espWebSocket.enabled && !espWebSocket.connected);
  const websocketRunning = Boolean(getWebSocketInstance());
  const status =
    databaseStatus === "error" ? "error" : hardwareDegraded ? "degraded" : "ok";

  return {
    status,
    timestamp: checkedAt,
    checkedAt,
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version ?? "local",
    api: {
      status: "ok",
    },
    database: {
      status: databaseStatus,
      latencyMs: databaseLatencyMs,
      ...(databaseError ? { error: databaseError } : {}),
    },
    websocket: {
      status: websocketRunning ? "ok" : "error",
      path: "/ws",
      clientCount: getConnectedClientCount(),
    },
    gateways: {
      serial: {
        enabled: serial.enabled,
        status: serialStatus,
        port: serial.path,
        lastError: serial.lastError,
      },
      espWebSocket: {
        enabled: espWebSocket.enabled,
        status: espWebSocketStatus,
        url: espWebSocket.url,
        lastError: espWebSocket.lastError,
      },
    },
    dependencies: [
      {
        name: "Backend API",
        status: "ok",
      },
      {
        name: "Database",
        status: databaseStatus,
        ...(databaseError ? { message: databaseError } : {}),
      },
      {
        name: "Realtime WebSocket",
        status: websocketRunning ? "ok" : "error",
        message: "/ws",
      },
      {
        name: "Serial Gateway",
        status: serialStatus,
        message: serial.lastError ?? serial.path ?? undefined,
      },
      {
        name: "ESP WebSocket",
        status: espWebSocketStatus,
        message: espWebSocket.lastError ?? espWebSocket.url ?? undefined,
      },
    ],
  };
};

app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value,
);
app.set("trust proxy", 1);

app.use(securityHeaders);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(
  "/api/auth/login",
  rateLimit({
    keyPrefix: "auth-login",
    windowMs: 15 * 60 * 1000,
    max: testAwarePositiveInt("AUTH_LOGIN_RATE_LIMIT_MAX", 10, 100),
    message: "Too many login attempts. Please try again later.",
  }),
);
app.use(
  "/api/gateway",
  rateLimit({
    keyPrefix: "gateway",
    windowMs: testAwarePositiveInt("GATEWAY_RATE_LIMIT_WINDOW_MS", 60 * 1000, 60 * 1000),
    max: testAwarePositiveInt("GATEWAY_RATE_LIMIT_MAX", 120, 5_000),
    message: "Too many gateway requests. Please slow down.",
  }),
);
app.use(
  "/api",
  rateLimit({
    keyPrefix: "api",
    windowMs: 60 * 1000,
    max: testAwarePositiveInt("API_RATE_LIMIT_MAX", 600, 10_000),
  }),
);
app.use("/api", csrfProtection);
app.use((_req, res, next) => {
  const json = res.json.bind(res);

  res.json = (body?: unknown) => {
    return json(normalizeJsonValue(body));
  };

  next();
});

app.get("/", (_req, res) => {
  res.json({
    name: "MWD Monitoring API",
    status: "ok",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    name: "MWD Monitoring API",
    status: "ok",
    checkedAt: new Date().toISOString(),
  });
});

app.get("/api/health", async (_req, res, next) => {
  try {
    const health = await getSystemHealth();
    res.status(health.status === "error" ? 503 : 200).json(health);
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/connection-status", connectionStatusRoutes);
app.use("/api/depth-tracking", depthTrackingRoutes);
app.use("/api/reports", emailReportRoutes);
app.use("/api/esp-ws", espWebSocketRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/failover-events", failoverEventRoutes);
app.use("/api/gateway-raw-packets", gatewayRawPacketLogRoutes);
app.use("/api/gateway", gatewayRoutes);
app.use("/api/historical-data", historicalDataRoutes);
app.use("/api/memory-files", memoryFileRoutes);
app.use("/api/mwd-data", mwdDataRoutes);
app.use("/api/mwd-sessions", mwdSessionRoutes);
app.use("/api/plot-templates", plotTemplateRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/serial", serialPortRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/survey-configs", surveyConfigRoutes);
app.use("/api/system-utilities", systemUtilityRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wits-config", witsConfigRoutes);
app.use("/api/wits-data-values", witsDataRouter);
app.use("/api/wits-alarms", witsAlarmRouter);
app.use("/api/wits-output", witsOutputRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
