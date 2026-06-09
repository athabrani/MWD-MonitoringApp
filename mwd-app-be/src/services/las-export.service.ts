import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS } from "../utils/mwd-measurements.js";

type LasExportInput = {
  sessionId: number;
  sessionCode: string;
  wellName?: string | null;
  rigName?: string | null;
  measuredFrom?: Date;
  measuredTo?: Date;
  depthMin?: number;
  depthMax?: number;
  includeWits?: boolean;
  includeSurvey?: boolean;
  surveyStationType?: string;
  nullValue?: number;
  depthUnit?: string;
  stepDepth?: number;
  depthPrecision?: number;
  maxGap?: number;
  stopAtLastSurveyDepth?: boolean;
  dateTimeInFirstColumn?: boolean;
  correctDepthColumnForTvd?: boolean;
  interpolateSurvey?: boolean;
  includeSurveysInOtherSection?: boolean;
  columns?: LasColumnSelection[];
  wellInfo?: LasWellInfoItem[];
};

type LasColumnSelection =
  | string
  | {
      key?: string;
      witsId?: string;
      mnemonic?: string;
      enabled?: boolean;
    };

type LasWellInfoItem = {
  name: string;
  units?: string;
  data?: string | number | null;
  description?: string;
};

type CurveDefinition = {
  key: string;
  mnemonic: string;
  unit: string;
  description: string;
};

type LasRow = {
  depth: number;
  measuredAt?: Date | null;
  values: Record<string, number | string | null>;
};

