"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Copy, Download, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  downloadBlob,
  exportLas,
  getExportRecords,
  ExportRecord,
  LasExportColumnPayload,
  LasWellInfoItem,
} from "@/lib/exports-api";
import { cn } from "@/lib/utils";
import { LasExportColumn, LasPreviewResult, LasPreset } from "@/types/las";

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function createDefaultLasPreset(): LasPreset {
  return {
    id: "local-las-preset-default",
    name: "Local LAS Preset",
    description: "Local UI preset. Columns are selected from backend WITS config.",
    isDefault: true,
    updatedAt: new Date().toISOString(),
    settings: {
      minimumDepth: 0,
      maximumDepth: 0,
      stepDepth: 0.5,
      maximumGap: 30,
      nullValue: "-999.25",
    },
    options: {
      includeProjectedSurvey: false,
      includeSurveysInOtherSection: true,
      correctDepthColumnForTvd: false,
      dateTimeInFirstColumn: false,
      interpolateSurveyValues: false,
      useSurveyFormattedOutput: false,
    },
    columns: [],
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      {label}
    </label>
  );
}

function createPreview(preset: LasPreset): LasPreviewResult {
  const { settings, columns } = preset;
  const depthRange = `${settings.minimumDepth.toFixed(2)} - ${settings.maximumDepth.toFixed(2)}`;
  const lineCountEstimate = Math.max(
    0,
    Math.floor((settings.maximumDepth - settings.minimumDepth) / Math.max(settings.stepDepth, 0.01)) + 1
  );
  const curveLines = columns
    .map((column, index) => `${column.mnemonic.padEnd(8)}.${column.unit.padEnd(8)} : ${index + 1} ${column.description}`)
    .join("\n");

  return {
    presetName: preset.name,
    generatedAt: new Date().toISOString(),
    depthRange,
    columnCount: columns.length,
    lineCountEstimate,
    previewText: [
      "~Version Information",
      "VERS.   2.0 : CWLS LOG ASCII STANDARD",
      "WRAP.   NO  : One line per depth step",
      "~Well Information",
      `STRT.M  ${settings.minimumDepth.toFixed(2)} : Start depth`,
      `STOP.M  ${settings.maximumDepth.toFixed(2)} : Stop depth`,
      `STEP.M  ${settings.stepDepth.toFixed(2)} : Step depth`,
      `NULL.   ${settings.nullValue} : Null value`,
      "~Curve Information",
      "DEPT    .M        : Depth",
      curveLines,
      "~Other",
      `PRESET. ${preset.name}`,
      `PROJECTED_SURVEYS. ${preset.options.includeProjectedSurvey ? "YES" : "NO"}`,
      `SURVEY_OTHER_SECTION. ${preset.options.includeSurveysInOtherSection ? "YES" : "NO"}`,
      "~Ascii",
      `${settings.minimumDepth.toFixed(2)} ${columns.map(() => settings.nullValue).join(" ")}`,
    ].join("\n"),
  };
}

function getLasField(column: LasExportColumn) {
  const byWitsId: Record<string, string> = {
    "0110": "depthMd",
    "0713": "inclination",
    "0714": "azimuth",
    "0823": "gammaRay",
    "0824": "gammaRay",
  };
  const byMnemonic: Record<string, string> = {
    DEPT: "depthMd",
    HDEPT: "hole_depth",
    INCL: "inclination",
    AZIM: "azimuth",
    GR: "gammaRay",
    GRCOR: "gammaRay",
    GRRAW: "gammaRay",
  };

  return byWitsId[column.witsId] ?? byMnemonic[column.mnemonic] ?? column.mnemonic.toLowerCase();
}

function toLasColumns(columns: LasExportColumn[]): LasExportColumnPayload[] {
  return columns.map((column) => ({
    field: getLasField(column),
    mnemonic: column.mnemonic,
    unit: column.unit,
    description: column.description,
  }));
}

function toWellInfo(session: ReturnType<typeof useApp>["activeMwdSession"]): LasWellInfoItem[] {
  return [
    {
      name: "COMP",
      unit: "",
      data: session?.operator ?? "Company",
      description: "Company",
    },
    {
      name: "WELL",
      unit: "",
      data: session?.wellName ?? session?.name ?? "",
      description: "Well Name",
    },
    {
      name: "FLD",
      unit: "",
      data: typeof session?.raw.fieldName === "string" ? session.raw.fieldName : "",
      description: "Field",
    },
    {
      name: "RIG",
      unit: "",
      data: typeof session?.raw.rigId === "string" ? session.raw.rigId : "",
      description: "Rig ID",
    },
  ];
}

function formatExportDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd MMM yyyy HH:mm");
}

export default function GenerateLasPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const {
    activeMwdSessionId,
    activeMwdSession,
    witsConfig,
    witsConfigLoading,
    witsConfigError,
    refreshWitsConfig,
  } = useApp();
  const [presets, setPresets] = useState<LasPreset[]>(() => [createDefaultLasPreset()]);
  const [activePresetId, setActivePresetId] = useState("local-las-preset-default");
  const [draftPresetName, setDraftPresetName] = useState("New LAS Preset");
  const [preview, setPreview] = useState<LasPreviewResult | null>(null);
  const [exportingLas, setExportingLas] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>([]);
  const [exportRecordsLoading, setExportRecordsLoading] = useState(false);
  const [exportRecordsError, setExportRecordsError] = useState("");
  const [witsSearchQuery, setWitsSearchQuery] = useState("");
  const canExport = user?.role === "admin" || user?.role === "engineer";

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) ?? presets[0],
    [activePresetId, presets]
  );

  const backendLasColumns = useMemo<LasExportColumn[]>(
    () =>
      witsConfig
        .filter((config) => config.enabled)
        .map((config) => {
          const witsId = String(config.numericId).padStart(4, "0");
          return {
            id: `wits-${witsId}`,
            witsId,
            mnemonic: config.lasMnemonic || `W${witsId}`,
            unit: config.units || "",
            description: config.lasDescription || config.name || config.mappedField || `WITS ${witsId}`,
          };
        }),
    [witsConfig]
  );
  const activePresetColumns = useMemo(
    () =>
      (activePreset?.columns ?? []).filter((column) =>
        backendLasColumns.some((backendColumn) => backendColumn.id === column.id)
      ),
    [activePreset?.columns, backendLasColumns]
  );
  const selectedColumnIds = useMemo(
    () => new Set(activePresetColumns.map((column) => column.id)),
    [activePresetColumns]
  );
  const availableColumns = useMemo(
    () => backendLasColumns.filter((column) => !selectedColumnIds.has(column.id)),
    [backendLasColumns, selectedColumnIds]
  );
  const filteredAvailableColumns = useMemo(() => {
    const query = witsSearchQuery.trim().toLowerCase();

    if (!query) return availableColumns;

    return availableColumns.filter((column) =>
      [
        column.id,
        column.witsId,
        column.mnemonic,
        column.unit,
        column.description,
      ].some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [availableColumns, witsSearchQuery]);
  const lasExportRecords = useMemo(
    () =>
      exportRecords.filter((record) => {
        const type = `${record.type ?? ""} ${record.fileName ?? ""}`.toLowerCase();
        return type.includes("las") || type.includes(".las");
      }),
    [exportRecords]
  );

  const loadExportRecords = useCallback(async () => {
    if (!token) {
      setExportRecords([]);
      setExportRecordsError("");
      return;
    }

    setExportRecordsLoading(true);
    setExportRecordsError("");

    try {
      const records = await getExportRecords(token);
      setExportRecords(records);
    } catch (error) {
      setExportRecords([]);
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load export history.", error);
      }
      setExportRecordsError("Gagal memuat data dari backend.");
    } finally {
      setExportRecordsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadExportRecords();
  }, [loadExportRecords]);

  const updateActivePreset = (patch: Partial<LasPreset>) => {
    if (!activePreset) {
      return;
    }

    setPresets((current) =>
      current.map((preset) =>
        preset.id === activePreset.id
          ? {
              ...preset,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : preset
      )
    );
  };

  const addPreset = () => {
    const base = activePreset ?? createDefaultLasPreset();
    const nextPreset: LasPreset = {
      ...base,
      id: uid("las-preset"),
      name: draftPresetName,
      description: "Local LAS preset created from current settings.",
      isDefault: false,
      columns: [...activePresetColumns],
      updatedAt: new Date().toISOString(),
    };
    setPresets((current) => [nextPreset, ...current]);
    setActivePresetId(nextPreset.id);
    toast.success("LAS preset added");
  };

  const duplicatePreset = () => {
    if (!activePreset) return;
    const duplicate: LasPreset = {
      ...activePreset,
      id: uid("las-preset"),
      name: `${activePreset.name} Copy`,
      isDefault: false,
      columns: [...activePresetColumns],
      updatedAt: new Date().toISOString(),
    };
    setPresets((current) => [duplicate, ...current]);
    setActivePresetId(duplicate.id);
    toast.success("LAS preset duplicated");
  };

  const removePreset = () => {
    if (!activePreset || presets.length <= 1) return;
    const nextPresets = presets.filter((preset) => preset.id !== activePreset.id);
    setPresets(nextPresets);
    setActivePresetId(nextPresets[0]?.id ?? "");
    toast.success("LAS preset deleted");
  };

  const moveColumn = (columnIndex: number, direction: -1 | 1) => {
    if (!activePreset) return;
    const nextIndex = columnIndex + direction;
    if (nextIndex < 0 || nextIndex >= activePresetColumns.length) return;
    const nextColumns = [...activePresetColumns];
    [nextColumns[columnIndex], nextColumns[nextIndex]] = [nextColumns[nextIndex], nextColumns[columnIndex]];
    updateActivePreset({ columns: nextColumns });
  };

  const handleGeneratePreview = () => {
    if (!activePreset) return;
    const nextPreview = createPreview({ ...activePreset, columns: activePresetColumns });
    setPreview(nextPreview);
    toast.success("LAS preview generated locally");
  };

  const handleGenerateLas = async () => {
    if (!token) {
      toast.error("Please sign in before generating LAS");
      return;
    }

    if (!canExport) {
      toast.error("Your role does not have export access");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before generating LAS");
      return;
    }

    if (!activePreset) return;
    if (activePresetColumns.length === 0) {
      toast.error("Belum ada konfigurasi WITS. Tambahkan WITS ID terlebih dahulu.");
      return;
    }

    setExportingLas(true);
    setExportError("");

    try {
      const blob = await exportLas(token, {
        sessionId: activeMwdSessionId,
        startDepth: activePreset.settings.minimumDepth,
        endDepth: activePreset.settings.maximumDepth,
        stepDepth: activePreset.settings.stepDepth,
        depthPrecision: 4,
        maxGap: activePreset.settings.maximumGap,
        nullValue: Number(activePreset.settings.nullValue) || -9999,
        includeWits: true,
        includeSurvey: true,
        includeProjectedSurvey: activePreset.options.includeProjectedSurvey,
        includeSurveysInOtherSection: activePreset.options.includeSurveysInOtherSection,
        stopAtLastSurveyDepth: false,
        dateTimeInFirstColumn: activePreset.options.dateTimeInFirstColumn,
        correctDepthColumnForTvd: activePreset.options.correctDepthColumnForTvd,
        interpolateSurvey: activePreset.options.interpolateSurveyValues,
        surveyStationType: "actual",
        depthUnit: "m",
        columns: toLasColumns(activePresetColumns),
        wellInfo: toWellInfo(activeMwdSession),
      });
      downloadBlob(blob, "mwd-export.las");
      await loadExportRecords();
      toast.success("LAS export downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export LAS.";
      setExportError(message);
      toast.error("LAS export failed", {
        description: message,
      });
    } finally {
      setExportingLas(false);
    }
  };

  const content = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Data Management</Badge>
            <Badge variant="outline">Generate LAS</Badge>
            <Badge variant={witsConfigError ? "destructive" : "outline"}>
              {witsConfigError
                ? "WITS config unavailable"
                : witsConfigLoading
                  ? "Loading WITS config"
                  : backendLasColumns.length > 0
                    ? `${backendLasColumns.length} WITS LAS columns`
                    : "Belum ada konfigurasi WITS. Tambahkan WITS ID terlebih dahulu."}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Generate LAS</h1>
          <p className="text-sm text-muted-foreground">
            Configure LAS presets, depth export rules, survey options, selected channels, and preview output.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refreshWitsConfig()} disabled={witsConfigLoading}>
            Refresh WITS
          </Button>
          <Button onClick={() => void handleGenerateLas()} disabled={exportingLas || !canExport}>
            <Download className="mr-2 size-4" />
            {exportingLas ? "Generating..." : "Generate LAS"}
          </Button>
        </div>
      </div>

      {exportError ? (
        <Card className="rounded-2xl border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {exportError}
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">LAS Presets</h2>
            <Badge variant="outline">{presets.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActivePresetId(preset.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition hover:bg-muted/50",
                  activePreset?.id === preset.id && "border-primary bg-muted"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{preset.name}</span>
                  {preset.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {preset.columns.length} columns, {preset.settings.minimumDepth}-{preset.settings.maximumDepth} m
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <Input value={draftPresetName} onChange={(event) => setDraftPresetName(event.target.value)} />
            <Button className="w-full" variant="outline" onClick={addPreset}>
              <Plus className="mr-2 size-4" />
              Add Preset
            </Button>
            <Button className="w-full" variant="outline" onClick={duplicatePreset}>
              <Copy className="mr-2 size-4" />
              Duplicate Active
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() =>
                activePreset &&
                setPresets((current) =>
                  current.map((preset) => ({ ...preset, isDefault: preset.id === activePreset.id }))
                )
              }
            >
              <Save className="mr-2 size-4" />
              Mark Default
            </Button>
            <ConfirmDeleteButton
              title="Delete LAS preset?"
              description={activePreset ? `${activePreset.name} will be removed from local preset state.` : undefined}
              triggerLabel="Delete Active"
              size="sm"
              className="w-full justify-center"
              disabled={presets.length <= 1}
              onConfirm={removePreset}
            />
          </div>
        </Card>

        {activePreset ? (
          <div className="space-y-4">
            <Card className="rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Preset Details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Edit the active LAS preset name and description.
                  </p>
                </div>
                <Badge variant="outline">Updated {format(new Date(activePreset.updatedAt), "dd MMM HH:mm")}</Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
                <Field label="Preset Name">
                  <Input value={activePreset.name} onChange={(event) => updateActivePreset({ name: event.target.value })} />
                </Field>
                <Field label="Description">
                  <Input value={activePreset.description} onChange={(event) => updateActivePreset({ description: event.target.value })} />
                </Field>
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <Card className="rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Export Settings</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Field label="Minimum Depth">
                    <Input
                      type="number"
                      value={activePreset.settings.minimumDepth}
                      onChange={(event) =>
                        updateActivePreset({
                          settings: { ...activePreset.settings, minimumDepth: Number(event.target.value) },
                        })
                      }
                    />
                  </Field>
                  <Field label="Maximum Depth">
                    <Input
                      type="number"
                      value={activePreset.settings.maximumDepth}
                      onChange={(event) =>
                        updateActivePreset({
                          settings: { ...activePreset.settings, maximumDepth: Number(event.target.value) },
                        })
                      }
                    />
                  </Field>
                  <Field label="Step Depth">
                    <Input
                      type="number"
                      step="0.01"
                      value={activePreset.settings.stepDepth}
                      onChange={(event) =>
                        updateActivePreset({
                          settings: { ...activePreset.settings, stepDepth: Number(event.target.value) },
                        })
                      }
                    />
                  </Field>
                  <Field label="Maximum Gap">
                    <Input
                      type="number"
                      value={activePreset.settings.maximumGap}
                      onChange={(event) =>
                        updateActivePreset({
                          settings: { ...activePreset.settings, maximumGap: Number(event.target.value) },
                        })
                      }
                    />
                  </Field>
                  <Field label="Null Value">
                    <Input
                      value={activePreset.settings.nullValue}
                      onChange={(event) =>
                        updateActivePreset({
                          settings: { ...activePreset.settings, nullValue: event.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
              </Card>

              <Card className="rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Other Information</h2>
                <div className="mt-4 grid gap-3">
                  {[
                    ["includeProjectedSurvey", "Include projected survey"],
                    ["includeSurveysInOtherSection", "Include surveys in ~Other section"],
                    ["correctDepthColumnForTvd", "Correct depth column for TVD"],
                    ["dateTimeInFirstColumn", "Date/time in first column"],
                    ["interpolateSurveyValues", "Interpolate survey values between survey depths"],
                    ["useSurveyFormattedOutput", "Use survey formatted output"],
                  ].map(([key, label]) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={activePreset.options[key as keyof typeof activePreset.options]}
                      onCheckedChange={(checked) =>
                        updateActivePreset({
                          options: { ...activePreset.options, [key]: checked },
                        })
                      }
                    />
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Available WITS IDs</h2>
                  <Badge variant="outline">
                    {witsSearchQuery.trim()
                      ? `${filteredAvailableColumns.length} of ${availableColumns.length}`
                      : `${availableColumns.length} available`}
                  </Badge>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={witsSearchQuery}
                    onChange={(event) => setWitsSearchQuery(event.target.value)}
                    placeholder="Search WITS ID, mnemonic, description, or unit"
                    className="pl-9 pr-10"
                    aria-label="Search available WITS IDs"
                  />
                  {witsSearchQuery ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                      onClick={() => setWitsSearchQuery("")}
                      aria-label="Clear WITS ID search"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <ScrollArea className="mt-4 h-[320px] rounded-xl border sm:h-[360px] xl:h-[420px]">
                  <div className="space-y-2 p-3">
                    {backendLasColumns.length === 0 && !witsConfigLoading ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Belum ada konfigurasi WITS. Tambahkan WITS ID terlebih dahulu.
                      </div>
                    ) : null}
                    {backendLasColumns.length > 0 && availableColumns.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Semua WITS ID yang tersedia sudah dipilih untuk preset ini.
                      </div>
                    ) : null}
                    {availableColumns.length > 0 && filteredAvailableColumns.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        No WITS ID found for this keyword.
                      </div>
                    ) : null}
                    {filteredAvailableColumns.map((column) => (
                      <div key={column.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm font-semibold">{column.witsId} / {column.mnemonic}</div>
                          <div className="text-sm text-muted-foreground">{column.description} ({column.unit})</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateActivePreset({ columns: [...activePresetColumns, column] })}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>

              <Card className="rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Selected LAS Columns</h2>
                  <Badge variant="secondary">{activePresetColumns.length} columns</Badge>
                </div>
                <ScrollArea className="mt-4 h-[320px] rounded-xl border sm:h-[360px] xl:h-[420px]">
                  <div className="space-y-2 p-3">
                  {activePresetColumns.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Belum ada kolom LAS yang dipilih. Tambahkan WITS ID dari panel kiri.
                    </div>
                  ) : null}
                  {activePresetColumns.map((column: LasExportColumn, index) => (
                    <div key={column.id} className="grid gap-2 rounded-xl border px-3 py-2 md:grid-cols-[1fr_auto_auto_auto]">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold">{index + 1}. {column.mnemonic} ({column.witsId})</div>
                        <div className="text-sm text-muted-foreground">{column.description} / {column.unit}</div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => moveColumn(index, -1)}>
                        Up
                      </Button>
                      <Button size="sm" variant="ghost" disabled={index === activePresetColumns.length - 1} onClick={() => moveColumn(index, 1)}>
                        Down
                      </Button>
                      <ConfirmDeleteButton
                        title="Remove LAS column?"
                        description={`${column.mnemonic} (${column.witsId}) will be removed from this preset.`}
                        onConfirm={() => {
                          updateActivePreset({
                            columns: activePresetColumns.filter((item) => item.id !== column.id),
                          });
                          toast.success("LAS column removed");
                        }}
                      />
                    </div>
                  ))}
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <Card className="rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">LAS Preview Summary</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Preview is local. Generate LAS downloads the backend LAS export for the active session.
                  </p>
                </div>
                <Button onClick={handleGeneratePreview}>
                  <Download className="mr-2 size-4" />
                  Generate Preview
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Preset</div>
                  <div className="mt-1 font-medium">{preview?.presetName ?? activePreset.name}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Depth Range</div>
                  <div className="mt-1 font-mono font-medium">{preview?.depthRange ?? `${activePreset.settings.minimumDepth}-${activePreset.settings.maximumDepth}`}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Columns</div>
                  <div className="mt-1 font-mono font-medium">{preview?.columnCount ?? activePresetColumns.length}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Lines</div>
                  <div className="mt-1 font-mono font-medium">{preview?.lineCountEstimate ?? "-"}</div>
                </div>
              </div>
              <pre className="mt-4 max-h-[360px] overflow-auto rounded-xl border bg-background p-4 font-mono text-xs leading-5">
                {preview?.previewText ?? createPreview(activePreset).previewText}
              </pre>
            </Card>

            <Card className="rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">LAS Export History</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Loaded from /api/exports/records after each LAS export.
                  </p>
                </div>
                <Button variant="outline" onClick={() => void loadExportRecords()} disabled={exportRecordsLoading}>
                  <RefreshCw className={cn("mr-2 size-4", exportRecordsLoading && "animate-spin")} />
                  Refresh History
                </Button>
              </div>

              {exportRecordsError ? (
                <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {exportRecordsError}
                </div>
              ) : null}

              {!exportRecordsLoading && !exportRecordsError && lasExportRecords.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Belum ada riwayat export LAS
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {lasExportRecords.slice(0, 8).map((record) => (
                  <div key={record.id} className="grid gap-2 rounded-xl border px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto]">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{record.fileName ?? record.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.type ?? "LAS"} {record.createdAt ? `| ${formatExportDate(record.createdAt)}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="w-fit">{record.status ?? "recorded"}</Badge>
                    {record.downloadUrl ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={record.downloadUrl}>Download</a>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="data-management-generate-las" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
