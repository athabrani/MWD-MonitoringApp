import { ThresholdSettings } from "@/types";
import { PolarisWitsId } from "@/types/polaris";

export type ParameterStatus = "normal" | "warning" | "critical";

export interface DashboardThresholdDefinition {
  key: string;
  label: string;
  unit: string;
  category: string;
  low: number;
  high: number;
  enabled?: boolean;
}

export const dashboardThresholdDefinitions: DashboardThresholdDefinition[] = [
  { key: "inc", label: "Inclination", unit: "deg", category: "directional", low: 0, high: 45 },
  { key: "azi", label: "Azimuth", unit: "deg", category: "directional", low: 0, high: 360, enabled: false },
  { key: "gamma", label: "Gamma", unit: "API", category: "formation", low: 0, high: 150 },
  { key: "wob", label: "WOB", unit: "klbs", category: "drilling", low: 0, high: 25 },
  { key: "gammaDepth", label: "Gamma Depth", unit: "depth", category: "depth", low: 0, high: 5000, enabled: false },
  { key: "pulseAmp", label: "Pulse Amp", unit: "amp", category: "tool", low: 2.5, high: 6 },
  { key: "bitDepth", label: "Bit Depth", unit: "depth", category: "depth", low: 0, high: 5000, enabled: false },
  { key: "decoderPressure", label: "Decoder Pressure", unit: "psi", category: "mud", low: 500, high: 4000 },
  { key: "holeDepth", label: "Hole Depth", unit: "depth", category: "depth", low: 0, high: 5000, enabled: false },
  { key: "pumpPressure", label: "Pump Pressure", unit: "psi", category: "mud", low: 500, high: 4000 },
  { key: "rop", label: "ROP", unit: "rate", category: "drilling", low: 10, high: 120 },
  { key: "gravity", label: "Gravity", unit: "deg", category: "toolface", low: 0, high: 360, enabled: false },
  { key: "mudweight", label: "Mud Weight", unit: "ppg", category: "mud", low: 8, high: 12 },
  { key: "temp", label: "Temp", unit: "degF", category: "tool", low: 32, high: 180 },
  { key: "rpm", label: "RPM", unit: "rpm", category: "drilling", low: 0, high: 150 },
  { key: "vibration", label: "Vib (ax.lat)", unit: "g", category: "tool", low: 0, high: 5 },
  { key: "rpmDownhole", label: "RPM Downhole", unit: "rpm", category: "drilling", low: 0, high: 150 },
  { key: "diffPressure", label: "Diff Pressure", unit: "psi", category: "mud", low: 0, high: 850 },
  { key: "ecdTvdSurveyBase", label: "ECD TVD Survey Base", unit: "ppg", category: "mud", low: 8, high: 13 },
  { key: "tvd", label: "TVD", unit: "depth", category: "depth", low: 0, high: 5000, enabled: false },
] as const;

export type DashboardThresholdKey = string;

export type ResolvedWitsConfigThreshold = {
  enabled: boolean;
  low: number;
  high: number;
  lowSource: "backend" | "default" | "empty";
  highSource: "backend" | "default" | "empty";
};

export function buildDefaultDashboardThresholds(): ThresholdSettings[] {
  return dashboardThresholdDefinitions.map((definition) => ({
    parameter: definition.key,
    enabled: definition.enabled ?? true,
    low: definition.low,
    high: definition.high,
    warning: definition.high,
    critical: definition.high,
  }));
}

export function mergeDashboardThresholds(
  thresholds: ThresholdSettings[]
): ThresholdSettings[] {
  const storedByParameter = new Map(thresholds.map((threshold) => [threshold.parameter, threshold]));

  return buildDefaultDashboardThresholds().map((fallback) => {
    const stored = storedByParameter.get(fallback.parameter);

    if (!stored) {
      return fallback;
    }

    return {
      ...fallback,
      ...stored,
      enabled: stored.enabled ?? fallback.enabled,
      low: stored.low ?? fallback.low,
      high: stored.high ?? stored.warning ?? fallback.high,
      warning: stored.warning ?? stored.high ?? fallback.warning,
      critical: stored.critical ?? stored.high ?? fallback.critical,
    };
  });
}

function formatWitsId(value: number) {
  return String(value).padStart(4, "0");
}

