"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DepthRow = {
  depth: number;
  time: string;
};

type MetricConfig = {
  id: string;
  label: string;
  color: string;
  min?: number;
  max?: number;
};

type PlotTrack = {
  id: string;
  title: string;
  metrics: MetricConfig[];
};

const depthRows: DepthRow[] = [
  { depth: 1900, time: "08:10:12" },
  { depth: 2000, time: "08:14:36" },
  { depth: 2100, time: "08:19:10" },
  { depth: 2200, time: "08:24:28" },
  { depth: 2300, time: "08:29:44" },
  { depth: 2400, time: "08:35:12" },
  { depth: 2500, time: "08:40:20" },
  { depth: 2600, time: "08:45:56" },
  { depth: 2700, time: "08:51:14" },
  { depth: 2800, time: "08:56:42" },
];

const plotTracks: PlotTrack[] = [
  {
    id: "plot-1",
    title: "Plot 1",
    metrics: [
      { id: "pressure_annular", label: "Pressure - Annular", color: "#2e7d32", min: 0, max: 3000 },
      { id: "pressure_bore", label: "Pressure - Bore", color: "#5c6bc0", min: 0, max: 3000 },
      { id: "pump_press", label: "Pump Press", color: "#bc8f5a", min: 0, max: 3000 },
      { id: "an_diff_res", label: "An Diff Res", color: "#c9a227", min: 0, max: 2000 },
    ],
  },
  {
    id: "plot-2",
    title: "Plot 2",
    metrics: [
      { id: "mud_weight", label: "Mud Weight", color: "#4caf50", min: 0, max: 20 },
      { id: "ecd_calc", label: "ECD Calculation - ppg", color: "#3f51b5", min: 0, max: 10000 },
    ],
  },
  {
    id: "plot-3",
    title: "Plot 3",
    metrics: [
      { id: "shock_ax_lat", label: "Shock (ax.lat)", color: "#d4a017", min: 0, max: 45 },
      { id: "vib_ax_lat", label: "Vib (ax.lat)", color: "#26a69a", min: 0, max: 25 },
      { id: "ssi", label: "SSI", color: "#607d8b", min: 0, max: 5 },
      { id: "rpm_downhole", label: "RPM Downhole", color: "#ab47bc", min: 0, max: 300 },
      { id: "temp", label: "Temp", color: "#ef5350", min: 0, max: 100 },
    ],
  },
  {
    id: "plot-4",
    title: "Plot 4",
    metrics: [
      { id: "bit_depth", label: "Bit Depth", color: "#66bb6a", min: 0, max: 3000 },
      { id: "hook_pos", label: "Hook Pos", color: "#8d6e63", min: 0, max: 105 },
      { id: "hole_depth", label: "Hole Depth", color: "#3949ab", min: 0, max: 10000 },
    ],
  },
];

function getMetricValue(metricId: string, depth: number, index: number) {
  switch (metricId) {
    case "pressure_annular":
      return 1100 + index * 40 + (index % 2 === 0 ? 120 : -80);
    case "pressure_bore":
      return 1800 + index * 25 + (index % 3 === 0 ? 70 : -40);
    case "pump_press":
      return 700 + index * 90;
    case "an_diff_res":
      return 300 + index * 35 + (index % 2 === 0 ? 60 : -20);

    case "mud_weight":
      return 9.6 + index * 0.08;
    case "ecd_calc":
      return 8.9 + index * 0.12;

    case "shock_ax_lat":
      return 8 + index * 2.2;
    case "vib_ax_lat":
      return 6 + index * 1.5;
    case "ssi":
      return 1 + index * 0.25;
    case "rpm_downhole":
      return 110 + index * 8;
    case "temp":
      return 45 + index * 3.2;

    case "bit_depth":
      return depth - 40;
    case "hook_pos":
      return 95 - index * 2.3;
    case "hole_depth":
      return depth + 120;

    default:
      return index;
  }
}

