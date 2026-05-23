"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileUp,
  Pencil,
  GripVertical,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
import { DepthScalePositionEditor } from "@/components/contents/data-management/depth-scale-position-editor";
import { MudResistivityCalculator } from "@/components/contents/data-management/mud-resistivity-calculator";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  mockPlotConfigurations,
  mockPlotHeaderInfo,
  mockPlotLabels,
  mockTemplateFiles,
  mockUploadedUserFiles,
} from "@/data/plotting-data";
import { ApiClientError } from "@/lib/api-client";
import { downloadBlob, exportPdfPlot } from "@/lib/exports-api";
import {
  createPlotTemplate,
  deletePlotTemplate,
  getPlotTemplateById,
  plotConfigToTemplatePayload,
  updatePlotTemplate,
} from "@/lib/plot-templates-api";
import { cn } from "@/lib/utils";
import {
  AzimuthalPlotSettings,
  CurveConfig,
  CurveLineStyle,
  DepthCorrectionMode,
  DepthScalePosition,
  HeaderPreset,
  ImageContrastMode,
  PdfPlacement,
  PlotConfiguration,
  PlotFileFormat,
  PlotGeneralSettings,
  PlotHeaderInfo,
  PlotLabel,
  PlotTextAlign,
  TemplateFile,
  TemplateFileType,
  TrackConfig,
  TrackScaleType,
  UploadedUserFile,
} from "@/types/plotting";

const dataSources = [
  "None",
  "0110 - Hole depth",
  "0713 - Inclination",
  "0714 - Azimuth",
  "0716 - Magnetic toolface",
  "0717 - Gravity toolface",
  "0824 - Gamma corrected",
  "0836 - Temperature",
  "0921 - Battery voltage",
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function clonePlotConfiguration(source: PlotConfiguration, name?: string): PlotConfiguration {
  const safeSource = normalizePlotConfiguration(source);

  return {
    ...safeSource,
    id: uid("plot-config"),
    name: name ?? `${safeSource.name} Copy`,
    isDefault: false,
    pdfItems: safeSource.pdfItems.map((item) => ({ ...item, id: uid("pdf-item") })),
    tracks: safeSource.tracks.map((track) => ({
      ...track,
      id: uid("track"),
      curves: track.curves.map((curve) => ({ ...curve, id: uid("curve") })),
    })),
  };
}

function ensurePlotTracks(tracks: TrackConfig[]): TrackConfig[] {
  return Array.from({ length: 5 }, (_, index) => {
    const existing = tracks[index];
    return (
      existing ?? {
        id: uid("track"),
        name: `Track ${index + 1}`,
        scaleType: "Linear",
        densityTicMarks: false,
        curves: [],
      }
    );
  });
}

function normalizePlotConfiguration(config?: PlotConfiguration | null): PlotConfiguration {
  const fallback = mockPlotConfigurations[0];
  const general = normalizeGeneralSettings(config?.general);
  const tracks = Array.isArray(config?.tracks) ? config.tracks : fallback.tracks;
  const pdfItems = Array.isArray(config?.pdfItems) ? config.pdfItems : fallback.pdfItems;

  return {
    ...fallback,
    ...(config ?? {}),
    id: config?.id ?? fallback.id,
    name: config?.name ?? fallback.name,
    isDefault: config?.isDefault ?? false,
    general,
    pdfItems,
    tracks,
    azimuthal: {
      ...fallback.azimuthal,
      ...(config?.azimuthal ?? {}),
    },
  };
}

function dedupePlotConfigurations(configs: PlotConfiguration[]) {
  const seen = new Set<string>();
  const result: PlotConfiguration[] = [];

  for (const config of configs) {
    if (!config.id || seen.has(config.id)) continue;
    seen.add(config.id);
    result.push(config);
  }

  return result;
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

function NativeSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <select
      className="h-10 w-full min-w-0 rounded-md border bg-background pl-1 pr-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
    <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md border px-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      {label}
    </label>
  );
}

function ColorSwatchInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative flex h-10 w-11 cursor-pointer items-center justify-center rounded-md border bg-background" title={label}>
      <span className="sr-only">{label}</span>
      <span className="h-5 w-6 rounded-sm border" style={{ backgroundColor: value }} />
      <input
        type="color"
        value={value}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function HeaderInformationEditor({
  header,
  onChange,
}: {
  header: PlotHeaderInfo;
  onChange: (header: PlotHeaderInfo) => void;
}) {
  const patchHeader = (patch: Partial<PlotHeaderInfo>) => onChange({ ...header, ...patch });
  const patchLog = (patch: Partial<PlotHeaderInfo["logInformation"]>) =>
    patchHeader({ logInformation: { ...header.logInformation, ...patch } });
  const patchDrilling = (patch: Partial<PlotHeaderInfo["drillingParameters"]>) =>
    patchHeader({ drillingParameters: { ...header.drillingParameters, ...patch } });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Log Main Header Information</h2>
          <Badge variant="outline">{header.userDefinedLabels.length}/8 user labels</Badge>
        </div>
        <div className="mt-4">
          <Field label="Plot Title">
            <Input value={header.plotTitle} onChange={(event) => patchHeader({ plotTitle: event.target.value })} />
          </Field>
        </div>
        <div className="mt-4 space-y-3">
          {header.userDefinedLabels.map((item) => (
            <div key={item.id} className="grid gap-2 md:grid-cols-[240px_1fr_auto]">
              <Input
                value={item.label}
                onChange={(event) =>
                  patchHeader({
                    userDefinedLabels: header.userDefinedLabels.map((row) =>
                      row.id === item.id ? { ...row, label: event.target.value } : row
                    ),
                  })
                }
              />
              <Input
                value={item.value}
                onChange={(event) =>
                  patchHeader({
                    userDefinedLabels: header.userDefinedLabels.map((row) =>
                      row.id === item.id ? { ...row, value: event.target.value } : row
                    ),
                  })
                }
              />
              <ConfirmDeleteButton
                title="Delete header label?"
                description={`${item.label || "This label"} will be removed from the plot header.`}
                onConfirm={() => {
                  patchHeader({
                    userDefinedLabels: header.userDefinedLabels.filter((row) => row.id !== item.id),
                  });
                  toast.success("Header label deleted");
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              patchHeader({
                userDefinedLabels: [
                  ...header.userDefinedLabels,
                  { id: uid("udl"), label: "Label", value: "Value" },
                ].slice(0, 8),
              })
            }
            disabled={header.userDefinedLabels.length >= 8}
          >
            <Plus className="mr-2 size-4" />
            Add Label Row
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Log Information</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Log Measurements">
            <Input
              value={header.logInformation.logMeasurements}
              onChange={(event) => patchLog({ logMeasurements: event.target.value })}
            />
          </Field>
          <Field label="Depth Measured From">
            <Input
              value={header.logInformation.depthMeasuredFrom}
              onChange={(event) => patchLog({ depthMeasuredFrom: event.target.value })}
            />
          </Field>
          <Field label="Max Temperature">
            <Input
              value={header.logInformation.maxTemperature}
              onChange={(event) => patchLog({ maxTemperature: event.target.value })}
            />
          </Field>
          <Field label="Start Depth">
            <Input
              type="number"
              value={header.logInformation.startDepth}
              onChange={(event) => patchLog({ startDepth: Number(event.target.value) })}
            />
          </Field>
          <Field label="End Depth">
            <Input
              type="number"
              value={header.logInformation.endDepth}
              onChange={(event) => patchLog({ endDepth: Number(event.target.value) })}
            />
          </Field>
          <Field label="Start Date">
            <Input
              type="date"
              value={header.logInformation.startDate}
              onChange={(event) => patchLog({ startDate: event.target.value })}
            />
          </Field>
          <Field label="End Date">
            <Input
              type="date"
              value={header.logInformation.endDate}
              onChange={(event) => patchLog({ endDate: event.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card className="rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Casing and Other Drilling Parameters</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {[
            ["casingDepth", "Casing Depth"],
            ["density", "Density"],
            ["viscosity", "Viscosity"],
            ["rm", "Rm"],
            ["rmf", "Rmf"],
            ["rmc", "Rmc"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                value={header.drillingParameters[key as keyof Pick<PlotHeaderInfo["drillingParameters"], "casingDepth" | "density" | "viscosity" | "rm" | "rmf" | "rmc">]}
                onChange={(event) => patchDrilling({ [key]: Number(event.target.value) })}
              />
            </Field>
          ))}
          <Field label="Casing Size">
            <Input
              value={header.drillingParameters.casingSize}
              onChange={(event) => patchDrilling({ casingSize: event.target.value })}
            />
          </Field>
          <Field label="Mud Type">
            <Input
              value={header.drillingParameters.mudType}
              onChange={(event) => patchDrilling({ mudType: event.target.value })}
            />
          </Field>
          {[
            ["kellyBushing", "Kelly Bushing"],
            ["drillFloor", "Drill Floor"],
            ["groundLevel", "Ground Level"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                value={header.drillingParameters.elevations[key as keyof PlotHeaderInfo["drillingParameters"]["elevations"]]}
                onChange={(event) =>
                  patchDrilling({
                    elevations: {
                      ...header.drillingParameters.elevations,
                      [key]: Number(event.target.value),
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Run Summaries</h2>
          <Button
            variant="outline"
            onClick={() =>
              patchHeader({
                runSummaries: [
                  ...header.runSummaries,
                  {
                    id: uid("run"),
                    name: `Run ${header.runSummaries.length + 1}`,
                    surveyOffset: 0,
                    gammaOffset: 0,
                    startDepth: header.logInformation.startDepth,
                    endDepth: header.logInformation.endDepth,
                    startDate: header.logInformation.startDate,
                    endDate: header.logInformation.endDate,
                    startTime: "00:00",
                    endTime: "00:00",
                  },
                ],
              })
            }
          >
            <Plus className="mr-2 size-4" />
            Add Run
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {header.runSummaries.map((run) => (
            <div key={run.id} className="grid gap-3 rounded-xl border p-3 lg:grid-cols-[160px_repeat(4,1fr)_auto]">
              <Input
                value={run.name}
                onChange={(event) =>
                  patchHeader({
                    runSummaries: header.runSummaries.map((item) =>
                      item.id === run.id ? { ...item, name: event.target.value } : item
                    ),
                  })
                }
              />
              <Input
                type="number"
                value={run.surveyOffset}
                onChange={(event) =>
                  patchHeader({
                    runSummaries: header.runSummaries.map((item) =>
                      item.id === run.id ? { ...item, surveyOffset: Number(event.target.value) } : item
                    ),
                  })
                }
                title="Survey offset"
              />
              <Input
                type="number"
                value={run.gammaOffset}
                onChange={(event) =>
                  patchHeader({
                    runSummaries: header.runSummaries.map((item) =>
                      item.id === run.id ? { ...item, gammaOffset: Number(event.target.value) } : item
                    ),
                  })
                }
                title="Gamma offset"
              />
              <Input
                type="number"
                value={run.startDepth}
                onChange={(event) =>
                  patchHeader({
                    runSummaries: header.runSummaries.map((item) =>
                      item.id === run.id ? { ...item, startDepth: Number(event.target.value) } : item
                    ),
                  })
                }
                title="Start depth"
              />
              <Input
                type="number"
                value={run.endDepth}
                onChange={(event) =>
                  patchHeader({
                    runSummaries: header.runSummaries.map((item) =>
                      item.id === run.id ? { ...item, endDepth: Number(event.target.value) } : item
                    ),
                  })
                }
                title="End depth"
              />
              <ConfirmDeleteButton
                title="Delete run summary?"
                description={`${run.name} will be removed from run summaries.`}
                onConfirm={() => {
                  patchHeader({
                    runSummaries: header.runSummaries.filter((item) => item.id !== run.id),
                  });
                  toast.success("Run summary deleted");
                }}
              />
              <div className="grid gap-3 lg:col-span-6 lg:grid-cols-4">
                <Input
                  type="date"
                  value={run.startDate}
                  onChange={(event) =>
                    patchHeader({
                      runSummaries: header.runSummaries.map((item) =>
                        item.id === run.id ? { ...item, startDate: event.target.value } : item
                      ),
                    })
                  }
                />
                <Input
                  type="date"
                  value={run.endDate}
                  onChange={(event) =>
                    patchHeader({
                      runSummaries: header.runSummaries.map((item) =>
                        item.id === run.id ? { ...item, endDate: event.target.value } : item
                      ),
                    })
                  }
                />
                <Input
                  type="time"
                  value={run.startTime}
                  onChange={(event) =>
                    patchHeader({
                      runSummaries: header.runSummaries.map((item) =>
                        item.id === run.id ? { ...item, startTime: event.target.value } : item
                      ),
                    })
                  }
                />
                <Input
                  type="time"
                  value={run.endTime}
                  onChange={(event) =>
                    patchHeader({
                      runSummaries: header.runSummaries.map((item) =>
                        item.id === run.id ? { ...item, endTime: event.target.value } : item
                      ),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

type NormalizedGeneralSettings = PlotGeneralSettings & {
  headerPreset: HeaderPreset;
  page: NonNullable<PlotGeneralSettings["page"]>;
  depthRange: NonNullable<PlotGeneralSettings["depthRange"]>;
  grid: NonNullable<PlotGeneralSettings["grid"]>;
  azimuthal: NonNullable<PlotGeneralSettings["azimuthal"]>;
  surveys: NonNullable<PlotGeneralSettings["surveys"]>;
  layout: NonNullable<PlotGeneralSettings["layout"]>;
};

const headerPresets: HeaderPreset[] = ["None", "Short", "Standard", "Alternate", "Extended"];
const depthScaleOptions = ["1:200", "1:400", "1:500", "1:600", "1:1000"];

const headerPresetStyle: Record<HeaderPreset, string> = {
  None: "No Header",
  Short: "Short Directional Header",
  Standard: "Standard Directional Header",
  Alternate: "Alternate Directional Header",
  Extended: "Extended Directional Header",
};

function inferHeaderPreset(headerStyle: string): HeaderPreset {
  const lower = headerStyle.toLowerCase();
  if (lower.includes("none") || lower.includes("no header")) return "None";
  if (lower.includes("short")) return "Short";
  if (lower.includes("alternate")) return "Alternate";
  if (lower.includes("extended")) return "Extended";
  return "Standard";
}

function normalizeGeneralSettings(general?: PlotGeneralSettings): NormalizedGeneralSettings {
  const fallback = mockPlotConfigurations[0].general;
  const source = {
    ...fallback,
    ...(general ?? {}),
  };
  const headerPreset = source.headerPreset ?? inferHeaderPreset(source.headerStyle ?? fallback.headerStyle);

  return {
    ...source,
    headerPreset,
    page: {
      multiPage: source.page?.multiPage ?? source.multiPageOutput,
      widthIn: source.page?.widthIn ?? 8.5,
      heightIn: source.page?.heightIn ?? 11,
      noTopBottomMargins: source.page?.noTopBottomMargins ?? false,
      maxPageLengthFt: source.page?.maxPageLengthFt ?? 1200,
    },
    depthRange: {
      start: source.depthRange?.start ?? source.measuredDepthStart,
      end: source.depthRange?.end ?? source.measuredDepthEnd,
      useTvd: source.depthRange?.useTvd ?? source.useTvd,
    },
    grid: {
      depthScale: source.grid?.depthScale ?? source.depthScale,
      majorTick: source.grid?.majorTick ?? source.majorTicInterval,
      minorTick: source.grid?.minorTick ?? source.minorTicInterval,
      firstDataSpacing: source.grid?.firstDataSpacing ?? source.stepTicInterval,
      topSpacing: source.grid?.topSpacing ?? 12,
      bottomSpacing: source.grid?.bottomSpacing ?? 12,
    },
    azimuthal: {
      slideDetectionNoData: source.azimuthal?.slideDetectionNoData ?? 0,
    },
    surveys: {
      trackIndex: source.surveys?.trackIndex ?? (source.surveysInTrack ? 1 : 0),
      includePtb: source.surveys?.includePtb ?? false,
      printLabels: source.surveys?.printLabels ?? source.printLabels,
      transparentBackground: source.surveys?.transparentBackground ?? false,
      reportAtEnd: source.surveys?.reportAtEnd ?? source.surveyReportAtEnd,
    },
    layout: {
      customHeaders: source.layout?.customHeaders ?? false,
      previewStyle: source.layout?.previewStyle ?? "standard",
      selectedTemplateId: source.layout?.selectedTemplateId,
    },
  };
}

function toNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
  );
}

function RadioTile<T extends string>({
  value,
  label,
}: {
  value: T;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
      <RadioGroupItem value={value} />
      <span className="truncate">{label}</span>
    </label>
  );
}

function PlotLayoutPreview({
  config,
  general,
  onLayoutChange,
}: {
  config: PlotConfiguration;
  general: NormalizedGeneralSettings;
  onLayoutChange: (patch: Partial<NormalizedGeneralSettings["layout"]>) => void;
}) {
  const activeTracks = config.tracks.filter((track) => track.curves.some((curve) => curve.dataSource !== "None"));
  const depthSpan = Math.max(general.depthRange.end - general.depthRange.start, 0);
  const estimatedPages = general.page.multiPage
    ? Math.max(1, Math.ceil(depthSpan / Math.max(general.page.maxPageLengthFt, 1)))
    : 1;
  const headerHeight =
    general.headerPreset === "None"
      ? "h-2"
      : general.headerPreset === "Short"
        ? "h-5"
        : general.headerPreset === "Extended"
          ? "h-12"
          : "h-8";

  const layoutStyles: Array<{ id: NormalizedGeneralSettings["layout"]["previewStyle"]; label: string }> = [
    { id: "standard", label: "Standard" },
    { id: "compact", label: "Compact" },
    { id: "wide", label: "Wide" },
  ];

  return (
    <SettingsPanel title="Plot Layout" description="Live schematic from the active General settings.">
      <ToggleRow
        label="Custom Headers"
        checked={general.layout.customHeaders}
        onCheckedChange={(customHeaders) => onLayoutChange({ customHeaders })}
      />

      <div className="grid grid-cols-3 gap-2">
        {layoutStyles.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-xl border p-2 text-left transition hover:bg-muted/50",
              general.layout.previewStyle === item.id && "border-primary bg-primary/5"
            )}
            onClick={() => onLayoutChange({ previewStyle: item.id })}
          >
            <div className="mb-2 h-12 rounded-md border bg-background p-1">
              <div className={cn("rounded-sm bg-slate-300 dark:bg-slate-700", item.id === "compact" ? "h-2" : "h-3")} />
              <div className="mt-1 grid grid-cols-3 gap-1">
                <span className="h-6 rounded-sm bg-primary/30" />
                <span className={cn("h-6 rounded-sm bg-emerald-500/30", item.id === "wide" && "col-span-2")} />
                {item.id !== "wide" ? <span className="h-6 rounded-sm bg-amber-500/30" /> : null}
              </div>
            </div>
            <div className="truncate text-xs font-medium">{item.label}</div>
          </button>
        ))}
      </div>

      <div className={cn("rounded-2xl border p-3", general.layout.customHeaders && "border-primary/50 bg-primary/5")}>
        <div className="mx-auto w-full max-w-[220px] rounded-xl border bg-white p-2 shadow-sm dark:bg-slate-950">
          <div
            className="relative mx-auto overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-900"
            style={{
              aspectRatio: `${Math.max(general.page.widthIn, 1)} / ${Math.max(general.page.heightIn, 1)}`,
            }}
          >
            <div className={cn("border-b bg-slate-200 dark:bg-slate-800", headerHeight)}>
              <div className="flex h-full items-center px-2 text-[8px] font-semibold uppercase text-slate-600 dark:text-slate-300">
                {general.headerPreset === "None" ? "" : general.headerPreset}
              </div>
            </div>
            <div
              className="absolute inset-x-3 bottom-4 top-12 grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.max(activeTracks.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {(activeTracks.length ? activeTracks : [{ id: "empty", name: "No active track" } as TrackConfig]).map((track, index) => (
                <div key={track.id} className="relative overflow-hidden rounded-sm border bg-white dark:bg-slate-950">
                  <div className="h-full bg-[linear-gradient(to_bottom,rgba(148,163,184,0.25)_1px,transparent_1px)] bg-[length:100%_18%]" />
                  <div
                    className="absolute inset-y-2 left-1/2 w-px bg-primary/60"
                    style={{ transform: `translateX(${(index % 2) * 8 - 4}px)` }}
                  />
                </div>
              ))}
            </div>
            {general.surveys.trackIndex > 0 ? (
              <div className="absolute left-3 top-1/2 h-2 w-2 rounded-full bg-emerald-500" />
            ) : null}
            {general.surveys.printLabels ? (
              <div className="absolute bottom-2 right-3 rounded bg-amber-300 px-1 text-[7px] text-amber-950">LBL</div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
          <div className="flex justify-between gap-3"><span>Output</span><span className="font-medium text-foreground">{general.fileFormat}</span></div>
          <div className="flex justify-between gap-3"><span>Page</span><span className="font-medium text-foreground">{general.page.widthIn} x {general.page.heightIn} in</span></div>
          <div className="flex justify-between gap-3"><span>Pages</span><span className="font-medium text-foreground">{estimatedPages}</span></div>
          <div className="flex justify-between gap-3"><span>Depth</span><span className="font-medium text-foreground">{general.depthRange.start}-{general.depthRange.end}</span></div>
          <div className="flex justify-between gap-3"><span>Correction</span><span className="font-medium text-foreground">{general.depthCorrection}</span></div>
        </div>
      </div>
    </SettingsPanel>
  );
}

function GeneralEditor({
  config,
  onChange,
  onConfigChange,
  onSave,
  saving,
}: {
  config: PlotConfiguration;
  onChange: (patch: Partial<PlotConfiguration["general"]>) => void;
  onConfigChange: (patch: Partial<PlotConfiguration>) => void;
  onSave: (config: PlotConfiguration) => void;
  saving?: boolean;
}) {
  const general = normalizeGeneralSettings(config.general);
  const activeTrackCount = Math.max(config.tracks.length, 1);
  const validationErrors = [
    general.depthRange.start > general.depthRange.end ? "Start depth must be less than or equal to end depth." : null,
    general.page.widthIn <= 0 || general.page.heightIn <= 0 ? "Page width and height must be greater than zero." : null,
    general.page.maxPageLengthFt <= 0 ? "Maximum page length must be greater than zero." : null,
    general.grid.majorTick < 0 || general.grid.minorTick < 0 ? "Grid intervals cannot be negative." : null,
    general.surveys.trackIndex < 0 || general.surveys.trackIndex > activeTrackCount ? `Survey track must be between 0 and ${activeTrackCount}.` : null,
  ].filter(Boolean);

  const patchGeneral = (patch: Partial<PlotGeneralSettings>) => onChange(patch);
  const patchPage = (patch: Partial<NormalizedGeneralSettings["page"]>) => {
    const page = { ...general.page, ...patch };
    patchGeneral({ page, multiPageOutput: page.multiPage });
  };
  const patchDepthRange = (patch: Partial<NormalizedGeneralSettings["depthRange"]>) => {
    const depthRange = { ...general.depthRange, ...patch };
    patchGeneral({
      depthRange,
      measuredDepthStart: depthRange.start,
      measuredDepthEnd: depthRange.end,
      useTvd: depthRange.useTvd,
    });
  };
  const patchGrid = (patch: Partial<NormalizedGeneralSettings["grid"]>) => {
    const grid = { ...general.grid, ...patch };
    patchGeneral({
      grid,
      depthScale: grid.depthScale,
      majorTicInterval: grid.majorTick,
      minorTicInterval: grid.minorTick,
      stepTicInterval: grid.firstDataSpacing,
    });
  };
  const patchSurveys = (patch: Partial<NormalizedGeneralSettings["surveys"]>) => {
    const surveys = { ...general.surveys, ...patch };
    patchGeneral({
      surveys,
      surveysInTrack: surveys.trackIndex > 0,
      printLabels: surveys.printLabels,
      surveyReportAtEnd: surveys.reportAtEnd,
    });
  };
  const patchLayout = (patch: Partial<NormalizedGeneralSettings["layout"]>) => {
    patchGeneral({ layout: { ...general.layout, ...patch } });
  };
  const patchAzimuthal = (patch: Partial<NormalizedGeneralSettings["azimuthal"]>) => {
    patchGeneral({ azimuthal: { ...general.azimuthal, ...patch } });
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Field label="Plot Configuration Name">
            <Input value={config.name} onChange={(event) => onConfigChange({ name: event.target.value })} />
          </Field>
          <Button
            className="w-full lg:w-auto"
            disabled={saving}
            onClick={() => {
              if (validationErrors.length) {
                toast.error(validationErrors[0]);
                return;
              }
              onSave(config);
            }}
          >
            <Save className="mr-2 size-4" />
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
        {validationErrors.length ? (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {validationErrors[0]}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px] 2xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SettingsPanel title="Header (Built-in)" description="Synchronized with the plot header system.">
            <RadioGroup
              value={general.headerPreset}
              onValueChange={(headerPreset) =>
                patchGeneral({
                  headerPreset: headerPreset as HeaderPreset,
                  headerStyle: headerPresetStyle[headerPreset as HeaderPreset],
                })
              }
              className="grid gap-2"
            >
              {headerPresets.map((preset) => (
                <RadioTile key={preset} value={preset} label={preset} />
              ))}
            </RadioGroup>
          </SettingsPanel>

          <SettingsPanel title="File Format">
            <RadioGroup
              value={general.fileFormat}
              onValueChange={(fileFormat) => patchGeneral({ fileFormat: fileFormat as PlotFileFormat })}
              className="grid grid-cols-2 gap-2"
            >
              {(["PDF", "CGM", "TIFF", "JPG"] as PlotFileFormat[]).map((formatOption) => (
                <RadioTile key={formatOption} value={formatOption} label={formatOption} />
              ))}
            </RadioGroup>
          </SettingsPanel>

          <SettingsPanel title="Page Settings">
            <ToggleRow label="Multi-Page Plot" checked={general.page.multiPage} onCheckedChange={(multiPage) => patchPage({ multiPage })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Page Width (in)">
                <Input type="number" min={0.1} step={0.1} value={general.page.widthIn} onChange={(event) => patchPage({ widthIn: toNumber(event.target.value, general.page.widthIn) })} />
              </Field>
              <Field label="Page Height (in)">
                <Input type="number" min={0.1} step={0.1} value={general.page.heightIn} onChange={(event) => patchPage({ heightIn: toNumber(event.target.value, general.page.heightIn) })} />
              </Field>
            </div>
            <ToggleRow label="No top/bottom page margins" checked={general.page.noTopBottomMargins} onCheckedChange={(noTopBottomMargins) => patchPage({ noTopBottomMargins })} />
            <Field label="Maximum page length (ft)">
              <Input type="number" min={1} disabled={!general.page.multiPage} value={general.page.maxPageLengthFt} onChange={(event) => patchPage({ maxPageLengthFt: toNumber(event.target.value, general.page.maxPageLengthFt) })} />
            </Field>
          </SettingsPanel>
        </div>

        <div className="space-y-4">
          <SettingsPanel title="Plot Depth Range">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Start">
                <Input type="number" value={general.depthRange.start} onChange={(event) => patchDepthRange({ start: toNumber(event.target.value, general.depthRange.start) })} />
              </Field>
              <Field label="End">
                <Input type="number" value={general.depthRange.end} onChange={(event) => patchDepthRange({ end: toNumber(event.target.value, general.depthRange.end) })} />
              </Field>
              <div className="flex items-end">
                <ToggleRow label="TVD" checked={general.depthRange.useTvd} onCheckedChange={(useTvd) => patchDepthRange({ useTvd })} />
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Depth Scale and Grid Settings">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Scale">
                <NativeSelect<string> value={general.grid.depthScale} options={depthScaleOptions} onChange={(depthScale) => patchGrid({ depthScale })} />
              </Field>
              <Field label="Major tic interval">
                <Input type="number" min={0} value={general.grid.majorTick} onChange={(event) => patchGrid({ majorTick: toNumber(event.target.value, general.grid.majorTick) })} />
              </Field>
              <Field label="Minor tic interval">
                <Input type="number" min={0} value={general.grid.minorTick} onChange={(event) => patchGrid({ minorTick: toNumber(event.target.value, general.grid.minorTick) })} />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="First data spacing">
                <Input type="number" min={0} value={general.grid.firstDataSpacing} onChange={(event) => patchGrid({ firstDataSpacing: toNumber(event.target.value, general.grid.firstDataSpacing) })} />
              </Field>
              <Field label="Top spacing">
                <Input type="number" min={0} value={general.grid.topSpacing} onChange={(event) => patchGrid({ topSpacing: toNumber(event.target.value, general.grid.topSpacing) })} />
              </Field>
              <Field label="Bottom spacing">
                <Input type="number" min={0} value={general.grid.bottomSpacing} onChange={(event) => patchGrid({ bottomSpacing: toNumber(event.target.value, general.grid.bottomSpacing) })} />
              </Field>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Depth Correction">
            <RadioGroup
              value={general.depthCorrection}
              onValueChange={(depthCorrection) => patchGeneral({ depthCorrection: depthCorrection as DepthCorrectionMode })}
              className="grid gap-2 md:grid-cols-2"
            >
              <RadioTile value="MD" label="MD (Measured Depth)" />
              <RadioTile value="TVD" label="TVD (True Vertical Depth)" />
              <RadioTile value="TVDss" label="TVDss (TVD Subsea)" />
              <RadioTile value="VS" label="VS (Vertical Section)" />
            </RadioGroup>
          </SettingsPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <SettingsPanel title="Azimuthal Configuration">
              <Field label="Slide detection (no data)">
                <Input type="number" min={0} value={general.azimuthal.slideDetectionNoData} onChange={(event) => patchAzimuthal({ slideDetectionNoData: toNumber(event.target.value, general.azimuthal.slideDetectionNoData) })} />
              </Field>
            </SettingsPanel>

            <SettingsPanel title="Surveys and Labels">
              <Field label={`Surveys in track (0-${activeTrackCount})`}>
                <Input type="number" min={0} max={activeTrackCount} value={general.surveys.trackIndex} onChange={(event) => patchSurveys({ trackIndex: toNumber(event.target.value, general.surveys.trackIndex) })} />
              </Field>
              <ToggleRow label="Include PTB" checked={general.surveys.includePtb} onCheckedChange={(includePtb) => patchSurveys({ includePtb })} />
              <ToggleRow label="Print Labels" checked={general.surveys.printLabels} onCheckedChange={(printLabels) => patchSurveys({ printLabels })} />
              <ToggleRow label="Transparent Background" checked={general.surveys.transparentBackground} onCheckedChange={(transparentBackground) => patchSurveys({ transparentBackground })} />
              <ToggleRow label="Survey Report at end of plot" checked={general.surveys.reportAtEnd} onCheckedChange={(reportAtEnd) => patchSurveys({ reportAtEnd })} />
            </SettingsPanel>
          </div>
        </div>

        <div className="space-y-4">
          <PlotLayoutPreview config={config} general={general} onLayoutChange={patchLayout} />
        </div>
      </div>
    </div>
  );
}

function PdfBuilder({
  config,
  files,
  onChange,
}: {
  config: PlotConfiguration;
  files: UploadedUserFile[];
  onChange: (items: PlotConfiguration["pdfItems"]) => void;
}) {
  const usableFiles = files.filter((file) => file.type === "PDF" && file.usableInPlotBuilder);
  const [fileId, setFileId] = useState(usableFiles[0]?.id ?? "");
  const [placement, setPlacement] = useState<PdfPlacement>("before");

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">PDF Plot Builder</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Arrange before-plot PDFs, generated main plot, and after-plot attachments.
          </p>
        </div>
        <Badge variant="outline">{config.pdfItems.length} items</Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={fileId} onChange={(event) => setFileId(event.target.value)}>
          {usableFiles.map((file) => (
            <option key={file.id} value={file.id}>{file.fileName}</option>
          ))}
        </select>
        <NativeSelect<PdfPlacement> value={placement} options={["before", "after"]} onChange={setPlacement} />
        <Button
          onClick={() => {
            const file = usableFiles.find((item) => item.id === fileId);
            if (!file) return;
            onChange([...config.pdfItems, { id: uid("pdf-item"), fileId: file.id, label: file.fileName, placement }]);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Item
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {config.pdfItems.map((item, index) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2">
            <GripVertical className="size-4 text-muted-foreground" />
            <Badge variant={item.placement === "main" ? "secondary" : "outline"}>{item.placement}</Badge>
            <div className="min-w-0 flex-1 truncate text-sm font-medium">{index + 1}. {item.label}</div>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => {
                const next = [...config.pdfItems];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                onChange(next);
              }}
            >
              Up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === config.pdfItems.length - 1}
              onClick={() => {
                const next = [...config.pdfItems];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                onChange(next);
              }}
            >
              Down
            </Button>
            <ConfirmDeleteButton
              title="Remove PDF builder item?"
              description={`${item.label} will be removed from this plot builder sequence.`}
              onConfirm={() => {
                onChange(config.pdfItems.filter((row) => row.id !== item.id));
                toast.success("PDF builder item removed");
              }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrackFormattingEditor({
  tracks,
  onTracksChange,
}: {
  tracks: TrackConfig[];
  onTracksChange: (tracks: TrackConfig[]) => void;
}) {
  const normalizedTracks = useMemo(() => ensurePlotTracks(tracks), [tracks]);
  const [editingCurve, setEditingCurve] = useState<{ trackId: string; curveId: string } | null>(null);
  const patchTrack = (trackId: string, patch: Partial<TrackConfig>) =>
    onTracksChange(normalizedTracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)));
  const patchCurve = (trackId: string, curveId: string, patch: Partial<CurveConfig>) =>
    onTracksChange(
      normalizedTracks.map((track) =>
        track.id === trackId
          ? { ...track, curves: track.curves.map((curve) => (curve.id === curveId ? { ...curve, ...patch } : curve)) }
          : track
      )
    );
  const activeCurve = editingCurve
    ? normalizedTracks
        .find((track) => track.id === editingCurve.trackId)
        ?.curves.find((curve) => curve.id === editingCurve.curveId) ?? null
    : null;
  const activeTrack = editingCurve ? normalizedTracks.find((track) => track.id === editingCurve.trackId) ?? null : null;
  const trackOptions = normalizedTracks.map((track, index) => ({ track, value: `track-${index + 1}` }));
  const enabledTrackCount = normalizedTracks.filter((track) => track.curves.some((curve) => curve.dataSource !== "None")).length;
  const addTrack = () => {
    onTracksChange([
      ...normalizedTracks,
      {
        id: uid("track"),
        name: `Track ${normalizedTracks.length + 1}`,
        scaleType: "Linear",
        densityTicMarks: false,
        curves: [],
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Track Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure plot tracks. A track with every curve set to None is treated as disabled.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{enabledTrackCount}/{normalizedTracks.length} active</Badge>
          <Badge variant="outline">Up to 16 curves per track</Badge>
          <Button variant="outline" size="sm" onClick={addTrack}>
            <Plus className="mr-2 size-4" />
            Add Track
          </Button>
        </div>
      </div>

      <Tabs defaultValue="track-1" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          {trackOptions.map(({ track, value }, index) => (
            <TabsTrigger key={track.id} value={value}>
              Track {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {trackOptions.map(({ track, value }, index) => {
          const disabled = track.curves.length === 0 || track.curves.every((curve) => curve.dataSource === "None");
          return (
            <TabsContent key={track.id} value={value}>
              <Card className={cn("rounded-2xl p-5", disabled && "border-dashed")}>
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_190px]">
                  <Field label={`Track ${index + 1} Name`}>
                    <Input value={track.name} onChange={(event) => patchTrack(track.id, { name: event.target.value })} />
                  </Field>
                  <Field label="Scale Type">
                    <NativeSelect<TrackScaleType>
                      value={track.scaleType}
                      options={["Linear", "Logarithmic", "Azimuthal", "Fill between curves"]}
                      onChange={(scaleType) => patchTrack(track.id, { scaleType })}
                    />
                  </Field>
                  <div className="flex items-end">
                    <ToggleRow
                      label="Place density tic marks"
                      checked={track.densityTicMarks}
                      onCheckedChange={(densityTicMarks) => patchTrack(track.id, { densityTicMarks })}
                    />
                  </div>
                </div>

                {track.scaleType === "Azimuthal" ? (
                  <div className="mt-4 rounded-xl border bg-muted/20 p-4">
                    <h3 className="font-semibold">Azimuthal Track Settings</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Curve rows can represent orientation/sensor channels. Open a curve to edit azimuthal display parameters.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  {track.curves.map((curve) => (
                    <div key={curve.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{curve.dataSource}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Scale {curve.scale} | Filter {curve.filter} | Width {curve.lineWidth} | {curve.lineStyle}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-5 w-8 rounded border" style={{ backgroundColor: curve.lineColor }} />
                        <Button variant="outline" size="sm" onClick={() => setEditingCurve({ trackId: track.id, curveId: curve.id })}>
                          <Pencil className="mr-2 size-4" />
                          Edit Curve
                        </Button>
                        <ConfirmDeleteButton
                          title="Delete curve?"
                          description={`${curve.dataSource} will be removed from ${track.name}.`}
                          triggerLabel="Delete"
                          size="sm"
                          variant="outline"
                          onConfirm={() => {
                            patchTrack(track.id, { curves: track.curves.filter((item) => item.id !== curve.id) });
                            toast.success("Curve deleted");
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {track.curves.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No curves configured. This track is effectively disabled.
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    disabled={track.curves.length >= 16}
                    onClick={() =>
                      patchTrack(track.id, {
                        curves: [
                          ...track.curves,
                          {
                            id: uid("curve"),
                            dataSource: "None",
                            scale: "Auto",
                            correctForTvd: false,
                            lineWidth: 1,
                            filter: "None",
                            fillCurve: false,
                            lineStyle: "Solid",
                            lineColor: "#0f172a",
                            wrapColor: "#94a3b8",
                          },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-2 size-4" />
                    Add Curve
                  </Button>
                </div>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={Boolean(editingCurve)} onOpenChange={(open) => !open && setEditingCurve(null)}>
        {activeCurve && activeTrack ? (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{activeTrack.scaleType === "Azimuthal" ? "Azimuthal Curve Editor" : "Curve Editor"}</DialogTitle>
              <DialogDescription>
                Configure the selected WITS ID curve for {activeTrack.name}. Changes update the shared active plot configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="WITS ID / Data">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={activeCurve.dataSource}
                  onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { dataSource: event.target.value })}
                >
                  {dataSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Scale Left">
                <Input value={activeCurve.scale.split("-")[0] ?? "Auto"} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { scale: `${event.target.value}-${activeCurve.scale.split("-")[1] ?? "Auto"}` })} />
              </Field>
              <Field label="Scale Right">
                <Input value={activeCurve.scale.split("-")[1] ?? "Auto"} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { scale: `${activeCurve.scale.split("-")[0] ?? "Auto"}-${event.target.value}` })} />
              </Field>
              <Field label="Data Filter">
                <Input value={activeCurve.filter} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { filter: event.target.value })} />
              </Field>
              <Field label="Line Width">
                <Input type="number" min={1} value={activeCurve.lineWidth} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { lineWidth: Number(event.target.value) })} />
              </Field>
              <Field label="Line Style">
                <NativeSelect<CurveLineStyle> value={activeCurve.lineStyle} options={["Solid", "Dashed", "Dotted"]} onChange={(lineStyle) => patchCurve(activeTrack.id, activeCurve.id, { lineStyle })} />
              </Field>
              <ToggleRow label="Correct TVD" checked={activeCurve.correctForTvd} onCheckedChange={(correctForTvd) => patchCurve(activeTrack.id, activeCurve.id, { correctForTvd })} />
              <ToggleRow label="Curve Fill" checked={activeCurve.fillCurve} onCheckedChange={(fillCurve) => patchCurve(activeTrack.id, activeCurve.id, { fillCurve })} />
              <div className="flex gap-2">
                <ColorSwatchInput label="Line Color" value={activeCurve.lineColor} onChange={(lineColor) => patchCurve(activeTrack.id, activeCurve.id, { lineColor })} />
                <ColorSwatchInput label="First Wrap Color" value={activeCurve.wrapColor} onChange={(wrapColor) => patchCurve(activeTrack.id, activeCurve.id, { wrapColor })} />
                <ColorSwatchInput label="Second Wrap Color" value={activeCurve.wrapColor} onChange={(wrapColor) => patchCurve(activeTrack.id, activeCurve.id, { wrapColor })} />
              </div>
            </div>

            {activeTrack.scaleType === "Azimuthal" ? (
              <div className="rounded-xl border bg-muted/20 p-4">
                <h3 className="font-semibold">Azimuthal Display</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Max Value">
                    <Input value={activeCurve.scale} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { scale: event.target.value })} />
                  </Field>
                  <Field label="Image Contrast">
                    <NativeSelect<ImageContrastMode> value="Dynamic" options={["Static", "Dynamic"]} onChange={() => undefined} />
                  </Field>
                  <ToggleRow label="High Definition" checked={activeCurve.lineWidth > 1} onCheckedChange={(highDefinition) => patchCurve(activeTrack.id, activeCurve.id, { lineWidth: highDefinition ? 2 : 1 })} />
                  <Field label="Color Map">
                    <Input value={activeCurve.filter === "None" ? "Viridis" : activeCurve.filter} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { filter: event.target.value })} />
                  </Field>
                  <Field label="Slide / No-data Color">
                    <Input type="color" value={activeCurve.wrapColor} onChange={(event) => patchCurve(activeTrack.id, activeCurve.id, { wrapColor: event.target.value })} />
                  </Field>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  setEditingCurve(null);
                  toast.success("Curve settings saved locally");
                }}
              >
                Save Curve
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function AzimuthalSettingsEditor({
  settings,
  onChange,
}: {
  settings: AzimuthalPlotSettings;
  onChange: (patch: Partial<AzimuthalPlotSettings>) => void;
}) {
  return (
    <Card className="rounded-2xl p-5">
      <h2 className="text-lg font-semibold">Plotting Azimuthal Data</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Max Value">
            <Input type="number" value={settings.maxValue} onChange={(event) => onChange({ maxValue: Number(event.target.value) })} />
          </Field>
          <Field label="Image Contrast">
            <NativeSelect<ImageContrastMode> value={settings.imageContrast} options={["Static", "Dynamic"]} onChange={(imageContrast) => onChange({ imageContrast })} />
          </Field>
          <Field label="Color Map">
            <Input value={settings.colorMap} onChange={(event) => onChange({ colorMap: event.target.value })} />
          </Field>
          <Field label="Slide Color">
            <Input type="color" value={settings.slideColor} onChange={(event) => onChange({ slideColor: event.target.value })} />
          </Field>
          <ToggleRow label="High Definition" checked={settings.highDefinition} onCheckedChange={(highDefinition) => onChange({ highDefinition })} />
        </div>
        <div className="rounded-xl border p-4">
          <div className="h-32 rounded-lg" style={{ background: `linear-gradient(135deg, ${settings.slideColor}, #2563eb, #10b981)` }} />
          <div className="mt-3 text-sm text-muted-foreground">
            Preview uses selected slide color and color-map placeholder.
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function PlottingPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const {
    plotConfigurations: rawConfigs,
    setPlotConfigurations: setConfigs,
    activeMwdSessionId,
    activePlotConfigId,
    setActivePlotConfigId,
    activePlotConfig,
    plotTemplatesLoading,
    plotTemplatesError,
    refreshPlotTemplates,
  } = useApp();
  const [header, setHeader] = useState<PlotHeaderInfo>(mockPlotHeaderInfo);
  const [plotLabels, setPlotLabels] = useState<PlotLabel[]>(mockPlotLabels);
  const [templates, setTemplates] = useState<TemplateFile[]>(mockTemplateFiles);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedUserFile[]>(mockUploadedUserFiles);
  const [depthPositions, setDepthPositions] = useState<DepthScalePosition[]>([]);
  const [plottingView, setPlottingView] = useState<"landing" | "editor">("landing");
  const [previewConfig, setPreviewConfig] = useState<PlotConfiguration | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editorTab, setEditorTab] = useState("general");
  const [draftConfigName, setDraftConfigName] = useState("Client Plot Configuration");
  const [draftLabel, setDraftLabel] = useState<PlotLabel>({ id: "draft", depth: 3847.5, align: "left", trackTarget: "Gamma Track", text: "" });
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateFileType>("Header");
  const [savingConfigId, setSavingConfigId] = useState<string>("");
  const [loadingConfigId, setLoadingConfigId] = useState<string>("");
  const [deletingConfigId, setDeletingConfigId] = useState<string>("");
  const [exportingPdfPlot, setExportingPdfPlot] = useState(false);
  const canExport = user?.role === "admin" || user?.role === "engineer";
  const configs = useMemo(
    () => dedupePlotConfigurations(rawConfigs.map((config) => normalizePlotConfiguration(config))),
    [rawConfigs]
  );
  const normalizedActivePlotConfig = useMemo(
    () => (activePlotConfig ? normalizePlotConfiguration(activePlotConfig) : null),
    [activePlotConfig]
  );

  const activeConfig = useMemo(
    () => normalizedActivePlotConfig ?? configs.find((config) => config.id === activePlotConfigId) ?? configs[0],
    [activePlotConfigId, configs, normalizedActivePlotConfig]
  );

  const updateActiveConfig = (patch: Partial<PlotConfiguration>) => {
    if (!activeConfig) return;
    setConfigs((current) => current.map((config) => (config.id === activeConfig.id ? { ...config, ...patch } : config)));
  };

  const selectConfig = (config: PlotConfiguration) => {
    setActivePlotConfigId(config.id);
    if (config.header) setHeader(config.header);
    if (config.labels) setPlotLabels(config.labels);
  };

  const buildSavableConfig = (config: PlotConfiguration): PlotConfiguration => ({
    ...config,
    header: config.id === activeConfig?.id ? header : config.header,
    labels: config.id === activeConfig?.id ? plotLabels : config.labels,
  });

  const validateTemplateConfig = (config: PlotConfiguration) => {
    if (!config.name.trim()) return "Plot template name is required.";
    if (!Array.isArray(config.tracks) || config.tracks.length === 0) {
      return "Plot template must have at least one track.";
    }

    return "";
  };

  const replaceConfig = (sourceId: string, nextConfig: PlotConfiguration) => {
    setConfigs((current) => {
      const next = current.map((config) => (config.id === sourceId ? nextConfig : config));
      return next.some((config) => config.id === nextConfig.id) ? next : [nextConfig, ...current];
    });

    selectConfig(nextConfig);
  };

  const persistNewConfig = async (config: PlotConfiguration, successMessage: string) => {
    const savableConfig = buildSavableConfig(config);
    const validationError = validateTemplateConfig(savableConfig);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!token) {
      setConfigs((current) => [savableConfig, ...current]);
      selectConfig(savableConfig);
      toast.success(`${successMessage} locally`);
      return;
    }

    setSavingConfigId(savableConfig.id);

    try {
      const savedTemplate = await createPlotTemplate(token, plotConfigToTemplatePayload(savableConfig));
      const savedConfig = savedTemplate.plotConfig ?? savableConfig;
      setConfigs((current) => [savedConfig, ...current.filter((item) => item.id !== savableConfig.id)]);
      selectConfig(savedConfig);
      toast.success(successMessage);
    } catch (error) {
      setConfigs((current) => [savableConfig, ...current]);
      selectConfig(savableConfig);
      toast.error(
        error instanceof Error
          ? `Backend create failed. Kept local configuration. ${error.message}`
          : "Backend create failed. Kept local configuration."
      );
    } finally {
      setSavingConfigId("");
    }
  };

  const saveConfig = async (config: PlotConfiguration) => {
    const savableConfig = buildSavableConfig(config);
    const validationError = validateTemplateConfig(savableConfig);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!token) {
      toast.success("Plot configuration saved to local shared plotting state");
      return;
    }

    setSavingConfigId(savableConfig.id);

    try {
      const payload = plotConfigToTemplatePayload(savableConfig);
      const savedTemplate = savableConfig.id
        ? await updatePlotTemplate(token, savableConfig.id, payload)
        : await createPlotTemplate(token, payload);
      const savedConfig = savedTemplate.plotConfig ?? savableConfig;
      replaceConfig(savableConfig.id, savedConfig);
      toast.success("Plot configuration saved");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        try {
          const savedTemplate = await createPlotTemplate(token, plotConfigToTemplatePayload(savableConfig));
          const savedConfig = savedTemplate.plotConfig ?? savableConfig;
          replaceConfig(savableConfig.id, savedConfig);
          toast.success("Plot configuration created");
        } catch (createError) {
          toast.error(createError instanceof Error ? createError.message : "Unable to create plot configuration.");
        } finally {
          setSavingConfigId("");
        }
        return;
      }

      toast.error(error instanceof Error ? error.message : "Unable to save plot configuration.");
    } finally {
      setSavingConfigId("");
    }
  };

  const removeConfig = async (config: PlotConfiguration) => {
    if (configs.length <= 1) return;
    if (config.isDefault) {
      toast.error("Default plot template cannot be deleted.");
      return;
    }

    const removeLocalConfig = () => {
      setConfigs((current) => {
        const next = current.filter((item) => item.id !== config.id);
        const nextActive = next.find((item) => item.isDefault) ?? next[0];
        if (nextActive) {
          selectConfig(nextActive);
        } else {
          setActivePlotConfigId("");
        }
        return next;
      });
    };

    if (!token) {
      removeLocalConfig();
      toast.success("Plot configuration deleted locally");
      return;
    }

    setDeletingConfigId(config.id);

    try {
      await deletePlotTemplate(token, config.id);
      removeLocalConfig();
      await refreshPlotTemplates();
      toast.success("Plot configuration deleted");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        removeLocalConfig();
        toast.success("Local plot configuration removed");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Unable to delete plot configuration.");
    } finally {
      setDeletingConfigId("");
    }
  };

  const addConfig = async () => {
    if (!draftConfigName.trim()) {
      toast.error("Enter a plot configuration name");
      return;
    }
    const source = activeConfig ?? mockPlotConfigurations[0];
    const next = clonePlotConfiguration(source, draftConfigName.trim());
    setCreateDialogOpen(false);
    await persistNewConfig(next, "Plot configuration added");
  };

  const openEditor = async (config: PlotConfiguration) => {
    selectConfig(config);
    if (token) {
      setLoadingConfigId(config.id);

      try {
        const template = await getPlotTemplateById(token, config.id);

        if (template.plotConfig) {
          replaceConfig(config.id, template.plotConfig);
        } else {
          toast.message("Plot template detail returned metadata only. Using current local configuration.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load plot template detail.");
      } finally {
        setLoadingConfigId("");
      }
    }

    setPlottingView("editor");
  };

  const generatePlot = (config: PlotConfiguration) => {
    const general = normalizeGeneralSettings(config.general);
    selectConfig(config);
    setPreviewConfig(config);
    toast.success(`${config.name} queued as ${general.fileFormat} from ${general.depthRange.start}-${general.depthRange.end} ${general.depthCorrection}`);
  };

  const isBackendTemplateConfig = (config: PlotConfiguration) =>
    Boolean(config.id) &&
    !config.id.startsWith("plot-config-") &&
    !config.id.startsWith("mock-");

  const downloadPdfPlot = async (config: PlotConfiguration) => {
    if (!token) {
      toast.error("Please sign in before exporting PDF plot");
      return;
    }

    if (!canExport) {
      toast.error("Your role does not have export access");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before exporting PDF plot");
      return;
    }

    const savableConfig = buildSavableConfig(config);
    const general = normalizeGeneralSettings(savableConfig.general);

    if (general.fileFormat !== "PDF") {
      toast.error("Set the plot file format to PDF before exporting a PDF plot.");
      return;
    }

    setExportingPdfPlot(true);

    try {
      const basePayload = {
        sessionId: activeMwdSessionId,
        depthMin: general.depthRange.start,
        depthMax: general.depthRange.end,
      };
      const payload = isBackendTemplateConfig(savableConfig)
        ? { ...basePayload, templateId: savableConfig.id }
        : { ...basePayload, template: plotConfigToTemplatePayload(savableConfig).config };
      const blob = await exportPdfPlot(token, payload);
      downloadBlob(blob, "mwd-plot.pdf");
      toast.success("PDF plot downloaded");
    } catch (error) {
      toast.error("PDF plot export failed", {
        description: error instanceof Error ? error.message : "Unable to export PDF plot.",
      });
    } finally {
      setExportingPdfPlot(false);
    }
  };

  const cloneConfig = async (config: PlotConfiguration) => {
    const next = clonePlotConfiguration(config);
    await persistNewConfig(next, "Plot configuration cloned");
  };

  const openEditorTab = (tab: string) => {
    setEditorTab(tab);
    setPlottingView("editor");
  };
  const previewGeneral = previewConfig ? normalizeGeneralSettings(previewConfig.general) : null;

  const content = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Data Management</Badge>
            <Badge variant="outline">Plotting</Badge>
            <Badge variant="outline">{plottingView === "landing" ? "Configuration Center" : "Editor"}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Plotting</h1>
          <p className="text-sm text-muted-foreground">
            Configure plot headers, tracks, PDFs, labels, and file inputs using shared plotting state.
          </p>
        </div>
        {plottingView === "editor" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPlottingView("landing")}>
              <ArrowLeft className="mr-2 size-4" />
              Back to Plot Configurations
            </Button>
            <Button
              disabled={!activeConfig || savingConfigId === activeConfig.id}
              onClick={() => activeConfig && void saveConfig(activeConfig)}
            >
              <Save className="mr-2 size-4" />
              {activeConfig && savingConfigId === activeConfig.id ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <Button onClick={() => setCreateDialogOpen(true)} disabled={Boolean(savingConfigId)}>
            <Plus className="mr-2 size-4" />
            New Plot Configuration
          </Button>
        )}
      </div>

      {plottingView === "landing" ? (
        <div className="space-y-4">
          <div className="grid gap-4">
            <Card className="rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">General Plot Configuration Tools</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Shortcuts to shared plot setup tools.
                  </p>
                </div>
                <Badge variant="outline">Editor shortcuts</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Header Information", "Header setup", "header"],
                  ["Plot Labels", "Annotations", "labels"],
                  ["Mud Resistivity Calculator", "Rm/Rmf/Rmc", "mud"],
                  ["Depth Scale Position", "PDF placement", "depth"],
                ].map(([title, description, tab]) => (
                  <Button
                    key={title}
                    variant="outline"
                    className="h-12 w-full justify-start rounded-xl px-3 text-left"
                    onClick={() => openEditorTab(tab)}
                  >
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-sm font-medium">{title}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">List of Plot Configurations</h2>
                <p className="text-sm text-muted-foreground">
                  Select a plot configuration to generate, edit, clone, or delete.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {plotTemplatesLoading ? <Badge variant="outline">Loading backend templates</Badge> : null}
                {plotTemplatesError ? <Badge variant="outline">Using local fallback</Badge> : null}
                <Badge variant="outline">{configs.length} configurations</Badge>
              </div>
            </div>
            {plotTemplatesError ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                {plotTemplatesError}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-7 px-2 text-xs"
                  onClick={() => void refreshPlotTemplates()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              {configs.map((config) => {
                const general = normalizeGeneralSettings(config.general);
                const tracks = Array.isArray(config.tracks) ? config.tracks : [];
                const pdfItems = Array.isArray(config.pdfItems) ? config.pdfItems : [];

                return (
                  <div
                    key={config.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-colors",
                      activeConfig?.id === config.id && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" className="min-w-0 text-left" onClick={() => selectConfig(config)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{config.name}</h3>
                          {config.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {general.fileFormat} | {tracks.length} tracks | {pdfItems.length} PDF items | {general.depthRange.start}-{general.depthRange.end} MD
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => generatePlot(config)}>
                          <Eye className="mr-2 size-4" />
                          Generate Plot
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingConfigId === config.id}
                          onClick={() => void openEditor(config)}
                        >
                          <Pencil className="mr-2 size-4" />
                          {loadingConfigId === config.id ? "Loading..." : "Edit Configuration"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={Boolean(savingConfigId)} onClick={() => void cloneConfig(config)}>
                          <Copy className="mr-2 size-4" />
                          Clone
                        </Button>
                        <ConfirmDeleteButton
                          title={config.isDefault ? "Default template cannot be deleted" : "Delete plot configuration?"}
                          description={
                            config.isDefault
                              ? `${config.name} is the default plot template. Choose another default before deleting templates.`
                              : `${config.name} will be removed from plot templates.`
                          }
                          triggerLabel="Delete"
                          size="sm"
                          variant="outline"
                          disabled={config.isDefault || configs.length <= 1 || deletingConfigId === config.id}
                          onConfirm={() => void removeConfig(config)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">User Files</h2>
                  <p className="text-sm text-muted-foreground">Upload and manage files usable by the PDF builder.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setUploadedFiles((current) => [
                      { id: uid("upload"), fileName: "new-user-file.xlsx", type: "Spreadsheet", description: "Mock uploaded user spreadsheet", updatedAt: new Date().toISOString(), conversionStatus: "Will convert to PDF", usableInPlotBuilder: false },
                      ...current,
                    ])
                  }
                >
                  <FilePlus2 className="mr-2 size-4" />
                  Upload File
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{file.fileName}</div>
                        <div className="text-sm text-muted-foreground">{file.description}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{format(new Date(file.updatedAt), "dd MMM yyyy HH:mm")}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{file.type}</Badge>
                        <Badge variant={file.usableInPlotBuilder ? "secondary" : "outline"}>
                          {file.usableInPlotBuilder ? "Usable for plotting" : file.conversionStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => toast.message(`${file.fileName}: ${file.description}`)}>Open Metadata</Button>
                      <Button size="sm" variant="outline" onClick={() => toast.message(`${file.fileName} download is a UI scaffold`)}>
                        <Download className="mr-2 size-4" />
                        Download
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setUploadedFiles((current) => current.map((item) => item.id === file.id ? { ...item, usableInPlotBuilder: !item.usableInPlotBuilder } : item))}>
                        {file.usableInPlotBuilder ? "Unmark usable" : "Mark usable"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Templates</h2>
                  <p className="text-sm text-muted-foreground">Download, duplicate, or stage plot template files.</p>
                </div>
                <div className="w-40">
                  <NativeSelect<TemplateFileType> value={selectedTemplateType} options={["Header", "Track", "LAS", "Report"]} onChange={setSelectedTemplateType} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{template.fileName}</div>
                        <div className="text-sm text-muted-foreground">{template.description}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{format(new Date(template.updatedAt), "dd MMM yyyy HH:mm")}</div>
                      </div>
                      <Badge variant="secondary">{template.type}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => toast.message(`${template.fileName} download is a UI scaffold`)}>
                        <Download className="mr-2 size-4" />
                        Download Template
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setTemplates((current) => [{ ...template, id: uid("template"), fileName: `${template.fileName}.copy` }, ...current])}>
                        Duplicate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : (
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Plot Configs</h2>
            <Badge variant="outline">{configs.length}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {configs.map((config) => (
              <button
                key={config.id}
                type="button"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition hover:bg-muted/50",
                  activeConfig?.id === config.id && "border-primary bg-muted"
                )}
                onClick={() => selectConfig(config)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium leading-snug">{config.name}</span>
                  {config.isDefault ? <Badge variant="secondary" className="shrink-0 text-[10px]">Default</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {normalizeGeneralSettings(config.general).fileFormat} | {Array.isArray(config.tracks) ? config.tracks.length : 0} tracks | {Array.isArray(config.pdfItems) ? config.pdfItems.length : 0} PDFs
                </div>
              </button>
            ))}
          </div>
          {activeConfig ? (
            <div className="mt-3 grid gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const duplicate = clonePlotConfiguration(activeConfig);
                  void persistNewConfig(duplicate, "Plot configuration duplicated");
                }}
                disabled={Boolean(savingConfigId)}
              >
                <Copy className="mr-2 size-4" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={savingConfigId === activeConfig.id}
                onClick={() => {
                  setConfigs((current) =>
                    current.map((config) => ({ ...config, isDefault: config.id === activeConfig.id }))
                  );
                  void saveConfig({ ...activeConfig, isDefault: true });
                }}
              >
                Mark Default
              </Button>
              <ConfirmDeleteButton
                title={activeConfig.isDefault ? "Default template cannot be deleted" : "Delete active plot configuration?"}
                description={
                  activeConfig.isDefault
                    ? `${activeConfig.name} is the default plot template. Choose another default before deleting templates.`
                    : `${activeConfig.name} will be removed from plot templates.`
                }
                triggerLabel="Delete"
                size="sm"
                className="justify-center"
                disabled={activeConfig.isDefault || configs.length <= 1 || deletingConfigId === activeConfig.id}
                onConfirm={() => void removeConfig(activeConfig)}
              />
            </div>
          ) : null}
        </Card>

        <div className="min-w-0 space-y-4">
          {activeConfig ? (
            <Tabs value={editorTab} onValueChange={setEditorTab} className="min-w-0">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="header">Header</TabsTrigger>
                <TabsTrigger value="tracks">Tracks</TabsTrigger>
                <TabsTrigger value="labels">Labels</TabsTrigger>
                <TabsTrigger value="pdf">PDF Builder</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="depth">Depth Scale</TabsTrigger>
                <TabsTrigger value="mud">Mud R</TabsTrigger>
                <TabsTrigger value="azimuthal">Azimuthal</TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <GeneralEditor
                  config={activeConfig}
                  onChange={(generalPatch) => updateActiveConfig({ general: { ...activeConfig.general, ...generalPatch } })}
                  onConfigChange={updateActiveConfig}
                  onSave={(config) => void saveConfig(config)}
                  saving={savingConfigId === activeConfig.id}
                />
              </TabsContent>
              <TabsContent value="header">
                <HeaderInformationEditor header={header} onChange={setHeader} />
              </TabsContent>
              <TabsContent value="tracks">
                <TrackFormattingEditor tracks={activeConfig.tracks} onTracksChange={(tracks) => updateActiveConfig({ tracks })} />
              </TabsContent>
              <TabsContent value="labels">
                <Card className="rounded-2xl p-5">
                  <h2 className="text-lg font-semibold">Plot Labels</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-[140px_160px_180px_1fr_auto]">
                    <Input type="number" value={draftLabel.depth} onChange={(event) => setDraftLabel((current) => ({ ...current, depth: Number(event.target.value) }))} />
                    <NativeSelect<PlotTextAlign> value={draftLabel.align} options={["left", "center", "right"]} onChange={(align) => setDraftLabel((current) => ({ ...current, align }))} />
                    <Input value={draftLabel.trackTarget} onChange={(event) => setDraftLabel((current) => ({ ...current, trackTarget: event.target.value }))} />
                    <Input value={draftLabel.text} onChange={(event) => setDraftLabel((current) => ({ ...current, text: event.target.value }))} placeholder="Annotation text" />
                    <Button
                      onClick={() => {
                        if (!draftLabel.text.trim()) return;
                        setPlotLabels((current) => [{ ...draftLabel, id: uid("plot-label") }, ...current]);
                        setDraftLabel((current) => ({ ...current, text: "" }));
                      }}
                    >
                      Add Label
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {plotLabels.map((label) => (
                      <div key={label.id} className="grid gap-2 rounded-xl border px-3 py-2 md:grid-cols-[120px_120px_160px_1fr_auto]">
                        <Input type="number" value={label.depth} onChange={(event) => setPlotLabels((current) => current.map((item) => item.id === label.id ? { ...item, depth: Number(event.target.value) } : item))} />
                        <NativeSelect<PlotTextAlign> value={label.align} options={["left", "center", "right"]} onChange={(align) => setPlotLabels((current) => current.map((item) => item.id === label.id ? { ...item, align } : item))} />
                        <Input value={label.trackTarget} onChange={(event) => setPlotLabels((current) => current.map((item) => item.id === label.id ? { ...item, trackTarget: event.target.value } : item))} />
                        <Input value={label.text} onChange={(event) => setPlotLabels((current) => current.map((item) => item.id === label.id ? { ...item, text: event.target.value } : item))} />
                        <ConfirmDeleteButton
                          title="Delete plot label?"
                          description={`Label at depth ${label.depth} will be removed from local plot labels.`}
                          onConfirm={() => {
                            setPlotLabels((current) => current.filter((item) => item.id !== label.id));
                            toast.success("Plot label deleted");
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
              <TabsContent value="pdf">
                <PdfBuilder config={activeConfig} files={uploadedFiles} onChange={(pdfItems) => updateActiveConfig({ pdfItems })} />
              </TabsContent>
              <TabsContent value="files">
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="rounded-2xl p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">Template Files</h2>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setTemplates((current) => [
                            { id: uid("template"), fileName: "uploaded-template.tpl", type: selectedTemplateType, description: "Mock uploaded template", updatedAt: new Date().toISOString() },
                            ...current,
                          ])
                        }
                      >
                        <FileUp className="mr-2 size-4" />
                        Upload Template
                      </Button>
                    </div>
                    <div className="mt-3 w-48">
                      <NativeSelect<TemplateFileType> value={selectedTemplateType} options={["Header", "Track", "LAS", "Report"]} onChange={setSelectedTemplateType} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {templates.map((template) => (
                        <div key={template.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-medium">{template.fileName}</div>
                              <div className="text-sm text-muted-foreground">{template.description}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{format(new Date(template.updatedAt), "dd MMM yyyy HH:mm")}</div>
                            </div>
                            <Badge variant="secondary">{template.type}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline"><Download className="mr-2 size-4" />Download</Button>
                            <Button size="sm" variant="outline" onClick={() => setTemplates((current) => [{ ...template, id: uid("template"), fileName: `${template.fileName}.copy` }, ...current])}>Duplicate</Button>
                            <ConfirmDeleteButton
                              title="Remove template file?"
                              description={`${template.fileName} will be removed from local template metadata.`}
                              triggerLabel="Remove"
                              size="sm"
                              onConfirm={() => {
                                setTemplates((current) => current.filter((item) => item.id !== template.id));
                                toast.success("Template removed");
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="rounded-2xl p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">Uploaded User Files</h2>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setUploadedFiles((current) => [
                            { id: uid("upload"), fileName: "new-user-file.xlsx", type: "Spreadsheet", description: "Mock uploaded user spreadsheet", updatedAt: new Date().toISOString(), conversionStatus: "Will convert to PDF", usableInPlotBuilder: false },
                            ...current,
                          ])
                        }
                      >
                        <FilePlus2 className="mr-2 size-4" />
                        Upload File
                      </Button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-medium">{file.fileName}</div>
                              <div className="text-sm text-muted-foreground">{file.description}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{format(new Date(file.updatedAt), "dd MMM yyyy HH:mm")}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{file.type}</Badge>
                              <Badge variant={file.conversionStatus === "Ready" ? "secondary" : "outline"}>{file.conversionStatus}</Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => toast.message(`${file.fileName}: ${file.description}`)}>Preview Metadata</Button>
                            <Button size="sm" variant="outline" onClick={() => setUploadedFiles((current) => current.map((item) => item.id === file.id ? { ...item, usableInPlotBuilder: !item.usableInPlotBuilder } : item))}>
                              {file.usableInPlotBuilder ? "Unmark usable" : "Mark usable"}
                            </Button>
                            <ConfirmDeleteButton
                              title="Delete uploaded file?"
                              description={`${file.fileName} will be removed from local uploaded file metadata.`}
                              triggerLabel="Delete"
                              size="sm"
                              onConfirm={() => {
                                setUploadedFiles((current) => current.filter((item) => item.id !== file.id));
                                toast.success("Uploaded file deleted");
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="depth">
                <DepthScalePositionEditor
                  files={uploadedFiles}
                  positions={depthPositions}
                  onSave={(position) => {
                    setDepthPositions((current) => [position, ...current.filter((item) => item.fileId !== position.fileId)]);
                    toast.success("Depth scale position saved");
                  }}
                />
              </TabsContent>
              <TabsContent value="mud">
                <MudResistivityCalculator
                  initialMudWeight={header.drillingParameters.density}
                  initialRm={header.drillingParameters.rm}
                  onApplyToHeader={(values) => {
                    setHeader((current) => ({
                      ...current,
                      drillingParameters: {
                        ...current.drillingParameters,
                        rmf: values.rmf,
                        rmc: values.rmc,
                      },
                    }));
                    toast.success("Mud resistivity values applied to plot header");
                  }}
                />
              </TabsContent>
              <TabsContent value="azimuthal">
                <AzimuthalSettingsEditor settings={activeConfig.azimuthal} onChange={(azimuthalPatch) => updateActiveConfig({ azimuthal: { ...activeConfig.azimuthal, ...azimuthalPatch } })} />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Plot Configuration</DialogTitle>
            <DialogDescription>
              Create a new plot configuration by copying the active plot setup, including general, track, curve, and PDF settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Configuration Name</Label>
            <Input value={draftConfigName} onChange={(event) => setDraftConfigName(event.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => void addConfig()} disabled={Boolean(savingConfigId)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewConfig)} onOpenChange={(open) => !open && setPreviewConfig(null)}>
        {previewConfig && previewGeneral ? (
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Generated Plot Preview</DialogTitle>
              <DialogDescription>
                Mock {previewGeneral.fileFormat} viewer for {previewConfig.name}. Backend plot generation is integration-ready but not connected.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-h-[520px] rounded-2xl border bg-muted/30 p-4">
                <div className="flex h-full flex-col rounded-xl border bg-background p-5 shadow-sm">
                  <div className="border-b pb-3">
                    <div className="text-xl font-bold">{previewConfig.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {previewGeneral.depthRange.start} - {previewGeneral.depthRange.end} {previewGeneral.depthCorrection} | {previewGeneral.fileFormat} | {previewGeneral.headerPreset} header
                    </div>
                  </div>
                  <div
                    className="mt-4 grid flex-1 gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(ensurePlotTracks(previewConfig.tracks).length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {ensurePlotTracks(previewConfig.tracks).map((track) => (
                      <div key={track.id} className="rounded-lg border bg-muted/20 p-2">
                        <div className="text-xs font-medium">{track.name}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{track.scaleType}</div>
                        <div
                          className="mt-2 h-full min-h-80 rounded bg-gradient-to-b from-primary/10 via-primary/30 to-primary/10"
                          style={{
                            marginTop: `${Math.min(previewGeneral.grid.topSpacing, 24)}px`,
                            marginBottom: `${Math.min(previewGeneral.grid.bottomSpacing, 24)}px`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    Preview uses General settings for header, depth range, correction, grid spacing, output format, surveys, and labels. No file has been written.
                  </div>
                </div>
              </div>
              <Card className="rounded-2xl p-4">
                <h3 className="font-semibold">Generation Request</h3>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Survey context</span><span className="font-medium">Current well survey data</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Header</span><span className="font-medium">{previewGeneral.headerPreset}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Output</span><span className="font-medium">{previewGeneral.fileFormat}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Page</span><span className="font-medium">{previewGeneral.page.widthIn} x {previewGeneral.page.heightIn} in</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Depth range</span><span className="font-medium">{previewGeneral.depthRange.start}-{previewGeneral.depthRange.end}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Depth correction</span><span className="font-medium">{previewGeneral.depthCorrection}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Labels</span><span className="font-medium">{previewGeneral.surveys.printLabels ? "Print" : "Hidden"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Tracks</span><span className="font-medium">{previewConfig.tracks.length}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">PDF items</span><span className="font-medium">{previewConfig.pdfItems.length}</span></div>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  disabled={exportingPdfPlot || !canExport}
                  onClick={() => void downloadPdfPlot(previewConfig)}
                >
                  <Download className="mr-2 size-4" />
                  {exportingPdfPlot ? "Downloading..." : "Download PDF"}
                </Button>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button onClick={() => onNavigate ? onNavigate("trajectory-well-plot") : router.push(getAppPagePath("trajectory-well-plot"))}>
                Open Well Plot
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="data-management-plotting" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
