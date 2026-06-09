type ErrorLike = {
  status?: unknown;
  message?: unknown;
  payload?: unknown;
  responseBody?: unknown;
};

const genericRequestMessage = "Request gagal diproses. Silakan coba lagi.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStatus(error: unknown) {
  return isRecord(error) && typeof error.status === "number" ? error.status : undefined;
}

function safeBackendMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return genericRequestMessage;

  const lower = trimmed.toLowerCase();
  const looksInternal =
    lower.includes("stack") ||
    lower.includes("trace") ||
    lower.includes("sql") ||
    lower.includes("exception") ||
    lower.includes("select ") ||
    lower.includes("insert ") ||
    lower.includes("update ") ||
    lower.includes("delete ") ||
    lower.includes("bearer ") ||
    lower.includes("token") ||
    lower.includes("password") ||
    trimmed.length > 180;

  return looksInternal ? genericRequestMessage : trimmed;
}

export function getSafeErrorMessage(error: unknown, fallback = genericRequestMessage) {
  const status = readStatus(error);

  if (status === 400) return "Input tidak valid. Periksa kembali data yang diisi.";
  if (status === 401) return "Sesi login tidak valid. Silakan login ulang.";
  if (status === 403) return "Role Anda tidak memiliki izin untuk aksi ini.";
  if (status === 404) return "Data atau endpoint yang diminta tidak ditemukan.";
  if (status && status >= 500) return "Backend sedang bermasalah. Silakan coba lagi nanti.";

  if (error instanceof Error) return safeBackendMessage(error.message);

  if (isRecord(error)) {
    const errorLike = error as ErrorLike;
    if (typeof errorLike.message === "string") {
      return safeBackendMessage(errorLike.message);
    }
  }

  return fallback;
}

export function getSafeRequestErrorMessage(error: unknown) {
  return getSafeErrorMessage(error, "Gagal memuat data dari backend.");
}

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[Redacted]";
  if (typeof value === "string") {
    if (/bearer\s+[a-z0-9._-]+/i.test(value)) return value.replace(/bearer\s+[a-z0-9._-]+/i, "Bearer [Redacted]");
    if (value.length > 500) return `${value.slice(0, 500)}...`;
    return value;
  }
  if (!isRecord(value)) return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("token") ||
      lowerKey.includes("authorization") ||
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("responsebody") ||
      lowerKey.includes("rawresponsebody")
    ) {
      redacted[key] = "[Redacted]";
    } else {
      redacted[key] = redactSensitive(item, depth + 1);
    }
  }

  return redacted;
}

export function logSecurityDebug(label: string, data?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof console === "undefined") return;

  if (typeof data === "undefined") {
    console.info(label);
    return;
  }

  console.info(label, redactSensitive(data));
}

export function logSecurityError(label: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof console === "undefined") return;
  console.error(label, redactSensitive(error));
}