function buildPath(metric: MetricConfig, rows: DepthRow[], plotHeightPx: number) {
  const values = rows.map((row, index) => getMetricValue(metric.id, row.depth, index));
  const min = metric.min ?? Math.min(...values);
  const max = metric.max ?? Math.max(...values);
  const range = max - min || 1;

  const points = rows.map((row, index) => {
    const value = getMetricValue(metric.id, row.depth, index);
    const x = 12 + ((value - min) / range) * 76;
    const y = 12 + (index / (rows.length - 1)) * (plotHeightPx - 24);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return `M ${points.join(" L ")}`;
}

function MetricHeader({ metric }: { metric: MetricConfig }) {
  return (
    <div className="grid grid-cols-[28px_1fr_40px] items-center gap-1 text-[9px] leading-none sm:grid-cols-[32px_1fr_48px] sm:text-[10px] lg:grid-cols-[36px_1fr_54px] lg:text-[11px]">
      <span className="tabular-nums text-slate-500 dark:text-slate-400">
        {metric.min ?? 0}
      </span>
      <span
        className="truncate text-center font-medium"
        style={{ color: metric.color }}
        title={metric.label}
      >
        {metric.label}
      </span>
      <span className="tabular-nums text-right text-slate-500 dark:text-slate-400">
        {metric.max ?? "-"}
      </span>
    </div>
  );
}

function DepthScale({ rows }: { rows: DepthRow[] }) {
  return (
    <div className="absolute inset-y-0 left-0 w-[64px] border-r border-slate-300 bg-slate-100 sm:w-[72px] lg:w-[84px] dark:border-slate-700 dark:bg-slate-900/80">
      <div className="absolute inset-0 flex flex-col justify-between px-1.5 py-3 sm:px-2">
        {rows.map((row) => (
          <div key={`${row.depth}-${row.time}-scale`} className="leading-tight">
            <div className="text-[9px] font-semibold tabular-nums text-slate-700 sm:text-[10px] lg:text-[11px] dark:text-slate-200">
              {row.depth}
            </div>
            <div className="text-[8px] tabular-nums text-slate-500 sm:text-[9px] lg:text-[10px] dark:text-slate-400">
              {row.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MajorMinorGrid({ rows }: { rows: DepthRow[] }) {
  const majorRowCount = rows.length;
  const minorPerMajor = 4;
  const totalMinorLines = (majorRowCount - 1) * minorPerMajor;

  return (
    <>
      <div
        className="absolute inset-0 [--grid-major:rgba(71,85,105,0.25)] [--grid-minor:rgba(100,116,139,0.12)] dark:[--grid-major:rgba(148,163,184,0.18)] dark:[--grid-minor:rgba(148,163,184,0.08)]"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px),
            linear-gradient(to right, var(--grid-minor) 1px, transparent 1px)
          `,
          backgroundSize: `100% calc(100% / ${majorRowCount - 1}), 56px 100%`,
        }}
      />
      <div className="absolute inset-0">
        {Array.from({ length: totalMinorLines }).map((_, index) => {
          const top = ((index + 1) / (totalMinorLines + 1)) * 100;
          return (
            <div
              key={index}
              className="absolute left-0 right-0 border-t border-slate-300/40 dark:border-slate-700/40"
              style={{ top: `${top}%` }}
            />
          );
        })}
      </div>
      <div className="absolute inset-y-0 left-1/4 w-px bg-slate-300/70 dark:bg-slate-700/60" />
      <div className="absolute inset-y-0 left-2/4 w-px bg-slate-400/80 dark:bg-slate-600/80" />
      <div className="absolute inset-y-0 left-3/4 w-px bg-slate-300/70 dark:bg-slate-700/60" />
    </>
  );
}

const TRACK_HEADER_HEIGHT = "h-[80px] sm:h-[70px] lg:h-[90px]";
const TRACK_FOOTER_HEIGHT = "h-[32px] sm:h-[36px]";

function WellPlotTrack({
  track,
  rows,
  plotHeightPx,
  plotHeightCss,
  fullWidth = false,
}: {
  track: PlotTrack;
  rows: DepthRow[];
  plotHeightPx: number;
  plotHeightCss: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={
        fullWidth
          ? "w-full bg-white dark:bg-slate-950"
          : "w-full border-r border-slate-300 bg-white last:border-r-0 dark:border-slate-700 dark:bg-slate-950"
      }
    >
      <div
        className={`border-b border-slate-300 bg-slate-100 px-2 py-2 sm:px-3 dark:border-slate-700 dark:bg-slate-900 ${TRACK_HEADER_HEIGHT}`}
      >
        <div className="flex h-full flex-col justify-start space-y-1">
          {track.metrics.map((metric) => (
            <MetricHeader key={metric.id} metric={metric} />
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden" style={{ height: plotHeightCss }}>
        <DepthScale rows={rows} />

        <div className="absolute inset-y-0 left-[64px] right-0 sm:left-[72px] lg:left-[84px]">
          <MajorMinorGrid rows={rows} />

          {track.metrics.map((metric, idx) => (
            <svg
              key={metric.id}
              viewBox={`0 0 100 ${plotHeightPx}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              style={{ zIndex: idx + 2 }}
            >
              <path
                d={buildPath(metric, rows, plotHeightPx)}
                stroke={metric.color}
                strokeWidth="1.8"
                fill="none"
              />
            </svg>
          ))}
        </div>
      </div>

      <div
        className={`border-t border-slate-300 px-2 py-2 text-[9px] sm:px-3 sm:text-[10px] lg:text-[11px] dark:border-slate-700 ${TRACK_FOOTER_HEIGHT}`}
      >
        <div className="flex h-full items-center justify-between text-slate-500 dark:text-slate-400">
          <span>Track</span>
          <span>{track.title}</span>
        </div>
      </div>
    </div>
  );
}

function MobilePlotTabs({
  tracks,
  activePlotId,
  onChange,
}: {
  tracks: PlotTrack[];
  activePlotId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:hidden">
      {tracks.map((track) => (
        <Button
          key={track.id}
          type="button"
          variant={activePlotId === track.id ? "default" : "outline"}
          size="sm"
          className="justify-center"
          onClick={() => onChange(track.id)}
        >
          {track.title}
        </Button>
      ))}
    </div>
  );
}

export default function WellPlotPage() {
  const [activePlotId, setActivePlotId] = useState<string>(plotTracks[0].id);

  const plotHeightPx = 1120;
  const plotHeightCss = "clamp(720px, calc(100vh - 180px), 1280px)";

  const activeTrack = useMemo(
    () => plotTracks.find((track) => track.id === activePlotId) ?? plotTracks[0],
    [activePlotId]
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant="outline">Trajectory / Well Plot</Badge>
          </div>
          <h1 className="mt-3 text-xl font-bold sm:text-3xl">Well Plot Viewer</h1>
          <p className="text-[11px] text-muted-foreground sm:text-base">
            Full-height vertical grouped plots with major/minor depth ticks and metric scale headers.
          </p>
        </div>
      </div>

      <MobilePlotTabs
        tracks={plotTracks}
        activePlotId={activePlotId}
        onChange={setActivePlotId}
      />

      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-2 xl:hidden">
        {plotTracks.map((track) => (
          <Button
            key={track.id}
            type="button"
            variant={activePlotId === track.id ? "default" : "outline"}
            size="sm"
            className="justify-center"
            onClick={() => setActivePlotId(track.id)}
          >
            {track.title}
          </Button>
        ))}
      </div>

      {/* Single plot mode */}
      <div className="2xl:hidden">
        <Card className="overflow-hidden p-0">
          <WellPlotTrack
            track={activeTrack}
            rows={depthRows}
            plotHeightPx={plotHeightPx}
            plotHeightCss={plotHeightCss}
            fullWidth
          />
        </Card>
      </div>

      {/* Wide desktop */}
      <div className="hidden 2xl:block">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-1 divide-y divide-slate-300 sm:grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-y-0 2xl:grid-cols-4 dark:divide-slate-700">
              {plotTracks.map((track) => (
                <WellPlotTrack
                  key={track.id}
                  track={track}
                  rows={depthRows}
                  plotHeightPx={plotHeightPx}
                  plotHeightCss={plotHeightCss}
                  fullWidth
                />
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
