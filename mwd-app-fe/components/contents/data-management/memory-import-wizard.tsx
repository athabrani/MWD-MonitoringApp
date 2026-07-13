"use client";

import { ChangeEvent, ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Check,
  Copy,
  Database,
  FileSearch,
  FileUp,
  GitCompare,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceSection, PlaceholderNote } from "@/components/layouts/workspace-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  deleteMemoryFile,
  getMemoryFile,
  getMemoryFileCorrelations,
  getMemoryFilePoints,
  getMemoryFiles,
  importMemoryFile,
  correlateMemoryFile,
  MemoryFileCorrelation,
  MemoryFilePoint,
  MemoryFileRecord,
} from "@/lib/memory-files-api";
import { logSecurityError } from "@/lib/security/errors";
import {
  parseMemoryCsv,
  validateMemoryWitsId,
} from "@/lib/memory-import";
import { collectImportSources, countCsvRecords, ImportSourceBatch } from "@/lib/import-sources";
import {
  CorrelationSettings,
  GapFillRequest,
  ImportedMemoryDataset,
  MemoryImportFile,
  MemoryImportSegment,
  MemoryStorageChannel,
} from "@/types/memory-import";
import { cn } from "@/lib/utils";

type WizardStep = "storage" | "upload" | "scan" | "import" | "correlate";

const steps: Array<{ id: WizardStep; title: string; description: string }> = [
  { id: "storage", title: "Storage WITS ID", description: "Review backend memory target" },
  { id: "upload", title: "Upload CSV", description: "Load vendor export file" },
  { id: "scan", title: "Scan Segment", description: "Review detected runs" },
  { id: "import", title: "Import", description: "Submit to backend" },
  { id: "correlate", title: "Correlate", description: "Backend dry-run and apply" },
];

const initialChannels: MemoryStorageChannel[] = [];

const existingWitsTargets = ["0824", "0716", "0717", "0921"];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function formatOptionalDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDateTime(value);
}

function formatOptionalNumber(value?: number, decimals = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? formatNumber(value, decimals) : "-";
}

function toBackendSessionId(sessionId?: string | null) {
  if (!sessionId) return undefined;
  const numeric = Number(sessionId);
  return Number.isFinite(numeric) ? numeric : sessionId;
}

function isDepthLikeField(field: string) {
  return ["depth", "md", "measureddepth", "holedepth"].includes(field.trim().toLowerCase().replace(/[\s_-]+/g, ""));
}

function isTimeLikeField(field: string) {
  return ["time", "timestamp", "datetime", "date", "measuredat"].includes(field.trim().toLowerCase().replace(/[\s_-]+/g, ""));
}

const memoryTargetByColumn = new Map<string, string>([
  ["apwd", "mwdPressure"],
  ["apwdmemory", "mwdPressure"],
  ["apwdmem", "mwdPressure"],
  ["pwd", "mwdPressure"],
  ["mwdpressure", "mwdPressure"],
  ["memorypressure", "mwdPressure"],
  ["ecd", "ecd2"],
  ["ecdmem", "ecd2"],
  ["ecdmemory", "ecd2"],
  ["ecdcalc", "ecd2"],
  ["mudweight", "mudWeight"],
  ["mw", "mudWeight"],
  ["annularpressure", "annularPressure"],
  ["borepressure", "borePressure"],
  ["standpipepressure", "standpipePressure"],
  ["pumppressure", "standpipePressure"],
  ["downholerpm", "downholeRpm"],
  ["shockaxial", "shockAxial"],
  ["shocklateral", "shockLateral"],
  ["vibrationaxial", "vibrationAxial"],
  ["vibrationlateral", "vibrationLateral"],
]);

