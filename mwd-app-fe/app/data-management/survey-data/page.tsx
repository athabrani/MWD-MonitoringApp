"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ProjectionMethod,
  SurveyInputSummary,
  SurveyRecord,
  SurveyStorageConfig,
} from "@/types/monitoring";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import {
  createSurvey,
  createSurveysFromMwdData,
  deleteSurvey,
  getSurveyById,
  getSurveys,
  importSurveysCsv,
  recalculateSurveys,
  surveyRecordToPayload,
  updateSurvey,
} from "@/lib/surveys-api";
import { downloadBlob, exportSurveys, type SurveyExportFormat } from "@/lib/exports-api";
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
  { key: "md", label: "Measured Depth", step: "0.01" },
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

const emptySurveyInput: SurveyInputSummary = {
  md: 0,
  inc: 0,
  azm: 0,
  tvd: 0,
  ns: 0,
  ew: 0,
  dls: 0,
  vs: 0,
  toolfaceMode: "Unknown",
};

const defaultSurveyStorageConfig: SurveyStorageConfig = {
  columnLabels: {
    md: "Measured Depth",
    inc: "Inclination",
    azm: "Azimuth",
    tvd: "True Vertical Depth",
    ns: "North/South",
    ew: "East/West",
    dls: "Dogleg Severity",
    vs: "Vertical Section",
  },
  userDefinedInput: "",
  captureRigWits: false,
  captureAuxDecoded: false,
  captureToolfaceMode: true,
};

