"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Download, FileUp, ListFilter, Plus, RefreshCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { PlaceholderNote, WorkspaceSection } from "@/components/layouts/workspace-section";
import { PlotConfigState, PlotSurveyMenu } from "@/components/contents/data-management/plot-survey-menu";
import { ProjectionDialog } from "@/components/contents/data-management/projection-dialog";
import { SurveyStorageConfigDialog } from "@/components/contents/data-management/survey-storage-config-dialog";
import { SurveyTable } from "@/components/contents/data-management/survey-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  mockSurveyInputSummary,
  mockSurveyRecords,
  mockSurveyStorageConfig,
} from "@/data/monitoring-data";
import {
  ProjectionMethod,
  SurveyInputSummary,
  SurveyRecord,
  SurveyStorageConfig,
} from "@/types/monitoring";

function createProjectionRecord(
  measuredDepth: number,
  method: ProjectionMethod,
  reference: SurveyRecord
): SurveyRecord {
  const depthDelta = measuredDepth - reference.md;
  const incDelta = method === "Straight-Line" ? 0.2 : 0.6;
  const azmDelta = method === "Straight-Line" ? 0.3 : 0.8;

  return {
    id: `projection-${Date.now()}`,
    md: measuredDepth,
    inc: Number((reference.inc + incDelta).toFixed(2)),
    azm: Number((reference.azm + azmDelta).toFixed(2)),
    tvd: Number((reference.tvd + depthDelta * 0.95).toFixed(1)),
    ns: Number((reference.ns - depthDelta * 0.28).toFixed(1)),
    ew: Number((reference.ew - depthDelta * 0.42).toFixed(1)),
    dls: Number((reference.dls + 0.25).toFixed(2)),
    vs: Number((reference.vs - depthDelta * 0.5).toFixed(1)),
    toolfaceMode: reference.toolfaceMode,
    timestamp: new Date().toISOString(),
    isProjection: true,
    projectionMethod: method,
  };
}

