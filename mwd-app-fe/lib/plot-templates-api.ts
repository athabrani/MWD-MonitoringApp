import { mockPlotConfigurations } from "@/data/plotting-data";
import { apiRequest } from "@/lib/api-client";
import { CurveConfig, PlotConfiguration, TrackConfig } from "@/types/plotting";

type BackendRecord = Record<string, unknown>;

type BackendPlotTemplateResponse = {
  value?: BackendRecord[] | BackendRecord;
  data?: BackendRecord[] | BackendRecord;
  items?: BackendRecord[] | BackendRecord;
  Count?: number;
  count?: number;
};

export type BackendPlotTemplate = BackendRecord;

export type PlotTemplateConfigJson = BackendRecord & {
  title?: string;
  scaleLabel?: string;
  logoDataUrl?: string;
  header?: unknown;
  tracks?: unknown[];
};

export type PlotTemplatePayload = {
  name: string;
  description?: string;
  isDefault?: boolean;
  config: PlotTemplateConfigJson;
};

export type PlotTemplateRecord = {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  config?: PlotTemplateConfigJson;
  plotConfig?: PlotConfiguration;
  raw: BackendPlotTemplate;
};

const idKeys = ["id", "_id", "templateId", "template_id", "plotTemplateId", "plot_template_id"];
const nameKeys = ["name", "templateName", "template_name", "title"];
const descriptionKeys = ["description", "desc", "notes"];
const defaultKeys = ["isDefault", "is_default", "default", "defaultTemplate", "default_template"];
const sessionIdKeys = ["sessionId", "session_id", "mwdSessionId", "mwd_session_id", "jobSessionId", "job_session_id"];
const configKeys = [
  "config",
  "configJson",
  "config_json",
  "configuration",
  "plotConfig",
  "plot_config",
  "plotConfiguration",
  "plot_configuration",
  "settings",
  "templateConfig",
  "template_config",
];

function isRecord(value: unknown): value is BackendRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

function unwrapList(response: BackendPlotTemplateResponse | BackendRecord[]) {
  if (Array.isArray(response)) return response;
  const list = response.value ?? response.data ?? response.items;

  if (Array.isArray(list)) return list;
  if (isRecord(list)) return [list];

  return [];
}

function unwrapSingle(response: BackendPlotTemplateResponse | BackendRecord) {
  const list = unwrapList(response);
  if (list[0]) return list[0];
  return isRecord(response) ? response : null;
}

function readTemplateConfig(record: BackendRecord): PlotTemplateConfigJson | undefined {
  for (const key of configKeys) {
    const value = record[key];
    if (isRecord(value)) return value as PlotTemplateConfigJson;
  }

  return undefined;
}

function parseScale(scale?: string) {
  if (!scale) return {};
  const [left, right] = scale.split("-").map((part) => Number(part.trim()));

  return {
    min: Number.isFinite(left) ? left : undefined,
    max: Number.isFinite(right) ? right : undefined,
  };
}

function compactObject<T extends BackendRecord>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}

function curveLabel(curve: CurveConfig) {
  const sourceLabel = curve.dataSource.includes(" - ")
    ? curve.dataSource.split(" - ").slice(1).join(" - ")
    : curve.dataSource;

  return sourceLabel && sourceLabel !== "None" ? sourceLabel : curve.id;
}

function curveKey(curve: CurveConfig) {
  const sourceCode = curve.dataSource.includes(" - ") ? curve.dataSource.split(" - ")[0] : "";
  return sourceCode || curve.id;
}

function curveToTemplateJson(curve: CurveConfig) {
  const scale = parseScale(curve.scale);

  return compactObject({
    key: curveKey(curve),
    label: curveLabel(curve),
    min: scale.min,
    max: scale.max,
    color: curve.lineColor,
    id: curve.id,
    dataSource: curve.dataSource,
    scale: curve.scale,
    correctForTvd: curve.correctForTvd,
    lineWidth: curve.lineWidth,
    filter: curve.filter,
    fillCurve: curve.fillCurve,
    lineStyle: curve.lineStyle,
    lineColor: curve.lineColor,
    wrapColor: curve.wrapColor,
  });
}

function trackToTemplateJson(track: TrackConfig) {
  return compactObject({
    id: track.id,
    title: track.name,
    name: track.name,
    scaleType: track.scaleType,
    densityTicMarks: track.densityTicMarks,
    curves: track.curves.map(curveToTemplateJson),
  });
}

