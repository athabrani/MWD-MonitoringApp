import { LasExportColumn, LasPreset } from "@/types/las";

const nowIso = () => new Date().toISOString();

export const availableLasColumns: LasExportColumn[] = [
  { id: "las-col-0110", witsId: "0110", mnemonic: "DEPT", description: "Hole depth", unit: "m" },
  { id: "las-col-0113", witsId: "0113", mnemonic: "ROP", description: "Rate of penetration", unit: "m/hr" },
  { id: "las-col-0713", witsId: "0713", mnemonic: "INCL", description: "Inclination", unit: "deg" },
  { id: "las-col-0714", witsId: "0714", mnemonic: "AZIM", description: "Azimuth", unit: "deg" },
  { id: "las-col-0716", witsId: "0716", mnemonic: "MTF", description: "Magnetic toolface", unit: "deg" },
  { id: "las-col-0717", witsId: "0717", mnemonic: "GTF", description: "Gravity toolface", unit: "deg" },
  { id: "las-col-0720", witsId: "0720", mnemonic: "DLS", description: "Dogleg severity", unit: "deg/30m" },
  { id: "las-col-0823", witsId: "0823", mnemonic: "GRRAW", description: "Gamma raw", unit: "API" },
  { id: "las-col-0824", witsId: "0824", mnemonic: "GRCOR", description: "Gamma corrected", unit: "API" },
  { id: "las-col-0836", witsId: "0836", mnemonic: "TEMP", description: "Auxiliary temperature", unit: "degF" },
  { id: "las-col-0921", witsId: "0921", mnemonic: "BATT", description: "Battery voltage", unit: "V" },
  { id: "las-col-6410", witsId: "6410", mnemonic: "CONF", description: "Average confidence factor", unit: "%" },
];

export const mockLasPresets: LasPreset[] = [
  {
    id: "las-preset-standard",
    name: "Standard Survey LAS",
    description: "Survey, corrected gamma, and quality fields for client delivery.",
    isDefault: true,
    settings: {
      minimumDepth: 3600,
      maximumDepth: 3925,
      stepDepth: 0.5,
      maximumGap: 10,
      nullValue: "-9999.00",
    },
    options: {
      includeProjectedSurvey: true,
      includeSurveysInOtherSection: true,
      correctDepthColumnForTvd: false,
      dateTimeInFirstColumn: false,
      interpolateSurveyValues: true,
      useSurveyFormattedOutput: true,
    },
    columns: [
      availableLasColumns[0],
      availableLasColumns[2],
      availableLasColumns[3],
      availableLasColumns[8],
      availableLasColumns[9],
    ],
    updatedAt: nowIso(),
  },
  {
    id: "las-preset-gamma",
    name: "Gamma Detail Export",
    description: "Gamma-focused LAS export with depth and temperature context.",
    isDefault: false,
    settings: {
      minimumDepth: 3700,
      maximumDepth: 3925,
      stepDepth: 0.25,
      maximumGap: 5,
      nullValue: "-9999.00",
    },
    options: {
      includeProjectedSurvey: false,
      includeSurveysInOtherSection: false,
      correctDepthColumnForTvd: false,
      dateTimeInFirstColumn: true,
      interpolateSurveyValues: false,
      useSurveyFormattedOutput: false,
    },
    columns: [
      availableLasColumns[0],
      availableLasColumns[7],
      availableLasColumns[8],
      availableLasColumns[9],
    ],
    updatedAt: nowIso(),
  },
];
