const MIN_SECRET_LENGTH = 32;

const requireLongSecret = (key: string) => {
  const value = process.env[key];

  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
};

export const validateSecurityEnvironment = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  requireLongSecret("JWT_SECRET");

  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.includes("*")) {
    throw new Error("CORS_ORIGIN must be explicitly configured in production");
  }

  if (process.env.GATEWAY_API_KEY) {
    requireLongSecret("GATEWAY_API_KEY");
  }

  if (process.env.GATEWAY_HMAC_SECRET) {
    requireLongSecret("GATEWAY_HMAC_SECRET");
  }

  const exposesToken = ["1", "true", "yes", "on"].includes(
    process.env.AUTH_EXPOSE_TOKEN?.trim().toLowerCase() ?? "",
  );

  if (exposesToken) {
    throw new Error("AUTH_EXPOSE_TOKEN must be disabled in production");
  }

  if (process.env.AUTH_COOKIE_SAME_SITE === "None") {
    const secureCookie = ["1", "true", "yes", "on"].includes(
      process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase() ?? "",
    );

    if (!secureCookie) {
      throw new Error(
        "AUTH_COOKIE_SECURE=true is required when AUTH_COOKIE_SAME_SITE=None in production",
      );
    }
  }
};
