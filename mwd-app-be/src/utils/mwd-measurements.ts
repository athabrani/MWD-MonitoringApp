export type MWDMeasurementInput = {
  depthMd?: number | string | null;
  inclination?: number | string | null;
  continuousInclination?: number | string | null;
  azimuth?: number | string | null;
  continuousAzimuth?: number | string | null;
  rawSensorAx?: number | string | null;
  rawSensorAy?: number | string | null;
  rawSensorAz?: number | string | null;
  rawSensorMx?: number | string | null;
  rawSensorMy?: number | string | null;
  rawSensorMz?: number | string | null;
  magneticToolface?: number | string | null;
  gravityToolface?: number | string | null;
  totalGravity?: number | string | null;
  dipAngle?: number | string | null;
  magneticField?: number | string | null;
  gammaRay?: number | string | null;
  batteryVoltage?: number | string | null;
  battery2OnOff?: number | string | null;
  rotationSpeed?: number | string | null;
  shock?: number | string | null;
  vibration?: number | string | null;
  genericVariable0?: number | string | null;
  genericVariable1?: number | string | null;
  genericVariable2?: number | string | null;
  genericVariable3?: number | string | null;
  genericVariable4?: number | string | null;
  genericVariable5?: number | string | null;
  genericVariable6?: number | string | null;
  genericVariable7?: number | string | null;
  rop?: number | string | null;
  hookLoad?: number | string | null;
  standpipePressure?: number | string | null;
};

type MeasurementField = keyof MWDMeasurementInput;

type PendingParsedMeasurementField = {
  provided: boolean;
  value: number | string | null | undefined | "invalid";
};

export type ParsedMeasurementFields = {
  [Field in MeasurementField]: {
    provided: boolean;
    value: number | string | null | undefined;
  };
};

type WitsMeasurementDefinition = {
  field: MeasurementField;
  measurement: string;
  pulseWord?: string;
  witsId?: string;
  units?: string;
  priority?: number;
};

export const MWD_MEASUREMENT_FIELDS = [
  "depthMd",
  "inclination",
  "continuousInclination",
  "azimuth",
  "continuousAzimuth",
  "rawSensorAx",
  "rawSensorAy",
  "rawSensorAz",
  "rawSensorMx",
  "rawSensorMy",
  "rawSensorMz",
  "magneticToolface",
  "gravityToolface",
  "totalGravity",
  "dipAngle",
  "magneticField",
  "gammaRay",
  "batteryVoltage",
  "battery2OnOff",
  "rotationSpeed",
  "shock",
  "vibration",
  "genericVariable0",
  "genericVariable1",
  "genericVariable2",
  "genericVariable3",
  "genericVariable4",
  "genericVariable5",
  "genericVariable6",
  "genericVariable7",
  "rop",
  "hookLoad",
  "standpipePressure",
] as const satisfies readonly MeasurementField[];

export const WITS_RECEIVED_MEASUREMENT_DEFINITIONS = [
  {
    field: "depthMd",
    measurement: "Hole Depth",
    witsId: "0110",
    priority: 0,
  },
  {
    field: "depthMd",
    measurement: "Bit Depth",
    witsId: "0108",
    priority: 1,
  },
] as const satisfies readonly WitsMeasurementDefinition[];