export default function SurveyDataPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [surveyInput, setSurveyInput] = useState<SurveyInputSummary>(mockSurveyInputSummary);
  const [surveyRecords, setSurveyRecords] = useState<SurveyRecord[]>(mockSurveyRecords);
  const [reverseSort, setReverseSort] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(mockSurveyRecords[0]?.id ?? "");
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [projectionDepth, setProjectionDepth] = useState(3890);
  const [projectionMethod, setProjectionMethod] = useState<ProjectionMethod>("Straight-Line");
  const [plotDialogOpen, setPlotDialogOpen] = useState(false);
  const [plotConfig, setPlotConfig] = useState<PlotConfigState>({
    plotType: "Plan vs Actual",
    depthFrom: 3600,
    depthTo: 3900,
    autoScale: true,
  });
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const [storageConfig, setStorageConfig] = useState<SurveyStorageConfig>(mockSurveyStorageConfig);
  const [editRecord, setEditRecord] = useState<SurveyRecord | null>(null);
  const [importNotes, setImportNotes] = useState("Awaiting CSV/LAS parser wiring");

  const sortedRecords = useMemo(() => {
    const copy = [...surveyRecords].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );
    return reverseSort ? copy.reverse() : copy;
  }, [reverseSort, surveyRecords]);

  const selectedSurvey = useMemo(
    () => sortedRecords.find((record) => record.id === selectedSurveyId) ?? sortedRecords[0] ?? null,
    [selectedSurveyId, sortedRecords]
  );

  const updateSurveyInput = (key: keyof SurveyInputSummary, value: number | string) => {
    setSurveyInput((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleAddSurvey = () => {
    const nextRecord: SurveyRecord = {
      id: `survey-${Date.now()}`,
      ...surveyInput,
      timestamp: new Date().toISOString(),
      isProjection: false,
    };

    setSurveyRecords((current) => [nextRecord, ...current]);
    setSelectedSurveyId(nextRecord.id);
    toast.success("Survey added to local table");
  };

  const handleProjection = () => {
    const reference = surveyRecords[0];
    if (!reference) {
      toast.error("No reference survey available");
      return;
    }

    const projection = createProjectionRecord(projectionDepth, projectionMethod, reference);
    setSurveyRecords((current) => [projection, ...current]);
    setSelectedSurveyId(projection.id);
    setProjectionOpen(false);
    toast.success("Projection added to survey list");
  };

  const handleDeleteSurvey = (record: SurveyRecord) => {
    setSurveyRecords((current) => current.filter((item) => item.id !== record.id));
    toast.success("Survey removed from local table");
  };

  const handleSaveEditedSurvey = () => {
    if (!editRecord) {
      return;
    }

    setSurveyRecords((current) =>
      current.map((item) => (item.id === editRecord.id ? editRecord : item))
    );
    toast.success("Survey row updated");
    setEditRecord(null);
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Data Management</Badge>
            <Badge variant="outline">Survey Data</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Survey Data</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage incoming survey input, projections, exports, and survey storage behavior in local state.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setProjectionOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Projection
          </Button>
          <Button variant="outline" onClick={() => setStorageDialogOpen(true)}>
            <Settings2 className="mr-2 size-4" />
            Configure Survey Storage
          </Button>
        </div>
      </div>

      <WorkspaceSection
        title="Survey Input Summary"
        description="Editable snapshot of the current survey values arriving from the decoder workflow."
        badge="Local decoder snapshot"
      >
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {([
              ["md", "Measured Depth"],
              ["inc", "Inclination"],
              ["azm", "Azimuth"],
              ["tvd", "TVD"],
              ["ns", "North/South"],
              ["ew", "East/West"],
              ["dls", "DLS"],
              ["vs", "Vertical Section"],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type="number"
                  value={surveyInput[key]}
                  onChange={(event) => updateSurveyInput(key, Number(event.target.value))}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Toolface Mode</Label>
              <Input
                value={surveyInput.toolfaceMode}
                onChange={(event) => updateSurveyInput("toolfaceMode", event.target.value)}
              />
            </div>
          </div>

          <Card className="rounded-2xl border-dashed p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Current survey review</h2>
                <p className="text-sm text-muted-foreground">
                  Use this panel to confirm values before adding them to the survey table.
                </p>
              </div>
              <Badge variant="outline">{surveyInput.toolfaceMode}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(surveyInput).map(([key, value]) => (
                <div key={key} className="rounded-xl border px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{key}</div>
                  <div className="mt-1 font-medium">{typeof value === "number" ? value.toFixed(2) : value}</div>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={handleAddSurvey}>
              Add Survey
            </Button>
          </Card>
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title="Survey List"
        description="Most recent surveys are shown first by default. Reverse sorting is available for QA review."
        badge={`${surveyRecords.length} records`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setReverseSort((current) => !current)}>
              <RefreshCcw className="mr-2 size-4" />
              Reverse Sort
            </Button>
            <Button variant="outline" onClick={() => toast.message("CSV/LAS import scaffold only for now")}>
              <FileUp className="mr-2 size-4" />
              Import Surveys
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 size-4" />
                  Export Surveys
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {["PDF", "XLS", "CSV"].map((formatName) => (
                  <DropdownMenuItem
                    key={formatName}
                    onClick={() => toast.success(`Prepared local ${formatName} export action`)}
                  >
                    {formatName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <PlotSurveyMenu
              config={plotConfig}
              open={plotDialogOpen}
              onOpenChange={setPlotDialogOpen}
              onConfigChange={(patch) => setPlotConfig((current) => ({ ...current, ...patch }))}
              onApply={() => {
                setPlotDialogOpen(false);
                toast.success(`Plot request queued for ${plotConfig.plotType}`);
              }}
            />
          </div>
          {selectedSurvey ? (
            <Badge variant="secondary">
              Selected MD {selectedSurvey.md.toFixed(1)} at{" "}
              {format(new Date(selectedSurvey.timestamp), "HH:mm")}
            </Badge>
          ) : null}
        </div>

        <SurveyTable
          records={sortedRecords}
          selectedId={selectedSurvey?.id}
          onSelect={(record) => setSelectedSurveyId(record.id)}
          onEdit={(record) => setEditRecord(record)}
          onDelete={handleDeleteSurvey}
        />

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card className="rounded-2xl border-dashed p-4">
            <h2 className="text-lg font-semibold">Selected survey detail</h2>
            {selectedSurvey ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(selectedSurvey).map(([key, value]) => (
                  <div key={key} className="rounded-xl border px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{key}</div>
                    <div className="mt-1 text-sm font-medium">
                      {typeof value === "number" ? value.toFixed(2) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PlaceholderNote>Select a survey row to inspect it here.</PlaceholderNote>
            )}
          </Card>

          <Card className="rounded-2xl border-dashed p-4">
            <h2 className="text-lg font-semibold">Import notes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              CSV and LAS upload flow is scaffolded only. Use this area to capture operator notes until parser wiring is ready.
            </p>
            <Textarea
              className="mt-4"
              rows={8}
              value={importNotes}
              onChange={(event) => setImportNotes(event.target.value)}
            />
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ListFilter className="size-4" />
              Import parser, validation, and persistence are still placeholders.
            </div>
          </Card>
        </div>
      </WorkspaceSection>

      <ProjectionDialog
        open={projectionOpen}
        measuredDepth={projectionDepth}
        method={projectionMethod}
        onOpenChange={setProjectionOpen}
        onMeasuredDepthChange={setProjectionDepth}
        onMethodChange={setProjectionMethod}
        onSubmit={handleProjection}
      />

      <SurveyStorageConfigDialog
        open={storageDialogOpen}
        config={storageConfig}
        onOpenChange={setStorageDialogOpen}
        onConfigChange={setStorageConfig}
        onSave={() => {
          setStorageDialogOpen(false);
          toast.success("Survey storage preferences saved locally");
        }}
      />

      <Dialog open={Boolean(editRecord)} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Survey Row</DialogTitle>
            <DialogDescription>
              Basic row editing updates the local survey table only.
            </DialogDescription>
          </DialogHeader>
          {editRecord ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(["md", "inc", "azm", "tvd", "ns", "ew", "dls", "vs"] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <Label className="uppercase">{key}</Label>
                  <Input
                    type="number"
                    value={editRecord[key]}
                    onChange={(event) =>
                      setEditRecord((current) =>
                        current
                          ? {
                              ...current,
                              [key]: Number(event.target.value),
                            }
                          : current
                      )
                    }
                  />
                </div>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <Label>Toolface Mode</Label>
                <Input
                  value={editRecord.toolfaceMode}
                  onChange={(event) =>
                    setEditRecord((current) =>
                      current
                        ? {
                            ...current,
                            toolfaceMode: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveEditedSurvey}>
              Save Row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="data-management-survey-data" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