function templateCurveToFrontendCurve(curve: unknown, index: number): CurveConfig | null {
  if (!isRecord(curve)) return null;

  const label = readString(curve, ["label", "name", "key"]) ?? `Curve ${index + 1}`;
  const min = readNumber(curve, ["min", "minimum"]);
  const max = readNumber(curve, ["max", "maximum"]);
  const scale =
    readString(curve, ["scale"]) ??
    (min !== undefined || max !== undefined ? `${min ?? "Auto"}-${max ?? "Auto"}` : "Auto");

  return {
    id: readString(curve, ["id", "curveId", "curve_id", "key"]) ?? `curve-${index + 1}`,
    dataSource: readString(curve, ["dataSource", "data_source", "key"]) ?? label,
    scale,
    correctForTvd: readBoolean(curve, ["correctForTvd", "correct_for_tvd"]) ?? false,
    lineWidth: readNumber(curve, ["lineWidth", "line_width"]) ?? 1,
    filter: readString(curve, ["filter"]) ?? "None",
    fillCurve: readBoolean(curve, ["fillCurve", "fill_curve"]) ?? false,
    lineStyle: readString(curve, ["lineStyle", "line_style"]) === "Dashed"
      ? "Dashed"
      : readString(curve, ["lineStyle", "line_style"]) === "Dotted"
        ? "Dotted"
        : "Solid",
    lineColor: readString(curve, ["lineColor", "line_color", "color"]) ?? "#0f172a",
    wrapColor: readString(curve, ["wrapColor", "wrap_color"]) ?? "#94a3b8",
  };
}

function templateTrackToFrontendTrack(track: unknown, index: number): TrackConfig | null {
  if (!isRecord(track)) return null;
  const curves = Array.isArray(track.curves)
    ? track.curves
        .map((curve, curveIndex) => templateCurveToFrontendCurve(curve, curveIndex))
        .filter((curve): curve is CurveConfig => Boolean(curve))
    : [];

  const scaleType = readString(track, ["scaleType", "scale_type"]);

  return {
    id: readString(track, ["id", "trackId", "track_id"]) ?? `track-${index + 1}`,
    name: readString(track, ["name", "title"]) ?? `Track ${index + 1}`,
    scaleType:
      scaleType === "Logarithmic" ||
      scaleType === "Azimuthal" ||
      scaleType === "Fill between curves"
        ? scaleType
        : "Linear",
    densityTicMarks: readBoolean(track, ["densityTicMarks", "density_tic_marks"]) ?? false,
    curves,
  };
}

export function plotConfigToTemplatePayload(plotConfig: PlotConfiguration): PlotTemplatePayload {
  const depthScale = plotConfig.general.grid?.depthScale ?? plotConfig.general.depthScale;
  const scaleLabel = `${plotConfig.general.depthCorrection} ${depthScale}`.trim();
  const config = compactObject({
    title: plotConfig.header?.plotTitle ?? plotConfig.name,
    scaleLabel,
    logoDataUrl: plotConfig.logoDataUrl,
    header: plotConfig.header,
    general: plotConfig.general,
    page: plotConfig.general.page,
    grid: plotConfig.general.grid,
    depthRange: plotConfig.general.depthRange,
    depthCorrection: plotConfig.general.depthCorrection,
    surveys: plotConfig.general.surveys,
    layout: plotConfig.general.layout,
    pdfItems: plotConfig.pdfItems,
    tracks: plotConfig.tracks.map(trackToTemplateJson),
    azimuthal: plotConfig.azimuthal,
    labels: plotConfig.labels,
  });

  return compactObject({
    name: plotConfig.name.trim(),
    description: plotConfig.description?.trim() || undefined,
    isDefault: plotConfig.isDefault,
    config,
  });
}

export function backendTemplateToPlotConfig(template: BackendPlotTemplate): PlotConfiguration | null {
  const config = readTemplateConfig(template);
  if (!config) return null;

  const fallback = mockPlotConfigurations[0];
  const id = readString(template, idKeys) ?? readString(config, idKeys);
  const name =
    readString(template, nameKeys) ??
    readString(config, ["name", "title"]) ??
    fallback.name;

  if (!id || !name) return null;

  const tracks = Array.isArray(config.tracks)
    ? config.tracks
        .map((track, index) => templateTrackToFrontendTrack(track, index))
        .filter((track): track is TrackConfig => Boolean(track))
    : [];

  if (tracks.length === 0) return null;

  return {
    ...fallback,
    id,
    name,
    sessionId: readString(template, sessionIdKeys) ?? readString(config, sessionIdKeys),
    description: readString(template, descriptionKeys) ?? readString(config, descriptionKeys),
    isDefault: readBoolean(template, defaultKeys) ?? readBoolean(config, defaultKeys) ?? false,
    header: isRecord(config.header)
      ? (config.header as unknown as PlotConfiguration["header"])
      : fallback.header,
    labels: Array.isArray(config.labels)
      ? (config.labels as unknown as PlotConfiguration["labels"])
      : fallback.labels,
    logoDataUrl: readString(config, ["logoDataUrl", "logo_data_url"]),
    general: isRecord(config.general)
      ? (config.general as unknown as PlotConfiguration["general"])
      : fallback.general,
    pdfItems: Array.isArray(config.pdfItems)
      ? (config.pdfItems as unknown as PlotConfiguration["pdfItems"])
      : [],
    tracks,
    azimuthal: isRecord(config.azimuthal)
      ? (config.azimuthal as unknown as PlotConfiguration["azimuthal"])
      : fallback.azimuthal,
  };
}

