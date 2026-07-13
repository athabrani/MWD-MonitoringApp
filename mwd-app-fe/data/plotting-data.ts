import {
  PlotConfiguration,
  PlotHeaderInfo,
  PlotLabel,
  TemplateFile,
  UploadedUserFile,
} from "@/types/plotting";

const now = new Date();
const isoDaysAgo = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

export const mockPlotHeaderInfo: PlotHeaderInfo = {
  plotTitle: "Rig-12 / Well Alpha-7",
  userDefinedLabels: [
    { id: "udl-1", label: "Company", value: "MWD Operations" },
    { id: "udl-2", label: "Field", value: "North Pad" },
    { id: "udl-3", label: "Run Objective", value: "Gamma and directional report" },
  ],
  logInformation: {
    logMeasurements: "MD, Inc, Azm, Gamma, Temperature",
    depthMeasuredFrom: "Kelly Bushing",
    maxTemperature: "186 degF",
    startDepth: 3600,
    endDepth: 3925,
    startDate: "2026-05-09",
    endDate: "2026-05-11",
  },
  drillingParameters: {
    casingDepth: 2140,
    casingSize: "9 5/8 in",
    mudType: "WBM",
    density: 10.4,
    viscosity: 48,
    rm: 0.26,
    rmf: 0.21,
    rmc: 0.34,
    elevations: {
      kellyBushing: 23.5,
      drillFloor: 18.2,
      groundLevel: 0,
    },
  },
  runSummaries: [
    {
      id: "run-1",
      name: "Run 1",
      surveyOffset: 11,
      gammaOffset: -3,
      startDepth: 3600,
      endDepth: 3760,
      startDate: "2026-05-09",
      endDate: "2026-05-10",
      startTime: "06:30",
      endTime: "22:15",
    },
    {
      id: "run-2",
      name: "Run 2",
      surveyOffset: 11,
      gammaOffset: -3,
      startDepth: 3760,
      endDepth: 3925,
      startDate: "2026-05-10",
      endDate: "2026-05-11",
      startTime: "23:10",
      endTime: "09:45",
    },
  ],
};

export const mockPlotLabels: PlotLabel[] = [
  { id: "label-1", depth: 3712, align: "left", trackTarget: "Gamma Track", text: "Gamma response increase" },
  { id: "label-2", depth: 3847.5, align: "center", trackTarget: "Survey Track", text: "Confirmed survey station" },
];

export const mockTemplateFiles: TemplateFile[] = [
  {
    id: "template-1",
    fileName: "standard-directional-header.tpl",
    type: "Header",
    description: "Default directional header with run summary blocks",
    updatedAt: isoDaysAgo(3),
  },
  {
    id: "template-2",
    fileName: "gamma-resistivity-track.tpl",
    type: "Track",
    description: "Three-track gamma and resistivity layout",
    updatedAt: isoDaysAgo(6),
  },
  {
    id: "template-3",
    fileName: "daily-client-report.tpl",
    type: "Report",
    description: "Client-facing PDF report front matter",
    updatedAt: isoDaysAgo(9),
  },
];

export const mockUploadedUserFiles: UploadedUserFile[] = [
  {
    id: "upload-1",
    fileName: "client-cover-page.pdf",
    type: "PDF",
    description: "Client cover page to place before generated plot",
    updatedAt: isoDaysAgo(1),
    conversionStatus: "Ready",
    usableInPlotBuilder: true,
  },
  {
    id: "upload-2",
    fileName: "mud-properties.xlsx",
    type: "Spreadsheet",
    description: "Mud properties sheet; conversion pipeline placeholder",
    updatedAt: isoDaysAgo(2),
    conversionStatus: "Will convert to PDF",
    usableInPlotBuilder: false,
  },
  {
    id: "upload-3",
    fileName: "bha-summary.pdf",
    type: "PDF",
    description: "BHA summary for after-plot attachment",
    updatedAt: isoDaysAgo(4),
    conversionStatus: "Ready",
    usableInPlotBuilder: true,
  },
];

export const mockPlotConfigurations: PlotConfiguration[] = [
  {
    id: "plot-config-1",
    name: "Standard MWD Gamma Plot",
    isDefault: true,
    general: {
      headerStyle: "Standard Directional Header",
      headerPreset: "Standard",
      fileFormat: "PDF",
      multiPageOutput: true,
      measuredDepthStart: 3600,
      measuredDepthEnd: 3925,
      useTvd: false,
      endByTvd: false,
      depthScale: "1:500",
      majorTicInterval: 100,
      minorTicInterval: 20,
      stepTicInterval: 10,
      depthCorrection: "MD",
      surveysInTrack: true,
      surveyReportAtEnd: true,
      printLabels: true,
      page: {
        multiPage: true,
        widthIn: 8.5,
        heightIn: 11,
        noTopBottomMargins: false,
        maxPageLengthFt: 1200,
      },
      depthRange: {
        start: 3600,
        end: 3925,
        useTvd: false,
      },
      grid: {
        depthScale: "1:500",
        majorTick: 100,
        minorTick: 20,
        firstDataSpacing: 8,
        topSpacing: 12,
        bottomSpacing: 12,
      },
      azimuthal: {
        slideDetectionNoData: 0,
      },
      surveys: {
        trackIndex: 1,
        includePtb: false,
        printLabels: true,
        transparentBackground: false,
        reportAtEnd: true,
      },
      layout: {
        customHeaders: false,
        previewStyle: "standard",
      },
    },
    pdfItems: [
      { id: "pdf-item-1", fileId: "upload-1", label: "Client cover page", placement: "before" },
      { id: "pdf-item-2", label: "Generated main plot", placement: "main" },
      { id: "pdf-item-3", fileId: "upload-3", label: "BHA summary", placement: "after" },
    ],
    tracks: [
      {
        id: "track-1",
        name: "Survey Track",
        scaleType: "Linear",
        densityTicMarks: true,
        curves: [
          {
            id: "curve-1",
            dataSource: "0713 - Inclination",
            scale: "0-90",
            correctForTvd: false,
            lineWidth: 2,
            filter: "None",
            fillCurve: false,
            lineStyle: "Solid",
            lineColor: "#2563eb",
            wrapColor: "#93c5fd",
          },
          {
            id: "curve-2",
            dataSource: "0714 - Azimuth",
            scale: "0-360",
            correctForTvd: false,
            lineWidth: 2,
            filter: "None",
            fillCurve: false,
            lineStyle: "Dashed",
            lineColor: "#16a34a",
            wrapColor: "#86efac",
          },
        ],
      },
      {
        id: "track-2",
        name: "Gamma Track",
        scaleType: "Linear",
        densityTicMarks: false,
        curves: [
          {
            id: "curve-3",
            dataSource: "0824 - Gamma corrected",
            scale: "0-150",
            correctForTvd: false,
            lineWidth: 2,
            filter: "3 point",
            fillCurve: true,
            lineStyle: "Solid",
            lineColor: "#dc2626",
            wrapColor: "#fecaca",
          },
        ],
      },
    ],
    azimuthal: {
      maxValue: 360,
      imageContrast: "Dynamic",
      highDefinition: true,
      colorMap: "Viridis",
      slideColor: "#f97316",
    },
  },
];
