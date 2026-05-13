"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Copy, Download, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { availableLasColumns, mockLasPresets } from "@/data/las-data";
import { cn } from "@/lib/utils";
import { LasExportColumn, LasPreviewResult, LasPreset } from "@/types/las";

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

export default function GenerateLasPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [presets, setPresets] = useState<LasPreset[]>(mockLasPresets);
  const [activePresetId, setActivePresetId] = useState(mockLasPresets[0]?.id ?? "");
  const [draftPresetName, setDraftPresetName] = useState("New LAS Preset");
  const [preview, setPreview] = useState<LasPreviewResult | null>(null);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) ?? presets[0],
    [activePresetId, presets]
  );

  const selectedColumnIds = new Set(activePreset?.columns.map((column) => column.id) ?? []);
  const availableColumns = availableLasColumns.filter((column) => !selectedColumnIds.has(column.id));

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
    const base = activePreset ?? mockLasPresets[0];
    const nextPreset: LasPreset = {
      ...base,
      id: uid("las-preset"),
      name: draftPresetName,
      description: "Local LAS preset created from current settings.",
      isDefault: false,
      columns: [...base.columns],
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
      columns: [...activePreset.columns],
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
    if (nextIndex < 0 || nextIndex >= activePreset.columns.length) return;
    const nextColumns = [...activePreset.columns];
    [nextColumns[columnIndex], nextColumns[nextIndex]] = [nextColumns[nextIndex], nextColumns[columnIndex]];
    updateActivePreset({ columns: nextColumns });
  };

  const handleGenerateLas = () => {
    if (!activePreset) return;
    const nextPreview = createPreview(activePreset);
    setPreview(nextPreview);
    toast.success("LAS preview generated locally");
  };

  const content = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Data Management</Badge>
            <Badge variant="outline">Generate LAS</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Generate LAS</h1>
          <p className="text-sm text-muted-foreground">
            Configure LAS presets, depth export rules, survey options, selected channels, and preview output.
          </p>
        </div>
        <Button onClick={handleGenerateLas}>
          <Download className="mr-2 size-4" />
          Generate LAS
        </Button>
      </div>

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
                  <Badge variant="outline">{availableColumns.length} available</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {availableColumns.map((column) => (
                    <div key={column.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-semibold">{column.witsId} / {column.mnemonic}</div>
                        <div className="text-sm text-muted-foreground">{column.description} ({column.unit})</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateActivePreset({ columns: [...activePreset.columns, column] })}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Selected LAS Columns</h2>
                  <Badge variant="secondary">{activePreset.columns.length} columns</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {activePreset.columns.map((column: LasExportColumn, index) => (
                    <div key={column.id} className="grid gap-2 rounded-xl border px-3 py-2 md:grid-cols-[1fr_auto_auto_auto]">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold">{index + 1}. {column.mnemonic} ({column.witsId})</div>
                        <div className="text-sm text-muted-foreground">{column.description} / {column.unit}</div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => moveColumn(index, -1)}>
                        Up
                      </Button>
                      <Button size="sm" variant="ghost" disabled={index === activePreset.columns.length - 1} onClick={() => moveColumn(index, 1)}>
                        Down
                      </Button>
                      <ConfirmDeleteButton
                        title="Remove LAS column?"
                        description={`${column.mnemonic} (${column.witsId}) will be removed from this preset.`}
                        onConfirm={() => {
                          updateActivePreset({
                            columns: activePreset.columns.filter((item) => item.id !== column.id),
                          });
                          toast.success("LAS column removed");
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">LAS Preview Summary</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Mock preview only. Real LAS writing and file download will be handled by a backend/export service later.
                  </p>
                </div>
                <Button onClick={handleGenerateLas}>
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
                  <div className="mt-1 font-mono font-medium">{preview?.columnCount ?? activePreset.columns.length}</div>
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
