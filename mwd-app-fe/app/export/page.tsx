'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Database,
  Download,
  ExternalLink,
  FileClock,
  FileJson,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import {
  downloadBlob,
  exportHistorical,
  exportPdfPlot,
  exportSurveys,
  getExportRecords,
  type ExportFormat,
  type ExportRecord,
  type HistoricalExportPayload,
  type PdfPlotExportPayload,
  type SurveyExportPayload,
} from '@/lib/exports-api';
import { plotConfigToTemplatePayload } from '@/lib/plot-templates-api';
import { DEFAULT_VERTICAL_SECTION_AZIMUTH } from '@/lib/survey-defaults';
import { cn } from '@/lib/utils';
import type { PlotConfiguration } from '@/types/plotting';

type ExportJobKey = 'historical' | 'surveys' | 'pdf-plot';

type ExportCapability = {
  key: string;
  label: string;
  endpoint: string;
  format: string;
  access: string;
  readiness: 'Direct export' | 'Builder flow' | 'Records';
};

const exportCapabilities: ExportCapability[] = [
  {
    key: 'historical',
    label: 'Historical Data',
    endpoint: 'POST /api/exports/historical',
    format: 'CSV, JSON',
    access: 'Admin, Engineer',
    readiness: 'Direct export',
  },
  {
    key: 'surveys',
    label: 'Survey Records',
    endpoint: 'POST /api/exports/surveys',
    format: 'CSV',
    access: 'Admin, Engineer',
    readiness: 'Direct export',
  },
  {
    key: 'pdf-plot',
    label: 'PDF Plot',
    endpoint: 'POST /api/exports/pdf-plot',
    format: 'PDF',
    access: 'Admin, Engineer',
    readiness: 'Direct export',
  },
  {
    key: 'las',
    label: 'LAS Export',
    endpoint: 'POST /api/exports/las',
    format: 'LAS',
    access: 'Admin, Engineer',
    readiness: 'Builder flow',
  },
  {
    key: 'records',
    label: 'Export Records',
    endpoint: 'GET /api/exports/records',
    format: 'Metadata',
    access: 'Admin, Engineer',
    readiness: 'Records',
  },
];

