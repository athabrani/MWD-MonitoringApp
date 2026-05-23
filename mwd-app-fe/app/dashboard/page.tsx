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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BellOff, Check, AlertTriangle, TrendingUp, ShieldAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDashboardThresholdStatus } from '@/lib/dashboard-thresholds';
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
    kpiData,
    chartData,
    events,
    activeWell,
    mwdSessions,
    activeMwdSession,
    activeMwdSessionId,
    setActiveMwdSessionId,
    mwdSessionsLoading,
    mwdSessionsError,
    refreshMwdSessions,
    mwdDataLoading,
    mwdDataError,
    refreshMwdData,
    witsDataValuesLoading,
    witsDataValuesError,
    refreshWitsDataValues,
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
    const currentDepth = activeWell?.activeJob?.currentDepth ?? 0;
    const inclination = kpiData.inclination.value;
    const azimuth = kpiData.azimuth.value;
    const gamma = kpiData.gamma.value;
    const rop = kpiData.rop.value;
    const wob = kpiData.wob.value;
    const standpipePressure = kpiData.standpipePressure.value;
    const flowRate = kpiData.flowRate.value;
    const mudWeight = kpiData.mudWeight.value;
    const temperature = kpiData.temperature.value;
    const rpm = kpiData.rpm.value;
    const gravity = toolfaceData.angle;
    const pulseAmp = flowRate / 190;
    const gammaDepth = currentDepth + 300.98;
    const bitDepth = currentDepth - 7.02;
    const decoderPressure = standpipePressure * 0.92;
    const rpmDownhole = rpm - 6.5;
    const vibration = 2.4 + rpm / 85;
    const diffPressure = standpipePressure * 0.18;
    const ecdTvdSurveyBase = mudWeight + 0.34;
    const tvd = currentDepth * 0.956;
    const getStatusForParameter = (parameter: string, value: number) =>
      getDashboardThresholdStatus(value, thresholdByParameter.get(parameter));

    return [
      { label: 'Inclination', value: inclination.toFixed(2), unit: 'deg', status: getStatusForParameter('inc', inclination) },
      { label: 'Azimuth', value: azimuth.toFixed(2), unit: 'deg', status: getStatusForParameter('azi', azimuth) },
      { label: 'Dip Angle', value: (inclination * 1.78).toFixed(1), unit: 'deg', placeholder: true },
      { label: 'G Total', value: (1 + Math.abs(gravity - (toolfaceData.targetAngle ?? 180)) / 1000).toFixed(4), unit: 'g', placeholder: true },
      { label: 'Magnetic Field', value: (58 + azimuth / 1000).toFixed(4), unit: 'uT', placeholder: true },
      { label: 'Gas Avg', value: (gamma * 0.73).toFixed(1), unit: 'unit', placeholder: true },
      { label: 'Gamma', value: gamma.toFixed(0), unit: 'API', status: getStatusForParameter('gamma', gamma) },
      { label: 'Confidence', value: `${Math.max(82, 98 - activeAlarms.length * 4).toFixed(0)}%`, unit: '', placeholder: true },
      { label: 'WOB', value: wob.toFixed(1), unit: kpiData.wob.unit, status: getStatusForParameter('wob', wob) },
      { label: 'Gamma Depth', value: formatDepthPrecise(gammaDepth), unit: depthUnit, status: getStatusForParameter('gammaDepth', gammaDepth), placeholder: true },
      { label: 'Pulse Amp', value: pulseAmp.toFixed(2), unit: 'amp', status: getStatusForParameter('pulseAmp', pulseAmp), placeholder: true },
      { label: 'Gas', value: (gamma * 0.73).toFixed(1), unit: 'unit', placeholder: true },
      { label: 'Bit Depth', value: formatDepthPrecise(bitDepth), unit: depthUnit, status: getStatusForParameter('bitDepth', bitDepth), placeholder: true },
      { label: 'Decoder Pressure', value: decoderPressure.toFixed(1), unit: 'psi', status: getStatusForParameter('decoderPressure', decoderPressure), placeholder: true },
      { label: 'Pumps Up', value: flowRate > 0 ? 'Yes' : 'No', unit: '', placeholder: true },
      { label: 'Hole Depth', value: formatDepthPrecise(currentDepth), unit: depthUnit, status: getStatusForParameter('holeDepth', currentDepth) },
      { label: 'Pump Pressure', value: standpipePressure.toFixed(1), unit: 'psi', status: getStatusForParameter('pumpPressure', standpipePressure) },
      { label: 'Pumps Down', value: flowRate < 50 ? 'Yes' : 'No', unit: '', placeholder: true },
      { label: 'ROP', value: formatRop(rop), unit: ropUnit, status: getStatusForParameter('rop', rop) },
      { label: 'Gravity', value: gravity.toFixed(1), unit: 'deg', status: getStatusForParameter('gravity', gravity) },
      { label: 'Mud Weight', value: mudWeight.toFixed(2), unit: kpiData.mudWeight.unit, status: getStatusForParameter('mudweight', mudWeight) },
      { label: 'Temp', value: temperature.toFixed(1), unit: kpiData.temperature.unit, status: getStatusForParameter('temp', temperature) },
      { label: 'RPM', value: rpm.toFixed(0), unit: kpiData.rpm.unit, status: getStatusForParameter('rpm', rpm) },
      { label: 'Decoder Pressure', value: decoderPressure.toFixed(1), unit: 'psi', status: getStatusForParameter('decoderPressure', decoderPressure), placeholder: true },
      { label: 'Vib (ax.lat)', value: vibration.toFixed(2), unit: 'g', status: getStatusForParameter('vibration', vibration), placeholder: true },
      { label: 'RPM Downhole', value: rpmDownhole.toFixed(1), unit: 'rpm', status: getStatusForParameter('rpmDownhole', rpmDownhole), placeholder: true },
      { label: 'SSI', value: (0.82 + gamma / 260).toFixed(2), unit: '', placeholder: true },
      { label: 'Diff Pressure', value: diffPressure.toFixed(1), unit: 'psi', status: getStatusForParameter('diffPressure', diffPressure), placeholder: true },
      { label: 'ECD TVD Survey Base', value: ecdTvdSurveyBase.toFixed(2), unit: 'ppg', status: getStatusForParameter('ecdTvdSurveyBase', ecdTvdSurveyBase), placeholder: true },
      { label: 'TVD', value: formatDepthPrecise(tvd), unit: depthUnit, status: getStatusForParameter('tvd', tvd), placeholder: true },
    ];
  }, [
    activeAlarms.length,
    activeWell?.activeJob?.currentDepth,
    depthUnit,
    formatDepthPrecise,
    formatRop,
    kpiData,
    ropUnit,
    thresholdByParameter,
    toolfaceData.angle,
    toolfaceData.targetAngle,
  ]);

  const getKeyParameterTone = (status?: 'normal' | 'warning' | 'critical') => {
    switch (status) {
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
          card: 'border-border/80 bg-background/90',
          value: 'text-foreground',
          accent: 'bg-emerald-500',
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
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">Real-time Dashboard</h1>
            <p className="text-muted-foreground">
              {activeWellName} - {activeJobName}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Select
                value={activeMwdSessionId}
                onValueChange={setActiveMwdSessionId}
                disabled={mwdSessionsLoading || mwdSessions.length === 0}
              >
                <SelectTrigger className="h-8 w-full min-w-[220px] bg-background/90 text-xs sm:w-[260px]">
                  <SelectValue
                    placeholder={mwdSessionsLoading ? "Loading sessions..." : "No backend sessions"}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => void refreshMwdSessions()}
                disabled={mwdSessionsLoading}
                title="Refresh MWD sessions"
              >
                <RefreshCw className={cn("size-3.5", mwdSessionsLoading && "animate-spin")} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => void refreshMwdData()}
                disabled={mwdDataLoading}
                title="Refresh MWD data"
              >
                <RefreshCw className={cn("mr-1 size-3.5", mwdDataLoading && "animate-spin")} />
                Data
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  void refreshWitsDataValues();
                  void refreshWitsAlarms();
                }}
                disabled={witsDataValuesLoading || witsAlarmsLoading}
                title="Refresh WITS values and alarms"
              >
                <RefreshCw
                  className={cn(
                    "mr-1 size-3.5",
                    (witsDataValuesLoading || witsAlarmsLoading) && "animate-spin"
                  )}
                />
                WITS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => void loadDepthTrackingState()}
                disabled={depthTrackingLoading || !token}
                title="Refresh depth tracking state"
              >
                <RefreshCw className={cn("mr-1 size-3.5", depthTrackingLoading && "animate-spin")} />
                DTS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  void refreshConnectionStatus();
                  void refreshFailoverEvents();
                }}
                disabled={connectionStatusLoading || failoverEventsLoading}
                title="Refresh connection status and failover events"
              >
                <RefreshCw
                  className={cn(
                    "mr-1 size-3.5",
                    (connectionStatusLoading || failoverEventsLoading) && "animate-spin"
                  )}
                />
                Link
              </Button>
            </div>
            {mwdSessionsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Session API unavailable
              </Badge>
            ) : null}
            {mwdDataError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                MWD data API unavailable
              </Badge>
            ) : null}
            {witsDataValuesError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                WITS values API unavailable
              </Badge>
            ) : null}
            {witsAlarmsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                WITS alarms API unavailable
              </Badge>
            ) : null}
            {depthTrackingError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Depth tracking API unavailable
              </Badge>
            ) : null}
            {connectionStatusError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Connection status API unavailable
              </Badge>
            ) : null}
            {failoverEventsError ? (
              <Badge variant="destructive" className="w-fit max-w-full text-[10px] sm:text-xs">
                Failover events API unavailable
              </Badge>
            ) : null}
            <Badge variant="secondary" className="w-fit max-w-full text-xs sm:text-sm">
              <TrendingUp className="mr-1 size-4" />
              Depth: {formatDepth(activeWell?.activeJob?.currentDepth ?? 0)} / {formatDepth(activeWell?.activeJob?.targetDepth ?? 0)} {depthUnit}
            </Badge>
            <Badge
              variant={depthTrackingError ? "destructive" : "outline"}
              className="w-fit max-w-full text-xs sm:text-sm"
            >
              DTS: {depthTrackingLabel}
            </Badge>
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
    </div>
  );
};

export default DashboardPage;
