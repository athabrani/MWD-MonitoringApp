import { 
  User, 
  Well, 
  KPIData, 
  Event, 
  TrajectoryData,
  SystemHealth,
  AuditLog,
  ChartDataPoint,
  ToolfaceData
} from '../types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    username: 'operator1',
    email: 'operator@drilling.com',
    role: 'operator',
    fullName: 'Ahmad Firdaus'
  },
  {
    id: '2',
    username: 'engineer1',
    email: 'engineer@drilling.com',
    role: 'engineer',
    fullName: 'Sarah Martinez'
  },
  {
    id: '3',
    username: 'admin1',
    email: 'admin@drilling.com',
    role: 'admin',
    fullName: 'James Wilson'
  }
];

// Mock Wells and Jobs
export const mockWells: Well[] = [
  {
    id: 'well-001',
    name: 'Well Alpha-12H',
    location: 'North Sea Sector 4',
    operator: 'PetroMax Energy',
    activeJob: {
      id: 'job-001',
      wellId: 'well-001',
      name: 'Alpha-12H Development',
      startDate: new Date('2025-12-10'),
      status: 'active',
      currentDepth: 3847.5,
      targetDepth: 4500
    }
  },
  {
    id: 'well-002',
    name: 'Well Bravo-08',
    location: 'Gulf Coast',
    operator: 'DeepDrill Corp',
    activeJob: {
      id: 'job-002',
      wellId: 'well-002',
      name: 'Bravo-08 Exploration',
      startDate: new Date('2025-12-15'),
      status: 'paused',
      currentDepth: 2145.0,
      targetDepth: 3200
    }
  }
];

// Mock KPI Data with realistic MWD values
export const mockKPIData: KPIData = {
  rop: {
    id: 'rop',
    name: 'Rate of Penetration',
    value: 28.5,
    unit: 'm/hr',
    status: 'normal',
    trend: 'up',
    change1min: 1.2,
    category: 'drilling',
    warningThreshold: 10,
    criticalThreshold: 5
  },
  wob: {
    id: 'wob',
    name: 'Weight on Bit',
    value: 18.2,
    unit: 'klbs',
    status: 'normal',
    trend: 'stable',
    change1min: 0.3,
    category: 'drilling',
    warningThreshold: 25,
    criticalThreshold: 30
  },
  rpm: {
    id: 'rpm',
    name: 'Rotary Speed',
    value: 115,
    unit: 'rpm',
    status: 'normal',
    trend: 'stable',
    change1min: -2,
    category: 'drilling',
    warningThreshold: 150,
    criticalThreshold: 180
  },
  flowRate: {
    id: 'flowrate',
    name: 'Flow Rate',
    value: 845,
    unit: 'gpm',
    status: 'warning',
    trend: 'down',
    change1min: -15,
    category: 'mud',
    warningThreshold: 850,
    criticalThreshold: 800
  },
  standpipePressure: {
    id: 'spp',
    name: 'Standpipe Pressure',
    value: 3250,
    unit: 'psi',
    status: 'normal',
    trend: 'up',
    change1min: 50,
    category: 'mud',
    warningThreshold: 4000,
    criticalThreshold: 4500
  },
  mudWeight: {
    id: 'mudweight',
    name: 'Mud Weight',
    value: 10.8,
    unit: 'ppg',
    status: 'normal',
    trend: 'stable',
    change1min: 0.1,
    category: 'mud',
    warningThreshold: 12,
    criticalThreshold: 13
  },
  inclination: {
    id: 'inc',
    name: 'Inclination',
    value: 32.4,
    unit: '°',
    status: 'normal',
    trend: 'up',
    change1min: 0.2,
    category: 'directional',
    warningThreshold: 45,
    criticalThreshold: 50
  },
  azimuth: {
    id: 'azi',
    name: 'Azimuth',
    value: 247.8,
    unit: '°',
    status: 'normal',
    trend: 'stable',
    change1min: 0.5,
    category: 'directional'
  },
  gamma: {
    id: 'gamma',
    name: 'Gamma Ray',
    value: 78.5,
    unit: 'API',
    status: 'normal',
    trend: 'down',
    change1min: -3.2,
    category: 'formation',
    warningThreshold: 150,
    criticalThreshold: 200
  },
  temperature: {
    id: 'temp',
    name: 'Downhole Temp',
    value: 142.3,
    unit: '°F',
    status: 'normal',
    trend: 'up',
    change1min: 0.8,
    category: 'tool',
    warningThreshold: 180,
    criticalThreshold: 200
  }
};

// Mock Toolface Data
export const mockToolfaceData: ToolfaceData = {
  angle: 176,
  type: 'GTF',
  targetAngle: 180,
  operationTimer: 3847
};

// Mock Events
export const mockEvents: Event[] = [
  {
    id: 'evt-001',
    timestamp: new Date(Date.now() - 2 * 60000),
    severity: 'warning',
    type: 'alarm',
    message: 'Flow rate below threshold',
    parameter: 'flowrate',
    value: 845,
    threshold: 850,
    source: 'primary'
  },
  {
    id: 'evt-002',
    timestamp: new Date(Date.now() - 15 * 60000),
    severity: 'info',
    type: 'user_action',
    message: 'Threshold updated by engineer1',
    parameter: 'rop'
  },
  {
    id: 'evt-003',
    timestamp: new Date(Date.now() - 45 * 60000),
    severity: 'critical',
    type: 'connection',
    message: 'Primary connection lost, failed over to backup',
    source: 'backup',
    acknowledgedBy: 'operator1',
    acknowledgedAt: new Date(Date.now() - 40 * 60000),
    resolved: true
  },
  {
    id: 'evt-004',
    timestamp: new Date(Date.now() - 120 * 60000),
    severity: 'info',
    type: 'system',
    message: 'Data acquisition resumed',
    source: 'primary'
  }
];

