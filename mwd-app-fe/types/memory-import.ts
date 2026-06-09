export interface MemoryStorageChannel {
  id: string;
  witsId: string;
  name: string;
  decimalPlaces: number;
  scaleFactor: number;
  bitOffset: number;
  sensorSpacing: number;
  plotScaleInfo: string;
  createdAt: string;
  source: "local-ui" | "configuration";
}

export interface WitsIdStorageChannel extends MemoryStorageChannel {
  configurationWitsRecordId: string;
}

export interface MemoryImportConfig {
  enabled: boolean;
  storageWitsId: string;
  defaultFieldName?: string;
  lastImportedDatasetId?: string;
}

export interface MemoryImportRow {
  timestamp: string;
  depth: number;
  value: number;
  raw: Record<string, string>;
}

export interface MemoryImportSegment {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  startDepth: number;
  endDepth: number;
  sampleCount: number;
  fieldName: string;
  rows: MemoryImportRow[];
}

export interface MemoryImportFile {
  id: string;
  fileName: string;
  uploadedAt: string;
  detectedFields: string[];
  totalRows: number;
  detectedTimeSpan: {
    start: string;
    end: string;
  };
  segments: MemoryImportSegment[];
  parserMode: "csv-basic";
}

export interface ImportedMemorySample {
  id: string;
  timestamp: string;
  depth: number;
  originalDepth: number;
  value: number;
  originalValue: number;
}

export interface ImportedMemoryDataset {
  id: string;
  storageWitsId: string;
  storageName: string;
  fileName: string;
  segmentId: string;
  segmentName: string;
  importedAt: string;
  samples: ImportedMemorySample[];
  status: "imported" | "correlated" | "gap-fill-staged";
}

export interface CorrelationSettings {
  timeShiftSeconds: number;
  depthShift: number;
  scaleFactor: number;
  updatedAt?: string;
}

export type MemoryCorrelationSettings = CorrelationSettings;

export interface GapFillRequest {
  id: string;
  sourceDatasetId: string;
  sourceWitsId: string;
  targetWitsId: string;
  startDepth: number;
  endDepth: number;
  mode: "copy-depths" | "fill-gaps-only";
  createdAt: string;
  affectedSamples: number;
  status: "staged" | "applied-local";
}

export interface CopyDepthRequest {
  id: string;
  sourceDatasetId: string;
  sourceWitsId: string;
  targetWitsId: string;
  startDepth: number;
  endDepth: number;
  affectedRows: number;
  createdAt: string;
  status: "preview" | "applied-local";
}