const MWD_LAS_CURVES: CurveDefinition[] = [
  { key: "toolRunTime", mnemonic: "TRTIME", unit: "", description: "Tool Run Time" },
  { key: "slideIndicator", mnemonic: "SLIDE", unit: "", description: "Slide Indicator" },
  { key: "inclination", mnemonic: "INCL", unit: "DEG", description: "Inclination" },
  { key: "continuousInclination", mnemonic: "CINC", unit: "DEG", description: "Continuous Inclination" },
  { key: "azimuth", mnemonic: "AZIM", unit: "DEG", description: "Azimuth" },
  { key: "continuousAzimuth", mnemonic: "CAZM", unit: "DEG", description: "Continuous Azimuth" },
  { key: "verticalSection", mnemonic: "VS", unit: "M", description: "Vertical Section" },
  { key: "magneticToolface", mnemonic: "MTF", unit: "DEG", description: "Magnetic Toolface" },
  { key: "gravityToolface", mnemonic: "GTF", unit: "DEG", description: "Gravity Toolface" },
  { key: "totalGravity", mnemonic: "GTOT", unit: "G", description: "Total Gravity Field" },
  { key: "dipAngle", mnemonic: "DIPA", unit: "DEG", description: "Dip Angle" },
  { key: "magneticField", mnemonic: "BTOT", unit: "G", description: "Total Magnetic Field" },
  { key: "gammaRay", mnemonic: "GR", unit: "CPS", description: "Gamma Ray" },
  { key: "temperature", mnemonic: "TEMP", unit: "C", description: "Temperature" },
  { key: "batteryVoltage", mnemonic: "BATV", unit: "V", description: "Battery Voltage" },
  { key: "battery2OnOff", mnemonic: "BAT2", unit: "", description: "Battery 2 On/Off" },
  { key: "rotationSpeed", mnemonic: "RPM", unit: "RPM", description: "Rotation Speed" },
  { key: "downholeRpm", mnemonic: "DHRPM", unit: "RPM", description: "RPM Downhole" },
  { key: "rotaryTorque", mnemonic: "RTORQ", unit: "", description: "Rotary Torque" },
  { key: "shock", mnemonic: "SHK", unit: "G", description: "Shock" },
  { key: "shockAxial", mnemonic: "SHKAX", unit: "G", description: "Shock Axial" },
  { key: "shockLateral", mnemonic: "SHKLT", unit: "G", description: "Shock Lateral" },
  { key: "vibration", mnemonic: "VIB", unit: "G", description: "Vibration" },
  { key: "vibrationAxial", mnemonic: "VIBAX", unit: "G", description: "Vibration Axial" },
  { key: "vibrationLateral", mnemonic: "VIBLT", unit: "G", description: "Vibration Lateral" },
  { key: "rop", mnemonic: "ROP", unit: "", description: "Rate of Penetration" },
  { key: "hookLoad", mnemonic: "HKLD", unit: "", description: "Hook Load" },
  { key: "hookPosition", mnemonic: "HKPOS", unit: "", description: "Hook Position" },
  { key: "standpipePressure", mnemonic: "SPPA", unit: "", description: "Standpipe Pressure" },
  { key: "flowOut", mnemonic: "FLOOUT", unit: "", description: "Flow Out" },
  { key: "flowIn", mnemonic: "FLOIN", unit: "", description: "Flow In" },
  { key: "gasAverage", mnemonic: "GASAVG", unit: "", description: "Gas Avg" },
  { key: "annularPressure", mnemonic: "PANN", unit: "", description: "Pressure - Annular" },
  { key: "borePressure", mnemonic: "PBORE", unit: "", description: "Pressure - Bore" },
  { key: "mwdPressure", mnemonic: "MWDPRS", unit: "", description: "MWD Pressure" },
  { key: "kpwd2", mnemonic: "KPWD2", unit: "", description: "KPWD 2" },
  { key: "differentialPressure", mnemonic: "DPRES", unit: "", description: "Differential Pressure" },
  { key: "annularDifferentialPressure", mnemonic: "ADP", unit: "", description: "Annular Differential Pressure" },
  { key: "mudWeight", mnemonic: "MWT", unit: "", description: "Mud Weight" },
  { key: "ecd", mnemonic: "ECD", unit: "", description: "Equivalent Circulating Density" },
  { key: "ecd2", mnemonic: "ECD2", unit: "", description: "Equivalent Circulating Density 2" },
  { key: "ecdTvd", mnemonic: "ECDTVD", unit: "", description: "ECD TVD Survey Based" },
  { key: "ecdDd", mnemonic: "ECDDD", unit: "", description: "ECD DD" },
  { key: "ssi", mnemonic: "SSI", unit: "", description: "SSI" },
  { key: "tvdCalc", mnemonic: "TVDC", unit: "M", description: "TVD Calc" },
  { key: "confidence", mnemonic: "CONF", unit: "", description: "Confidence" },
  { key: "pulseAmplitude", mnemonic: "PAMP", unit: "", description: "Pulse Amp" },
  { key: "decoderPressure", mnemonic: "DECPRS", unit: "", description: "Decoder Pressure" },
  { key: "avo", mnemonic: "AVO", unit: "", description: "AVO" },
  { key: "shallowResistivity", mnemonic: "RSHAL", unit: "", description: "Shallow Resistivity" },
  { key: "rawSensorAx", mnemonic: "AX", unit: "G", description: "Raw Sensor Ax" },
  { key: "rawSensorAy", mnemonic: "AY", unit: "G", description: "Raw Sensor Ay" },
  { key: "rawSensorAz", mnemonic: "AZ", unit: "G", description: "Raw Sensor Az" },
  { key: "rawSensorMx", mnemonic: "MX", unit: "G", description: "Raw Sensor Mx" },
  { key: "rawSensorMy", mnemonic: "MY", unit: "G", description: "Raw Sensor My" },
  { key: "rawSensorMz", mnemonic: "MZ", unit: "G", description: "Raw Sensor Mz" },
  { key: "genericVariable0", mnemonic: "GV0", unit: "", description: "Generic Variable 0" },
  { key: "genericVariable1", mnemonic: "GV1", unit: "", description: "Generic Variable 1" },
  { key: "genericVariable2", mnemonic: "GV2", unit: "", description: "Generic Variable 2" },
  { key: "genericVariable3", mnemonic: "GV3", unit: "", description: "Generic Variable 3" },
  { key: "genericVariable4", mnemonic: "GV4", unit: "", description: "Generic Variable 4" },
  { key: "genericVariable5", mnemonic: "GV5", unit: "", description: "Generic Variable 5" },
  { key: "genericVariable6", mnemonic: "GV6", unit: "", description: "Generic Variable 6" },
  { key: "genericVariable7", mnemonic: "GV7", unit: "", description: "Generic Variable 7" },
];

