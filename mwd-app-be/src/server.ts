import express from "express";

const app = express();
const PORT = Number(process.env.PORT ?? 5001);
const startedAt = Date.now();

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

app.get("/", (req, res) => {
    res.send("Hello from the server!");
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "degraded",
        version: process.env.npm_package_version ?? "unknown",
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        databaseStatus: "unsupported",
        dependencies: [
            {
                name: "database",
                status: "unsupported",
                message: "Database health check is not configured in this backend.",
            },
            {
                name: "gateway-raw-packets",
                status: "unsupported",
                message: "Raw packet storage/stream endpoint is not configured.",
            },
        ],
        checkedAt: new Date().toISOString(),
    });
});

app.get("/api/gateway-raw-packets", (req, res) => {
    res.json({
        packets: [],
        count: 0,
        status: "unsupported",
        message: "Gateway raw packet storage/stream is not configured in this backend.",
    });
});

//http:/localhost:5001
