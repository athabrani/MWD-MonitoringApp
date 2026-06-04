import { apiRequest } from "@/lib/api-client";
import { logSecurityDebug } from "@/lib/security/errors";
import { Event } from "@/types";
import { PolarisDataSourceMode, PolarisWitsId, WitsIdDataSourceType } from "@/types/polaris";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: BackendRecord[] | BackendRecord;
  data?: BackendRecord[] | BackendRecord;
  items?: BackendRecord[] | BackendRecord;
  results?: BackendRecord[] | BackendRecord;
  count?: number;
  Count?: number;
};

export type WitsDataValue = {
  id?: string;
  witsId: string;
  witsConfigId?: string;
  mwdDataId?: string;
  sessionId?: string;
  mappedField?: string;
  config?: PolarisWitsId;
  label?: string;
  unit?: string;
  value: number;
  depth?: number;
  timestamp?: Date;
  source?: string;
  rawValue?: string;
  raw: BackendRecord;
};

export type GetWitsDataValuesOptions = {
  latest?: boolean;
  sessionId?: string;
  witsId?: string;
  measuredFrom?: string;
  measuredTo?: string;
  depthMin?: number;
  depthMax?: number;
  limit?: number;
};

export type WitsAlarmsQuery = {
  sessionId?: string;
  witsId?: string;
  acknowledged?: boolean;
  limit?: number;
};

export type WitsConfigInput = Record<string, unknown>;

const defaultWitsConfig: PolarisWitsId = {
  id: "",
  numericId: 0,
  enabled: true,
  name: "",
  units: "",
  decimalPlaces: 2,
  scaleFactor: 1,
  biasOffset: 0,
  sensorToBitSpacing: 0,
  sendToAux: false,
  sendToRigWits: false,
  doNotRepeat: false,
  realTimePlot: "Unassigned",
  depthTracking: "Tracks Bit Depth (default)",
  plotScaleInfo: "0-100 neutral scale",
  leftScale: 0,
  rightScale: 100,
  lineColor: "#2563eb",
  wrapColor: "#ef4444",
  lasMnemonic: "",
  lasDescription: "",
  lasFilter: 0,
  alarmEnabled: false,
  alarmLow: 0,
  alarmHigh: 0,
  dataSourceType: "serial",
  dataSourceValue: 0,
  useForMemoryImportStorage: false,
  dataSourceMode: "manual",
  scriptNotes: "",
};

function isRecord(value: unknown): value is BackendRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapRecordList(response: BackendListResponse | BackendRecord[]) {
  if (Array.isArray(response)) return response;
  const list = response.value ?? response.data ?? response.items ?? response.results;

  if (Array.isArray(list)) return list;
  if (isRecord(list)) return [list];

  return [];
}

function unwrapSingleRecord(response: BackendListResponse | BackendRecord) {
  const list = unwrapRecordList(response);
  if (list[0]) return list[0];
  return isRecord(response) ? response : null;
}

function readString(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function readBoolean(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
  }

  return undefined;
}

function readDate(record: BackendRecord, keys: string[]) {
  const value = readString(record, keys);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeWitsId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).padStart(4, "0");
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? trimmed.padStart(4, "0") : trimmed;
  }

  return undefined;
}

function normalizeDataSourceType(value?: string): WitsIdDataSourceType {
  const knownTypes: WitsIdDataSourceType[] = [
    "serial",
    "constant",
    "script",
    "1DivX.sh",
    "1kDivDenom.sh",
    "add.sh",
    "azinc.sh",
    "degC2degF.sh",
    "degF2degC.sh",
    "divide.sh",
    "duplicate.sh",
    "ecd.sh",
    "ftPerHour2minPerFt.sh",
    "subtract.sh",
  ];
  return knownTypes.includes(value as WitsIdDataSourceType)
    ? (value as WitsIdDataSourceType)
    : "serial";
}

function normalizeDataSourceMode(value?: string): PolarisDataSourceMode {
  const knownModes: PolarisDataSourceMode[] = ["decoder", "manual", "derived"];
  return knownModes.includes(value as PolarisDataSourceMode)
    ? (value as PolarisDataSourceMode)
    : "manual";
}

