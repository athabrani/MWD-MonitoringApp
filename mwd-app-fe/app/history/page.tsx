'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Download,
  Eye,
  FileJson,
  RefreshCw,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { getWitsDataValues, enrichWitsDataValuesWithConfig } from '@/lib/api/wits';
import {
  getHistoricalData,
  getHistoricalParameterKey,
  type HistoricalRecord,
  type HistoricalDataQuery,
  witsDataValuesToHistoricalRecords,
} from '@/lib/historical-data-api';
import {
  downloadBlob,
  exportHistorical,
} from '@/lib/exports-api';
import { cn } from '@/lib/utils';
import { getSafeErrorMessage } from '@/lib/security/errors';
import { toast } from 'sonner';

const ALL_PARAMETERS = 'all';
const pageSizeOptions = [25, 50, 100];
const chartPalette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
const dataGapThresholdMs = 5 * 60 * 1000;

type ParameterOption = {
  key: string;
  label: string;
  witsId?: string;
  mappedField?: string;
  count: number;
};

type FilterState = {
  measuredFrom?: string;
  measuredTo?: string;
  depthMin?: number;
  depthMax?: number;
  parameterKey: string;
};

type ChartPoint = {
  timestamp: Date;
  depth?: number;
  [key: string]: Date | number | undefined;
};

function parseNumberFilter(value: string, label: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

function parseDateTimeFilter(value: string, label: string) {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return date.toISOString();
}

function formatDateTime(value?: Date | string) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'PPpp');
}

function formatShortDateTime(value?: Date) {
  if (!value || Number.isNaN(value.getTime())) return '-';
  return format(value, 'MMM d, HH:mm:ss');
}

