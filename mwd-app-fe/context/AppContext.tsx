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
import { useAuth } from '@/context/AuthContext';
import { ApiClientError } from '@/lib/api-client';
import {
  buildDefaultDashboardThresholds,
  buildDashboardThresholdsFromWitsConfig,
  getDashboardThresholdStatus,
  mergeDashboardThresholds,
} from '@/lib/dashboard-thresholds';
import {
  filterMwdDataForSession,
  getLatestMwdDataRecord,
  getMwdData,
  MwdDataRecord,
  mwdDataRecordsToChartData,
  normalizeMwdDataRecord,
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
  getWitsConfig,
  resolveWitsAlarm,
  WitsDataValue,
} from '@/lib/api/wits';
import { PolarisWitsId } from '@/types/polaris';
import {
  connectionStatusToState,
  failoverRecordToEvent,
  getCurrentConnectionStatus,
  getFailoverEvents,
} from '@/lib/connection-api';
import { getSerialStatus, type SerialStatus } from '@/lib/serial-api';
import { getEspWsStatus, type EspWsStatus } from '@/lib/esp-ws-api';
import {
  getRealtimeClient,
  type RealtimeConnectionState,
  type RealtimeEvent,
} from '@/lib/realtime-client';

interface AppContextType {
  connectionState: ConnectionState;
  reconnect: () => void;
  connectionStatusLoading: boolean;
  connectionStatusError: string;
  refreshConnectionStatus: () => Promise<void>;
  failoverEventsLoading: boolean;
  failoverEventsError: string;
  refreshFailoverEvents: () => Promise<void>;
  serialStatus: SerialStatus | null;
  serialStatusLoading: boolean;
  serialStatusError: string;
  refreshSerialStatus: () => Promise<void>;
  espWsStatus: EspWsStatus | null;
  espWsStatusLoading: boolean;
  espWsStatusError: string;
  refreshEspWsStatus: () => Promise<void>;
  realtimeStatus: RealtimeConnectionState;
  realtimeError: string;
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
  latestMwdDataRecord: MwdDataRecord | null;
  mwdDataLoading: boolean;
  mwdDataError: string;
  refreshMwdData: () => Promise<void>;
  witsDataValuesLoading: boolean;
  witsDataValuesError: string;
  refreshWitsDataValues: () => Promise<void>;
  witsConfig: PolarisWitsId[];
  witsConfigLoading: boolean;
  witsConfigError: string;
  refreshWitsConfig: () => Promise<void>;
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

const activePlotConfigStorageKey = 'mwd_active_plot_config_id';
const activeMwdSessionStorageKey = 'mwd_active_session_id';
const backendErrorMessage = 'Gagal memuat data dari backend.';
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
const emptyKpiDefinitions: KPIData = {
  rop: { id: 'rop', name: 'ROP', unit: 'm/hr', category: 'drilling' },
  wob: { id: 'wob', name: 'WOB', unit: 'klbs', category: 'drilling' },
  rpm: { id: 'rpm', name: 'RPM', unit: 'rpm', category: 'drilling' },
  flowRate: { id: 'flowRate', name: 'Flow Rate', unit: 'gpm', category: 'mud' },
  standpipePressure: { id: 'standpipePressure', name: 'Standpipe Pressure', unit: 'psi', category: 'mud' },
  mudWeight: { id: 'mudWeight', name: 'Mud Weight', unit: 'ppg', category: 'mud' },
  inclination: { id: 'inclination', name: 'Inclination', unit: 'deg', category: 'directional' },
  azimuth: { id: 'azimuth', name: 'Azimuth', unit: 'deg', category: 'directional' },
  gamma: { id: 'gamma', name: 'Gamma Ray', unit: 'API', category: 'formation' },
  temperature: { id: 'temperature', name: 'Temperature', unit: 'degC', category: 'tool' },
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

function isExpectedBackendConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('udevadm') ||
    message.includes('enoent')
  );
}

