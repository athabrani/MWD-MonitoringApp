'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

interface AppContextType {
  connectionState: ConnectionState;
  reconnect: () => void;
  wells: Well[];
  activeWell: Well | null;
  setActiveWell: (well: Well) => void;
  kpiData: KPIData;
  chartData: ChartDataPoint[];
  events: Event[];
  toolfaceData: ToolfaceData;
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => void;
  acknowledgeAlarm: (eventId: string, note?: string) => void;
  muteAlarms: (minutes: number) => void;
  alarmsMuted: boolean;
  showInstallPrompt: boolean;
  dismissInstallPrompt: () => void;
  updateAvailable: boolean;
  dismissUpdatePrompt: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultSettings: UserSettings = {
  thresholds: [],
  display: {
    density: 'comfortable',
    theme: 'light',
    autoRefresh: true,
    refreshInterval: 5,
  },
  units: 'metric',
  favoriteParameters: ['rop', 'wob', 'inc', 'azi'],
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'connected',
    latency: 45,
    packetLoss: 0.2,
    lastReceived: new Date(),
    dataSource: 'primary'
  });

  const [wells] = useState<Well[]>(mockWells);
  const [activeWell, setActiveWell] = useState<Well | null>(mockWells[0]);
  const [kpiData, setKpiData] = useState<KPIData>(mockKPIData);
  const [chartData, setChartData] = useState<ChartDataPoint[]>(generateMockChartData(1));
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [toolfaceData, setToolfaceData] = useState<ToolfaceData>(mockToolfaceData);
  const [alarmsMuted, setAlarmsMuted] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    const stored = window.localStorage.getItem('mwd_settings');
    if (!stored) return defaultSettings;

    try {
      return JSON.parse(stored) as UserSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Simulate real-time data updates
  useEffect(() => {
    if (connectionState.status === 'offline') return;

    const interval = setInterval(() => {
      // Update KPI values
      setKpiData(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const param = updated[key as keyof KPIData];
          const variation = (Math.random() - 0.5) * 2;
          param.value = Math.max(0, param.value + variation);
          param.change1min = variation;
          
          if (param.criticalThreshold && param.value >= param.criticalThreshold) {
            param.status = 'critical';
          } else if (param.warningThreshold && param.value >= param.warningThreshold) {
            param.status = 'warning';
          } else {
            param.status = 'normal';
          }
        });
        return updated;
      });

      // Update toolface with smooth animation
      setToolfaceData(prev => ({
        ...prev,
        angle: (prev.angle + (Math.random() - 0.5) * 2 + 360) % 360,
        operationTimer: prev.operationTimer + 5
      }));

      // Update connection state
      setConnectionState(prev => ({
        ...prev,
        lastReceived: new Date(),
        latency: 40 + Math.random() * 20,
        packetLoss: Math.random() * 0.5
      }));

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
    }, 5000);

    return () => clearInterval(interval);
  }, [connectionState.status, kpiData]);

  // Simulate occasional connection issues
  useEffect(() => {
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
  }, []);

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
    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? { 
            ...event, 
            acknowledgedBy: 'current_user', 
            acknowledgedAt: new Date(),
            note 
          }
        : event
    ));
  }, []);

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
      wells,
      activeWell,
      setActiveWell,
      kpiData,
      chartData,
      events,
      toolfaceData,
      settings,
      updateSettings,
      acknowledgeAlarm,
      muteAlarms,
      alarmsMuted,
      showInstallPrompt,
      dismissInstallPrompt,
      updateAvailable,
      dismissUpdatePrompt
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