function formatNumber(value?: number, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatWitsId(value: number) {
  return String(value).padStart(4, '0');
}

function getRecordTimestampMs(record: HistoricalRecord) {
  const timestamp = record.timestamp.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getRecordIdentity(record: HistoricalRecord) {
  const depth = typeof record.depth === 'number' ? record.depth : '';
  return [
    record.sessionId ?? '',
    record.timestamp.toISOString(),
    depth,
    record.parameterKey,
    record.value,
  ].join('|');
}

function dedupeHistoricalRecords(records: HistoricalRecord[]) {
  const result = new Map<string, HistoricalRecord>();

  for (const record of records) {
    const key = getRecordIdentity(record);
    const current = result.get(key);
    if (!current || current.sourceEndpoint === '/api/wits-data-values') {
      result.set(key, record);
    }
  }

  return Array.from(result.values()).sort((left, right) => getRecordTimestampMs(left) - getRecordTimestampMs(right));
}

function getFilterState(
  startDateTime: string,
  endDateTime: string,
  depthMin: string,
  depthMax: string,
  parameterKey: string
): FilterState {
  const measuredFrom = parseDateTimeFilter(startDateTime, 'Start date/time');
  const measuredTo = parseDateTimeFilter(endDateTime, 'End date/time');

  if (measuredFrom && measuredTo && new Date(measuredTo).getTime() < new Date(measuredFrom).getTime()) {
    throw new Error('End date/time must be after start date/time.');
  }

  const parsedDepthMin = parseNumberFilter(depthMin, 'Depth min');
  const parsedDepthMax = parseNumberFilter(depthMax, 'Depth max');

  if (
    typeof parsedDepthMin === 'number' &&
    typeof parsedDepthMax === 'number' &&
    parsedDepthMin > parsedDepthMax
  ) {
    throw new Error('Depth min must be less than or equal to depth max.');
  }

  return {
    measuredFrom,
    measuredTo,
    depthMin: parsedDepthMin,
    depthMax: parsedDepthMax,
    parameterKey,
  };
}

function applyClientFilters(records: HistoricalRecord[], filters: FilterState) {
  const fromMs = filters.measuredFrom ? new Date(filters.measuredFrom).getTime() : Number.NEGATIVE_INFINITY;
  const toMs = filters.measuredTo ? new Date(filters.measuredTo).getTime() : Number.POSITIVE_INFINITY;

  return records.filter((record) => {
    const timestampMs = getRecordTimestampMs(record);
    if (timestampMs < fromMs || timestampMs > toMs) return false;

    if (typeof filters.depthMin === 'number' && (record.depth === undefined || record.depth < filters.depthMin)) {
      return false;
    }

    if (typeof filters.depthMax === 'number' && (record.depth === undefined || record.depth > filters.depthMax)) {
      return false;
    }

    if (filters.parameterKey !== ALL_PARAMETERS && record.parameterKey !== filters.parameterKey) {
      return false;
    }

    return true;
  });
}

function buildParameterOptions(records: HistoricalRecord[], witsConfig: ReturnType<typeof useApp>['witsConfig']) {
  const optionMap = new Map<string, ParameterOption>();

  for (const record of records) {
    const current = optionMap.get(record.parameterKey);
    optionMap.set(record.parameterKey, {
      key: record.parameterKey,
      label: record.parameterLabel,
      witsId: record.witsId,
      mappedField: record.mappedField,
      count: (current?.count ?? 0) + 1,
    });
  }

  for (const config of witsConfig) {
    const witsId = formatWitsId(config.numericId);
    const key = getHistoricalParameterKey({ witsId, mappedField: config.mappedField, parameter: config.name });
    if (optionMap.has(key)) continue;

    optionMap.set(key, {
      key,
      label: `${witsId}${config.name ? ` - ${config.name}` : ''}`,
      witsId,
      mappedField: config.mappedField,
      count: 0,
    });
  }

  return Array.from(optionMap.values()).sort((left, right) => {
    if (left.count !== right.count) return right.count - left.count;
    return left.label.localeCompare(right.label);
  });
}

function enrichRecordsWithWitsConfig(records: HistoricalRecord[], witsConfig: ReturnType<typeof useApp>['witsConfig']) {
  const configByWitsId = new Map(witsConfig.map((config) => [formatWitsId(config.numericId), config]));
  const configByMappedField = new Map(
    witsConfig
      .filter((config) => config.mappedField)
      .map((config) => [config.mappedField!.toLowerCase(), config])
  );

  return records.map((record) => {
    const config =
      (record.witsId ? configByWitsId.get(record.witsId) : undefined) ??
      (record.mappedField ? configByMappedField.get(record.mappedField.toLowerCase()) : undefined) ??
      configByMappedField.get(record.parameterLabel.toLowerCase());

    if (!config) return record;

    const witsId = record.witsId ?? formatWitsId(config.numericId);
    return {
      ...record,
      witsId,
      mappedField: record.mappedField ?? config.mappedField,
      parameterLabel: `${witsId}${config.name ? ` - ${config.name}` : ''}`,
      unit: record.unit ?? config.units,
    };
  });
}

function summarizeRecords(records: HistoricalRecord[]) {
  const sorted = [...records].sort((left, right) => getRecordTimestampMs(left) - getRecordTimestampMs(right));
  const depths = sorted
    .map((record) => record.depth)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const uniqueTimestamps = Array.from(new Set(sorted.map((record) => getRecordTimestampMs(record))))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  let gapCount = 0;

  for (let index = 1; index < uniqueTimestamps.length; index += 1) {
    if (uniqueTimestamps[index] - uniqueTimestamps[index - 1] > dataGapThresholdMs) {
      gapCount += 1;
    }
  }

  return {
    totalRecords: sorted.length,
    firstTimestamp: sorted[0]?.timestamp,
    lastTimestamp: sorted[sorted.length - 1]?.timestamp,
    minDepth: depths.length > 0 ? Math.min(...depths) : undefined,
    maxDepth: depths.length > 0 ? Math.max(...depths) : undefined,
    gapCount,
  };
}

function buildChartData(records: HistoricalRecord[], parameterKeys: string[]) {
  const keySet = new Set(parameterKeys);
  const pointMap = new Map<string, ChartPoint>();

  for (const record of records) {
    if (!keySet.has(record.parameterKey)) continue;

    const key = `${record.timestamp.getTime()}:${record.depth ?? ''}`;
    const point = pointMap.get(key) ?? {
      timestamp: record.timestamp,
      depth: record.depth,
    };
    point[record.parameterKey] = record.value;
    pointMap.set(key, point);
  }

  return Array.from(pointMap.values()).sort((left, right) => {
    const leftMs = left.timestamp instanceof Date ? left.timestamp.getTime() : 0;
    const rightMs = right.timestamp instanceof Date ? right.timestamp.getTime() : 0;
    return leftMs - rightMs;
  });
}

function getExportFileStem(sessionId: string) {
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  return `historical-data-session-${sessionId}-${timestamp}`;
}

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
    witsConfig,
    refreshWitsConfig,
  } = useApp();
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [depthMin, setDepthMin] = useState('');
  const [depthMax, setDepthMax] = useState('');
  const [parameterKey, setParameterKey] = useState(ALL_PARAMETERS);
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalRecord[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState('');
  const [sourceNotice, setSourceNotice] = useState('');
  const [historicalExporting, setHistoricalExporting] = useState<'csv' | 'json' | ''>('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRecord, setSelectedRecord] = useState<HistoricalRecord | null>(null);
  const canExport = user?.role === 'admin' || user?.role === 'engineer';

  const enrichedRecords = useMemo(
    () => enrichRecordsWithWitsConfig(historicalRecords, witsConfig),
    [historicalRecords, witsConfig]
  );
  const parameterOptions = useMemo(
    () => buildParameterOptions(enrichedRecords, witsConfig),
    [enrichedRecords, witsConfig]
  );
  const selectedParameterOption = parameterOptions.find((option) => option.key === parameterKey);

  const currentFilters = useMemo(() => {
    try {
      return getFilterState(startDateTime, endDateTime, depthMin, depthMax, parameterKey);
    } catch {
      return { parameterKey };
    }
  }, [depthMax, depthMin, endDateTime, parameterKey, startDateTime]);

  const filteredRecords = useMemo(
    () => applyClientFilters(enrichedRecords, currentFilters),
    [currentFilters, enrichedRecords]
  );
  const summary = useMemo(() => summarizeRecords(filteredRecords), [filteredRecords]);
  const sourceSummary = useMemo(() => {
    const historicalCount = filteredRecords.filter((record) => record.sourceEndpoint === '/api/historical-data').length;
    const witsCount = filteredRecords.filter((record) => record.sourceEndpoint === '/api/wits-data-values').length;
    return { historicalCount, witsCount };
  }, [filteredRecords]);

  const chartParameterKeys = useMemo(() => {
    if (parameterKey !== ALL_PARAMETERS) return [parameterKey];

    return parameterOptions
      .filter((option) => option.count > 0)
      .slice(0, 4)
      .map((option) => option.key);
  }, [parameterKey, parameterOptions]);
  const chartData = useMemo(
    () => buildChartData(filteredRecords, chartParameterKeys),
    [chartParameterKeys, filteredRecords]
  );
  const chartParameters = useMemo(
    () =>
      chartParameterKeys.map((key, index) => {
        const option = parameterOptions.find((item) => item.key === key);
        return {
          key,
          label: option?.label ?? key,
          unit: filteredRecords.find((record) => record.parameterKey === key)?.unit,
          color: chartPalette[index % chartPalette.length],
        };
      }),
    [chartParameterKeys, filteredRecords, parameterOptions]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pagedRecords = filteredRecords.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  useEffect(() => {
    setPageIndex(0);
  }, [currentFilters, pageSize]);

  useEffect(() => {
    if (parameterKey === ALL_PARAMETERS) return;
    if (parameterOptions.some((option) => option.key === parameterKey)) return;
    setParameterKey(ALL_PARAMETERS);
  }, [parameterKey, parameterOptions]);

  const loadHistoricalData = useCallback(async () => {
    if (!token) {
      setHistoricalError('Authentication token is not available.');
      toast.warning('Unable to load historical data', {
        description: 'Please sign in before requesting historical data.',
      });
      return;
    }

    if (!activeMwdSessionId) {
      setHistoricalError('Select an active MWD session before loading historical data.');
      return;
    }

    let filters: FilterState;
    try {
      filters = getFilterState(startDateTime, endDateTime, depthMin, depthMax, parameterKey);
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
    setSourceNotice('');

    const baseQuery: HistoricalDataQuery = {
      sessionId: activeMwdSessionId,
      measuredFrom: filters.measuredFrom,
      measuredTo: filters.measuredTo,
      depthMin: filters.depthMin,
      depthMax: filters.depthMax,
    };
    const witsQuery = {
      sessionId: activeMwdSessionId,
      measuredFrom: filters.measuredFrom,
      measuredTo: filters.measuredTo,
      depthMin: filters.depthMin,
      depthMax: filters.depthMax,
      witsId: selectedParameterOption?.witsId,
    };

    try {
      const [historicalResult, witsResult] = await Promise.allSettled([
        getHistoricalData(token, baseQuery),
        getWitsDataValues(token, witsQuery),
      ]);

      if (historicalResult.status === 'rejected' && witsResult.status === 'rejected') {
        throw historicalResult.reason;
      }

      const historicalRows = historicalResult.status === 'fulfilled' ? historicalResult.value : [];
      const witsRows =
        witsResult.status === 'fulfilled'
          ? witsDataValuesToHistoricalRecords(enrichWitsDataValuesWithConfig(witsResult.value, witsConfig))
          : [];
      const nextRecords = dedupeHistoricalRecords([...historicalRows, ...witsRows]);

      setHistoricalRecords(nextRecords);
      setLastLoadedAt(new Date());

      const notices = [];
      if (historicalResult.status === 'rejected') {
        notices.push(`/api/historical-data failed: ${getSafeErrorMessage(historicalResult.reason, 'unavailable')}`);
      }
      if (witsResult.status === 'rejected') {
        notices.push(`/api/wits-data-values failed: ${getSafeErrorMessage(witsResult.reason, 'unavailable')}`);
      }
      setSourceNotice(notices.join(' '));

      if (nextRecords.length === 0) {
        toast.info('Historical data loaded', {
          description: 'The available endpoints returned no records for the selected session/filter.',
        });
        return;
      }

      toast.success('Historical data loaded', {
        description: `${nextRecords.length} parameter row${nextRecords.length === 1 ? '' : 's'} loaded.`,
      });
    } catch (error) {
      const message = getSafeErrorMessage(error, 'Gagal memuat data dari backend.');
      setHistoricalRecords([]);
      setHistoricalError(message);
      toast.error('Historical data failed', {
        description: message,
      });
    } finally {
      setHistoricalLoading(false);
    }
  }, [
    activeMwdSessionId,
    depthMax,
    depthMin,
    endDateTime,
    parameterKey,
    selectedParameterOption?.witsId,
    startDateTime,
    token,
    witsConfig,
  ]);

  useEffect(() => {
    if (!token || !activeMwdSessionId) return;
    void loadHistoricalData();
    // Load automatically only when the active backend session changes.
    // Filter changes are applied by the explicit Apply Filters action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMwdSessionId, token]);

  const exportCsv = async () => {
    if (!token || !activeMwdSessionId) {
      toast.warning('Unable to export historical data', {
        description: 'Select an active session and sign in before exporting.',
      });
      return;
    }

    if (!canExport) {
      toast.warning('Export access denied', {
        description: 'Only admin and engineer roles can export historical data.',
      });
      return;
    }

    if (filteredRecords.length === 0) {
      toast.warning('No historical records to export', {
        description: 'Load data or loosen the current filters before exporting CSV.',
      });
      return;
    }

    if (parameterKey !== ALL_PARAMETERS) {
      toast.warning('Parameter-filtered export unsupported', {
        description: 'The backend historical export endpoint currently supports session, date, and depth filters only.',
      });
      return;
    }

    let exportFilters: FilterState;
    try {
      exportFilters = getFilterState(startDateTime, endDateTime, depthMin, depthMax, parameterKey);
    } catch (error) {
      toast.warning('Invalid historical export filter', {
        description: error instanceof Error ? error.message : 'Invalid historical filter.',
      });
      return;
    }

    setHistoricalExporting('csv');

    try {
      const fileStem = getExportFileStem(activeMwdSessionId);

      const backendBlob = await exportHistorical(token, {
        sessionId: activeMwdSessionId,
        format: 'csv',
        measuredFrom: exportFilters.measuredFrom,
        measuredTo: exportFilters.measuredTo,
        depthMin: exportFilters.depthMin,
        depthMax: exportFilters.depthMax,
      });

      if (backendBlob.size === 0) {
        throw new Error('Backend export returned an empty file.');
      }

      downloadBlob(backendBlob, `${fileStem}.csv`);
      toast.success('CSV export downloaded', {
        description: 'Downloaded from /api/exports/historical.',
      });
    } catch (error) {
      toast.error('CSV export failed', {
        description: getSafeErrorMessage(error, 'Backend historical export failed.'),
      });
    } finally {
      setHistoricalExporting('');
    }
  };

  const exportJson = async () => {
    if (!canExport) {
      toast.warning('Export access denied', {
        description: 'Only admin and engineer roles can export historical data.',
      });
      return;
    }

    if (!token || !activeMwdSessionId || filteredRecords.length === 0) {
      toast.warning('No historical records to export', {
        description: 'Load data or loosen the current filters before exporting JSON.',
      });
      return;
    }

    if (parameterKey !== ALL_PARAMETERS) {
      toast.warning('Parameter-filtered export unsupported', {
        description: 'The backend historical export endpoint currently supports session, date, and depth filters only.',
      });
      return;
    }

    let exportFilters: FilterState;
    try {
      exportFilters = getFilterState(startDateTime, endDateTime, depthMin, depthMax, parameterKey);
    } catch (error) {
      toast.warning('Invalid historical export filter', {
        description: error instanceof Error ? error.message : 'Invalid historical filter.',
      });
      return;
    }

    setHistoricalExporting('json');

    try {
      const fileStem = getExportFileStem(activeMwdSessionId);
      const backendBlob = await exportHistorical(token, {
        sessionId: activeMwdSessionId,
        format: 'json',
        measuredFrom: exportFilters.measuredFrom,
        measuredTo: exportFilters.measuredTo,
        depthMin: exportFilters.depthMin,
        depthMax: exportFilters.depthMax,
      });

      if (backendBlob.size === 0) {
        throw new Error('Backend export returned an empty file.');
      }

      downloadBlob(backendBlob, `${fileStem}.json`);
      toast.success('JSON export downloaded', {
        description: 'Downloaded from /api/exports/historical.',
      });
    } catch (error) {
      toast.error('JSON export failed', {
        description: getSafeErrorMessage(error, 'Backend historical export failed.'),
      });
    } finally {
      setHistoricalExporting('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Historical Data</h1>
          <p className="text-muted-foreground">
            Operational history from backend historical and WITS value endpoints.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void refreshMwdSessions();
              void refreshWitsConfig();
            }}
            disabled={mwdSessionsLoading}
          >
            <RefreshCw className={cn('mr-2 size-4', mwdSessionsLoading && 'animate-spin')} />
            Refresh Sources
          </Button>
          <Button type="button" onClick={() => void loadHistoricalData()} disabled={historicalLoading || !activeMwdSessionId}>
            <RefreshCw className={cn('mr-2 size-4', historicalLoading && 'animate-spin')} />
            Load Data
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <Label>Active Session</Label>
            <Select
              value={activeMwdSessionId}
              onValueChange={setActiveMwdSessionId}
              disabled={mwdSessionsLoading || mwdSessions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={mwdSessionsLoading ? 'Loading sessions...' : 'Select MWD session'}
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
              <p className="text-xs text-destructive">Gagal memuat data dari backend.</p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Status: {activeMwdSession?.status ?? '-'}</span>
              <span>Well: {activeMwdSession?.wellName ?? '-'}</span>
              <span>Job: {activeMwdSession?.jobName ?? activeMwdSession?.jobNumber ?? '-'}</span>
            </div>
          </div>
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Last updated from data</span>
              <span className="font-medium">{formatDateTime(summary.lastTimestamp ?? activeMwdSession?.updatedAt)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Last fetch</span>
              <span className="font-medium">{lastLoadedAt ? formatDateTime(lastLoadedAt) : '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{user?.role ?? '-'}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Filters</h2>
          <p className="text-sm text-muted-foreground">
            Filters are sent to backend where supported and re-applied client-side to the loaded dataset.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="history-start">Start date/time</Label>
            <Input
              id="history-start"
              type="datetime-local"
              value={startDateTime}
              onChange={(event) => setStartDateTime(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-end">End date/time</Label>
            <Input
              id="history-end"
              type="datetime-local"
              value={endDateTime}
              onChange={(event) => setEndDateTime(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-depth-min">Depth min</Label>
            <Input
              id="history-depth-min"
              type="number"
              inputMode="decimal"
              value={depthMin}
              onChange={(event) => setDepthMin(event.target.value)}
              placeholder="Any"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-depth-max">Depth max</Label>
            <Input
              id="history-depth-max"
              type="number"
              inputMode="decimal"
              value={depthMax}
              onChange={(event) => setDepthMax(event.target.value)}
              placeholder="Any"
            />
          </div>
          <div className="space-y-2">
            <Label>Parameter / WITS ID</Label>
            <Select value={parameterKey} onValueChange={setParameterKey}>
              <SelectTrigger>
                <SelectValue placeholder="All parameters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PARAMETERS}>All parameters</SelectItem>
                {parameterOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}{option.count > 0 ? ` (${option.count})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void loadHistoricalData()} disabled={historicalLoading || !activeMwdSessionId}>
            Apply Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStartDateTime('');
              setEndDateTime('');
              setDepthMin('');
              setDepthMax('');
              setParameterKey(ALL_PARAMETERS);
            }}
          >
            Clear
          </Button>
          <div className="text-sm text-muted-foreground">
            Date filter is empty by default so older historical records are not hidden.
          </div>
        </div>
      </Card>

      {historicalError ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {historicalError}
        </Card>
      ) : null}
      {sourceNotice ? (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          {sourceNotice}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Records</div>
          <div className="mt-1 text-2xl font-bold">{summary.totalRecords}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {sourceSummary.historicalCount} historical, {sourceSummary.witsCount} WITS value rows
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Time Range</div>
          <div className="mt-1 text-sm font-medium">{formatShortDateTime(summary.firstTimestamp)}</div>
          <div className="text-xs text-muted-foreground">to {formatShortDateTime(summary.lastTimestamp)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Depth Range</div>
          <div className="mt-1 text-sm font-medium">
            {formatNumber(summary.minDepth)} to {formatNumber(summary.maxDepth)}
          </div>
          <div className="text-xs text-muted-foreground">Computed from rows with numeric depth</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Events / Gaps</div>
          <div className="mt-1 text-sm font-medium">{summary.gapCount} detected gap{summary.gapCount === 1 ? '' : 's'}</div>
          <div className="text-xs text-muted-foreground">Client-side timestamp gaps over 5 minutes</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Historical Chart</h2>
            <p className="text-sm text-muted-foreground">
              {parameterKey === ALL_PARAMETERS
                ? 'Showing up to four populated parameters from the filtered dataset.'
                : 'Showing the selected parameter from the filtered dataset.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {chartParameters.map((parameter) => (
              <Badge key={parameter.key} variant="secondary" className="gap-2">
                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: parameter.color }} />
                {parameter.label}{parameter.unit ? ` (${parameter.unit})` : ''}
              </Badge>
            ))}
          </div>
        </div>
        <div className="min-h-[320px]">
          {historicalLoading ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              Loading historical chart...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              No chartable values for the current session/filter.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => formatDateTime(value).replace(/^.*?, /, '')}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(value) => formatDateTime(value as Date)}
                />
                <Legend />
                {chartParameters.map((parameter) => (
                  <Line
                    key={parameter.key}
                    type="monotone"
                    dataKey={parameter.key}
                    name={`${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ''}`}
                    stroke={parameter.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Historical Records</h2>
            <p className="text-sm text-muted-foreground">
              Timestamp, depth, parameter, value, unit, source, and status from the filtered dataset.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportCsv()}
              disabled={!canExport || historicalExporting !== '' || filteredRecords.length === 0}
            >
              <Download className="mr-2 size-4" />
              {historicalExporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportJson}
              disabled={!canExport || historicalExporting !== '' || filteredRecords.length === 0}
            >
              <FileJson className="mr-2 size-4" />
              {historicalExporting === 'json' ? 'Exporting JSON...' : 'Export JSON'}
            </Button>
          </div>
        </div>

        {!canExport ? (
          <p className="mb-4 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Operator role can view historical data. CSV/JSON export is restricted to admin and engineer roles.
          </p>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Depth</TableHead>
              <TableHead>Parameter</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historicalLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Loading historical records...
                </TableCell>
              </TableRow>
            ) : null}
            {!historicalLoading && pagedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No historical records for the current session/filter.
                </TableCell>
              </TableRow>
            ) : null}
            {!historicalLoading
              ? pagedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(record.timestamp)}</TableCell>
                    <TableCell>{formatNumber(record.depth)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{record.parameterLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.witsId ? `WITS ${record.witsId}` : record.mappedField ?? record.parameterKey}
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(record.value, 4)}</TableCell>
                    <TableCell>{record.unit ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.source ?? record.sourceEndpoint}</Badge>
                    </TableCell>
                    <TableCell>{record.status ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>
                        <Eye className="mr-2 size-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredRecords.length === 0 ? 0 : pageIndex * pageSize + 1}-
            {Math.min((pageIndex + 1) * pageSize, filteredRecords.length)} of {filteredRecords.length}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              disabled={pageIndex === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
              disabled={pageIndex >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historical Record Detail</DialogTitle>
            <DialogDescription>
              Raw backend fields are shown for audit without inventing missing values.
            </DialogDescription>
          </DialogHeader>
          {selectedRecord ? (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Timestamp</div>
                  <div className="font-medium">{formatDateTime(selectedRecord.timestamp)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Depth</div>
                  <div className="font-medium">{formatNumber(selectedRecord.depth)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Parameter</div>
                  <div className="font-medium">{selectedRecord.parameterLabel}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Value</div>
                  <div className="font-medium">
                    {formatNumber(selectedRecord.value, 4)} {selectedRecord.unit ?? ''}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">WITS ID / Mapped Field</div>
                  <div className="font-medium">{selectedRecord.witsId ?? selectedRecord.mappedField ?? '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Source Endpoint</div>
                  <div className="font-medium">{selectedRecord.sourceEndpoint}</div>
                </div>
              </div>
              <div>
                <Label>Raw Record</Label>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(selectedRecord.raw, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
