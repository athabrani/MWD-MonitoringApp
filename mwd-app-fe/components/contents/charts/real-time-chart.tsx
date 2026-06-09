'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Lock, SlidersHorizontal, Unlock } from 'lucide-react';
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

function ChartLegend({
  payload,
}: {
  payload?: Array<{ value?: React.ReactNode; color?: string }>;
}) {
  if (!payload?.length) return null;

  return (
    <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-1 text-[10px] leading-tight text-muted-foreground sm:text-xs">
      {payload.map((entry, index) => (
        <div key={`${entry.value}-${index}`} className="flex min-w-0 max-w-[11rem] items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          <span className="truncate">{entry.value}</span>
        </div>
      ))}
    </div>
  );
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
    <Card className="flex h-full min-w-0 flex-col p-3 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {title ? <h3 className="text-base font-semibold leading-tight sm:text-lg">{title}</h3> : null}
          {description ? <p className="mt-1 break-words text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-normal">{description}</p> : null}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-1.5 min-[420px]:flex min-[420px]:flex-wrap min-[420px]:items-center sm:gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs md:hidden"
              >
                <SlidersHorizontal className="mr-1.5 size-3.5" />
                Parameters
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                  {selectedParams.length}
                </Badge>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Chart Parameters</DialogTitle>
                <DialogDescription>
                  Select all parameters to show in this chart.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                {availableParameters.map(param => (
                  <div key={param.key} className="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2">
                    <Checkbox
                      id={`dialog-${title}-${param.key}`}
                      checked={selectedParams.includes(param.key)}
                      onCheckedChange={() => toggleParameter(param.key)}
                    />
                    <Label
                      htmlFor={`dialog-${title}-${param.key}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-sm leading-none"
                    >
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: param.color }}
                      />
                      <span className="min-w-0 truncate">{param.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{param.unit}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            variant={timeWindow === '5min' ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('5min')}
          >
            5 min
          </Button>
          <Button
            size="sm"
            variant={timeWindow === '15min' ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('15min')}
          >
            15 min
          </Button>
          <Button
            size="sm"
            variant={timeWindow === '1hr' ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('1hr')}
          >
            1 hr
          </Button>
          <Button
            size="sm"
            variant={timeWindow === 'all' ? 'default' : 'outline'}
            className="h-7 px-2.5 text-xs"
            onClick={() => onTimeWindowChange?.('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full p-0 min-[420px]:w-8"
            onClick={() => setScaleLocked(!scaleLocked)}
          >
            {scaleLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="mb-4 hidden gap-x-4 gap-y-2 md:flex md:flex-wrap">
        {availableParameters.map(param => (
          <div key={param.key} className="flex min-w-0 items-center gap-2">
            <Checkbox
              id={param.key}
              checked={selectedParams.includes(param.key)}
              onCheckedChange={() => toggleParameter(param.key)}
            />
            <Label 
              htmlFor={param.key} 
              className="flex min-w-0 cursor-pointer items-center gap-1 text-sm leading-none"
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: param.color }}
              />
              <span className="truncate">{param.label}</span>
            </Label>
          </div>
        ))}
      </div>

      <div className="min-h-[220px] flex-1 sm:min-h-[260px]">
      <ResponsiveContainer width="100%" height={260}>
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
          <Legend content={<ChartLegend />} />
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
