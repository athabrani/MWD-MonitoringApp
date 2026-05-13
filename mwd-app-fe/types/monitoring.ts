export type PortStatus = "Open" | "Closed";
export type MonitoringMode = "raw" | "details";
export type ProjectionMethod = "Straight-Line" | "Last Build/Turn";

export interface WitsPacketLog {
  id: string;
  timestamp: string;
  source: string;
  port: string;
  rawPacket: string;
  witsId: string;
  rawValue: string;
  parsedValue: string;
  label: string;
  description: string;
}

export interface SurveyRecord {
  id: string;
  md: number;
  inc: number;
  azm: number;
  tvd: number;
  ns: number;
  ew: number;
  dls: number;
  vs: number;
  toolfaceMode: string;
  timestamp: string;
  isProjection: boolean;
  projectionMethod?: ProjectionMethod;
}

export interface SurveyInputSummary {
  md: number;
  inc: number;
  azm: number;
  tvd: number;
  ns: number;
  ew: number;
  dls: number;
  vs: number;
  toolfaceMode: string;
}

export interface SurveyStorageConfig {
  columnLabels: {
    md: string;
    inc: string;
    azm: string;
    tvd: string;
    ns: string;
    ew: string;
    dls: string;
    vs: string;
  };
  userDefinedInput: string;
  captureRigWits: boolean;
  captureAuxDecoded: boolean;
  captureToolfaceMode: boolean;
}

export interface LogDataRecord {
  id: string;
  witsId: string;
  label: string;
  depth: number;
  value: number;
  timestamp: string;
  hidden: boolean;
  source: string;
  notes?: string;
}

export type WitsIdLogRecord = LogDataRecord;

export interface DepthRange {
  startDepth: number;
  endDepth: number;
}

export type RescaleMode = "example-value" | "percentage";

export interface RescaleRequest {
  channelWitsId: string;
  mode: RescaleMode;
  startDepth: number;
  endDepth: number;
  scaleFactor: number;
  originalExampleValue?: number;
  desiredExampleValue?: number;
  percentage?: number;
}

export interface RescalePreview {
  recordId: string;
  depth: number;
  beforeValue: number;
  afterValue: number;
}

export interface RescaleResultSummary {
  channelWitsId: string;
  mode: RescaleMode;
  scaleFactor: number;
  startDepth: number;
  endDepth: number;
  affectedRows: number;
}
