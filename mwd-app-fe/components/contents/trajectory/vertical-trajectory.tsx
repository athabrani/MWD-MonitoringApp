'use client';

import React, { useMemo } from 'react';
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

export const VerticalTrajectory: React.FC<VerticalTrajectoryProps> = ({
  data,
  currentDepthPercent,
  height = 600,
  showLabels = true
}) => {
  const padding = { top: 40, right: 60, bottom: 40, left: 80 };
  const width = 300;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate visible data based on slider
  const currentIndex = Math.floor((currentDepthPercent / 100) * data.actual.length);
  const visibleActual = data.actual.slice(0, currentIndex + 1);
  const visiblePlanned = data.planned.slice(0, Math.min(currentIndex + 1, data.planned.length));

  // Get bounds
  const { minTVD, maxTVD, minHD, maxHD } = useMemo(() => {
    const allPoints = [...data.planned, ...data.actual];
    const tvdValues = allPoints.map(p => p.tvd);
    const hdValues = allPoints.map(p => Math.sqrt(p.northing ** 2 + p.easting ** 2));
    
    return {
      minTVD: 0,
      maxTVD: Math.max(...tvdValues) * 1.1,
      minHD: 0,
      maxHD: Math.max(...hdValues) * 1.1
    };
  }, [data]);

  // Scale functions
  const scaleY = (tvd: number) => {
    return padding.top + (tvd / maxTVD) * chartHeight;
  };

  const scaleX = (hd: number) => {
    return padding.left + (hd / maxHD) * chartWidth;
  };

  // Generate path for trajectory
  const generatePath = (points: TrajectoryPoint[]) => {
    if (points.length === 0) return '';
    
    return points.map((p, i) => {
      const hd = Math.sqrt(p.northing ** 2 + p.easting ** 2);
      const x = scaleX(hd);
      const y = scaleY(p.tvd);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const plannedPath = generatePath(visiblePlanned);
  const actualPath = generatePath(visibleActual);

  // Current position
  const currentActual = visibleActual[visibleActual.length - 1];
  const currentHD = currentActual ? Math.sqrt(currentActual.northing ** 2 + currentActual.easting ** 2) : 0;

  // Waypoints/targets
  const waypoints = [
    { name: 'KOP', md: 1000, tvd: 999.5 },
    { name: 'Build', md: 2500, tvd: 2470 },
    { name: 'Landing', md: 3500, tvd: 3385 },
    { name: 'TD', md: 4500, tvd: 4270 }
  ];

  // Depth ticks
  const depthTicks = [];
  const tickInterval = 500;
  for (let d = 0; d <= maxTVD; d += tickInterval) {
    depthTicks.push(d);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Vertical Section</h3>
          <p className="text-sm text-muted-foreground">TVD vs Horizontal Displacement</p>
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

      <svg width={width} height={height} className="overflow-visible">
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/30" />
          </pattern>
        </defs>
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="url(#grid)" />

        {/* Surface line */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={width - padding.right}
          y2={padding.top}
          stroke="currentColor"
          strokeWidth="3"
          className="text-amber-600"
        />
        <text x={padding.left + 5} y={padding.top - 8} className="text-xs fill-amber-600 font-medium">
          Surface
        </text>

        {/* Rig symbol at surface */}
        <g transform={`translate(${padding.left - 15}, ${padding.top - 35})`}>
          <rect x="5" y="0" width="20" height="35" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-600" />
          <line x1="0" y1="35" x2="30" y2="35" stroke="currentColor" strokeWidth="2" className="text-amber-600" />
          <line x1="15" y1="0" x2="15" y2="-10" stroke="currentColor" strokeWidth="2" className="text-amber-600" />
        </g>

        {/* Y-axis (Depth) */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="currentColor"
          strokeWidth="1"
          className="text-border"
        />

        {/* Depth ticks and labels */}
        {depthTicks.map(depth => (
          <g key={depth}>
            <line
              x1={padding.left - 5}
              y1={scaleY(depth)}
              x2={padding.left}
              y2={scaleY(depth)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
            <text
              x={padding.left - 10}
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
          x={padding.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          className="text-xs fill-muted-foreground font-medium"
        >
          Horizontal Displacement (m)
        </text>

        {/* Planned trajectory (dashed) */}
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

        {/* Waypoint markers */}
        {waypoints.map((wp, i) => {
          const wpPlanned = data.planned.find(p => Math.abs(p.md - wp.md) < 50);
          if (!wpPlanned) return null;
          
          const hd = Math.sqrt(wpPlanned.northing ** 2 + wpPlanned.easting ** 2);
          const x = scaleX(hd);
          const y = scaleY(wpPlanned.tvd);
          const isPassed = currentActual && currentActual.md >= wp.md;
          
          return (
            <g key={wp.name}>
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
                  x={x + 15}
                  y={y + 4}
                  className={cn(
                    "text-xs font-medium",
                    isPassed ? 'fill-emerald-500' : 'fill-muted-foreground'
                  )}
                >
                  {wp.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Current position marker (drill bit) */}
        {currentActual && (
          <g>
            {/* Glow effect */}
            <circle
              cx={scaleX(currentHD)}
              cy={scaleY(currentActual.tvd)}
              r="12"
              fill="#ef4444"
              opacity="0.3"
            />
            {/* Drill bit icon */}
            <polygon
              points={`
                ${scaleX(currentHD)},${scaleY(currentActual.tvd) + 10}
                ${scaleX(currentHD) - 6},${scaleY(currentActual.tvd) - 4}
                ${scaleX(currentHD) + 6},${scaleY(currentActual.tvd) - 4}
              `}
              fill="#ef4444"
            />
            {/* Depth label */}
            <rect
              x={scaleX(currentHD) + 15}
              y={scaleY(currentActual.tvd) - 12}
              width="70"
              height="24"
              rx="4"
              fill="currentColor"
              className="text-card"
              stroke="#ef4444"
              strokeWidth="1"
            />
            <text
              x={scaleX(currentHD) + 50}
              y={scaleY(currentActual.tvd) + 4}
              textAnchor="middle"
              className="text-xs fill-foreground font-mono font-semibold"
            >
              {currentActual.tvd.toFixed(1)}m
            </text>
          </g>
        )}

        {/* Target depth line */}
        <line
          x1={padding.left}
          y1={scaleY(4270)}
          x2={width - padding.right}
          y2={scaleY(4270)}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text
          x={width - padding.right - 5}
          y={scaleY(4270) - 5}
          textAnchor="end"
          className="text-xs fill-amber-500 font-medium"
        >
          TD: 4270m TVD
        </text>
      </svg>

      {/* Current metrics */}
      {currentActual && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-xs text-muted-foreground">Current TVD</div>
            <div className="text-lg font-mono font-semibold">{currentActual.tvd.toFixed(1)} m</div>
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