function normalizeMemoryFieldName(field: string) {
  return field.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getBackendMemoryTarget(field: string) {
  const normalized = normalizeMemoryFieldName(field);
  return memoryTargetByColumn.get(normalized) ?? null;
}

function buildDefaultFieldMappings(fields: string[], depthField = "depth") {
  return fields.reduce<Record<string, string>>((mappings, field) => {
    if (field === depthField || isDepthLikeField(field) || isTimeLikeField(field)) return mappings;
    const target = getBackendMemoryTarget(field);
    if (target) mappings[field] = target;
    return mappings;
  }, {});
}

function getValueField(fields: string[], depthField?: string) {
  return fields.find((field) => {
    if (field === depthField || isDepthLikeField(field) || isTimeLikeField(field)) return false;
    return true;
  });
}

function buildMemoryImportRows(parsedFile: MemoryImportFile, valueField: string) {
  return parsedFile.segments.flatMap((segment) =>
    segment.rows.map((row) => ({
      depth: row.depth,
      measuredAt: row.timestamp,
      [valueField]: row.raw[valueField] ?? row.value,
    }))
  );
}

function getDatasetSourceField(dataset: ImportedMemoryDataset | null) {
  if (!dataset) return "";
  return dataset.segmentName.split("/").at(-1)?.trim() ?? "";
}

function getCorrelationMetric(correlation: MemoryFileCorrelation | null, keys: string[]) {
  if (!correlation) return undefined;
  for (const key of keys) {
    const value = correlation.raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function stepStatus(step: WizardStep, activeStep: WizardStep, completedSteps: Set<WizardStep>) {
  if (completedSteps.has(step)) return "completed";
  if (step === activeStep) return "current";
  return "pending";
}

function SegmentProfile({ segment }: { segment: MemoryImportSegment }) {
  const values = segment.rows.map((row) => row.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = segment.rows.slice(0, 28);

  return (
    <div className="flex h-12 items-end gap-0.5 rounded-md border bg-muted/30 p-1.5 sm:h-16 sm:gap-1 sm:p-2">
      {points.map((row, index) => (
        <div
          key={`${segment.id}-${index}`}
          className="w-full rounded-sm bg-primary/70"
          style={{ height: `${22 + ((row.value - min) / range) * 70}%` }}
          title={`${formatNumber(row.depth)} ft: ${formatNumber(row.value, 3)}`}
        />
      ))}
    </div>
  );
}

function Stepper({
  activeStep,
  completedSteps,
  onStepSelect,
}: {
  activeStep: WizardStep;
  completedSteps: Set<WizardStep>;
  onStepSelect: (step: WizardStep) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-5">
      {steps.map((step, index) => {
        const status = stepStatus(step.id, activeStep, completedSteps);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepSelect(step.id)}
            className={cn(
              "rounded-lg border px-2 py-2 text-left transition-colors sm:px-3 sm:py-3",
              status === "current" && "border-primary bg-primary/10",
              status === "completed" && "border-emerald-500/40 bg-emerald-500/10",
              status === "pending" && "bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold sm:size-6 sm:text-xs",
                  status === "completed" && "border-emerald-500 bg-emerald-500 text-white",
                  status === "current" && "border-primary bg-primary text-primary-foreground"
                )}
              >
                {status === "completed" ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="text-xs font-semibold sm:text-sm">{step.title}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:mt-2 sm:text-xs">{step.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export function MemoryImportWizard() {
  const { token, user } = useAuth();
  const { activeMwdSessionId, refreshMwdData } = useApp();
  const [activeStep, setActiveStep] = useState<WizardStep>("upload");
  const [storageChannels] = useState<MemoryStorageChannel[]>(initialChannels);
  const [selectedStorageId, setSelectedStorageId] = useState(initialChannels[0]?.id ?? "");
  const [storageDraft, setStorageDraft] = useState({
    witsId: "8023",
    name: "Memory Resistivity",
    decimalPlaces: 2,
    scaleFactor: 1,
    bitOffset: 0,
    sensorSpacing: 0,
    plotScaleInfo: "Auto plot scale after import",
  });
  const [importFile, setImportFile] = useState<MemoryImportFile | null>(null);
  const [importFiles, setImportFiles] = useState<MemoryImportFile[]>([]);
  const [memoryImportBatch, setMemoryImportBatch] = useState<ImportSourceBatch | null>(null);
  const [memoryBatchResult, setMemoryBatchResult] = useState<{
    imported: string[];
    failed: Array<{ fileName: string; message: string }>;
  } | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [datasets] = useState<ImportedMemoryDataset[]>([]);
  const [activeDatasetId] = useState<string>("");
  const [correlationSettings, setCorrelationSettings] = useState<CorrelationSettings>({
    timeShiftSeconds: 0,
    depthShift: 0,
    scaleFactor: 1,
  });
  const [gapTargetWitsId, setGapTargetWitsId] = useState(existingWitsTargets[0]);
  const [gapMode, setGapMode] = useState<GapFillRequest["mode"]>("fill-gaps-only");
  const [gapFillRequests] = useState<GapFillRequest[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [backendMemoryFiles, setBackendMemoryFiles] = useState<MemoryFileRecord[]>([]);
  const [backendCorrelations, setBackendCorrelations] = useState<MemoryFileCorrelation[]>([]);
  const [selectedBackendFileId, setSelectedBackendFileId] = useState("");
  const [backendFileDetail, setBackendFileDetail] = useState<MemoryFileRecord | null>(null);
  const [backendFilePoints, setBackendFilePoints] = useState<MemoryFilePoint[]>([]);
  const [memoryFilesLoading, setMemoryFilesLoading] = useState(false);
  const [memoryFileDetailLoading, setMemoryFileDetailLoading] = useState(false);
  const [memoryFileImporting, setMemoryFileImporting] = useState(false);
  const [memoryFileDeletingId, setMemoryFileDeletingId] = useState("");
  const [memoryFilesError, setMemoryFilesError] = useState("");
  const [correlationMode, setCorrelationMode] = useState<"depth" | "time">("depth");
  const [correlationSourceField, setCorrelationSourceField] = useState("");
  const [correlationTargetField, setCorrelationTargetField] = useState("mwdPressure");
  const [maxDepthDifference, setMaxDepthDifference] = useState(10);
  const [maxTimeDifferenceMs, setMaxTimeDifferenceMs] = useState(60000);
  const [measuredAtOffsetMs, setMeasuredAtOffsetMs] = useState(0);
  const [correlationPreview, setCorrelationPreview] = useState<MemoryFileCorrelation | null>(null);
  const [correlationLoading, setCorrelationLoading] = useState(false);
  const [correlationError, setCorrelationError] = useState("");
  const canManageMemoryFiles = user?.role === "engineer" || user?.role === "admin";

  const selectedStorage = storageChannels.find((channel) => channel.id === selectedStorageId) ?? null;
  const selectedSegment = importFile?.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const activeDataset = datasets.find((dataset) => dataset.id === activeDatasetId) ?? datasets[0] ?? null;
  const storageValidation = validateMemoryWitsId(storageDraft.witsId, storageChannels);

  const completedSteps = useMemo(() => {
    const completed = new Set<WizardStep>();
    if (selectedStorage || backendMemoryFiles.length > 0 || memoryBatchResult?.imported.length) completed.add("storage");
    if (importFile) completed.add("upload");
    if (selectedSegment) completed.add("scan");
    if (activeDataset || memoryBatchResult?.imported.length || selectedBackendFileId) completed.add("import");
    if (activeDataset?.status === "correlated" || gapFillRequests.length > 0 || correlationPreview) completed.add("correlate");
    return completed;
  }, [activeDataset, backendMemoryFiles.length, correlationPreview, gapFillRequests.length, importFile, memoryBatchResult?.imported.length, selectedBackendFileId, selectedSegment, selectedStorage]);

  const compareRows = useMemo<Array<{
    sampleId: string;
    depth: number;
    importedValue: number;
    nearestRealtimeDepth: number | null;
    nearestRealtimeValue: number | null;
    delta: number | null;
  }>>(() => [], []);

  const activeSourceField =
    correlationSourceField.trim() ||
    getDatasetSourceField(activeDataset) ||
    backendFileDetail?.fieldName ||
    backendFilePoints.find((point) => point.fieldName)?.fieldName ||
    "";
  const correlationDepths = activeDataset
    ? activeDataset.samples.map((sample) => sample.depth)
    : backendFilePoints.map((point) => point.depth).filter((value): value is number => typeof value === "number");
  const firstCorrelationValue = activeDataset?.samples[0]?.value ?? backendFilePoints.find((point) => typeof point.value === "number")?.value ?? 0;
  const selectedBackendFile = backendMemoryFiles.find((file) => file.id === selectedBackendFileId) ?? backendFileDetail;

  const loadBackendMemoryFiles = useCallback(async () => {
    if (!token) {
      setBackendMemoryFiles([]);
      setMemoryFilesError("");
      return;
    }

    setMemoryFilesLoading(true);
    setMemoryFilesError("");

    try {
      const files = await getMemoryFiles(token, activeMwdSessionId ? { sessionId: activeMwdSessionId } : {});
      setBackendMemoryFiles(files);
      setSelectedBackendFileId((current) => current || files[0]?.id || "");
    } catch (error) {
      logSecurityError("Unable to load memory files.", error);
      setMemoryFilesError("Gagal memuat data dari backend.");
    } finally {
      setMemoryFilesLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const loadBackendMemoryFileDetail = useCallback(
    async (fileId: string) => {
      if (!token || !fileId) {
        setBackendFileDetail(null);
        setBackendFilePoints([]);
        return;
      }

      setMemoryFileDetailLoading(true);
      setMemoryFilesError("");

      try {
        const [detail, points] = await Promise.all([
          getMemoryFile(token, fileId),
          getMemoryFilePoints(token, fileId),
        ]);
        setBackendFileDetail(detail);
        setBackendFilePoints(points);
      } catch (error) {
        logSecurityError("Unable to load memory file detail.", error);
        setMemoryFilesError("Gagal memuat data dari backend.");
      } finally {
        setMemoryFileDetailLoading(false);
      }
    },
    [token]
  );

  const loadBackendCorrelations = useCallback(async () => {
    if (!token) {
      setBackendCorrelations([]);
      return;
    }

    try {
      const correlations = await getMemoryFileCorrelations(
        token,
        activeMwdSessionId ? { sessionId: activeMwdSessionId } : {}
      );
      setBackendCorrelations(correlations);
    } catch (error) {
      logSecurityError("Unable to load memory correlations.", error);
      setCorrelationError("Gagal memuat data dari backend.");
    }
  }, [activeMwdSessionId, token]);

  useEffect(() => {
    void loadBackendMemoryFiles();
  }, [loadBackendMemoryFiles]);

  useEffect(() => {
    void loadBackendCorrelations();
  }, [loadBackendCorrelations]);

  useEffect(() => {
    void loadBackendMemoryFileDetail(selectedBackendFileId);
  }, [loadBackendMemoryFileDetail, selectedBackendFileId]);

  useEffect(() => {
    setCorrelationSourceField((current) => {
      if (current.trim()) return current;
      return backendFileDetail?.fieldName ?? backendFilePoints.find((point) => point.fieldName)?.fieldName ?? "";
    });
  }, [backendFileDetail?.fieldName, backendFilePoints]);

  const progressValue = (completedSteps.size / steps.length) * 100;

  const handleCreateStorage = () => {
    const validation = validateMemoryWitsId(storageDraft.witsId, storageChannels);
    if (validation) {
      toast.error(validation);
      return;
    }

    toast.warning("Backend endpoint required", {
      description: "Registering memory storage channels locally is disabled. Use a backend-backed memory storage endpoint when available.",
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setMemoryFileImporting(true);
    setMemoryFilesError("");
    setMemoryImportBatch(null);
    setMemoryBatchResult(null);
    try {
      const batch = await collectImportSources(files);
      const parsedFiles = batch.validSources.map((source) => parseMemoryCsv(source.fileName, source.content));
      const firstParsed = parsedFiles[0] ?? null;

      setMemoryImportBatch(batch);
      setImportFiles(parsedFiles);
      setImportFile(firstParsed);
      setSelectedSegmentId(firstParsed?.segments[0]?.id ?? "");
      setActiveStep("scan");

      if (batch.validCsvCount === 0) {
        toast.warning("No valid memory CSV files found.");
        return;
      }

      if (!token || !canManageMemoryFiles) {
        toast.warning("Backend import not available for this user", {
          description: "The files were parsed only for browser-side preview. No memory data was stored.",
        });
        return;
      }

      const sessionId = toBackendSessionId(activeMwdSessionId);
      if (!sessionId) {
        const message = "Select an active MWD session before importing memory files.";
        setMemoryFilesError(message);
        toast.error("Unable to import memory CSV files", { description: message });
        return;
      }

      const importedNames: string[] = [];
      const failed: Array<{ fileName: string; message: string }> = [];
      let latestImportedId = "";

      for (const [index, source] of batch.validSources.entries()) {
        const parsedFile = parsedFiles[index];
        try {
          const depthField =
            parsedFile.detectedFields.find((field) => isDepthLikeField(field)) ??
            undefined;
          const measuredAtField = parsedFile.detectedFields.find((field) => isTimeLikeField(field));
          const valueField = getValueField(parsedFile.detectedFields, depthField);
          const fieldMappings = buildDefaultFieldMappings(parsedFile.detectedFields, depthField);
          const shouldSendNormalizedRows = !depthField && !measuredAtField && valueField && parsedFile.segments.length > 0;
          const imported = await importMemoryFile(token, {
            sessionId,
            fileName: source.fileName,
            source: "memory_file",
            ...(shouldSendNormalizedRows
              ? { rows: buildMemoryImportRows(parsedFile, valueField) }
              : { content: source.content }),
            hasHeader: true,
            ...(depthField ? { depthField } : {}),
            ...(measuredAtField ? { measuredAtField } : {}),
            ...(Object.keys(fieldMappings).length > 0 ? { fieldMappings } : {}),
          });
          latestImportedId = imported.id;
          importedNames.push(source.fileName);
        } catch (error) {
          failed.push({
            fileName: source.fileName,
            message: error instanceof Error ? error.message : "Backend request failed.",
          });
        }
      }

      setMemoryBatchResult({ imported: importedNames, failed });
      if (latestImportedId) setSelectedBackendFileId(latestImportedId);
      await loadBackendMemoryFiles();

      if (importedNames.length > 0 && failed.length > 0) {
        toast.warning(`${importedNames.length} memory CSV imported, ${failed.length} failed.`, {
          description: failed[0] ? `${failed[0].fileName}: ${failed[0].message}` : undefined,
        });
      } else if (importedNames.length > 0) {
        toast.success(`${importedNames.length} memory CSV file(s) imported and scanned.`);
      } else {
        const firstFailure = failed[0];
        toast.error("No memory CSV files were imported.", {
          description: firstFailure ? `${firstFailure.fileName}: ${firstFailure.message}` : "No backend import response was returned.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import memory CSV files.";
      setMemoryFilesError(message);
      toast.error("Unable to import memory CSV files", { description: message });
    } finally {
      setIsParsing(false);
      setMemoryFileImporting(false);
      event.target.value = "";
    }
  };

  const handleImportSegment = () => {
    if (!importFile || !selectedSegment) {
      toast.error("Select a parsed memory segment before import.");
      return;
    }

    if (memoryBatchResult?.imported.length) {
      toast.success(`${memoryBatchResult.imported.length} memory file(s) already imported through POST /api/memory-files/import.`);
      setActiveStep("correlate");
      return;
    }

    toast.warning("Upload a CSV first", {
      description: "The backend memory import runs during the upload step through POST /api/memory-files/import.",
    });
  };

  const handleApplyCorrelation = () => {
    if (correlationPreview) {
      void handleApplyBackendCorrelation();
      return;
    }

    void handlePreviewBackendCorrelation();
  };

  const buildCorrelationPayload = (dryRun: boolean) => {
    const sessionId = toBackendSessionId(activeMwdSessionId);
    const source = activeSourceField;
    const target = correlationTargetField.trim();

    if (!selectedBackendFileId) {
      throw new Error("Select a backend memory file before correlation.");
    }
    if (!sessionId) {
      throw new Error("Select an active MWD session before correlation.");
    }
    if (!source || !target) {
      throw new Error("Source memory field and target MWD field are required.");
    }

    return correlationMode === "depth"
      ? {
          sessionId,
          mode: "depth" as const,
          dryRun,
          depthOffset: correlationSettings.depthShift,
          maxDepthDifference,
          fieldMappings: [{ source, target }],
        }
      : {
          sessionId,
          mode: "timestamp" as const,
          dryRun,
          measuredAtOffsetMs,
          maxTimeDifferenceMs,
          fieldMappings: [{ source, target }],
        };
  };

  const handlePreviewBackendCorrelation = async () => {
    if (!token) {
      toast.error("Sign in before previewing memory correlation.");
      return;
    }

    setCorrelationLoading(true);
    setCorrelationError("");

    try {
      const result = await correlateMemoryFile(token, selectedBackendFileId, buildCorrelationPayload(true));
      setCorrelationPreview(result);
      toast.success("Correlation preview loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview memory correlation.";
      setCorrelationError(message);
      toast.error("Unable to preview memory correlation", { description: message });
    } finally {
      setCorrelationLoading(false);
    }
  };

  const handleApplyBackendCorrelation = async () => {
    if (!token) {
      toast.error("Sign in before applying memory correlation.");
      return;
    }
    if (!canManageMemoryFiles) {
      toast.warning("Only admin or engineer users can apply memory correlation.");
      return;
    }
    if (!correlationPreview) {
      toast.error("Run dry-run preview before applying correlation.");
      return;
    }

    setCorrelationLoading(true);
    setCorrelationError("");

    try {
      const result = await correlateMemoryFile(token, selectedBackendFileId, buildCorrelationPayload(false));
      setCorrelationPreview(result);
      await loadBackendMemoryFileDetail(selectedBackendFileId);
      await Promise.all([refreshMwdData(), loadBackendCorrelations()]);
      toast.success(result.summary || "Memory correlation applied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to apply memory correlation.";
      setCorrelationError(message);
      toast.error("Unable to apply memory correlation", { description: message });
    } finally {
      setCorrelationLoading(false);
    }
  };

  const handleGapFill = () => {
    toast.warning("Backend endpoint required", {
      description: "Local gap-fill staging is disabled. Add a backend gap-fill endpoint before enabling this action.",
    });
  };

  const handleDeleteBackendMemoryFile = async (fileId: string) => {
    if (!token) {
      toast.error("Sign in before deleting memory files.");
      return;
    }
    if (!canManageMemoryFiles) {
      toast.warning("Only admin or engineer users can delete memory files.");
      return;
    }

    setMemoryFileDeletingId(fileId);
    setMemoryFilesError("");

    try {
      await deleteMemoryFile(token, fileId);
      if (selectedBackendFileId === fileId) {
        setSelectedBackendFileId("");
        setBackendFileDetail(null);
        setBackendFilePoints([]);
      }
      await loadBackendMemoryFiles();
      toast.success("Memory file deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete memory file.";
      setMemoryFilesError(message);
      toast.error("Unable to delete memory file", { description: message });
    } finally {
      setMemoryFileDeletingId("");
    }
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      <WorkspaceSection
        title="Memory File Import"
        description="Operational wizard for backend memory files."
        badge="Backend memory files"
        className="p-3 sm:p-5"
      >
        <div className="space-y-3 sm:space-y-4">
          <div className="grid gap-2 sm:gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="rounded-lg border bg-muted/20 p-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                <FileSearch className="size-4" />
                Workflow
              </div>
              <div className="mt-2 grid gap-1.5 text-xs leading-snug text-muted-foreground sm:mt-3 sm:grid-cols-2 sm:text-sm lg:grid-cols-5">
                <div>1. Upload vendor CSV or ZIP memory export.</div>
                <div>2. Backend stores the valid CSV file.</div>
                <div>3. Scan detected fields and segments.</div>
                <div>4. Review backend import result.</div>
                <div>5. Correlate backend memory file to MWD data.</div>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="text-sm font-semibold">WITS ID helper rule</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:mt-3 sm:gap-3">
                <div>
                  <div className="text-muted-foreground">Good examples</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["7001", "2055", "8023"].map((id) => (
                      <Badge key={id} variant="secondary">{id}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bad examples</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["0126", "0166", "0855"].map((id) => (
                      <Badge key={id} variant="outline">{id}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Progress value={progressValue} />
          <Stepper activeStep={activeStep} completedSteps={completedSteps} onStepSelect={setActiveStep} />
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        title="Memory Files"
        description="Backend memory files from GET /api/memory-files. Selecting a file loads metadata and points for review."
        badge={activeMwdSessionId ? `Session ${activeMwdSessionId}` : "All sessions"}
        className="p-3 sm:p-5"
      >
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="text-xs text-muted-foreground sm:text-sm">
              {memoryFilesLoading ? "Loading memory files..." : `${backendMemoryFiles.length} backend file(s) loaded`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadBackendMemoryFiles()}
              disabled={!token || memoryFilesLoading}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5 sm:mr-2 sm:size-4", memoryFilesLoading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh Files</span>
            </Button>
          </div>

          {memoryFilesError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {memoryFilesError}
            </div>
          ) : null}

          <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="p-0">
              <div className="border-b px-3 py-2.5 sm:px-4 sm:py-3">
                <h3 className="text-sm font-semibold sm:text-base">File list</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">Use the upload step to import a new memory file.</p>
              </div>
              <div className="max-h-[320px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backendMemoryFiles.map((file) => (
                      <TableRow
                        key={file.id}
                        className={selectedBackendFileId === file.id ? "bg-muted/60" : ""}
                        onClick={() => setSelectedBackendFileId(file.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{file.fileName}</div>
                          <div className="text-xs text-muted-foreground">{formatOptionalDateTime(file.uploadedAt)}</div>
                        </TableCell>
                        <TableCell>{file.status ?? "-"}</TableCell>
                        <TableCell>{file.pointCount ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                disabled={!canManageMemoryFiles || memoryFileDeletingId === file.id}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete memory file?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {file.fileName} with ID {file.id} will be deleted. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDeleteBackendMemoryFile(file.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!memoryFilesLoading && backendMemoryFiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          Belum ada memory file.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="p-0">
              <div className="border-b px-3 py-2.5 sm:px-4 sm:py-3">
                <h3 className="text-sm font-semibold sm:text-base">File detail and points</h3>
                {/* <p className="text-xs text-muted-foreground sm:text-sm">
                  Detail uses GET /api/memory-files/:id and points use GET /api/memory-files/:id/points.
                </p> */}
              </div>
              {memoryFileDetailLoading ? (
                <div className="p-3 text-sm text-muted-foreground sm:p-4">Loading file detail...</div>
              ) : backendFileDetail ? (
                <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
                  <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                    <SummaryTile label="File" value={backendFileDetail.fileName} />
                    <SummaryTile label="Status" value={backendFileDetail.status ?? "-"} />
                    <SummaryTile label="Uploaded" value={formatOptionalDateTime(backendFileDetail.uploadedAt)} />
                    <SummaryTile label="Field" value={backendFileDetail.fieldName ?? "-"} />
                  </div>
                  <div className="max-h-[220px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Depth</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backendFilePoints.slice(0, 12).map((point) => (
                          <TableRow key={point.id}>
                            <TableCell>{formatOptionalNumber(point.depth)}</TableCell>
                            <TableCell>{formatOptionalNumber(point.value, 3)}</TableCell>
                            <TableCell>{point.fieldName ?? "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatOptionalDateTime(point.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                        {backendFilePoints.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                              Belum ada memory file.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-sm text-muted-foreground sm:p-4">Select a memory file to load detail and points.</div>
              )}
            </Card>
          </div>
        </div>
      </WorkspaceSection>

      {activeStep === "storage" ? (
        <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1fr_1.15fr]">
          <WorkspaceSection className="p-3 sm:p-5" title="Memory Storage" description="Storage channel registration is optional for the current backend upload flow. Memory CSV import can start from the Upload step now.">
            <div className="space-y-3">
              {storageChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedStorageId(channel.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 sm:p-4",
                    selectedStorageId === channel.id && "border-primary bg-primary/10"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{channel.witsId} - {channel.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Decimals {channel.decimalPlaces} | Scale {channel.scaleFactor} | Sensor spacing {channel.sensorSpacing}
                      </div>
                    </div>
                    <Badge variant="outline">{channel.source}</Badge>
                  </div>
                </button>
              ))}
              <Button onClick={() => setActiveStep("upload")}>
                Continue to upload
              </Button>
            </div>
          </WorkspaceSection>

          <WorkspaceSection className="p-3 sm:p-5" title="Create/Register Storage WITS ID" description="Registration requires a backend endpoint. This form is disabled until that contract exists.">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>WITS ID</Label>
                <Input value={storageDraft.witsId} onChange={(event) => setStorageDraft((current) => ({ ...current, witsId: event.target.value }))} />
                {storageValidation ? <p className="text-xs text-destructive">{storageValidation}</p> : <p className="text-xs text-muted-foreground">Backend registration endpoint required.</p>}
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={storageDraft.name} onChange={(event) => setStorageDraft((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Decimal places</Label>
                <Input type="number" min={0} max={6} value={storageDraft.decimalPlaces} onChange={(event) => setStorageDraft((current) => ({ ...current, decimalPlaces: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Scale factor</Label>
                <Input type="number" step="0.01" value={storageDraft.scaleFactor} onChange={(event) => setStorageDraft((current) => ({ ...current, scaleFactor: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Bit offset</Label>
                <Input type="number" step="0.1" value={storageDraft.bitOffset} onChange={(event) => setStorageDraft((current) => ({ ...current, bitOffset: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Sensor spacing</Label>
                <Input type="number" step="0.1" value={storageDraft.sensorSpacing} onChange={(event) => setStorageDraft((current) => ({ ...current, sensorSpacing: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Plot scale info</Label>
                <Input value={storageDraft.plotScaleInfo} onChange={(event) => setStorageDraft((current) => ({ ...current, plotScaleInfo: event.target.value }))} />
              </div>
            </div>
            <Button className="mt-3 h-8 px-3 text-xs sm:mt-4 sm:h-9 sm:text-sm" onClick={handleCreateStorage} disabled={Boolean(storageValidation)}>
              <Plus className="mr-2 size-4" />
              Register storage
            </Button>
          </WorkspaceSection>
        </div>
      ) : null}

      {activeStep === "upload" ? (
        <WorkspaceSection className="p-3 sm:p-5" title="Upload Memory File" description="CSV parser detects time/depth/value fields. Empty or unreadable files stay empty.">
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="p-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                <FileUp className="size-4" />
                Select vendor CSV
              </div>
              <div className="mt-3 space-y-3 sm:mt-4">
                <Input
                  type="file"
                  accept=".csv,.zip,text/csv,application/zip"
                  multiple
                  onChange={handleFileChange}
                  disabled={isParsing || memoryFileImporting || !canManageMemoryFiles}
                />
                <PlaceholderNote>
                  Upload reads one CSV, multiple CSVs, or ZIP dumps in the browser and sends each valid CSV through POST /api/memory-files/import when backend access is available. ZIP upload is the stable folder-dump path.
                </PlaceholderNote>
              </div>
            </Card>

            <Card className="p-3 sm:p-4">
              <div className="font-semibold">File summary</div>
              {memoryImportBatch ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <SummaryTile label="Selected" value={String(memoryImportBatch.inputFileCount)} />
                    <SummaryTile label="ZIP files" value={String(memoryImportBatch.zipFileCount)} />
                    <SummaryTile label="Discovered" value={String(memoryImportBatch.discoveredFileCount)} />
                    <SummaryTile label="Valid CSV" value={String(memoryImportBatch.validCsvCount)} />
                    <SummaryTile label="Skipped" value={String(memoryImportBatch.skippedSources.length)} />
                  </div>
                  {memoryImportBatch.duplicateFileNames.length > 0 ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                      Duplicate file names: {memoryImportBatch.duplicateFileNames.join(", ")}
                    </div>
                  ) : null}
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs font-semibold">Valid CSV files</div>
                      <div className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                        {memoryImportBatch.validSources.slice(0, 10).map((source) => (
                          <div key={source.id} className="flex justify-between gap-3">
                            <span className="truncate">{source.sourcePath}</span>
                            <span className="shrink-0">{countCsvRecords(source.content)} rows</span>
                          </div>
                        ))}
                        {memoryImportBatch.validSources.length > 10 ? <div>+{memoryImportBatch.validSources.length - 10} more</div> : null}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs font-semibold">Skipped / invalid files</div>
                      <div className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                        {memoryImportBatch.skippedSources.length > 0 ? (
                          memoryImportBatch.skippedSources.slice(0, 10).map((source) => (
                            <div key={`${source.sourcePath}-${source.reason}`} className="flex justify-between gap-3">
                              <span className="truncate">{source.sourcePath}</span>
                              <span className="shrink-0">{source.reason}</span>
                            </div>
                          ))
                        ) : (
                          <div>No skipped files.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {memoryBatchResult ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
                        Backend imported: {memoryBatchResult.imported.length}
                      </div>
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                        Failed: {memoryBatchResult.failed.length}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {importFiles.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {importFiles.slice(0, 8).map((file) => (
                    <Button
                      key={file.id}
                      type="button"
                      size="sm"
                      variant={importFile?.id === file.id ? "default" : "outline"}
                      onClick={() => {
                        setImportFile(file);
                        setSelectedSegmentId(file.segments[0]?.id ?? "");
                      }}
                    >
                      {file.fileName}
                    </Button>
                  ))}
                  {importFiles.length > 8 ? <Badge variant="outline">+{importFiles.length - 8} more</Badge> : null}
                </div>
              ) : null}
              {importFile ? (
                <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                  <SummaryTile label="File name" value={importFile.fileName} />
                  <SummaryTile label="Parser mode" value={importFile.parserMode} />
                  <SummaryTile label="Detected fields" value={importFile.detectedFields.join(", ")} />
                  <SummaryTile label="Total rows" value={String(importFile.totalRows)} />
                  <SummaryTile label="Start" value={formatDateTime(importFile.detectedTimeSpan.start)} />
                  <SummaryTile label="End" value={formatDateTime(importFile.detectedTimeSpan.end)} />
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground sm:mt-4 sm:p-6">Belum ada memory file.</div>
              )}
            </Card>
          </div>
        </WorkspaceSection>
      ) : null}

      {activeStep === "scan" ? (
        <WorkspaceSection className="p-3 sm:p-5" title="Scan and Select Segment" description="Detected segments are split by large time gaps. Backend file storage already happens during upload; segment selection is for review and correlation.">
          {importFile ? (
            <div className="grid gap-2.5 sm:gap-3">
              {importFile.segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setSelectedSegmentId(segment.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 sm:p-4",
                    selectedSegmentId === segment.id && "border-primary bg-primary/10"
                  )}
                >
                  <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_1.1fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{segment.name}</div>
                        <Badge variant="outline">{segment.fieldName}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>Start: {formatDateTime(segment.startTime)}</div>
                        <div>End: {formatDateTime(segment.endTime)}</div>
                        <div>Samples: {segment.sampleCount}</div>
                        <div>Depth: {formatNumber(segment.startDepth)} - {formatNumber(segment.endDepth)}</div>
                      </div>
                    </div>
                    <SegmentProfile segment={segment} />
                  </div>
                </button>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setActiveStep("upload")} variant="outline">Back to upload</Button>
                <Button onClick={() => setActiveStep("import")} disabled={!selectedSegment}>Continue to import</Button>
              </div>
            </div>
          ) : (
            <PlaceholderNote>Upload a CSV before scanning segments.</PlaceholderNote>
          )}
        </WorkspaceSection>
      ) : null}

      {activeStep === "import" ? (
        <WorkspaceSection className="p-3 sm:p-5" title="Backend Import Result" description="Memory CSV files are stored by POST /api/memory-files/import during upload. This step confirms what was imported before correlation.">
          <div className="grid gap-2 sm:gap-4 lg:grid-cols-3">
            <SummaryCard icon={Database} label="Backend imported" value={memoryBatchResult ? String(memoryBatchResult.imported.length) : "Upload first"} />
            <SummaryCard icon={FileSearch} label="Selected segment" value={selectedSegment ? `${selectedSegment.name}, ${selectedSegment.sampleCount} samples` : "None"} />
            <SummaryCard icon={Check} label="Failed files" value={memoryBatchResult ? String(memoryBatchResult.failed.length) : "-"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
            <Button variant="outline" onClick={() => setActiveStep("scan")}>Back to scan</Button>
            <Button onClick={handleImportSegment} disabled={!selectedSegment}>
              <Database className="mr-2 size-4" />
              Continue to correlation
            </Button>
          </div>
          {datasets.length > 0 ? (
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">Import result summary</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WITS ID</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Samples</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>{dataset.storageWitsId}</TableCell>
                      <TableCell>{dataset.segmentName}</TableCell>
                      <TableCell>{dataset.samples.length}</TableCell>
                      <TableCell><Badge variant="outline">{dataset.status}</Badge></TableCell>
                      <TableCell>{formatDateTime(dataset.importedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </WorkspaceSection>
      ) : null}

      {activeStep === "correlate" ? (
        <WorkspaceSection className="p-3 sm:p-5" title="Correlate Imported Data" description="Use backend dry-run and apply endpoints to correlate memory files with MWD data.">
          {selectedBackendFile ? (
            <Tabs defaultValue="correlate" className="space-y-4">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="correlate">Correlation</TabsTrigger>
                <TabsTrigger value="compare">Compare</TabsTrigger>
                <TabsTrigger value="gap-fill">Gap Fill Helper</TabsTrigger>
              </TabsList>

              <TabsContent value="correlate" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Time shift seconds</Label>
                    <Input type="number" value={correlationSettings.timeShiftSeconds} onChange={(event) => setCorrelationSettings((current) => ({ ...current, timeShiftSeconds: Number(event.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Shift depths up/down</Label>
                    <Input type="number" step="0.1" value={correlationSettings.depthShift} onChange={(event) => setCorrelationSettings((current) => ({ ...current, depthShift: Number(event.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rescale imported data</Label>
                    <Input type="number" step="0.01" value={correlationSettings.scaleFactor} onChange={(event) => setCorrelationSettings((current) => ({ ...current, scaleFactor: Number(event.target.value) }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Backend correlation mode</Label>
                    <Select value={correlationMode} onValueChange={(value) => setCorrelationMode(value as "depth" | "time")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="depth">Depth</SelectItem>
                        <SelectItem value="time">Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source memory field</Label>
                    <Input
                      value={correlationSourceField}
                      onChange={(event) => setCorrelationSourceField(event.target.value)}
                      placeholder={backendFileDetail?.fieldName ?? backendFilePoints.find((point) => point.fieldName)?.fieldName ?? "memory field"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target MWD field</Label>
                    <Input value={correlationTargetField} onChange={(event) => setCorrelationTargetField(event.target.value)} placeholder="mwdPressure" />
                  </div>
                </div>
                {correlationMode === "depth" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Depth offset</Label>
                      <Input type="number" step="0.1" value={correlationSettings.depthShift} onChange={(event) => setCorrelationSettings((current) => ({ ...current, depthShift: Number(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max depth difference</Label>
                      <Input type="number" step="0.1" value={maxDepthDifference} onChange={(event) => setMaxDepthDifference(Number(event.target.value))} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Measured at offset ms</Label>
                      <Input type="number" value={measuredAtOffsetMs} onChange={(event) => setMeasuredAtOffsetMs(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max time difference ms</Label>
                      <Input type="number" value={maxTimeDifferenceMs} onChange={(event) => setMaxTimeDifferenceMs(Number(event.target.value))} />
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard
                    icon={ArrowDownUp}
                    label="Depth range"
                    value={correlationDepths.length > 0 ? `${formatNumber(Math.min(...correlationDepths))} - ${formatNumber(Math.max(...correlationDepths))}` : "-"}
                  />
                  <SummaryCard icon={Scale} label="Value preview" value={`${formatNumber(firstCorrelationValue, 3)} first sample`} />
                  <SummaryCard icon={GitCompare} label="Backend file" value={selectedBackendFile ? selectedBackendFile.fileName : "Select a backend file"} />
                </div>
                {correlationError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {correlationError}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handlePreviewBackendCorrelation()}
                    disabled={!token || !selectedBackendFileId || !activeSourceField || !correlationTargetField.trim() || correlationLoading}
                  >
                    {correlationLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Scale className="mr-2 size-4" />}
                    Preview Backend Correlation
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!canManageMemoryFiles || !correlationPreview || correlationLoading}
                      >
                        Apply Backend Correlation
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Apply memory correlation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will call POST /api/memory-files/{selectedBackendFileId}/correlate with dryRun=false using the last reviewed mapping.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleApplyBackendCorrelation()}>
                          Apply Correlation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="ghost" onClick={handleApplyCorrelation}>
                    Apply backend correlation
                  </Button>
                </div>
                {correlationPreview ? (
                  <Card className="p-4">
                    <h3 className="font-semibold">Backend correlation preview/result</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{correlationPreview.summary}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <SummaryTile label="Matched" value={String(correlationPreview.matchedCount ?? getCorrelationMetric(correlationPreview, ["matchedCount", "matched_count"]) ?? "-")} />
                      <SummaryTile label="Skipped" value={String(correlationPreview.skippedCount ?? correlationPreview.unmatchedCount ?? getCorrelationMetric(correlationPreview, ["skippedCount", "skipped_count", "unmatchedCount", "unmatched_count"]) ?? "-")} />
                      <SummaryTile label="Updated" value={String(correlationPreview.updatedCount ?? getCorrelationMetric(correlationPreview, ["updatedCount", "updated_count"]) ?? "-")} />
                      <SummaryTile label="Affected" value={String(correlationPreview.affectedRows ?? getCorrelationMetric(correlationPreview, ["affectedRows", "affected_rows"]) ?? "-")} />
                    </div>
                    {correlationPreview.previewRows.length > 0 ? (
                      <Table className="mt-4">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Depth</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {correlationPreview.previewRows.slice(0, 8).map((row, index) => (
                            <TableRow key={`correlation-preview-${index}`}>
                              <TableCell>{String(row.source ?? row.sourceField ?? row.memoryField ?? "-")}</TableCell>
                              <TableCell>{String(row.target ?? row.targetField ?? row.mwdField ?? "-")}</TableCell>
                              <TableCell>{String(row.depth ?? row.md ?? row.measuredDepth ?? "-")}</TableCell>
                              <TableCell>{String(row.status ?? row.message ?? row.action ?? "-")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Preview returned no sample rows.
                      </div>
                    )}
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="compare" className="space-y-4">
                <div className="flex max-w-sm items-center gap-2">
                  <Label className="shrink-0">Compare to WITS ID</Label>
                  <Select value={gapTargetWitsId} onValueChange={setGapTargetWitsId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {existingWitsTargets.map((witsId) => (
                        <SelectItem key={witsId} value={witsId}>{witsId}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imported depth</TableHead>
                      <TableHead>Imported value</TableHead>
                      <TableHead>Nearest RT depth</TableHead>
                      <TableHead>Nearest RT value</TableHead>
                      <TableHead>Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareRows.map((row) => (
                      <TableRow key={row.sampleId}>
                        <TableCell>{formatNumber(row.depth)}</TableCell>
                        <TableCell>{formatNumber(row.importedValue, 3)}</TableCell>
                        <TableCell>{row.nearestRealtimeDepth === null ? "-" : formatNumber(row.nearestRealtimeDepth)}</TableCell>
                        <TableCell>{row.nearestRealtimeValue === null ? "-" : formatNumber(row.nearestRealtimeValue, 3)}</TableCell>
                        <TableCell>{row.delta === null ? "-" : formatNumber(row.delta, 3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="gap-fill" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Target existing WITS ID</Label>
                    <Select value={gapTargetWitsId} onValueChange={setGapTargetWitsId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {existingWitsTargets.map((witsId) => (
                          <SelectItem key={witsId} value={witsId}>{witsId}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gap fill mode</Label>
                    <Select value={gapMode} onValueChange={(value) => setGapMode(value as GapFillRequest["mode"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fill-gaps-only">Fill gaps only</SelectItem>
                        <SelectItem value="copy-depths">Copy depths</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleGapFill}>
                      <Copy className="mr-2 size-4" />
                      Stage gap fill
                    </Button>
                  </div>
                </div>
                <PlaceholderNote>
                  Gap fill requires a backend endpoint. The frontend no longer stages local gap-fill requests.
                </PlaceholderNote>
                {gapFillRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Depth range</TableHead>
                        <TableHead>Samples</TableHead>
                        <TableHead>Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gapFillRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.sourceWitsId}</TableCell>
                          <TableCell>{request.targetWitsId}</TableCell>
                          <TableCell>{formatNumber(request.startDepth)} - {formatNumber(request.endDepth)}</TableCell>
                          <TableCell>{request.affectedSamples}</TableCell>
                          <TableCell><Badge variant="outline">{request.mode}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </TabsContent>
            </Tabs>
          ) : (
            <PlaceholderNote>Select a backend memory file, review its points, then choose source and target fields before previewing correlation.</PlaceholderNote>
          )}
        </WorkspaceSection>
      ) : null}

      <WorkspaceSection
        title="Memory Correlations"
        description="History from GET /api/memory-files/correlations. Apply correlation refreshes this list and active MWD data."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadBackendCorrelations()} disabled={!token}>
            <RefreshCw className="mr-2 size-4" />
            Refresh Correlations
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Matched</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backendCorrelations.slice(0, 8).map((correlation) => (
                <TableRow key={correlation.id}>
                  <TableCell>{correlation.status ?? "-"}</TableCell>
                  <TableCell>{correlation.matchedCount ?? "-"}</TableCell>
                  <TableCell>{correlation.skippedCount ?? correlation.unmatchedCount ?? "-"}</TableCell>
                  <TableCell>{correlation.updatedCount ?? correlation.affectedRows ?? "-"}</TableCell>
                  <TableCell className="max-w-[520px] truncate text-sm text-muted-foreground">
                    {correlation.summary}
                  </TableCell>
                </TableRow>
              ))}
              {backendCorrelations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Belum ada memory correlation
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </WorkspaceSection>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5 sm:p-3">
      <div className="text-[11px] text-muted-foreground sm:text-xs">{label}</div>
      <div className="mt-0.5 break-words text-xs font-semibold leading-snug sm:mt-1 sm:text-sm">{value}</div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
        <Icon className="size-3.5 sm:size-4" />
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold leading-snug sm:mt-2 sm:text-base">{value}</div>
    </Card>
  );
}
