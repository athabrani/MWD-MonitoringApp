import { deflateSync, inflateSync } from "node:zlib";
import { prisma } from "../lib/prisma.js";
import {
  MWD_MEASUREMENT_FIELDS,
  type MeasurementField,
} from "../utils/mwd-measurements.js";
import * as plotTemplateService from "./plot-template.service.js";

type PdfPlotInput = {
  sessionId: number;
  sessionCode: string;
  wellName?: string | null;
  rigName?: string | null;
  templateId?: number;
  template?: Record<string, unknown>;
  depthMin?: number;
  depthMax?: number;
};

type PlotCurve = {
  key: string;
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  color?: string;
  lineWidth?: number;
};

type PlotTrack = {
  title: string;
  unit?: string;
  min: number;
  max: number;
  curves: PlotCurve[];
};

type HeaderField = {
  label: string;
  value?: string | number | null;
  source?: "sessionCode" | "wellName" | "rigName";
};

type PlotPageSettings = {
  size: "a4";
  orientation: "portrait" | "landscape";
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  headerHeightFirstPage: number;
  headerHeightOtherPages: number;
  trackHeaderHeight: number;
};

type PlotLogoConfig = {
  dataUrl: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
};

type PlotTemplateConfig = {
  title: string;
  scaleRatio: number;
  depthPerPage: number;
  depthStep: number;
  minorDepthStep: number;
  page: PlotPageSettings;
  logo?: PlotLogoConfig;
  headerFields: HeaderField[];
  tracks: PlotTrack[];
};

type PlotRow = {
  depth: number;
  measuredAt: Date | null;
  values: Record<string, number | null>;
};

type SurveyTableRow = {
  measuredDepth: number;
  inclination: number;
  azimuth: number;
  tvd: number | null;
  northing: number | null;
  easting: number | null;
  verticalSection: number | null;
  doglegSeverity: number | null;
  buildRate: number | null;
  turnRate: number | null;
};

type PdfPoint = {
  x: number;
  y: number;
};

type PdfImageResource = {
  name: string;
  width: number;
  height: number;
  colorSpace: "DeviceRGB" | "DeviceGray";
  bitsPerComponent: number;
  filter: "DCTDecode" | "FlateDecode";
  data: Buffer;
};

type RenderedLogo = {
  resource: PdfImageResource;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_TEMPLATE: PlotTemplateConfig = {
  title: "MD 1:500",
  scaleRatio: 500,
  depthPerPage: 150,
  depthStep: 50,
  minorDepthStep: 10,
  page: {
    size: "a4",
    orientation: "portrait",
    marginTop: 28,
    marginRight: 22,
    marginBottom: 24,
    marginLeft: 24,
    headerHeightFirstPage: 126,
    headerHeightOtherPages: 18,
    trackHeaderHeight: 172,
  },
  headerFields: [
    { label: "Company", value: "" },
    { label: "Well Name", source: "wellName" },
    { label: "Field", value: "" },
    { label: "Rig Id", source: "rigName" },
    { label: "Well ID", value: "" },
    { label: "Job number", value: "" },
    { label: "Province", value: "" },
    { label: "County/Parish", value: "" },
    { label: "Country", value: "" },
    { label: "Location", value: "" },
    { label: "Start Date", value: "" },
    { label: "End Date", value: "" },
  ],
  tracks: [
    {
      title: "Pressure",
      min: 0,
      max: 4000,
      curves: [
        { key: "annularPressure", label: "Pressure - Annular", unit: "psi", min: 0, max: 4000, color: "#008000" },
        { key: "borePressure", label: "Pressure - Bore", unit: "psi", min: 0, max: 4000, color: "#1f77b4" },
        { key: "standpipePressure", label: "Pump Press", unit: "PSI", min: 0, max: 4000, color: "#ff7f0e" },
        { key: "mwdPressure", label: "APWD - memory", unit: "", min: 0, max: 4000, color: "#2ca02c" },
      ],
    },
    {
      title: "Density Depth",
      min: 0,
      max: 2000,
      curves: [
        { key: "mudWeight", label: "Mud Weight (SG)", unit: "SG", min: 0, max: 2, color: "#8c564b" },
        { key: "ecd", label: "ECD from Annular Pressure - SG", unit: "SG", min: 0, max: 2, color: "#9467bd" },
        { key: "hole_depth", label: "Hole Depth", unit: "m", min: 0, max: 2000, color: "#111111" },
        { key: "ecd2", label: "ECD - calc from memory", unit: "", min: 0, max: 2, color: "#17becf" },
      ],
    },
    {
      title: "Dynamics",
      min: 0,
      max: 100,
      curves: [
        { key: "shockAxial", label: "Shock (ax,lat)", unit: "g", min: 0, max: 90, color: "#d62728" },
        { key: "vibrationAxial", label: "Vib (ax,lat)", unit: "g", min: 0, max: 25, color: "#2ca02c" },
        { key: "ssi", label: "SSI", unit: "", min: 0, max: 5, color: "#17becf" },
        { key: "downholeRpm", label: "RPM Downhole", unit: "rpm", min: 0, max: 100, color: "#bcbd22" },
        { key: "temperature", label: "Temp", unit: "C", min: 0, max: 100, color: "#e377c2" },
      ],
    },
    {
      title: "Surface",
      min: 0,
      max: 30,
      curves: [
        { key: "rop", label: "ROP", unit: "", min: 0, max: 10, color: "#7f7f7f" },
        { key: "hookLoad", label: "WOB", unit: "klbs", min: 0, max: 20, color: "#aec7e8" },
        { key: "hookPosition", label: "hookpos", unit: "m", min: 0, max: 30, color: "#ff7f0e" },
      ],
    },
  ],
};

const db = prisma as unknown as {
  mWDData: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
  surveyStation: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
  witsConfig: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toFiniteNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
};

const toNumberWithFallback = (value: unknown, fallback: number) => {
  const parsed = toFiniteNumber(value);
  return parsed !== null ? parsed : fallback;
};

const normalizeHeaderFields = (value: unknown, fallback: HeaderField[]) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const fields = value
    .filter(isRecord)
    .map((item) => {
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const source =
        item.source === "sessionCode" ||
        item.source === "wellName" ||
        item.source === "rigName"
          ? item.source
          : undefined;
      const field: HeaderField = { label };

      if (source !== undefined) {
        field.source = source;
      }

      if (item.value !== undefined && item.value !== null) {
        field.value = String(item.value);
      }

      return field;
    })
    .filter((item) => item.label);

  return fields.length > 0 ? fields : fallback;
};

