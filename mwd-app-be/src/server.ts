import "dotenv/config";
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
import { syncSystemRoles } from "./services/role.service.js";

const app = express();
const PORT = 5001;
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

const startServer = async () => {
  await syncSystemRoles();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown server startup error";
  console.error(`Failed to start server: ${message}`);
  process.exit(1);
});
