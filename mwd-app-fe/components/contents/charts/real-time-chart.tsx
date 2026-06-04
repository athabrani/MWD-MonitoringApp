'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { ChartDataPoint } from '@/types';
import { Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import {
  filterChartDataByTimeWindow,
  getSafeChartData,
  getTimestampMs,
  normalizeChartDataForParameters,
  type ChartTimeWindow,
  type ChartValueMode,
} from '@/lib/chart-analytics';

interface RealTimeChartProps {
  data: ChartDataPoint[];
  title: string;
  availableParameters: Array<{
    key: string;
    label: string;
    color: string;
    unit: string;
  }>;
  defaultParameters?: string[];
  timeWindow?: ChartTimeWindow;
  onTimeWindowChange?: (window: ChartTimeWindow) => void;
  disableTimeWindowFilter?: boolean;
  emptyMessage?: string;
  valueMode?: ChartValueMode;
  description?: string;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  data,
  title,
  availableParameters,
  defaultParameters = [],
  timeWindow = '15min',
  onTimeWindowChange,
  disableTimeWindowFilter = false,
  emptyMessage = 'Belum ada data MWD untuk session ini.',
  valueMode = 'raw',
  description
}) => {
  const [selectedParams, setSelectedParams] = useState<string[]>(
    defaultParameters.length > 0 ? defaultParameters : availableParameters[0]?.key ? [availableParameters[0].key] : []
  );
  const [scaleLocked, setScaleLocked] = useState(false);

  const toggleParameter = (key: string) => {
    setSelectedParams(prev => 
      prev.includes(key) 
        ? prev.filter(p => p !== key)
        : [...prev, key]
    );
  };

  const safeData = getSafeChartData(data);
  const getFilteredData = () =>
    disableTimeWindowFilter ? safeData : filterChartDataByTimeWindow(safeData, timeWindow);

  const formatTime = (value: unknown, pattern: string) => {
    const timestamp = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(timestamp.getTime()) ? '' : format(timestamp, pattern);
  };

  const filteredData = getFilteredData();
  const visibleChartData = filteredData.filter((point) =>
    selectedParams.some((key) => {
      const value = point[key];
      return typeof value === 'number' && Number.isFinite(value);
    })
  );
  const chartDataForRender =
    valueMode === 'normalized'
      ? normalizeChartDataForParameters(visibleChartData, selectedParams)
      : visibleChartData;
  const chartEmptyMessage =
    safeData.length > 0 && visibleChartData.length === 0
      ? 'Data historis tersedia, tetapi tidak ada nilai untuk parameter terpilih pada window ini.'
      : emptyMessage;

  return (
    <Card className="flex h-full min-w-0 flex-col p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {title ? <h3 className="text-base font-semibold leading-tight sm:text-lg">{title}</h3> : null}
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            size="sm"
            variant={timeWindow === '5min' ? 'default' : 'outline'}
            className="h-8 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('5min')}
          >
            5 min
          </Button>
          <Button
            size="sm"
            variant={timeWindow === '15min' ? 'default' : 'outline'}
            className="h-8 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('15min')}
          >
            15 min
          </Button>
          <Button
            size="sm"
            variant={timeWindow === '1hr' ? 'default' : 'outline'}
            className="h-8 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('1hr')}
          >
            1 hr
          </Button>
          <Button
            size="sm"
            variant={timeWindow === 'all' ? 'default' : 'outline'}
            className="h-8 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setScaleLocked(!scaleLocked)}
          >
            {scaleLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {availableParameters.map(param => (
          <div key={param.key} className="flex items-center gap-2">
            <Checkbox
              id={param.key}
              checked={selectedParams.includes(param.key)}
              onCheckedChange={() => toggleParameter(param.key)}
            />
            <Label 
              htmlFor={param.key} 
              className="flex cursor-pointer items-center gap-1 text-sm leading-none"
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: param.color }}
              />
              {param.label}
            </Label>
          </div>
        ))}
      </div>

      <div className="min-h-[250px] flex-1">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartDataForRender}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="timestamp"
            tickFormatter={(value) => formatTime(value, 'HH:mm')}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            domain={valueMode === 'normalized' ? [0, 100] : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelFormatter={(value) => formatTime(value, 'HH:mm:ss')}
          />
          <Legend />
          {availableParameters
            .filter(p => selectedParams.includes(p.key))
            .map(param => (
              <Line
                key={param.key}
                type="monotone"
                dataKey={param.key}
                name={valueMode === 'normalized' ? `${param.label} (% range)` : `${param.label} (${param.unit})`}
                stroke={param.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      {visibleChartData.length === 0 ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{chartEmptyMessage}</p>
      ) : null}
    </Card>
  );
};
