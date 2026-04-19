type ExportRow = {
  id: bigint;
  sessionId: number;
  measuredAt: Date;
  depthMd: unknown;
  inclination: unknown;
  azimuth: unknown;
  gammaRay: unknown;
  rop: unknown;
  hookLoad: unknown;
  standpipePressure: unknown;
  createdAt: Date;
};

const toPlainValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }

  return value;
};

const escapeCsv = (value: unknown) => {
  const plain = toPlainValue(value);

  if (plain === null) {
    return "";
  }

  const text = String(plain);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildExportFileName = (
  sessionCode: string,
  format: "json" | "csv",
) => {
  const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeSessionCode}_historical_${timestamp}.${format}`;
};

export const serializeHistoricalDataAsJson = (rows: ExportRow[]) => {
  return JSON.stringify(
    rows.map((row) => ({
      id: toPlainValue(row.id),
      sessionId: row.sessionId,
      measuredAt: toPlainValue(row.measuredAt),
      depthMd: toPlainValue(row.depthMd),
      inclination: toPlainValue(row.inclination),
      azimuth: toPlainValue(row.azimuth),
      gammaRay: toPlainValue(row.gammaRay),
      rop: toPlainValue(row.rop),
      hookLoad: toPlainValue(row.hookLoad),
      standpipePressure: toPlainValue(row.standpipePressure),
      createdAt: toPlainValue(row.createdAt),
    })),
    null,
    2,
  );
};

export const serializeHistoricalDataAsCsv = (rows: ExportRow[]) => {
  const header = [
    "id",
    "sessionId",
    "measuredAt",
    "depthMd",
    "inclination",
    "azimuth",
    "gammaRay",
    "rop",
    "hookLoad",
    "standpipePressure",
    "createdAt",
  ];

  const lines = rows.map((row) =>
    [
      row.id,
      row.sessionId,
      row.measuredAt,
      row.depthMd,
      row.inclination,
      row.azimuth,
      row.gammaRay,
      row.rop,
      row.hookLoad,
      row.standpipePressure,
      row.createdAt,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
};
