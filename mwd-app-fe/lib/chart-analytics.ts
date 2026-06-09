import type { ChartDataPoint } from "@/types";

export type ChartTimeWindow = "5min" | "15min" | "1hr" | "all";
export type ChartValueMode = "raw" | "normalized";
export type ChartParameterCategory = "drilling" | "mud" | "directional" | "formation";

export type ChartParameterDefinition = {
  key: string;
  label: string;
  color: string;
  unit: string;
  category: ChartParameterCategory;
};

export type ParameterAnalytics = {
  key: string;
  label: string;
  unit: string;
  count: number;
  min?: number;
  max?: number;
  average?: number;
  latest?: number;
  trend: "up" | "down" | "stable" | "insufficient";
};

export const chartParameterGroups: Record<ChartParameterCategory, ChartParameterDefinition[]> = {
  drilling: [
    { key: "rop", label: "Rate of Penetration", color: "#10b981", unit: "m/hr", category: "drilling" },
    { key: "wob", label: "Weight on Bit", color: "#3b82f6", unit: "klbs", category: "drilling" },
    { key: "rpm", label: "Rotary Speed", color: "#8b5cf6", unit: "rpm", category: "drilling" },
    { key: "bitDepth", label: "Bit Depth", color: "#f97316", unit: "m", category: "drilling" },
    { key: "holeDepth", label: "Hole Depth", color: "#64748b", unit: "m", category: "drilling" },
  ],
  mud: [
    { key: "spp", label: "Standpipe Pressure", color: "#f59e0b", unit: "psi", category: "mud" },
    { key: "flowrate", label: "Flow Rate", color: "#06b6d4", unit: "gpm", category: "mud" },
    { key: "flowIn", label: "Flow In", color: "#0891b2", unit: "gpm", category: "mud" },
    { key: "flowOut", label: "Flow Out", color: "#22d3ee", unit: "gpm", category: "mud" },
    { key: "mudWeight", label: "Mud Weight", color: "#a16207", unit: "ppg", category: "mud" },
    { key: "decoderPressure", label: "Decoder Pressure", color: "#fb7185", unit: "psi", category: "mud" },
    { key: "temp", label: "Temperature", color: "#ef4444", unit: "degF", category: "mud" },
  ],
  directional: [
    { key: "inc", label: "Inclination", color: "#ec4899", unit: "deg", category: "directional" },
    { key: "azi", label: "Azimuth", color: "#14b8a6", unit: "deg", category: "directional" },
    { key: "toolface", label: "Toolface", color: "#0ea5e9", unit: "deg", category: "directional" },
    { key: "gtf", label: "Gravity Toolface", color: "#6366f1", unit: "deg", category: "directional" },
    { key: "mtf", label: "Magnetic Toolface", color: "#a855f7", unit: "deg", category: "directional" },
  ],
  formation: [
    { key: "gamma", label: "Gamma Ray", color: "#84cc16", unit: "API", category: "formation" },
  ],
};

export const allChartParameters = Object.values(chartParameterGroups).flat();

export function getTimestampMs(point: ChartDataPoint) {
  const rawTimestamp = point.timestamp;
  const timestamp = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp as unknown as string);
  return timestamp.getTime();
}

export function getSafeChartData(data: ChartDataPoint[]) {
  return Array.isArray(data) ? data.filter((point) => Number.isFinite(getTimestampMs(point))) : [];
}

export function filterChartDataByTimeWindow(data: ChartDataPoint[], timeWindow: ChartTimeWindow) {
  const safeData = getSafeChartData(data);
  if (timeWindow === "all" || safeData.length === 0) return safeData;

  const windowMs = timeWindow === "5min" ? 5 * 60_000 : timeWindow === "15min" ? 15 * 60_000 : 60 * 60_000;
  const latestTimestampMs = Math.max(...safeData.map(getTimestampMs).filter(Number.isFinite));

  if (!Number.isFinite(latestTimestampMs)) return [];

  const windowStartMs = latestTimestampMs - windowMs;
  return safeData.filter((point) => {
    const timestampMs = getTimestampMs(point);
    return timestampMs >= windowStartMs && timestampMs <= latestTimestampMs;
  });
}

export function getParametersWithData(
  data: ChartDataPoint[],
  parameters: ChartParameterDefinition[]
) {
  return parameters.filter((parameter) =>
    data.some((point) => {
      const value = point[parameter.key];
      return typeof value === "number" && Number.isFinite(value);
    })
  );
}

export function normalizeChartDataForParameters(data: ChartDataPoint[], parameterKeys: string[]) {
  const ranges = new Map<string, { min: number; max: number }>();

  for (const key of parameterKeys) {
    const values = data
      .map((point) => point[key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) continue;

    ranges.set(key, {
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }

  return data.map((point) => {
    const nextPoint: ChartDataPoint = {
      timestamp: point.timestamp,
      depth: point.depth,
    };

    for (const key of parameterKeys) {
      const value = point[key];
      const range = ranges.get(key);

      if (typeof value !== "number" || !Number.isFinite(value) || !range) continue;
      nextPoint[key] = range.max === range.min ? 50 : ((value - range.min) / (range.max - range.min)) * 100;
    }

    return nextPoint;
  });
}

export function buildParameterAnalytics(data: ChartDataPoint[], parameters: ChartParameterDefinition[]) {
  return parameters.map<ParameterAnalytics>((parameter) => {
    const orderedValues = data
      .map((point) => ({ timestampMs: getTimestampMs(point), value: point[parameter.key] }))
      .filter(
        (item): item is { timestampMs: number; value: number } =>
          Number.isFinite(item.timestampMs) && typeof item.value === "number" && Number.isFinite(item.value)
      )
      .sort((left, right) => left.timestampMs - right.timestampMs);

    if (orderedValues.length === 0) {
      return {
        key: parameter.key,
        label: parameter.label,
        unit: parameter.unit,
        count: 0,
        trend: "insufficient",
      };
    }

    const values = orderedValues.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const first = values[0];
    const latest = values[values.length - 1];
    const range = max - min;
    const threshold = range > 0 ? range * 0.02 : Math.max(Math.abs(average) * 0.01, 0.001);
    const delta = latest - first;
    const trend = values.length < 2 ? "insufficient" : Math.abs(delta) <= threshold ? "stable" : delta > 0 ? "up" : "down";

    return {
      key: parameter.key,
      label: parameter.label,
      unit: parameter.unit,
      count: values.length,
      min,
      max,
      average,
      latest,
      trend,
    };
  });
}
