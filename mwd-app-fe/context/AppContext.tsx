'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ConnectionState, 
  Well, 
  KPIData, 
  Event, 
  ChartDataPoint,
  UserSettings,
  ToolfaceData
} from '../types';
import { mockWells, mockKPIData, mockEvents, generateMockChartData, mockToolfaceData } from '../data/mock-data';
import { mockPlotConfigurations } from '@/data/plotting-data';
import { useAuth } from '@/context/AuthContext';
import {
  buildDefaultDashboardThresholds,
  getDashboardThresholdStatus,
  mergeDashboardThresholds,
} from '@/lib/dashboard-thresholds';
import {
  filterMwdDataForSession,
  getLatestMwdDataRecord,
  getMwdData,
  MwdDataRecord,
  mwdDataRecordsToChartData,
} from '@/lib/mwd-data-api';
import { getMwdSessions, MwdSessionListItem } from '@/lib/mwd-sessions-api';
import { PlotConfiguration } from '@/types/plotting';
import {
  getDefaultPlotTemplate,
  getPlotTemplates,
} from '@/lib/plot-templates-api';
import {
  acknowledgeWitsAlarm,
  getWitsAlarms,
  getLatestConfiguredWitsDataValues,
  resolveWitsAlarm,
  WitsDataValue,
} from '@/lib/api/wits';
import {
  connectionStatusToState,
  failoverRecordToEvent,
  getCurrentConnectionStatus,
  getFailoverEvents,
} from '@/lib/connection-api';