const SURVEY_LAS_CURVES: CurveDefinition[] = [
  { key: "survey:tvd", mnemonic: "TVD", unit: "M", description: "True Vertical Depth" },
  { key: "survey:northing", mnemonic: "NORTH", unit: "M", description: "Northing" },
  { key: "survey:easting", mnemonic: "EAST", unit: "M", description: "Easting" },
  { key: "survey:verticalSection", mnemonic: "VS", unit: "M", description: "Vertical Section" },
  { key: "survey:doglegSeverity", mnemonic: "DLS", unit: "DEG/100", description: "Dogleg Severity" },
  { key: "survey:buildRate", mnemonic: "BR", unit: "DEG/100", description: "Build Rate" },
  { key: "survey:turnRate", mnemonic: "TR", unit: "DEG/100", description: "Turn Rate" },
  { key: "survey:closureDistance", mnemonic: "CLOS", unit: "M", description: "Closure Distance" },
  { key: "survey:closureAzimuth", mnemonic: "CLAZ", unit: "DEG", description: "Closure Azimuth" },
];

const db = prisma as unknown as {
  mWDData: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
  witsDataValue: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
  surveyStation: { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
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

const escapeLasText = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value).replace(/[\r\n]+/g, " ").trim();
};

const sanitizeMnemonic = (value: string, fallback: string) => {
  const sanitized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 12);

  return sanitized || fallback;
};

const makeUniqueMnemonic = (
  mnemonic: string,
  usedMnemonics: Set<string>,
) => {
  let uniqueMnemonic = mnemonic;
  let suffix = 2;

  while (usedMnemonics.has(uniqueMnemonic)) {
    uniqueMnemonic = `${mnemonic.slice(0, Math.max(1, 12 - String(suffix).length))}${suffix}`;
    suffix += 1;
  }

  usedMnemonics.add(uniqueMnemonic);
  return uniqueMnemonic;
};

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(6).replace(/0+$/g, "").replace(/\.$/g, "");
};

const formatNumberWithPrecision = (value: number, precision?: number) => {
  if (precision === undefined) {
    return formatNumber(value);
  }

  return value.toFixed(precision);
};

const getDepthKey = (depth: number, precision = 4) => depth.toFixed(precision);

const getOrCreateRow = (
  rows: Map<string, LasRow>,
  depth: number,
  precision = 4,
) => {
  const key = getDepthKey(depth, precision);
  const existingRow = rows.get(key);

  if (existingRow) {
    return existingRow;
  }

  const row: LasRow = {
    depth,
    values: {},
  };
  rows.set(key, row);
  return row;
};

const addCurve = (
  curves: Map<string, CurveDefinition>,
  curve: CurveDefinition,
) => {
  if (!curves.has(curve.key)) {
    curves.set(curve.key, curve);
  }
};

const buildMwdWhere = (input: LasExportInput) => {
  const where: Record<string, unknown> = {
    sessionId: input.sessionId,
    depthMd: { not: null },
    isHidden: false,
  };

  if (input.measuredFrom !== undefined || input.measuredTo !== undefined) {
    const measuredAt: Record<string, Date> = {};

    if (input.measuredFrom !== undefined) {
      measuredAt.gte = input.measuredFrom;
    }

    if (input.measuredTo !== undefined) {
      measuredAt.lte = input.measuredTo;
    }

    where.measuredAt = measuredAt;
  }

  if (input.depthMin !== undefined || input.depthMax !== undefined) {
    const depthMd: Record<string, unknown> = { not: null };

    if (input.depthMin !== undefined) {
      depthMd.gte = input.depthMin;
    }

    if (input.depthMax !== undefined) {
      depthMd.lte = input.depthMax;
    }

    where.depthMd = depthMd;
  }

  return where;
};