function surveyHasValidNumbers(record: SurveyRecord) {
  return [record.md, record.inc, record.azm, record.tvd, record.ns, record.ew, record.dls, record.vs].every(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
}

function surveyHasRequiredManualValues(record: SurveyRecord) {
  return [record.md, record.inc, record.azm].every(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
}

export default function SurveyDataPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { activeMwdSessionId } = useApp();
  const surveyImportInputRef = useRef<HTMLInputElement | null>(null);
  const [surveyInput, setSurveyInput] = useState<SurveyInputSummary>(emptySurveyInput);
  const [manualStationType, setManualStationType] = useState<"actual" | "plan">("actual");
  const [surveyRecords, setSurveyRecords] = useState<SurveyRecord[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [surveysSaving, setSurveysSaving] = useState(false);
  const [surveysDeletingId, setSurveysDeletingId] = useState("");
  const [surveysActionLoading, setSurveysActionLoading] = useState("");
  const [surveyExportingFormat, setSurveyExportingFormat] = useState("");
  const [surveysError, setSurveysError] = useState("");
  const [reverseSort, setReverseSort] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
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
  const [storageConfig, setStorageConfig] = useState<SurveyStorageConfig>(defaultSurveyStorageConfig);
  const [editRecord, setEditRecord] = useState<SurveyRecord | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const canManageSurveys = user?.role === "engineer" || user?.role === "admin";

  const loadSurveys = useCallback(async (preferredSurveyId?: string) => {
    if (!token) {
      setSurveysError("");
      setSurveyRecords([]);
      setSelectedSurveyId("");
      return;
    }

    if (!activeMwdSessionId) {
      setSurveysError("");
      setSurveyRecords([]);
      setSelectedSurveyId("");
      return;
    }

    setSurveysLoading(true);
    setSurveysError("");

    try {
      const surveys = await getSurveys(token, {
        sessionId: activeMwdSessionId,
        stationType: "actual",
      });
      setSurveyRecords(surveys);
      setSelectedSurveyId((current) => {
        if (preferredSurveyId && surveys.some((survey) => survey.id === preferredSurveyId)) {
          return preferredSurveyId;
        }
        if (current && surveys.some((survey) => survey.id === current)) return current;
        return surveys[0]?.id ?? "";
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load surveys.", error);
      }
      const message = "Gagal memuat data dari backend.";
      setSurveysError(message);
      toast.error(message);
    } finally {
      setSurveysLoading(false);
    }
  }, [activeMwdSessionId, token]);

  useEffect(() => {
    void loadSurveys();
  }, [loadSurveys]);

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

  const handleAddSurvey = async () => {
    const nextRecord: SurveyRecord = {
      id: `survey-${Date.now()}`,
      ...surveyInput,
      timestamp: new Date().toISOString(),
      isProjection: false,
    };

    if (!surveyHasRequiredManualValues(nextRecord)) {
      toast.error("Measured Depth, Inclination, and Azimuth must be valid numbers.");
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can create survey data.");
      return;
    }

    if (token && !activeMwdSessionId) {
      toast.error("Select an active MWD session before storing survey data.");
      return;
    }

    setSurveysSaving(true);
    setSurveysError("");

    try {
      if (!token) {
        toast.warning("Backend login is required to store survey data.");
        return;
      }

      const savedRecord = await createSurvey(
        token,
        surveyRecordToPayload(nextRecord, activeMwdSessionId, manualStationType)
      );
      await loadSurveys(savedRecord.id);
      toast.success("Survey data saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create survey.";
      setSurveysError(message);
      toast.error("Unable to create survey", { description: message });
    } finally {
      setSurveysSaving(false);
    }
  };

  const handleProjection = async () => {
    const reference = surveyRecords[0];
    if (!reference) {
      toast.error("No reference survey available");
      return;
    }

    if (!token) {
      toast.warning("Backend login is required to store projected survey data.");
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can create projected survey data.");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before storing projected survey data.");
      return;
    }

    const projection = createProjectionRecord(projectionDepth, projectionMethod, reference);

    setSurveysSaving(true);
    setSurveysError("");

    try {
      const savedRecord = await createSurvey(
        token,
        surveyRecordToPayload(projection, activeMwdSessionId, "actual")
      );
      await loadSurveys(savedRecord.id);
      setProjectionOpen(false);
      toast.success("Projection stored.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to store projection.";
      setSurveysError(message);
      toast.error("Unable to store projection", { description: message });
    } finally {
      setSurveysSaving(false);
    }
  };

  const handleDeleteSurvey = async (record: SurveyRecord) => {
    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can delete survey data.");
      return;
    }

    setSurveysDeletingId(record.id);
    setSurveysError("");

    try {
      if (!token) {
        toast.warning("Backend login is required to delete survey data.");
        return;
      }

      await deleteSurvey(token, record.id);
      await loadSurveys();
      toast.success("Survey berhasil dihapus");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete survey.";
      setSurveysError(message);
      toast.error("Unable to delete survey", { description: message });
    } finally {
      setSurveysDeletingId("");
    }
  };

  const handleOpenEditSurvey = async (record: SurveyRecord) => {
    if (!token) {
      toast.warning("Backend login is required to edit survey data.");
      return;
    }

    setSurveysError("");

    try {
      const detail = await getSurveyById(token, record.id);
      setEditRecord(detail);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load survey detail.", error);
      }
      const message = "Gagal memuat data dari backend.";
      setSurveysError(message);
      toast.error(message);
      setEditRecord(record);
    }
  };

  const handleSaveEditedSurvey = async () => {
    if (!editRecord) {
      return;
    }

    if (!surveyHasValidNumbers(editRecord)) {
      toast.error("Survey values must be valid numbers.");
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can update survey data.");
      return;
    }

    if (token && !activeMwdSessionId) {
      toast.error("Select an active MWD session before updating survey data.");
      return;
    }

    setSurveysSaving(true);
    setSurveysError("");

    try {
      if (!token) {
        toast.warning("Backend login is required to update survey data.");
        return;
      }

      const savedRecord = await updateSurvey(
        token,
        editRecord.id,
        surveyRecordToPayload(editRecord, activeMwdSessionId, "actual")
      );
      await recalculateSurveys(token, {
        sessionId: activeMwdSessionId,
        stationType: "actual",
        verticalSectionAzimuth: 90,
      });
      await loadSurveys(savedRecord.id);
      toast.success("Survey row updated and trajectory recalculated.");
      setEditRecord(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update survey.";
      setSurveysError(message);
      toast.error("Unable to update survey", { description: message });
    } finally {
      setSurveysSaving(false);
    }
  };

  const handleGenerateFromMwdData = async () => {
    if (!token) {
      toast.warning("Backend login is required to generate survey from MWD data.");
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can generate surveys from MWD data.");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before generating survey data.");
      return;
    }

    const payload = {
      sessionId: activeMwdSessionId,
      stationType: "actual",
    } as const;

    setSurveysActionLoading("from-mwd");
    setSurveysError("");

    try {
      await createSurveysFromMwdData(token, payload);
      toast.success("Survey generated from MWD data.");
      await loadSurveys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate survey from MWD data.";
      setSurveysError(message);
      toast.error("Unable to generate survey from MWD data", { description: message });
    } finally {
      setSurveysActionLoading("");
    }
  };

  const handleRecalculateSurveys = async () => {
    if (!token) {
      toast.warning("Backend login is required to recalculate surveys.");
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can recalculate surveys.");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before recalculating survey data.");
      return;
    }

    const confirmed = window.confirm(
      "Recalculate survey/trajectory for the active session? This may update many survey rows."
    );
    if (!confirmed) return;

    const payload = {
      sessionId: activeMwdSessionId,
      stationType: "actual",
      verticalSectionAzimuth: 90,
    };

    setSurveysActionLoading("recalculate");
    setSurveysError("");

    try {
      await recalculateSurveys(token, payload);
      toast.success("Survey trajectory recalculated.");
      await loadSurveys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to recalculate surveys.";
      setSurveysError(message);
      toast.error("Unable to recalculate surveys", { description: message });
    } finally {
      setSurveysActionLoading("");
    }
  };

  const handleImportSurveyCsv = async (file?: File) => {
    if (!file) return;

    if (!token) {
      toast.warning("Backend login is required to import survey CSV.");
      if (surveyImportInputRef.current) surveyImportInputRef.current.value = "";
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can import survey CSV.");
      if (surveyImportInputRef.current) surveyImportInputRef.current.value = "";
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Survey import requires a .csv file.");
      if (surveyImportInputRef.current) surveyImportInputRef.current.value = "";
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before importing survey CSV.");
      if (surveyImportInputRef.current) surveyImportInputRef.current.value = "";
      return;
    }

    setSurveysActionLoading("import-csv");
    setSurveysError("");

    try {
      const content = await file.text();
      await importSurveysCsv(token, {
        content,
        sessionId: activeMwdSessionId,
        stationType: "plan",
        verticalSectionAzimuth: 90,
      });
      toast.success("Survey CSV imported.");
      await loadSurveys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import survey CSV.";
      setSurveysError(message);
      toast.error("Unable to import survey CSV", { description: message });
    } finally {
      setSurveysActionLoading("");
      if (surveyImportInputRef.current) surveyImportInputRef.current.value = "";
    }
  };

  const handleExportSurveys = async (formatName: string) => {
    if (formatName !== "csv") {
      toast.warning("Survey export backend currently supports CSV only.");
      return;
    }

    if (!token) {
      toast.warning("Backend login is required to export surveys.");
      return;
    }

    if (!canManageSurveys) {
      toast.warning("Only admin or engineer users can export survey data.");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before exporting survey data.");
      return;
    }

    setSurveyExportingFormat(formatName);

    try {
      const blob = await exportSurveys(token, {
        sessionId: activeMwdSessionId,
        format: formatName as SurveyExportFormat,
        stationType: "actual",
        verticalSectionAzimuth: 90,
      });
      downloadBlob(blob, `surveys-${activeMwdSessionId}.${formatName}`);
      toast.success("Survey export downloaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat data dari backend.";
      toast.error("Unable to export surveys", { description: message });
    } finally {
      setSurveyExportingFormat("");
    }
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

      {surveysError ? (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {surveysError}
        </Card>
      ) : null}

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
              onClick={() => void loadSurveys()}
              disabled={surveysLoading || !token || !activeMwdSessionId}
            >
            {surveysLoading ? "Loading surveys..." : "Refresh Surveys"}
          </Button>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-10">
            {capturedSurveyFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label className="block truncate whitespace-nowrap text-xs font-semibold leading-4 text-muted-foreground">
                  {field.label}
                </Label>
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
            <div className="space-y-1">
              <Label className="block truncate whitespace-nowrap text-xs font-semibold leading-4 text-muted-foreground">
                Station Type
              </Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={manualStationType}
                onChange={(event) => setManualStationType(event.target.value as "actual" | "plan")}
              >
                <option value="actual">actual</option>
                <option value="plan">plan</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2 xl:w-64 xl:flex-col xl:items-stretch xl:justify-end">
            <Button
              onClick={() => void handleAddSurvey()}
              disabled={surveysSaving || !canManageSurveys || !token || !activeMwdSessionId}
            >
              Store Survey
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleGenerateFromMwdData()}
              disabled={
                surveysActionLoading === "from-mwd" ||
                !canManageSurveys ||
                !token ||
                !activeMwdSessionId
              }
            >
              {surveysActionLoading === "from-mwd" ? "Generating..." : "Generate from MWD Data"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Survey List</h2>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="outline">{surveyRecords.length} records</Badge>
              <Badge variant="secondary">{reverseSort ? "Oldest first" : "Newest first"}</Badge>
              <Badge variant={activeMwdSessionId ? "outline" : "secondary"}>
                {activeMwdSessionId ? `Session ${activeMwdSessionId}` : "No active session"}
              </Badge>
              <Badge variant="outline">
                Depth {plotConfig.depthFrom.toFixed(2)}-{plotConfig.depthTo.toFixed(2)}
              </Badge>
              {surveysLoading ? <Badge variant="outline">Loading API</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setProjectionOpen(true)}
              disabled={!token || !activeMwdSessionId || !canManageSurveys}
            >
              <Plus className="mr-2 size-4" />
              Add Projection
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleGenerateFromMwdData()}
              disabled={
                surveysActionLoading === "from-mwd" ||
                !canManageSurveys ||
                !token ||
                !activeMwdSessionId
              }
            >
              {surveysActionLoading === "from-mwd" ? "Generating..." : "Generate from MWD"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRecalculateSurveys()}
              disabled={
                surveysActionLoading === "recalculate" ||
                !canManageSurveys ||
                !token ||
                !activeMwdSessionId
              }
            >
              {surveysActionLoading === "recalculate" ? "Recalculating..." : "Recalculate"}
            </Button>
            <input
              ref={surveyImportInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleImportSurveyCsv(event.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => surveyImportInputRef.current?.click()}
              disabled={surveysActionLoading === "import-csv" || !canManageSurveys || !token}
            >
              <FileUp className="mr-2 size-4" />
              {surveysActionLoading === "import-csv" ? "Importing..." : "Import Surveys"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="mr-2 size-4" />
                  Export Surveys
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["csv"] as SurveyExportFormat[]).map((formatName) => (
                  <DropdownMenuItem
                    key={formatName}
                    disabled={Boolean(surveyExportingFormat)}
                    onClick={() => void handleExportSurveys(formatName)}
                  >
                    {surveyExportingFormat === formatName ? "Exporting..." : formatName.toUpperCase()}
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
                  <th key={column.key} className="px-3 py-3 text-right font-semibold border-b-0">
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
              {visibleRecords.map((record, index) => {
                const isLast = index === visibleRecords.length - 1;

                return (
                  <tr
                    key={record.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/40",
                      !isLast && "border-b",
                      selectedSurvey?.id === record.id && "bg-muted/60"
                    )}
                    onClick={() => setSelectedSurveyId(record.id)}
                    onDoubleClick={() => void handleOpenEditSurvey(record)}
                  >
                  <td className="px-4 py-3">
                    <Badge variant={record.isProjection ? "secondary" : "outline"}>
                      {record.isProjection ? "Proj" : index === 0 ? "Svy" : "Tiein"}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <ConfirmDeleteButton
                      title="Delete survey row?"
                      description={`Survey at MD ${record.md.toFixed(2)} will be deleted.`}
                      className="h-6 w-6"
                      disabled={surveysDeletingId === record.id || !canManageSurveys}
                      onConfirm={() => void handleDeleteSurvey(record)}
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
                );
              })}
              {!surveysLoading && visibleRecords.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {activeMwdSessionId
                      ? "Belum ada survey actual untuk session ini."
                      : "Pilih job/session aktif terlebih dahulu untuk memuat survey actual dari backend."}
                  </td>
                </tr>
              ) : null}
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
        onSubmit={() => void handleProjection()}
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
              Update this survey station with PUT /api/surveys/:id, then recalculate survey trajectory only.
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
            <Button type="button" onClick={() => void handleSaveEditedSurvey()} disabled={surveysSaving || !canManageSurveys}>
              {surveysSaving ? "Saving..." : "Save Row"}
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
