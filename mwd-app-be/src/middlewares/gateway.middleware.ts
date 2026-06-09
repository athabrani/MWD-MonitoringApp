import type { NextFunction, Request, Response } from "express";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const getGatewayApiKey = () => {
  const apiKey = process.env.GATEWAY_API_KEY;

  if (!apiKey) {
    throw new Error("GATEWAY_API_KEY is not configured");
  }

  return apiKey;
};

const hashSecret = (value: string) => {
  return createHash("sha256").update(value, "utf8").digest();
};

const safeSecretEqual = (left: string, right: string) => {
  const leftHash = hashSecret(left);
  const rightHash = hashSecret(right);

  return timingSafeEqual(leftHash, rightHash);
};

const getGatewayHmacSecret = () => {
  return process.env.GATEWAY_HMAC_SECRET?.trim() || "";
};

const canonicalizePayload = (value: unknown): string => {
  return JSON.stringify(value ?? {});
};

const verifyGatewaySignature = (req: Request) => {
  const hmacSecret = getGatewayHmacSecret();

  if (!hmacSecret) {
    return true;
  }

  const timestamp =
    typeof req.headers["x-gateway-timestamp"] === "string"
      ? req.headers["x-gateway-timestamp"].trim()
      : "";
  const signature =
    typeof req.headers["x-gateway-signature"] === "string"
      ? req.headers["x-gateway-signature"].trim()
      : "";
  const timestampMs = Number(timestamp);

  if (!timestamp || !signature || !Number.isFinite(timestampMs)) {
    return false;
  }

  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const expectedSignature = createHmac("sha256", hmacSecret)
    .update(`${timestamp}.${canonicalizePayload(req.body)}`)
    .digest("hex");

  return safeSecretEqual(signature, expectedSignature);
};

export const authenticateGateway = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const expectedApiKey = getGatewayApiKey();
    const headerApiKey = req.headers["x-gateway-key"];
    const authorization = req.headers.authorization;

    const providedApiKey =
      typeof headerApiKey === "string"
        ? headerApiKey.trim()
        : authorization?.startsWith("Bearer ")
          ? authorization.slice(7).trim()
          : "";

    if (!providedApiKey || !safeSecretEqual(providedApiKey, expectedApiKey)) {
      return res.status(401).json({ message: "Invalid gateway credentials" });
    }

    if (!verifyGatewaySignature(req)) {
      return res.status(401).json({ message: "Invalid gateway signature" });
    }

    next();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message });
  }
};
