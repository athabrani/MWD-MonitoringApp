export type PolarisAccessLevel = "MWD" | "Guest" | "None";
export type PolarisDrillingStatus =
  | "Drilling"
  | "Circulating"
  | "Tripping"
  | "Surveying"
  | "Standby";
export type PolarisUnits = "metric" | "imperial";
export type PolarisNorthReference = "true" | "magnetic" | "grid";
export type PolarisDataSourceMode = "decoder" | "manual" | "simulated" | "derived";
export type PolarisToolType = "Mud Pulse" | "EM" | "Simulator" | "Memory";
export type PolarisSurveyRigSource = "database" | "realtime";

export interface PolarisWellInformation {
  companyName: string;
  surveyCompany: string;
  siteName: string;
  wellName: string;
  jobName: string;
  jobNumber: string;
  operator: string;
  rigName: string;
  rigId: string;
  fieldName: string;
  apiOrUwi: string;
  afe: string;
  location: string;
  stateOrProvince: string;
  countyOrParish: string;
  country: string;
  filePrefix: string;
  fileSuffix: string;
  fileSequence: string;
  startDate: string;
  endDate: string;
  startDepth: number;
  endDepth: number;
  drillingStatus: PolarisDrillingStatus;
  backupDatabaseToDashboard: boolean;
  dashboardContactName: string;
  dashboardContactEmail: string;
  dashboardContactSecondary: string;
  dashboardContactPhone: string;
  dashboardCoordinator: string;
  notes: string;
}

export interface PolarisContact {
  id: string;
  name: string;
  email: string;
  company: string;
  accessLevel: PolarisAccessLevel;
  active: boolean;
}

export interface PolarisSurveyConfiguration {
  units: PolarisUnits;
  proposedAzimuth: number;
  surveyDepthOffset: number;
  surveyDoglegUnit: string;
  plotPaperNote: string;
  northReference: PolarisNorthReference;
  magneticDeclination: number;
  latitude: string;
  longitude: string;
  northing: number;
  easting: number;
  kb: number;
  df: number;
  gl: number;
  subseaDepth: number;
  surveyReportColumns: string;
  surveyRigPortSource: PolarisSurveyRigSource;
  plotInclination: boolean;
  plotAzimuth: boolean;
  plotTvd: boolean;
  plotVerticalSection: boolean;
  plotNorthSouth: boolean;
  plotEastWest: boolean;
  outputDoglegSeverity: boolean;
  outputCoordinates: boolean;
  outputTvdss: boolean;
  importWellplanFile: string;
}

export interface PolarisWitsId {
  id: string;
  numericId: number;
  enabled: boolean;
  name: string;
  units: string;
  decimalPlaces: number;
  scaleFactor: number;
  biasOffset: number;
  sensorToBitSpacing: number;
  sendToAux: boolean;
  sendToRigWits: boolean;
  doNotRepeat: boolean;
  realTimePlot: string;
  depthTracking: string;
  lasMnemonic: string;
  alarmLow: number;
  alarmHigh: number;
  dataSourceMode: PolarisDataSourceMode;
  scriptNotes: string;
}

export interface PolarisDecoderConfiguration {
  toolType: PolarisToolType;
  toolfaceModeInclination: number;
  witsOutputTimer: number;
  gvTagMapping: string;
}

export interface PolarisSystemInfo {
  smtpHost: string;
  smtpPort: number;
  username: string;
  senderEmail: string;
  subjectTemplate: string;
  bodyTemplate: string;
  signature: string;
  reportLogoLight: string;
  reportLogoDark: string;
}

export interface PolarisWellplanSurvey {
  id: string;
  md: number;
  inc: number;
  azm: number;
  tvd: number;
  vs: number;
  ns: number;
  ew: number;
  cd: number;
  ca: number;
  dl: number;
}
