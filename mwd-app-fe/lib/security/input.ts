export type PreflightResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const controlCharacters = /[\u0000-\u001f\u007f]/g;

export function sanitizeTextInput(value: string, options: { maxLength?: number } = {}) {
  const maxLength = options.maxLength ?? 240;
  return value.replace(controlCharacters, "").trim().slice(0, maxLength);
}

export function sanitizeOptionalTextInput(value: string | undefined, options: { maxLength?: number } = {}) {
  return sanitizeTextInput(value ?? "", options);
}

export function normalizeEmailInput(value: string) {
  return sanitizeTextInput(value, { maxLength: 254 }).toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeIdentifierInput(value: string) {
  return sanitizeTextInput(value, { maxLength: 128 });
}

export function parseFiniteNumber(value: string | number, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateDepthRange(startDepth: number, endDepth: number) {
  if (!Number.isFinite(startDepth) || !Number.isFinite(endDepth)) {
    return "Depth range must contain valid numbers.";
  }
  if (startDepth < 0 || endDepth < 0) {
    return "Depth values cannot be negative.";
  }
  if (startDepth > endDepth) {
    return "Start Depth cannot be greater than End Depth.";
  }
  return "";
}

export function validateJsonFile(file: File, options: { maxSizeMb?: number } = {}) {
  const maxSizeMb = options.maxSizeMb ?? 5;
  const lowerName = file.name.toLowerCase();
  const isJsonType = file.type === "application/json" || file.type === "";

  if (!lowerName.endsWith(".json") || !isJsonType) {
    return "Backup file must be a JSON file.";
  }

  if (file.size <= 0) {
    return "Backup file is empty.";
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    return `Backup file must be ${maxSizeMb} MB or smaller.`;
  }

  return "";
}
