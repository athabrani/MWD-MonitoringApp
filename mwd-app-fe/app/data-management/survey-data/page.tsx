"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Download, FileUp, Plus, RefreshCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { PlotConfigState, PlotSurveyMenu } from "@/components/contents/data-management/plot-survey-menu";
import { ProjectionDialog } from "@/components/contents/data-management/projection-dialog";
import { SurveyStorageConfigDialog } from "@/components/contents/data-management/survey-storage-config-dialog";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
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
import { cn } from "@/lib/utils";

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

const capturedSurveyFields = [
  { key: "md", label: "Depth", step: "0.01" },
  { key: "inc", label: "Inc", step: "0.01" },
  { key: "azm", label: "Azm", step: "0.01" },
  { key: "toolfaceMode", label: "Toolface" },
  { key: "tvd", label: "TVD", step: "0.01" },
  { key: "ns", label: "N/S", step: "0.01" },
  { key: "ew", label: "E/W", step: "0.01" },
  { key: "dls", label: "DLS", step: "0.01" },
  { key: "vs", label: "VS", step: "0.01" },
] as const;

const surveyColumns = [
  { key: "md", label: "Depth" },
  { key: "inc", label: "Inc" },
  { key: "azm", label: "Azm" },
  { key: "tvd", label: "TVD" },
  { key: "ns", label: "NS" },
  { key: "ew", label: "EW" },
  { key: "vs", label: "VS" },
  { key: "dls", label: "DLS" },
] as const;

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
  const [rowsPerPage, setRowsPerPage] = useState(50);

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

  const visibleRecords = useMemo(
    () => sortedRecords.slice(0, rowsPerPage),
    [rowsPerPage, sortedRecords]
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
    toast.success("Data berhasil ditambahkan");
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
    toast.success("Survey berhasil dihapus");
  };

  const handleResendLastSurvey = () => {
    const latest = surveyRecords[0];
    if (!latest) {
      toast.error("No survey available to resend");
      return;
    }

    toast.success(`Resend queued for MD ${latest.md.toFixed(2)} to all ports`);
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Survey Data</h1>
          <Badge variant="secondary">Data Management</Badge>
        </div>
        {selectedSurvey ? (
          <Badge variant="outline">
            Selected MD {selectedSurvey.md.toFixed(2)} at {format(new Date(selectedSurvey.timestamp), "HH:mm")}
          </Badge>
        ) : null}
      </div>

      <Card className="rounded-2xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Captured Survey Data</h2>
            <div className="mt-1 text-xs text-muted-foreground">
              Latest decoder values ready for review and storage.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.message("Checked local decoder snapshot")}
          >
            Check for new data
          </Button>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-9">
            {capturedSurveyFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{field.label}</Label>
                <Input
                  className="h-10 font-mono text-sm"
                  type={field.key === "toolfaceMode" ? "text" : "number"}
                  step={"step" in field ? field.step : undefined}
                  value={surveyInput[field.key]}
                  onChange={(event) =>
                    updateSurveyInput(
                      field.key,
                      field.key === "toolfaceMode" ? event.target.value : Number(event.target.value)
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2 xl:w-64 xl:flex-col xl:items-stretch xl:justify-end">
            <Button onClick={handleAddSurvey}>
              Store Survey
            </Button>
            <Button variant="outline" onClick={handleResendLastSurvey}>
              Resend Last Survey to All Ports
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Survey List</h2>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="outline">{surveyRecords.length} records</Badge>
              <Badge variant="secondary">{reverseSort ? "Oldest first" : "Newest first"}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setProjectionOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add Projection
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.message("CSV/LAS import scaffold only for now")}>
              <FileUp className="mr-2 size-4" />
              Import Surveys
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
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
            <Button size="sm" variant="outline" onClick={() => setStorageDialogOpen(true)}>
              <Settings2 className="mr-2 size-4" />
              Configure
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReverseSort((current) => !current)}>
              <RefreshCcw className="mr-2 size-4" />
              Reverse Sort
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          {selectedSurvey ? (
            <div className="grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">MD</div>
                <div className="font-mono font-medium">{selectedSurvey.md.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Inc / Azm</div>
                <div className="font-mono font-medium">
                  {selectedSurvey.inc.toFixed(2)} / {selectedSurvey.azm.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mode</div>
                <div className="font-medium">{selectedSurvey.toolfaceMode}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Captured</div>
                <div className="font-medium">{format(new Date(selectedSurvey.timestamp), "dd MMM HH:mm")}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No survey selected.</div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rows</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
            >
              {[25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[1160px] border-collapse text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="w-16 px-4 py-3 text-left font-semibold">Type</th>
                <th className="w-12 px-2 py-3 text-left font-semibold">Del</th>
                {surveyColumns.map((column) => (
                  <th key={column.key} className="px-3 py-3 text-right font-semibold">
                    {column.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold">CL</th>
                <th className="px-3 py-3 text-right font-semibold">NRTG</th>
                <th className="px-3 py-3 text-right font-semibold">ESTG</th>
                <th className="px-3 py-3 text-right font-semibold">BUILD</th>
                <th className="px-3 py-3 text-right font-semibold">TURN</th>
                <th className="px-3 py-3 text-center font-semibold">RUN</th>
                <th className="px-3 py-3 text-left font-semibold">Toolface</th>
                <th className="px-3 py-3 text-right font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record, index) => (
                <tr
                  key={record.id}
                  className={cn(
                    "cursor-pointer border-b hover:bg-muted/40",
                    selectedSurvey?.id === record.id && "bg-muted/60"
                  )}
                  onClick={() => setSelectedSurveyId(record.id)}
                  onDoubleClick={() => setEditRecord(record)}
                >
                  <td className="px-4 py-3">
                    <Badge variant={record.isProjection ? "secondary" : "outline"}>
                      {record.isProjection ? "Proj" : index === 0 ? "Svy" : "Tiein"}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <ConfirmDeleteButton
                      title="Delete survey row?"
                      description={`Survey at MD ${record.md.toFixed(2)} will be removed from the local table.`}
                      className="h-6 w-6"
                      onConfirm={() => handleDeleteSurvey(record)}
                    />
                  </td>
                  {surveyColumns.map((column) => (
                    <td key={column.key} className="px-3 py-3 text-right font-mono text-xs">
                      {record[column.key].toFixed(2)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-mono text-xs">12.75</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{record.ns.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{record.ew.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{record.isProjection ? record.dls.toFixed(2) : "0.00"}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs">0.00</td>
                  <td className="px-3 py-3 text-center font-mono text-xs">1</td>
                  <td className="px-3 py-3">{record.toolfaceMode}</td>
                  <td className="px-3 py-3 text-right text-xs">{record.isProjection ? "Projection" : "Standard"}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{format(new Date(record.timestamp), "HH:mm:ss")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
