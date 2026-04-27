'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { BellOff, Check, AlertTriangle, TrendingUp, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const {
    connectionState,
    kpiData,
    chartData,
    events,
    activeWell,
    acknowledgeAlarm,
    muteAlarms,
    alarmsMuted,
    toolfaceData,
    settings,
  } = useApp();

  const isDark = settings.display.theme === 'dark';
  const [timeWindow, setTimeWindow] = useState<'5min' | '15min' | '1hr'>('15min');
  const [keyParameterPage, setKeyParameterPage] = useState(0);
  const [dashboardViewport, setDashboardViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [viewportWidth, setViewportWidth] = useState(0);

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
    const getStatusForLabel = (label: string) => {
      switch (label) {
        case 'Inclination':
          return kpiData.inclination.status;
        case 'Azimuth':
          return kpiData.azimuth.status;
        case 'Gamma':
          return kpiData.gamma.status;
        case 'WOB':
          return kpiData.wob.status;
        case 'Pump Pressure':
        case 'Decoder Pressure':
        case 'Diff Pressure':
          return kpiData.standpipePressure.status;
        case 'Mud Weight':
        case 'ECD TVD Survey Base':
          return kpiData.mudWeight.status;
        case 'Temp':
          return kpiData.temperature.status;
        case 'RPM':
        case 'RPM Downhole':
          return kpiData.rpm.status;
        case 'ROP':
          return kpiData.rop.status;
        default:
          return 'normal' as const;
      }
    };

    return [
      { label: 'Inclination', value: inclination.toFixed(2), unit: 'deg', status: getStatusForLabel('Inclination') },
      { label: 'Azimuth', value: azimuth.toFixed(2), unit: 'deg', status: getStatusForLabel('Azimuth') },
      { label: 'Dip Angle', value: (inclination * 1.78).toFixed(1), unit: 'deg', placeholder: true },
      { label: 'G Total', value: (1 + Math.abs(gravity - (toolfaceData.targetAngle ?? 180)) / 1000).toFixed(4), unit: 'g', placeholder: true },
      { label: 'Magnetic Field', value: (58 + azimuth / 1000).toFixed(4), unit: 'uT', placeholder: true },
      { label: 'Gas Avg', value: (gamma * 0.73).toFixed(1), unit: 'unit', placeholder: true },
      { label: 'Gamma', value: gamma.toFixed(0), unit: 'API', status: getStatusForLabel('Gamma') },
      { label: 'Confidence', value: `${Math.max(82, 98 - activeAlarms.length * 4).toFixed(0)}%`, unit: '', placeholder: true },
      { label: 'WOB', value: wob.toFixed(1), unit: kpiData.wob.unit, status: getStatusForLabel('WOB') },
      { label: 'Gamma Depth', value: (currentDepth + 300.98).toFixed(2), unit: 'm', placeholder: true },
      { label: 'Pulse Amp', value: (flowRate / 190).toFixed(2), unit: 'amp', placeholder: true },
      { label: 'Gas', value: (gamma * 0.73).toFixed(1), unit: 'unit', placeholder: true },
      { label: 'Bit Depth', value: (currentDepth - 7.02).toFixed(2), unit: 'm', placeholder: true },
      { label: 'Decoder Pressure', value: (standpipePressure * 0.92).toFixed(1), unit: 'psi', status: getStatusForLabel('Decoder Pressure'), placeholder: true },
      { label: 'Pumps Up', value: flowRate > 0 ? 'Yes' : 'No', unit: '', placeholder: true },
      { label: 'Hole Depth', value: currentDepth.toFixed(2), unit: 'm' },
      { label: 'Pump Pressure', value: standpipePressure.toFixed(1), unit: 'psi', status: getStatusForLabel('Pump Pressure') },
      { label: 'Pumps Down', value: flowRate < 50 ? 'Yes' : 'No', unit: '', placeholder: true },
      { label: 'ROP', value: rop.toFixed(2), unit: kpiData.rop.unit, status: getStatusForLabel('ROP') },
      { label: 'Gravity', value: gravity.toFixed(1), unit: 'deg' },
      { label: 'Mud Weight', value: mudWeight.toFixed(2), unit: kpiData.mudWeight.unit, status: getStatusForLabel('Mud Weight') },
      { label: 'Temp', value: temperature.toFixed(1), unit: kpiData.temperature.unit, status: getStatusForLabel('Temp') },
      { label: 'RPM', value: rpm.toFixed(0), unit: kpiData.rpm.unit, status: getStatusForLabel('RPM') },
      { label: 'Decoder Pressure', value: (standpipePressure * 0.92).toFixed(1), unit: 'psi', status: getStatusForLabel('Decoder Pressure'), placeholder: true },
      { label: 'Vib (ax.lat)', value: (2.4 + rpm / 85).toFixed(2), unit: 'g', placeholder: true },
      { label: 'RPM Downhole', value: (rpm - 6.5).toFixed(1), unit: 'rpm', status: getStatusForLabel('RPM Downhole'), placeholder: true },
      { label: 'SSI', value: (0.82 + gamma / 260).toFixed(2), unit: '', placeholder: true },
      { label: 'Diff Pressure', value: (standpipePressure * 0.18).toFixed(1), unit: 'psi', status: getStatusForLabel('Diff Pressure'), placeholder: true },
      { label: 'ECD TVD Survey Base', value: (mudWeight + 0.34).toFixed(2), unit: 'ppg', status: getStatusForLabel('ECD TVD Survey Base'), placeholder: true },
      { label: 'TVD', value: (currentDepth * 0.956).toFixed(2), unit: 'm', placeholder: true },
    ];
  }, [activeAlarms.length, activeWell?.activeJob?.currentDepth, kpiData, toolfaceData.angle, toolfaceData.targetAngle]);

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
      dashboardViewport === 'mobile' ? 8 : dashboardViewport === 'tablet' ? 12 : 22;
    const nextPageSize =
      dashboardViewport === 'mobile' ? 8 : dashboardViewport === 'tablet' ? 12 : 22;

    pages.push(keyParameters.slice(0, firstPageSize));

    for (let start = firstPageSize; start < keyParameters.length; start += nextPageSize) {
      pages.push(keyParameters.slice(start, start + nextPageSize));
    }

    return pages;
  }, [dashboardViewport, keyParameters]);

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
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">Real-time Dashboard</h1>
            <p className="text-muted-foreground">
              {activeWell?.name} - {activeWell?.activeJob?.name}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit max-w-full text-xs sm:text-sm">
            <TrendingUp className="mr-1 size-4" />
            Depth: {activeWell?.activeJob?.currentDepth.toFixed(1)} / {activeWell?.activeJob?.targetDepth} m
          </Badge>
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
          'grid gap-3',
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
                <h3 className="text-sm font-semibold">Key Parameters</h3>
                <Badge variant="outline" className="text-[10px]">
                  Polaris-style
                </Badge>
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
                      'min-w-0 rounded-xl border px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2',
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">Well Plot Overview</h2>
                <p className="text-sm text-muted-foreground">
                  All priority well plot tracks stay visible on the main dashboard without being compressed.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] sm:text-xs">4 tracks visible</Badge>
            </div>
            <div className="hidden min-[1280px]:block">
              <WellPlotPanel
                showHeader={false}
                showAllTracks
                dashboardStretch
                allTracksMinWidth={denseTabletDesktopLayout ? 680 : 860}
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