const normalizeTracks = (value: unknown, fallback: PlotTrack[]) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const tracks = value
    .filter(isRecord)
    .map((item) => {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const min = toFiniteNumber(item.min);
      const max = toFiniteNumber(item.max);
      const curves = Array.isArray(item.curves)
        ? item.curves
            .filter(isRecord)
            .map((curve) => {
              const key = typeof curve.key === "string" ? curve.key.trim() : "";
              const parsed: PlotCurve = { key };

              if (typeof curve.label === "string" && curve.label.trim()) {
                parsed.label = curve.label.trim();
              }

              if (typeof curve.unit === "string") {
                parsed.unit = curve.unit.trim();
              }

              const min = toFiniteNumber(curve.min);
              const max = toFiniteNumber(curve.max);

              if (min !== null && max !== null && min !== max) {
                parsed.min = Math.min(min, max);
                parsed.max = Math.max(min, max);
              }

              if (typeof curve.color === "string" && curve.color.trim()) {
                parsed.color = curve.color.trim();
              }

              const lineWidth = toFiniteNumber(curve.lineWidth);

              if (lineWidth !== null && lineWidth > 0) {
                parsed.lineWidth = lineWidth;
              }

              return parsed;
            })
            .filter((curve) => curve.key)
        : [];

      if (!title || min === null || max === null || min === max || curves.length === 0) {
        return null;
      }

      const track: PlotTrack = {
        title,
        min: Math.min(min, max),
        max: Math.max(min, max),
        curves,
      };

      if (typeof item.unit === "string") {
        track.unit = item.unit.trim();
      }

      return track;
    })
    .filter((track): track is PlotTrack => track !== null);

  return tracks.length > 0 ? groupMwdTracks(tracks) : fallback;
};

const toCurveFromTrack = (
  track: PlotTrack | undefined,
  fallbackKey: string,
  fallbackLabel: string,
  fallbackColor: string,
) => {
  const curve = track?.curves[0];
  const parsed: PlotCurve = {
    key: curve?.key ?? fallbackKey,
    label: curve?.label ?? track?.title ?? fallbackLabel,
    color: curve?.color ?? fallbackColor,
  };
  const min = curve?.min ?? track?.min;
  const max = curve?.max ?? track?.max;

  if (min !== undefined) {
    parsed.min = min;
  }

  if (max !== undefined) {
    parsed.max = max;
  }

  const unit = curve?.unit ?? track?.unit;

  if (unit !== undefined) {
    parsed.unit = unit;
  }

  if (curve?.lineWidth !== undefined) {
    parsed.lineWidth = curve.lineWidth;
  }

  return parsed;
};

const findTrackByCurveKey = (tracks: PlotTrack[], key: string) => {
  return tracks.find((track) => track.curves.some((curve) => curve.key === key));
};

const groupMwdTracks = (tracks: PlotTrack[]) => {
  if (tracks.length <= 4) {
    return tracks;
  }

  const pressureTracks = [
    findTrackByCurveKey(tracks, "annularPressure"),
    findTrackByCurveKey(tracks, "borePressure"),
    findTrackByCurveKey(tracks, "standpipePressure"),
    findTrackByCurveKey(tracks, "mwdPressure"),
  ];
  const densityTracks = [
    findTrackByCurveKey(tracks, "mudWeight"),
    findTrackByCurveKey(tracks, "ecd"),
    findTrackByCurveKey(tracks, "depthMd"),
    findTrackByCurveKey(tracks, "ecd2"),
  ];
  const dynamicsTracks = [
    findTrackByCurveKey(tracks, "shockAxial") ?? findTrackByCurveKey(tracks, "shock"),
    findTrackByCurveKey(tracks, "vibrationAxial") ?? findTrackByCurveKey(tracks, "vibration"),
    findTrackByCurveKey(tracks, "ssi"),
    findTrackByCurveKey(tracks, "downholeRpm"),
    findTrackByCurveKey(tracks, "temperature"),
  ];
  const surfaceTracks = [
    findTrackByCurveKey(tracks, "rop"),
    findTrackByCurveKey(tracks, "hookLoad"),
    findTrackByCurveKey(tracks, "hookPosition"),
  ];

  if (
    pressureTracks.filter(Boolean).length < 2 ||
    densityTracks.filter(Boolean).length < 2 ||
    dynamicsTracks.filter(Boolean).length < 2 ||
    surfaceTracks.filter(Boolean).length < 2
  ) {
    return tracks;
  }

  return [
    {
      title: "Pressure",
      min: 0,
      max: 4000,
      curves: [
        toCurveFromTrack(pressureTracks[0], "annularPressure", "Pressure - Annular", "#008000"),
        toCurveFromTrack(pressureTracks[1], "borePressure", "Pressure - Bore", "#1f77b4"),
        toCurveFromTrack(pressureTracks[2], "standpipePressure", "Pump Press", "#ff7f0e"),
        toCurveFromTrack(pressureTracks[3], "mwdPressure", "APWD - memory", "#2ca02c"),
      ],
    },
    {
      title: "Density Depth",
      min: 0,
      max: 2000,
      curves: [
        toCurveFromTrack(densityTracks[0], "mudWeight", "Mud Weight (SG)", "#8c564b"),
        toCurveFromTrack(densityTracks[1], "ecd", "ECD from Annular Pressure - SG", "#9467bd"),
        toCurveFromTrack(densityTracks[2], "hole_depth", "Hole Depth", "#111111"),
        toCurveFromTrack(densityTracks[3], "ecd2", "ECD - calc from memory", "#17becf"),
      ],
    },
    {
      title: "Dynamics",
      min: 0,
      max: 100,
      curves: [
        toCurveFromTrack(dynamicsTracks[0], "shockAxial", "Shock (ax,lat)", "#d62728"),
        toCurveFromTrack(dynamicsTracks[1], "vibrationAxial", "Vib (ax,lat)", "#2ca02c"),
        toCurveFromTrack(dynamicsTracks[2], "ssi", "SSI", "#17becf"),
        toCurveFromTrack(dynamicsTracks[3], "downholeRpm", "RPM Downhole", "#bcbd22"),
        toCurveFromTrack(dynamicsTracks[4], "temperature", "Temp", "#e377c2"),
      ],
    },
    {
      title: "Surface",
      min: 0,
      max: 30,
      curves: [
        toCurveFromTrack(surfaceTracks[0], "rop", "ROP", "#7f7f7f"),
        toCurveFromTrack(surfaceTracks[1], "hookLoad", "WOB", "#aec7e8"),
        toCurveFromTrack(surfaceTracks[2], "hookPosition", "hookpos", "#ff7f0e"),
      ],
    },
  ];
};

