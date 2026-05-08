import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.route.js";
import connectionStatusRoutes from "./routes/connection-status.route.js";
import exportRoutes from "./routes/export.route.js";
import failoverEventRoutes from "./routes/failover-event.route.js";
import gatewayRoutes from "./routes/gateway.route.js";
import historicalDataRoutes from "./routes/historical-data.route.js";
import mwdDataRoutes from "./routes/mwd-data.route.js";
import mwdSessionRoutes from "./routes/mwd-session.route.js";
import roleRoutes from "./routes/role.route.js";
import userRoutes from "./routes/user.route.js";

const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value,
);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "MWD Monitoring API",
    status: "ok",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/connection-status", connectionStatusRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/failover-events", failoverEventRoutes);
app.use("/api/gateway", gatewayRoutes);
app.use("/api/historical-data", historicalDataRoutes);
app.use("/api/mwd-data", mwdDataRoutes);
app.use("/api/mwd-sessions", mwdSessionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

export default app;