function readOptionalNumber(value: string, label: string) {
  if (!value.trim()) return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function readOptionalDateTime(value: string, label: string) {
  if (!value.trim()) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  return parsed;
}

function formatDateTime(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatSessionRange(start?: string, end?: string) {
  if (!start && !end) return 'No time range provided';
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function getPlotDepthRange(config: PlotConfiguration | null) {
  if (!config) return null;

  const start = config.general.depthRange?.start ?? config.general.measuredDepthStart;
  const end = config.general.depthRange?.end ?? config.general.measuredDepthEnd;

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  return { start, end };
}

function statusClassName(status?: string) {
  const normalized = status?.toLowerCase() ?? '';

  if (['completed', 'complete', 'success', 'succeeded', 'ready'].includes(normalized)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['failed', 'error', 'cancelled'].includes(normalized)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (['running', 'pending', 'processing'].includes(normalized)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-border bg-muted text-muted-foreground';
}

const capabilityTone: Record<ExportCapability['readiness'], string> = {
  'Direct export': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Builder flow': 'border-blue-200 bg-blue-50 text-blue-700',
  Records: 'border-slate-200 bg-slate-50 text-slate-700',
};

export const ExportPage: React.FC = () => {
  const { token, user } = useAuth();
  const {
    activeMwdSession,
    activeMwdSessionId,
    activePlotConfig,
    activePlotConfigId,
    mwdSessions,
    mwdSessionsError,
    mwdSessionsLoading,
    plotConfigurations,
    plotTemplatesError,
    plotTemplatesLoading,
    refreshMwdSessions,
    refreshPlotTemplates,
    setActiveMwdSessionId,
    setActivePlotConfigId,
  } = useApp();

  const [historicalFormat, setHistoricalFormat] = useState<ExportFormat>('csv');
  const [historicalFrom, setHistoricalFrom] = useState('');
  const [historicalTo, setHistoricalTo] = useState('');
  const [historicalDepthMin, setHistoricalDepthMin] = useState('');
  const [historicalDepthMax, setHistoricalDepthMax] = useState('');
  const [surveyStationType, setSurveyStationType] = useState('actual');
  const [selectedPlotConfigId, setSelectedPlotConfigId] = useState(activePlotConfigId);
  const [pdfDepthMin, setPdfDepthMin] = useState('');
  const [pdfDepthMax, setPdfDepthMax] = useState('');
  const [runningJob, setRunningJob] = useState<ExportJobKey | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>([]);

  const canExport = user?.role === 'admin' || user?.role === 'engineer';
  const hasActiveSession = Boolean(activeMwdSessionId);
  const canRunDirectExport = Boolean(token && canExport && hasActiveSession);

  const selectedPlotConfig = useMemo(() => {
    if (selectedPlotConfigId) {
      return plotConfigurations.find((config) => config.id === selectedPlotConfigId) ?? null;
    }

    return activePlotConfig ?? plotConfigurations[0] ?? null;
  }, [activePlotConfig, plotConfigurations, selectedPlotConfigId]);

  const selectedPlotRange = useMemo(() => getPlotDepthRange(selectedPlotConfig), [selectedPlotConfig]);

  const loadExportRecords = useCallback(async () => {
    if (!token || !canExport) {
      setExportRecords([]);
      setRecordsError('');
      return;
    }

    setRecordsLoading(true);
    setRecordsError('');

    try {
      const records = await getExportRecords(token);
      setExportRecords(records);
    } catch (error) {
      setExportRecords([]);
      setRecordsError(
        error instanceof Error ? error.message : 'Unable to load export records.'
      );
    } finally {
      setRecordsLoading(false);
    }
  }, [canExport, token]);

  useEffect(() => {
    if (selectedPlotConfigId) return;

    const nextPlotConfigId = activePlotConfigId || activePlotConfig?.id || plotConfigurations[0]?.id;
    if (nextPlotConfigId) {
      setSelectedPlotConfigId(nextPlotConfigId);
    }
  }, [activePlotConfig?.id, activePlotConfigId, plotConfigurations, selectedPlotConfigId]);

  useEffect(() => {
    void loadExportRecords();
  }, [loadExportRecords]);

  const buildHistoricalPayload = (): HistoricalExportPayload => {
    if (!activeMwdSessionId) {
      throw new Error('Select an active MWD session before exporting historical data.');
    }

    const measuredFrom = readOptionalDateTime(historicalFrom, 'Measured from');
    const measuredTo = readOptionalDateTime(historicalTo, 'Measured to');

    if (measuredFrom && measuredTo && measuredTo < measuredFrom) {
      throw new Error('Measured from must be before or equal to measured to.');
    }

    const depthMin = readOptionalNumber(historicalDepthMin, 'Depth min');
    const depthMax = readOptionalNumber(historicalDepthMax, 'Depth max');

    if (
      typeof depthMin === 'number' &&
      typeof depthMax === 'number' &&
      depthMin > depthMax
    ) {
      throw new Error('Depth min must be less than or equal to depth max.');
    }

    return {
      sessionId: activeMwdSessionId,
      format: historicalFormat,
      ...(measuredFrom ? { measuredFrom: measuredFrom.toISOString() } : {}),
      ...(measuredTo ? { measuredTo: measuredTo.toISOString() } : {}),
      ...(typeof depthMin === 'number' ? { depthMin } : {}),
      ...(typeof depthMax === 'number' ? { depthMax } : {}),
    };
  };

  const buildSurveyPayload = (): SurveyExportPayload => {
    if (!activeMwdSessionId) {
      throw new Error('Select an active MWD session before exporting survey records.');
    }

    return {
      sessionId: activeMwdSessionId,
      format: 'csv',
      stationType: surveyStationType,
      verticalSectionAzimuth: DEFAULT_VERTICAL_SECTION_AZIMUTH,
    };
  };

  const buildPdfPlotPayload = (): PdfPlotExportPayload => {
    if (!activeMwdSessionId) {
      throw new Error('Select an active MWD session before exporting a PDF plot.');
    }

    if (!selectedPlotConfig) {
      throw new Error('Select a plot template before exporting a PDF plot.');
    }

    const fallbackRange = getPlotDepthRange(selectedPlotConfig);
    const depthMin = readOptionalNumber(pdfDepthMin, 'Plot depth min') ?? fallbackRange?.start;
    const depthMax = readOptionalNumber(pdfDepthMax, 'Plot depth max') ?? fallbackRange?.end;

    if (typeof depthMin !== 'number' || typeof depthMax !== 'number') {
      throw new Error('PDF plot export needs a valid depth range.');
    }

    if (depthMin >= depthMax) {
      throw new Error('Plot depth min must be less than plot depth max.');
    }

    const basePayload = {
      sessionId: activeMwdSessionId,
      depthMin,
      depthMax,
    };

    if (!selectedPlotConfig.id.startsWith('plot-config-')) {
      return {
        ...basePayload,
        templateId: selectedPlotConfig.id,
      };
    }

    return {
      ...basePayload,
      template: plotConfigToTemplatePayload(selectedPlotConfig).config,
    };
  };

  const runExport = async (job: ExportJobKey) => {
    if (!token) {
      toast.error('Please sign in before exporting data.');
      return;
    }

    if (!canExport) {
      toast.error('Your role does not have export access.');
      return;
    }

    if (!activeMwdSessionId) {
      toast.error('Select an active MWD session before exporting.');
      return;
    }

    setRunningJob(job);

    try {
      if (job === 'historical') {
        const payload = buildHistoricalPayload();
        const blob = await exportHistorical(token, payload);
        downloadBlob(blob, `historical-data-session-${activeMwdSessionId}.${payload.format}`);
        toast.success('Historical data export downloaded.');
      }

      if (job === 'surveys') {
        const blob = await exportSurveys(token, buildSurveyPayload());
        downloadBlob(blob, `survey-records-session-${activeMwdSessionId}.csv`);
        toast.success('Survey records export downloaded.');
      }

      if (job === 'pdf-plot') {
        const blob = await exportPdfPlot(token, buildPdfPlotPayload());
        downloadBlob(blob, `pdf-plot-session-${activeMwdSessionId}.pdf`);
        toast.success('PDF plot export downloaded.');
      }

      void loadExportRecords();
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unable to complete export.',
      });
    } finally {
      setRunningJob(null);
    }
  };

  const refreshContext = () => {
    void refreshMwdSessions();
    void refreshPlotTemplates();
    void loadExportRecords();
  };

  const renderActionDisabledReason = () => {
    if (!canExport) return 'Export access is limited to Admin and Engineer roles.';
    if (!activeMwdSessionId) return 'Select an active MWD session to enable exports.';
    return null;
  };

  const disabledReason = renderActionDisabledReason();
  const recentRecords = exportRecords.slice(0, 8);

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Export Center</h1>
            <Badge variant="outline">Admin / Engineer</Badge>
          </div>
          <p className="max-w-3xl break-words text-sm text-muted-foreground sm:text-base">
            Centralized export hub for backend-supported historical data, survey records,
            PDF plots, LAS builder workflow, and export history.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-xs sm:text-sm"
          onClick={refreshContext}
          disabled={mwdSessionsLoading || plotTemplatesLoading || recordsLoading}
        >
          <RefreshCw
            className={cn(
              'size-4',
              (mwdSessionsLoading || plotTemplatesLoading || recordsLoading) && 'animate-spin'
            )}
          />
          Refresh Context
        </Button>
      </div>

      {disabledReason ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {disabledReason}
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card className="p-3 sm:p-5">
          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:gap-2 sm:text-sm">
                <Database className="size-3.5 sm:size-4" />
                Session Context
              </div>
              <h2 className="text-lg font-semibold sm:text-xl">
                {activeMwdSession?.name ?? 'No active MWD session'}
              </h2>
              <p className="mt-1 break-words text-xs leading-snug text-muted-foreground sm:text-sm">
                Exports run against the selected active session unless the downstream builder
                asks for more configuration.
              </p>
            </div>

            <div className="w-full lg:w-80">
              <Label htmlFor="export-session" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                Active MWD Session
              </Label>
              <Select
                value={activeMwdSessionId || undefined}
                onValueChange={setActiveMwdSessionId}
                disabled={mwdSessionsLoading || mwdSessions.length === 0}
              >
                <SelectTrigger id="export-session" className="mt-1.5 h-9 sm:mt-2">
                  <SelectValue placeholder={mwdSessionsLoading ? 'Loading sessions...' : 'Select session'} />
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
                <p className="mt-2 text-xs text-destructive">{mwdSessionsError}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:mt-5 sm:grid-cols-2 sm:gap-3 sm:text-sm xl:grid-cols-4">
            <div className="min-w-0 rounded-md border bg-muted/20 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="text-muted-foreground">Session ID</div>
              <div className="font-medium">{activeMwdSessionId || '-'}</div>
            </div>
            <div className="min-w-0 rounded-md border bg-muted/20 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="text-muted-foreground">Status</div>
              <div className="font-medium capitalize">{activeMwdSession?.status ?? '-'}</div>
            </div>
            <div className="min-w-0 rounded-md border bg-muted/20 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="text-muted-foreground">Well / Rig</div>
              <div className="font-medium">
                {[activeMwdSession?.wellName, activeMwdSession?.rigName].filter(Boolean).join(' / ') || '-'}
              </div>
            </div>
            <div className="min-w-0 rounded-md border bg-muted/20 p-2 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="text-muted-foreground">Time Range</div>
              <div className="font-medium">
                {formatSessionRange(activeMwdSession?.startTime, activeMwdSession?.endTime)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileClock className="size-4" />
            Capability Registry
          </div>
          <div className="space-y-3">
            {exportCapabilities.map((capability) => (
              <div key={capability.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{capability.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {capability.endpoint} · {capability.format}
                  </div>
                </div>
                <Badge variant="outline" className={cn('shrink-0', capabilityTone[capability.readiness])}>
                  {capability.readiness}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Data Exports</h2>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            Direct file exports backed by existing export endpoints.
          </p>
        </div>

        <div className="grid gap-4 2xl:grid-cols-2">
          <Card className="p-3 sm:p-5">
            <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileSpreadsheet className="size-4 text-primary sm:size-5" />
                  <h3 className="text-base font-semibold sm:text-lg">Historical Data Export</h3>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
                  Exports historical records for the active session with optional date/time and depth filters.
                </p>
              </div>
              <Badge variant="outline">CSV / JSON</Badge>
            </div>

            <div className="mt-3 grid gap-3 sm:mt-5">
              <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-3">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="historical-from" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                    Measured From
                  </Label>
                  <Input
                    id="historical-from"
                    type="datetime-local"
                    className="h-9"
                    value={historicalFrom}
                    onChange={(event) => setHistoricalFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="historical-to" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                    Measured To
                  </Label>
                  <Input
                    id="historical-to"
                    type="datetime-local"
                    className="h-9"
                    value={historicalTo}
                    onChange={(event) => setHistoricalTo(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-3">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="historical-depth-min" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                    Depth Min
                  </Label>
                  <Input
                    id="historical-depth-min"
                    type="number"
                    inputMode="decimal"
                    className="h-9"
                    value={historicalDepthMin}
                    onChange={(event) => setHistoricalDepthMin(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="historical-depth-max" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                    Depth Max
                  </Label>
                  <Input
                    id="historical-depth-max"
                    type="number"
                    inputMode="decimal"
                    className="h-9"
                    value={historicalDepthMax}
                    onChange={(event) => setHistoricalDepthMax(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="historical-format" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                  Format
                </Label>
                <Select
                  value={historicalFormat}
                  onValueChange={(value) => setHistoricalFormat(value as ExportFormat)}
                >
                  <SelectTrigger id="historical-format" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV table</SelectItem>
                    <SelectItem value="json">JSON structured data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-3 h-9 w-full text-xs sm:mt-5 sm:text-sm"
              disabled={!canRunDirectExport || runningJob === 'historical'}
              onClick={() => void runExport('historical')}
            >
              <Download className="size-4" />
              {runningJob === 'historical' ? 'Exporting Historical...' : 'Export Historical Data'}
            </Button>
          </Card>

          <Card className="p-3 sm:p-5">
            <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileSpreadsheet className="size-4 text-primary sm:size-5" />
                  <h3 className="text-base font-semibold sm:text-lg">Survey Records Export</h3>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
                  Exports survey stations for the active session using the existing survey export endpoint.
                </p>
              </div>
              <Badge variant="outline">CSV</Badge>
            </div>

            <div className="mt-3 space-y-1.5 sm:mt-5 sm:space-y-2">
              <Label htmlFor="survey-station-type" className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
                Station Type
              </Label>
              <Select value={surveyStationType} onValueChange={setSurveyStationType}>
                <SelectTrigger id="survey-station-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actual">Actual stations</SelectItem>
                  <SelectItem value="plan">Plan stations</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vertical section azimuth follows the existing survey default ({DEFAULT_VERTICAL_SECTION_AZIMUTH} deg).
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-3 h-9 w-full text-xs sm:mt-5 sm:text-sm"
              disabled={!canRunDirectExport || runningJob === 'surveys'}
              onClick={() => void runExport('surveys')}
            >
              <Download className="size-4" />
              {runningJob === 'surveys' ? 'Exporting Surveys...' : 'Export Survey CSV'}
            </Button>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Reports & Logs</h2>
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            Plot and LAS exports that need plotting or column configuration.
          </p>
        </div>

        <div className="grid gap-4 2xl:grid-cols-2">
          <Card className="p-3 sm:p-5">
            <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  <h3 className="text-lg font-semibold">PDF Plot Export</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uses the active plot template payload from the plotting module and sends it to the PDF plot export endpoint.
                </p>
              </div>
              <Badge variant="outline">PDF</Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="plot-template">Plot Template</Label>
                <Select
                  value={selectedPlotConfig?.id || undefined}
                  onValueChange={(value) => {
                    setSelectedPlotConfigId(value);
                    setActivePlotConfigId(value);
                  }}
                  disabled={plotTemplatesLoading || plotConfigurations.length === 0}
                >
                  <SelectTrigger id="plot-template">
                    <SelectValue placeholder={plotTemplatesLoading ? 'Loading plot templates...' : 'Select template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {plotConfigurations.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {plotTemplatesError ? (
                  <p className="text-xs text-destructive">{plotTemplatesError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Template range: {selectedPlotRange ? `${selectedPlotRange.start} - ${selectedPlotRange.end}` : 'not set'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-depth-min">Depth Min</Label>
                <Input
                  id="pdf-depth-min"
                  type="number"
                  inputMode="decimal"
                  value={pdfDepthMin}
                  onChange={(event) => setPdfDepthMin(event.target.value)}
                  placeholder={selectedPlotRange ? String(selectedPlotRange.start) : 'Required'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf-depth-max">Depth Max</Label>
                <Input
                  id="pdf-depth-max"
                  type="number"
                  inputMode="decimal"
                  value={pdfDepthMax}
                  onChange={(event) => setPdfDepthMax(event.target.value)}
                  placeholder={selectedPlotRange ? String(selectedPlotRange.end) : 'Required'}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                disabled={!canRunDirectExport || !selectedPlotConfig || runningJob === 'pdf-plot'}
                onClick={() => void runExport('pdf-plot')}
              >
                <Download className="size-4" />
                {runningJob === 'pdf-plot' ? 'Exporting Plot...' : 'Export PDF Plot'}
              </Button>
              {canExport ? (
                <Button asChild type="button" variant="outline">
                  <Link href="/data-management/plotting">
                    <ExternalLink className="size-4" />
                    Open Plot Builder
                  </Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled>
                  <ExternalLink className="size-4" />
                  Open Plot Builder
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-3 sm:p-5">
            <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Archive className="size-5 text-primary" />
                  <h3 className="text-lg font-semibold">LAS Export</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  LAS generation is supported by the backend, but it depends on column selection,
                  well info, depth step, precision, null value, and survey options configured in the LAS builder.
                </p>
              </div>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                Builder
              </Badge>
            </div>

            <div className="mt-5 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Backend flow</div>
              <div className="mt-1">POST /api/exports/las</div>
              <div className="mt-3 font-medium text-foreground">Why this opens a builder</div>
              <div className="mt-1">
                The existing LAS flow builds a validated column payload from WITS config and session well info.
                Export Center links to that real flow instead of sending an incomplete LAS payload.
              </div>
            </div>

            {canExport ? (
              <Button asChild className="mt-5 w-full">
                <Link href="/data-management/generate-las">
                  <ExternalLink className="size-4" />
                  Open LAS Builder
                </Link>
              </Button>
            ) : (
              <Button className="mt-5 w-full" disabled>
                <ExternalLink className="size-4" />
                Open LAS Builder
              </Button>
            )}
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-3 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileClock className="size-5 text-primary" />
                <h2 className="text-xl font-semibold">Export Records</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent export metadata from the backend records endpoint.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadExportRecords()}
              disabled={recordsLoading || !canExport}
            >
              <RefreshCw className={cn('size-4', recordsLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          <div className="responsive-table-card mt-5 rounded-md border">
            <div className="grid min-w-[620px] grid-cols-[minmax(0,1.4fr)_110px_145px_90px] gap-3 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-4">
              <div>File</div>
              <div>Type</div>
              <div>Created</div>
              <div className="text-right">Action</div>
            </div>

            {recordsLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading export records...
              </div>
            ) : recordsError ? (
              <div className="px-4 py-8 text-center text-sm text-destructive">{recordsError}</div>
            ) : recentRecords.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No export records returned by the backend yet.
              </div>
            ) : (
              recentRecords.map((record) => (
                <div
                  key={record.id}
                  className="grid min-w-[620px] grid-cols-[minmax(0,1.4fr)_110px_145px_90px] gap-3 border-t px-3 py-3 text-sm sm:px-4"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{record.fileName ?? record.id}</div>
                    <Badge variant="outline" className={cn('mt-1', statusClassName(record.status))}>
                      {record.status ?? 'unknown'}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{record.type ?? '-'}</div>
                  <div className="text-muted-foreground">{formatDateTime(record.createdAt)}</div>
                  <div className="text-right">
                    {record.downloadUrl ? (
                      <Button asChild variant="ghost" size="sm">
                        <a href={record.downloadUrl} target="_blank" rel="noreferrer">
                          <Download className="size-4" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No URL</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-3 sm:p-5">
          <div className="flex items-center gap-2">
            <FileJson className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Excluded From Center</h2>
          </div>
          <div className="mt-4 space-y-4 text-sm text-muted-foreground">
            <div>
              <div className="font-medium text-foreground">System backup / restore</div>
              <p className="mt-1">
                Backup and restore endpoints are admin-oriented system utilities, not normal operational data exports.
                They remain outside the primary export actions.
              </p>
            </div>
            <div>
              <div className="font-medium text-foreground">Unsupported formats</div>
              <p className="mt-1">
                Formats not backed by existing endpoints are not shown as active export buttons.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default ExportPage;