export const WITS_SENT_MEASUREMENT_DEFINITIONS = [
  {
    field: "inclination",
    measurement: "Inclination",
    pulseWord: "Inc",
    witsId: "0713",
    units: "degrees (°)",
  },
  {
    field: "continuousInclination",
    measurement: "Continuous Inclination",
    pulseWord: "cINC",
    witsId: "0780",
    units: "degrees (°)",
  },
  {
    field: "azimuth",
    measurement: "Azimuth",
    pulseWord: "Azm",
    witsId: "0715",
    units: "degrees (°)",
  },
  {
    field: "continuousAzimuth",
    measurement: "Continuous Azimuth",
    pulseWord: "cAZM",
    witsId: "0781",
    units: "degrees (°)",
  },
  {
    field: "rawSensorAx",
    measurement: "Raw Sensor - Ax",
    pulseWord: "Axs",
    witsId: "0765",
    units: "g",
  },
  {
    field: "rawSensorAy",
    measurement: "Raw Sensor - Ay",
    pulseWord: "Ays",
    witsId: "0766",
    units: "g",
  },
  {
    field: "rawSensorAz",
    measurement: "Raw Sensor - Az",
    pulseWord: "Azs",
    witsId: "0767",
    units: "g",
  },
  {
    field: "rawSensorMx",
    measurement: "Raw Sensor - Mx",
    pulseWord: "Mxs",
    witsId: "0768",
    units: "g",
  },
  {
    field: "rawSensorMy",
    measurement: "Raw Sensor - My",
    pulseWord: "Mys",
    witsId: "0769",
    units: "g",
  },
  {
    field: "rawSensorMz",
    measurement: "Raw Sensor - Mz",
    pulseWord: "Mzs",
    witsId: "0770",
    units: "g",
  },
  {
    field: "magneticToolface",
    measurement: "Magnetic Toolface",
    pulseWord: "mTFA",
    witsId: "0716",
    units: "degrees (°)",
  },
  {
    field: "gravityToolface",
    measurement: "Gravity Toolface",
    pulseWord: "gTFA",
    witsId: "0717",
    units: "degrees (°)",
  },
  {
    field: "totalGravity",
    measurement: "Total Gravity",
    pulseWord: "Grav",
    witsId: "0731",
    units: "g",
  },
  {
    field: "dipAngle",
    measurement: "Dip Angle",
    pulseWord: "DipA",
    witsId: "0730",
    units: "degrees (°)",
  },
  {
    field: "magneticField",
    measurement: "Magnetic Field",
    pulseWord: "MagFt",
    witsId: "0732",
    units: "g",
  },
  {
    field: "gammaRay",
    measurement: "Gamma",
    pulseWord: "Gama",
    witsId: "0823",
    units: "cps",
  },
  {
    field: "batteryVoltage",
    measurement: "Battery Voltage",
    pulseWord: "BatV",
    witsId: "0724",
    units: "volts",
  },
  {
    field: "battery2OnOff",
    measurement: "Battery 2 On/Off",
    pulseWord: "Bat2",
    witsId: "0735",
  },
  {
    field: "rotationSpeed",
    measurement: "Rotation Speed",
    pulseWord: "rpm",
    witsId: "0738",
    units: "rpm",
  },
  {
    field: "shock",
    measurement: "Shock",
    pulseWord: "SHK1",
    witsId: "0736",
    units: "g",
  },
  {
    field: "vibration",
    measurement: "Vibration",
    pulseWord: "VIB1",
    witsId: "0737",
    units: "g",
  },
  {
    field: "genericVariable0",
    measurement: "Generic Variable",
    pulseWord: "GV0",
    witsId: "0757",
  },
  {
    field: "genericVariable1",
    measurement: "Generic Variable",
    pulseWord: "GV1",
    witsId: "0758",
  },
  {
    field: "genericVariable2",
    measurement: "Generic Variable",
    pulseWord: "GV2",
    witsId: "0759",
  },
  {
    field: "genericVariable3",
    measurement: "Generic Variable",
    pulseWord: "GV3",
    witsId: "0760",
  },
  {
    field: "genericVariable4",
    measurement: "Generic Variable",
    pulseWord: "GV4",
    witsId: "0761",
  },
  {
    field: "genericVariable5",
    measurement: "Generic Variable",
    pulseWord: "GV5",
    witsId: "0762",
  },
  {
    field: "genericVariable6",
    measurement: "Generic Variable",
    pulseWord: "GV6",
    witsId: "0763",
  },
  {
    field: "genericVariable7",
    measurement: "Generic Variable",
    pulseWord: "GV7",
    witsId: "0764",
  },
] as const satisfies readonly WitsMeasurementDefinition[];

const WITS_MEASUREMENT_DEFINITIONS = [
  ...WITS_RECEIVED_MEASUREMENT_DEFINITIONS,
  ...WITS_SENT_MEASUREMENT_DEFINITIONS,
] as const satisfies readonly WitsMeasurementDefinition[];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const looksLikeWitsKey = (value: string) => {
  return /^(\d{4}|\d{2}\s?\d{2})$/.test(value.trim());
};

const normalizeWitsId = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return String(value).padStart(4, "0");
  }

  if (typeof value !== "string") {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, "");

  if (!digitsOnly) {
    return null;
  }

  return digitsOnly.length >= 4 ? digitsOnly : digitsOnly.padStart(4, "0");
};