interface AppContextType {
  connectionState: ConnectionState;
  reconnect: () => void;
  connectionStatusLoading: boolean;
  connectionStatusError: string;
  refreshConnectionStatus: () => Promise<void>;
  failoverEventsLoading: boolean;
  failoverEventsError: string;
  refreshFailoverEvents: () => Promise<void>;
  wells: Well[];
  activeWell: Well | null;
  setActiveWell: (well: Well) => void;
  mwdSessions: MwdSessionListItem[];
  activeMwdSession: MwdSessionListItem | null;
  activeMwdSessionId: string;
  setActiveMwdSessionId: React.Dispatch<React.SetStateAction<string>>;
  mwdSessionsLoading: boolean;
  mwdSessionsError: string;
  refreshMwdSessions: () => Promise<void>;
  kpiData: KPIData;
  chartData: ChartDataPoint[];
  mwdDataLoading: boolean;
  mwdDataError: string;
  refreshMwdData: () => Promise<void>;
  witsDataValuesLoading: boolean;
  witsDataValuesError: string;
  refreshWitsDataValues: () => Promise<void>;
  witsAlarmsLoading: boolean;
  witsAlarmsError: string;
  refreshWitsAlarms: () => Promise<void>;
  events: Event[];
  toolfaceData: ToolfaceData;
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => void;
  acknowledgeAlarm: (eventId: string, note?: string) => void;
  resolveAlarm: (eventId: string) => void;
  muteAlarms: (minutes: number) => void;
  alarmsMuted: boolean;
  showInstallPrompt: boolean;
  dismissInstallPrompt: () => void;
  updateAvailable: boolean;
  dismissUpdatePrompt: () => void;
  plotConfigurations: PlotConfiguration[];
  setPlotConfigurations: React.Dispatch<React.SetStateAction<PlotConfiguration[]>>;
  activePlotConfigId: string;
  setActivePlotConfigId: React.Dispatch<React.SetStateAction<string>>;
  activePlotConfig: PlotConfiguration | null;
  plotTemplatesLoading: boolean;
  plotTemplatesError: string;
  refreshPlotTemplates: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultSettings: UserSettings = {
  thresholds: buildDefaultDashboardThresholds(),
  display: {
    density: 'comfortable',
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 5,
  },
  units: 'metric',
  favoriteParameters: ['rop', 'wob', 'inc', 'azi'],
};

const plotConfigurationsStorageKey = 'mwd_plot_configurations';
const activePlotConfigStorageKey = 'mwd_active_plot_config_id';
const activeMwdSessionStorageKey = 'mwd_active_session_id';
const dashboardMetricToKpiKey: Partial<Record<string, keyof KPIData>> = {
  rop: 'rop',
  wob: 'wob',
  rpm: 'rpm',
  flowrate: 'flowRate',
  spp: 'standpipePressure',
  mudWeight: 'mudWeight',
  inc: 'inclination',
  azi: 'azimuth',
  gamma: 'gamma',
  temp: 'temperature',
};
const witsDataValueToMetricKey: Record<string, keyof KPIData | 'currentDepth'> = {
  "0110": 'currentDepth',
  "0113": 'rop',
  "0121": 'standpipePressure',
  "0130": 'flowRate',
  "0713": 'inclination',
  "0714": 'azimuth',
  "0824": 'gamma',
  "0836": 'temperature',
};
const mappedFieldToMetricKey: Record<string, keyof KPIData | 'currentDepth'> = {
  depth: 'currentDepth',
  depthMd: 'currentDepth',
  measuredDepth: 'currentDepth',
  bitDepth: 'currentDepth',
  holeDepth: 'currentDepth',
  hole_depth: 'currentDepth',
  rop: 'rop',
  rateOfPenetration: 'rop',
  wob: 'wob',
  weightOnBit: 'wob',
  rpm: 'rpm',
  rotarySpeed: 'rpm',
  flowRate: 'flowRate',
  standpipePressure: 'standpipePressure',
  standpipe_pressure: 'standpipePressure',
  pumpPressure: 'standpipePressure',
  pressure: 'standpipePressure',
  mudWeight: 'mudWeight',
  inclination: 'inclination',
  inc: 'inclination',
  azimuth: 'azimuth',
  azi: 'azimuth',
  gamma: 'gamma',
  gammaRay: 'gamma',
  gamma_ray: 'gamma',
  temperature: 'temperature',
  temp: 'temperature',
};

function dedupePlotConfigurations(configs: PlotConfiguration[]) {
  const seen = new Set<string>();
  const result: PlotConfiguration[] = [];

  for (const config of configs) {
    if (!config.id || seen.has(config.id)) continue;
    seen.add(config.id);
    result.push(config);
  }

  return result;
}

function normalizeAngle(value: number) {
  return ((value % 360) + 360) % 360;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated, user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'connected',
    latency: 45,
    packetLoss: 0.2,
    lastReceived: new Date(),
    dataSource: 'primary'
  });
  const [connectionStatusLoading, setConnectionStatusLoading] = useState(false);
  const [connectionStatusError, setConnectionStatusError] = useState('');
  const [backendConnectionStatusActive, setBackendConnectionStatusActive] = useState(false);
  const [failoverEventsLoading, setFailoverEventsLoading] = useState(false);
  const [failoverEventsError, setFailoverEventsError] = useState('');
  const [failoverEventIds, setFailoverEventIds] = useState<Set<string>>(() => new Set());
  const connectionStatusRequestInFlight = useRef(false);
  const failoverEventsRequestInFlight = useRef(false);

  const [wells] = useState<Well[]>(mockWells);
  const [activeWell, setActiveWell] = useState<Well | null>(mockWells[0]);
  const [mwdSessions, setMwdSessions] = useState<MwdSessionListItem[]>([]);
  const [activeMwdSessionId, setActiveMwdSessionId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(activeMwdSessionStorageKey) ?? '';
  });
  const [mwdSessionsLoading, setMwdSessionsLoading] = useState(false);
  const [mwdSessionsError, setMwdSessionsError] = useState('');
  const [kpiData, setKpiData] = useState<KPIData>(mockKPIData);
  const [chartData, setChartData] = useState<ChartDataPoint[]>(generateMockChartData(1));
  const [mwdDataLoading, setMwdDataLoading] = useState(false);
  const [mwdDataError, setMwdDataError] = useState('');
  const [witsDataValuesLoading, setWitsDataValuesLoading] = useState(false);
  const [witsDataValuesError, setWitsDataValuesError] = useState('');
  const [witsAlarmsLoading, setWitsAlarmsLoading] = useState(false);
  const [witsAlarmsError, setWitsAlarmsError] = useState('');
  const [witsAlarmIds, setWitsAlarmIds] = useState<Set<string>>(() => new Set());
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [toolfaceData, setToolfaceData] = useState<ToolfaceData>(mockToolfaceData);
  const [alarmsMuted, setAlarmsMuted] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [plotConfigurations, setPlotConfigurations] = useState<PlotConfiguration[]>(() => {
    if (typeof window === 'undefined') return mockPlotConfigurations;
    const stored = window.localStorage.getItem(plotConfigurationsStorageKey);
    if (!stored) return mockPlotConfigurations;

    try {
      const parsed = JSON.parse(stored) as PlotConfiguration[];
      const deduped = Array.isArray(parsed) ? dedupePlotConfigurations(parsed) : [];
      return deduped.length > 0 ? deduped : mockPlotConfigurations;
    } catch {
      return mockPlotConfigurations;
    }
  });
  const [activePlotConfigId, setActivePlotConfigId] = useState(() => {
    if (typeof window === 'undefined') return mockPlotConfigurations[0]?.id ?? '';
    return window.localStorage.getItem(activePlotConfigStorageKey) ?? mockPlotConfigurations[0]?.id ?? '';
  });
  const [plotTemplatesLoading, setPlotTemplatesLoading] = useState(false);
  const [plotTemplatesError, setPlotTemplatesError] = useState('');

  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    const stored = window.localStorage.getItem('mwd_settings');
    if (!stored) return defaultSettings;

    try {
      const parsed = JSON.parse(stored) as UserSettings;
      return {
        ...defaultSettings,
        ...parsed,
        display: { ...defaultSettings.display, ...parsed.display },
        thresholds: mergeDashboardThresholds(parsed.thresholds ?? []),
      };
    } catch {
      return defaultSettings;
    }
  });

  const activePlotConfig = useMemo(
    () => {
      const sessionConfigs = activeMwdSessionId
        ? plotConfigurations.filter((config) => config.sessionId === activeMwdSessionId)
        : [];
      const globalConfigs = plotConfigurations.filter((config) => !config.sessionId);
      const scopedConfigs = sessionConfigs.length > 0 ? sessionConfigs : globalConfigs;

      return (
        scopedConfigs.find((config) => config.id === activePlotConfigId) ??
        scopedConfigs.find((config) => config.isDefault) ??
        scopedConfigs[0] ??
        plotConfigurations.find((config) => config.id === activePlotConfigId) ??
        plotConfigurations.find((config) => config.isDefault) ??
        plotConfigurations[0] ??
        null
      );
    },
    [activeMwdSessionId, activePlotConfigId, plotConfigurations]
  );

  const activeMwdSession = useMemo(
    () =>
      mwdSessions.find((session) => session.id === activeMwdSessionId) ??
      mwdSessions[0] ??
      null,
    [activeMwdSessionId, mwdSessions]
  );

  const refreshMwdSessions = useCallback(async () => {
    if (!token) {
      setMwdSessions([]);
      setMwdSessionsError('');
      return;
    }

    setMwdSessionsLoading(true);
    setMwdSessionsError('');

    try {
      const sessions = await getMwdSessions(token);
      setMwdSessions(sessions);
      setActiveMwdSessionId((current) => {
        if (current && sessions.some((session) => session.id === current)) {
          return current;
        }

        return sessions[0]?.id ?? '';
      });
    } catch (error) {
      setMwdSessions([]);
      setMwdSessionsError(error instanceof Error ? error.message : 'Unable to load MWD sessions.');
    } finally {
      setMwdSessionsLoading(false);
    }
  }, [token]);

  const refreshPlotTemplates = useCallback(async () => {
    if (!token) {
      setPlotTemplatesError('');
      return;
    }

    setPlotTemplatesLoading(true);
    setPlotTemplatesError('');

    try {
      let listError: unknown = null;
      let defaultBackendConfig: PlotConfiguration | null = null;
      let backendConfigs: PlotConfiguration[] = [];

      try {
        const defaultTemplate = await getDefaultPlotTemplate(token);
        if (defaultTemplate.plotConfig) {
          defaultBackendConfig = defaultTemplate.plotConfig;
        }
      } catch (error) {
        listError = error;
      }

      try {
        const templates = await getPlotTemplates(token);
        const listConfigs = templates
          .map((template) => template.plotConfig)
          .filter((config): config is PlotConfiguration => Boolean(config));

        backendConfigs = defaultBackendConfig
          ? [
              defaultBackendConfig,
              ...listConfigs.filter((config) => config.id !== defaultBackendConfig?.id),
            ]
          : listConfigs;
      } catch (error) {
        if (!listError) {
          listError = error;
        }
      }

      if (backendConfigs.length === 0) {
        if (defaultBackendConfig) {
          backendConfigs = [defaultBackendConfig];
        } else if (listError) {
          throw listError;
        }
      }

      if (backendConfigs.length === 0) {
        setPlotTemplatesError(
          'Plot template endpoint returned metadata only. Full plotting config mapping needs clarification.'
        );
        return;
      }

      setPlotConfigurations((current) => {
        const backendIds = new Set(backendConfigs.map((config) => config.id));
        const mockIds = new Set(mockPlotConfigurations.map((config) => config.id));
        const localOnlyConfigs = current.filter(
          (config) => !backendIds.has(config.id) && !mockIds.has(config.id)
        );
        const nextConfigs = dedupePlotConfigurations([...backendConfigs, ...localOnlyConfigs]);
        const sessionBackendConfigs = activeMwdSessionId
          ? backendConfigs.filter((config) => config.sessionId === activeMwdSessionId)
          : [];
        const preferredBackendConfig =
          sessionBackendConfigs.find((config) => config.isDefault) ??
          sessionBackendConfigs[0] ??
          defaultBackendConfig ??
          backendConfigs.find((config) => config.isDefault) ??
          backendConfigs[0];

        setActivePlotConfigId((currentActiveId) => {
          const currentBackendConfig = backendConfigs.find((config) => config.id === currentActiveId);

          if (
            currentBackendConfig &&
            sessionBackendConfigs.length > 0 &&
            currentBackendConfig.sessionId === activeMwdSessionId
          ) {
            return currentActiveId;
          }

          return (
            preferredBackendConfig?.id ??
            nextConfigs.find((config) => config.isDefault)?.id ??
            nextConfigs[0]?.id ??
            currentActiveId
          );
        });

        return nextConfigs;
      });
    } catch (error) {
      setPlotTemplatesError(error instanceof Error ? error.message : 'Unable to load plot templates.');
    } finally {
      setPlotTemplatesLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const applyLatestMwdRecord = useCallback((record: MwdDataRecord) => {
    setKpiData((current) => {
      let changed = false;
      const next = { ...current };

      const metricEntries = Object.entries(dashboardMetricToKpiKey) as Array<[string, keyof KPIData]>;

      for (const [metricKey, kpiKey] of metricEntries) {
        const value = record.metrics[metricKey];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;

        const currentParameter = current[kpiKey];
        const threshold = settings.thresholds.find(
          (item) =>
            item.parameter === metricKey ||
            item.parameter === currentParameter.id ||
            item.parameter === kpiKey
        );

        next[kpiKey] = {
          ...currentParameter,
          value,
          change1min: value - currentParameter.value,
          status: getDashboardThresholdStatus(value, threshold),
        };
        changed = true;
      }

      return changed ? next : current;
    });

    if (typeof record.depth === 'number' && Number.isFinite(record.depth)) {
      const currentDepth = record.depth;
      setActiveWell((current) => {
        if (!current?.activeJob) return current;

        return {
          ...current,
          activeJob: {
            ...current.activeJob,
            currentDepth,
          },
        };
      });
    }

    const toolfaceAngle =
      record.metrics.toolface ?? record.metrics.gtf ?? record.metrics.mtf;
    if (typeof toolfaceAngle === 'number' && Number.isFinite(toolfaceAngle)) {
      setToolfaceData((current) => ({
        ...current,
        angle: normalizeAngle(toolfaceAngle),
        type: record.metrics.mtf !== undefined ? 'MTF' : current.type,
      }));
    }
  }, [settings.thresholds]);

  const applyWitsDataValues = useCallback((values: WitsDataValue[]) => {
    setKpiData((current) => {
      let changed = false;
      const next = { ...current };

      for (const item of values) {
        const target =
          (item.mappedField ? mappedFieldToMetricKey[item.mappedField] : undefined) ??
          witsDataValueToMetricKey[item.witsId];
        if (!target || target === 'currentDepth') continue;

        const currentParameter = current[target];
        const threshold = settings.thresholds.find(
          (thresholdItem) =>
            thresholdItem.parameter === item.witsId ||
            thresholdItem.parameter === currentParameter.id ||
            thresholdItem.parameter === target
        );

        next[target] = {
          ...currentParameter,
          value: item.value,
          unit: item.unit || currentParameter.unit,
          change1min: item.value - currentParameter.value,
          status: getDashboardThresholdStatus(item.value, threshold),
        };
        changed = true;
      }

      return changed ? next : current;
    });

    const depthValue = values.find((item) => {
      const target =
        (item.mappedField ? mappedFieldToMetricKey[item.mappedField] : undefined) ??
        witsDataValueToMetricKey[item.witsId];
      return target === 'currentDepth';
    });
    if (depthValue) {
      setActiveWell((current) => {
        if (!current?.activeJob) return current;

        return {
          ...current,
          activeJob: {
            ...current.activeJob,
            currentDepth: depthValue.value,
          },
        };
      });
    }

    const latestTimestamp = values
      .map((item) => item.timestamp)
      .filter((timestamp): timestamp is Date => Boolean(timestamp))
      .sort((left, right) => right.getTime() - left.getTime())[0];

    if (latestTimestamp) {
      setConnectionState((current) => ({
        ...current,
        lastReceived: latestTimestamp,
      }));
    }
  }, [settings.thresholds]);

  const refreshWitsDataValues = useCallback(async () => {
    if (!token) {
      setWitsDataValuesError('');
      return;
    }

    setWitsDataValuesLoading(true);
    setWitsDataValuesError('');

    try {
      const values = await getLatestConfiguredWitsDataValues(token, {
        sessionId: activeMwdSessionId || undefined,
      });
      applyWitsDataValues(values);
    } catch (error) {
      setWitsDataValuesError(
        error instanceof Error ? error.message : 'Unable to load WITS data values.'
      );
    } finally {
      setWitsDataValuesLoading(false);
    }
  }, [activeMwdSessionId, applyWitsDataValues, token]);

  const refreshWitsAlarms = useCallback(async () => {
    if (!token) {
      setWitsAlarmsError('');
      setWitsAlarmIds(new Set());
      return;
    }

    setWitsAlarmsLoading(true);
    setWitsAlarmsError('');

    try {
      const alarms = await getWitsAlarms(token, {
        sessionId: activeMwdSessionId || undefined,
      });
      const nextAlarmIds = new Set(alarms.map((alarm) => alarm.id));
      setWitsAlarmIds((previousAlarmIds) => {
        setEvents((current) => [
          ...alarms,
          ...current.filter((event) => !previousAlarmIds.has(event.id) && !nextAlarmIds.has(event.id)),
        ]);
        return nextAlarmIds;
      });
    } catch (error) {
      setWitsAlarmsError(error instanceof Error ? error.message : 'Unable to load WITS alarms.');
    } finally {
      setWitsAlarmsLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const refreshConnectionStatus = useCallback(async () => {
    if (!token) {
      setConnectionStatusError('');
      setBackendConnectionStatusActive(false);
      return;
    }
    if (connectionStatusRequestInFlight.current) return;

    connectionStatusRequestInFlight.current = true;
    setConnectionStatusLoading(true);
    setConnectionStatusError('');

    try {
      const status = await getCurrentConnectionStatus(token, {
        sessionId: activeMwdSessionId || undefined,
        limit: 10,
      });

      if (status) {
        setConnectionState((current) => ({
          ...current,
          ...connectionStatusToState(status),
          reconnecting: current.reconnecting,
        }));
        setBackendConnectionStatusActive(true);
      }
    } catch (error) {
      setConnectionStatusError(
        error instanceof Error ? error.message : 'Unable to load connection status.'
      );
    } finally {
      connectionStatusRequestInFlight.current = false;
      setConnectionStatusLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const refreshFailoverEvents = useCallback(async () => {
    if (!token) {
      setFailoverEventsError('');
      setFailoverEventIds(new Set());
      return;
    }
    if (failoverEventsRequestInFlight.current) return;

    failoverEventsRequestInFlight.current = true;
    setFailoverEventsLoading(true);
    setFailoverEventsError('');

    try {
      const records = await getFailoverEvents(token, {
        sessionId: activeMwdSessionId || undefined,
        limit: 25,
      });
      const backendEvents = records.map(failoverRecordToEvent);
      const nextEventIds = new Set(backendEvents.map((event) => event.id));

      setFailoverEventIds((previousEventIds) => {
        setEvents((current) => [
          ...backendEvents,
          ...current.filter((event) => !previousEventIds.has(event.id) && !nextEventIds.has(event.id)),
        ]);
        return nextEventIds;
      });
    } catch (error) {
      setFailoverEventsError(
        error instanceof Error ? error.message : 'Unable to load failover events.'
      );
    } finally {
      failoverEventsRequestInFlight.current = false;
      setFailoverEventsLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const refreshMwdData = useCallback(async () => {
    if (!token) {
      setMwdDataError('');
      return;
    }

    setMwdDataLoading(true);
    setMwdDataError('');

    try {
      const records = await getMwdData(token, {
        sessionId: activeMwdSessionId || undefined,
      });
      const scopedRecords = filterMwdDataForSession(records, activeMwdSessionId);
      const nextChartData = mwdDataRecordsToChartData(scopedRecords);
      const latestRecord = getLatestMwdDataRecord(scopedRecords);

      if (nextChartData.length > 0) {
        setChartData(nextChartData);
      }

      if (latestRecord) {
        applyLatestMwdRecord(latestRecord);
        setConnectionState((current) => ({
          ...current,
          lastReceived: latestRecord.timestamp,
        }));
      }
    } catch (error) {
      setMwdDataError(error instanceof Error ? error.message : 'Unable to load MWD data.');
    } finally {
      setMwdDataLoading(false);
    }
  }, [activeMwdSessionId, applyLatestMwdRecord, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setMwdSessions([]);
      setMwdSessionsError('');
      setActiveMwdSessionId('');
      return;
    }

    void refreshMwdSessions();
  }, [isAuthenticated, refreshMwdSessions, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setPlotTemplatesError('');
      return;
    }

    void refreshPlotTemplates();
  }, [isAuthenticated, refreshPlotTemplates, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setMwdDataError('');
      return;
    }

    void refreshMwdData();
  }, [isAuthenticated, refreshMwdData, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setWitsDataValuesError('');
      setWitsAlarmsError('');
      return;
    }

    void refreshWitsDataValues();
    void refreshWitsAlarms();
  }, [isAuthenticated, refreshWitsAlarms, refreshWitsDataValues, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setConnectionStatusError('');
      setFailoverEventsError('');
      setBackendConnectionStatusActive(false);
      setFailoverEventIds(new Set());
      return;
    }

    void refreshConnectionStatus();
    void refreshFailoverEvents();
  }, [isAuthenticated, refreshConnectionStatus, refreshFailoverEvents, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !settings.display.autoRefresh) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshConnectionStatus();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated, refreshConnectionStatus, settings.display.autoRefresh, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !settings.display.autoRefresh) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshFailoverEvents();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated, refreshFailoverEvents, settings.display.autoRefresh, token]);

  useEffect(() => {
    if (!activeMwdSession || activeMwdSession.id === activeMwdSessionId) return;
    setActiveMwdSessionId(activeMwdSession.id);
  }, [activeMwdSession, activeMwdSessionId]);

  useEffect(() => {
    if (!activePlotConfig) return;
    if (activePlotConfig.id !== activePlotConfigId) {
      setActivePlotConfigId(activePlotConfig.id);
    }
  }, [activePlotConfig, activePlotConfigId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(plotConfigurationsStorageKey, JSON.stringify(dedupePlotConfigurations(plotConfigurations)));
  }, [plotConfigurations]);

  useEffect(() => {
    if (typeof window === 'undefined' || !activePlotConfigId) return;
    window.localStorage.setItem(activePlotConfigStorageKey, activePlotConfigId);
  }, [activePlotConfigId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (activeMwdSessionId) {
      window.localStorage.setItem(activeMwdSessionStorageKey, activeMwdSessionId);
      return;
    }

    window.localStorage.removeItem(activeMwdSessionStorageKey);
  }, [activeMwdSessionId]);

  // Simulate real-time data updates
  useEffect(() => {
    if (connectionState.status === 'offline') return;
    if (!settings.display.autoRefresh) return;

    const interval = setInterval(() => {
      // Update KPI values
      setKpiData(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const param = updated[key as keyof KPIData];
          const threshold = settings.thresholds.find(
            (item) => item.parameter === key || item.parameter === param.id
          );
          const variation = (Math.random() - 0.5) * 2;
          param.value = Math.max(0, param.value + variation);
          param.change1min = variation;
          param.warningThreshold = threshold?.high ?? threshold?.warning ?? param.warningThreshold;
          param.criticalThreshold = threshold?.high ?? threshold?.critical ?? param.criticalThreshold;
          param.status = getDashboardThresholdStatus(param.value, threshold);
        });
        return updated;
      });

      // Update toolface with smooth animation
      setToolfaceData(prev => ({
        ...prev,
        angle: (prev.angle + (Math.random() - 0.5) * 2 + 360) % 360,
        operationTimer: prev.operationTimer + 5
      }));

      if (!backendConnectionStatusActive) {
        setConnectionState(prev => ({
          ...prev,
          lastReceived: new Date(),
          latency: 40 + Math.random() * 20,
          packetLoss: Math.random() * 0.5
        }));
      }

      // Add new chart data point
      setChartData(prev => {
        const newPoint: ChartDataPoint = {
          timestamp: new Date(),
          rop: kpiData.rop.value,
          wob: kpiData.wob.value,
          rpm: kpiData.rpm.value,
          temp: kpiData.temperature.value,
          spp: kpiData.standpipePressure.value,
          flowrate: kpiData.flowRate.value,
          gamma: kpiData.gamma.value,
          inc: kpiData.inclination.value,
          azi: kpiData.azimuth.value
        };
        
        const updated = [...prev, newPoint];
        if (updated.length > 60) {
          updated.shift();
        }
        return updated;
      });
    }, settings.display.refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [
    connectionState.status,
    backendConnectionStatusActive,
    kpiData,
    settings.display.autoRefresh,
    settings.display.refreshInterval,
    settings.thresholds,
  ]);

  // Simulate occasional connection issues
  useEffect(() => {
    if (backendConnectionStatusActive) return;

    const randomEvents = setInterval(() => {
      const rand = Math.random();
      
      if (rand > 0.95) {
        setConnectionState(prev => ({
          ...prev,
          status: 'degraded',
          latency: 150 + Math.random() * 100,
          packetLoss: 2 + Math.random() * 3
        }));
        
        setTimeout(() => {
          setConnectionState(prev => ({
            ...prev,
            status: 'connected',
            latency: 45,
            packetLoss: 0.2
          }));
        }, 10000);
      }
    }, 30000);

    return () => clearInterval(randomEvents);
  }, [backendConnectionStatusActive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstallPrompt(true);
    }, 60000);

    return () => clearTimeout(timer);
  }, []);

  const reconnect = useCallback(() => {
    setConnectionState(prev => ({ ...prev, reconnecting: true }));
    
    setTimeout(() => {
      setConnectionState({
        status: 'connected',
        latency: 45,
        packetLoss: 0.2,
        lastReceived: new Date(),
        dataSource: 'primary',
        reconnecting: false
      });
    }, 2000);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== "undefined") {
        window.localStorage.setItem('mwd_settings', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const acknowledgeAlarm = useCallback((eventId: string, note?: string) => {
    const eventIsBackendWitsAlarm = witsAlarmIds.has(eventId);

    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? { 
            ...event, 
            acknowledgedBy: user?.username ?? user?.fullName ?? 'current_user',
            acknowledgedAt: new Date(),
            note 
          }
        : event
    ));

    if (token && eventIsBackendWitsAlarm) {
      void acknowledgeWitsAlarm(token, eventId, note).catch((error) => {
        setWitsAlarmsError(error instanceof Error ? error.message : 'Unable to acknowledge WITS alarm.');
      });
    }
  }, [token, user?.fullName, user?.username, witsAlarmIds]);

  const resolveAlarm = useCallback((eventId: string) => {
    const eventIsBackendWitsAlarm = witsAlarmIds.has(eventId);

    setEvents(prev => prev.map(event =>
      event.id === eventId
        ? {
            ...event,
            resolved: true,
          }
        : event
    ));

    if (token && eventIsBackendWitsAlarm) {
      void resolveWitsAlarm(token, eventId).catch((error) => {
        setWitsAlarmsError(error instanceof Error ? error.message : 'Unable to resolve WITS alarm.');
      });
    }
  }, [token, witsAlarmIds]);

  const muteAlarms = useCallback((minutes: number) => {
    setAlarmsMuted(true);
    setTimeout(() => {
      setAlarmsMuted(false);
    }, minutes * 60000);
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    setShowInstallPrompt(false);
  }, []);

  const dismissUpdatePrompt = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return (
    <AppContext.Provider value={{
      connectionState,
      reconnect,
      connectionStatusLoading,
      connectionStatusError,
      refreshConnectionStatus,
      failoverEventsLoading,
      failoverEventsError,
      refreshFailoverEvents,
      wells,
      activeWell,
      setActiveWell,
      mwdSessions,
      activeMwdSession,
      activeMwdSessionId,
      setActiveMwdSessionId,
      mwdSessionsLoading,
      mwdSessionsError,
      refreshMwdSessions,
      kpiData,
      chartData,
      mwdDataLoading,
      mwdDataError,
      refreshMwdData,
      witsDataValuesLoading,
      witsDataValuesError,
      refreshWitsDataValues,
      witsAlarmsLoading,
      witsAlarmsError,
      refreshWitsAlarms,
      events,
      toolfaceData,
      settings,
      updateSettings,
      acknowledgeAlarm,
      resolveAlarm,
      muteAlarms,
      alarmsMuted,
      showInstallPrompt,
      dismissInstallPrompt,
      updateAvailable,
      dismissUpdatePrompt,
      plotConfigurations,
      setPlotConfigurations,
      activePlotConfigId,
      setActivePlotConfigId,
      activePlotConfig,
      plotTemplatesLoading,
      plotTemplatesError,
      refreshPlotTemplates
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