const normalizePageSettings = (
  value: unknown,
  fallback: PlotPageSettings,
): PlotPageSettings => {
  const page = isRecord(value) ? value : {};
  const orientation = page.orientation === "landscape" ? "landscape" : "portrait";

  return {
    size: "a4",
    orientation,
    marginTop: toPositiveNumber(page.marginTop, fallback.marginTop),
    marginRight: toPositiveNumber(page.marginRight, fallback.marginRight),
    marginBottom: toPositiveNumber(page.marginBottom, fallback.marginBottom),
    marginLeft: toPositiveNumber(page.marginLeft, fallback.marginLeft),
    headerHeightFirstPage: toPositiveNumber(
      page.headerHeightFirstPage,
      fallback.headerHeightFirstPage,
    ),
    headerHeightOtherPages: toPositiveNumber(
      page.headerHeightOtherPages,
      fallback.headerHeightOtherPages,
    ),
    trackHeaderHeight: toPositiveNumber(
      page.trackHeaderHeight,
      fallback.trackHeaderHeight,
    ),
  };
};

const normalizeLogo = (
  value: unknown,
  fallback?: PlotLogoConfig,
) => {
  if (value === null) {
    return undefined;
  }

  if (!isRecord(value)) {
    return fallback;
  }

  const dataUrl =
    typeof value.dataUrl === "string" && value.dataUrl.trim()
      ? value.dataUrl.trim()
      : fallback?.dataUrl;

  if (!dataUrl) {
    return undefined;
  }

  const logo: PlotLogoConfig = { dataUrl };
  const width = toFiniteNumber(value.width);
  const height = toFiniteNumber(value.height);
  const x = toFiniteNumber(value.x);
  const y = toFiniteNumber(value.y);

  if (width !== null && width > 0) {
    logo.width = width;
  } else if (fallback?.width !== undefined) {
    logo.width = fallback.width;
  }

  if (height !== null && height > 0) {
    logo.height = height;
  } else if (fallback?.height !== undefined) {
    logo.height = fallback.height;
  }

  if (x !== null) {
    logo.x = x;
  } else if (fallback?.x !== undefined) {
    logo.x = fallback.x;
  }

  if (y !== null) {
    logo.y = y;
  } else if (fallback?.y !== undefined) {
    logo.y = fallback.y;
  }

  return logo;
};

const mergeTemplateConfig = (
  fallback: PlotTemplateConfig,
  override?: unknown,
) => {
  if (!isRecord(override)) {
    return fallback;
  }

  const logo = normalizeLogo(override.logo, fallback.logo);
  const config: PlotTemplateConfig = {
    title:
      typeof override.title === "string" && override.title.trim()
        ? override.title.trim()
        : fallback.title,
    scaleRatio: toPositiveNumber(override.scaleRatio, fallback.scaleRatio),
    depthPerPage: toPositiveNumber(override.depthPerPage, fallback.depthPerPage),
    depthStep: toPositiveNumber(override.depthStep, fallback.depthStep),
    minorDepthStep: toPositiveNumber(
      override.minorDepthStep,
      fallback.minorDepthStep,
    ),
    page: normalizePageSettings(override.page, fallback.page),
    headerFields: normalizeHeaderFields(override.headerFields, fallback.headerFields),
    tracks: normalizeTracks(override.tracks, fallback.tracks),
  };

  if (logo) {
    config.logo = logo;
  }

  return config;
};

const escapePdfText = (value: unknown) => {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7e]/g, "");
};

const colorToRgb = (value: string | undefined, fallback: string) => {
  const color = /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value ?? fallback : fallback;
  const r = Number.parseInt(color.slice(1, 3), 16) / 255;
  const g = Number.parseInt(color.slice(3, 5), 16) / 255;
  const b = Number.parseInt(color.slice(5, 7), 16) / 255;

  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
};

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(4).replace(/0+$/g, "").replace(/\.$/g, "");
};

const formatDateTime = (value: Date | null) => {
  if (!value) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");

  return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
};

