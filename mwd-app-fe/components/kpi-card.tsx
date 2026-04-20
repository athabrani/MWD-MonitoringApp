import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle } from 'lucide-react';
import { MWDParameter } from '../types';
import { cn } from '@/lib/utils';

interface KPICardProps {
  parameter: MWDParameter;
  compact?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({ parameter, compact = false }) => {
  const { name, value, unit, status, trend, change1min } = parameter;
  const formattedValue = value.toFixed(1);

  const getTrendIcon = () => {
    if (!trend || trend === 'stable') return <Minus className="size-3" />;
    return trend === 'up' 
      ? <TrendingUp className="size-3" />
      : <TrendingDown className="size-3" />;
  };

  const getStatusColor = () => {
    switch (status) {
      case 'normal':
        return 'border-border';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/5';
      case 'critical':
        return 'border-red-500/50 bg-red-500/5';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'warning':
        return <AlertTriangle className="size-4 text-yellow-500" />;
      case 'critical':
        return <AlertCircle className="size-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <Card className={cn("min-w-0 p-3", getStatusColor())}>
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 text-xs leading-snug text-muted-foreground break-words">
            {name}
          </div>
          {getStatusIcon()}
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className="max-w-full text-xl font-mono leading-none tracking-tight sm:text-2xl">
            {formattedValue}
          </div>
          <div className="text-sm text-muted-foreground break-words">{unit}</div>
        </div>
        {change1min !== undefined && (
          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            {getTrendIcon()}
            <span className="truncate">
              {change1min > 0 ? '+' : ''}
              {change1min.toFixed(1)}
            </span>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className={cn("flex min-w-0 flex-col p-4", getStatusColor())}>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 min-h-[3.5rem] text-sm leading-snug text-muted-foreground break-words">
            {name}
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <div className="max-w-full text-2xl font-mono font-semibold leading-none tracking-tight lg:text-[2rem]">
              {formattedValue}
            </div>
            <div className="text-base text-muted-foreground break-words">
              {unit}
            </div>
          </div>
        </div>
        <div className="shrink-0">{getStatusIcon()}</div>
      </div>
      
      {change1min !== undefined && (
        <div className="mt-4 flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="w-fit max-w-full text-xs">
            {getTrendIcon()}
            <span className="ml-1 truncate">
              {change1min > 0 ? '+' : ''}
              {change1min.toFixed(1)} /min
            </span>
          </Badge>
        </div>
      )}
    </Card>
  );
};
