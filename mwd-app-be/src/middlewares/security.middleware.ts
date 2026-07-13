import type { NextFunction, Request, Response } from "express";
import { getAccessTokenFromCookie, getCsrfTokenFromCookie } from "../utils/cookies.js";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const getClientKey = (req: Request, keyPrefix: string) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp =
    typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : "";
  const ip = forwardedIp || req.ip || req.socket.remoteAddress || "unknown";

  return `${keyPrefix}:${ip}`;
};

const cleanupRateLimitStore = (now: number) => {
  if (rateLimitStore.size < 10_000) {
    return;
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }

    if (rateLimitStore.size < 8_000) {
      break;
    }
  }
};

export const securityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};

export const rateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = getClientKey(req, options.keyPrefix ?? "global");
    const current = rateLimitStore.get(key);
    const entry =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + options.windowMs };

    entry.count += 1;
    rateLimitStore.set(key, entry);
    cleanupRateLimitStore(now);

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - entry.count)));
    res.setHeader("RateLimit-Reset", String(retryAfterSeconds));

    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: options.message ?? "Too many requests",
      });
    }

    next();
  };
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (req.headers.authorization?.startsWith("Bearer ")) {
    return next();
  }

  if (!getAccessTokenFromCookie(req)) {
    return next();
  }

  const cookieToken = getCsrfTokenFromCookie(req);
  const headerToken =
    typeof req.headers["x-csrf-token"] === "string"
      ? req.headers["x-csrf-token"].trim()
      : "";

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  next();
};
