'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { chartParameterGroups, type ChartTimeWindow } from '@/lib/chart-analytics';

export const DashboardPage: React.FC = () => {
  const { token, user } = useAuth();
  const {
    networkStatus,
    backendRestStatus,
    backendRestError,
    connectionStatusLoading,
    connectionStatusError,
    refreshConnectionStatus,
    reconnect,
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
    recordEvent,
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
  const [timeWindow, setTimeWindow] = useState<ChartTimeWindow>('15min');
  const [keyParameterPage, setKeyParameterPage] = useState(0);
  const [dashboardViewport, setDashboardViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [viewportWidth, setViewportWidth] = useState(0);
  const [depthTrackingState, setDepthTrackingState] = useState<DepthTrackingState | null>(null);
  const [depthTrackingLoading, setDepthTrackingLoading] = useState(false);
  const [depthTrackingError, setDepthTrackingError] = useState('');
  const activeDepthTrackingIssueRef = useRef(false);
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
  const activeWellName = activeMwdSession?.wellName ?? activeWell?.name ?? 'No active well';
  const activeJobName = activeMwdSession?.jobName ?? activeMwdSession?.name ?? activeWell?.activeJob?.name ?? 'No active session';
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
  const startupLoading = mwdSessionsLoading || witsConfigLoading || mwdDataLoading;
  const hasNoSessions = !mwdSessionsLoading && !mwdSessionsError && mwdSessions.length === 0;
  const hasNoActiveSession = !mwdSessionsLoading && !mwdSessionsError && !activeMwdSessionId;
  const hasNoMwdData =
    Boolean(activeMwdSessionId) &&
    !mwdDataLoading &&
    !mwdDataError &&
    !latestMwdDataRecord;
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
  const realtimeRecovering = Boolean(
    activeMwdSessionId && (realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting')
  );
  const realtimeNeedsRecovery = Boolean(
    activeMwdSessionId && (realtimeStatus === 'disconnected' || realtimeStatus === 'error')
  );
  const backendNeedsRecovery =
    backendRestStatus === 'offline' || backendRestStatus === 'error' || backendRestStatus === 'auth-error';
  const primaryDashboardActionBusy =
    mwdSessionsLoading ||
    mwdDataLoading ||
    witsDataValuesLoading ||
    witsConfigLoading ||
    witsAlarmsLoading ||
    depthTrackingLoading ||
    connectionStatusLoading ||
    failoverEventsLoading ||
    serialStatusLoading ||
    espWsStatusLoading ||
    realtimeRecovering;
  const primaryDashboardActionLabel =
    networkStatus === 'offline'
      ? 'Offline'
      : realtimeRecovering
        ? 'Reconnecting'
        : realtimeNeedsRecovery || backendNeedsRecovery
          ? 'Reconnect'
          : 'Refresh All';
  const handlePrimaryDashboardAction = () => {
    if (networkStatus === 'offline' || realtimeRecovering) return;

    if (realtimeNeedsRecovery || backendNeedsRecovery) {
      reconnect();
      return;
    }

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
  };
  const backendStatusLabel =
    backendRestStatus === 'checking'
      ? 'Checking'
      : backendRestStatus === 'auth-error'
        ? 'Auth error'
        : backendRestStatus;
  const dashboardHealthItems = [
    {
      label: 'Browser',
      value: networkStatus,
      tone: networkStatus === 'offline' ? 'destructive' : networkStatus === 'online' ? 'secondary' : 'outline',
    },
    {
      label: 'Backend',
      value: backendStatusLabel,
      tone:
        backendRestStatus === 'online'
          ? 'secondary'
          : backendRestStatus === 'checking' || backendRestStatus === 'unknown'
            ? 'outline'
            : 'destructive',
    },
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
  const latestDashboardDepth = useMemo(() => {
    const toNumber = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }

      return undefined;
    };
    const parseTime = (value?: string | Date) => {
      if (!value) return 0;
      const parsed = value instanceof Date ? value : new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };
    const readLatestMwdDepth = () => {
      if (!latestMwdDataRecord) return undefined;

      const metricDepth =
        latestMwdDataRecord.metrics.depthMd ??
        latestMwdDataRecord.metrics.bitDepth ??
        latestMwdDataRecord.metrics.holeDepth;
      const rawDepth =
        toNumber(latestMwdDataRecord.raw.depthMd) ??
        toNumber(latestMwdDataRecord.raw.depth_md) ??
        toNumber(latestMwdDataRecord.raw.measuredDepth) ??
        toNumber(latestMwdDataRecord.raw.measured_depth) ??
        toNumber(latestMwdDataRecord.raw.bitDepth) ??
        toNumber(latestMwdDataRecord.raw.bit_depth) ??
        toNumber(latestMwdDataRecord.raw.holeDepth) ??
        toNumber(latestMwdDataRecord.raw.hole_depth);

      return latestMwdDataRecord.depth ?? metricDepth ?? rawDepth;
    };

    const candidates = [
      {
        value: readLatestMwdDepth(),
        timestamp: latestMwdDataRecord?.timestamp.getTime() ?? 0,
      },
      {
        value: depthTrackingState?.bitDepth ?? depthTrackingState?.currentDepth ?? depthTrackingState?.holeDepth,
        timestamp: parseTime(depthTrackingState?.currentTime ?? depthTrackingState?.updatedAt),
      },
      {
        value:
          typeof activeWell?.activeJob?.currentDepth === 'number' && activeWell.activeJob.currentDepth > 0
            ? activeWell.activeJob.currentDepth
            : undefined,
        timestamp: 0,
      },
    ]
      .filter((candidate): candidate is { value: number; timestamp: number } =>
        typeof candidate.value === 'number' && Number.isFinite(candidate.value)
      )
      .sort((left, right) => right.timestamp - left.timestamp);

    return candidates[0]?.value;
  }, [activeWell?.activeJob?.currentDepth, depthTrackingState, latestMwdDataRecord]);
  const dashboardTargetDepth = useMemo(() => {
    const toNumber = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }

      return undefined;
    };
    const raw = activeMwdSession?.raw ?? {};
    const sessionTarget =
      toNumber(raw.targetDepth) ??
      toNumber(raw.target_depth) ??
      toNumber(raw.endDepth) ??
      toNumber(raw.end_depth) ??
      toNumber(raw.plannedDepth) ??
      toNumber(raw.planned_depth) ??
      toNumber(raw.totalDepth) ??
      toNumber(raw.total_depth) ??
      toNumber(raw.td);
    const activeJobTarget =
      typeof activeWell?.activeJob?.targetDepth === 'number' && activeWell.activeJob.targetDepth > 0
        ? activeWell.activeJob.targetDepth
        : undefined;

    return sessionTarget ?? activeJobTarget;
  }, [activeMwdSession?.raw, activeWell?.activeJob?.targetDepth]);
  const dashboardDepthLabel =
    typeof latestDashboardDepth === 'number' ? `${formatDepth(latestDashboardDepth)} ${depthUnit}` : '-';
  const dashboardTargetDepthLabel =
    typeof dashboardTargetDepth === 'number' ? `${formatDepth(dashboardTargetDepth)} ${depthUnit}` : '-';

  useEffect(() => {
    const normalizedDtsStatus = (depthTrackingState?.status ?? depthTrackingState?.mode ?? '').toLowerCase();
    const hasDtsIssue =
      Boolean(depthTrackingError) ||
      ['offline', 'disconnected', 'error', 'failed', 'unhealthy', 'unavailable'].includes(normalizedDtsStatus);

    if (!hasDtsIssue) {
      activeDepthTrackingIssueRef.current = false;
      return;
    }

    if (activeDepthTrackingIssueRef.current) return;

    activeDepthTrackingIssueRef.current = true;
    recordEvent({
      id: `generated-status:dts-${Date.now()}`,
      timestamp: new Date(),
      severity: depthTrackingError ? 'critical' : 'warning',
      type: 'system',
      message: `DTS / Depth Tracking: ${depthTrackingError || depthTrackingState?.status || depthTrackingState?.mode || 'Unavailable'}`,
      source: 'primary',
    });
  }, [depthTrackingError, depthTrackingState?.mode, depthTrackingState?.status, recordEvent]);

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
    chartParameterGroups.mud.find((parameter) => parameter.key === 'spp'),
    chartParameterGroups.mud.find((parameter) => parameter.key === 'flowrate'),
    chartParameterGroups.drilling.find((parameter) => parameter.key === 'wob'),
    chartParameterGroups.drilling.find((parameter) => parameter.key === 'rop'),
  ].filter((parameter): parameter is NonNullable<typeof parameter> => Boolean(parameter));

  const secondaryChartParameters = [
    chartParameterGroups.mud.find((parameter) => parameter.key === 'temp'),
    chartParameterGroups.drilling.find((parameter) => parameter.key === 'rpm'),
    chartParameterGroups.directional.find((parameter) => parameter.key === 'inc'),
    chartParameterGroups.directional.find((parameter) => parameter.key === 'azi'),
    chartParameterGroups.formation.find((parameter) => parameter.key === 'gamma'),
  ].filter((parameter): parameter is NonNullable<typeof parameter> => Boolean(parameter));

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
  const denseTabletDesktopLayout = viewportWidth >= 1440 && viewportWidth < 1536;

  const compactDashboardPlotHeight = useMemo(() => {
    if (viewportWidth >= 1440 && viewportWidth < 1536) {
      return {
        px: 1040,
        css: 'clamp(760px, 82dvh, 1120px)',
      };
    }

    if (dashboardViewport === 'tablet') {
      return {
        px: 1180,
        css: 'clamp(860px, 86dvh, 1240px)',
      };
    }

    return {
      px: 760,
      css: 'clamp(520px, 72dvh, 820px)',
    };
  }, [dashboardViewport, viewportWidth]);

  return (
    <div className={cn("min-w-0", isCompact ? 'space-y-3' : 'space-y-4')}>
      <div>
        <div className="mb-3 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">Real-time Dashboard</h1>
              <p className="break-words text-sm text-muted-foreground sm:text-base">
                {activeWellName} - {activeJobName}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-1.5 sm:gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
                  onClick={handlePrimaryDashboardAction}
                  disabled={networkStatus === 'offline' || primaryDashboardActionBusy}
                  title={
                    realtimeNeedsRecovery || backendNeedsRecovery
                      ? 'Reconnect realtime and refresh backend-backed dashboard data'
                      : 'Refresh all dashboard data and connection health'
                  }
                >
                  <RefreshCw
                    className={cn(
                      "mr-1 size-2 sm:mr-1.5 sm:size-3.5",
                      primaryDashboardActionBusy && "animate-spin"
                    )}
                  />
                  {primaryDashboardActionLabel}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[8px] sm:h-8 sm:text-xs"
                      aria-label="Options"
                      title="Options"
                    >
                      <SlidersHorizontal className="size-2 sm:mr-1 sm:size-3.5" />
                      <span className="hidden sm:inline">Options</span>
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

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:flex lg:flex-wrap lg:items-center">
            <div className="col-span-2 flex min-h-8 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1.5 sm:col-span-1 sm:min-h-9 sm:gap-x-2 sm:px-3 sm:py-2">
              <TrendingUp className="size-3 text-muted-foreground sm:size-3.5" />
              <span className="text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">Depth</span>
              <span className="break-words text-xs font-semibold leading-none sm:text-sm">
                {dashboardDepthLabel}
              </span>
              <span className="text-[10px] text-muted-foreground sm:text-xs">
                Target {dashboardTargetDepthLabel}
              </span>
            </div>
            {dashboardHealthItems.map((item) => (
              <div
                key={item.label}
                className="flex min-h-8 min-w-0 max-w-full items-center justify-between gap-1.5 rounded-xl border border-border/70 bg-background/70 px-2 py-1.5 sm:min-h-9 sm:gap-2 sm:px-3 sm:py-2"
              >
                <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">{item.label}</span>
                <Badge variant={item.tone} className="max-w-[88px] truncate px-1.5 text-[10px] capitalize sm:max-w-[150px] sm:text-[11px]">
                  {item.value}
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {mwdSessionsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                {mwdSessionsError}
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
          className={`rounded-xl border p-2 shadow-sm sm:rounded-2xl sm:p-3 ${
            isDark
              ? activeAlarms.length >= 3
                ? 'border-red-500/50 bg-red-950/50 shadow-red-950/30'
                : 'border-amber-500/50 bg-amber-600/30 shadow-amber-950/20'
              : getSeverityTone(activeAlarms.length)
          }`}
        >
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 sm:space-y-2">
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold sm:gap-2 sm:text-sm ${
                  isDark ? 'text-red-500' : 'text-red-700'
                }`}
              >
                <ShieldAlert className="size-3.5 sm:size-4" />
                Immediate attention required
              </div>
              <div className={`text-sm font-semibold sm:text-lg ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
                {getPrimaryAlarmMessage(activeAlarms)}
              </div>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-muted-foreground'}`}>
                {activeAlarms.length} alarm{activeAlarms.length > 1 ? 's are' : ' is'} still active and unacknowledged.
                Review affected metrics before continuing normal monitoring.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMuteAlarms}
                className={cn(
                  "h-7 px-2 text-[9px] sm:h-8 sm:px-3 sm:text-xs",
                  isDark ? 'border-white/15 bg-white/5 text-slate-100 hover:bg-white/10' : undefined
                )}
              >
                <BellOff className="mr-1 size-2 sm:mr-2 sm:size-4" />
                Mute 15 min
              </Button>
              <Button
                size="sm"
                onClick={handleAcknowledgeAll}
                className={cn(
                  "h-7 px-2 text-[9px] sm:h-8 sm:px-3 sm:text-xs",
                  isDark ? 'bg-red-500 text-white hover:bg-red-400' : undefined
                )}
              >
                <Check className="mr-1 size-2 sm:mr-2 sm:size-4" />
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

      {(realtimeRecovering || realtimeNeedsRecovery) && networkStatus === 'online' && (
        <Alert
          className={cn(
            'rounded-2xl',
            isDark
              ? 'border-amber-500/50 bg-amber-950/45 text-amber-100'
              : 'border-amber-300 bg-amber-50'
          )}
        >
          <AlertTriangle className="size-4" />
          <AlertDescription className={isDark ? 'text-amber-100/90' : undefined}>
            <strong>
              {realtimeRecovering ? 'Realtime sedang reconnect.' : 'Realtime terputus.'}
            </strong>{' '}
            REST data tetap dapat di-refresh, tetapi dashboard tidak dianggap live sampai WebSocket connected.
            Gunakan tombol utama dashboard untuk retry sinkronisasi.
          </AlertDescription>
        </Alert>
      )}

      {(networkStatus === 'offline' || backendRestStatus === 'offline' || backendRestStatus === 'error') && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <strong>Offline/Stale:</strong> Menampilkan data terakhir yang tersedia. Data tidak dianggap live sampai
            Browser, Backend API, dan Realtime kembali connected.
            {backendRestError ? ` ${backendRestError}` : ''}
          </AlertDescription>
        </Alert>
      )}

      {mwdSessionsError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {mwdSessionsError} Dashboard tetap ditampilkan dengan nilai kosong sampai backend mengirim session yang bisa dibaca.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasNoSessions ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Belum ada job/session yang tersedia untuk akun ini.
          </AlertDescription>
        </Alert>
      ) : null}

      {!hasNoSessions && hasNoActiveSession ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            No active session selected. 
          </AlertDescription>
        </Alert>
      ) : null}

      {hasNoMwdData && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Belum ada data MWD untuk session ini.
          </AlertDescription>
        </Alert>
      )}

      <div
        className={cn(
          'grid',
          isCompact ? 'gap-2' : 'gap-3',
          denseTabletDesktopLayout
            ? 'grid-cols-[220px_minmax(0,1fr)]'
            : 'min-[1536px]:grid-cols-[260px_minmax(0,1fr)]'
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
              <div className="grid grid-cols-2 gap-2 text-xs min-[380px]:grid-cols-2">
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
              <div className="grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-2 min-[768px]:grid-cols-3 min-[1024px]:grid-cols-3 min-[1440px]:grid-cols-2 sm:gap-2">
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
            <div className="hidden min-[1440px]:block">
              <WellPlotPanel
                showHeader={false}
                showAllTracks
                dashboardStretch
                allTracksMinWidth={denseTabletDesktopLayout ? 680 : 860}
                maxVisibleTracks={denseTabletDesktopLayout ? 3 : 6}
              />
            </div>
            <div className="min-[1440px]:hidden">
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

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Trend Charts</h2>
            <p className="text-sm text-muted-foreground">
              Session history from backend MWD data. Use All to inspect the complete available range.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            Range: {timeWindow === 'all' ? 'All' : timeWindow}
          </Badge>
        </div>
        <div className="grid min-w-0 items-stretch gap-4 2xl:grid-cols-2">
          <RealTimeChart
            data={chartData}
            title="Pressure & Hydraulics"
            description="Pressure, flow, WOB, and penetration trend context."
            availableParameters={chartParameters}
            defaultParameters={['spp', 'flowrate']}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
          />
          <RealTimeChart
            data={chartData}
            title="Temp, RPM & Directional"
            description="Thermal, rotary, directional, and formation response trends."
            availableParameters={secondaryChartParameters}
            defaultParameters={['temp', 'rpm']}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
          />
        </div>
      </section>

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
    </div>
  );
};

export default DashboardPage;
