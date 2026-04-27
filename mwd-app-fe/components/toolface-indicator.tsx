"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ToolfaceType = "GTF" | "MTF";

export interface ToolfaceData {
  angle: number;
  type: ToolfaceType;
  targetAngle?: number;
  operationTimer?: number;
}

interface ToolfaceIndicatorProps {
  data: ToolfaceData;
  onTypeChange?: (type: ToolfaceType) => void;
  size?: "sm" | "md" | "lg";
}

export const ToolfaceIndicator: React.FC<ToolfaceIndicatorProps> = ({
  data,
  onTypeChange,
  size = "md",
}) => {
  const [activeType, setActiveType] = useState<ToolfaceType>(data.type);
  const [animatedAngle, setAnimatedAngle] = useState<number>(data.angle);
  const [ringAngles, setRingAngles] = useState<Array<number | null>>([
    null,
    null,
    null,
    null,
  ]);

  const nextRingIndexRef = useRef(0);
  const prevOperationTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setActiveType(data.type);
  }, [data.type]);

  useEffect(() => {
    const target = normalizeAngle(data.angle);
    const current = normalizeAngle(animatedAngle);

    let diff = target - current;
    if (Math.abs(diff) > 180) {
      diff = diff > 0 ? diff - 360 : diff + 360;
    }

    const step = diff / 12;
    let frame = 0;
    let value = current;

    const animate = () => {
      if (frame < 12) {
        value = normalizeAngle(value + step);
        setAnimatedAngle(value);
        frame++;
        requestAnimationFrame(animate);
      } else {
        setAnimatedAngle(target);
      }
    };

    requestAnimationFrame(animate);
  }, [data.angle, animatedAngle]);

  useEffect(() => {
    const normalized = normalizeAngle(data.angle);

    setRingAngles([normalized, null, null, null]);
    nextRingIndexRef.current = 1;
    prevOperationTimerRef.current = data.operationTimer;
  }, [data.type, data.angle, data.operationTimer]);

  useEffect(() => {
    const incomingTimer = data.operationTimer;

    if (incomingTimer === prevOperationTimerRef.current) {
      return;
    }

    prevOperationTimerRef.current = incomingTimer;

    const normalized = normalizeAngle(data.angle);
    const targetRingIndex = nextRingIndexRef.current;

    setRingAngles((prev) => {
      const next = [...prev];
      next[targetRingIndex] = normalized;
      return next;
    });

    nextRingIndexRef.current = (targetRingIndex + 1) % 4;
  }, [data.operationTimer, data.angle]);

  const handleTypeChange = (type: ToolfaceType) => {
    setActiveType(type);
    onTypeChange?.(type);
  };

  void handleTypeChange;

  const formatTimer = (seconds?: number) => {
    const total = seconds ?? 0;
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const sizeConfig = {
    sm: {
      gauge: 162,
      timerSize: "text-[11px]",
      valueSize: "text-lg",
      labelSize: "text-xs",
      shellPadding: "p-2.5",
      svgGap: "mt-1.5",
    },
    md: {
      gauge: 228,
      timerSize: "text-sm",
      valueSize: "text-3xl",
      labelSize: "text-sm",
      shellPadding: "p-3.5",
      svgGap: "mt-2.5",
    },
    lg: {
      gauge: 300,
      timerSize: "text-base",
      valueSize: "text-5xl",
      labelSize: "text-lg",
      shellPadding: "p-4",
      svgGap: "mt-3",
    },
  };

  const config = sizeConfig[size];
  const gaugeSize = config.gauge;
  const svgPadding = gaugeSize * 0.08;
  const svgSize = gaugeSize + svgPadding * 2;
  const center = svgSize / 2;

  const ringDefs = useMemo(() => {
    const base = gaugeSize * 0.13;
    const band = gaugeSize * 0.095;
    const gap = gaugeSize * 0.012;

    return [
      {
        inner: base,
        outer: base + band,
        fill: "#c98c8e",
        stroke: "#6f4f52",
      },
      {
        inner: base + band + gap,
        outer: base + band * 2 + gap,
        fill: "#beb84f",
        stroke: "#6f6b38",
      },
      {
        inner: base + band * 2 + gap * 2,
        outer: base + band * 3 + gap * 2,
        fill: "#a7b1ea",
        stroke: "#586091",
      },
      {
        inner: base + band * 3 + gap * 3,
        outer: base + band * 4 + gap * 3,
        fill: "#97b79a",
        stroke: "#506656",
      },
    ];
  }, [gaugeSize]);

  const outerMostRadius = ringDefs[3].outer;
  const frameInset = svgPadding * 0.45;

  const segmentedOuterBand = Array.from({ length: 24 }).map((_, i) => {
    const startAngle = i * 15;
    const endAngle = startAngle + 15;
    return (
      <path
        key={`seg-${i}`}
        d={describeDonutSegment(
          center,
          center,
          ringDefs[3].inner,
          ringDefs[3].outer,
          startAngle,
          endAngle
        )}
        fill={i % 2 === 0 ? "#96b89b" : "#9fc1a5"}
        stroke="#506656"
        strokeWidth={1}
      />
    );
  });

  return (
    <Card
      className={cn(
        "w-full overflow-hidden border-border/70 bg-gradient-to-br from-background via-background to-sky-50/40 shadow-sm",
        config.shellPadding
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-sky-50/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-sky-900">
            <span className="size-2 rounded-full bg-sky-500" />
            {activeType === "GTF" ? "Gravity" : "Magnetic"}
          </div>
          <div className="mt-2">
            <div className={cn("font-semibold text-foreground", config.labelSize)}>
              {activeType === "GTF" ? "Toolface Orientation" : "Magnetic Reference"}
            </div>
            <div className={cn("text-muted-foreground", size === "sm" ? "text-[10px]" : "text-[11px]")}>
              {activeType === "GTF" ? "Gravity Toolface" : "Magnetic Toolface"}
            </div>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "w-fit shrink-0 rounded-full border-slate-300 bg-white/90 px-3 py-1 font-mono shadow-sm",
            config.timerSize
          )}
        >
          {formatTimer(data.operationTimer)}
        </Badge>
      </div>

      <div
        className={cn(
          "relative flex justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/70 to-slate-100/70 shadow-inner",
          size === "sm" ? "p-2" : "p-3",
          config.svgGap
        )}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_transparent_60%)]" />
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="relative overflow-visible"
        >
          <rect
            x={frameInset}
            y={frameInset}
            width={svgSize - frameInset * 2}
            height={svgSize - frameInset * 2}
            rx={gaugeSize * 0.025}
            fill="hsl(var(--muted) / 0.25)"
            strokeWidth="1.5"
          />

          {ringDefs.slice(0, 3).map((ring, index) => (
            <path
              key={`ring-${index}`}
              d={describeDonutCircle(center, center, ring.inner, ring.outer)}
              fill={ring.fill}
              stroke={ring.stroke}
              strokeWidth={1}
            />
          ))}

          {segmentedOuterBand}

          <line
            x1={center}
            y1={center - outerMostRadius}
            x2={center}
            y2={center + outerMostRadius}
            stroke="#3d4468"
            strokeWidth={1.5}
          />
          <line
            x1={center - outerMostRadius}
            y1={center}
            x2={center + outerMostRadius}
            y2={center}
            stroke="#3d4468"
            strokeWidth={1.5}
          />

          {ringAngles.map((angle, index) => {
            if (angle === null) return null;

            const ring = ringDefs[index];
            if (!ring) return null;

            return (
              <SeparatedRingArrow
                key={`ring-arrow-${index}-${angle}`}
                cx={center}
                cy={center}
                angle={angle}
                innerRadius={ring.inner}
                outerRadius={ring.outer}
                fill="#fff233"
                stroke="#ff1f1f"
              />
            );
          })}

          <circle
            cx={center}
            cy={center}
            r={gaugeSize * 0.085}
            fill="#101010"
          />

          <text
            x={center}
            y={center + 5}
            textAnchor="middle"
            className="fill-white font-bold"
            style={{ fontSize: gaugeSize * 0.08 }}
          >
            {Math.round(animatedAngle)}
          </text>
        </svg>
      </div>

      <div
        className={cn(
          "mt-3 grid items-stretch gap-2",
          size === "sm" ? "mt-2 grid-cols-1 min-[380px]:grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"
        )}
      >
        <div className={cn("rounded-xl border border-slate-300/80 bg-white/95 shadow-sm", size === "sm" ? "px-3 py-2.5" : "px-4 py-3")}>
          <div className={cn("uppercase tracking-[0.18em] text-muted-foreground", size === "sm" ? "text-[9px]" : "text-[10px]")}>
            Current Angle
          </div>
          <div className={cn("mt-1 font-bold leading-none text-foreground", config.valueSize)}>
            {animatedAngle.toFixed(1)}
          </div>
        </div>

        {typeof data.targetAngle === "number" && (
          <div
            className={cn(
              "min-w-0 rounded-xl border border-emerald-200/80 bg-emerald-50 font-semibold text-emerald-900 shadow-sm",
              size === "sm" ? "px-3 py-2.5 text-xs" : "px-4 py-3 text-sm"
            )}
          >
            <div className={cn("uppercase tracking-[0.18em] text-emerald-700/80",
                size === "sm" ? "text-[9px]" : "text-[10px]"
              )}>
              Target:
            </div> 
            <div className={cn("mt-1 font-bold leading-none", config.valueSize)}>
            {Math.round(data.targetAngle)}°
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeDonutCircle(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number
) {
  return describeDonutSegment(cx, cy, innerRadius, outerRadius, 0, 359.999);
}

function describeDonutSegment(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

function SeparatedRingArrow({
  cx,
  cy,
  angle,
  innerRadius,
  outerRadius,
  fill,
  stroke,
}: {
  cx: number;
  cy: number;
  angle: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  stroke: string;
}) {
  const ringThickness = outerRadius - innerRadius;
  const pad = Math.max(2, ringThickness * 0.12);

  const tailRadius = innerRadius + pad;
  const tipRadius = outerRadius - pad;
  const arrowLength = tipRadius - tailRadius;

  const bodyWidth = Math.max(3, ringThickness * 0.22);
  const headWidth = Math.max(6, ringThickness * 0.52);
  const headLength = Math.max(8, arrowLength * 0.38);

  const tailCenter = polarToCartesian(cx, cy, tailRadius, angle);
  const tipCenter = polarToCartesian(cx, cy, tipRadius, angle);
  const neckCenter = polarToCartesian(cx, cy, tipRadius - headLength, angle);

  const rad = ((angle - 90) * Math.PI) / 180;
  const dy = Math.sin(rad);
  const px = -dy;
  const py = Math.cos(rad);

  const offsetPoint = (
    point: { x: number; y: number },
    amount: number
  ) => ({
    left: {
      x: point.x + px * amount,
      y: point.y + py * amount,
    },
    right: {
      x: point.x - px * amount,
      y: point.y - py * amount,
    },
  });

  const tail = offsetPoint(tailCenter, bodyWidth / 2);
  const neck = offsetPoint(neckCenter, bodyWidth / 2);
  const head = offsetPoint(neckCenter, headWidth / 2);

  const points = [
    `${tipCenter.x},${tipCenter.y}`,
    `${head.left.x},${head.left.y}`,
    `${neck.left.x},${neck.left.y}`,
    `${tail.left.x},${tail.left.y}`,
    `${tail.right.x},${tail.right.y}`,
    `${neck.right.x},${neck.right.y}`,
    `${head.right.x},${head.right.y}`,
  ].join(" ");

  return (
    <polygon
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  );
}

export default ToolfaceIndicator;
