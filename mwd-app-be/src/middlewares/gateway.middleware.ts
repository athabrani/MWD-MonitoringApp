import type { NextFunction, Request, Response } from "express";

const getGatewayApiKey = () => {
  const apiKey = process.env.GATEWAY_API_KEY;

  if (!apiKey) {
    throw new Error("GATEWAY_API_KEY is not configured");
  }

  return apiKey;
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

    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      return res.status(401).json({ message: "Invalid gateway credentials" });
    }

    next();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message });
  }
};
