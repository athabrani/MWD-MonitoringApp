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
      <Card className={cn("p-3", getStatusColor())}>
        <div className="flex items-start justify-between mb-2">
          <div className="text-xs text-muted-foreground">{name}</div>
          {getStatusIcon()}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-mono">{value.toFixed(1)}</div>
          <div className="text-sm text-muted-foreground">{unit}</div>
        </div>
        {change1min !== undefined && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            {getTrendIcon()}
            <span>{change1min > 0 ? '+' : ''}{change1min.toFixed(1)}</span>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", getStatusColor())}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm text-muted-foreground mb-1">{name}</div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-mono font-semibold">{value.toFixed(1)}</div>
            <div className="text-base text-muted-foreground">{unit}</div>
          </div>
        </div>
        {getStatusIcon()}
      </div>
      
      {change1min !== undefined && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {getTrendIcon()}
            <span className="ml-1">{change1min > 0 ? '+' : ''}{change1min.toFixed(1)} /min</span>
          </Badge>
        </div>
      )}
    </Card>
  );
};