function normalizeLookupValue(value?: string) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function inferDashboardThresholdKeys(config: PolarisWitsId) {
  const keys = new Set<string>();
  const witsId = formatWitsId(config.numericId);
  const candidates = [
    config.mappedField,
    config.name,
    config.lasMnemonic,
    config.lasDescription,
    config.realTimePlot,
    witsId,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeLookupValue);

  const addIfMatches = (dashboardKey: string, aliases: string[]) => {
    if (candidates.some((candidate) => aliases.includes(candidate))) {
      keys.add(dashboardKey);
    }
  };

  if (config.mappedField) keys.add(config.mappedField);
  keys.add(witsId);

  addIfMatches("inc", ["inc", "inclination"]);
  addIfMatches("azi", ["azi", "azimuth"]);
  addIfMatches("gamma", ["gamma", "gammaray", "gr"]);
  addIfMatches("wob", ["wob", "weightonbit"]);
  addIfMatches("gammaDepth", ["gammadepth", "gammamd", "gammameasureddepth"]);
  addIfMatches("pulseAmp", ["pulseamp", "pulseamplitude"]);
  addIfMatches("bitDepth", ["bitdepth", "depthmd", "measureddepth", "md"]);
  addIfMatches("decoderPressure", ["decoderpressure"]);
  addIfMatches("holeDepth", ["holedepth"]);
  addIfMatches("pumpPressure", ["pumppressure", "standpipepressure", "spp", "pressure"]);
  addIfMatches("spp", ["pumppressure", "standpipepressure", "spp", "pressure"]);
  addIfMatches("rop", ["rop", "rateofpenetration"]);
  addIfMatches("mudweight", ["mudweight", "mw"]);
  addIfMatches("temp", ["temp", "temperature"]);
  addIfMatches("rpm", ["rpm", "rotaryspeed"]);
  addIfMatches("vibration", ["vibration", "vib"]);
  addIfMatches("rpmDownhole", ["rpmdownhole", "downholerpm"]);
  addIfMatches("diffPressure", ["diffpressure", "differentialpressure"]);
  addIfMatches("ecdTvdSurveyBase", ["ecdtvdsurveybase"]);
  addIfMatches("ecd", ["ecd"]);
  addIfMatches("tvd", ["tvd"]);
  addIfMatches("toolface", ["toolface", "gtf", "mtf"]);

  return Array.from(keys);
}

function getDefaultThresholdForWitsConfig(
  config: PolarisWitsId,
  fallbackThresholds: ThresholdSettings[] = []
) {
  const fallback = mergeDashboardThresholds(fallbackThresholds);
  const fallbackByParameter = new Map(fallback.map((threshold) => [threshold.parameter, threshold]));
  const keys = inferDashboardThresholdKeys(config);

  return keys
    .map((key) => fallbackByParameter.get(key))
    .find((threshold): threshold is ThresholdSettings => Boolean(threshold));
}

export function resolveWitsConfigThreshold(
  config: PolarisWitsId,
  fallbackThresholds: ThresholdSettings[] = []
): ResolvedWitsConfigThreshold {
  const defaultThreshold = getDefaultThresholdForWitsConfig(config, fallbackThresholds);
  const backendLow = config.alarmLowFromBackend && Number.isFinite(config.alarmLow) ? config.alarmLow : undefined;
  const backendHigh = config.alarmHighFromBackend && Number.isFinite(config.alarmHigh) ? config.alarmHigh : undefined;
  const defaultLow = defaultThreshold?.low;
  const defaultHigh = defaultThreshold?.high;
  const low = backendLow ?? defaultLow ?? config.alarmLow;
  const high = backendHigh ?? defaultHigh ?? config.alarmHigh;

  return {
    enabled: config.alarmEnabledFromBackend
      ? config.alarmEnabled
      : defaultThreshold?.enabled ?? config.alarmEnabled,
    low,
    high,
    lowSource: backendLow !== undefined ? "backend" : defaultLow !== undefined ? "default" : "empty",
    highSource: backendHigh !== undefined ? "backend" : defaultHigh !== undefined ? "default" : "empty",
  };
}

export function buildDashboardThresholdsFromWitsConfig(
  configs: PolarisWitsId[],
  fallbackThresholds: ThresholdSettings[]
) {
  const fallback = mergeDashboardThresholds(fallbackThresholds);

  if (configs.length === 0) {
    return fallback;
  }

  const byParameter = new Map(fallback.map((threshold) => [threshold.parameter, threshold]));

  for (const config of configs) {
    const resolved = resolveWitsConfigThreshold(config, fallbackThresholds);
    const low = Number.isFinite(resolved.low) ? resolved.low : undefined;
    const high = Number.isFinite(resolved.high) ? resolved.high : undefined;
    const keys = inferDashboardThresholdKeys(config);

    for (const parameter of keys) {
      byParameter.set(parameter, {
        parameter,
        enabled: resolved.enabled,
        low,
        high,
        warning: high ?? low ?? 0,
        critical: high ?? low ?? 0,
      });
    }
  }

  return Array.from(byParameter.values());
}

export function getDashboardThresholdStatus(
  value: number,
  threshold?: ThresholdSettings
): ParameterStatus {
  if (!threshold?.enabled) {
    return "normal";
  }

  const low = threshold.low;
  const high = threshold.high;

  if (low === undefined && high === undefined) {
    return "normal";
  }

  if ((low !== undefined && value < low) || (high !== undefined && value > high)) {
    return "critical";
  }

  const lowWarningBand = low !== undefined ? Math.abs(low) * 0.1 || 1 : undefined;
  const highWarningBand = high !== undefined ? Math.abs(high) * 0.1 || 1 : undefined;

  if (low !== undefined && lowWarningBand !== undefined && value <= low + lowWarningBand) {
    return "warning";
  }

  if (high !== undefined && highWarningBand !== undefined && value >= high - highWarningBand) {
    return "warning";
  }

  return "normal";
}
