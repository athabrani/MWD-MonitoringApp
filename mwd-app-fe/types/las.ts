export interface LasExportSettings {
  minimumDepth: number;
  maximumDepth: number;
  stepDepth: number;
  maximumGap: number;
  nullValue: string;
}

export interface LasExportOptions {
  includeProjectedSurvey: boolean;
  includeSurveysInOtherSection: boolean;
  correctDepthColumnForTvd: boolean;
  dateTimeInFirstColumn: boolean;
  interpolateSurveyValues: boolean;
  useSurveyFormattedOutput: boolean;
}

export interface LasExportColumn {
  id: string;
  witsId: string;
  mnemonic: string;
  description: string;
  unit: string;
}

export interface LasPreset {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  settings: LasExportSettings;
  options: LasExportOptions;
  columns: LasExportColumn[];
  updatedAt: string;
}

export interface LasPreviewResult {
  presetName: string;
  generatedAt: string;
  depthRange: string;
  columnCount: number;
  lineCountEstimate: number;
  previewText: string;
}
