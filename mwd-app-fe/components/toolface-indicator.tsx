"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  /**
   * 4 ring independen:
   * index 0 = ring terdalam
   * index 1 = ring kedua
   * index 2 = ring ketiga
   * index 3 = ring terluar
   */
  const [ringAngles, setRingAngles] = useState<Array<number | null>>([
    null,
    null,
    null,
    null,
  ]);

  /**
   * penunjuk ring mana yang akan diupdate berikutnya
   * 0 -> 1 -> 2 -> 3 -> 0 -> ...
   */
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
  }, [data.angle]);

  /**
   * Saat type berubah:
   * - reset semua ring
   * - data saat itu masuk ke ring terdalam
   * - ring berikutnya yang akan diisi = ring ke-2
   */
  useEffect(() => {
    const normalized = normalizeAngle(data.angle);

    setRingAngles([normalized, null, null, null]);
    nextRingIndexRef.current = 1;
    prevOperationTimerRef.current = data.operationTimer;
  }, [data.type]);

  /**
   * Independent ring update:
   * setiap data baru hanya mengubah 1 ring
   * dan tidak menggeser ring lain
   */
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
      gauge: 180,
      timerSize: "text-xs",
      valueSize: "text-2xl",
      labelSize: "text-sm",
    },
    md: {
      gauge: 240,
      timerSize: "text-sm",
      valueSize: "text-4xl",
      labelSize: "text-base",
    },
    lg: {
      gauge: 300,
      timerSize: "text-base",
      valueSize: "text-5xl",
      labelSize: "text-lg",
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
    <Card className="w-full p-4 flex flex-col items-center">
      <div className="flex gap-1 mb-3 w-full">
        <Button
          variant={activeType === "GTF" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => handleTypeChange("GTF")}
        >
          GTF
        </Button>
        <Button
          variant={activeType === "MTF" ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => handleTypeChange("MTF")}
        >
          MTF
        </Button>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        {activeType === "GTF" ? "Gravity Toolface" : "Magnetic Toolface"}
      </div>

      <Badge
        variant="outline"
        className={cn("mb-3 px-4 py-1 font-mono", config.timerSize)}
      >
        {formatTimer(data.operationTimer)}
      </Badge>

      <div className="relative flex justify-center">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="overflow-visible"
        >
          <rect
            x={frameInset}
            y={frameInset}
            width={svgSize - frameInset * 2}
            height={svgSize - frameInset * 2}
            rx={gaugeSize * 0.025}
            fill="hsl(var(--muted) / 0.25)"
            stroke="hsl(var(--border))"
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

      <div className={cn("mt-2 font-medium text-foreground", config.labelSize)}>
        {activeType === "GTF" ? "Gravity" : "Magnetic"}
      </div>

      <div className="mt-1 rounded-md border bg-background px-6 py-2 shadow-sm">
        <div className={cn("font-bold leading-none", config.valueSize)}>
          {animatedAngle.toFixed(1)}
        </div>
      </div>

      {typeof data.targetAngle === "number" && (
        <div className="mt-3">
          <Badge variant="secondary">
            Target: {Math.round(data.targetAngle)}°
          </Badge>
        </div>
      )}
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
