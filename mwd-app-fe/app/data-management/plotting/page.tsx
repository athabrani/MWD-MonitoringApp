"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Copy,
  Download,
  FilePlus2,
  FileUp,
  GripVertical,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
import { DepthScalePositionEditor } from "@/components/contents/data-management/depth-scale-position-editor";
import { MudResistivityCalculator } from "@/components/contents/data-management/mud-resistivity-calculator";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  mockPlotConfigurations,
  mockPlotHeaderInfo,
  mockPlotLabels,
  mockTemplateFiles,
  mockUploadedUserFiles,
} from "@/data/plotting-data";
import { cn } from "@/lib/utils";
import {
  AzimuthalPlotSettings,
  CurveConfig,
  CurveLineStyle,
  DepthCorrectionMode,
  DepthScalePosition,
  ImageContrastMode,
  PdfPlacement,
  PlotConfiguration,
  PlotFileFormat,
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

function GeneralEditor({
  config,
  onChange,
}: {
  config: PlotConfiguration;
  onChange: (patch: Partial<PlotConfiguration["general"]>) => void;
}) {
  const general = config.general;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold">General Plot Output</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Header Style">
            <Input value={general.headerStyle} onChange={(event) => onChange({ headerStyle: event.target.value })} />
          </Field>
          <Field label="File Format">
            <NativeSelect<PlotFileFormat>
              value={general.fileFormat}
              options={["PDF", "CGM", "TIFF", "JPG"]}
              onChange={(fileFormat) => onChange({ fileFormat })}
            />
          </Field>
          <Field label="Depth Scale">
            <Input value={general.depthScale} onChange={(event) => onChange({ depthScale: event.target.value })} />
          </Field>
          <Field label="Measured Depth Start">
            <Input
              type="number"
              value={general.measuredDepthStart}
              onChange={(event) => onChange({ measuredDepthStart: Number(event.target.value) })}
            />
          </Field>
          <Field label="Measured Depth End">
            <Input
              type="number"
              value={general.measuredDepthEnd}
              onChange={(event) => onChange({ measuredDepthEnd: Number(event.target.value) })}
            />
          </Field>
          <Field label="Depth Correction">
            <NativeSelect<DepthCorrectionMode>
              value={general.depthCorrection}
              options={["MD", "TVD", "TVDss", "VS"]}
              onChange={(depthCorrection) => onChange({ depthCorrection })}
            />
          </Field>
          <Field label="Major Tic Interval">
            <Input
              type="number"
              value={general.majorTicInterval}
              onChange={(event) => onChange({ majorTicInterval: Number(event.target.value) })}
            />
          </Field>
          <Field label="Minor Tic Interval">
            <Input
              type="number"
              value={general.minorTicInterval}
              onChange={(event) => onChange({ minorTicInterval: Number(event.target.value) })}
            />
          </Field>
          <Field label="Step Tic Interval">
            <Input
              type="number"
              value={general.stepTicInterval}
              onChange={(event) => onChange({ stepTicInterval: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Card>
      <Card className="rounded-2xl p-5">
        <h2 className="text-lg font-semibold">Print Options</h2>
        <div className="mt-4 space-y-3">
          <ToggleRow label="Multi-page output" checked={general.multiPageOutput} onCheckedChange={(multiPageOutput) => onChange({ multiPageOutput })} />
          <ToggleRow label="Use TVD" checked={general.useTvd} onCheckedChange={(useTvd) => onChange({ useTvd })} />
          <ToggleRow label="End by TVD" checked={general.endByTvd} onCheckedChange={(endByTvd) => onChange({ endByTvd })} />
          <ToggleRow label="Surveys in track" checked={general.surveysInTrack} onCheckedChange={(surveysInTrack) => onChange({ surveysInTrack })} />
          <ToggleRow label="Survey report at end" checked={general.surveyReportAtEnd} onCheckedChange={(surveyReportAtEnd) => onChange({ surveyReportAtEnd })} />
          <ToggleRow label="Print labels" checked={general.printLabels} onCheckedChange={(printLabels) => onChange({ printLabels })} />
        </div>
      </Card>
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
  const patchTrack = (trackId: string, patch: Partial<TrackConfig>) =>
    onTracksChange(tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)));
  const patchCurve = (trackId: string, curveId: string, patch: Partial<CurveConfig>) =>
    onTracksChange(
      tracks.map((track) =>
        track.id === trackId
          ? { ...track, curves: track.curves.map((curve) => (curve.id === curveId ? { ...curve, ...patch } : curve)) }
          : track
      )
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Track Formatting</h2>
          <p className="text-sm text-muted-foreground">Configure 2 to 5 tracks, each with up to 16 curves.</p>
        </div>
        <Button
          variant="outline"
          disabled={tracks.length >= 5}
          onClick={() =>
            onTracksChange([
              ...tracks,
              { id: uid("track"), name: `Track ${tracks.length + 1}`, scaleType: "Linear", densityTicMarks: false, curves: [] },
            ])
          }
        >
          <Plus className="mr-2 size-4" />
          Add Track
        </Button>
      </div>
      {tracks.map((track) => {
        const disabled = track.curves.every((curve) => curve.dataSource === "None");
        return (
          <Card key={track.id} className={cn("rounded-2xl p-5", disabled && "border-dashed opacity-80")}>
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
              <Input value={track.name} onChange={(event) => patchTrack(track.id, { name: event.target.value })} />
              <NativeSelect<TrackScaleType>
                value={track.scaleType}
                options={["Linear", "Logarithmic", "Azimuthal"]}
                onChange={(scaleType) => patchTrack(track.id, { scaleType })}
              />
              <ToggleRow label="Density tic marks" checked={track.densityTicMarks} onCheckedChange={(densityTicMarks) => patchTrack(track.id, { densityTicMarks })} />
              <ConfirmDeleteButton
                title="Delete track?"
                description={`${track.name} and its curves will be removed from this configuration.`}
                disabled={tracks.length <= 2}
                onConfirm={() => {
                  onTracksChange(tracks.filter((item) => item.id !== track.id));
                  toast.success("Track deleted");
                }}
              />
            </div>
            <div className="mt-4 space-y-2">
              {track.curves.map((curve) => (
                <div key={curve.id} className="grid gap-2 rounded-xl border p-2 lg:grid-cols-[minmax(0,1fr)_44px]">
                  <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_96px_68px_96px] xl:grid-cols-[minmax(160px,1fr)_96px_68px_96px_70px_70px] 2xl:grid-cols-[minmax(180px,1.4fr)_110px_72px_100px_76px_76px_96px_44px_44px]">
                    <select className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value={curve.dataSource} onChange={(event) => patchCurve(track.id, curve.id, { dataSource: event.target.value })}>
                      {dataSources.map((source) => <option key={source} value={source}>{source}</option>)}
                    </select>
                    <Input value={curve.scale} onChange={(event) => patchCurve(track.id, curve.id, { scale: event.target.value })} />
                    <Input type="number" min={1} value={curve.lineWidth} onChange={(event) => patchCurve(track.id, curve.id, { lineWidth: Number(event.target.value) })} />
                    <Input value={curve.filter} onChange={(event) => patchCurve(track.id, curve.id, { filter: event.target.value })} />
                    <ToggleRow label="TVD" checked={curve.correctForTvd} onCheckedChange={(correctForTvd) => patchCurve(track.id, curve.id, { correctForTvd })} />
                    <ToggleRow label="Fill" checked={curve.fillCurve} onCheckedChange={(fillCurve) => patchCurve(track.id, curve.id, { fillCurve })} />
                    <NativeSelect<CurveLineStyle> value={curve.lineStyle} options={["Solid", "Dashed", "Dotted"]} onChange={(lineStyle) => patchCurve(track.id, curve.id, { lineStyle })} />
                    <ColorSwatchInput
                      label="Line color"
                      value={curve.lineColor}
                      onChange={(lineColor) => patchCurve(track.id, curve.id, { lineColor })}
                    />
                    <ColorSwatchInput
                      label="Wrap color"
                      value={curve.wrapColor}
                      onChange={(wrapColor) => patchCurve(track.id, curve.id, { wrapColor })}
                    />
                  </div>
                  <div className="flex justify-end lg:items-start lg:justify-center">
                    <ConfirmDeleteButton
                      title="Delete curve?"
                      description={`${curve.dataSource} will be removed from ${track.name}.`}
                      onConfirm={() => {
                        patchTrack(track.id, { curves: track.curves.filter((item) => item.id !== curve.id) });
                        toast.success("Curve deleted");
                      }}
                    />
                  </div>
                </div>
              ))}
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
        );
      })}
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
  const [header, setHeader] = useState<PlotHeaderInfo>(mockPlotHeaderInfo);
  const [plotLabels, setPlotLabels] = useState<PlotLabel[]>(mockPlotLabels);
  const [templates, setTemplates] = useState<TemplateFile[]>(mockTemplateFiles);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedUserFile[]>(mockUploadedUserFiles);
  const [depthPositions, setDepthPositions] = useState<DepthScalePosition[]>([]);
  const [configs, setConfigs] = useState<PlotConfiguration[]>(mockPlotConfigurations);
  const [activeConfigId, setActiveConfigId] = useState(mockPlotConfigurations[0]?.id ?? "");
  const [draftConfigName, setDraftConfigName] = useState("Client Plot Configuration");
  const [draftLabel, setDraftLabel] = useState<PlotLabel>({ id: "draft", depth: 3847.5, align: "left", trackTarget: "Gamma Track", text: "" });
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateFileType>("Header");

  const activeConfig = useMemo(
    () => configs.find((config) => config.id === activeConfigId) ?? configs[0],
    [activeConfigId, configs]
  );

  const updateActiveConfig = (patch: Partial<PlotConfiguration>) => {
    if (!activeConfig) return;
    setConfigs((current) => current.map((config) => (config.id === activeConfig.id ? { ...config, ...patch } : config)));
  };

  const addConfig = () => {
    const source = activeConfig ?? mockPlotConfigurations[0];
    const next: PlotConfiguration = {
      ...source,
      id: uid("plot-config"),
      name: draftConfigName,
      isDefault: false,
      pdfItems: source.pdfItems.map((item) => ({ ...item, id: uid("pdf-item") })),
      tracks: source.tracks.map((track) => ({
        ...track,
        id: uid("track"),
        curves: track.curves.map((curve) => ({ ...curve, id: uid("curve") })),
      })),
    };
    setConfigs((current) => [next, ...current]);
    setActiveConfigId(next.id);
    toast.success("Plot configuration added");
  };

  const content = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Data Management</Badge>
            <Badge variant="outline">Plotting</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Plotting</h1>
          <p className="text-sm text-muted-foreground">
            Configure plot headers, tracks, PDFs, labels, and file inputs using local plotting state.
          </p>
        </div>
        <Button onClick={() => toast.success("Plot configuration saved locally")}>
          <Save className="mr-2 size-4" />
          Save Plotting Workspace
        </Button>
      </div>

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
                onClick={() => setActiveConfigId(config.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium leading-snug">{config.name}</span>
                  {config.isDefault ? <Badge variant="secondary" className="shrink-0 text-[10px]">Default</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {config.general.fileFormat} · {config.tracks.length} tracks · {config.pdfItems.length} PDFs
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Input className="h-9 text-sm" value={draftConfigName} onChange={(event) => setDraftConfigName(event.target.value)} />
            <Button className="h-9 w-full text-sm" variant="outline" onClick={addConfig}>
              <Plus className="mr-2 size-4" />
              Add
            </Button>
          </div>
          {activeConfig ? (
            <div className="mt-3 grid gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const duplicate = {
                    ...activeConfig,
                    id: uid("plot-config"),
                    name: `${activeConfig.name} Copy`,
                    isDefault: false,
                  };
                  setConfigs((current) => [duplicate, ...current]);
                  setActiveConfigId(duplicate.id);
                }}
              >
                <Copy className="mr-2 size-4" />
                Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfigs((current) =>
                    current.map((config) => ({ ...config, isDefault: config.id === activeConfig.id }))
                  )
                }
              >
                Mark Default
              </Button>
              <ConfirmDeleteButton
                title="Delete active plot configuration?"
                description={`${activeConfig.name} will be removed from local plotting configurations.`}
                triggerLabel="Delete"
                size="sm"
                className="justify-center"
                disabled={configs.length <= 1}
                onConfirm={() => {
                  setConfigs((current) => current.filter((config) => config.id !== activeConfig.id));
                  setActiveConfigId(configs.find((config) => config.id !== activeConfig.id)?.id ?? "");
                  toast.success("Plot configuration deleted");
                }}
              />
            </div>
          ) : null}
        </Card>

        <div className="min-w-0 space-y-4">
          {activeConfig ? (
            <Tabs defaultValue="general" className="min-w-0">
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
                <GeneralEditor config={activeConfig} onChange={(generalPatch) => updateActiveConfig({ general: { ...activeConfig.general, ...generalPatch } })} />
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
                <MudResistivityCalculator initialMudWeight={header.drillingParameters.density} initialRm={header.drillingParameters.rm} />
              </TabsContent>
              <TabsContent value="azimuthal">
                <AzimuthalSettingsEditor settings={activeConfig.azimuthal} onChange={(azimuthalPatch) => updateActiveConfig({ azimuthal: { ...activeConfig.azimuthal, ...azimuthalPatch } })} />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </div>
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
