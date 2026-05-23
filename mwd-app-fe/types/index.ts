// User and Authentication Types
export type UserRole = 'operator' | 'engineer' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  avatar?: string;
  isActive?: boolean;
  lastLoginAt?: string;
}

// Connection Status Types
export type ConnectionStatus = 'connected' | 'degraded' | 'offline';
export type DataSource = 'primary' | 'backup';

export interface ConnectionState {
  status: ConnectionStatus;
  latency: number;
  packetLoss: number;
  lastReceived: Date;
  dataSource: DataSource;
  reconnecting?: boolean;
}

// MWD Parameter Types
export interface MWDParameter {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  change1min?: number;
  category: 'drilling' | 'mud' | 'directional' | 'formation' | 'tool';
  warningThreshold?: number;
  criticalThreshold?: number;
}

// KPI Cards Data
export interface KPIData {
  rop: MWDParameter;
  wob: MWDParameter;
  rpm: MWDParameter;
  flowRate: MWDParameter;
  standpipePressure: MWDParameter;
  mudWeight: MWDParameter;
  inclination: MWDParameter;
  azimuth: MWDParameter;
  gamma: MWDParameter;
  temperature: MWDParameter;
}

// Chart Data Point
export interface ChartDataPoint {
  timestamp: Date;
  depth?: number;
  [key: string]: number | Date | undefined;
}

// Events and Alarms
export type EventSeverity = 'info' | 'warning' | 'critical';
export type EventType = 'alarm' | 'connection' | 'failover' | 'user_action' | 'system';

export interface Event {
  id: string;
  timestamp: Date;
  severity: EventSeverity;
  type: EventType;
  message: string;
  parameter?: string;
  value?: number;
  threshold?: number;
  source?: DataSource;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  note?: string;
  resolved?: boolean;
}

// Well and Job
export interface Well {
  id: string;
  name: string;
  location: string;
  operator: string;
  activeJob?: Job;
}

export interface Job {
  id: string;
  wellId: string;
  name: string;
  startDate: Date;
  status: 'active' | 'paused' | 'completed';
  currentDepth: number;
  targetDepth: number;
}

// Trajectory Data
export interface TrajectoryPoint {
  md: number;
  tvd: number;
  inclination: number;
  azimuth: number;
  northing: number;
  easting: number;
}

export interface TrajectoryData {
  planned: TrajectoryPoint[];
  actual: TrajectoryPoint[];
}

export interface TrajectoryMetrics {
  currentMD: number;
  currentTVD: number;
  currentInclination: number;
  currentAzimuth: number;
  crossTrackError: number;
  deltaTVD: number;
  doglegSeverity: number;
}

// Toolface Types
export type ToolfaceType = 'GTF' | 'MTF';

export interface ToolfaceData {
  angle: number;
  type: ToolfaceType;
  targetAngle?: number;
  operationTimer: number; // seconds
}

// Settings
export interface ThresholdSettings {
  parameter: string;
  enabled?: boolean;
  low?: number;
  high?: number;
  warning: number;
  critical: number;
}

export interface DisplaySettings {
  density: 'compact' | 'comfortable';
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface UserSettings {
  thresholds: ThresholdSettings[];
  display: DisplaySettings;
  units: 'metric' | 'imperial';
  favoriteParameters: string[];
}

// Export
export interface ExportRequest {
  format: 'csv' | 'json' | 'pdf';
  startTime: Date;
  endTime: Date;
  parameters: string[];
  includeCharts?: boolean;
  includeAlarms?: boolean;
}

// Audit Log
export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress?: string;
}

// System Health
export interface SystemHealth {
  serverStatus: 'healthy' | 'degraded' | 'down';
  gatewayStatus: 'healthy' | 'degraded' | 'down';
  primaryFeedStatus: 'healthy' | 'degraded' | 'down';
  backupFeedStatus: 'healthy' | 'degraded' | 'down';
  uptime: number;
  errorRate: number;
  activeUsers: number;
  lastUpdate: Date;
}
