import type { Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_COOKIE = "mwd_access_token";
const CSRF_TOKEN_COOKIE = "mwd_csrf_token";

export const parseCookies = (req: Request) => {
  const rawCookie = req.headers.cookie;

  if (!rawCookie) {
    return {};
  }

  return Object.fromEntries(
    rawCookie
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separatorIndex = item.indexOf("=");

        if (separatorIndex === -1) {
          return [item, ""];
        }

        const key = item.slice(0, separatorIndex);
        const value = item.slice(separatorIndex + 1);

        try {
          return [key, decodeURIComponent(value)];
        } catch {
          return [key, value];
        }
      }),
  );
};

const serializeCookie = (
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    maxAgeSeconds?: number;
    sameSite?: "Lax" | "Strict" | "None";
  } = {},
) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/"];

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (isProduction) {
    parts.push("Secure");
  }

  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  return parts.join("; ");
};

export const getAccessTokenFromCookie = (req: Request) => {
  return parseCookies(req)[ACCESS_TOKEN_COOKIE] ?? "";
};

export const getCsrfTokenFromCookie = (req: Request) => {
  return parseCookies(req)[CSRF_TOKEN_COOKIE] ?? "";
};

export const setAuthCookies = (
  res: Response,
  input: { accessToken: string; csrfToken: string; maxAgeSeconds: number },
) => {
  res.append(
    "Set-Cookie",
    serializeCookie(ACCESS_TOKEN_COOKIE, input.accessToken, {
      httpOnly: true,
      maxAgeSeconds: input.maxAgeSeconds,
    }),
  );
  res.append(
    "Set-Cookie",
    serializeCookie(CSRF_TOKEN_COOKIE, input.csrfToken, {
      httpOnly: false,
      maxAgeSeconds: input.maxAgeSeconds,
    }),
  );
};

export const clearAuthCookies = (res: Response) => {
  res.append(
    "Set-Cookie",
    serializeCookie(ACCESS_TOKEN_COOKIE, "", {
      httpOnly: true,
      maxAgeSeconds: 0,
    }),
  );
  res.append(
    "Set-Cookie",
    serializeCookie(CSRF_TOKEN_COOKIE, "", {
      httpOnly: false,
      maxAgeSeconds: 0,
    }),
  );
};