function logBackendError(label: string, error: unknown) {
  if (isExpectedBackendConnectivityError(error)) return;

  if (process.env.NODE_ENV === 'development') {
    console.error(label, error);
  }
}

function getMwdSessionsErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return 'Sesi login tidak valid. Silakan login ulang untuk memuat daftar job/session.';
    }

    if (error.status === 403) {
      return 'Role ini belum memiliki izin membaca daftar job/session dari backend.';
    }

    return `Gagal memuat daftar job/session. Backend mengembalikan status ${error.status}.`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return backendErrorMessage;
}

function getBackendStatusErrorMessage(source: string, error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return `${source} tidak dapat dimuat karena sesi login tidak valid.`;
    }

    if (error.status === 403) {
      return `${source} tidak dapat dimuat karena role ini belum memiliki izin read dari backend.`;
    }

    if (error.status === 404) {
      return `${source} endpoint belum tersedia di backend.`;
    }

    return `${source} gagal dimuat. Backend mengembalikan status ${error.status}.`;
  }

  if (isExpectedBackendConnectivityError(error)) {
    return `${source} tidak dapat dijangkau dari backend API.`;
  }

  return error instanceof Error && error.message ? error.message : backendErrorMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (normalized === 'true' || normalized === 'connected' || normalized === 'open') return true;
      if (normalized === 'false' || normalized === 'disconnected' || normalized === 'closed') return false;
    }
  }

  return undefined;
}