function formatWitsId(value: number) {
  return String(value).padStart(4, "0");
}

function toQueryString(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function coerceNullableNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeFrontendDataSourceType(value?: string): WitsIdDataSourceType {
  if (value === "serial_port_wits") return "serial";
  if (value === "constant_value") return "constant";
  return normalizeDataSourceType(value);
}

function toBackendDataSource(value: WitsIdDataSourceType) {
  if (value === "serial") return "serial_port_wits";
  if (value === "constant") return "constant_value";
  return value;
}

export function normalizeWitsConfigRecord(record: BackendRecord): PolarisWitsId | null {
  const numericId = readNumber(record, ["numericId", "numeric_id", "witsId", "wits_id", "channel", "channelId"]);
  const id = readString(record, ["id", "_id", "configId", "witsConfigId", "wits_config_id"]);
  const alarmEnabled = readBoolean(record, ["alarmEnabled", "alarm_enabled"]);
  const alarmLow = readNumber(record, ["alarmMin", "alarm_min", "alarmLow", "alarm_low"]);
  const alarmHigh = readNumber(record, ["alarmMax", "alarm_max", "alarmHigh", "alarm_high"]);

  if (numericId === undefined && !id) return null;

  return {
    ...defaultWitsConfig,
    id: id ?? `wits-${numericId}`,
    numericId: numericId ?? defaultWitsConfig.numericId,
    mappedField: readString(record, ["mappedField", "mapped_field"]),
    enabled:
      readBoolean(record, ["enableLogging", "enable_logging", "enabled", "isEnabled", "is_enabled"]) ??
      defaultWitsConfig.enabled,
    name: readString(record, ["name", "label", "mnemonic"]) ?? defaultWitsConfig.name,
    units: readString(record, ["units", "unit"]) ?? defaultWitsConfig.units,
    decimalPlaces: readNumber(record, ["decimalPlaces", "decimal_places"]) ?? defaultWitsConfig.decimalPlaces,
    scaleFactor: readNumber(record, ["scaleFactor", "scale_factor"]) ?? defaultWitsConfig.scaleFactor,
    biasOffset: readNumber(record, ["biasOffset", "bias_offset"]) ?? defaultWitsConfig.biasOffset,
    sensorToBitSpacing:
      readNumber(record, ["sensorToBitSpacing", "sensor_to_bit_spacing"]) ??
      defaultWitsConfig.sensorToBitSpacing,
    sendToAux: readBoolean(record, ["sendToAux", "send_to_aux"]) ?? defaultWitsConfig.sendToAux,
    sendToRigWits:
      readBoolean(record, ["sendToRigWits", "send_to_rig_wits"]) ?? defaultWitsConfig.sendToRigWits,
    doNotRepeat: readBoolean(record, ["doNotRepeat", "do_not_repeat"]) ?? defaultWitsConfig.doNotRepeat,
    realTimePlot: readString(record, ["realTimePlot", "real_time_plot", "mappedField"]) ?? defaultWitsConfig.realTimePlot,
    depthTracking:
      readString(record, ["depthTrackingMode", "depth_tracking_mode", "depthTracking", "depth_tracking"]) ??
      defaultWitsConfig.depthTracking,
    depthTrackingMode: readString(record, ["depthTrackingMode", "depth_tracking_mode"]),
    depthTrackingField: readString(record, ["depthTrackingField", "depth_tracking_field"]),
    plotScaleInfo: readString(record, ["plotScaleInfo", "plot_scale_info"]) ?? defaultWitsConfig.plotScaleInfo,
    leftScale: readNumber(record, ["plotScaleLeft", "plot_scale_left", "leftScale", "left_scale"]) ?? defaultWitsConfig.leftScale,
    rightScale: readNumber(record, ["plotScaleRight", "plot_scale_right", "rightScale", "right_scale"]) ?? defaultWitsConfig.rightScale,
    lineColor: readString(record, ["lineColor", "line_color"]) ?? defaultWitsConfig.lineColor,
    wrapColor: readString(record, ["wrapColor", "wrap_color"]) ?? defaultWitsConfig.wrapColor,
    lasMnemonic: readString(record, ["lasTag", "las_tag", "lasMnemonic", "las_mnemonic", "mnemonic"]) ?? defaultWitsConfig.lasMnemonic,
    lasDescription: readString(record, ["lasDescription", "las_description", "description"]) ?? defaultWitsConfig.lasDescription,
    lasFilter: readNumber(record, ["lasFilter", "las_filter"]) ?? defaultWitsConfig.lasFilter,
    alarmEnabled: alarmEnabled ?? defaultWitsConfig.alarmEnabled,
    alarmLow: alarmLow ?? defaultWitsConfig.alarmLow,
    alarmHigh: alarmHigh ?? defaultWitsConfig.alarmHigh,
    alarmEnabledFromBackend: alarmEnabled !== undefined,
    alarmLowFromBackend: alarmLow !== undefined,
    alarmHighFromBackend: alarmHigh !== undefined,
    dataSourceType: normalizeFrontendDataSourceType(readString(record, ["dataSource", "data_source", "dataSourceType", "data_source_type"])),
    dataSourceValue: readNumber(record, ["dataInputValue", "data_input_value", "dataSourceValue", "data_source_value"]) ?? defaultWitsConfig.dataSourceValue,
    customDepthWitsId: readString(record, ["customDepthWitsId", "custom_depth_wits_id"]) ?? null,
    useForMemoryImportStorage:
      readBoolean(record, ["useForMemoryImportStorage", "use_for_memory_import_storage"]) ??
      defaultWitsConfig.useForMemoryImportStorage,
    dataSourceMode: normalizeDataSourceMode(readString(record, ["dataSourceMode", "data_source_mode"])),
    scriptNotes: readString(record, ["scriptNotes", "script_notes", "notes"]) ?? defaultWitsConfig.scriptNotes,
    createdAt: readString(record, ["createdAt", "created_at"]),
    updatedAt: readString(record, ["updatedAt", "updated_at"]),
  };
}

export function witsConfigToPayload(record: PolarisWitsId): WitsConfigInput {
  const backendId = Number(record.id);

  return {
    id: Number.isFinite(backendId) ? backendId : undefined,
    witsId: formatWitsId(record.numericId),
    name: record.name,
    units: record.units || null,
    mappedField: record.mappedField || null,
    decimalPlaces: record.decimalPlaces,
    scaleFactor: String(record.scaleFactor),
    biasOffset: String(record.biasOffset),
    sensorToBitSpacing: coerceNullableNumber(record.sensorToBitSpacing),
    plotScaleLeft: coerceNullableNumber(record.leftScale),
    plotScaleRight: coerceNullableNumber(record.rightScale),
    lineColor: record.lineColor || null,
    wrapColor: record.wrapColor || null,
    depthTrackingMode: record.depthTrackingMode || record.depthTracking || null,
    depthTrackingField: record.depthTrackingField || null,
    enableLogging: record.enabled,
    alarmEnabled: record.alarmEnabled,
    alarmMin: coerceNullableNumber(record.alarmLow),
    alarmMax: coerceNullableNumber(record.alarmHigh),
    customDepthWitsId: record.customDepthWitsId ?? null,
    dataSource: toBackendDataSource(record.dataSourceType),
    dataInputValue: coerceNullableNumber(record.dataSourceValue),
    sendToRigWitsPort: record.sendToRigWits,
    doNotRepeat: record.doNotRepeat,
    lasTag: record.lasMnemonic || null,
    lasDescription: record.lasDescription || null,
    lasFilter: coerceNullableNumber(record.lasFilter),
  };
}

export function normalizeWitsDataValue(record: BackendRecord): WitsDataValue | null {
  const witsId =
    normalizeWitsId(record.witsId) ??
    normalizeWitsId(record.wits_id) ??
    normalizeWitsId(record.numericId) ??
    normalizeWitsId(record.numeric_id) ??
    normalizeWitsId(record.channel) ??
    normalizeWitsId(record.channelId);
  const value = readNumber(record, ["value", "currentValue", "current_value", "parsedValue", "parsed_value", "rawValue", "raw_value"]);

  if (!witsId || value === undefined) return null;

  return {
    id: readString(record, ["id", "_id", "valueId", "witsDataValueId"]),
    witsId,
    witsConfigId: readString(record, ["witsConfigId", "wits_config_id", "configId", "config_id"]),
    mwdDataId: readString(record, ["mwdDataId", "mwd_data_id", "dataId", "data_id"]),
    sessionId: readString(record, ["sessionId", "session_id", "mwdSessionId", "mwd_session_id"]),
    mappedField: readString(record, ["mappedField", "mapped_field"]),
    label: readString(record, ["label", "name", "mnemonic", "description"]),
    unit: readString(record, ["unit", "units"]),
    value,
    depth: readNumber(record, ["depth", "measuredDepth", "measured_depth", "md"]),
    timestamp: readDate(record, ["timestamp", "time", "recordedAt", "recorded_at", "createdAt", "created_at"]),
    source: readString(record, ["source", "port"]),
    rawValue: readString(record, ["rawValue", "raw_value"]),
    raw: record,
  };
}

export function selectLatestWitsDataValues(values: WitsDataValue[]) {
  const latestByKey = new Map<string, WitsDataValue>();

  for (const value of values) {
    const key = value.witsId;
    const current = latestByKey.get(key);
    const valueTime = value.timestamp?.getTime() ?? Number.NEGATIVE_INFINITY;
    const currentTime = current?.timestamp?.getTime() ?? Number.NEGATIVE_INFINITY;

    if (!current || valueTime >= currentTime) {
      latestByKey.set(key, value);
    }
  }

  return Array.from(latestByKey.values());
}

export function enrichWitsDataValuesWithConfig(
  values: WitsDataValue[],
  configs: PolarisWitsId[]
) {
  const configByWitsId = new Map(
    configs.map((config) => [formatWitsId(config.numericId), config])
  );

  return values.map((value) => {
    const config = configByWitsId.get(value.witsId);
    if (!config) return value;

    return {
      ...value,
      config,
      mappedField: value.mappedField ?? config.mappedField,
      label: value.label ?? config.name,
      unit: value.unit ?? config.units,
    };
  });
}

function normalizeWitsAlarm(record: BackendRecord): Event | null {
  const id = readString(record, ["id", "_id", "alarmId", "witsAlarmId", "wits_alarm_id"]);
  if (!id) return null;

  const status = readString(record, ["status", "state"])?.toLowerCase();
  const severityValue = readString(record, ["severity", "level"])?.toLowerCase();
  const severity: Event["severity"] =
    severityValue === "critical" || severityValue === "warning" || severityValue === "info"
      ? severityValue
      : status === "critical"
        ? "critical"
        : "warning";
  const timestamp =
    readDate(record, ["timestamp", "time", "triggeredAt", "triggered_at", "createdAt", "created_at"]) ??
    new Date();

  return {
    id,
    timestamp,
    severity,
    type: "alarm",
    message:
      readString(record, ["message", "description", "name", "label"]) ??
      "WITS alarm requires attention",
    parameter:
      readString(record, ["parameter", "witsId", "wits_id", "channel", "channelId"]) ??
      undefined,
    value: readNumber(record, ["value", "currentValue", "current_value"]),
    threshold: readNumber(record, ["threshold", "limit", "alarmHigh", "alarm_high", "alarmLow", "alarm_low"]),
    source: "primary",
    acknowledgedBy: readString(record, ["acknowledgedBy", "acknowledged_by"]),
    acknowledgedAt: readDate(record, ["acknowledgedAt", "acknowledged_at"]),
    note: readString(record, ["note", "acknowledgeNote", "acknowledge_note"]),
    resolved:
      readBoolean(record, ["resolved", "isResolved", "is_resolved"]) ??
      (status === "resolved"),
  };
}

export async function getWitsConfig(token: string): Promise<PolarisWitsId[]> {
  const response = await apiRequest<BackendListResponse | BackendRecord[]>("/api/wits-config", {
    method: "GET",
    token,
  });
  const rawRecords = unwrapRecordList(response);
  const configs = rawRecords
    .map(normalizeWitsConfigRecord)
    .filter((record): record is PolarisWitsId => Boolean(record));

  logSecurityDebug("[WITS config] GET /api/wits-config", {
    rawCount: rawRecords.length,
    normalizedCount: configs.length,
    firstItemKeys: isRecord(rawRecords[0]) ? Object.keys(rawRecords[0]).slice(0, 30) : [],
    mappedFields: configs.slice(0, 10).map((config) => ({
      id: config.id,
      witsId: formatWitsId(config.numericId),
      name: config.name,
      mappedField: config.mappedField,
      units: config.units,
      alarmEnabled: config.alarmEnabled,
    })),
  });

  return configs;
}

export async function createWitsConfig(token: string, input: WitsConfigInput): Promise<PolarisWitsId> {
  const response = await apiRequest<BackendListResponse | BackendRecord>("/api/wits-config", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeWitsConfigRecord(rawRecord) : null;

  if (!record) throw new Error("Backend returned WITS config without a usable id or WITS ID.");
  return record;
}

export async function getWitsConfigById(token: string, id: string): Promise<PolarisWitsId> {
  const response = await apiRequest<BackendListResponse | BackendRecord>(`/api/wits-config/${id}`, {
    method: "GET",
    token,
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeWitsConfigRecord(rawRecord) : null;

  if (!record) throw new Error("Backend returned WITS config without a usable id or WITS ID.");
  return record;
}

export async function updateWitsConfig(
  token: string,
  id: string,
  input: WitsConfigInput
): Promise<PolarisWitsId> {
  const response = await apiRequest<BackendListResponse | BackendRecord>(`/api/wits-config/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeWitsConfigRecord(rawRecord) : null;

  if (!record) throw new Error("Backend returned WITS config without a usable id or WITS ID.");
  return record;
}

export async function deleteWitsConfig(token: string, id: string): Promise<void> {
  await apiRequest<unknown>(`/api/wits-config/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function getWitsDataValues(
  token: string,
  options: GetWitsDataValuesOptions = {}
): Promise<WitsDataValue[]> {
  const { latest: _latest, ...queryOptions } = options;
  const response = await apiRequest<BackendListResponse | BackendRecord[]>(`/api/wits-data-values${toQueryString(queryOptions)}`, {
    method: "GET",
    token,
  });

  const values = unwrapRecordList(response)
    .map(normalizeWitsDataValue)
    .filter((record): record is WitsDataValue => Boolean(record));

  return options.latest ? selectLatestWitsDataValues(values) : values;
}

export async function getLatestWitsDataValues(token: string): Promise<WitsDataValue[]> {
  return getWitsDataValues(token, { latest: true });
}

export async function getLatestConfiguredWitsDataValues(
  token: string,
  options: GetWitsDataValuesOptions = {}
): Promise<WitsDataValue[]> {
  const [configs, values] = await Promise.all([
    getWitsConfig(token),
    getWitsDataValues(token, { ...options, latest: true }),
  ]);

  return enrichWitsDataValuesWithConfig(values, configs);
}

export async function getWitsAlarms(token: string, query: WitsAlarmsQuery = {}): Promise<Event[]> {
  const response = await apiRequest<BackendListResponse | BackendRecord[]>(`/api/wits-alarms${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapRecordList(response)
    .map(normalizeWitsAlarm)
    .filter((record): record is Event => Boolean(record));
}

export async function acknowledgeWitsAlarm(token: string, id: string, note?: string): Promise<void> {
  await apiRequest<unknown>(`/api/wits-alarms/${id}/acknowledge`, {
    method: "PUT",
    token,
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function resolveWitsAlarm(token: string, id: string): Promise<void> {
  await apiRequest<unknown>(`/api/wits-alarms/${id}/resolve`, {
    method: "PUT",
    token,
  });
}