function normalizePlotTemplateRecord(record: BackendPlotTemplate): PlotTemplateRecord | null {
  const config = readTemplateConfig(record);
  const plotConfig = backendTemplateToPlotConfig(record) ?? undefined;
  const id = readString(record, idKeys) ?? plotConfig?.id;
  const name = readString(record, nameKeys) ?? plotConfig?.name;

  if (!id || !name) return null;

  return {
    id,
    name,
    description: readString(record, descriptionKeys) ?? plotConfig?.description,
    isDefault: readBoolean(record, defaultKeys) ?? plotConfig?.isDefault ?? false,
    config,
    plotConfig,
    raw: record,
  };
}

function normalizeSavedTemplate(record: BackendPlotTemplate, payload: PlotTemplatePayload) {
  const normalized = normalizePlotTemplateRecord(record);
  const fallbackRecord = compactObject({
    ...record,
    name: readString(record, nameKeys) ?? payload.name,
    description: readString(record, descriptionKeys) ?? payload.description,
    isDefault: readBoolean(record, defaultKeys) ?? payload.isDefault,
    config: payload.config,
  });
  const fallbackConfig = backendTemplateToPlotConfig(fallbackRecord);

  if (!normalized) {
    if (!fallbackConfig) {
      throw new Error("Backend returned a plot template that cannot be mapped to plotting config.");
    }

    return {
      id: fallbackConfig.id,
      name: fallbackConfig.name,
      description: fallbackConfig.description,
      isDefault: fallbackConfig.isDefault,
      config: payload.config,
      plotConfig: fallbackConfig,
      raw: record,
    } satisfies PlotTemplateRecord;
  }

  return {
    ...normalized,
    plotConfig:
      normalized.plotConfig ??
      (fallbackConfig
        ? ({
            ...fallbackConfig,
            id: normalized.id,
            name: normalized.name,
            description: normalized.description,
            isDefault: normalized.isDefault,
          } satisfies PlotConfiguration)
        : undefined),
  };
}

export async function getPlotTemplates(token: string): Promise<PlotTemplateRecord[]> {
  const response = await apiRequest<BackendPlotTemplateResponse | BackendRecord[]>("/api/plot-templates", {
    method: "GET",
    token,
  });

  return unwrapList(response)
    .map(normalizePlotTemplateRecord)
    .filter((template): template is PlotTemplateRecord => Boolean(template));
}

export async function getDefaultPlotTemplate(token: string): Promise<PlotTemplateRecord> {
  const response = await apiRequest<BackendPlotTemplateResponse | BackendRecord>(
    "/api/plot-templates/default",
    {
      method: "GET",
      token,
    }
  );
  const rawTemplate = unwrapSingle(response);
  const template = rawTemplate ? normalizePlotTemplateRecord(rawTemplate) : null;

  if (!template) {
    throw new Error("Backend returned a default plot template without usable metadata.");
  }

  return template;
}

export async function getPlotTemplateById(token: string, templateId: string): Promise<PlotTemplateRecord> {
  const response = await apiRequest<BackendPlotTemplateResponse | BackendRecord>(
    `/api/plot-templates/${templateId}`,
    {
      method: "GET",
      token,
    }
  );
  const rawTemplate = unwrapSingle(response);
  const template = rawTemplate ? normalizePlotTemplateRecord(rawTemplate) : null;

  if (!template) {
    throw new Error("Backend returned a plot template without usable metadata.");
  }

  return template;
}

export async function createPlotTemplate(
  token: string,
  payload: PlotTemplatePayload
): Promise<PlotTemplateRecord> {
  const response = await apiRequest<BackendPlotTemplateResponse | BackendRecord>("/api/plot-templates", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  const rawTemplate = unwrapSingle(response);

  if (!rawTemplate) {
    throw new Error("Backend returned an empty plot template create response.");
  }

  return normalizeSavedTemplate(rawTemplate, payload);
}

export async function updatePlotTemplate(
  token: string,
  templateId: string,
  payload: PlotTemplatePayload
): Promise<PlotTemplateRecord> {
  const response = await apiRequest<BackendPlotTemplateResponse | BackendRecord>(
    `/api/plot-templates/${templateId}`,
    {
      method: "PUT",
      token,
      body: JSON.stringify(payload),
    }
  );
  const rawTemplate = unwrapSingle(response);

  if (!rawTemplate) {
    throw new Error("Backend returned an empty plot template update response.");
  }

  return normalizeSavedTemplate(rawTemplate, payload);
}

export async function deletePlotTemplate(token: string, templateId: string): Promise<void> {
  await apiRequest<unknown>(`/api/plot-templates/${templateId}`, {
    method: "DELETE",
    token,
  });
}