const truncate = (value: string, maxLength: number) => {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}.` : value;
};

const estimateTextWidth = (value: string, size: number) => {
  return value.length * size * 0.48;
};

const readUInt32 = (buffer: Buffer, offset: number) => {
  return buffer.readUInt32BE(offset);
};

const parseDataUrl = (value: string) => {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i);

  if (!match) {
    return null;
  }

  const [, mimeType, data] = match;

  if (!mimeType || !data) {
    return null;
  }

  return {
    mimeType: mimeType.toLowerCase(),
    data: Buffer.from(data, "base64"),
  };
};

const parseJpegImage = (
  data: Buffer,
  name: string,
): PdfImageResource | null => {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (data[offset] === 0xff) {
      offset += 1;
    }

    const marker = data[offset];
    offset += 1;

    if (marker === undefined || marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 2 > data.length) {
      break;
    }

    const length = data.readUInt16BE(offset);

    if (length < 2 || offset + length > data.length) {
      break;
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && offset + 8 <= data.length) {
      const bitsPerComponent = data[offset + 2] ?? 8;
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      const components = data[offset + 7] ?? 3;

      return {
        name,
        width,
        height,
        colorSpace: components === 1 ? "DeviceGray" : "DeviceRGB",
        bitsPerComponent,
        filter: "DCTDecode",
        data,
      };
    }

    offset += length;
  }

  return null;
};

const paethPredictor = (left: number, above: number, upperLeft: number) => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  if (aboveDistance <= upperLeftDistance) {
    return above;
  }

  return upperLeft;
};

const unfilterPngScanlines = (
  inflated: Buffer,
  width: number,
  height: number,
  bytesPerPixel: number,
) => {
  const rowLength = width * bytesPerPixel;
  const output = Buffer.alloc(rowLength * height);
  let inputOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;

    const outputOffset = row * rowLength;
    const previousOffset = outputOffset - rowLength;

    for (let column = 0; column < rowLength; column += 1) {
      const raw = inflated[inputOffset + column] ?? 0;
      const left =
        column >= bytesPerPixel ? output[outputOffset + column - bytesPerPixel] ?? 0 : 0;
      const above = row > 0 ? output[previousOffset + column] ?? 0 : 0;
      const upperLeft =
        row > 0 && column >= bytesPerPixel
          ? output[previousOffset + column - bytesPerPixel] ?? 0
          : 0;
      let value = raw;

      if (filterType === 1) {
        value = raw + left;
      } else if (filterType === 2) {
        value = raw + above;
      } else if (filterType === 3) {
        value = raw + Math.floor((left + above) / 2);
      } else if (filterType === 4) {
        value = raw + paethPredictor(left, above, upperLeft);
      } else if (filterType !== 0) {
        return null;
      }

      output[outputOffset + column] = value & 0xff;
    }

    inputOffset += rowLength;
  }

  return output;
};

const parsePngImage = (
  data: Buffer,
  name: string,
): PdfImageResource | null => {
  const signature = "89504e470d0a1a0a";

  if (data.length < 8 || data.subarray(0, 8).toString("hex") !== signature) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= data.length) {
    const length = readUInt32(data, offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;

    if (chunkEnd + 4 > data.length) {
      return null;
    }

    const chunkData = data.subarray(chunkStart, chunkEnd);

    if (type === "IHDR") {
      width = readUInt32(chunkData, 0);
      height = readUInt32(chunkData, 4);
      bitDepth = chunkData[8] ?? 0;
      colorType = chunkData[9] ?? 0;
      interlaceMethod = chunkData[12] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(chunkData);
    } else if (type === "IEND") {
      break;
    }

    offset = chunkEnd + 4;
  }

  if (
    width <= 0 ||
    height <= 0 ||
    bitDepth !== 8 ||
    interlaceMethod !== 0 ||
    idatChunks.length === 0
  ) {
    return null;
  }

  const bytesPerPixel = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;

  if (bytesPerPixel === 0) {
    return null;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const unfiltered = unfilterPngScanlines(inflated, width, height, bytesPerPixel);

  if (!unfiltered) {
    return null;
  }

  if (colorType === 0) {
    return {
      name,
      width,
      height,
      colorSpace: "DeviceGray",
      bitsPerComponent: 8,
      filter: "FlateDecode",
      data: deflateSync(unfiltered),
    };
  }

  if (colorType === 2) {
    return {
      name,
      width,
      height,
      colorSpace: "DeviceRGB",
      bitsPerComponent: 8,
      filter: "FlateDecode",
      data: deflateSync(unfiltered),
    };
  }

  const rgb = Buffer.alloc(width * height * 3);

  for (let source = 0, target = 0; source < unfiltered.length; source += 4, target += 3) {
    const alpha = (unfiltered[source + 3] ?? 255) / 255;
    rgb[target] = Math.round((unfiltered[source] ?? 255) * alpha + 255 * (1 - alpha));
    rgb[target + 1] = Math.round((unfiltered[source + 1] ?? 255) * alpha + 255 * (1 - alpha));
    rgb[target + 2] = Math.round((unfiltered[source + 2] ?? 255) * alpha + 255 * (1 - alpha));
  }

  return {
    name,
    width,
    height,
    colorSpace: "DeviceRGB",
    bitsPerComponent: 8,
    filter: "FlateDecode",
    data: deflateSync(rgb),
  };
};

const parseImageResource = (
  dataUrl: string,
  name: string,
) => {
  const parsed = parseDataUrl(dataUrl);

  if (!parsed) {
    return null;
  }

  if (parsed.mimeType === "image/jpeg" || parsed.mimeType === "image/jpg") {
    return parseJpegImage(parsed.data, name);
  }

  if (parsed.mimeType === "image/png") {
    return parsePngImage(parsed.data, name);
  }

  return null;
};

const buildLogo = (logo?: PlotLogoConfig): RenderedLogo | null => {
  if (!logo) {
    return null;
  }

  const resource = parseImageResource(logo.dataUrl, "Logo1");

  if (!resource) {
    return null;
  }

  const maxWidth = 86;
  const maxHeight = 36;
  const aspectRatio = resource.width / resource.height;
  const requestedWidth = logo.width ?? maxWidth;
  const requestedHeight = logo.height ?? requestedWidth / aspectRatio;
  const scale = Math.min(maxWidth / requestedWidth, maxHeight / requestedHeight, 1);
  const width = requestedWidth * scale;
  const height = requestedHeight * scale;

  return {
    resource,
    x: logo.x ?? 28,
    y: logo.y ?? 18,
    width,
    height,
  };
};

class PdfPageBuilder {
  private readonly parts: string[] = [];

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  private y(top: number) {
    return this.height - top;
  }

  line(
    x1: number,
    topY1: number,
    x2: number,
    topY2: number,
    color = "#000000",
    width = 0.5,
  ) {
    this.parts.push(
      `q ${colorToRgb(color, "#000000")} RG ${width} w ${x1.toFixed(2)} ${this.y(topY1).toFixed(2)} m ${x2.toFixed(2)} ${this.y(topY2).toFixed(2)} l S Q`,
    );
  }

  rect(
    x: number,
    topY: number,
    width: number,
    height: number,
    color = "#000000",
    lineWidth = 0.5,
  ) {
    this.parts.push(
      `q ${colorToRgb(color, "#000000")} RG ${lineWidth} w ${x.toFixed(2)} ${(this.y(topY) - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`,
    );
  }

  text(
    value: unknown,
    x: number,
    topY: number,
    size = 8,
    color = "#000000",
  ) {
    this.parts.push(
      `q ${colorToRgb(color, "#000000")} rg BT /F1 ${size} Tf ${x.toFixed(2)} ${(this.y(topY) - size).toFixed(2)} Td (${escapePdfText(value)}) Tj ET Q`,
    );
  }

  image(
    name: string,
    x: number,
    topY: number,
    width: number,
    height: number,
  ) {
    this.parts.push(
      `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${(this.y(topY) - height).toFixed(2)} cm /${name} Do Q`,
    );
  }

  polyline(points: PdfPoint[], color = "#000000", lineWidth = 0.8) {
    const firstPoint = points[0];

    if (!firstPoint || points.length < 2) {
      return;
    }

    const path = [
      `${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)} m`,
      ...points.slice(1).map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)} l`),
    ].join(" ");

    this.parts.push(
      `q ${colorToRgb(color, "#000000")} RG ${lineWidth} w ${path} S Q`,
    );
  }

  build() {
    return this.parts.join("\n");
  }
}

