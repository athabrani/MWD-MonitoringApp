import { PolarisWitsId } from "@/types/polaris";

const WITS_CONFIG_STORAGE_KEY = "mwd-monitoring:wits-id-configs";

function mergeWithFallback(stored: PolarisWitsId[], fallback: PolarisWitsId[]): PolarisWitsId[] {
  const storedNumericIds = new Set(stored.map((item) => item.numericId));
  const missingFallbacks = fallback.filter((item) => !storedNumericIds.has(item.numericId));
  return [...stored, ...missingFallbacks];
}

export function loadStoredWitsIds(fallback: PolarisWitsId[]): PolarisWitsId[] {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(WITS_CONFIG_STORAGE_KEY);
    if (!stored) return fallback;

    const parsed = JSON.parse(stored) as PolarisWitsId[];
    if (!Array.isArray(parsed)) return fallback;

    return mergeWithFallback(parsed, fallback);
  } catch {
    return fallback;
  }
}

export function saveStoredWitsIds(witsIds: PolarisWitsId[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WITS_CONFIG_STORAGE_KEY, JSON.stringify(witsIds));
}

export function formatConfiguredWitsId(numericId: number): string {
  return String(numericId).padStart(4, "0");
}
