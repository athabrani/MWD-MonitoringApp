'use client';

import React, { useId, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrajectoryData, TrajectoryPoint } from '@/types';
import { cn } from '@/lib/utils';

interface VerticalTrajectoryProps {
  data: TrajectoryData;
  currentDepthPercent: number;
  height?: number;
  showLabels?: boolean;
}

type NormalizedTrajectoryPoint = TrajectoryPoint & {
  renderTvd: number;
  horizontalDisplacement: number;
};

function normalizeTvd(value: number) {
  if (!Number.isFinite(value)) return null;

  // Some backends store downward TVD as negative. Render depth-down consistently.
  return value < 0 ? Math.abs(value) : value;
}

function normalizePoint(point: TrajectoryPoint): NormalizedTrajectoryPoint | null {
  const renderTvd = normalizeTvd(point.tvd);
  if (
    renderTvd === null ||
    !Number.isFinite(point.northing) ||
    !Number.isFinite(point.easting)
  ) {
    return null;
  }

  return {
    ...point,
    renderTvd,
    horizontalDisplacement: Math.sqrt(point.northing ** 2 + point.easting ** 2),
  };
}

export const VerticalTrajectory: React.FC<VerticalTrajectoryProps> = ({
  data,
  currentDepthPercent,
  height = 600,
  showLabels = true
}) => {
  const clipId = useId().replace(/:/g, '');
  const padding = { top: 48, right: 44, bottom: 48, left: 72 };
  const width = 340;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const plotLeft = padding.left;
  const plotRight = width - padding.right;
  const plotTop = padding.top;
  const plotBottom = height - padding.bottom;
  const normalizedPlanned = useMemo(
    () => data.planned.map(normalizePoint).filter((point): point is NormalizedTrajectoryPoint => Boolean(point)),
    [data.planned]
  );
  const normalizedActual = useMemo(
    () => data.actual.map(normalizePoint).filter((point): point is NormalizedTrajectoryPoint => Boolean(point)),
    [data.actual]
  );
  const allPoints = useMemo(
    () => [...normalizedPlanned, ...normalizedActual],
    [normalizedActual, normalizedPlanned]
  );
  const hasNegativeTvd = useMemo(
    () => [...data.planned, ...data.actual].some((point) => Number.isFinite(point.tvd) && point.tvd < 0),
    [data.actual, data.planned]
  );

  const getVisibleByPercent = (points: NormalizedTrajectoryPoint[]) => {
    if (points.length === 0) return [];

    const currentIndex = Math.max(
      0,
      Math.min(
        Math.floor((currentDepthPercent / 100) * Math.max(points.length - 1, 0)),
        Math.max(points.length - 1, 0)
      )
    );

    return points.slice(0, currentIndex + 1);
  };

  const visibleActual = getVisibleByPercent(normalizedActual);
  const visiblePlanned = getVisibleByPercent(normalizedPlanned);

  // Get bounds
  const { minTVD, maxTVD, minHD, maxHD } = useMemo(() => {
    if (allPoints.length === 0) {
      return {
        minTVD: 0,
        maxTVD: 100,
        minHD: 0,
        maxHD: 100,
      };
    }

    const tvdValues = allPoints.map((p) => p.renderTvd);
    const hdValues = allPoints.map((p) => p.horizontalDisplacement);
    const rawMinTVD = Math.min(0, ...tvdValues);
    const rawMaxTVD = Math.max(...tvdValues, 1);
    const rawMaxHD = Math.max(...hdValues, 1);
    const tvdRange = Math.max(rawMaxTVD - rawMinTVD, 1);
    const tvdPadding = Math.max(tvdRange * 0.05, 10);
    const hdPadding = Math.max(rawMaxHD * 0.12, 25);

    return {
      minTVD: Math.max(0, rawMinTVD - tvdPadding),
      maxTVD: rawMaxTVD + tvdPadding,
      minHD: 0,
      maxHD: rawMaxHD + hdPadding,
    };
  }, [allPoints]);

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  // Scale functions
  const scaleY = (tvd: number) => {
    const ratio = (tvd - minTVD) / Math.max(maxTVD - minTVD, 1);
    return plotTop + ratio * chartHeight;
  };

  const scaleX = (hd: number) => {
    const ratio = (hd - minHD) / Math.max(maxHD - minHD, 1);
    return plotLeft + ratio * chartWidth;
  };

  // Generate path for trajectory
  const generatePath = (points: NormalizedTrajectoryPoint[]) => {
    if (points.length === 0) return '';
    
    return points.map((p, i) => {
      const x = scaleX(p.horizontalDisplacement);
      const y = scaleY(p.renderTvd);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const plannedPath = generatePath(visiblePlanned);
  const actualPath = generatePath(visibleActual);

  // Current position
  const currentActual = visibleActual[visibleActual.length - 1];
  const currentHD = currentActual?.horizontalDisplacement ?? 0;

  const targetPoint = normalizedPlanned.at(-1);
  const targetTvd = targetPoint?.renderTvd;

  // Depth ticks
  const depthTicks = [];
  const tickInterval = Math.max(100, Math.ceil(maxTVD / 5 / 100) * 100);
  for (let d = 0; d <= maxTVD; d += tickInterval) {
    depthTicks.push(d);
  }

  return (
    <Card className="overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Vertical Section</h3>
          <p className="text-sm text-muted-foreground">TVD vs Horizontal Displacement</p>
          {hasNegativeTvd ? (
            <p className="text-xs text-muted-foreground">Negative TVD values are rendered as depth-down absolute values.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed', borderWidth: '2px 0 0 0' }} />
            <span className="text-xs text-muted-foreground">Planned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Actual</span>
          </div>
        </div>
      </div>

      {allPoints.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Belum ada survey trajectory untuk ditampilkan.
        </div>
      ) : (
      <div className="relative w-full overflow-hidden rounded-xl">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block overflow-hidden"
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/30" />
          </pattern>
          <clipPath id={clipId}>
            <rect x={plotLeft} y={plotTop} width={chartWidth} height={chartHeight} />
          </clipPath>
        </defs>
        <rect x={plotLeft} y={plotTop} width={chartWidth} height={chartHeight} fill="url(#grid)" />

        {/* Surface line */}
        <line
          x1={plotLeft}
          y1={plotTop}
          x2={plotRight}
          y2={plotTop}
          stroke="currentColor"
          strokeWidth="3"
          className="text-amber-600"
        />
        <text x={plotLeft + 5} y={Math.max(16, plotTop - 10)} className="text-xs fill-amber-600 font-medium">
          Surface
        </text>

        {/* Rig symbol at surface */}
        <g transform={`translate(${Math.max(8, plotLeft - 15)}, ${Math.max(8, plotTop - 35)})`}>
          <rect x="5" y="0" width="20" height="35" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-600" />
          <line x1="0" y1="35" x2="30" y2="35" stroke="currentColor" strokeWidth="2" className="text-amber-600" />
          <line x1="15" y1="0" x2="15" y2="-8" stroke="currentColor" strokeWidth="2" className="text-amber-600" />
        </g>

        {/* Y-axis (Depth) */}
        <line
          x1={plotLeft}
          y1={plotTop}
          x2={plotLeft}
          y2={plotBottom}
          stroke="currentColor"
          strokeWidth="1"
          className="text-border"
        />

        {/* Depth ticks and labels */}
        {depthTicks.map(depth => (
          <g key={depth}>
            <line
              x1={plotLeft - 5}
              y1={scaleY(depth)}
              x2={plotLeft}
              y2={scaleY(depth)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
            <text
              x={plotLeft - 10}
              y={scaleY(depth) + 4}
              textAnchor="end"
              className="text-xs fill-muted-foreground"
            >
              {depth}
            </text>
          </g>
        ))}
        <text
          x={20}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90, 20, ${height / 2})`}
          className="text-xs fill-muted-foreground font-medium"
        >
          TVD (m)
        </text>

        {/* X-axis label */}
        <text
          x={plotLeft + chartWidth / 2}
          y={height - 14}
          textAnchor="middle"
          className="text-xs fill-muted-foreground font-medium"
        >
          Horizontal Displacement (m)
        </text>

        {/* Planned trajectory (dashed) */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={plannedPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="8 4"
            opacity="0.7"
          />

          {/* Actual trajectory (solid) */}
          <path
            d={actualPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
          />
        </g>

        {/* Waypoint markers */}
        {normalizedPlanned.map((wpPlanned, index) => {
          if (index !== 0 && index !== normalizedPlanned.length - 1) return null;

          const label = index === 0 ? 'Plan Start' : 'Plan TD';
          const x = scaleX(wpPlanned.horizontalDisplacement);
          const y = scaleY(wpPlanned.renderTvd);
          const labelX = clamp(x + 14, plotLeft + 4, plotRight - 56);
          const labelY = clamp(y + 4, plotTop + 12, plotBottom - 6);
          const isPassed = currentActual && currentActual.md >= wpPlanned.md;
          
          return (
            <g key={`${label}-${wpPlanned.md}`}>
              <circle
                cx={x}
                cy={y}
                r="6"
                fill={isPassed ? '#10b981' : 'currentColor'}
                className={isPassed ? '' : 'text-muted-foreground'}
              />
              <circle
                cx={x}
                cy={y}
                r="10"
                fill="none"
                stroke={isPassed ? '#10b981' : 'currentColor'}
                strokeWidth="1"
                strokeDasharray="2 2"
                className={isPassed ? '' : 'text-muted-foreground/50'}
              />
              {showLabels && (
                <text
                  x={labelX}
                  y={labelY}
                  className={cn(
                    "text-xs font-medium",
                    isPassed ? 'fill-emerald-500' : 'fill-muted-foreground'
                  )}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Current position marker (drill bit) */}
        {currentActual && (() => {
          const currentX = scaleX(currentHD);
          const currentY = scaleY(currentActual.renderTvd);
          const labelX = clamp(currentX + 15, plotLeft + 4, plotRight - 74);
          const labelY = clamp(currentY - 12, plotTop + 4, plotBottom - 28);

          return (
          <g>
            {/* Glow effect */}
            <circle
              cx={currentX}
              cy={currentY}
              r="12"
              fill="#ef4444"
              opacity="0.3"
            />
            {/* Drill bit icon */}
            <polygon
              points={`
                ${currentX},${clamp(currentY + 10, plotTop, plotBottom)}
                ${clamp(currentX - 6, plotLeft, plotRight)},${clamp(currentY - 4, plotTop, plotBottom)}
                ${clamp(currentX + 6, plotLeft, plotRight)},${clamp(currentY - 4, plotTop, plotBottom)}
              `}
              fill="#ef4444"
            />
            {/* Depth label */}
            <rect
              x={labelX}
              y={labelY}
              width="70"
              height="24"
              rx="4"
              fill="currentColor"
              className="text-card"
              stroke="#ef4444"
              strokeWidth="1"
            />
            <text
              x={labelX + 35}
              y={labelY + 16}
              textAnchor="middle"
              className="text-xs fill-foreground font-mono font-semibold"
            >
              {currentActual.renderTvd.toFixed(1)}m
            </text>
          </g>
          );
        })()}

        {/* Target depth line */}
        {typeof targetTvd === 'number' && (
          <>
            <line
              x1={plotLeft}
              y1={scaleY(targetTvd)}
              x2={plotRight}
              y2={scaleY(targetTvd)}
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={plotRight - 5}
              y={clamp(scaleY(targetTvd) - 5, plotTop + 12, plotBottom - 4)}
              textAnchor="end"
              className="text-xs fill-amber-500 font-medium"
            >
              TD: {targetTvd.toFixed(1)}m TVD
            </text>
          </>
        )}
      </svg>
      </div>
      )}

      {/* Current metrics */}
      {currentActual && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-xs text-muted-foreground">Current TVD</div>
            <div className="text-lg font-mono font-semibold">{currentActual.renderTvd.toFixed(1)} m</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-xs text-muted-foreground">Current MD</div>
            <div className="text-lg font-mono font-semibold">{currentActual.md.toFixed(1)} m</div>
          </div>
        </div>
      )}
    </Card>
  );
};
