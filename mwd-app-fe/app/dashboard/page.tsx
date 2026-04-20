'use client';


import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { KPICard } from '@/components/kpi-card';
import { RealTimeChart } from '@/components/contents/charts/real-time-chart';
import { EventStream } from '@/components/event-stream';
import { ConnectionStatus } from '@/components/connection-status';
import { ToolfaceIndicator } from '@/components/toolface-indicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellOff, Check, AlertTriangle, TrendingUp, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    connectionState, 
    reconnect, 
    kpiData, 
    chartData, 
    events,
    activeWell,
    acknowledgeAlarm,
    muteAlarms,
    alarmsMuted,
    toolfaceData,
    settings
  } = useApp();

  const isDark = settings.display.theme === 'dark';

  const [timeWindow, setTimeWindow] = useState<'5min' | '15min' | '1hr'>('15min');

  const activeAlarms = events.filter(e => 
    e.type === 'alarm' && !e.acknowledgedBy && !e.resolved
  );

  const getSeverityTone = (count: number) => {
  if (count >= 3) return 'border-red-300 bg-red-50';
  if (count >= 1) return 'border-amber-300 bg-amber-50';
  return 'border-border bg-card';
};

const getPrimaryAlarmMessage = (activeAlarms: any[]) => {
  if (!activeAlarms.length) return 'No active alarms';
  const firstAlarm = activeAlarms[0];

  if (firstAlarm?.title) return firstAlarm.title;
  if (firstAlarm?.message) return firstAlarm.message;
  if (firstAlarm?.metric) return `${firstAlarm.metric} requires attention`;

  return 'Operational alarm requires attention';
};

  const handleAcknowledgeAll = () => {
    activeAlarms.forEach(alarm => {
      acknowledgeAlarm(alarm.id, 'Acknowledged from dashboard');
    });
    toast.success('All alarms acknowledged');
  };

  const handleMuteAlarms = () => {
    muteAlarms(15);
    toast.success('Alarms muted for 15 minutes');
  };

  const chartParameters = [
    { key: 'rop', label: 'ROP', color: '#10b981', unit: 'm/hr' },
    { key: 'wob', label: 'WOB', color: '#3b82f6', unit: 'klbs' },
    { key: 'rpm', label: 'RPM', color: '#8b5cf6', unit: 'rpm' },
    { key: 'spp', label: 'SPP', color: '#f59e0b', unit: 'psi' }
  ];

  const secondaryChartParameters = [
    { key: 'inc', label: 'Inclination', color: '#ec4899', unit: '°' },
    { key: 'azi', label: 'Azimuth', color: '#06b6d4', unit: '°' },
    { key: 'gamma', label: 'Gamma', color: '#84cc16', unit: 'API' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Real-time Dashboard</h1>
            <p className="text-muted-foreground">
              {activeWell?.name} - {activeWell?.activeJob?.name}
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            <TrendingUp className="size-4 mr-1" />
            Depth: {activeWell?.activeJob?.currentDepth.toFixed(1)} / {activeWell?.activeJob?.targetDepth} m
          </Badge>
        </div>
      </div>

      {/* Connection Status */}
      <ConnectionStatus 
        connectionState={connectionState}
        onReconnect={reconnect}
      />

      {/* Active Alarms Banner */}
      {activeAlarms.length > 0 && !alarmsMuted && (
        <section
          className={`rounded-2xl border p-4 shadow-sm ${
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
              <div
                className={`text-lg font-semibold ${
                  isDark ? 'text-slate-50' : 'text-slate-900'
                }`}
              >
                {getPrimaryAlarmMessage(activeAlarms)}
              </div>
              <p
                className={`text-sm ${
                  isDark ? 'text-slate-300' : 'text-muted-foreground'
                }`}
              >
                {activeAlarms.length} alarm{activeAlarms.length > 1 ? 's are' : ' is'} still
                active and unacknowledged. Review affected metrics before continuing
                normal monitoring.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleMuteAlarms}
                className={
                  isDark
                    ? 'border-white/15 bg-white/5 text-slate-100 hover:bg-white/10'
                    : undefined
                }
              >
                <BellOff className="mr-2 size-4" />
                Mute 15 min
              </Button>
              <Button
                size="sm"
                onClick={handleAcknowledgeAll}
                className={
                  isDark
                    ? 'bg-red-500 text-white hover:bg-red-400'
                    : undefined
                }
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
            isDark
              ? 'border-amber-500/50 bg-amber-950/45 text-amber-100'
              : 'border-amber-300 bg-amber-50'
          }`}
        >
          <BellOff className="size-4" />
          <AlertDescription className={isDark ? 'text-amber-100/90' : undefined}>
            Alarm notifications are muted temporarily. Visual monitoring remains active.
          </AlertDescription>
        </Alert>
      )}

      {/* Offline Mode Warning */}
      {connectionState.status === 'offline' && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <strong>Offline Mode:</strong> Displaying last known values. 
            Data may be outdated. Check your network connection.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Left: KPI Cards and Charts */}
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Key Parameters</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KPICard parameter={kpiData.rop} />
              <KPICard parameter={kpiData.wob} />
              <KPICard parameter={kpiData.rpm} />
              <KPICard parameter={kpiData.flowRate} />
              <KPICard parameter={kpiData.standpipePressure} />
              <KPICard parameter={kpiData.mudWeight} />
              <KPICard parameter={kpiData.inclination} />
              <KPICard parameter={kpiData.azimuth} />
              <KPICard parameter={kpiData.gamma} />
              <KPICard parameter={kpiData.temperature} />
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid lg:grid-cols-2 gap-6">
            <RealTimeChart
              data={chartData}
              title="Drilling Mechanics"
              availableParameters={chartParameters}
              defaultParameters={['rop', 'wob']}
              timeWindow={timeWindow}
              onTimeWindowChange={setTimeWindow}
            />
            <RealTimeChart
              data={chartData}
              title="Directional & Formation"
              availableParameters={secondaryChartParameters}
              defaultParameters={['inc', 'gamma']}
              timeWindow={timeWindow}
              onTimeWindowChange={setTimeWindow}
            />
          </div>
        </div>

        {/* Right: Toolface Indicator */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Toolface</h2>
          <ToolfaceIndicator 
            data={toolfaceData}
            size="md"
          />
          
          {/* Quick Directional Info */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Directional Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Inclination</span>
                <span className="font-mono">{kpiData.inclination.value.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Azimuth</span>
                <span className="font-mono">{kpiData.azimuth.value.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current MD</span>
                <span className="font-mono">{activeWell?.activeJob?.currentDepth.toFixed(1)} m</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Event Stream */}
      <EventStream events={events} maxHeight={300} />

      {/* Role-specific Quick Actions */}
      {user?.role === 'engineer' && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Engineer Quick Actions</h3>
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
