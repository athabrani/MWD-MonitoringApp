import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToolfaceData, ToolfaceType } from '../types';
import { cn } from '@/lib/utils';

interface ToolfaceIndicatorProps {
  data: ToolfaceData;
  onTypeChange?: (type: ToolfaceType) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const ToolfaceIndicator: React.FC<ToolfaceIndicatorProps> = ({
  data,
  onTypeChange,
  size = 'md'
}) => {
  const [activeType, setActiveType] = useState<ToolfaceType>(data.type);
  const [animatedAngle, setAnimatedAngle] = useState(data.angle);

  // Smooth animation for angle changes
  useEffect(() => {
    const targetAngle = data.angle;
    const diff = targetAngle - animatedAngle;
    
    // Handle wrap-around for 360° transition
    let adjustedDiff = diff;
    if (Math.abs(diff) > 180) {
      adjustedDiff = diff > 0 ? diff - 360 : diff + 360;
    }

    const step = adjustedDiff / 10;
    let current = animatedAngle;
    let count = 0;
    
    const animate = () => {
      if (count < 10) {
        current = (current + step + 360) % 360;
        setAnimatedAngle(current);
        count++;
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [data.angle]);

  const handleTypeChange = (type: ToolfaceType) => {
    setActiveType(type);
    onTypeChange?.(type);
  };

  // Format operation timer to HH:MM:SS
  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sizeConfig = {
    sm: { container: 'w-48', gauge: 150, fontSize: 'text-2xl', timerSize: 'text-xs' },
    md: { container: 'w-64', gauge: 200, fontSize: 'text-4xl', timerSize: 'text-sm' },
    lg: { container: 'w-80', gauge: 260, fontSize: 'text-5xl', timerSize: 'text-base' }
  };

  const config = sizeConfig[size];
  const gaugeSize = config.gauge;
  const center = gaugeSize / 2;
  const radius = gaugeSize / 2 - 20;

  // Draw tick marks
  const ticks = [];
  for (let i = 0; i < 36; i++) {
    const angle = (i * 10 - 90) * (Math.PI / 180);
    const isMajor = i % 3 === 0;
    const innerRadius = isMajor ? radius - 15 : radius - 8;
    const outerRadius = radius;
    
    ticks.push(
      <line
        key={i}
        x1={center + innerRadius * Math.cos(angle)}
        y1={center + innerRadius * Math.sin(angle)}
        x2={center + outerRadius * Math.cos(angle)}
        y2={center + outerRadius * Math.sin(angle)}
        stroke="currentColor"
        strokeWidth={isMajor ? 2 : 1}
        className="text-muted-foreground/50"
      />
    );
  }

  // Draw cardinal direction labels
  const directions = [
    { label: '0', angle: -90 },
    { label: '90', angle: 0 },
    { label: '180', angle: 90 },
    { label: '270', angle: 180 }
  ];

  const pointerAngle = (animatedAngle - 90) * (Math.PI / 180);
  const pointerLength = radius - 25;

  // Color zones (green=safe, yellow=caution, red=critical)
  const createArc = (startAngle: number, endAngle: number, color: string) => {
    const arcRadius = radius - 5;
    const start = (startAngle - 90) * (Math.PI / 180);
    const end = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = center + arcRadius * Math.cos(start);
    const y1 = center + arcRadius * Math.sin(start);
    const x2 = center + arcRadius * Math.cos(end);
    const y2 = center + arcRadius * Math.sin(end);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return (
      <path
        d={`M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.3"
      />
    );
  };

  return (
    <Card className={cn("p-4 flex flex-col items-center", config.container)}>
      {/* Type Toggle */}
      <div className="flex gap-1 mb-3 w-full">
        <Button
          variant={activeType === 'GTF' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => handleTypeChange('GTF')}
        >
          GTF
        </Button>
        <Button
          variant={activeType === 'MTF' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => handleTypeChange('MTF')}
        >
          MTF
        </Button>
      </div>

      {/* Toolface Label */}
      <div className="text-xs text-muted-foreground mb-2">
        {activeType === 'GTF' ? 'Gravity Toolface' : 'Magnetic Toolface'}
      </div>

      {/* Gauge */}
      <div className="relative">
        <svg width={gaugeSize} height={gaugeSize} className="transform -rotate-0">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-border"
          />

          {/* Color zones */}
          {createArc(150, 210, '#22c55e')} {/* Green zone around 180° */}
          {createArc(120, 150, '#eab308')} {/* Yellow zone */}
          {createArc(210, 240, '#eab308')} {/* Yellow zone */}
          {createArc(0, 120, '#3b82f6')} {/* Blue zone */}
          {createArc(240, 360, '#3b82f6')} {/* Blue zone */}

          {/* Tick marks */}
          {ticks}

          {/* Cardinal direction labels */}
          {directions.map(({ label, angle }) => {
            const labelRadius = radius - 30;
            const rad = angle * (Math.PI / 180);
            return (
              <text
                key={label}
                x={center + labelRadius * Math.cos(rad)}
                y={center + labelRadius * Math.sin(rad) + 4}
                textAnchor="middle"
                className="text-xs fill-muted-foreground font-medium"
              >
                {label}
              </text>
            );
          })}

          {/* Pointer triangle */}
          <polygon
            points={`
              ${center + pointerLength * Math.cos(pointerAngle)},${center + pointerLength * Math.sin(pointerAngle)}
              ${center + 15 * Math.cos(pointerAngle + 2.6)},${center + 15 * Math.sin(pointerAngle + 2.6)}
              ${center + 15 * Math.cos(pointerAngle - 2.6)},${center + 15 * Math.sin(pointerAngle - 2.6)}
            `}
            fill="#ef4444"
            className="drop-shadow-lg"
            style={{
              transition: 'transform 0.3s ease-out'
            }}
          />

          {/* Center circle */}
          <circle
            cx={center}
            cy={center}
            r="12"
            fill="currentColor"
            className="text-card"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx={center}
            cy={center}
            r="6"
            fill="#ef4444"
          />
        </svg>

        {/* Angle display overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className={cn("font-mono font-bold", config.fontSize)}>
            {Math.round(animatedAngle)}°
          </div>
        </div>
      </div>

      {/* Target angle indicator */}
      {data.targetAngle !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Target:</span>
          <Badge variant="outline" className="font-mono">
            {data.targetAngle}°
          </Badge>
          <Badge 
            variant={Math.abs(animatedAngle - data.targetAngle) <= 5 ? 'default' : 'secondary'}
            className="text-xs"
          >
            {Math.abs(animatedAngle - data.targetAngle) <= 5 ? 'On Target' : `Δ ${Math.abs(Math.round(animatedAngle - data.targetAngle))}°`}
          </Badge>
        </div>
      )}

      {/* Operation Timer */}
      <div className="mt-3 text-center">
        <div className="text-xs text-muted-foreground">Operation Time</div>
        <div className={cn("font-mono font-semibold", config.timerSize)}>
          {formatTimer(data.operationTimer)}
        </div>
      </div>
    </Card>
  );
};