const buildDepthWhere = (
  input: Pick<LasExportInput, "depthMin" | "depthMax">,
  fieldName: string,
  includeNotNull = true,
) => {
  if (input.depthMin === undefined && input.depthMax === undefined) {
    return includeNotNull ? { [fieldName]: { not: null } } : {};
  }

  const depthFilter: Record<string, unknown> = includeNotNull ? { not: null } : {};

  if (input.depthMin !== undefined) {
    depthFilter.gte = input.depthMin;
  }

  if (input.depthMax !== undefined) {
    depthFilter.lte = input.depthMax;
  }

  return { [fieldName]: depthFilter };
};

const buildWitsWhere = (input: LasExportInput) => {
  const where: Record<string, unknown> = {
    sessionId: input.sessionId,
    ...buildDepthWhere(input, "depthMd"),
  };

  if (input.measuredFrom !== undefined || input.measuredTo !== undefined) {
    const measuredAt: Record<string, Date> = {};

    if (input.measuredFrom !== undefined) {
      measuredAt.gte = input.measuredFrom;
    }

    if (input.measuredTo !== undefined) {
      measuredAt.lte = input.measuredTo;
    }

    where.measuredAt = measuredAt;
  }

  return where;
};

const buildSurveyWhere = (input: LasExportInput) => {
  return {
    sessionId: input.sessionId,
    stationType: input.surveyStationType ?? "actual",
    ...buildDepthWhere(input, "measuredDepth", false),
  };
};

const getMwdRows = async (input: LasExportInput) => {
  const select = Object.fromEntries(
    MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]),
  );

  return await db.mWDData.findMany({
    where: buildMwdWhere(input),
    orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      depthMd: true,
      measuredAt: true,
      ...select,
    },
  });
};