function readDate(record: Record<string, unknown>, keys: string[]) {
  const value = readString(record, keys);
  if (!value) return new Date();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getMwdRecordKey(record: MwdDataRecord) {
  if (record.id) return `id:${record.id}`;

  const timestamp = record.timestamp.toISOString();
  const depth = typeof record.depth === 'number' ? record.depth : '';
  return `time-depth:${timestamp}:${depth}`;
}

function normalizeRealtimeEspStatus(data: Record<string, unknown>): EspWsStatus {
  const signal = isRecord(data.signal) ? data.signal : {};
  const status =
    readString(data, ['status', 'state', 'connectionStatus', 'connection_status']) ??
    (readBoolean(data, ['connected', 'isConnected', 'is_connected']) ? 'connected' : 'disconnected');
  const lastError = readString(data, ['lastError', 'last_error', 'error']);

  return {
    connected: readBoolean(data, ['connected', 'isConnected', 'is_connected', 'status', 'state']) ?? status === 'connected',
    reconnecting: readBoolean(data, ['reconnecting', 'isReconnecting', 'is_reconnecting']),
    status,
    lastReceivedAt: readString(data, ['lastReceivedAt', 'last_received_at', 'lastReceived', 'last_received', 'updatedAt', 'updated_at']),
    lastError: lastError ?? null,
    clientCount: readNumber(data, ['clientCount', 'client_count', 'clients', 'connections']),
    message: readString(data, ['message', 'description', 'reason']) ?? lastError,
    lastRawMessage: readString(data, ['lastRawMessage', 'last_raw_message']),
    lastPayload: readString(data, ['lastPayload', 'last_payload', 'payload']),
    lastLine: readString(data, ['lastLine', 'last_line', 'line']),
    rawPacket: readString(data, ['rawPacket', 'raw_packet', 'packet', 'raw']),
    signal: {
      rssi: readNumber(signal, ['rssi']),
      snr: readNumber(signal, ['snr']),
      sequence: readString(signal, ['sequence', 'seq']),
      quality: readString(signal, ['quality']),
    },
    raw: data,
  };
}

function normalizeRealtimeConnectionEvent(data: Record<string, unknown>): Event {
  const source = readString(data, ['source', 'dataSource', 'data_source']);
  const status = readString(data, ['status', 'state']) ?? 'connected';
  const timestamp = readDate(data, ['createdAt', 'created_at', 'timestamp', 'time', 'updatedAt', 'updated_at']);
  const id = readString(data, ['id', '_id', 'eventId', 'event_id']) ?? `${source ?? 'connection'}-${status}-${timestamp.toISOString()}`;
  const normalizedStatus = status.toLowerCase();

  return {
    id: `connection-${id}`,
    timestamp,
    severity: normalizedStatus === 'error' || normalizedStatus === 'disconnected' ? 'critical' : normalizedStatus === 'reconnecting' ? 'warning' : 'info',
    type: 'connection',
    message: readString(data, ['description', 'message', 'summary']) ?? `Connection ${status}`,
    source: source?.toLowerCase().includes('backup') ? 'backup' : 'primary',
  };
}

function buildEmptyKpiData(): KPIData {
  return Object.fromEntries(
    Object.entries(emptyKpiDefinitions).map(([key, parameter]) => [
      key,
      {
        ...parameter,
        value: undefined,
        change1min: undefined,
        status: undefined,
        trend: undefined,
        warningThreshold: undefined,
        criticalThreshold: undefined,
      },
    ])
  ) as KPIData;
}

function resolveActiveMwdSessionId(currentSessionId: string, sessions: MwdSessionListItem[]) {
  if (currentSessionId && sessions.some((session) => session.id === currentSessionId)) {
    return currentSessionId;
  }

  return sessions[0]?.id ?? '';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated, user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'offline',
    latency: 0,
    packetLoss: 0,
    lastReceived: new Date(),
    dataSource: 'primary'
  });
  const [connectionStatusLoading, setConnectionStatusLoading] = useState(false);
  const [connectionStatusError, setConnectionStatusError] = useState('');
  const [backendConnectionStatusActive, setBackendConnectionStatusActive] = useState(false);
  const [failoverEventsLoading, setFailoverEventsLoading] = useState(false);
  const [failoverEventsError, setFailoverEventsError] = useState('');
  const [serialStatus, setSerialStatus] = useState<SerialStatus | null>(null);
  const [serialStatusLoading, setSerialStatusLoading] = useState(false);
  const [serialStatusError, setSerialStatusError] = useState('');
  const [espWsStatus, setEspWsStatus] = useState<EspWsStatus | null>(null);
  const [espWsStatusLoading, setEspWsStatusLoading] = useState(false);
  const [espWsStatusError, setEspWsStatusError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionState>('idle');
  const [realtimeError, setRealtimeError] = useState('');
  const [failoverEventIds, setFailoverEventIds] = useState<Set<string>>(() => new Set());
  const mwdRecordKeysRef = useRef<Set<string>>(new Set());
  const connectionStatusRequestInFlight = useRef(false);
  const failoverEventsRequestInFlight = useRef(false);
  const serialStatusRequestInFlight = useRef(false);
  const espWsStatusRequestInFlight = useRef(false);

  const [wells] = useState<Well[]>([]);
  const [activeWell, setActiveWell] = useState<Well | null>(null);
  const [mwdSessions, setMwdSessions] = useState<MwdSessionListItem[]>([]);
  const [activeMwdSessionId, setActiveMwdSessionId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(activeMwdSessionStorageKey) ?? '';
  });
  const [mwdSessionsLoading, setMwdSessionsLoading] = useState(false);
  const [mwdSessionsError, setMwdSessionsError] = useState('');
  const [kpiData, setKpiData] = useState<KPIData>(() => buildEmptyKpiData());
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [latestMwdDataRecord, setLatestMwdDataRecord] = useState<MwdDataRecord | null>(null);
  const [mwdDataLoading, setMwdDataLoading] = useState(false);
  const [mwdDataError, setMwdDataError] = useState('');
  const [witsDataValuesLoading, setWitsDataValuesLoading] = useState(false);
  const [witsDataValuesError, setWitsDataValuesError] = useState('');
  const [witsConfig, setWitsConfig] = useState<PolarisWitsId[]>([]);
  const [witsConfigLoading, setWitsConfigLoading] = useState(false);
  const [witsConfigError, setWitsConfigError] = useState('');
  const [witsAlarmsLoading, setWitsAlarmsLoading] = useState(false);
  const [witsAlarmsError, setWitsAlarmsError] = useState('');
  const [witsAlarmIds, setWitsAlarmIds] = useState<Set<string>>(() => new Set());
  const [events, setEvents] = useState<Event[]>([]);
  const [toolfaceData, setToolfaceData] = useState<ToolfaceData>({
    angle: 0,
    type: 'GTF',
    operationTimer: 0,
  });
  const [alarmsMuted, setAlarmsMuted] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [plotConfigurations, setPlotConfigurations] = useState<PlotConfiguration[]>([]);
  const [activePlotConfigId, setActivePlotConfigId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(activePlotConfigStorageKey) ?? '';
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
    () => mwdSessions.find((session) => session.id === activeMwdSessionId) ?? null,
    [activeMwdSessionId, mwdSessions]
  );
  const operationalThresholds = useMemo(
    () => buildDashboardThresholdsFromWitsConfig(witsConfig, settings.thresholds),
    [settings.thresholds, witsConfig]
  );
  const effectiveSettings = useMemo(
    () => ({
      ...settings,
      thresholds: operationalThresholds,
    }),
    [operationalThresholds, settings]
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
      const sessions = await getMwdSessions(token, { debugRole: user?.role });
      setMwdSessions(sessions);
      setActiveMwdSessionId((current) => {
        const nextActiveSessionId = resolveActiveMwdSessionId(current, sessions);

        if (process.env.NODE_ENV === 'development') {
          console.info('[MWD sessions] active session resolver', {
            role: user?.role ?? 'unknown',
            previousSessionId: current || null,
            nextSessionId: nextActiveSessionId || null,
            sessionCount: sessions.length,
            normalizedSessionIds: sessions.map((session) => session.id),
            preservedExisting: Boolean(current && current === nextActiveSessionId),
            resolution:
              nextActiveSessionId
                ? current === nextActiveSessionId
                  ? 'preserved-existing-session'
                  : 'selected-first-readable-session'
                : 'no-normalized-sessions-available',
          });
        }

        return nextActiveSessionId;
      });
    } catch (error) {
      logBackendError('Unable to load MWD sessions.', error);
      setMwdSessions([]);
      setActiveMwdSessionId('');
      setMwdSessionsError(getMwdSessionsErrorMessage(error));
    } finally {
      setMwdSessionsLoading(false);
    }
  }, [token, user?.role]);

  const refreshPlotTemplates = useCallback(async () => {
    if (!token) {
      setPlotConfigurations([]);
      setActivePlotConfigId('');
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
          ''
        );
        setPlotConfigurations([]);
        return;
      }

      setPlotConfigurations(() => {
        const nextConfigs = dedupePlotConfigurations(backendConfigs);
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
      logBackendError('Unable to load plot templates.', error);
      setPlotConfigurations([]);
      setPlotTemplatesError(backendErrorMessage);
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
        const threshold = operationalThresholds.find(
          (item) =>
            item.parameter === metricKey ||
            item.parameter === currentParameter.id ||
            item.parameter === kpiKey
        );

        next[kpiKey] = {
          ...currentParameter,
          value,
          change1min: typeof currentParameter.value === 'number' ? value - currentParameter.value : undefined,
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
  }, [operationalThresholds]);

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
        const threshold = operationalThresholds.find(
          (thresholdItem) =>
            thresholdItem.parameter === item.witsId ||
            thresholdItem.parameter === currentParameter.id ||
            thresholdItem.parameter === target
        );

        next[target] = {
          ...currentParameter,
          value: item.value,
          unit: item.unit || currentParameter.unit,
          change1min: typeof currentParameter.value === 'number' ? item.value - currentParameter.value : undefined,
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
  }, [operationalThresholds]);

  const refreshWitsDataValues = useCallback(async () => {
    if (!token || !activeMwdSessionId) {
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
      logBackendError('Unable to load WITS data values.', error);
      setWitsDataValuesError(backendErrorMessage);
    } finally {
      setWitsDataValuesLoading(false);
    }
  }, [activeMwdSessionId, applyWitsDataValues, token]);

  const refreshWitsConfig = useCallback(async () => {
    if (!token) {
      setWitsConfig([]);
      setWitsConfigError('');
      return;
    }

    setWitsConfigLoading(true);
    setWitsConfigError('');

    try {
      const configs = await getWitsConfig(token);
      setWitsConfig(configs);
    } catch (error) {
      logBackendError('Unable to load WITS config.', error);
      setWitsConfig([]);
      setWitsConfigError(backendErrorMessage);
    } finally {
      setWitsConfigLoading(false);
    }
  }, [token]);

  const refreshWitsAlarms = useCallback(async () => {
    if (!token || !activeMwdSessionId) {
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
      logBackendError('Unable to load WITS alarms.', error);
      setWitsAlarmsError(backendErrorMessage);
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
      } else {
        setBackendConnectionStatusActive(false);
      }
    } catch (error) {
      logBackendError('Unable to load connection status.', error);
      setConnectionStatusError(getBackendStatusErrorMessage('Connection status', error));
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
      logBackendError('Unable to load failover events.', error);
      setFailoverEventsError(getBackendStatusErrorMessage('Failover events', error));
    } finally {
      failoverEventsRequestInFlight.current = false;
      setFailoverEventsLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const refreshSerialStatus = useCallback(async () => {
    if (!token) {
      setSerialStatus(null);
      setSerialStatusError('');
      return;
    }
    if (serialStatusRequestInFlight.current) return;

    serialStatusRequestInFlight.current = true;
    setSerialStatusLoading(true);
    setSerialStatusError('');

    try {
      const status = await getSerialStatus(token);
      setSerialStatus(status);
    } catch (error) {
      logBackendError('Unable to load serial status.', error);
      setSerialStatus(null);
      setSerialStatusError(getBackendStatusErrorMessage('Serial status', error));
    } finally {
      serialStatusRequestInFlight.current = false;
      setSerialStatusLoading(false);
    }
  }, [token]);

  const refreshEspWsStatus = useCallback(async () => {
    if (!token) {
      setEspWsStatus(null);
      setEspWsStatusError('');
      return;
    }
    if (espWsStatusRequestInFlight.current) return;

    espWsStatusRequestInFlight.current = true;
    setEspWsStatusLoading(true);
    setEspWsStatusError('');

    try {
      const status = await getEspWsStatus(token);
      setEspWsStatus(status);
    } catch (error) {
      logBackendError('Unable to load ESP websocket status.', error);
      setEspWsStatus(null);
      setEspWsStatusError(getBackendStatusErrorMessage('ESP WS status', error));
    } finally {
      espWsStatusRequestInFlight.current = false;
      setEspWsStatusLoading(false);
    }
  }, [token]);

  const refreshMwdData = useCallback(async () => {
    if (!token || !activeMwdSessionId) {
      setChartData([]);
      setLatestMwdDataRecord(null);
      setMwdDataError('');
      return;
    }

    setMwdDataLoading(true);
    setMwdDataError('');

    try {
      const [latestRecords, records] = await Promise.all([
        getMwdData(token, {
          sessionId: activeMwdSessionId || undefined,
          limit: 1,
        }),
        getMwdData(token, {
          sessionId: activeMwdSessionId || undefined,
        }),
      ]);
      const latestScopedRecords = filterMwdDataForSession(latestRecords, activeMwdSessionId);
      const scopedRecords = filterMwdDataForSession(records, activeMwdSessionId);
      const nextChartData = mwdDataRecordsToChartData(scopedRecords);
      const latestRecord = getLatestMwdDataRecord(latestScopedRecords) ?? getLatestMwdDataRecord(scopedRecords);

      mwdRecordKeysRef.current = new Set(scopedRecords.map(getMwdRecordKey));
      setChartData(nextChartData);
      setLatestMwdDataRecord(latestRecord);

      if (latestRecord) {
        applyLatestMwdRecord(latestRecord);
        setConnectionState((current) => ({
          ...current,
          lastReceived: latestRecord.timestamp,
        }));
      } else {
        setKpiData(buildEmptyKpiData());
      }
    } catch (error) {
      logBackendError('Unable to load MWD data.', error);
      setChartData([]);
      setLatestMwdDataRecord(null);
      setMwdDataError(backendErrorMessage);
    } finally {
      setMwdDataLoading(false);
    }
  }, [activeMwdSessionId, applyLatestMwdRecord, token]);

  const applyRealtimeMwdData = useCallback((data: Record<string, unknown>) => {
    const record = normalizeMwdDataRecord(data);
    if (!record) return;

    if (record.sessionId && activeMwdSessionId && String(record.sessionId) !== String(activeMwdSessionId)) {
      return;
    }

    const recordKey = getMwdRecordKey(record);
    if (mwdRecordKeysRef.current.has(recordKey)) {
      setLatestMwdDataRecord((current) => {
        if (!current || record.timestamp.getTime() >= current.timestamp.getTime()) {
          applyLatestMwdRecord(record);
          return record;
        }

        return current;
      });
      return;
    }

    mwdRecordKeysRef.current.add(recordKey);
    const chartPoint = mwdDataRecordsToChartData([record])[0];

    if (chartPoint) {
      setChartData((current) =>
        [...current, chartPoint].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
      );
    }

    setLatestMwdDataRecord((current) => {
      if (!current || record.timestamp.getTime() >= current.timestamp.getTime()) {
        applyLatestMwdRecord(record);
        return record;
      }

      return current;
    });

    setConnectionState((current) => ({
      ...current,
      lastReceived: record.timestamp,
    }));
  }, [activeMwdSessionId, applyLatestMwdRecord]);

  const applyRealtimeEspGatewayStatus = useCallback((data: Record<string, unknown>) => {
    const status = normalizeRealtimeEspStatus(data);
    setEspWsStatus(status);
    setEspWsStatusError(status.lastError ?? '');
  }, []);

  const applyRealtimeConnectionStatus = useCallback((data: Record<string, unknown>) => {
    const event = normalizeRealtimeConnectionEvent(data);
    const status = readString(data, ['status', 'state'])?.toLowerCase();

    setEvents((current) => {
      if (current.some((item) => item.id === event.id)) return current;
      return [event, ...current].slice(0, 100);
    });

    setConnectionState((current) => ({
      ...current,
      status:
        status === 'disconnected' || status === 'offline' || status === 'error'
          ? 'offline'
          : status === 'reconnecting' || status === 'degraded'
            ? 'degraded'
            : 'connected',
      dataSource: event.source ?? current.dataSource,
      lastReceived: event.timestamp,
      reconnecting: status === 'reconnecting',
    }));
    setBackendConnectionStatusActive(true);
  }, []);

  const applyRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (!event.data || Object.keys(event.data).length === 0) return;

    if (event.type === 'mwd-data') {
      applyRealtimeMwdData(event.data);
      return;
    }

    if (event.type === 'esp-gateway-status') {
      applyRealtimeEspGatewayStatus(event.data);
      return;
    }

    if (event.type === 'connection-status') {
      applyRealtimeConnectionStatus(event.data);
    }
  }, [applyRealtimeConnectionStatus, applyRealtimeEspGatewayStatus, applyRealtimeMwdData]);

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
      setWitsConfig([]);
      setWitsConfigError('');
      return;
    }

    void refreshWitsConfig();
  }, [isAuthenticated, refreshWitsConfig, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || !activeMwdSessionId) {
      setWitsDataValuesError('');
      setWitsAlarmsError('');
      setMwdDataError('');
      setChartData([]);
      setLatestMwdDataRecord(null);
      setFailoverEventIds(new Set());
      return;
    }

    void (async () => {
      await refreshMwdData();
      void refreshWitsDataValues();
      void refreshWitsAlarms();
    })();
  }, [
    activeMwdSessionId,
    isAuthenticated,
    refreshMwdData,
    refreshWitsAlarms,
    refreshWitsDataValues,
    token,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setConnectionStatusError('');
      setFailoverEventsError('');
      setSerialStatus(null);
      setSerialStatusError('');
      setEspWsStatus(null);
      setEspWsStatusError('');
      setBackendConnectionStatusActive(false);
      setFailoverEventIds(new Set());
      return;
    }

    void refreshConnectionStatus();
    void refreshFailoverEvents();
    void refreshSerialStatus();
    void refreshEspWsStatus();
  }, [
    activeMwdSessionId,
    isAuthenticated,
    refreshConnectionStatus,
    refreshEspWsStatus,
    refreshFailoverEvents,
    refreshSerialStatus,
    token,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !token || !settings.display.autoRefresh) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshConnectionStatus();
      void refreshSerialStatus();
      void refreshEspWsStatus();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [
    isAuthenticated,
    refreshConnectionStatus,
    refreshEspWsStatus,
    refreshSerialStatus,
    settings.display.autoRefresh,
    token,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !token || !settings.display.autoRefresh) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshFailoverEvents();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated, refreshFailoverEvents, settings.display.autoRefresh, token]);

  useEffect(() => {
    if (!activePlotConfig) return;
    if (activePlotConfig.id !== activePlotConfigId) {
      setActivePlotConfigId(activePlotConfig.id);
    }
  }, [activePlotConfig, activePlotConfigId]);

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

  useEffect(() => {
    if (!isAuthenticated || !token || !activeMwdSessionId) return;
    if (!settings.display.autoRefresh) return;

    const interval = setInterval(() => {
      void refreshMwdData();
      void refreshWitsDataValues();
    }, settings.display.refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [
    isAuthenticated,
    activeMwdSessionId,
    refreshMwdData,
    refreshWitsDataValues,
    settings.display.autoRefresh,
    settings.display.refreshInterval,
    token,
  ]);

  useEffect(() => {
    const client = getRealtimeClient();
    const unsubscribeStatus = client.on('status', ({ status, error }) => {
      setRealtimeStatus(status);
      setRealtimeError(error ?? '');

      setConnectionState((current) => ({
        ...current,
        status:
          status === 'connected'
            ? 'connected'
            : status === 'reconnecting' || status === 'connecting'
              ? 'degraded'
              : status === 'idle'
                ? current.status
                : 'offline',
        reconnecting: status === 'reconnecting' || status === 'connecting',
      }));
    });
    const unsubscribeEvent = client.on('event', applyRealtimeEvent);

    if (!isAuthenticated || !token) {
      client.disconnect();
      return () => {
        unsubscribeStatus();
        unsubscribeEvent();
      };
    }

    client.connect();

    if (activeMwdSessionId) {
      client.subscribeSession(activeMwdSessionId);
    } else {
      client.clearSessionSubscription();
    }

    return () => {
      unsubscribeStatus();
      unsubscribeEvent();
    };
  }, [activeMwdSessionId, applyRealtimeEvent, isAuthenticated, token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstallPrompt(true);
    }, 60000);

    return () => clearTimeout(timer);
  }, []);

  const reconnect = useCallback(() => {
    setConnectionState(prev => ({ ...prev, reconnecting: true }));
    
    setTimeout(() => {
      setConnectionState(prev => ({ ...prev, reconnecting: false }));
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
      latestMwdDataRecord,
      mwdDataLoading,
      mwdDataError,
      refreshMwdData,
      witsDataValuesLoading,
      witsDataValuesError,
      refreshWitsDataValues,
      witsConfig,
      witsConfigLoading,
      witsConfigError,
      refreshWitsConfig,
      witsAlarmsLoading,
      witsAlarmsError,
      refreshWitsAlarms,
      events,
      toolfaceData,
      settings: effectiveSettings,
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
