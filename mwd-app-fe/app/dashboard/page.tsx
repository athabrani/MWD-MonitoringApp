'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { RealTimeChart } from '@/components/contents/charts/real-time-chart';
import { EventStream } from '@/components/event-stream';
import { ToolfaceIndicator } from '@/components/toolface-indicator';
import { WellPlotPanel } from '@/components/well-plot-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BellOff, Check, AlertTriangle, TrendingUp, ShieldAlert, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDashboardThresholdStatus, type ParameterStatus } from '@/lib/dashboard-thresholds';
import { getRenderableTracksFromPlotConfig } from '@/lib/plot-track-config';
import { getDepthTrackingState, type DepthTrackingState } from '@/lib/depth-tracking-api';

export const DashboardPage: React.FC = () => {
  const { token, user } = useAuth();
  const {
    connectionState,
    connectionStatusLoading,
    connectionStatusError,
    refreshConnectionStatus,
    failoverEventsLoading,
    failoverEventsError,
    refreshFailoverEvents,
    serialStatus,
    serialStatusLoading,
    serialStatusError,
    refreshSerialStatus,
    espWsStatus,
    espWsStatusLoading,
    espWsStatusError,
    refreshEspWsStatus,
    realtimeStatus,
    realtimeError,
    chartData,
    latestMwdDataRecord,
    events,
    activeWell,
    mwdSessions,
    activeMwdSession,
    activeMwdSessionId,
    mwdSessionsLoading,
    mwdSessionsError,
    refreshMwdSessions,
    mwdDataLoading,
    mwdDataError,
    refreshMwdData,
    witsDataValuesLoading,
    witsDataValuesError,
    refreshWitsDataValues,
    witsConfigLoading,
    witsConfigError,
    refreshWitsConfig,
    witsAlarmsLoading,
    witsAlarmsError,
    refreshWitsAlarms,
    acknowledgeAlarm,
    muteAlarms,
    alarmsMuted,
    toolfaceData,
    settings,
    activePlotConfig,
  } = useApp();

  const isDark = settings.display.theme === 'dark';
  const isCompact = settings.display.density === 'compact';
  const depthUnit = settings.units === 'imperial' ? 'ft' : 'm';
  const formatDepth = (meters: number) =>
    settings.units === 'imperial' ? (meters * 3.28084).toFixed(1) : meters.toFixed(1);
  const formatDepthPrecise = (meters: number) =>
    settings.units === 'imperial' ? (meters * 3.28084).toFixed(2) : meters.toFixed(2);
  const formatRop = (metersPerHour: number) =>
    settings.units === 'imperial' ? (metersPerHour * 3.28084).toFixed(2) : metersPerHour.toFixed(2);
  const ropUnit = settings.units === 'imperial' ? 'ft/hr' : 'm/hr';
  const [timeWindow, setTimeWindow] = useState<'5min' | '15min' | '1hr'>('15min');
  const [keyParameterPage, setKeyParameterPage] = useState(0);
  const [dashboardViewport, setDashboardViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [viewportWidth, setViewportWidth] = useState(0);
  const [depthTrackingState, setDepthTrackingState] = useState<DepthTrackingState | null>(null);
  const [depthTrackingLoading, setDepthTrackingLoading] = useState(false);
  const [depthTrackingError, setDepthTrackingError] = useState('');
  const thresholdByParameter = useMemo(
    () => new Map(settings.thresholds.map((threshold) => [threshold.parameter, threshold])),
    [settings.thresholds]
  );
  const dashboardPlotTracks = useMemo(
    () => getRenderableTracksFromPlotConfig(activePlotConfig),
    [activePlotConfig]
  );
  const dashboardPlotGeneral = activePlotConfig?.general;
  const dashboardDepthScale = dashboardPlotGeneral?.grid?.depthScale ?? dashboardPlotGeneral?.depthScale ?? '1:500';
  const dashboardDepthCorrection = dashboardPlotGeneral?.depthCorrection ?? 'MD';
  const activeWellName = activeMwdSession?.wellName ?? activeWell?.name;
  const activeJobName = activeMwdSession?.jobName ?? activeMwdSession?.name ?? activeWell?.activeJob?.name;
  const formatTrackingTime = (value?: string) => {
    if (!value) return '-';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString();
  };
  const formatTrackingNumber = (value?: number, suffix = '') =>
    typeof value === 'number' ? `${value.toFixed(2)}${suffix}` : '-';
  const depthTrackingLabel = depthTrackingLoading
    ? 'Loading'
    : depthTrackingError
      ? 'Unavailable'
      : depthTrackingState?.status ?? depthTrackingState?.mode ?? 'No state';
  const startupError = mwdSessionsError || witsConfigError || mwdDataError;
  const startupLoading = mwdSessionsLoading || witsConfigLoading || mwdDataLoading;
  const hasNoSessions = !mwdSessionsLoading && !mwdSessionsError && mwdSessions.length === 0;
  const hasNoMwdData =
    Boolean(activeMwdSessionId) &&
    !mwdDataLoading &&
    !mwdDataError &&
    !latestMwdDataRecord;
  const shouldBlockDashboard = Boolean(startupError) || hasNoSessions;
  const serialStatusLabel = serialStatusLoading
    ? 'Loading'
    : serialStatusError
      ? 'Unavailable'
      : serialStatus?.status ?? 'No status';
  const espWsStatusLabel = espWsStatusLoading
    ? 'Loading'
    : espWsStatusError
      ? 'Unavailable'
      : espWsStatus?.status ?? 'No status';
  const realtimeStatusLabel = realtimeError ? 'Error' : realtimeStatus;
  const dashboardHealthItems = [
    {
      label: 'DTS',
      value: depthTrackingLabel,
      tone: depthTrackingError ? 'destructive' : depthTrackingLoading ? 'outline' : 'secondary',
    },
    {
      label: 'Serial',
      value: serialStatusLabel,
      tone: serialStatusError ? 'destructive' : serialStatus?.connected ? 'secondary' : 'outline',
    },
    {
      label: 'ESP WS',
      value: espWsStatusLabel,
      tone: espWsStatusError || espWsStatus?.lastError ? 'destructive' : espWsStatus?.connected ? 'secondary' : 'outline',
    },
    {
      label: 'Realtime',
      value: realtimeStatusLabel,
      tone: realtimeError ? 'destructive' : realtimeStatus === 'connected' ? 'secondary' : 'outline',
    },
  ] as const;

  const loadDepthTrackingState = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!token || !activeMwdSessionId) {
      setDepthTrackingState(null);
      setDepthTrackingError('');
      return;
    }

    if (!options.silent) setDepthTrackingLoading(true);
    setDepthTrackingError('');

    try {
      const state = await getDepthTrackingState(token, { sessionId: activeMwdSessionId });
      setDepthTrackingState(state);
    } catch (error) {
      setDepthTrackingState(null);
      setDepthTrackingError(error instanceof Error ? error.message : 'Depth tracking state unavailable.');
    } finally {
      if (!options.silent) setDepthTrackingLoading(false);
    }
  }, [activeMwdSessionId, token]);

  useEffect(() => {
    const applyViewport = () => {
      const width = window.innerWidth;
      setViewportWidth(width);

      if (width < 768) {
        setDashboardViewport('mobile');
        return;
      }

      if (width < 1280) {
        setDashboardViewport('tablet');
        return;
      }

      setDashboardViewport('desktop');
    };

    applyViewport();
    window.addEventListener('resize', applyViewport);

    return () => {
      window.removeEventListener('resize', applyViewport);
    };
  }, []);

  useEffect(() => {
    void loadDepthTrackingState();
  }, [loadDepthTrackingState]);

  useEffect(() => {
    if (!token || !activeMwdSessionId || !settings.display.autoRefresh) return;

    const interval = window.setInterval(() => {
      void loadDepthTrackingState({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeMwdSessionId, loadDepthTrackingState, settings.display.autoRefresh, token]);

  const activeAlarms = events.filter(
    (event) => event.type === 'alarm' && !event.acknowledgedBy && !event.resolved
  );

  const getSeverityTone = (count: number) => {
    if (count >= 3) return 'border-red-300 bg-red-50';
    if (count >= 1) return 'border-amber-300 bg-amber-50';
    return 'border-border bg-card';
  };

  const getPrimaryAlarmMessage = (alarmItems: typeof activeAlarms) => {
    if (!alarmItems.length) return 'No active alarms';
    const firstAlarm = alarmItems[0];

    if (firstAlarm?.message) return firstAlarm.message;
    if (firstAlarm?.parameter) return `${firstAlarm.parameter} requires attention`;

    return 'Operational alarm requires attention';
  };

  const handleAcknowledgeAll = () => {
    activeAlarms.forEach((alarm) => {
      acknowledgeAlarm(alarm.id, 'Acknowledged from dashboard');
    });
    toast.success('All alarms acknowledged');
  };

  const handleMuteAlarms = () => {
    muteAlarms(15);
    toast.success('Alarms muted for 15 minutes');
  };

  const chartParameters = [
    { key: 'spp', label: 'SPP', color: '#f59e0b', unit: 'psi' },
    { key: 'flowrate', label: 'Flow Rate', color: '#10b981', unit: 'gpm' },
    { key: 'wob', label: 'WOB', color: '#3b82f6', unit: 'klbs' },
    { key: 'rop', label: 'ROP', color: '#8b5cf6', unit: 'm/hr' },
  ];

  const secondaryChartParameters = [
    { key: 'temp', label: 'Temperature', color: '#ef4444', unit: 'degF' },
    { key: 'rpm', label: 'RPM', color: '#8b5cf6', unit: 'rpm' },
    { key: 'inc', label: 'Inclination', color: '#ec4899', unit: 'deg' },
    { key: 'azi', label: 'Azimuth', color: '#06b6d4', unit: 'deg' },
    { key: 'gamma', label: 'Gamma', color: '#84cc16', unit: 'API' },
  ];

  const keyParameters = useMemo(() => {
    const toNumber = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }

      return undefined;
    };
    const readLatestNumber = (metricKeys: string[], rawKeys: string[] = metricKeys) => {
      if (!latestMwdDataRecord) return undefined;

      for (const key of metricKeys) {
        const value = latestMwdDataRecord.metrics[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }

      for (const key of rawKeys) {
        const value = toNumber(latestMwdDataRecord.raw[key]);
        if (value !== undefined) return value;
      }

      return undefined;
    };
    const getStatusForParameter = (parameter: string, value?: number) =>
      typeof value === 'number'
        ? getDashboardThresholdStatus(value, thresholdByParameter.get(parameter))
        : undefined;
    const formatNumber = (value?: number, digits = 1) =>
      typeof value === 'number' ? value.toFixed(digits) : '-';
    const formatDepthValue = (value?: number) =>
      typeof value === 'number' ? formatDepthPrecise(value) : '-';
    const formatRopValue = (value?: number) =>
      typeof value === 'number' ? formatRop(value) : '-';

    const inclination = readLatestNumber(['inc'], ['inclination', 'inc']);
    const azimuth = readLatestNumber(['azi'], ['azimuth', 'azi']);
    const gamma = readLatestNumber(['gamma'], ['gammaRay', 'gamma_ray', 'gamma']);
    const bitDepth = readLatestNumber(['depthMd'], ['depthMd', 'depth_md', 'measuredDepth', 'measured_depth'])
      ?? latestMwdDataRecord?.depth;
    const holeDepth = readLatestNumber(['holeDepth'], ['hole_depth', 'holeDepth']);
    const pumpPressure = readLatestNumber(['spp'], ['standpipePressure', 'standpipe_pressure', 'pumpPressure', 'pump_pressure', 'spp']);
    const decoderPressure = readLatestNumber(['decoderPressure'], ['decoderPressure', 'decoder_pressure']);
    const batteryVoltage = readLatestNumber(['batteryVoltage'], ['batteryVoltage', 'battery_voltage', 'battery']);
    const temperature = readLatestNumber(['temp'], ['temperature', 'temp']);
    const rop = readLatestNumber(['rop'], ['rop', 'rateOfPenetration', 'rate_of_penetration']);
    const hookLoad = readLatestNumber(['hookLoad'], ['hookLoad', 'hook_load']);
    const wob = readLatestNumber(['wob'], ['weightOnBit', 'weight_on_bit', 'wob']) ?? hookLoad;
    const rpm = readLatestNumber(['rpm'], ['rotationSpeed', 'rotation_speed', 'rotarySpeed', 'rotary_speed', 'downholeRpm', 'downhole_rpm', 'rpm']);
    const flowIn = readLatestNumber(['flowIn'], ['flowIn', 'flow_in']);
    const flowOut = readLatestNumber(['flowOut'], ['flowOut', 'flow_out']);
    const mudWeight = readLatestNumber(['mudWeight'], ['mudWeight', 'mud_weight']);
    const ecd = readLatestNumber(['ecd'], ['ecd']);
    const shock = readLatestNumber(['shock'], ['shock']);
    const vibration = readLatestNumber(['vibration'], ['vibration']);
    const toolface = readLatestNumber(
      ['mtf', 'gtf', 'toolface'],
      ['magneticToolface', 'magnetic_toolface', 'gravityToolface', 'gravity_toolface', 'toolface']
    );
    const pressure = readLatestNumber(
      ['mwdPressure', 'annularPressure', 'spp'],
      ['mwdPressure', 'mwd_pressure', 'annularPressure', 'annular_pressure', 'standpipePressure', 'standpipe_pressure', 'pressure']
    );

    return [
      { label: 'Inclination', value: formatNumber(inclination, 2), unit: 'deg', status: getStatusForParameter('inc', inclination) },
      { label: 'Azimuth', value: formatNumber(azimuth, 2), unit: 'deg', status: getStatusForParameter('azi', azimuth) },
      { label: 'Gamma', value: formatNumber(gamma, 0), unit: 'API', status: getStatusForParameter('gamma', gamma) },
      { label: 'Bit Depth', value: formatDepthValue(bitDepth), unit: depthUnit, status: getStatusForParameter('bitDepth', bitDepth) },
      { label: 'Hole Depth', value: formatDepthValue(holeDepth), unit: depthUnit, status: getStatusForParameter('holeDepth', holeDepth) },
      { label: 'Pump Pressure', value: formatNumber(pumpPressure, 1), unit: 'psi', status: getStatusForParameter('pumpPressure', pumpPressure) },
      { label: 'Decoder Pressure', value: formatNumber(decoderPressure, 1), unit: 'psi', status: getStatusForParameter('decoderPressure', decoderPressure) },
      { label: 'Battery', value: formatNumber(batteryVoltage, 1), unit: 'V', status: getStatusForParameter('batteryVoltage', batteryVoltage) },
      { label: 'Temperature', value: formatNumber(temperature, 1), unit: 'degF', status: getStatusForParameter('temp', temperature) },
      { label: 'ROP', value: formatRopValue(rop), unit: ropUnit, status: getStatusForParameter('rop', rop) },
      { label: 'Hook Load', value: formatNumber(hookLoad, 1), unit: 'klbs', status: getStatusForParameter('hookLoad', hookLoad) },
      { label: 'WOB', value: formatNumber(wob, 1), unit: 'klbs', status: getStatusForParameter('wob', wob) },
      { label: 'RPM', value: formatNumber(rpm, 1), unit: 'rpm', status: getStatusForParameter('rpm', rpm) },
      { label: 'Flow In', value: formatNumber(flowIn, 1), unit: 'gpm', status: getStatusForParameter('flowIn', flowIn) },
      { label: 'Flow Out', value: formatNumber(flowOut, 1), unit: 'gpm', status: getStatusForParameter('flowOut', flowOut) },
      { label: 'Mud Weight', value: formatNumber(mudWeight, 2), unit: 'ppg', status: getStatusForParameter('mudweight', mudWeight) },
      { label: 'ECD', value: formatNumber(ecd, 2), unit: 'ppg', status: getStatusForParameter('ecd', ecd) },
      { label: 'Shock', value: formatNumber(shock, 2), unit: 'g', status: getStatusForParameter('shock', shock) },
      { label: 'Vibration', value: formatNumber(vibration, 2), unit: 'g', status: getStatusForParameter('vibration', vibration) },
      { label: 'Toolface', value: formatNumber(toolface, 1), unit: 'deg', status: getStatusForParameter('toolface', toolface) },
      { label: 'Pressure', value: formatNumber(pressure, 1), unit: 'psi', status: getStatusForParameter('pressure', pressure) },
    ];
  }, [
    depthUnit,
    formatDepthPrecise,
    formatRop,
    latestMwdDataRecord,
    ropUnit,
    thresholdByParameter,
  ]);

  const getKeyParameterTone = (status?: ParameterStatus) => {
    switch (status) {
      case 'normal':
        return {
          card: 'border-border/80 bg-background/90',
          value: 'text-foreground',
          accent: 'bg-emerald-500',
        };
      case 'warning':
        return {
          card: 'border-yellow-500/40 bg-yellow-50/70 dark:border-yellow-500/35 dark:bg-yellow-500/10',
          value: 'text-yellow-800 dark:text-yellow-300',
          accent: 'bg-yellow-500',
        };
      case 'critical':
        return {
          card: 'border-red-500/40 bg-red-50/70 dark:border-red-500/35 dark:bg-red-500/10',
          value: 'text-red-800 dark:text-red-300',
          accent: 'bg-red-500',
        };
      default:
        return {
          card: 'border-border/70 bg-muted/25',
          value: 'text-muted-foreground',
          accent: 'bg-muted-foreground/35',
        };
    }
  };

  const keyParameterPages = useMemo(() => {
    const pages: typeof keyParameters[] = [];
    const firstPageSize =
      dashboardViewport === 'mobile' ? (isCompact ? 10 : 8) : dashboardViewport === 'tablet' ? (isCompact ? 16 : 12) : isCompact ? 30 : 22;
    const nextPageSize =
      dashboardViewport === 'mobile' ? (isCompact ? 10 : 8) : dashboardViewport === 'tablet' ? (isCompact ? 16 : 12) : isCompact ? 30 : 22;

    pages.push(keyParameters.slice(0, firstPageSize));

    for (let start = firstPageSize; start < keyParameters.length; start += nextPageSize) {
      pages.push(keyParameters.slice(start, start + nextPageSize));
    }

    return pages;
  }, [dashboardViewport, isCompact, keyParameters]);

  const activeKeyParameterPage = Math.min(
    keyParameterPage,
    Math.max(keyParameterPages.length - 1, 0)
  );
  const visibleKeyParameters =
    keyParameterPages[activeKeyParameterPage] ?? keyParameterPages[0] ?? [];
  const denseTabletDesktopLayout = viewportWidth >= 1280 && viewportWidth < 1440;

  const compactDashboardPlotHeight = useMemo(() => {
    if (viewportWidth >= 1280 && viewportWidth < 1440) {
      return {
        px: 1040,
        css: 'clamp(760px, 82vh, 1120px)',
      };
    }

    if (dashboardViewport === 'tablet') {
      return {
        px: 1180,
        css: 'clamp(860px, 86vh, 1240px)',
      };
    }

    return {
      px: 760,
      css: 'clamp(520px, 72vh, 820px)',
    };
  }, [dashboardViewport, viewportWidth]);

  return (
    <div className={cn(isCompact ? 'space-y-3' : 'space-y-4')}>
      <div>
        <div className="mb-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold sm:text-3xl">Real-time Dashboard</h1>
              <p className="text-muted-foreground">
                {activeWellName} - {activeJobName}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    void refreshMwdSessions();
                    void refreshMwdData();
                    void refreshWitsDataValues();
                    void refreshWitsConfig();
                    void refreshWitsAlarms();
                    void loadDepthTrackingState();
                    void refreshConnectionStatus();
                    void refreshFailoverEvents();
                    void refreshSerialStatus();
                    void refreshEspWsStatus();
                  }}
                  disabled={
                    mwdSessionsLoading ||
                    mwdDataLoading ||
                    witsDataValuesLoading ||
                    witsConfigLoading ||
                    witsAlarmsLoading ||
                    depthTrackingLoading ||
                    connectionStatusLoading ||
                    failoverEventsLoading ||
                    serialStatusLoading ||
                    espWsStatusLoading
                  }
                  title="Refresh all dashboard data and connection health"
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 size-3.5",
                      (mwdSessionsLoading ||
                        mwdDataLoading ||
                        witsDataValuesLoading ||
                        witsConfigLoading ||
                        witsAlarmsLoading ||
                        depthTrackingLoading ||
                        connectionStatusLoading ||
                        failoverEventsLoading ||
                        serialStatusLoading ||
                        espWsStatusLoading) &&
                        "animate-spin"
                    )}
                  />
                  Refresh All
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs">
                      <SlidersHorizontal className="mr-1 size-3.5" />
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Granular refresh</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void refreshMwdData()} disabled={mwdDataLoading}>
                      Refresh Data
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void refreshWitsDataValues();
                        void refreshWitsConfig();
                        void refreshWitsAlarms();
                      }}
                      disabled={witsDataValuesLoading || witsConfigLoading || witsAlarmsLoading}
                    >
                      Refresh WITS
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void loadDepthTrackingState()} disabled={depthTrackingLoading || !token}>
                      Refresh DTS
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void refreshConnectionStatus();
                        void refreshFailoverEvents();
                        void refreshSerialStatus();
                        void refreshEspWsStatus();
                      }}
                      disabled={connectionStatusLoading || failoverEventsLoading || serialStatusLoading || espWsStatusLoading}
                    >
                      Refresh Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <TrendingUp className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium uppercase text-muted-foreground">Depth</span>
              <span className="text-sm font-semibold leading-none">
                {formatDepth(activeWell?.activeJob?.currentDepth ?? 0)} {depthUnit}
              </span>
              <span className="text-xs text-muted-foreground">
                Target {formatDepth(activeWell?.activeJob?.targetDepth ?? 0)} {depthUnit}
              </span>
            </div>
            {dashboardHealthItems.map((item) => (
              <div
                key={item.label}
                className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2"
              >
                <span className="text-xs font-medium uppercase text-muted-foreground">{item.label}</span>
                <Badge variant={item.tone} className="max-w-[150px] truncate text-[11px] capitalize">
                  {item.value}
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {mwdSessionsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {mwdDataError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {witsDataValuesError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {witsConfigError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {witsAlarmsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {depthTrackingError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {connectionStatusError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {failoverEventsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Gagal memuat data dari backend.
              </Badge>
            ) : null}
            {serialStatusError ? (
              <Badge variant="outline" className="w-fit max-w-full text-[10px] sm:text-xs">
                Serial status unavailable
              </Badge>
            ) : null}
            {espWsStatusError ? (
              <Badge variant="outline" className="w-fit max-w-full text-[10px] sm:text-xs">
                ESP WS status unavailable
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {activeAlarms.length > 0 && !alarmsMuted && (
        <section
          className={`rounded-2xl border p-2 shadow-sm ${
            isDark
              ? activeAlarms.length >= 3
                ? 'border-red-500/50 bg-red-950/50 shadow-red-950/30'
                : 'border-amber-500/50 bg-amber-600/30 shadow-amber-950/20'
              : getSeverityTone(activeAlarms.length)
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2 text-sm font-semibold ${
                  isDark ? 'text-red-500' : 'text-red-700'
                }`}
              >
                <ShieldAlert className="size-4" />
                Immediate attention required
              </div>
              <div className={`text-lg font-semibold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
                {getPrimaryAlarmMessage(activeAlarms)}
              </div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-muted-foreground'}`}>
                {activeAlarms.length} alarm{activeAlarms.length > 1 ? 's are' : ' is'} still active and unacknowledged.
                Review affected metrics before continuing normal monitoring.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMuteAlarms}
                className={
                  isDark ? 'border-white/15 bg-white/5 text-slate-100 hover:bg-white/10' : undefined
                }
              >
                <BellOff className="mr-2 size-4" />
                Mute 15 min
              </Button>
              <Button
                size="sm"
                onClick={handleAcknowledgeAll}
                className={isDark ? 'bg-red-500 text-white hover:bg-red-400' : undefined}
              >
                <Check className="mr-2 size-4" />
                Acknowledge all
              </Button>
            </div>
          </div>
        </section>
      )}

      {alarmsMuted && (
        <Alert
          className={`rounded-2xl ${
            isDark ? 'border-amber-500/50 bg-amber-950/45 text-amber-100' : 'border-amber-300 bg-amber-50'
          }`}
        >
          <BellOff className="size-4" />
          <AlertDescription className={isDark ? 'text-amber-100/90' : undefined}>
            Alarm notifications are muted temporarily. Visual monitoring remains active.
          </AlertDescription>
        </Alert>
      )}

      {connectionState.status === 'offline' && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <strong>Offline Mode:</strong> Displaying last known values. Data may be outdated.
            Check your network connection.
          </AlertDescription>
        </Alert>
      )}

      {hasNoMwdData && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Belum ada data MWD untuk session ini. KPI card tetap ditampilkan dengan status No Data sampai backend mengirim nilai.
          </AlertDescription>
        </Alert>
      )}

      {shouldBlockDashboard ? (
        <Card className="rounded-2xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {startupError
                  ? "Gagal memuat data dari backend."
                  : hasNoSessions
                    ? "Belum ada job/session. Buat session baru untuk mulai monitoring."
                    : "Belum ada data MWD untuk session ini."}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {startupError
                  ? "Detail teknis tersedia di console saat development."
                  : hasNoSessions
                    ? "Buat atau pilih job/session dari backend sebelum membuka dashboard."
                    : "Session sudah dipilih, tetapi /api/mwd-data belum mengembalikan data untuk session ini."}
              </p>
              {startupLoading ? (
                <Badge variant="outline" className="mt-4">
                  Loading startup data
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void refreshMwdSessions()} disabled={mwdSessionsLoading}>
                <RefreshCw className={cn("mr-2 size-4", mwdSessionsLoading && "animate-spin")} />
                Sessions
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void refreshWitsConfig();
                  void refreshMwdData();
                }}
                disabled={!activeMwdSessionId || witsConfigLoading || mwdDataLoading}
              >
                <RefreshCw className={cn("mr-2 size-4", (witsConfigLoading || mwdDataLoading) && "animate-spin")} />
                Retry Data
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
      <div
        className={cn(
          'grid',
          isCompact ? 'gap-2' : 'gap-3',
          denseTabletDesktopLayout
            ? 'grid-cols-[208px_minmax(0,1fr)]'
            : 'min-[1440px]:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]'
        )}
      >
        <div className="space-y-3">
          <div className="space-y-3">
            <ToolfaceIndicator data={toolfaceData} size="sm" />

            <Card className="p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Depth Tracking</h3>
                <Badge
                  variant={depthTrackingError ? "destructive" : "secondary"}
                  className="max-w-full text-[10px]"
                >
                  {depthTrackingLabel}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border/70 bg-background/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Bit Depth</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatTrackingNumber(depthTrackingState?.bitDepth ?? depthTrackingState?.currentDepth, ` ${depthUnit}`)}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Hole Depth</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatTrackingNumber(depthTrackingState?.holeDepth, ` ${depthUnit}`)}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Block Depth</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatTrackingNumber(depthTrackingState?.blockDepth, ` ${depthUnit}`)}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">ROP</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatTrackingNumber(depthTrackingState?.rop, ` ${ropUnit}`)}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Mode</div>
                  <div className="mt-1 truncate font-semibold">{depthTrackingState?.mode ?? '-'}</div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Updated</div>
                  <div className="mt-1 truncate font-semibold">
                    {formatTrackingTime(depthTrackingState?.updatedAt ?? depthTrackingState?.currentTime)}
                  </div>
                </div>
              </div>
              {depthTrackingState?.source ? (
                <div className="mt-2 text-xs text-muted-foreground">Source: {depthTrackingState.source}</div>
              ) : null}
              {depthTrackingError ? (
                <p className="mt-2 text-xs text-destructive">{depthTrackingError}</p>
              ) : null}
            </Card>

            <Card className="p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Key Parameters</h3>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {keyParameterPages.map((_, index) => (
                  <Button
                    key={`key-parameter-page-${index}`}
                    type="button"
                    size="sm"
                    variant={activeKeyParameterPage === index ? 'default' : 'outline'}
                    className="h-7 min-w-8 rounded-md px-2 text-xs"
                    onClick={() => setKeyParameterPage(index)}
                  >
                    {index + 1}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-2 sm:gap-2">
                {visibleKeyParameters.map((parameter, index) => (
                  <div
                    key={`${parameter.label}-${index}`}
                    className={cn(
                      'min-w-0 rounded-xl border shadow-sm',
                      isCompact ? 'px-2 py-1.5' : 'px-2 py-1.5 sm:px-2.5 sm:py-2',
                      getKeyParameterTone(parameter.status).card
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words text-[9px] font-medium uppercase leading-tight tracking-[0.06em] text-muted-foreground sm:text-[10px]">
                        {parameter.label}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                          getKeyParameterTone(parameter.status).accent
                        )}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                      <span
                        className={cn(
                          'font-mono text-sm font-semibold leading-none min-[380px]:text-base sm:text-lg',
                          getKeyParameterTone(parameter.status).value
                        )}
                      >
                        {parameter.value}
                      </span>
                      {parameter.unit ? (
                        <span className="text-[9px] text-muted-foreground sm:text-[10px]">{parameter.unit}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold sm:text-xl">Well Plot Overview</h2>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                <Badge variant="outline" className="text-[10px] sm:text-xs">
                  {dashboardPlotTracks.length} active track{dashboardPlotTracks.length === 1 ? '' : 's'}
                </Badge>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  {dashboardDepthCorrection} | {dashboardDepthScale}
                </Badge>
              </div>
            </div>
            <div className="hidden min-[1280px]:block">
              <WellPlotPanel
                showHeader={false}
                showAllTracks
                dashboardStretch
                allTracksMinWidth={denseTabletDesktopLayout ? 680 : 860}
                maxVisibleTracks={denseTabletDesktopLayout ? 3 : 6}
              />
            </div>
            <div className="min-[1280px]:hidden">
              <WellPlotPanel
                compact
                showHeader={false}
                compactDashboardHeightPx={compactDashboardPlotHeight.px}
                compactDashboardHeightCss={compactDashboardPlotHeight.css}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RealTimeChart
          data={chartData}
          title="Pressure & Hydraulics"
          availableParameters={chartParameters}
          defaultParameters={['spp', 'flowrate']}
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
        />
        <RealTimeChart
          data={chartData}
          title="Temp, RPM & Directional"
          availableParameters={secondaryChartParameters}
          defaultParameters={['temp', 'rpm']}
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
        />
      </div>

      <EventStream events={events} maxHeight={300} />

      {user?.role === 'engineer' && (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Engineer Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              Compare Trajectory
            </Button>
            <Button variant="outline" size="sm">
              Export Last Hour
            </Button>
            <Button variant="outline" size="sm">
              Adjust Thresholds
            </Button>
            <Button variant="outline" size="sm">
              Generate Report
            </Button>
          </div>
        </Card>
      )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;