const getWitsRows = async (input: LasExportInput) => {
  return await db.witsDataValue.findMany({
    where: buildWitsWhere(input),
    orderBy: [{ depthMd: "asc" }, { measuredAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      witsId: true,
      depthMd: true,
      value: true,
      witsConfig: {
        select: {
          id: true,
          witsId: true,
          name: true,
          units: true,
          lasTag: true,
          lasDescription: true,
        },
      },
    },
  });
};

const getSurveyRows = async (input: LasExportInput) => {
  return await db.surveyStation.findMany({
    where: buildSurveyWhere(input),
    orderBy: [{ measuredDepth: "asc" }, { id: "asc" }],
    select: {
      id: true,
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
      closureDistance: true,
      closureAzimuth: true,
    },
  });
};

const buildLasCurveSection = (curves: CurveDefinition[]) => {
  return curves.map(
    (curve) =>
      `${curve.mnemonic}.${curve.unit} : ${escapeLasText(curve.description)}`,
  );
};

const buildLasAsciiSection = (
  rows: LasRow[],
  curves: CurveDefinition[],
  nullValue: number,
  input: LasExportInput,
) => {
  const depthPrecision = input.depthPrecision;

  return rows.map((row) =>
    [
      formatNumberWithPrecision(
        getAsciiDepth(row, input),
        depthPrecision,
      ),
      ...(input.dateTimeInFirstColumn
        ? [formatAsciiValue(row.measuredAt?.toISOString() ?? null, nullValue)]
        : []),
      ...curves.map((curve) => {
        const value = row.values[curve.key];
        return formatAsciiValue(value, nullValue);
      }),
    ].join(" "),
  );
};

const formatAsciiValue = (value: unknown, nullValue: number) => {
  const numericValue = toFiniteNumber(value);

  if (numericValue !== null) {
    return formatNumber(numericValue);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim().replace(/\s+/g, "_");
  }

  return formatNumber(nullValue);
};

const assignUniqueMnemonics = (curves: CurveDefinition[]) => {
  const usedMnemonics = new Set<string>(["DEPT"]);

  return curves.map((curve) => ({
    ...curve,
    mnemonic: makeUniqueMnemonic(
      sanitizeMnemonic(curve.mnemonic, "CURVE"),
      usedMnemonics,
    ),
    unit: escapeLasText(curve.unit).toUpperCase(),
  }));
};

const getAsciiDepth = (row: LasRow, input: LasExportInput) => {
  if (!input.correctDepthColumnForTvd) {
    return row.depth;
  }

  return toFiniteNumber(row.values["survey:tvd"]) ?? row.depth;
};

const normalizeColumnKey = (column: LasColumnSelection) => {
  if (typeof column === "string") {
    const trimmed = column.trim();
    const digitsOnly = trimmed.replace(/\D/g, "");

    if (/^\d{1,4}$/.test(digitsOnly) && digitsOnly.length > 0) {
      return `wits:${digitsOnly.padStart(4, "0")}`;
    }

    return trimmed;
  }

  if (column.enabled === false) {
    return null;
  }

  if (typeof column.key === "string" && column.key.trim()) {
    return normalizeColumnKey(column.key);
  }

  if (typeof column.witsId === "string" && column.witsId.trim()) {
    return normalizeColumnKey(column.witsId);
  }

  if (typeof column.mnemonic === "string" && column.mnemonic.trim()) {
    return column.mnemonic.trim().toUpperCase();
  }

  return null;
};

const applyColumnSelection = (
  curves: CurveDefinition[],
  columns?: LasColumnSelection[],
) => {
  if (!columns || columns.length === 0) {
    return curves;
  }

  const curvesByKey = new Map(curves.map((curve) => [curve.key, curve]));
  const curvesByMnemonic = new Map(
    curves.map((curve) => [curve.mnemonic.toUpperCase(), curve]),
  );
  const selectedCurves: CurveDefinition[] = [];
  const selectedKeys = new Set<string>();

  for (const column of columns) {
    const normalizedKey = normalizeColumnKey(column);

    if (!normalizedKey) {
      continue;
    }

    const curve =
      curvesByKey.get(normalizedKey) ??
      curvesByMnemonic.get(normalizedKey.toUpperCase()) ??
      null;

    if (!curve || selectedKeys.has(curve.key)) {
      continue;
    }

    selectedCurves.push(curve);
    selectedKeys.add(curve.key);
  }

  return selectedCurves;
};

const getCurveValueAtDepth = (
  sourceRows: LasRow[],
  curveKey: string,
  depth: number,
  maxGap: number,
) => {
  const exactRow = sourceRows.find(
    (row) => Math.abs(row.depth - depth) < 1e-9 && row.values[curveKey] !== undefined,
  );

  if (exactRow) {
    return exactRow.values[curveKey];
  }

  let previousRow: LasRow | null = null;
  let nextRow: LasRow | null = null;

  for (const row of sourceRows) {
    if (row.values[curveKey] === undefined || toFiniteNumber(row.values[curveKey]) === null) {
      continue;
    }

    if (row.depth < depth) {
      previousRow = row;
      continue;
    }

    if (row.depth > depth) {
      nextRow = row;
      break;
    }
  }

  if (!previousRow || !nextRow) {
    return null;
  }

  const previousValue = toFiniteNumber(previousRow.values[curveKey]);
  const nextValue = toFiniteNumber(nextRow.values[curveKey]);
  const depthGap = nextRow.depth - previousRow.depth;

  if (
    previousValue === null ||
    nextValue === null ||
    depthGap <= 0 ||
    depthGap > maxGap
  ) {
    return null;
  }

  const interpolationFactor = (depth - previousRow.depth) / depthGap;
  return previousValue + (nextValue - previousValue) * interpolationFactor;
};

const buildSteppedRows = (
  sourceRows: LasRow[],
  curves: CurveDefinition[],
  input: LasExportInput,
) => {
  if (!input.stepDepth || input.stepDepth <= 0 || sourceRows.length === 0) {
    return sourceRows;
  }

  const startDepth = input.depthMin ?? sourceRows[0]?.depth ?? 0;
  const stopDepth = input.depthMax ?? sourceRows[sourceRows.length - 1]?.depth ?? startDepth;
  const maxGap = input.maxGap ?? Number.POSITIVE_INFINITY;
  const rows: LasRow[] = [];

  for (
    let depth = startDepth;
    depth <= stopDepth + input.stepDepth / 1000;
    depth += input.stepDepth
  ) {
    const row: LasRow = {
      depth,
      values: {},
    };

    for (const curve of curves) {
      const shouldInterpolate =
        !curve.key.startsWith("survey:") || (input.interpolateSurvey ?? false);
      const value = shouldInterpolate
        ? getCurveValueAtDepth(sourceRows, curve.key, depth, maxGap)
        : sourceRows.find((sourceRow) => Math.abs(sourceRow.depth - depth) < 1e-9)
            ?.values[curve.key] ?? null;

      if (value !== null && value !== undefined) {
        row.values[curve.key] = value;
      }
    }

    rows.push(row);
  }

  return rows;
};

const buildAdditionalWellInfoLines = (wellInfo?: LasWellInfoItem[]) => {
  if (!wellInfo || wellInfo.length === 0) {
    return [];
  }

  return wellInfo
    .filter((item) => item.name && item.name.trim())
    .map((item) => {
      const name = sanitizeMnemonic(item.name, "INFO");
      const units = escapeLasText(item.units ?? "");
      const data = escapeLasText(item.data ?? "");
      const description = escapeLasText(item.description ?? "");

      return `${name}.${units} ${data} : ${description}`;
    });
};

const buildSurveyOtherLines = (surveyRows: Record<string, unknown>[]) => {
  if (surveyRows.length === 0) {
    return [];
  }

  return [
    "# Survey Data",
    "# MD INC AZI TVD NORTH EAST VS DLS",
    ...surveyRows.map((surveyRow) =>
      [
        surveyRow.measuredDepth,
        surveyRow.inclination,
        surveyRow.azimuth,
        surveyRow.tvd,
        surveyRow.northing,
        surveyRow.easting,
        surveyRow.verticalSection,
        surveyRow.doglegSeverity,
      ]
        .map((value) => {
          const numericValue = toFiniteNumber(value);
          return numericValue === null ? "" : formatNumber(numericValue);
        })
        .join(" "),
    ),
  ];
};

export const buildLasFileName = (sessionCode: string) => {
  const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeSessionCode}_mwd_${timestamp}.las`;
};

export const buildLasExport = async (input: LasExportInput) => {
  const nullValue = input.nullValue ?? -999.25;
  const depthUnit = escapeLasText(input.depthUnit ?? "M").toUpperCase() || "M";
  const rowDepthPrecision = input.depthPrecision ?? 4;
  const rows = new Map<string, LasRow>();
  const curves = new Map<string, CurveDefinition>();
  const mwdRows = await getMwdRows(input);
  const surveyRows = input.includeSurvey ?? true ? await getSurveyRows(input) : [];

  for (const mwdRow of mwdRows) {
    const depth = toFiniteNumber(mwdRow.depthMd);

    if (depth === null) {
      continue;
    }

    const row = getOrCreateRow(rows, depth, rowDepthPrecision);
    row.measuredAt ??=
      mwdRow.measuredAt instanceof Date ? mwdRow.measuredAt : null;

    for (const curve of MWD_LAS_CURVES) {
      const value = toFiniteNumber(mwdRow[curve.key]);

      if (value === null) {
        continue;
      }

      addCurve(curves, curve);
      row.values[curve.key] = value;
    }
  }

  if (input.includeWits ?? true) {
    const witsRows = await getWitsRows(input);

    for (const witsRow of witsRows) {
      const depth = toFiniteNumber(witsRow.depthMd);
      const value = toFiniteNumber(witsRow.value);

      if (depth === null || value === null) {
        continue;
      }

      const witsConfig =
        typeof witsRow.witsConfig === "object" && witsRow.witsConfig !== null
          ? (witsRow.witsConfig as Record<string, unknown>)
          : {};
      const witsId = String(witsConfig.witsId ?? witsRow.witsId ?? "");
      const curveKey = `wits:${witsId}`;
      const mnemonic = sanitizeMnemonic(
        String(witsConfig.lasTag ?? `W${witsId}`),
        `W${witsId}`,
      );

      addCurve(curves, {
        key: curveKey,
        mnemonic,
        unit: String(witsConfig.units ?? ""),
        description: String(
          witsConfig.lasDescription ?? witsConfig.name ?? `WITS ${witsId}`,
        ),
      });
      getOrCreateRow(rows, depth, rowDepthPrecision).values[curveKey] = value;
    }
  }

  if (input.includeSurvey ?? true) {
    for (const surveyRow of surveyRows) {
      const depth = toFiniteNumber(surveyRow.measuredDepth);

      if (depth === null) {
        continue;
      }

      const row = getOrCreateRow(rows, depth, rowDepthPrecision);

      for (const curve of SURVEY_LAS_CURVES) {
        const fieldName = curve.key.replace("survey:", "");
        const value = toFiniteNumber(surveyRow[fieldName]);

        if (value === null) {
          continue;
        }

        addCurve(curves, curve);
        row.values[curve.key] = value;
      }
    }
  }

  const lastSurveyDepth = surveyRows
    .map((surveyRow) => toFiniteNumber(surveyRow.measuredDepth))
    .filter((depth): depth is number => depth !== null)
    .at(-1);
  const rawRows = [...rows.values()]
    .filter((row) =>
      input.stopAtLastSurveyDepth && lastSurveyDepth !== undefined
        ? row.depth <= lastSurveyDepth
        : true,
    )
    .sort((left, right) => left.depth - right.depth);
  const selectedCurves = applyColumnSelection([...curves.values()], input.columns);
  const sortedCurves = assignUniqueMnemonics(selectedCurves);
  const sortedRows = buildSteppedRows(rawRows, sortedCurves, input);
  const startDepth = sortedRows[0] ? getAsciiDepth(sortedRows[0], input) : 0;
  const stopDepth = sortedRows[sortedRows.length - 1]
    ? getAsciiDepth(sortedRows[sortedRows.length - 1] as LasRow, input)
    : startDepth;
  const exportDate = new Date().toISOString();
  const fileName = buildLasFileName(input.sessionCode);
  const otherLines = [
    "Generated by MWD Monitoring API",
    ...(input.includeSurveysInOtherSection ? buildSurveyOtherLines(surveyRows) : []),
  ];
  const lines = [
    "~Version Information",
    "VERS. 2.0 : CWLS Log ASCII Standard - Version 2.0",
    "WRAP. NO : One line per depth",
    "~Well Information",
    `STRT.${depthUnit} ${formatNumber(startDepth)} : Start depth`,
    `STOP.${depthUnit} ${formatNumber(stopDepth)} : Stop depth`,
    `STEP.${depthUnit} 0 : Variable step`,
    `NULL. ${formatNumber(nullValue)} : Null value`,
    `WELL. ${escapeLasText(input.wellName ?? input.sessionCode)} : Well name`,
    `UWI. ${escapeLasText(input.sessionCode)} : Session code`,
    `SRVC. MWD Monitoring API : Service`,
    `DATE. ${exportDate} : Export date`,
    ...buildAdditionalWellInfoLines(input.wellInfo),
    "~Curve Information",
    `DEPT.${depthUnit} : Measured Depth`,
    ...(input.dateTimeInFirstColumn ? ["DATETIME. : Measurement date/time"] : []),
    ...buildLasCurveSection(sortedCurves),
    "~Parameter Information",
    `SESSION. ${escapeLasText(input.sessionCode)} : MWD session code`,
    `RIG. ${escapeLasText(input.rigName)} : Rig name`,
    `SOURCE. MWD_DATA_WITS_SURVEY : Export source`,
    "~Other Information",
    ...otherLines,
    "~ASCII",
    ...buildLasAsciiSection(sortedRows, sortedCurves, nullValue, input),
    "",
  ];

  return {
    fileName,
    rowCount: sortedRows.length,
    content: lines.join("\n"),
  };
};
