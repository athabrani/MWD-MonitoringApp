import type { CorsOptions } from "cors";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://100.110.181.15:3000",
];

export const getAllowedCorsOrigins = () => {
  const configured = process.env.CORS_ORIGIN?.trim();
  const origins = configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_CORS_ORIGINS;

  return Array.from(new Set(origins));
};

export const isCorsOriginAllowed = (origin?: string) => {
  if (!origin) {
    return true;
  }

  return getAllowedCorsOrigins().includes(origin);
};

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isCorsOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(
        `CORS origin not allowed: ${origin}. Configure CORS_ORIGIN to include this frontend origin.`,
      ),
      false,
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-csrf-token",
    "x-gateway-key",
    "x-gateway-timestamp",
    "x-gateway-signature",
  ],
  optionsSuccessStatus: 204,
};