// Mock Trajectory Data
export const mockTrajectoryData: TrajectoryData = {
  planned: [
    { md: 0, tvd: 0, inclination: 0, azimuth: 0, northing: 0, easting: 0 },
    { md: 500, tvd: 500, inclination: 0, azimuth: 0, northing: 0, easting: 0 },
    { md: 1000, tvd: 999.5, inclination: 2, azimuth: 245, northing: -5, easting: -8 },
    { md: 1500, tvd: 1497, inclination: 8, azimuth: 245, northing: -25, easting: -40 },
    { md: 2000, tvd: 1990, inclination: 18, azimuth: 246, northing: -75, easting: -120 },
    { md: 2500, tvd: 2470, inclination: 28, azimuth: 247, northing: -160, easting: -250 },
    { md: 3000, tvd: 2935, inclination: 32, azimuth: 248, northing: -280, easting: -430 },
    { md: 3500, tvd: 3385, inclination: 33, azimuth: 248, northing: -420, easting: -640 },
    { md: 4000, tvd: 3830, inclination: 33, azimuth: 248, northing: -565, easting: -855 },
    { md: 4500, tvd: 4270, inclination: 33, azimuth: 248, northing: -715, easting: -1075 }
  ],
  actual: [
    { md: 0, tvd: 0, inclination: 0, azimuth: 0, northing: 0, easting: 0 },
    { md: 500, tvd: 500, inclination: 0, azimuth: 0, northing: 0, easting: 0 },
    { md: 1000, tvd: 999.6, inclination: 1.8, azimuth: 244, northing: -4.5, easting: -7.5 },
    { md: 1500, tvd: 1497.2, inclination: 7.5, azimuth: 244, northing: -23, easting: -38 },
    { md: 2000, tvd: 1990.5, inclination: 17.2, azimuth: 245, northing: -72, easting: -118 },
    { md: 2500, tvd: 2471, inclination: 27.5, azimuth: 246, northing: -157, easting: -245 },
    { md: 3000, tvd: 2937, inclination: 31.8, azimuth: 247, northing: -276, easting: -425 },
    { md: 3500, tvd: 3388, inclination: 32.5, azimuth: 247, northing: -415, easting: -635 },
    { md: 3847.5, tvd: 3679.2, inclination: 32.4, azimuth: 247.8, northing: -512, easting: -775 }
  ]
};

// Mock Chart Data
export const generateMockChartData = (hours: number = 1): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const points = hours * 60;
  const now = Date.now();
  
  for (let i = 0; i < points; i++) {
    const timestamp = new Date(now - (points - i) * 60000);
    
    data.push({
      timestamp,
      rop: 25 + Math.sin(i / 10) * 5 + Math.random() * 3,
      wob: 18 + Math.cos(i / 15) * 2 + Math.random() * 1,
      rpm: 110 + Math.sin(i / 20) * 10 + Math.random() * 5,
      spp: 3200 + Math.cos(i / 12) * 150 + Math.random() * 50,
      flowrate: 850 + Math.sin(i / 25) * 30 + Math.random() * 20,
      gamma: 75 + Math.cos(i / 30) * 15 + Math.random() * 10,
      inc: 32 + (i / points) * 0.5 + Math.random() * 0.3,
      azi: 247 + Math.sin(i / 40) * 2 + Math.random() * 0.5,
      depth: 3500 + (i / points) * 50
    });
  }
  
  return data;
};

// Mock System Health
export const mockSystemHealth: SystemHealth = {
  serverStatus: 'healthy',
  gatewayStatus: 'healthy',
  primaryFeedStatus: 'healthy',
  backupFeedStatus: 'healthy',
  uptime: 99.7,
  errorRate: 0.3,
  activeUsers: 12,
  lastUpdate: new Date()
};

// Mock Audit Logs
export const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 30 * 60000),
    userId: '2',
    userName: 'Sarah Martinez',
    action: 'Updated threshold',
    details: 'Changed ROP critical threshold from 5 to 8 m/hr',
    ipAddress: '192.168.1.45'
  },
  {
    id: 'audit-002',
    timestamp: new Date(Date.now() - 2 * 3600000),
    userId: '1',
    userName: 'Ahmad Firdaus',
    action: 'Acknowledged alarm',
    details: 'Flow rate warning - evt-001',
    ipAddress: '192.168.1.23'
  },
  {
    id: 'audit-003',
    timestamp: new Date(Date.now() - 5 * 3600000),
    userId: '3',
    userName: 'James Wilson',
    action: 'Created user',
    details: 'Added new operator: operator2',
    ipAddress: '192.168.1.10'
  },
  {
    id: 'audit-004',
    timestamp: new Date(Date.now() - 8 * 3600000),
    userId: '2',
    userName: 'Sarah Martinez',
    action: 'Exported data',
    details: 'CSV export for range: 2025-12-15 to 2025-12-16',
    ipAddress: '192.168.1.45'
  }
];
