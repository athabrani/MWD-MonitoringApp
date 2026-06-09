'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RealTimeChart } from '@/components/contents/charts/real-time-chart';
import {
  LineChart,
  Download,
  RefreshCw,
  Star,
  TrendingUp,
  Droplets,
  Navigation,
  Mountain,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  allChartParameters,
  buildParameterAnalytics,
  chartParameterGroups,
  filterChartDataByTimeWindow,
  getParametersWithData,
  getTimestampMs,
  type ChartParameterCategory,
  type ChartParameterDefinition,
  type ChartTimeWindow,
} from '@/lib/chart-analytics';
import type { ChartDataPoint } from '@/types';

const categoryLabels: Record<ChartParameterCategory, string> = {
  drilling: 'Drilling',
  mud: 'Mud',
  directional: 'Directional',
  formation: 'Formation',
};

const categoryEntries = Object.entries(chartParameterGroups) as Array<
  [ChartParameterCategory, ChartParameterDefinition[]]
>;

function formatNumber(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2);
}

function formatTimestamp(data: ChartDataPoint[]) {
  const latestTimestampMs = Math.max(...data.map(getTimestampMs).filter(Number.isFinite));
  if (!Number.isFinite(latestTimestampMs)) return '-';
  return new Date(latestTimestampMs).toLocaleString();
}

function CategoryIcon({ category }: { category: ChartParameterCategory }) {
  switch (category) {
    case 'drilling':
      return <TrendingUp className="size-4" />;
    case 'mud':
      return <Droplets className="size-4" />;
    case 'directional':
      return <Navigation className="size-4" />;
    case 'formation':
      return <Mountain className="size-4" />;
    default:
      return <LineChart className="size-4" />;
  }
}

