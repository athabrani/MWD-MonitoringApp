'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RealTimeChart } from '@/components/contents/charts/real-time-chart';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Calendar as CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  filterMwdDataByDateRange,
  filterMwdDataForSession,
  mwdDataRecordsToChartData,
} from '@/lib/mwd-data-api';
import { getHistoricalData } from '@/lib/historical-data-api';
import {
  downloadBlob,
  exportHistorical,
} from '@/lib/exports-api';
import { ChartDataPoint } from '@/types';

export const HistoryPage: React.FC = () => {
  const { token, user } = useAuth();
  const {
    mwdSessions,
    activeMwdSession,
    activeMwdSessionId,
    setActiveMwdSessionId,
    mwdSessionsLoading,
    mwdSessionsError,
    refreshMwdSessions,
  } = useApp();
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [depthMin, setDepthMin] = useState('');
  const [depthMax, setDepthMax] = useState('');
  const [historicalData, setHistoricalData] = useState<ChartDataPoint[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState('');
  const [historicalExporting, setHistoricalExporting] = useState(false);
  const canExport = user?.role === 'admin' || user?.role === 'engineer';

  const chartParameters = [
    { key: 'rop', label: 'ROP', color: '#10b981', unit: 'm/hr' },
    { key: 'wob', label: 'WOB', color: '#3b82f6', unit: 'klbs' },
    { key: 'rpm', label: 'RPM', color: '#8b5cf6', unit: 'rpm' },
    { key: 'gamma', label: 'Gamma', color: '#84cc16', unit: 'API' }
  ];

  const readDepthFilter = (value: string, label: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} must be a valid number.`);
    }
    return parsed;
  };

  const getDateFilterRange = () => {
    if (startDate && endDate && endDate < startDate) {
      throw new Error('End date must be after start date.');
    }

    return {
      measuredFrom: startDate
        ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0).toISOString()
        : undefined,
      measuredTo: endDate
        ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).toISOString()
        : undefined,
    };
  };

  const getDepthFilterRange = () => {
    const parsedDepthMin = readDepthFilter(depthMin, 'Depth min');
    const parsedDepthMax = readDepthFilter(depthMax, 'Depth max');

    if (
      typeof parsedDepthMin === 'number' &&
      typeof parsedDepthMax === 'number' &&
      parsedDepthMin > parsedDepthMax
    ) {
      throw new Error('Depth min must be less than or equal to depth max.');
    }

    return {
      depthMin: parsedDepthMin,
      depthMax: parsedDepthMax,
    };
  };

  const loadHistoricalData = async () => {
    if (!token) {
      setHistoricalError('Authentication token is not available.');
      toast.warning('Unable to load historical data', {
        description: 'Please sign in before requesting historical data.',
      });
      return;
    }

    let filters: ReturnType<typeof getDateFilterRange> & ReturnType<typeof getDepthFilterRange>;

    try {
      filters = {
        ...getDateFilterRange(),
        ...getDepthFilterRange(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid historical filter.';
      setHistoricalError(message);
      toast.warning('Invalid historical filter', {
        description: message,
      });
      return;
    }

    setHistoricalLoading(true);
    setHistoricalError('');

    try {
      const records = await getHistoricalData(token, {
        sessionId: activeMwdSessionId || undefined,
        ...filters,
      });
      const sessionRecords = filterMwdDataForSession(records, activeMwdSessionId);
      const dateScopedRecords = filterMwdDataByDateRange(sessionRecords, startDate, endDate);
      const chartData = mwdDataRecordsToChartData(dateScopedRecords);

      setHistoricalData(chartData);

      if (chartData.length === 0) {
        toast.info('Historical data loaded', {
          description: 'The API returned no records for the selected filters.',
        });
        return;
      }

      toast.success('Historical data loaded', {
        description: activeMwdSession
          ? `${chartData.length} records loaded for ${activeMwdSession.name}.`
          : `${chartData.length} records loaded.`,
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Unable to load historical data.', error);
      }
      const message = 'Gagal memuat data dari backend.';
      setHistoricalError(message);
      toast.error(message);
    } finally {
      setHistoricalLoading(false);
    }
  };

  const exportHistoricalSelection = async () => {
    if (!token) {
      toast.warning('Unable to export historical data', {
        description: 'Please sign in before exporting historical data.',
      });
      return;
    }

    if (!canExport) {
      toast.warning('Export access denied', {
        description: 'Only admin and engineer roles can export historical data.',
      });
      return;
    }

    if (!activeMwdSessionId) {
      toast.warning('No active session selected', {
        description: 'Select an MWD session before exporting historical data.',
      });
      return;
    }

    let filters: ReturnType<typeof getDateFilterRange> & ReturnType<typeof getDepthFilterRange>;

    try {
      filters = {
        ...getDateFilterRange(),
        ...getDepthFilterRange(),
      };
    } catch (error) {
      toast.warning('Invalid historical export filter', {
        description: error instanceof Error ? error.message : 'Invalid historical filter.',
      });
      return;
    }

    setHistoricalExporting(true);

    try {
      const blob = await exportHistorical(token, {
        sessionId: activeMwdSessionId,
        format: 'csv',
        ...filters,
      });
      downloadBlob(blob, 'historical-data.csv');

      toast.success('Historical export downloaded', {
        description: activeMwdSession ? activeMwdSession.name : undefined,
      });
    } catch (error) {
      toast.error('Historical export failed', {
        description: error instanceof Error ? error.message : 'Unable to export historical data.',
      });
    } finally {
      setHistoricalExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Historical Data</h1>
        <p className="text-muted-foreground">
          View and analyze past drilling operations
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="min-w-[240px]">
            <Select
              value={activeMwdSessionId}
              onValueChange={setActiveMwdSessionId}
              disabled={mwdSessionsLoading || mwdSessions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={mwdSessionsLoading ? "Loading sessions..." : "Belum ada job/session. Buat session baru untuk mulai monitoring."}
                />
              </SelectTrigger>
              <SelectContent>
                {mwdSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mwdSessionsError ? (
              <p className="mt-1 text-xs text-destructive">Gagal memuat data dari backend.</p>
            ) : null}
          </div>

          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {startDate ? format(startDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
              </PopoverContent>
            </Popover>
          </div>

          <span className="text-muted-foreground">to</span>

          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {endDate ? format(endDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="min-w-[150px]">
            <Input
              type="number"
              inputMode="decimal"
              value={depthMin}
              onChange={(event) => setDepthMin(event.target.value)}
              placeholder="Depth min"
            />
          </div>

          <div className="min-w-[150px]">
            <Input
              type="number"
              inputMode="decimal"
              value={depthMax}
              onChange={(event) => setDepthMax(event.target.value)}
              placeholder="Depth max"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void refreshMwdSessions()}
            disabled={mwdSessionsLoading}
            title="Refresh MWD sessions"
          >
            <RefreshCw className={cn("size-4", mwdSessionsLoading && "animate-spin")} />
          </Button>

          <Button
            className="ml-auto"
            onClick={() => void loadHistoricalData()}
            disabled={historicalLoading}
          >
            {historicalLoading ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : null}
            Load Data
          </Button>
          <Button variant="outline" onClick={() => void exportHistoricalSelection()} disabled={historicalExporting || !canExport}>
            <Download className="size-4 mr-2" />
            {historicalExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>

        {historicalError ? (
          <p className="mb-4 text-sm text-destructive">{historicalError}</p>
        ) : null}
        {!historicalError && historicalData.length > 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Showing {historicalData.length} historical record{historicalData.length === 1 ? '' : 's'}
            {activeMwdSession ? ` for ${activeMwdSession.name}` : ''}.
          </p>
        ) : null}

        <RealTimeChart
          data={historicalData}
          title="Historical Data - Last 24 Hours"
          availableParameters={chartParameters}
          defaultParameters={['rop', 'wob']}
          disableTimeWindowFilter
          emptyMessage="Belum ada data MWD untuk session ini."
        />
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Alarms</div>
          <div className="text-sm text-muted-foreground">Belum ada alarm.</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Avg Latency</div>
          <div className="text-sm text-muted-foreground">Belum ada data MWD untuk session ini.</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Data Gaps</div>
          <div className="text-sm text-muted-foreground">Belum ada data MWD untuk session ini.</div>
        </Card>
      </div>
    </div>
  );
};

export default HistoryPage;
