import { PlotConfiguration, TrackConfig, TrackScaleType } from "@/types/plotting";

export type RenderablePlotCurve = {
  id: string;
  label: string;
  dataSource: string;
  scale: string;
  lineColor: string;
  lineWidth: number;
  lineStyle: string;
  min?: number;
  max?: number;
};

export type RenderablePlotTrack = {
  id: string;
  label: string;
  order: number;
  scaleType: TrackScaleType;
  densityTicMarks: boolean;
  curves: RenderablePlotCurve[];
};

export type WrappedTrackValue = {
  originalValue: number;
  displayValue: number;
  isWrapped: boolean;
  wrapCount: number;
  direction: "none" | "left" | "right";
};

export type TrackValueRange = {
  min: number;
  max: number;
};

export function isCurveEnabled(curve: { dataSource?: string }) {
  const source = curve.dataSource?.trim().toLowerCase();
  return Boolean(source && source !== "none");
}

export function isTrackEnabled(track: TrackConfig) {
  return track.curves.some(isCurveEnabled);
}

export function getTrackDisplayLabel(track: TrackConfig, index: number) {
  return track.name.trim() || `Track ${index + 1}`;
}

function parseScale(scale: string): Pick<RenderablePlotCurve, "min" | "max"> {
  const [left, right] = scale.split("-").map((value) => Number(value.trim()));

  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
    return { min: left, max: right };
  }

  return {};
}

export function getValidTrackValueRange(min?: number, max?: number): TrackValueRange | null {
  const numericMin = Number(min);
  const numericMax = Number(max);

  if (!Number.isFinite(numericMin) || !Number.isFinite(numericMax) || numericMin === numericMax) {
    return null;
  }

  return numericMin < numericMax
    ? { min: numericMin, max: numericMax }
    : { min: numericMax, max: numericMin };
}

function positiveModulo(value: number, range: number) {
  return ((value % range) + range) % range;
}

export function getWrappedTrackValue({
  value,
  min,
  max,
}: {
  value: number | string | null | undefined;
  min?: number;
  max?: number;
}): WrappedTrackValue | null {
  const originalValue = typeof value === "string" ? Number(value.trim()) : Number(value);
  const bounds = getValidTrackValueRange(min, max);

  if (!Number.isFinite(originalValue) || !bounds) {
    return null;
  }

  const range = bounds.max - bounds.min;

  if (originalValue >= bounds.min && originalValue <= bounds.max) {
    return {
      originalValue,
      displayValue: originalValue,
      isWrapped: false,
      wrapCount: 0,
      direction: "none",
    };
  }

  return {
    originalValue,
    displayValue: bounds.min + positiveModulo(originalValue - bounds.min, range),
    isWrapped: true,
    wrapCount:
      originalValue > bounds.max
        ? Math.floor((originalValue - bounds.min) / range)
        : Math.ceil((bounds.min - originalValue) / range),
    direction: originalValue > bounds.max ? "right" : "left",
  };
}

export function getRenderableTracksFromPlotConfig(config?: PlotConfiguration | null): RenderablePlotTrack[] {
  if (!config) return [];

  return config.tracks
    .map((track, index) => {
      const curves = track.curves.filter(isCurveEnabled).map((curve) => ({
        id: curve.id,
        label: curve.dataSource,
        dataSource: curve.dataSource,
        scale: curve.scale,
        lineColor: curve.lineColor,
        lineWidth: curve.lineWidth,
        lineStyle: curve.lineStyle,
        ...parseScale(curve.scale),
      }));

      return {
        id: track.id,
        label: getTrackDisplayLabel(track, index),
        order: index,
        scaleType: track.scaleType,
        densityTicMarks: track.densityTicMarks,
        curves,
      };
    })
    .filter((track) => track.curves.length > 0);
}

export function getTrackWindow<T>(tracks: T[], startIndex: number, visibleCount: number) {
  const safeVisibleCount = Math.max(1, visibleCount);
  const maxStart = Math.max(tracks.length - safeVisibleCount, 0);
  const safeStart = Math.min(Math.max(startIndex, 0), maxStart);
  const pageCount = Math.max(Math.ceil(tracks.length / safeVisibleCount), 1);

  return {
    startIndex: safeStart,
    endIndex: Math.min(safeStart + safeVisibleCount, tracks.length),
    maxStart,
    tracks: tracks.slice(safeStart, safeStart + safeVisibleCount),
    hasPrevious: safeStart > 0,
    hasNext: safeStart + safeVisibleCount < tracks.length,
    pageCount,
    pageIndex: safeStart >= maxStart ? pageCount - 1 : Math.floor(safeStart / safeVisibleCount),
  };
}