function AnalyticsSummary({
  title,
  data,
  parameters,
}: {
  title: string;
  data: ChartDataPoint[];
  parameters: ChartParameterDefinition[];
}) {
  const analytics = useMemo(
    () => buildParameterAnalytics(data, parameters).filter((item) => item.count > 0),
    [data, parameters]
  );
  const totalSamples = data.length;
  const activeParameterCount = analytics.length;

  return (
    <Card className="flex h-full min-w-0 flex-col p-2.5 sm:p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-1.5 sm:mb-3 sm:gap-2">
        <div>
          <h3 className="text-xs font-semibold sm:text-base">{title} Analytics</h3>
          <p className="text-[11px] leading-tight text-muted-foreground sm:text-sm">Derived from the same filtered chart data.</p>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
          {activeParameterCount} active
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="min-w-0 rounded-md border border-border/70 bg-background/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
          <p className="truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">Samples</p>
          <p className="text-xs font-semibold leading-tight sm:text-base">{totalSamples}</p>
        </div>
        <div className="min-w-0 rounded-md border border-border/70 bg-background/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
          <p className="truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">Parameters</p>
          <p className="text-xs font-semibold leading-tight sm:text-base">{activeParameterCount}</p>
        </div>
        <div className="min-w-0 rounded-md border border-border/70 bg-background/40 px-2 py-1.5 sm:px-2.5 sm:py-2">
          <p className="truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">Last Updated</p>
          <p className="truncate text-[10px] font-medium leading-tight sm:text-sm">{formatTimestamp(data)}</p>
        </div>
      </div>

      {analytics.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:grid-cols-2 sm:gap-2 xl:grid-cols-3 2xl:grid-cols-4">
          {analytics.map((item) => (
            <div key={item.key} className="min-w-0 rounded-md border border-border/70 px-2 py-2 sm:px-2.5 sm:py-2.5">
              <div className="mb-1.5 flex items-start justify-between gap-1.5 sm:mb-2 sm:gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold sm:text-sm">{item.label}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{item.count} samples</p>
                </div>
                <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[9px] capitalize sm:h-5 sm:px-1.5 sm:text-[10px]">
                  {item.trend}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[10px] sm:gap-x-2 sm:text-xs">
                <span className="text-muted-foreground">Latest</span>
                <span className="text-right font-mono">
                  {formatNumber(item.latest)} {item.unit}
                </span>
                <span className="text-muted-foreground">Average</span>
                <span className="text-right font-mono">{formatNumber(item.average)}</span>
                <span className="text-muted-foreground">Min / Max</span>
                <span className="text-right font-mono">
                  {formatNumber(item.min)} / {formatNumber(item.max)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground sm:mt-4 sm:p-4 sm:text-sm">
          No numeric values are available for this chart and range.
        </p>
      )}
    </Card>
  );
}

function CombinedChartSection({
  title,
  description,
  data,
  timeWindow,
  onTimeWindowChange,
  parameters,
  featured = false,
}: {
  title: string;
  description: string;
  data: ChartDataPoint[];
  timeWindow: ChartTimeWindow;
  onTimeWindowChange: (window: ChartTimeWindow) => void;
  parameters: ChartParameterDefinition[];
  featured?: boolean;
}) {
  const availableParameters = getParametersWithData(data, parameters);
  const chartParameters = availableParameters.length > 0 ? availableParameters : parameters;

  return (
    <section className={featured ? "space-y-3 sm:space-y-4" : "rounded-xl border border-border/70 bg-card/40 p-2.5 sm:p-4"}>
      {featured ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold sm:text-2xl">{title}</h2>
            <p className="mt-0.5 max-w-3xl text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm sm:leading-normal">{description}</p>
          </div>
          <Badge variant="outline" className="w-fit">
            {chartParameters.length} parameter{chartParameters.length === 1 ? '' : 's'}
          </Badge>
        </div>
      ) : null}
      <div className="space-y-2.5 sm:space-y-4">
        <RealTimeChart
          data={data}
          title={featured ? "Overview Trend" : title}
          description={featured ? "Normalized 0-100 range for readable cross-unit trend comparison." : description}
          availableParameters={chartParameters}
          defaultParameters={chartParameters.map((parameter) => parameter.key)}
          timeWindow={timeWindow}
          onTimeWindowChange={onTimeWindowChange}
          valueMode="normalized"
          emptyMessage="No historical values are available for these parameters."
        />
        <AnalyticsSummary title={featured ? "Overview" : title} data={data} parameters={chartParameters} />
      </div>
    </section>
  );
}

export const ChartsPage: React.FC = () => {
  const {
    chartData,
    activeMwdSession,
    activeMwdSessionId,
    mwdDataLoading,
    mwdDataError,
    refreshMwdData,
  } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<ChartParameterCategory>('drilling');
  const [pinnedCharts, setPinnedCharts] = useState<string[]>(['rop', 'wob']);
  const [timeWindow, setTimeWindow] = useState<ChartTimeWindow>('all');

  const filteredChartData = useMemo(
    () => filterChartDataByTimeWindow(chartData, timeWindow),
    [chartData, timeWindow]
  );
  const availableOverviewParameters = useMemo(
    () => getParametersWithData(filteredChartData, allChartParameters),
    [filteredChartData]
  );
  const activeSessionLabel =
    activeMwdSession?.name ?? activeMwdSession?.wellName ?? activeMwdSessionId ?? 'current session';
  const overviewParameters =
    availableOverviewParameters.length > 0 ? availableOverviewParameters : allChartParameters;
  const pinnedParams = allChartParameters.filter((parameter) => pinnedCharts.includes(parameter.key));

  const togglePinChart = (paramKey: string) => {
    setPinnedCharts((prev) =>
      prev.includes(paramKey) ? prev.filter((parameterKey) => parameterKey !== paramKey) : [...prev, paramKey]
    );
  };

  const handleExportChart = () => {
    toast.success('Chart export is prepared from the currently visible backend data.');
  };

  return (
    <div className="min-w-0 space-y-5 sm:space-y-8">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Charts & Analytics</h1>
          <p className="max-w-3xl break-words text-sm text-muted-foreground sm:text-base">
            Historical trends for {activeSessionLabel || 'current session'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
          onClick={() => void refreshMwdData()}
          disabled={mwdDataLoading}
          aria-label="Refresh chart data"
          title="Refresh chart data"
        >
          <RefreshCw className={mwdDataLoading ? 'size-3.5 animate-spin sm:mr-2 sm:size-4' : 'size-3.5 sm:mr-2 sm:size-4'} />
          <span className="hidden sm:inline">{mwdDataLoading ? 'Refreshing...' : 'Refresh Chart Data'}</span>
        </Button>
      </div>

      {mwdDataError ? (
        <Card className="border-destructive/40 p-4 text-sm text-destructive">
          {mwdDataError}
        </Card>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 sm:w-fit">
          <TabsTrigger value="overview" className="px-2 text-xs sm:px-4 sm:text-sm">
            Overview & Analytics
          </TabsTrigger>
          <TabsTrigger value="details" className="px-2 text-xs sm:px-4 sm:text-sm">
            Pinned Detail Charts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-4 sm:space-y-8">
          <CombinedChartSection
            title="All Parameters Overview"
            description="Normalized view across all major parameters so mixed units can be compared by trend shape."
            data={chartData}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            parameters={overviewParameters}
            featured
          />

          <section className="space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-base font-semibold sm:text-xl">Category Trends</h2>
              <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
                Focused normalized charts by operational category. Each panel uses the same backend chart data and selected time range.
              </p>
            </div>
            <div className="grid items-start gap-3 sm:gap-4 2xl:grid-cols-2">
              {categoryEntries.map(([category, parameters]) => (
                <CombinedChartSection
                  key={category}
                  title={`${categoryLabels[category]} Trends`}
                  description={`Normalized ${categoryLabels[category].toLowerCase()} parameter comparison from backend MWD history.`}
                  data={chartData}
                  timeWindow={timeWindow}
                  onTimeWindowChange={setTimeWindow}
                  parameters={parameters}
                />
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="details" className="mt-0 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Pinned Detail Charts</h2>
            <p className="text-sm text-muted-foreground">
              Inspect selected parameters in raw units, with compact analytics from the active range.
            </p>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="p-3 sm:p-4">
              <h3 className="mb-4 font-semibold">Parameter Library</h3>

              <div className="space-y-4">
                {categoryEntries.map(([category, params]) => {
                  const paramsWithData = getParametersWithData(filteredChartData, params);

                  return (
                    <div key={category}>
                      <Button
                        variant={selectedCategory === category ? 'secondary' : 'ghost'}
                        className="mb-2 w-full justify-start"
                        onClick={() => setSelectedCategory(category)}
                      >
                        <CategoryIcon category={category} />
                        <span className="ml-2">{categoryLabels[category]}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {paramsWithData.length}/{params.length}
                        </Badge>
                      </Button>

                      {selectedCategory === category && (
                        <div className="ml-4 space-y-2">
                          {params.map((param) => {
                            const hasData = paramsWithData.some((item) => item.key === param.key);

                            return (
                              <div key={param.key} className="flex items-center gap-2">
                                <Checkbox
                                  id={`pin-${param.key}`}
                                  checked={pinnedCharts.includes(param.key)}
                                  onCheckedChange={() => togglePinChart(param.key)}
                                />
                                <Label htmlFor={`pin-${param.key}`} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                  <div className="size-2 rounded-full" style={{ backgroundColor: param.color }} />
                                  {param.label}
                                  {!hasData ? (
                                    <span className="text-xs text-muted-foreground">(no values)</span>
                                  ) : null}
                                  {pinnedCharts.includes(param.key) && (
                                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                                  )}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="space-y-5">
              {pinnedCharts.length === 0 ? (
                <Card className="p-12 text-center">
                  <Star className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold">No Detail Charts Pinned</h3>
                  <p className="text-muted-foreground">Select parameters from the library to inspect raw-value charts.</p>
                </Card>
              ) : (
                pinnedParams.map((param) => (
                  <section key={param.key} className="rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{param.label}</h3>
                        <p className="text-sm text-muted-foreground">Raw unit: {param.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => togglePinChart(param.key)}>
                          <Star className="mr-2 size-4 fill-yellow-500 text-yellow-500" />
                          Unpin
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleExportChart}>
                          <Download className="mr-2 size-4" />
                          Export
                        </Button>
                      </div>
                    </div>

                    <RealTimeChart
                      data={chartData}
                      title={`${param.label} Detail`}
                      availableParameters={[param]}
                      defaultParameters={[param.key]}
                      timeWindow={timeWindow}
                      onTimeWindowChange={setTimeWindow}
                    />
                    <AnalyticsSummary title={`${param.label} Detail`} data={filteredChartData} parameters={[param]} />
                  </section>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChartsPage;
