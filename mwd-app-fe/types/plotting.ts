export type PlotFileFormat = "PDF" | "CGM" | "TIFF" | "JPG";
export type DepthCorrectionMode = "MD" | "TVD" | "TVDss" | "VS";
export type PdfPlacement = "before" | "main" | "after";
export type PlotTextAlign = "left" | "center" | "right";
export type TemplateFileType = "Header" | "Track" | "LAS" | "Report";
export type UploadedUserFileType = "PDF" | "Spreadsheet";
export type TrackScaleType = "Linear" | "Logarithmic" | "Azimuthal";
export type CurveLineStyle = "Solid" | "Dashed" | "Dotted";
export type ImageContrastMode = "Static" | "Dynamic";

export interface UserDefinedLabel {
  id: string;
  label: string;
  value: string;
}

export interface LogInformation {
  logMeasurements: string;
  depthMeasuredFrom: string;
  maxTemperature: string;
  startDepth: number;
  endDepth: number;
  startDate: string;
  endDate: string;
}

export interface DrillingParameters {
  casingDepth: number;
  casingSize: string;
  mudType: string;
  density: number;
  viscosity: number;
  rm: number;
  rmf: number;
  rmc: number;
  elevations: {
    kellyBushing: number;
    drillFloor: number;
    groundLevel: number;
  };
}

export interface RunSummary {
  id: string;
  name: string;
  surveyOffset: number;
  gammaOffset: number;
  startDepth: number;
  endDepth: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

export interface PlotHeaderInfo {
  plotTitle: string;
  userDefinedLabels: UserDefinedLabel[];
  logInformation: LogInformation;
  drillingParameters: DrillingParameters;
  runSummaries: RunSummary[];
}

export interface PlotLabel {
  id: string;
  depth: number;
  align: PlotTextAlign;
  trackTarget: string;
  text: string;
}

export interface TemplateFile {
  id: string;
  fileName: string;
  type: TemplateFileType;
  description: string;
  updatedAt: string;
}

export interface UploadedUserFile {
  id: string;
  fileName: string;
  type: UploadedUserFileType;
  description: string;
  updatedAt: string;
  conversionStatus: "Ready" | "PDF ready" | "Will convert to PDF";
  usableInPlotBuilder: boolean;
}

export interface DepthScalePosition {
  fileId: string;
  x: number;
  y: number;
  savedAt?: string;
}

export interface PlotGeneralSettings {
  headerStyle: string;
  fileFormat: PlotFileFormat;
  multiPageOutput: boolean;
  measuredDepthStart: number;
  measuredDepthEnd: number;
  useTvd: boolean;
  endByTvd: boolean;
  depthScale: string;
  majorTicInterval: number;
  minorTicInterval: number;
  stepTicInterval: number;
  depthCorrection: DepthCorrectionMode;
  surveysInTrack: boolean;
  surveyReportAtEnd: boolean;
  printLabels: boolean;
}

export interface PdfPlotItem {
  id: string;
  fileId?: string;
  label: string;
  placement: PdfPlacement;
}

export interface CurveConfig {
  id: string;
  dataSource: string;
  scale: string;
  correctForTvd: boolean;
  lineWidth: number;
  filter: string;
  fillCurve: boolean;
  lineStyle: CurveLineStyle;
  lineColor: string;
  wrapColor: string;
}

export interface TrackConfig {
  id: string;
  name: string;
  scaleType: TrackScaleType;
  densityTicMarks: boolean;
  curves: CurveConfig[];
}

export interface AzimuthalPlotSettings {
  maxValue: number;
  imageContrast: ImageContrastMode;
  highDefinition: boolean;
  colorMap: string;
  slideColor: string;
}

export interface PlotConfiguration {
  id: string;
  name: string;
  isDefault: boolean;
  general: PlotGeneralSettings;
  pdfItems: PdfPlotItem[];
  tracks: TrackConfig[];
  azimuthal: AzimuthalPlotSettings;
}
