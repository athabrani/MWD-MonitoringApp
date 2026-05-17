import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.route.js";
import connectionStatusRoutes from "./routes/connection-status.route.js";
import depthTrackingRoutes from "./routes/depth-tracking.route.js";
import emailReportRoutes from "./routes/email-report.route.js";
import espWebSocketRoutes from "./routes/esp-websocket.route.js";
import exportRoutes from "./routes/export.route.js";
import failoverEventRoutes from "./routes/failover-event.route.js";
import gatewayRoutes from "./routes/gateway.route.js";
import historicalDataRoutes from "./routes/historical-data.route.js";
import memoryFileRoutes from "./routes/memory-file.route.js";
import mwdDataRoutes from "./routes/mwd-data.route.js";
import mwdSessionRoutes from "./routes/mwd-session.route.js";
import plotTemplateRoutes from "./routes/plot-template.route.js";
import roleRoutes from "./routes/role.route.js";
import serialPortRoutes from "./routes/serial-port.route.js";
import surveyRoutes from "./routes/survey.route.js";
import systemUtilityRoutes from "./routes/system-utility.route.js";
import userRoutes from "./routes/user.route.js";
import witsConfigRoutes from "./routes/wits-config.route.js";
import { witsAlarmRouter, witsDataRouter } from "./routes/wits-data.route.js";
import witsOutputRoutes from "./routes/wits-output.route.js";

const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

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

app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value,
);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
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

app.use("/api/auth", authRoutes);
app.use("/api/connection-status", connectionStatusRoutes);
app.use("/api/depth-tracking", depthTrackingRoutes);
app.use("/api/reports", emailReportRoutes);
app.use("/api/esp-ws", espWebSocketRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/failover-events", failoverEventRoutes);
app.use("/api/gateway", gatewayRoutes);
app.use("/api/historical-data", historicalDataRoutes);
app.use("/api/memory-files", memoryFileRoutes);
app.use("/api/mwd-data", mwdDataRoutes);
app.use("/api/mwd-sessions", mwdSessionRoutes);
app.use("/api/plot-templates", plotTemplateRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/serial", serialPortRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/system-utilities", systemUtilityRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wits-config", witsConfigRoutes);
app.use("/api/wits-data-values", witsDataRouter);
app.use("/api/wits-alarms", witsAlarmRouter);
app.use("/api/wits-output", witsOutputRoutes);

export default app;