const formatWitsId = (witsId: string) => {
  return witsId.length === 4 ? `${witsId.slice(0, 2)} ${witsId.slice(2)}` : witsId;
};

const unwrapMeasurementValue = (value: unknown) => {
  if (isRecord(value)) {
    if ("value" in value) {
      return value.value;
    }

    if ("reading" in value) {
      return value.reading;
    }

    if ("measurement" in value) {
      return value.measurement;
    }
  }

  return value;
};

const parseOptionalDecimal = (value: unknown): PendingParsedMeasurementField => {
  if (value === undefined) {
    return { provided: false, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true, value: null };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { provided: true, value }
      : { provided: true, value: "invalid" };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return { provided: true, value: null };
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed)
      ? { provided: true, value: trimmed }
      : { provided: true, value: "invalid" };
  }

  return { provided: true, value: "invalid" };
};

const collectWitsValuesFromRecord = (
  values: Map<string, unknown>,
  record: Record<string, unknown>,
) => {
  for (const [key, value] of Object.entries(record)) {
    if (!looksLikeWitsKey(key)) {
      continue;
    }

    const normalizedWitsId = normalizeWitsId(key);

    if (!normalizedWitsId) {
      continue;
    }

    values.set(normalizedWitsId, unwrapMeasurementValue(value));
  }
};

const collectWitsValuesFromArray = (values: Map<string, unknown>, items: unknown[]) => {
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const normalizedWitsId = normalizeWitsId(
      item.witsId ?? item.id ?? item.tag ?? item.word ?? item.code,
    );

    if (!normalizedWitsId) {
      continue;
    }

    values.set(
      normalizedWitsId,
      unwrapMeasurementValue(
        item.value ?? item.reading ?? item.measurement ?? item.data,
      ),
    );
  }
};

const collectWitsValues = (source: Record<string, unknown>) => {
  const values = new Map<string, unknown>();

  for (const key of ["wits", "witsData", "witsMeasurements", "measurements"] as const) {
    const rawValue = source[key];

    if (Array.isArray(rawValue)) {
      collectWitsValuesFromArray(values, rawValue);
      continue;
    }

    if (isRecord(rawValue)) {
      collectWitsValuesFromRecord(values, rawValue);
    }
  }

  collectWitsValuesFromRecord(values, source);

  return values;
};

export const parseMeasurementFields = (source: Record<string, unknown>) => {
  const parsedFields = Object.fromEntries(
    MWD_MEASUREMENT_FIELDS.map((fieldName) => [
      fieldName,
      parseOptionalDecimal(source[fieldName]),
    ]),
  ) as Record<MeasurementField, PendingParsedMeasurementField>;

  const witsValues = collectWitsValues(source);
  const appliedWitsFields = new Set<MeasurementField>();
  const sortedWitsDefinitions = [
    ...WITS_MEASUREMENT_DEFINITIONS,
  ] as WitsMeasurementDefinition[];
  sortedWitsDefinitions.sort(
    (left, right) => (left.priority ?? 0) - (right.priority ?? 0),
  );

  for (const definition of sortedWitsDefinitions) {
    if (!definition.witsId || !witsValues.has(definition.witsId)) {
      continue;
    }

    if (appliedWitsFields.has(definition.field)) {
      continue;
    }

    parsedFields[definition.field] = parseOptionalDecimal(
      witsValues.get(definition.witsId),
    );
    appliedWitsFields.add(definition.field);

    if (parsedFields[definition.field].value === "invalid") {
      return {
        error: `${definition.measurement} (WITS ${formatWitsId(definition.witsId)}) must be a valid number`,
      };
    }
  }

  for (const [fieldName, fieldValue] of Object.entries(parsedFields)) {
    if (fieldValue.value === "invalid") {
      return { error: `${fieldName} must be a valid number` };
    }
  }

  return { parsedFields: parsedFields as ParsedMeasurementFields };
};

export const applyMeasurementFields = (
  target: MWDMeasurementInput,
  parsedFields: ParsedMeasurementFields,
) => {
  for (const fieldName of MWD_MEASUREMENT_FIELDS) {
    if (parsedFields[fieldName].provided) {
      target[fieldName] = parsedFields[fieldName].value ?? null;
    }
  }
};