class SimplePdfDocument {
  private readonly pages: string[] = [];

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly images: PdfImageResource[] = [],
  ) {}

  addPage(content: string) {
    this.pages.push(content);
  }

  build() {
    const objects: Buffer[] = [];
    const imageStartObjectId = 4;
    const pageStartObjectId = imageStartObjectId + this.images.length;
    const kids = this.pages
      .map((_page, index) => `${pageStartObjectId + index * 2} 0 R`)
      .join(" ");

    objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "utf8"));
    objects.push(Buffer.from(`<< /Type /Pages /Count ${this.pages.length} /Kids [${kids}] >>`, "utf8"));
    objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "utf8"));

    for (const image of this.images) {
      const imageDictionary =
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent} ` +
        `/Filter /${image.filter} /Length ${image.data.length} >>\nstream\n`;
      objects.push(
        Buffer.concat([
          Buffer.from(imageDictionary, "utf8"),
          image.data,
          Buffer.from("\nendstream", "utf8"),
        ]),
      );
    }

    const xObjectEntries = this.images
      .map((image, index) => `/${image.name} ${imageStartObjectId + index} 0 R`)
      .join(" ");
    const xObjectResource = xObjectEntries ? `/XObject << ${xObjectEntries} >>` : "";

    for (const [index, content] of this.pages.entries()) {
      const pageObjectId = pageStartObjectId + index * 2;
      const contentObjectId = pageObjectId + 1;

      objects.push(Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Resources << /Font << /F1 3 0 R >> ${xObjectResource} >> /Contents ${contentObjectId} 0 R >>`,
        "utf8",
      ));
      objects.push(Buffer.from(
        `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
        "utf8",
      ));
    }

    const chunks = [Buffer.from("%PDF-1.4\n", "utf8")];
    const offsets = [0];
    let byteLength = chunks[0]?.length ?? 0;

    for (const [index, object] of objects.entries()) {
      offsets[index + 1] = byteLength;
      const objectBuffer = Buffer.concat([
        Buffer.from(`${index + 1} 0 obj\n`, "utf8"),
        object,
        Buffer.from("\nendobj\n", "utf8"),
      ]);
      chunks.push(objectBuffer);
      byteLength += objectBuffer.length;
    }

    const xrefOffset = byteLength;
    let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

    for (let index = 1; index <= objects.length; index += 1) {
      const offset = offsets[index] ?? 0;
      trailer += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }

    trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(Buffer.from(trailer, "utf8"));

    return Buffer.concat(chunks);
  }
}

const resolveHeaderValue = (
  field: HeaderField,
  input: PdfPlotInput,
) => {
  if (field.source === "sessionCode") {
    return input.sessionCode;
  }

  if (field.source === "wellName") {
    return input.wellName ?? "";
  }

  if (field.source === "rigName") {
    return input.rigName ?? "";
  }

  return field.value ?? "";
};

const getPageSize = (settings: PlotPageSettings) => {
  const portrait = { width: 595.44, height: 841.68 };

  if (settings.orientation === "landscape") {
    return { width: portrait.height, height: portrait.width };
  }

  return portrait;
};

const collectCurveKeys = (tracks: PlotTrack[]) => {
  const fieldNames = new Set<string>(MWD_MEASUREMENT_FIELDS);

  return Array.from(
    new Set(
      tracks.flatMap((track) =>
        track.curves
          .map((curve) => curve.key)
          .filter((key) => fieldNames.has(key)),
      ),
    ),
  ) as MeasurementField[];
};

const isWitsIdKey = (value: string) => {
  return /^\d{4}$/.test(value.trim());
};

const resolveWitsCurveKeys = async (config: PlotTemplateConfig) => {
  const fieldNames = new Set<string>(MWD_MEASUREMENT_FIELDS);
  const witsIds = Array.from(
    new Set(
      config.tracks.flatMap((track) =>
        track.curves
          .map((curve) => curve.key.trim())
          .filter(isWitsIdKey),
      ),
    ),
  );

  if (witsIds.length === 0) {
    return config;
  }

  const configs = await db.witsConfig.findMany({
    where: {
      witsId: { in: witsIds },
    },
    select: {
      witsId: true,
      name: true,
      units: true,
      mappedField: true,
      plotScaleLeft: true,
      plotScaleRight: true,
      lineColor: true,
    },
  });
  const configByWitsId = new Map(
    configs.map((item) => [String(item.witsId), item]),
  );

  return {
    ...config,
    tracks: config.tracks.map((track) => ({
      ...track,
      curves: track.curves.map((curve) => {
        const witsConfig = configByWitsId.get(curve.key);
        const mappedField =
          typeof witsConfig?.mappedField === "string"
            ? witsConfig.mappedField
            : "";

        if (!fieldNames.has(mappedField)) {
          return curve;
        }

        const nextCurve: PlotCurve = {
          ...curve,
          key: mappedField,
        };
        const label =
          curve.label ??
          (typeof witsConfig?.name === "string" ? witsConfig.name : curve.key);
        const unit =
          curve.unit ??
          (typeof witsConfig?.units === "string" ? witsConfig.units : undefined);
        const min = curve.min ?? toFiniteNumber(witsConfig?.plotScaleLeft);
        const max = curve.max ?? toFiniteNumber(witsConfig?.plotScaleRight);
        const color =
          curve.color ??
          (typeof witsConfig?.lineColor === "string"
            ? witsConfig.lineColor
            : undefined);

        if (label !== undefined) {
          nextCurve.label = label;
        }

        if (unit !== undefined) {
          nextCurve.unit = unit;
        }

        if (min !== null && min !== undefined) {
          nextCurve.min = min;
        }

        if (max !== null && max !== undefined) {
          nextCurve.max = max;
        }

        if (color !== undefined) {
          nextCurve.color = color;
        }

        return nextCurve;
      }),
    })),
  };
};

const fetchPlotRows = async (
  input: PdfPlotInput,
  curveKeys: MeasurementField[],
) => {
  const select: Record<string, boolean> = {
    measuredAt: true,
    depthMd: true,
  };

  for (const key of curveKeys) {
    select[key] = true;
  }

  const depthFilter: Record<string, number> = {};

  if (input.depthMin !== undefined) {
    depthFilter.gte = input.depthMin;
  }

  if (input.depthMax !== undefined) {
    depthFilter.lte = input.depthMax;
  }

  const rows = await db.mWDData.findMany({
    where: {
      sessionId: input.sessionId,
      isHidden: false,
      ...(Object.keys(depthFilter).length > 0 ? { depthMd: depthFilter } : {}),
    },
    orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }],
    select,
  });

  return rows
    .map((row) => {
      const depth = toFiniteNumber(row.depthMd);

      if (depth === null) {
        return null;
      }

      const values: Record<string, number | null> = {};

      for (const key of curveKeys) {
        values[key] = toFiniteNumber(row[key]);
      }

      return {
        depth,
        measuredAt: row.measuredAt instanceof Date ? row.measuredAt : null,
        values,
      };
    })
    .filter((row): row is PlotRow => row !== null)
    .sort((left, right) => left.depth - right.depth);
};

const fetchSurveyTableRows = async (input: PdfPlotInput) => {
  const depthFilter: Record<string, number> = {};

  if (input.depthMin !== undefined) {
    depthFilter.gte = input.depthMin;
  }

  if (input.depthMax !== undefined) {
    depthFilter.lte = input.depthMax;
  }

  const rows = await db.surveyStation.findMany({
    where: {
      sessionId: input.sessionId,
      stationType: "actual",
      ...(Object.keys(depthFilter).length > 0
        ? { measuredDepth: depthFilter }
        : {}),
    },
    orderBy: [{ measuredDepth: "asc" }, { id: "asc" }],
    select: {
      measuredDepth: true,
      inclination: true,
      azimuth: true,
      tvd: true,
      northing: true,
      easting: true,
      verticalSection: true,
      doglegSeverity: true,
      buildRate: true,
      turnRate: true,
    },
  });

  return rows
    .map((row): SurveyTableRow | null => {
      const measuredDepth = toFiniteNumber(row.measuredDepth);
      const inclination = toFiniteNumber(row.inclination);
      const azimuth = toFiniteNumber(row.azimuth);

      if (
        measuredDepth === null ||
        inclination === null ||
        azimuth === null
      ) {
        return null;
      }

      return {
        measuredDepth,
        inclination,
        azimuth,
        tvd: toFiniteNumber(row.tvd),
        northing: toFiniteNumber(row.northing),
        easting: toFiniteNumber(row.easting),
        verticalSection: toFiniteNumber(row.verticalSection),
        doglegSeverity: toFiniteNumber(row.doglegSeverity),
        buildRate: toFiniteNumber(row.buildRate),
        turnRate: toFiniteNumber(row.turnRate),
      };
    })
    .filter((row): row is SurveyTableRow => row !== null);
};

const findNearestRow = (rows: PlotRow[], depth: number) => {
  let nearest: PlotRow | null = null;
  let distance = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const nextDistance = Math.abs(row.depth - depth);

    if (nextDistance < distance) {
      nearest = row;
      distance = nextDistance;
    }
  }

  return nearest;
};

const drawHeader = (
  page: PdfPageBuilder,
  input: PdfPlotInput,
  config: PlotTemplateConfig,
  width: number,
  logo: RenderedLogo | null,
) => {
  const title = input.wellName || input.sessionCode;
  const titleSize = 18;
  const titleX = width / 2 - estimateTextWidth(title, titleSize) / 2;

  if (logo) {
    page.image(logo.resource.name, logo.x, logo.y, logo.width, logo.height);
  }

  page.text(title, Math.max(24, titleX), 28, titleSize);
  page.text("MD", width - 42, 18, 9);
  page.text(`1:${formatNumber(config.scaleRatio)}`, width - 48, 34, 8);

  const fields = config.headerFields;
  const rowHeight = 11.2;
  const leftFields = fields.slice(0, Math.ceil(fields.length / 2));
  const rightFields = fields.slice(Math.ceil(fields.length / 2));

  for (const [index, field] of leftFields.entries()) {
    const y = 64 + index * rowHeight;
    const value = resolveHeaderValue(field, input);

    page.text(`${field.label}: ${value}`, 48, y, 7.2);
  }

  for (const [index, field] of rightFields.entries()) {
    const y = 64 + index * rowHeight;
    const value = resolveHeaderValue(field, input);

    page.text(`${field.label}: ${value}`, 360, y, 7.2);
  }
};

const drawTrackHeaders = (
  page: PdfPageBuilder,
  tracks: PlotTrack[],
  getTrackX: (index: number) => number,
  topY: number,
  trackWidth: number,
  headerHeight: number,
) => {
  for (const [index, track] of tracks.entries()) {
    const trackX = getTrackX(index);
    const rowHeight = Math.min(32, Math.max(24, headerHeight / Math.max(1, track.curves.length)));
    const maxTitleChars = Math.max(12, Math.floor((trackWidth - 8) / 4.7));

    page.rect(trackX, topY, trackWidth, headerHeight, "#000000", 1.1);

    for (const [curveIndex, curve] of track.curves.entries()) {
      const curveTop = topY + 8 + curveIndex * rowHeight;
      const min = curve.min ?? track.min;
      const max = curve.max ?? track.max;
      const unit = curve.unit ?? track.unit ?? "";
      const color = curve.color ?? "#000000";
      const label = truncate(curve.label ?? curve.key, maxTitleChars);
      const labelX = trackX + Math.max(3, (trackWidth - estimateTextWidth(label, 8)) / 2);

      if (curveTop + 24 > topY + headerHeight) {
        continue;
      }

      page.text(label, labelX, curveTop, 8);

      if (unit) {
        const unitText = truncate(unit, 8);
        const unitX = trackX + Math.max(3, (trackWidth - estimateTextWidth(unitText, 5)) / 2);
        page.text(unitText, unitX, curveTop + 11, 5);
      }

      page.text(formatNumber(min), trackX + 8, curveTop + 21, 5);
      page.text(
        formatNumber(max),
        trackX + Math.max(8, trackWidth - estimateTextWidth(formatNumber(max), 5) - 8),
        curveTop + 21,
        5,
      );
      page.line(trackX + trackWidth * 0.26, curveTop + 24, trackX + trackWidth * 0.74, curveTop + 24, color, curve.lineWidth ?? 1.2);
    }
  }
};

const drawPlotPage = (
  input: PdfPlotInput,
  config: PlotTemplateConfig,
  logo: RenderedLogo | null,
  pageIndex: number,
  pageCount: number,
  pageStartDepth: number,
  pageEndDepth: number,
  rows: PlotRow[],
  width: number,
  height: number,
) => {
  const builder = new PdfPageBuilder(width, height);
  const settings = config.page;
  const headerHeight =
    pageIndex === 0
      ? settings.headerHeightFirstPage
      : settings.headerHeightOtherPages;
  const headerTop = settings.marginTop;
  const trackHeaderTop = settings.marginTop + headerHeight;
  const trackHeaderHeight = pageIndex === 0 ? settings.trackHeaderHeight : 0;
  const plotTop = trackHeaderTop + trackHeaderHeight;
  const footerTop = height - settings.marginBottom - 14;
  const plotBottom = footerTop - 4;
  const plotHeight = plotBottom - plotTop;
  const trackStartX = settings.marginLeft;
  const plotRight = width - settings.marginRight;
  const trackAreaWidth = plotRight - trackStartX;
  const mdColumnWidth = config.tracks.length >= 4 ? 36 : 0;
  const trackWidth = (trackAreaWidth - mdColumnWidth) / config.tracks.length;
  const getTrackX = (index: number) =>
    trackStartX + index * trackWidth + (index > 0 ? mdColumnWidth : 0);
  const mdColumnX = trackStartX + trackWidth;
  const depthSpan = Math.max(1, pageEndDepth - pageStartDepth);
  const depthToTopY = (depth: number) =>
    plotTop + ((depth - pageStartDepth) / depthSpan) * plotHeight;

  builder.rect(
    settings.marginLeft,
    plotTop,
    plotRight - settings.marginLeft,
    plotHeight,
    "#444444",
    0.6,
  );

  if (pageIndex === 0) {
    drawHeader(builder, input, config, width, logo);
  } else {
    builder.text("MD", mdColumnX + 8, headerTop, 8);
  }

  if (pageIndex === 0) {
    drawTrackHeaders(
      builder,
      config.tracks,
      getTrackX,
      trackHeaderTop,
      trackWidth,
      settings.trackHeaderHeight,
    );
    if (mdColumnWidth > 0) {
      builder.rect(mdColumnX, trackHeaderTop, mdColumnWidth, settings.trackHeaderHeight, "#000000", 1.1);
      builder.text("MD", mdColumnX + 9, trackHeaderTop + 12, 8);
    }
  }

  const firstMinorDepth =
    Math.ceil(pageStartDepth / config.minorDepthStep) * config.minorDepthStep;

  for (
    let depth = firstMinorDepth;
    depth <= pageEndDepth + 0.0001;
    depth += config.minorDepthStep
  ) {
    const topY = depthToTopY(depth);
    const isMajor =
      Math.abs(depth / config.depthStep - Math.round(depth / config.depthStep)) <
      0.0001;

    builder.line(
      settings.marginLeft,
      topY,
      plotRight,
      topY,
      isMajor ? "#999999" : "#dddddd",
      isMajor ? 0.55 : 0.25,
    );

    if (isMajor) {
      const depthText = formatNumber(depth);
      const depthX =
        mdColumnWidth > 0
          ? mdColumnX + Math.max(2, (mdColumnWidth - estimateTextWidth(depthText, 8)) / 2)
          : settings.marginLeft + 5;

      builder.text(depthText, depthX, topY - 8, 8);
      const nearestRow = findNearestRow(rows, depth);
      const timestamp = formatDateTime(nearestRow?.measuredAt ?? null);

      if (timestamp) {
        const [datePart, timePart] = timestamp.split(" ");
        const dateX = mdColumnWidth > 0 ? mdColumnX + 2 : settings.marginLeft + 5;

        builder.text(datePart ?? "", dateX, topY + 8, 5.5);
        builder.text(timePart ?? "", dateX + 8, topY + 15, 5.5);
      }
    }
  }

  for (let index = 0; index < config.tracks.length; index += 1) {
    const x = getTrackX(index);
    builder.line(x, plotTop, x, plotBottom, "#000000", 1.1);

    for (let gridIndex = 1; gridIndex < 5; gridIndex += 1) {
      const gridX = x + (trackWidth / 5) * gridIndex;
      builder.line(gridX, plotTop, gridX, plotBottom, "#cccccc", 0.25);
    }
  }

  builder.line(plotRight, plotTop, plotRight, plotBottom, "#000000", 1.1);

  if (mdColumnWidth > 0) {
    builder.line(mdColumnX, plotTop, mdColumnX, plotBottom, "#000000", 1.1);
    builder.line(mdColumnX + mdColumnWidth, plotTop, mdColumnX + mdColumnWidth, plotBottom, "#000000", 1.1);
  }

  for (const [trackIndex, track] of config.tracks.entries()) {
    const trackX = getTrackX(trackIndex);

    for (const curve of track.curves) {
      const segments: PdfPoint[][] = [];
      let activeSegment: PdfPoint[] = [];

      for (const row of rows) {
        if (row.depth < pageStartDepth || row.depth > pageEndDepth) {
          continue;
        }

        const value = row.values[curve.key];
        const min = curve.min ?? track.min;
        const max = curve.max ?? track.max;
        const range = max - min;

        if (value === null || value === undefined || range <= 0) {
          if (activeSegment.length > 1) {
            segments.push(activeSegment);
          }

          activeSegment = [];
          continue;
        }

        const normalized = Math.max(0, Math.min(1, (value - min) / range));
        const x = trackX + normalized * trackWidth;
        const topY = depthToTopY(row.depth);

        activeSegment.push({ x, y: height - topY });
      }

      if (activeSegment.length > 1) {
        segments.push(activeSegment);
      }

      for (const segment of segments) {
        builder.polyline(segment, curve.color ?? "#000000", curve.lineWidth ?? 0.75);
      }
    }
  }

  builder.text(
    `MD ${formatNumber(pageStartDepth)} - ${formatNumber(pageEndDepth)} | Page ${pageIndex + 1}/${pageCount} | Scale 1:${config.scaleRatio}`,
    settings.marginLeft,
    footerTop,
    7,
  );

  return builder.build();
};

const formatSurveyValue = (value: number | null, decimals = 2) => {
  if (value === null) {
    return "";
  }

  return value.toFixed(decimals).replace(/0+$/g, "").replace(/\.$/g, "");
};

const drawSurveyCell = (
  builder: PdfPageBuilder,
  value: string,
  x: number,
  topY: number,
  width: number,
  height: number,
  options: {
    fontSize?: number;
    bold?: boolean;
    align?: "left" | "center";
  } = {},
) => {
  const fontSize = options.fontSize ?? 6.5;
  const text = truncate(value, Math.max(4, Math.floor((width - 4) / (fontSize * 0.45))));
  const textWidth = estimateTextWidth(text, fontSize);
  const textX =
    options.align === "center"
      ? x + Math.max(2, (width - textWidth) / 2)
      : x + 3;

  builder.rect(x, topY, width, height, "#777777", 0.25);
  builder.text(text, textX, topY + Math.max(3, (height - fontSize) / 2), fontSize);

  if (options.bold) {
    builder.line(x + 1, topY + height - 2, x + width - 1, topY + height - 2, "#222222", 0.45);
  }
};

const drawSurveyTablePage = (
  input: PdfPlotInput,
  rows: SurveyTableRow[],
  pageRows: SurveyTableRow[],
  pageIndex: number,
  pageCount: number,
  width: number,
  height: number,
) => {
  const builder = new PdfPageBuilder(width, height);
  const marginLeft = 24;
  const marginRight = 22;
  const tableTop = 82;
  const rowHeight = 17;
  const tableWidth = width - marginLeft - marginRight;
  const headers = [
    "MD",
    "Inc",
    "Azi",
    "TVD",
    "North",
    "East",
    "V.Sec",
    "DLS",
    "Build",
    "Turn",
  ];
  const columnWeights = [1.08, 0.9, 0.9, 1, 1, 1, 1, 0.92, 0.92, 0.92];
  const totalWeight = columnWeights.reduce((total, value) => total + value, 0);
  const columnWidths = columnWeights.map((weight) => (tableWidth * weight) / totalWeight);
  const title = "Survey Data";
  const subtitle = `${input.wellName || input.sessionCode} | Actual survey stations`;

  builder.text(title, marginLeft, 30, 15);
  builder.text(subtitle, marginLeft, 50, 8);
  builder.text(`Rows ${rows.length} | Page ${pageIndex + 1}/${pageCount}`, width - 128, 50, 8);

  let x = marginLeft;

  for (const [index, header] of headers.entries()) {
    const columnWidth = columnWidths[index] ?? 48;
    drawSurveyCell(builder, header, x, tableTop, columnWidth, rowHeight, {
      fontSize: 6.8,
      bold: true,
      align: "center",
    });
    x += columnWidth;
  }

  for (const [rowIndex, row] of pageRows.entries()) {
    const y = tableTop + rowHeight * (rowIndex + 1);
    const values = [
      formatSurveyValue(row.measuredDepth, 2),
      formatSurveyValue(row.inclination, 2),
      formatSurveyValue(row.azimuth, 2),
      formatSurveyValue(row.tvd, 2),
      formatSurveyValue(row.northing, 2),
      formatSurveyValue(row.easting, 2),
      formatSurveyValue(row.verticalSection, 2),
      formatSurveyValue(row.doglegSeverity, 2),
      formatSurveyValue(row.buildRate, 2),
      formatSurveyValue(row.turnRate, 2),
    ];

    x = marginLeft;

    for (const [columnIndex, value] of values.entries()) {
      const columnWidth = columnWidths[columnIndex] ?? 48;
      drawSurveyCell(builder, value, x, y, columnWidth, rowHeight, {
        fontSize: 6.4,
        align: "center",
      });
      x += columnWidth;
    }
  }

  builder.text("Survey table appended after generated MWD plot.", marginLeft, height - 34, 7);

  return builder.build();
};

const sanitizeFileName = (value: string) => {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
};

export const buildPdfPlot = async (input: PdfPlotInput) => {
  let config = DEFAULT_TEMPLATE;

  if (input.templateId !== undefined) {
    const template = await plotTemplateService.getPlotTemplateById(input.templateId);

    if (!template || !isRecord(template) || !isRecord(template.config)) {
      throw new Error("Plot template not found");
    }

    config = mergeTemplateConfig(config, template.config);
  } else {
    const template = await plotTemplateService.getDefaultPlotTemplate();

    if (template && isRecord(template) && isRecord(template.config)) {
      config = mergeTemplateConfig(config, template.config);
    }
  }

  config = mergeTemplateConfig(config, input.template);
  config = await resolveWitsCurveKeys(config);

  const curveKeys = collectCurveKeys(config.tracks);
  const rows = await fetchPlotRows(input, curveKeys);
  const surveyRows = await fetchSurveyTableRows(input);
  const depthValues = rows.map((row) => row.depth);
  const firstDepth =
    input.depthMin ?? depthValues[0] ?? 0;
  const lastDepth =
    input.depthMax ?? depthValues[depthValues.length - 1] ?? firstDepth + config.depthPerPage;
  const startDepth = Math.min(firstDepth, lastDepth);
  const endDepth = Math.max(firstDepth, lastDepth);
  const { width, height } = getPageSize(config.page);
  const logo = buildLogo(config.logo);
  const pageCount = Math.max(
    1,
    Math.ceil((endDepth - startDepth || config.depthPerPage) / config.depthPerPage),
  );
  const document = new SimplePdfDocument(
    width,
    height,
    logo ? [logo.resource] : [],
  );

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageStartDepth = startDepth + pageIndex * config.depthPerPage;
    const pageEndDepth =
      pageIndex === pageCount - 1
        ? endDepth
        : pageStartDepth + config.depthPerPage;

    document.addPage(
      drawPlotPage(
        input,
        config,
        logo,
        pageIndex,
        pageCount,
        pageStartDepth,
        pageEndDepth,
        rows,
        width,
        height,
      ),
    );
  }

  const surveyRowsPerPage = Math.max(1, Math.floor((height - 120) / 17) - 1);
  const surveyPageCount =
    surveyRows.length > 0
      ? Math.ceil(surveyRows.length / surveyRowsPerPage)
      : 0;

  for (let pageIndex = 0; pageIndex < surveyPageCount; pageIndex += 1) {
    const pageRows = surveyRows.slice(
      pageIndex * surveyRowsPerPage,
      (pageIndex + 1) * surveyRowsPerPage,
    );

    document.addPage(
      drawSurveyTablePage(
        input,
        surveyRows,
        pageRows,
        pageIndex,
        surveyPageCount,
        width,
        height,
      ),
    );
  }

  const fileName = `${sanitizeFileName(input.sessionCode)}_pdf_plot.pdf`;

  return {
    content: document.build(),
    fileName,
    rowCount: rows.length,
    surveyRowCount: surveyRows.length,
    pageCount: pageCount + surveyPageCount,
  };
};
