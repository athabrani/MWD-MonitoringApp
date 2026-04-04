import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.route.js";
import mwdSessionRoutes from "./routes/mwd-session.route.js";
import roleRoutes from "./routes/role.route.js";
import userRoutes from "./routes/user.route.js";

const app = express();
const PORT = 5001;
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/mwd-sessions", mwdSessionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
