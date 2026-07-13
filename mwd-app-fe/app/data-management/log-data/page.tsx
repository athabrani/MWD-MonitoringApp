"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Filter,
  GitCompare,
  History,
  MoveHorizontal,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
import {
  LogDataChannelSummary,
  LogDataMemoryImportPanel,
} from "@/components/contents/data-management/log-data-memory-import-panel";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { PlaceholderNote, WorkspaceSection } from "@/components/layouts/workspace-section";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api-client";
import {
  buildLogDataImportBatch,
  buildLogDataImportRequests,
  LogDataImportBatch,
} from "@/lib/log-data-import";
import { deleteMwdData, filterMwdDataForSession, getMwdData, MwdDataInput, MwdDataRecord, postRawMwdData } from "@/lib/mwd-data-api";
import {
  applyCopyMwdDepth,
  applyMoveMwdDepth,
  applyRescaleMwdData,
  deleteMwdDepthRange,
  getMwdEditOperations,
  hideMwdDepthRange,
  MwdEditMoveDepthApplyPayload,
  MwdEditMoveDepthPreviewQuery,
  MwdEditCopyDepthPayload,
  MwdEditOperation,
  MwdEditPreviewResult,
  MwdEditRescalePayload,
  previewCopyMwdDepth,
  previewMoveMwdDepth,
  previewRescaleMwdData,
  unhideMwdDepthRange,
} from "@/lib/mwd-edit-tools-api";
import { getWitsConfig, getWitsDataValues, WitsDataValue } from "@/lib/api/wits";
import { logSecurityError } from "@/lib/security/errors";
import { formatConfiguredWitsId } from "@/lib/wits-config-store";
import { DepthRange, LogDataRecord, RescaleMode, RescalePreview, RescaleRequest, RescaleResultSummary } from "@/types/monitoring";
import { PolarisWitsId } from "@/types/polaris";
import { cn } from "@/lib/utils";

function withinRange(depth: number, range: DepthRange) {
  return depth >= range.startDepth && depth <= range.endDepth;
}

function formatRescaleMode(mode: RescaleMode) {
  return mode === "example-value" ? "Example value" : "Percentage";
}

function waitForImportPacing(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function postRawMwdDataWithRetry(
  token: string,
  input: MwdDataInput,
  options: {
    maxAttempts: number;
    onRetry?: (retry: { attempt: number; maxAttempts: number; delayMs: number }) => void;
  },
) {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      await postRawMwdData(token, input);
      return;
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 429 || attempt >= options.maxAttempts) {
        throw error;
      }

      const delayMs = error.retryAfterMs ?? Math.min(1_000 * attempt, 5_000);
      options.onRetry?.({ attempt, maxAttempts: options.maxAttempts, delayMs });
      await waitForImportPacing(delayMs);
    }
  }
}

const LOG_IMPORT_POST_PACING_MS = 250;
const LOG_IMPORT_RATE_LIMIT_COOLDOWN_MS = 15_000;

type LogDataViewMode = "list" | "detail";

type LogDataActionDialog = "import" | "memory" | "batch" | "delete-range" | "export";
type LogEditorTool = "edit" | "delete-depths" | "move-depths" | "copy-depths" | "rescale" | "import";
type EditPreviewKind = "move-depths" | "copy-depths" | "rescale";
type EditActionKind = "hide-range" | "unhide-range" | "delete-depth-range" | EditPreviewKind | "operations";

type ActiveEditPreview = {
  kind: EditPreviewKind;
  request: MwdEditMoveDepthApplyPayload | MwdEditCopyDepthPayload | MwdEditRescalePayload;
  result: MwdEditPreviewResult;
};

type LogImportCommitResult = {
  importedValues: number;
  failedValues: number;
  postedRequests: number;
  totalRequests: number;
  fileErrors: Array<{ fileName: string; row: number; reason: string }>;
};

type LogImportProgress = {
  phase: "idle" | "preparing" | "importing" | "retrying" | "refreshing" | "complete";
  message: string;
  currentRequest: number;
  totalRequests: number;
  importedValues: number;
};

type GroupedLogChannel = {
  key: string;
  label: string;
  channels: LogDataChannelSummary[];
};

const WITS_GROUP_LABELS: Record<string, string> = {
  "00": "System",
  "01": "Rig / Surface",
  "07": "Directional",
  "08": "Formation",
  "09": "Mechanical",
  "57": "Records (relog)",
  "58": "Records (relog)",
  "64": "Records",
  "66": "Records",
  "77": "Records",
  "88": "Records",
  "99": "Records",
};

const WITS_GROUP_ORDER = ["00", "01", "07", "08", "09", "57", "58", "64", "66", "77", "88", "99", "other"];

const LOG_EDITOR_TOOLS: Array<{ value: LogEditorTool; label: string; description: string }> = [
  {
    value: "edit",
    label: "Edit Data",
    description: "Edit data values between the starting depth and the ending depth.",
  },
  {
    value: "delete-depths",
    label: "Delete Depths",
    description: "Delete data by depth range.",
  },
  {
    value: "move-depths",
    label: "Move Depths",
    description: "Move data from one depth range to another.",
  },
  {
    value: "copy-depths",
    label: "Copy Depths",
    description: "Copy data from one depth range to another.",
  },
  {
    value: "rescale",
    label: "Rescale Data",
    description: "Rescale data values within the selected depth range.",
  },
  {
    value: "import",
    label: "Import Data",
    description: "Import data into the selected WITS ID or log context.",
  },
];

function getWitsGroupKey(witsId: string) {
  const prefix = witsId.padStart(4, "0").slice(0, 2);
  return WITS_GROUP_LABELS[prefix] ? prefix : "other";
}

function getWitsGroupLabel(groupKey: string) {
  return groupKey === "other" ? "Other" : `${groupKey} ${WITS_GROUP_LABELS[groupKey]}`;
}

function groupChannelsByPrefix(channels: LogDataChannelSummary[]): GroupedLogChannel[] {
  const grouped = channels.reduce<Record<string, LogDataChannelSummary[]>>((accumulator, channel) => {
    const groupKey = getWitsGroupKey(channel.witsId);
    if (!accumulator[groupKey]) {
      accumulator[groupKey] = [];
    }
    accumulator[groupKey].push(channel);
    return accumulator;
  }, {});

  return WITS_GROUP_ORDER
    .filter((groupKey) => grouped[groupKey]?.length)
    .map((groupKey) => ({
      key: groupKey,
      label: getWitsGroupLabel(groupKey),
      channels: grouped[groupKey].sort((left, right) => left.witsId.localeCompare(right.witsId)),
    }));
}

function formatOptionalDepth(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
}

function formatOptionalTimestamp(value?: Date) {
  return value ? value.toISOString() : new Date(0).toISOString();
}

function getRangeValidationError(range: DepthRange) {
  if (!Number.isFinite(range.startDepth) || !Number.isFinite(range.endDepth)) {
    return "Start depth and end depth must be valid numbers.";
  }
  if (range.startDepth > range.endDepth) {
    return "Start depth must be less than or equal to end depth.";
  }

  return "";
}

function formatPreviewValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(3);
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return "-";
}

function formatOperationDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd MMM HH:mm");
}

function summarizePreviewRows(result: MwdEditPreviewResult) {
  if (result.rows.length > 0) return result.rows.slice(0, 8);
  if (result.raw && typeof result.raw === "object" && !Array.isArray(result.raw)) {
    return [result.raw as Record<string, unknown>];
  }

  return [];
}

function readPreviewNumber(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function getPreviewAffectedCount(result: MwdEditPreviewResult) {
  return (
    readPreviewNumber(result.raw, [
      "affectedCount",
      "affected_count",
      "affectedRows",
      "affected_rows",
      "count",
      "total",
    ]) ?? result.rows.length
  );
}

function witsDataValueToLogRecord(value: WitsDataValue, config?: PolarisWitsId): LogDataRecord {
  const witsId = value.witsId.padStart(4, "0");
  const timestamp = formatOptionalTimestamp(value.timestamp);
  const depth = typeof value.depth === "number" && Number.isFinite(value.depth) ? value.depth : 0;

  return {
    id: value.id ?? `${witsId}-${timestamp}-${depth}`,
    witsId,
    witsConfigId: value.witsConfigId,
    mwdDataId: value.mwdDataId,
    sessionId: value.sessionId,
    label: config?.name || value.label || `WITS ${witsId}`,
    depth,
    value: value.value,
    timestamp,
    hidden: false,
    source: "WITS Data Values API",
    notes: [
      value.sessionId ? `Session ${value.sessionId}` : "",
      value.depth === undefined ? "Depth missing from response" : "",
    ]
      .filter(Boolean)
      .join(" | "),
  };
}

export default function LogDataPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { activeMwdSessionId, refreshMwdData, refreshWitsDataValues, beginBackendImportActivity, endBackendImportActivity } = useApp();
  const folderImportInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<LogDataRecord[]>([]);
  const [configuredWitsIds, setConfiguredWitsIds] = useState<PolarisWitsId[]>([]);
  const [mwdDataRecords, setMwdDataRecords] = useState<MwdDataRecord[]>([]);
  const [witsDataValues, setWitsDataValues] = useState<WitsDataValue[]>([]);
  const [witsConfigLoading, setWitsConfigLoading] = useState(false);
  const [mwdDataLoading, setMwdDataLoading] = useState(false);
  const [witsValuesLoading, setWitsValuesLoading] = useState(false);
  const [editOperations, setEditOperations] = useState<MwdEditOperation[]>([]);
  const [editOperationsLoading, setEditOperationsLoading] = useState(false);
  const [witsConfigError, setWitsConfigError] = useState("");
  const [mwdDataError, setMwdDataError] = useState("");
  const [witsValuesError, setWitsValuesError] = useState("");
  const [editOperationsError, setEditOperationsError] = useState("");
  const [editToolError, setEditToolError] = useState("");
  const [activeEditAction, setActiveEditAction] = useState<EditActionKind | null>(null);
  const [activeEditPreview, setActiveEditPreview] = useState<ActiveEditPreview | null>(null);
  const [mwdDeletingId, setMwdDeletingId] = useState("");
  const [search, setSearch] = useState("");
  const [logDataViewMode, setLogDataViewMode] = useState<LogDataViewMode>("list");
  const [activeActionDialog, setActiveActionDialog] = useState<LogDataActionDialog | null>(null);
  const [selectedWitsId, setSelectedWitsId] = useState<string>("");
  const [selectedToolWitsIds, setSelectedToolWitsIds] = useState<string[]>([]);
  const [activeLogTab, setActiveLogTab] = useState<LogEditorTool>("edit");
  const [selectedRange, setSelectedRange] = useState<DepthRange>({ startDepth: 3810, endDepth: 3840 });
  const [valueFilter, setValueFilter] = useState({ min: 0, max: 9999 });
  const [moveOffset, setMoveOffset] = useState(5);
  const [copyOffset, setCopyOffset] = useState(10);
  const [rescaleMode, setRescaleMode] = useState<RescaleMode>("example-value");
  const [originalExampleValue, setOriginalExampleValue] = useState(80);
  const [desiredExampleValue, setDesiredExampleValue] = useState(95);
  const [rescalePercentage, setRescalePercentage] = useState(10);
  const [importFileName, setImportFileName] = useState("");
  const [logImportBatch, setLogImportBatch] = useState<LogDataImportBatch | null>(null);
  const [logImportError, setLogImportError] = useState("");
  const [logImportScanning, setLogImportScanning] = useState(false);
  const [logImportCommitting, setLogImportCommitting] = useState(false);
  const [logImportCommitResult, setLogImportCommitResult] = useState<LogImportCommitResult | null>(null);
  const [logImportProgress, setLogImportProgress] = useState<LogImportProgress>({
    phase: "idle",
    message: "",
    currentRequest: 0,
    totalRequests: 0,
    importedValues: 0,
  });
  const [exportFileType, setExportFileType] = useState("LAS");
  const [exportScope, setExportScope] = useState("selected");
  const [exportIncludeHidden, setExportIncludeHidden] = useState(false);
  const canManageMwdData = user?.role === "engineer" || user?.role === "admin";

  const loadBackendLogData = useCallback(async () => {
    if (!token) {
      setWitsConfigError("");
      setMwdDataError("");
      setWitsValuesError("");
      return;
    }

    setWitsConfigLoading(true);
    setMwdDataLoading(true);
    setWitsValuesLoading(true);
    setWitsConfigError("");
    setMwdDataError("");
    setWitsValuesError("");

    const [configResult, mwdResult, valuesResult] = await Promise.allSettled([
      getWitsConfig(token),
      getMwdData(token, activeMwdSessionId ? { sessionId: activeMwdSessionId } : {}),
      getWitsDataValues(token, activeMwdSessionId ? { sessionId: activeMwdSessionId, limit: 5000 } : { limit: 5000 }),
    ]);

    let nextConfigs: PolarisWitsId[] = [];

    if (configResult.status === "fulfilled") {
      nextConfigs = configResult.value;
      setConfiguredWitsIds(configResult.value);
    } else {
      logSecurityError("Unable to load WITS config.", configResult.reason);
      setConfiguredWitsIds([]);
      setSelectedWitsId("");
      setWitsConfigError("Gagal memuat data dari backend.");
    }
    setWitsConfigLoading(false);

    if (mwdResult.status === "fulfilled") {
      const scopedMwdData = filterMwdDataForSession(mwdResult.value, activeMwdSessionId);
      setMwdDataRecords(scopedMwdData);
    } else {
      logSecurityError("Unable to load MWD data.", mwdResult.reason);
      setMwdDataError("Gagal memuat data dari backend.");
    }
    setMwdDataLoading(false);

    if (valuesResult.status === "fulfilled") {
      const configByWitsId = new Map(
        nextConfigs.map((config) => [formatConfiguredWitsId(config.numericId), config])
      );
      const scopedValues = activeMwdSessionId
        ? valuesResult.value.filter((value) => !value.sessionId || value.sessionId === activeMwdSessionId)
        : valuesResult.value;

      setWitsDataValues(scopedValues);
      setRecords(scopedValues.map((value) => witsDataValueToLogRecord(value, configByWitsId.get(value.witsId))));
      setSelectedWitsId((current) => {
        if (current && scopedValues.some((value) => value.witsId === current)) return current;
        return scopedValues[0]?.witsId ?? (nextConfigs[0] ? formatConfiguredWitsId(nextConfigs[0].numericId) : "");
      });
    } else {
      logSecurityError("Unable to load WITS data values.", valuesResult.reason);
      setWitsValuesError("Gagal memuat data dari backend.");
    }
    setWitsValuesLoading(false);
  }, [activeMwdSessionId, token]);

  const loadEditOperations = useCallback(async () => {
    if (!token || !canManageMwdData) {
      setEditOperations([]);
      setEditOperationsError("");
      return;
    }

    setEditOperationsLoading(true);
    setEditOperationsError("");

    try {
      setEditOperations(await getMwdEditOperations(token, activeMwdSessionId ? { sessionId: activeMwdSessionId } : {}));
    } catch (error) {
      logSecurityError("Unable to load MWD edit operations.", error);
      setEditOperationsError("Gagal memuat data dari backend.");
    } finally {
      setEditOperationsLoading(false);
    }
  }, [activeMwdSessionId, canManageMwdData, token]);

  useEffect(() => {
    void loadBackendLogData();
  }, [loadBackendLogData]);

  useEffect(() => {
    void loadEditOperations();
  }, [loadEditOperations]);

  useEffect(() => {
    setActiveEditPreview(null);
  }, [
    activeLogTab,
    copyOffset,
    desiredExampleValue,
    moveOffset,
    originalExampleValue,
    rescaleMode,
    rescalePercentage,
    selectedRange.endDepth,
    selectedRange.startDepth,
    selectedWitsId,
  ]);

  const handleDeleteMwdRecord = async (record: MwdDataRecord) => {
    if (!token || !record.id) {
      toast.error("MWD data id is missing.");
      return;
    }
    if (!canManageMwdData) {
      toast.warning("Only admin or engineer users can delete MWD data.");
      return;
    }

    setMwdDeletingId(record.id);
    setMwdDataError("");

    try {
      await deleteMwdData(token, record.id);
      toast.success("MWD data row deleted.");
      await loadBackendLogData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete MWD data.";
      setMwdDataError(message);
      toast.error("Unable to delete MWD data", { description: message });
    } finally {
      setMwdDeletingId("");
    }
  };

  const allChannels = useMemo(() => {
    const recordCounts = records.reduce<Record<string, { count: number; hiddenCount: number }>>(
      (accumulator, record) => {
        if (!accumulator[record.witsId]) {
          accumulator[record.witsId] = { count: 0, hiddenCount: 0 };
        }
        accumulator[record.witsId].count += 1;
        if (record.hidden) {
          accumulator[record.witsId].hiddenCount += 1;
        }
        return accumulator;
      },
      {}
    );

    return configuredWitsIds.map<LogDataChannelSummary>((config) => {
      const witsId = formatConfiguredWitsId(config.numericId);
      const counts = recordCounts[witsId];
      return {
        witsId,
        mappedField: config.mappedField,
        label: config.name || `WITS ${witsId}`,
        units: config.units,
        enabled: config.enabled,
        count: counts?.count ?? 0,
        hiddenCount: counts?.hiddenCount ?? 0,
        decimalPlaces: config.decimalPlaces,
        scaleFactor: config.scaleFactor,
        sensorSpacing: config.sensorToBitSpacing,
        lasMnemonic: config.lasMnemonic,
        alarmEnabled: config.alarmEnabled,
        alarmLow: config.alarmLow,
        alarmHigh: config.alarmHigh,
        plotName: config.realTimePlot,
        isMemoryStorage: config.useForMemoryImportStorage,
        hasRecords: Boolean(counts?.count),
      };
    });
  }, [configuredWitsIds, records]);

  const channels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return allChannels;
    }

    return allChannels.filter(
      (channel) =>
        channel.witsId.toLowerCase().includes(query) ||
        channel.label.toLowerCase().includes(query) ||
        channel.units.toLowerCase().includes(query) ||
        channel.lasMnemonic.toLowerCase().includes(query)
    );
  }, [allChannels, search]);

  const groupedChannels = useMemo(() => groupChannelsByPrefix(channels), [channels]);

  const selectedChannel = useMemo(
    () => allChannels.find((channel) => channel.witsId === selectedWitsId) ?? allChannels[0] ?? null,
    [allChannels, selectedWitsId]
  );

  const selectedToolChannels = useMemo(
    () => allChannels.filter((channel) => selectedToolWitsIds.includes(channel.witsId)),
    [allChannels, selectedToolWitsIds]
  );

  const channelRecords = useMemo(() => {
    if (!selectedChannel) {
      return [];
    }

    return records
      .filter((record) => record.witsId === selectedChannel.witsId)
      .filter((record) => record.value >= valueFilter.min && record.value <= valueFilter.max)
      .sort((left, right) => left.depth - right.depth);
  }, [records, selectedChannel, valueFilter.max, valueFilter.min]);

  const channelDepthRanges = useMemo(() => {
    return records.reduce<Record<string, { min: number; max: number }>>((accumulator, record) => {
      const current = accumulator[record.witsId];
      if (!current) {
        accumulator[record.witsId] = { min: record.depth, max: record.depth };
        return accumulator;
      }

      accumulator[record.witsId] = {
        min: Math.min(current.min, record.depth),
        max: Math.max(current.max, record.depth),
      };
      return accumulator;
    }, {});
  }, [records]);

  const visibleLogEditorTools = canManageMwdData
    ? LOG_EDITOR_TOOLS
    : LOG_EDITOR_TOOLS.filter((tool) => tool.value === "edit");
  const activeTool =
    visibleLogEditorTools.find((tool) => tool.value === activeLogTab) ?? visibleLogEditorTools[0];
  const rangeValidationError = getRangeValidationError(selectedRange);
  const hasActiveEditSession = Boolean(activeMwdSessionId);
  const canPreviewEditTools = canManageMwdData && Boolean(token) && hasActiveEditSession && !rangeValidationError;
  const canPreviewRescaleTools = canPreviewEditTools && Boolean(selectedChannel);
  const canApplyEditTools = canPreviewEditTools && canManageMwdData;
  const canApplyRescaleTools = canPreviewRescaleTools && canManageMwdData;
  const editToolValidationMessage = !hasActiveEditSession
    ? "Select an active MWD session before using edit tools."
    : rangeValidationError || editToolError;
  const activePreviewRows = activeEditPreview ? summarizePreviewRows(activeEditPreview.result) : [];
  const activePreviewAffectedCount = activeEditPreview ? getPreviewAffectedCount(activeEditPreview.result) : 0;

  const latestMwdRecord = useMemo(
    () =>
      mwdDataRecords.reduce<MwdDataRecord | null>((latest, record) => {
        if (!latest) return record;
        return record.timestamp.getTime() > latest.timestamp.getTime() ? record : latest;
      }, null),
    [mwdDataRecords]
  );
  const recentMwdRecords = useMemo(
    () =>
      [...mwdDataRecords]
        .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
        .slice(0, 8),
    [mwdDataRecords]
  );

  const logDataLoading = witsConfigLoading || mwdDataLoading || witsValuesLoading;
  const logDataErrors = [witsConfigError, mwdDataError, witsValuesError].filter(Boolean);

  const rescaleScaleFactor = useMemo(() => {
    if (rescaleMode === "example-value") {
      if (originalExampleValue === 0) {
        return 0;
      }

      return desiredExampleValue / originalExampleValue;
    }

    return 1 + rescalePercentage / 100;
  }, [desiredExampleValue, originalExampleValue, rescaleMode, rescalePercentage]);

  const rescaleAffectedRecords = useMemo(() => {
    if (!selectedChannel) {
      return [];
    }

    return records
      .filter((record) => record.witsId === selectedChannel.witsId && withinRange(record.depth, selectedRange))
      .sort((left, right) => left.depth - right.depth);
  }, [records, selectedChannel, selectedRange]);

  const rescalePreview: RescalePreview[] = useMemo(
    () =>
      rescaleAffectedRecords.slice(0, 8).map((record) => ({
        recordId: record.id,
        depth: record.depth,
        beforeValue: record.value,
        afterValue: Number((record.value * rescaleScaleFactor).toFixed(3)),
      })),
    [rescaleAffectedRecords, rescaleScaleFactor]
  );

  const rescaleRequest: RescaleRequest | null = selectedChannel
    ? {
        channelWitsId: selectedChannel.witsId,
        mode: rescaleMode,
        startDepth: selectedRange.startDepth,
        endDepth: selectedRange.endDepth,
        scaleFactor: rescaleScaleFactor,
        originalExampleValue: rescaleMode === "example-value" ? originalExampleValue : undefined,
        desiredExampleValue: rescaleMode === "example-value" ? desiredExampleValue : undefined,
        percentage: rescaleMode === "percentage" ? rescalePercentage : undefined,
      }
    : null;

  const rescaleSummary: RescaleResultSummary | null = rescaleRequest
    ? {
        channelWitsId: rescaleRequest.channelWitsId,
        mode: rescaleRequest.mode,
        scaleFactor: rescaleRequest.scaleFactor,
        startDepth: rescaleRequest.startDepth,
        endDepth: rescaleRequest.endDepth,
        affectedRows: rescaleAffectedRecords.length,
      }
    : null;

  const canApplyRescale =
    Boolean(selectedChannel) &&
    Number.isFinite(rescaleScaleFactor) &&
    rescaleScaleFactor > 0;

  const updateSelectedRange = (key: keyof DepthRange, value: number) => {
    setSelectedRange((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openActionDialog = (action: LogDataActionDialog) => {
    if (!canManageMwdData && action !== "export") {
      toast.warning("Operator role can view log data only.");
      return;
    }

    if (selectedToolWitsIds.length === 0 && selectedChannel) {
      setSelectedToolWitsIds([selectedChannel.witsId]);
    }
    setActiveActionDialog(action);
  };

  const toggleToolWitsId = (witsId: string) => {
    setSelectedToolWitsIds((current) =>
      current.includes(witsId) ? current.filter((item) => item !== witsId) : [...current, witsId]
    );
  };

  const requireEditToolPreviewAccess = (options: { requireChannel?: boolean } = {}) => {
    if (!token) {
      const message = "Sign in before using MWD edit tools.";
      setEditToolError(message);
      toast.error(message);
      return false;
    }
    if (!activeMwdSessionId) {
      const message = "Select an active MWD session before using edit tools.";
      setEditToolError(message);
      toast.error(message);
      return false;
    }
    if (options.requireChannel && !selectedChannel) {
      const message = "Select a WITS ID first.";
      setEditToolError(message);
      toast.error(message);
      return false;
    }
    if (rangeValidationError) {
      setEditToolError(rangeValidationError);
      toast.error(rangeValidationError);
      return false;
    }

    return true;
  };

  const requireEditToolApplyAccess = (options: { requireChannel?: boolean } = {}) => {
    if (!requireEditToolPreviewAccess(options)) return false;
    if (!canManageMwdData) {
      const message = "Only admin or engineer users can apply MWD edit tools.";
      setEditToolError(message);
      toast.warning(message);
      return false;
    }

    return true;
  };

  const buildDepthRangePayload = (note?: string) => {
    if (!activeMwdSessionId) return null;
    return {
      sessionId: activeMwdSessionId,
      depthMin: selectedRange.startDepth,
      depthMax: selectedRange.endDepth,
      note,
    };
  };

  const buildMovePreviewQuery = (): MwdEditMoveDepthPreviewQuery | null => {
    const basePayload = buildDepthRangePayload();
    if (!basePayload) return null;
    if (!Number.isFinite(moveOffset)) {
      setEditToolError("Move offset must be a valid number.");
      toast.error("Move offset must be a valid number.");
      return null;
    }

    return {
      sessionId: basePayload.sessionId,
      depthMin: basePayload.depthMin,
      depthMax: basePayload.depthMax,
      targetStartDepth: Number((selectedRange.startDepth + moveOffset).toFixed(3)),
    };
  };

  const buildMoveApplyPayload = (): MwdEditMoveDepthApplyPayload | null => {
    const basePayload = buildDepthRangePayload("move interval");
    if (!basePayload) return null;
    if (!Number.isFinite(moveOffset)) {
      setEditToolError("Move offset must be a valid number.");
      toast.error("Move offset must be a valid number.");
      return null;
    }

    return {
      ...basePayload,
      depthOffset: moveOffset,
    };
  };

  const buildCopyPayload = (): MwdEditCopyDepthPayload | null => {
    const basePayload = buildDepthRangePayload();
    if (!basePayload) return null;
    if (!Number.isFinite(copyOffset)) {
      setEditToolError("Copy offset must be a valid number.");
      toast.error("Copy offset must be a valid number.");
      return null;
    }

    return {
      sessionId: basePayload.sessionId,
      depthMin: basePayload.depthMin,
      depthMax: basePayload.depthMax,
      targetStartDepth: Number((selectedRange.startDepth + copyOffset).toFixed(3)),
      measuredAtOffsetMs: 0,
    };
  };

  const buildRescalePayload = (): MwdEditRescalePayload | null => {
    const basePayload = buildDepthRangePayload();
    if (!basePayload) return null;
    const field = selectedChannel?.mappedField?.trim();

    if (!field) {
      const message = "Selected WITS ID has no mappedField. Rescale requires an MWD data field.";
      setEditToolError(message);
      toast.error(message);
      return null;
    }
    if (!Number.isFinite(rescaleScaleFactor) || rescaleScaleFactor <= 0) {
      const message = "Scale factor must be greater than 0.";
      setEditToolError(message);
      toast.error(message);
      return null;
    }

    return {
      ...basePayload,
      field,
      scaleFactor: rescaleScaleFactor,
      biasOffset: 0,
    };
  };

  const refreshAfterEditApply = async () => {
    await Promise.all([
      loadBackendLogData(),
      loadEditOperations(),
      refreshMwdData(),
      refreshWitsDataValues(),
    ]);
  };

  const refreshAfterLogImport = async () => {
    if (!token) return;

    setWitsValuesLoading(true);
    setWitsValuesError("");
    try {
      const values = await getWitsDataValues(
        token,
        activeMwdSessionId ? { sessionId: activeMwdSessionId, limit: 5000 } : { limit: 5000 }
      );
      const configByWitsId = new Map(
        configuredWitsIds.map((config) => [formatConfiguredWitsId(config.numericId), config])
      );
      const scopedValues = activeMwdSessionId
        ? values.filter((value) => !value.sessionId || value.sessionId === activeMwdSessionId)
        : values;

      setWitsDataValues(scopedValues);
      setRecords(scopedValues.map((value) => witsDataValueToLogRecord(value, configByWitsId.get(value.witsId))));
      setSelectedWitsId((current) => {
        if (current && scopedValues.some((value) => value.witsId === current)) return current;
        return scopedValues[0]?.witsId ?? current;
      });
    } catch (error) {
      logSecurityError("Unable to refresh WITS data values after import.", error);
      setWitsValuesError("Gagal memuat ulang data import dari backend.");
    } finally {
      setWitsValuesLoading(false);
    }
  };

  const handleLogDataImportSelection = async (input: FileList | File[], preferredWitsId?: string) => {
    const files = Array.from(input);
    setImportFileName(files.map((file) => file.name).join(", "));
    setLogImportBatch(null);
    setLogImportCommitResult(null);
    setLogImportProgress({
      phase: "idle",
      message: "",
      currentRequest: 0,
      totalRequests: 0,
      importedValues: 0,
    });
    setLogImportError("");

    if (files.length === 0) return;

    setLogImportScanning(true);
    try {
      const batch = await buildLogDataImportBatch(files, configuredWitsIds, { preferredWitsId });
      setLogImportBatch(batch);

      if (batch.totalImportableValues === 0) {
        toast.warning("No importable WITS values found.", {
          description: "Review unmapped/skipped files before importing.",
        });
      } else {
        toast.success("CSV source scan complete", {
          description: `${batch.mappedFiles.length} mapped file(s), ${batch.totalImportableValues} importable value(s).`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to scan selected import sources.";
      setLogImportError(message);
      toast.error("Unable to scan import sources", { description: message });
    } finally {
      setLogImportScanning(false);
    }
  };

  const openFolderImportPicker = () => {
    const input = folderImportInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.click();
  };

  const handleCommitLogDataImport = async () => {
    if (!token) {
      toast.error("Sign in before importing Log Data.");
      return;
    }
    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before importing Log Data.");
      return;
    }
    if (!logImportBatch || logImportBatch.totalImportableValues === 0) {
      toast.error("No mapped CSV rows are ready to import.");
      return;
    }

    setLogImportCommitting(true);
    setLogImportError("");
    setLogImportCommitResult(null);
    beginBackendImportActivity();
    const fileErrors: LogImportCommitResult["fileErrors"] = [];
    let importedValues = 0;
    let postedRequests = 0;

    try {
      setLogImportProgress({
        phase: "preparing",
        message: "Preparing grouped WITS import requests...",
        currentRequest: 0,
        totalRequests: 0,
        importedValues: 0,
      });

      const requests = buildLogDataImportRequests(activeMwdSessionId, logImportBatch);
      setLogImportProgress({
        phase: "importing",
        message: `Processing grouped import request 1 of ${requests.length}.`,
        currentRequest: requests.length > 0 ? 1 : 0,
        totalRequests: requests.length,
        importedValues: 0,
      });

      for (const [index, request] of requests.entries()) {
        const currentRequest = index + 1;

        setLogImportProgress((current) => ({
          ...current,
          phase: "importing",
          message: `Processing grouped import request ${currentRequest} of ${requests.length}.`,
          currentRequest,
          totalRequests: requests.length,
        }));

        try {
          await postRawMwdDataWithRetry(token, request.payload, {
            maxAttempts: 8,
            onRetry: ({ attempt, maxAttempts, delayMs }) => {
              setLogImportProgress((current) => ({
                ...current,
                phase: "retrying",
                message: `Backend rate limit reached. Retrying request ${currentRequest} of ${requests.length} in ${Math.ceil(delayMs / 1000)}s (${attempt}/${maxAttempts}).`,
                currentRequest,
                totalRequests: requests.length,
              }));
            },
          });
          postedRequests += 1;
          importedValues += request.entries.length;
          setLogImportProgress((current) => ({
            ...current,
            phase: "importing",
            importedValues,
            message: `Imported ${importedValues} of ${logImportBatch.totalImportableValues} WITS value(s).`,
          }));
          if (currentRequest < requests.length) {
            await waitForImportPacing(LOG_IMPORT_POST_PACING_MS);
          }
        } catch (error) {
          for (const entry of request.entries) {
            fileErrors.push({
              fileName: entry.file.source.fileName,
              row: entry.value.sourceRow,
              reason: error instanceof Error ? error.message : "Backend import failed.",
            });
          }
          if (error instanceof ApiClientError && error.status === 429 && currentRequest < requests.length) {
            setLogImportProgress((current) => ({
              ...current,
              phase: "retrying",
              message: `Backend is still rate limiting. Cooling down for ${Math.ceil(LOG_IMPORT_RATE_LIMIT_COOLDOWN_MS / 1000)}s before continuing.`,
              currentRequest,
              totalRequests: requests.length,
            }));
            await waitForImportPacing(LOG_IMPORT_RATE_LIMIT_COOLDOWN_MS);
          }
        }
      }

      const failedValues = logImportBatch.totalImportableValues - importedValues;
      setLogImportCommitResult({ importedValues, failedValues, postedRequests, totalRequests: requests.length, fileErrors });

      if (importedValues > 0) {
        setLogImportProgress({
          phase: "refreshing",
          message: "Finalizing import and refreshing WITS values...",
          currentRequest: requests.length,
          totalRequests: requests.length,
          importedValues,
        });
        await refreshAfterLogImport();
        setLogImportProgress({
          phase: "complete",
          message: `Completed ${postedRequests} backend request(s) for ${importedValues} WITS value(s).`,
          currentRequest: requests.length,
          totalRequests: requests.length,
          importedValues,
        });
        if (failedValues === 0) {
          toast.success("Import completed", {
            description: `All ${importedValues} WITS value(s) were sent through ${postedRequests} grouped request(s).`,
          });
        } else {
          toast.warning("Import partially completed", {
            description: `${importedValues} value(s) sent, ${failedValues} value(s) failed. Review import result details.`,
          });
        }
      } else {
        setLogImportProgress({
          phase: "complete",
          message: "Import finished without stored WITS values. Review failed rows.",
          currentRequest: requests.length,
          totalRequests: requests.length,
          importedValues,
        });
        toast.error("Log Data import failed", {
          description: "No WITS values were stored. Review import result details.",
        });
      }

    } finally {
      endBackendImportActivity();
      setLogImportCommitting(false);
    }
  };

  const handleHideRange = async () => {
    if (!requireEditToolApplyAccess()) return;
    const payload = buildDepthRangePayload("bad sensor interval");
    if (!payload || !token) return;

    setActiveEditAction("hide-range");
    setEditToolError("");

    try {
      await hideMwdDepthRange(token, payload);
      toast.success("Selected depth range hidden.");
      await refreshAfterEditApply();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to hide depth range.";
      setEditToolError(message);
      toast.error("Unable to hide depth range", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handleUnhideRange = async () => {
    if (!requireEditToolApplyAccess()) return;
    const payload = buildDepthRangePayload("restore interval");
    if (!payload || !token) return;

    setActiveEditAction("unhide-range");
    setEditToolError("");

    try {
      await unhideMwdDepthRange(token, payload);
      toast.success("Selected depth range unhidden.");
      await refreshAfterEditApply();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to unhide depth range.";
      setEditToolError(message);
      toast.error("Unable to unhide depth range", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handleDeleteDepths = async () => {
    if (!requireEditToolApplyAccess()) return;
    const payload = buildDepthRangePayload("delete bad interval");
    if (!payload || !token) return;

    setActiveEditAction("delete-depth-range");
    setEditToolError("");

    try {
      await deleteMwdDepthRange(token, payload);
      toast.success("Selected depth range deleted.");
      setActiveActionDialog(null);
      await refreshAfterEditApply();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete depth range.";
      setEditToolError(message);
      toast.error("Unable to delete depth range", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handleDialogDeleteDepths = () => {
    const targetWitsIds = selectedToolWitsIds.length > 0 ? selectedToolWitsIds : selectedChannel ? [selectedChannel.witsId] : [];
    if (targetWitsIds.length === 0) {
      toast.error("Select at least one WITS ID before deleting depths");
      return;
    }

    void handleDeleteDepths();
  };

  const handlePreviewMoveDepths = async () => {
    if (!requireEditToolPreviewAccess()) return;
    const previewQuery = buildMovePreviewQuery();
    const applyPayload = buildMoveApplyPayload();
    if (!previewQuery || !applyPayload || !token) return;

    setActiveEditAction("move-depths");
    setEditToolError("");

    try {
      const result = await previewMoveMwdDepth(token, previewQuery);
      setActiveEditPreview({ kind: "move-depths", request: applyPayload, result });
      toast.success("Move depth preview loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview move depth.";
      setEditToolError(message);
      toast.error("Unable to preview move depth", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handleApplyMoveDepths = async () => {
    if (!requireEditToolApplyAccess() || activeEditPreview?.kind !== "move-depths" || !token) return;

    setActiveEditAction("move-depths");
    setEditToolError("");

    try {
      await applyMoveMwdDepth(token, activeEditPreview.request as MwdEditMoveDepthApplyPayload);
      toast.success("Move depth applied.");
      setActiveEditPreview(null);
      await refreshAfterEditApply();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to apply move depth.";
      setEditToolError(message);
      toast.error("Unable to apply move depth", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handlePreviewCopyDepths = async () => {
    if (!requireEditToolPreviewAccess()) return;
    const payload = buildCopyPayload();
    if (!payload || !token) return;

    setActiveEditAction("copy-depths");
    setEditToolError("");

    try {
      const result = await previewCopyMwdDepth(token, payload);
      setActiveEditPreview({ kind: "copy-depths", request: payload, result });
      toast.success("Copy depth preview loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview copy depth.";
      setEditToolError(message);
      toast.error("Unable to preview copy depth", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handleApplyCopyDepths = async () => {
    if (!requireEditToolApplyAccess() || activeEditPreview?.kind !== "copy-depths" || !token) return;

    setActiveEditAction("copy-depths");
    setEditToolError("");

    try {
      await applyCopyMwdDepth(token, activeEditPreview.request as MwdEditCopyDepthPayload);
      toast.success("Copy depth applied.");
      setActiveEditPreview(null);
      await refreshAfterEditApply();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to apply copy depth.";
      setEditToolError(message);
      toast.error("Unable to apply copy depth", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handlePreviewRescale = async () => {
    if (!requireEditToolPreviewAccess({ requireChannel: true })) return;
    const payload = buildRescalePayload();
    if (!payload || !token) return;

    setActiveEditAction("rescale");
    setEditToolError("");

    try {
      const result = await previewRescaleMwdData(token, payload);
      setActiveEditPreview({ kind: "rescale", request: payload, result });
      toast.success("Rescale preview loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview rescale.";
      setEditToolError(message);
      toast.error("Unable to preview rescale", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const handleRescale = async () => {
    if (!requireEditToolApplyAccess({ requireChannel: true }) || activeEditPreview?.kind !== "rescale" || !token) {
      toast.error("Load a backend preview before applying rescale.");
      return;
    }

    setActiveEditAction("rescale");
    setEditToolError("");

    try {
      await applyRescaleMwdData(token, activeEditPreview.request as MwdEditRescalePayload);
      toast.success("Rescale applied.");
      setActiveEditPreview(null);
      await refreshAfterEditApply();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to apply rescale.";
      setEditToolError(message);
      toast.error("Unable to apply rescale", { description: message });
    } finally {
      setActiveEditAction(null);
    }
  };

  const content = (
    <div className="space-y-4 sm:space-y-6">
      <input
        ref={folderImportInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden="true"
        onChange={(event) => {
          void handleLogDataImportSelection(Array.from(event.currentTarget.files ?? []), selectedChannel?.witsId);
          event.currentTarget.value = "";
        }}
      />
      {logDataViewMode === "list" ? (
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Log Data</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Review incoming MWD log data, configured WITS IDs, and WITS values derived from MWD data.
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 pr-0.5 sm:gap-2 sm:pr-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 rounded-lg px-0 sm:w-auto sm:px-2.5"
            onClick={() => void loadBackendLogData()}
            disabled={logDataLoading || !token}
            aria-label="Refresh API"
            title="Refresh API"
          >
            <RefreshCw className={cn("size-3.5 sm:mr-1.5", logDataLoading && "animate-spin")} />
            <span className="hidden text-xs sm:inline">Refresh API</span>
          </Button>
          {logDataViewMode === "list" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 rounded-lg px-2.5 text-xs sm:px-3">
                Tools
                <ChevronDown className="ml-1.5 size-3.5" />
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="mr-1 w-[min(18rem,calc(100vw-1.5rem))] border border-border sm:mr-0 sm:w-72">
                <DropdownMenuLabel>Log Data Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
              {canManageMwdData ? (
                <>
                  <DropdownMenuItem onClick={() => openActionDialog("import")}>
                    <FileUp className="mr-2 size-4" />
                    Import data from CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openActionDialog("memory")}>
                    <GitCompare className="mr-2 size-4" />
                    Memory Correlation Editor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openActionDialog("batch")}>
                    <Settings2 className="mr-2 size-4" />
                    Batch Settings Editor
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openActionDialog("delete-range")} className="text-destructive">
                    <Trash2 className="mr-2 size-4" />
                    Delete Depth Range
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onClick={() => openActionDialog("export")}>
                <Download className="mr-2 size-4" />
                Export Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
        </div>
      </div>
      ) : null}

      {logDataViewMode === "list" ? (
        <div className="grid grid-cols-3 gap-1.5 min-[430px]:grid-cols-3 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3">
          <Card className="rounded-xl p-2.5 min-[430px]:p-2 sm:p-3">
            <div className="flex items-center justify-between gap-3 min-[430px]:block sm:block">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-[430px]:text-[10px] sm:text-xs">WITS Config</div>
                <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground sm:hidden">
                  {witsConfigLoading ? "Loading /api/wits-config..." : "Master WITS ID list"}
                </div>
              </div>
              <div className="shrink-0 text-right text-xl font-semibold leading-none min-[430px]:mt-1 min-[430px]:text-left min-[430px]:text-lg sm:mt-1 sm:text-left sm:text-2xl sm:leading-tight">
                {configuredWitsIds.length}
              </div>
            </div>
            <div className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">
              {witsConfigLoading ? "Loading /api/wits-config..." : "Master WITS ID list"}
            </div>
          </Card>
          <Card className="rounded-xl p-2.5 min-[430px]:p-2 sm:p-3">
            <div className="flex items-center justify-between gap-3 min-[430px]:block sm:block">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-[430px]:text-[10px] sm:text-xs">MWD Data</div>
                <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground sm:hidden">
                  {mwdDataLoading
                    ? "Loading /api/mwd-data..."
                    : latestMwdRecord
                      ? `Latest depth ${formatOptionalDepth(latestMwdRecord.depth)}`
                      : "Belum ada data MWD untuk session ini."}
                </div>
              </div>
              <div className="shrink-0 text-right text-xl font-semibold leading-none min-[430px]:mt-1 min-[430px]:text-left min-[430px]:text-lg sm:mt-1 sm:text-left sm:text-2xl sm:leading-tight">
                {mwdDataRecords.length}
              </div>
            </div>
            <div className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">
              {mwdDataLoading
                ? "Loading /api/mwd-data..."
                : latestMwdRecord
                  ? `Latest depth ${formatOptionalDepth(latestMwdRecord.depth)}`
                  : "Belum ada data MWD untuk session ini."}
            </div>
          </Card>
          <Card className="rounded-xl p-2.5 min-[430px]:p-2 sm:col-span-2 sm:p-3 lg:col-span-1">
            <div className="flex items-center justify-between gap-3 min-[430px]:block sm:block">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground min-[430px]:text-[10px] sm:text-xs">
                  <span className="sm:hidden">WITS Values</span>
                  <span className="hidden sm:inline">WITS Data Values</span>
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground sm:hidden">
                  {witsValuesLoading ? "Loading /api/wits-data-values..." : "Values derived from MWD data"}
                </div>
              </div>
              <div className="shrink-0 text-right text-xl font-semibold leading-none min-[430px]:mt-1 min-[430px]:text-left min-[430px]:text-lg sm:mt-1 sm:text-left sm:text-2xl sm:leading-tight">
                {witsDataValues.length}
              </div>
            </div>
            <div className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">
              {witsValuesLoading ? "Loading /api/wits-data-values..." : "Values derived from MWD data"}
            </div>
          </Card>
        </div>
      ) : null}

      {logDataErrors.length > 0 ? (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {logDataErrors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Card>
      ) : null}

      {logDataViewMode === "list" ? (
      <Card className="rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Incoming MWD Data</h2>
          </div>
          <Badge variant="outline">
            {activeMwdSessionId ? `Session ${activeMwdSessionId}` : "All sessions"}
          </Badge>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Depth</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Metrics</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMwdRecords.map((record, index) => (
                <TableRow key={record.id ?? `${record.timestamp.toISOString()}-${index}`}>
                  <TableCell>{formatOptionalDepth(record.depth)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(record.timestamp, "dd MMM HH:mm:ss")}
                  </TableCell>
                  <TableCell>{record.sessionId ?? "-"}</TableCell>
                  <TableCell>{record.status ?? "-"}</TableCell>
                  <TableCell className="max-w-[420px] truncate font-mono text-xs">
                    {Object.entries(record.metrics)
                      .slice(0, 6)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" | ") || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManageMwdData ? (
                      <ConfirmDeleteButton
                        title="Delete MWD data row?"
                        description={`MWD row ${record.id ?? "without id"} will be deleted. WITS data values are refreshed after deletion.`}
                        size="sm"
                        variant="ghost"
                        disabled={!record.id || mwdDeletingId === record.id}
                        onConfirm={() => void handleDeleteMwdRecord(record)}
                      />
                    ) : (
                      <Badge variant="outline">Read only</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!mwdDataLoading && recentMwdRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Belum ada data MWD untuk session ini.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
      ) : null}

      

      <WorkspaceSection
        title={logDataViewMode === "list" ? "WITS ID Browser" : "Log Data Editor"}
        description={
          logDataViewMode === "list"
            ? "Browse configured WITS IDs by category, then select one channel to open its log data workflow."
            : "Inspect and manipulate stored values for the selected WITS channel."
        }
        badge="Backend API"
      >
        {logDataViewMode === "list" ? (
          <div className="space-y-4">
            <Card className="rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Configured WITS IDs</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select one WITS ID to open its log editor, import tools, range tools, and batch workflow.
                  </p>
                </div>
                <Badge variant="secondary">{allChannels.length} WITS IDs</Badge>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="!pl-9 text-sm "
                  placeholder="Search WITS ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </Card>

            {groupedChannels.length > 0 ? (
              <div className="grid gap-4">
                {groupedChannels.map((group) => (
                  <Card key={group.key} className="rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <h3 className="font-semibold">{group.label}</h3>
                        <p className="text-sm text-muted-foreground">{group.channels.length} configured WITS IDs</p>
                      </div>
                      <Badge variant="outline">{group.key === "other" ? "Other" : group.key}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {group.channels.map((channel) => (
                        <button
                          key={channel.witsId}
                          type="button"
                          className={cn(
                            "rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40",
                            selectedChannel?.witsId === channel.witsId && "border-primary/40 bg-primary/10"
                          )}
                          onClick={() => {
                            setSelectedWitsId(channel.witsId);
                            setActiveLogTab("edit");
                            setLogDataViewMode("detail");
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-mono text-sm font-semibold">{channel.witsId}</div>
                              <div className="mt-1 text-sm font-medium">{channel.label}</div>
                            </div>
                            <Badge variant={channel.count > 0 ? "secondary" : "outline"}>{channel.count} records</Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {channel.units || "No units"} | {channel.lasMnemonic || "No LAS tag"}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            <Badge variant={channel.enabled ? "secondary" : "outline"}>
                              {channel.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            {channel.hiddenCount > 0 ? <Badge variant="outline">{channel.hiddenCount} hidden</Badge> : null}
                            {channel.isMemoryStorage ? <Badge variant="secondary">Memory Storage</Badge> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl border-dashed p-8 text-center">
                <h2 className="text-lg font-semibold">Belum ada konfigurasi WITS. Tambahkan WITS ID terlebih dahulu.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tambahkan WITS ID dari Configuration atau reload /api/wits-config.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs
              value={canManageMwdData ? activeLogTab : "edit"}
              onValueChange={(value) => {
                if (canManageMwdData) setActiveLogTab(value as LogEditorTool);
              }}
              className="space-y-4"
            >
            <Card className="rounded-2xl p-4">
              <div className="grid gap-3 md:grid-cols-[auto_72px_minmax(220px,1fr)_auto] md:items-center">
                <Button size="sm" variant="outline" onClick={() => setLogDataViewMode("list")}>
                  Close
                </Button>
                <Label className="text-xs font-semibold md:text-right">WITS ID:</Label>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={selectedWitsId}
                  onChange={(event) => {
                    setSelectedWitsId(event.target.value);
                    setActiveLogTab("edit");
                  }}
                  disabled={allChannels.length === 0}
                >
                  {allChannels.map((channel) => {
                    const range = channelDepthRanges[channel.witsId];
                    const rangeLabel = range ? ` (${range.min.toFixed(2)} - ${range.max.toFixed(2)})` : "";
                    return (
                      <option key={channel.witsId} value={channel.witsId}>
                        {channel.witsId} - {channel.label || "Unnamed"}{rangeLabel}
                      </option>
                    );
                  })}
                </select>
                <Badge variant="secondary" className="justify-center px-3 py-1.5">
                  Data Editor
                </Badge>
              </div>

              <TabsList className="mt-4 h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
                {visibleLogEditorTools.map((tool) => (
                  <TabsTrigger key={tool.value} value={tool.value}>
                    {tool.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Card>

              <Card className="rounded-2xl p-4">
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">{activeTool.label}</div>
                    <Badge variant={channelRecords.length > 0 ? "secondary" : "outline"}>
                      {channelRecords.length} values
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold">Description:</h3>
                    <p className="mt-3 text-sm text-muted-foreground">{activeTool.description}</p>
                    {channelRecords.length === 0 ? (
                      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Belum ada WITS value untuk filter ini.
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>

              {!canManageMwdData ? (
                <Card className="rounded-2xl border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Edit tools are read-only for this role. Only engineer and admin users can apply backend edit actions.
                </Card>
              ) : null}

              {editToolValidationMessage ? (
                <Card className="rounded-2xl border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {editToolValidationMessage}
                </Card>
              ) : null}

              <TabsContent value="edit" className="space-y-4">
                <Card className="rounded-2xl p-0">
                  <ScrollArea className="h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>MWD Data ID</TableHead>
                          <TableHead>Depth</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {channelRecords.map((record) => (
                          <TableRow
                            key={record.id}
                            className={cn(
                              withinRange(record.depth, selectedRange) && "bg-muted/40",
                              record.hidden && "opacity-60"
                            )}
                          >
                            <TableCell className="font-mono text-xs">{record.mwdDataId ?? "-"}</TableCell>
                            <TableCell>{record.depth.toFixed(2)}</TableCell>
                            <TableCell className="font-mono">
                              {record.value.toLocaleString("en-US", {
                                maximumFractionDigits: selectedChannel?.decimalPlaces ?? 3,
                              })}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(record.timestamp), "dd MMM HH:mm")}
                            </TableCell>
                            <TableCell>{record.sessionId ?? "-"}</TableCell>
                            <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                              {record.notes || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">Read only</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!witsValuesLoading && channelRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                              Belum ada WITS value untuk filter ini.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>

                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">MWD-driven values</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    WITS values are read from GET /api/wits-data-values and should be generated from incoming MWD data by the backend. This page does not create manual WITS value rows.
                  </p>
                </Card>
              </TabsContent>

              <TabsContent value="import" className="space-y-4">
                <LogDataMemoryImportPanel
                  selectedChannel={selectedChannel}
                  importBatch={logImportBatch}
                  importFileName={importFileName}
                  importError={logImportError}
                  importScanning={logImportScanning}
                  importCommitting={logImportCommitting}
                  importProgress={logImportProgress}
                  importResult={logImportCommitResult}
                  onImportSelection={(files) => void handleLogDataImportSelection(files, selectedChannel?.witsId)}
                  onFolderImport={openFolderImportPicker}
                  onCommitImport={() => void handleCommitLogDataImport()}
                />
              </TabsContent>

              <TabsContent value="delete-depths" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Delete Depths</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Start depth</Label>
                      <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End depth</Label>
                      <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Filter min value</Label>
                      <Input type="number" value={valueFilter.min} onChange={(event) => setValueFilter((current) => ({ ...current, min: Number(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Filter max value</Label>
                      <Input type="number" value={valueFilter.max} onChange={(event) => setValueFilter((current) => ({ ...current, max: Number(event.target.value) }))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={!canApplyEditTools || activeEditAction === "hide-range"}>
                          <EyeOff className="mr-2 size-4" />
                          {activeEditAction === "hide-range" ? "Hiding..." : "Hide Depth Range"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hide selected depth range?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Rows from {selectedRange.startDepth} to {selectedRange.endDepth} will be hidden through POST /api/mwd-data/edit/hide-range, then MWD data and edit history will refresh.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleHideRange()}>Hide Range</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={!canApplyEditTools || activeEditAction === "unhide-range"}
                        >
                          <Eye className="mr-2 size-4" />
                          {activeEditAction === "unhide-range" ? "Unhiding..." : "Unhide Depth Range"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unhide selected depth range?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Rows from {selectedRange.startDepth} to {selectedRange.endDepth} will be restored through POST /api/mwd-data/edit/unhide-range, then MWD data and edit history will refresh.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleUnhideRange()}>Unhide Range</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ConfirmDeleteButton
                      title="Delete selected depth range?"
                      description={`Rows from ${selectedRange.startDepth} to ${selectedRange.endDepth} will be deleted through POST /api/mwd-data/edit/delete-depth-range, then MWD data and edit history will refresh.`}
                      triggerLabel="Delete Depths"
                      size="sm"
                      variant="outline"
                      disabled={!canApplyEditTools || activeEditAction === "delete-depth-range"}
                      onConfirm={() => void handleDeleteDepths()}
                    />
                    <Button variant="outline" onClick={() => toast.success("Value filter applied to table view")}>
                      <Filter className="mr-2 size-4" />
                      Filter Value Range
                    </Button>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="move-depths" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Move Depths</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Start depth</Label>
                      <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End depth</Label>
                      <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Move offset</Label>
                      <Input type="number" value={moveOffset} onChange={(event) => setMoveOffset(Number(event.target.value))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handlePreviewMoveDepths()}
                      disabled={!canPreviewEditTools || activeEditAction === "move-depths"}
                    >
                      <MoveHorizontal className="mr-2 size-4" />
                      {activeEditAction === "move-depths" ? "Loading Preview..." : "Preview Move"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button disabled={!canApplyEditTools || activeEditPreview?.kind !== "move-depths" || activePreviewAffectedCount <= 0 || activeEditAction === "move-depths"}>
                          Apply Move
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apply move depth?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This applies the last successful move preview affecting {activePreviewAffectedCount} rows through POST /api/mwd-data/edit/move-depth, then refreshes MWD data and edit history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleApplyMoveDepths()}>Apply Move</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {activeEditPreview?.kind === "move-depths" ? (
                    <Card className="mt-4 rounded-xl p-0">
                      <div className="border-b px-4 py-3">
                        <h3 className="font-semibold">Backend move preview</h3>
                        <p className="text-sm text-muted-foreground">
                          Preview from GET /api/mwd-data/edit/move-depth. Apply is disabled until this preview succeeds.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">Affected: {activePreviewAffectedCount}</Badge>
                          <Badge variant="outline">Sample: {activePreviewRows.length}</Badge>
                        </div>
                      </div>
                      <ScrollArea className="h-[220px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Depth</TableHead>
                              <TableHead>Target</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activePreviewRows.map((row, index) => (
                              <TableRow key={`${activeEditPreview.kind}-${index}`}>
                                <TableCell>{formatPreviewValue(row.depth ?? row.sourceDepth ?? row.startDepth)}</TableCell>
                                <TableCell>{formatPreviewValue(row.targetDepth ?? row.newDepth ?? row.endDepth)}</TableCell>
                                <TableCell>{formatPreviewValue(row.value ?? row.beforeValue ?? row.afterValue)}</TableCell>
                                <TableCell>{formatPreviewValue(row.status ?? row.action ?? row.message)}</TableCell>
                              </TableRow>
                            ))}
                            {activePreviewRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                  Preview returned no sample rows.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </Card>
                  ) : null}
                </Card>
              </TabsContent>

              <TabsContent value="copy-depths" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Copy Depths</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Start depth</Label>
                      <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End depth</Label>
                      <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Copy offset</Label>
                      <Input type="number" value={copyOffset} onChange={(event) => setCopyOffset(Number(event.target.value))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handlePreviewCopyDepths()}
                      disabled={!canPreviewEditTools || activeEditAction === "copy-depths"}
                    >
                      {activeEditAction === "copy-depths" ? "Loading Preview..." : "Preview Copy"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button disabled={!canApplyEditTools || activeEditPreview?.kind !== "copy-depths" || activePreviewAffectedCount <= 0 || activeEditAction === "copy-depths"}>
                          Apply Copy
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apply copy depth?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This applies the last successful copy preview affecting {activePreviewAffectedCount} rows through POST /api/mwd-data/edit/copy-depth, then refreshes MWD data and edit history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleApplyCopyDepths()}>Apply Copy</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {activeEditPreview?.kind === "copy-depths" ? (
                    <Card className="mt-4 rounded-xl p-0">
                      <div className="border-b px-4 py-3">
                        <h3 className="font-semibold">Backend copy preview</h3>
                        <p className="text-sm text-muted-foreground">
                          Preview from GET /api/mwd-data/edit/copy-depth. Apply is disabled until this preview succeeds.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">Affected: {activePreviewAffectedCount}</Badge>
                          <Badge variant="outline">Sample: {activePreviewRows.length}</Badge>
                        </div>
                      </div>
                      <ScrollArea className="h-[220px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Depth</TableHead>
                              <TableHead>Target</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activePreviewRows.map((row, index) => (
                              <TableRow key={`${activeEditPreview.kind}-${index}`}>
                                <TableCell>{formatPreviewValue(row.depth ?? row.sourceDepth ?? row.startDepth)}</TableCell>
                                <TableCell>{formatPreviewValue(row.targetDepth ?? row.newDepth ?? row.endDepth)}</TableCell>
                                <TableCell>{formatPreviewValue(row.value ?? row.beforeValue ?? row.afterValue)}</TableCell>
                                <TableCell>{formatPreviewValue(row.status ?? row.action ?? row.message)}</TableCell>
                              </TableRow>
                            ))}
                            {activePreviewRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                  Preview returned no sample rows.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </Card>
                  ) : null}
                </Card>
              </TabsContent>

              <TabsContent value="rescale" className="space-y-4">
                <Card className="rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Rescaling Logged Data</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Rescale the selected WITS channel inside the active depth range only.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedChannel?.witsId ?? "No channel"}</Badge>
                      <Badge variant="outline">{rescaleAffectedRecords.length} affected rows</Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Channel</Label>
                          <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            value={selectedWitsId}
                            onChange={(event) => setSelectedWitsId(event.target.value)}
                          >
                            {allChannels.map((channel) => (
                              <option key={channel.witsId} value={channel.witsId}>
                                {channel.witsId} - {channel.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Start depth</Label>
                          <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label>End depth</Label>
                          <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                        </div>
                      </div>

                      <Tabs value={rescaleMode} onValueChange={(value) => setRescaleMode(value as RescaleMode)} className="space-y-4">
                        <TabsList className="h-auto flex-wrap justify-start">
                          <TabsTrigger value="example-value">Example Value</TabsTrigger>
                          <TabsTrigger value="percentage">Percentage</TabsTrigger>
                        </TabsList>

                        <TabsContent value="example-value" className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Original / example value</Label>
                              <Input type="number" value={originalExampleValue} onChange={(event) => setOriginalExampleValue(Number(event.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Desired / new value</Label>
                              <Input type="number" value={desiredExampleValue} onChange={(event) => setDesiredExampleValue(Number(event.target.value))} />
                            </div>
                          </div>
                          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                            New scale factor = desired value / original value ={" "}
                            <span className="font-semibold">{rescaleScaleFactor.toFixed(6)}</span>
                          </div>
                        </TabsContent>

                        <TabsContent value="percentage" className="space-y-4">
                          <div className="max-w-sm space-y-2">
                            <Label>Percentage adjustment</Label>
                            <Input type="number" value={rescalePercentage} onChange={(event) => setRescalePercentage(Number(event.target.value))} />
                          </div>
                          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                            New scale factor = 1 + percentage / 100 ={" "}
                            <span className="font-semibold">{rescaleScaleFactor.toFixed(6)}</span>
                          </div>
                        </TabsContent>
                      </Tabs>

                      <Card className="rounded-xl p-0">
                        <div className="border-b px-4 py-3">
                          <h3 className="font-semibold">Local before / after estimate</h3>
                          <p className="text-sm text-muted-foreground">Estimate shows up to 8 currently loaded records. Backend preview is required before apply.</p>
                        </div>
                        <ScrollArea className="h-[220px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Depth</TableHead>
                                <TableHead>Before</TableHead>
                                <TableHead>After</TableHead>
                                <TableHead>Delta</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rescalePreview.map((preview) => (
                                <TableRow key={preview.recordId}>
                                  <TableCell>{preview.depth.toFixed(2)}</TableCell>
                                  <TableCell>{preview.beforeValue.toFixed(3)}</TableCell>
                                  <TableCell>{preview.afterValue.toFixed(3)}</TableCell>
                                  <TableCell>{(preview.afterValue - preview.beforeValue).toFixed(3)}</TableCell>
                                </TableRow>
                              ))}
                              {rescalePreview.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                    No records match this channel and depth range.
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </Card>
                      {activeEditPreview?.kind === "rescale" ? (
                        <Card className="rounded-xl p-0">
                          <div className="border-b px-4 py-3">
                            <h3 className="font-semibold">Backend rescale preview</h3>
                            <p className="text-sm text-muted-foreground">
                              Preview from GET /api/mwd-data/edit/rescale. Apply is disabled until this preview succeeds.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary">Affected: {activePreviewAffectedCount}</Badge>
                              <Badge variant="outline">Sample: {activePreviewRows.length}</Badge>
                            </div>
                          </div>
                          <ScrollArea className="h-[220px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Depth</TableHead>
                                  <TableHead>Before</TableHead>
                                  <TableHead>After</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {activePreviewRows.map((row, index) => (
                                  <TableRow key={`${activeEditPreview.kind}-${index}`}>
                                    <TableCell>{formatPreviewValue(row.depth ?? row.md ?? row.startDepth)}</TableCell>
                                    <TableCell>{formatPreviewValue(row.beforeValue ?? row.originalValue ?? row.value)}</TableCell>
                                    <TableCell>{formatPreviewValue(row.afterValue ?? row.newValue ?? row.scaledValue)}</TableCell>
                                    <TableCell>{formatPreviewValue(row.status ?? row.action ?? row.message)}</TableCell>
                                  </TableRow>
                                ))}
                                {activePreviewRows.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                      Preview returned no sample rows.
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </Card>
                      ) : null}
                    </div>

                    <Card className="rounded-xl border-dashed p-4">
                      <h3 className="font-semibold">Rescale summary</h3>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Channel</span>
                          <span className="text-right font-medium">{selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "None"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Mode</span>
                          <span className="font-medium">{formatRescaleMode(rescaleMode)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Scale factor</span>
                          <span className="font-mono font-medium">{rescaleScaleFactor.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Depth range</span>
                          <span className="font-medium">{selectedRange.startDepth} - {selectedRange.endDepth}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Affected rows</span>
                          <span className="font-medium">{rescaleAffectedRecords.length}</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Use backend preview first. Apply calls POST /api/mwd-data/edit/rescale only after the preview succeeds and you confirm.
                      </div>

                      <Button
                        className="mt-4 w-full"
                        variant="outline"
                        disabled={!canPreviewRescaleTools || !canApplyRescale || activeEditAction === "rescale"}
                        onClick={() => void handlePreviewRescale()}
                      >
                        <Scale className="mr-2 size-4" />
                        {activeEditAction === "rescale" ? "Loading Preview..." : "Preview Rescale"}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="mt-2 w-full" disabled={!canApplyRescaleTools || activeEditPreview?.kind !== "rescale" || activePreviewAffectedCount <= 0 || activeEditAction === "rescale"}>
                            <Scale className="mr-2 size-4" />
                            Apply Rescale
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apply rescale to logged data?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {rescaleSummary
                                ? `${activePreviewAffectedCount} backend-previewed rows in ${rescaleSummary.channelWitsId} from ${rescaleSummary.startDepth} to ${rescaleSummary.endDepth} will be multiplied by ${rescaleSummary.scaleFactor.toFixed(6)}.`
                                : "Review the rescale settings before applying."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRescale}>Apply Rescale</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </Card>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="batch" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Batch operations</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Backend-connected edit tools remain available in their own tabs. Import and memory actions route to explicit backend workflows.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {[
                      "Import data from CSV/LAS",
                      "Memory Correlation Editor",
                      "Batch Settings Editor",
                      "Export Data",
                    ].map((actionLabel) => (
                      <div key={actionLabel} className="rounded-xl border px-4 py-3">
                        <div className="font-medium">{actionLabel}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {actionLabel === "Memory Correlation Editor"
                            ? "Open the dedicated backend memory workflow."
                            : actionLabel === "Import data from CSV/LAS"
                              ? "Open the active CSV/ZIP import flow that writes mapped WITS values through POST /api/mwd-data."
                              : "Backend integration is not available from this batch surface yet."}
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3"
                          onClick={() => {
                            if (actionLabel === "Import data from CSV/LAS") {
                              openActionDialog("import");
                              return;
                            }
                            if (actionLabel === "Memory Correlation Editor") {
                              onNavigate?.("data-management-memory-import");
                              return;
                            }
                            toast.message("Endpoint backend untuk fitur ini belum tersedia.");
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            <PlaceholderNote>
              WITS value rows are read from /api/wits-data-values. Move, copy, and rescale use backend preview before apply; destructive actions require confirmation.
            </PlaceholderNote>
            </Tabs>
          </div>
        )}
      </WorkspaceSection>

      {logDataViewMode === "list" && canManageMwdData ? (
        <Card className="rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Edit Operations History</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Audit trail from GET /api/mwd-data/edit/operations.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadEditOperations()}
              disabled={!token || editOperationsLoading}
            >
              <History className={cn("mr-2 size-4", editOperationsLoading && "animate-spin")} />
              Refresh History
            </Button>
          </div>
          {editOperationsError ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {editOperationsError}
            </div>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editOperations.slice(0, 8).map((operation) => (
                  <TableRow key={operation.id}>
                    <TableCell className="font-medium">{operation.type}</TableCell>
                    <TableCell>{operation.status ?? "-"}</TableCell>
                    <TableCell>{operation.userName ?? "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatOperationDate(operation.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[520px] truncate text-sm text-muted-foreground">
                      {operation.summary}
                    </TableCell>
                  </TableRow>
                ))}
                {!editOperationsLoading && editOperations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No edit operations returned.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={activeActionDialog !== null && (canManageMwdData || activeActionDialog === "export")}
        onOpenChange={(open) => !open && setActiveActionDialog(null)}
      >
        {activeActionDialog === "import" ? (
          <DialogContent className="max-h-[calc(100dvh-3rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Import data from CSV / ZIP dump</DialogTitle>
              <DialogDescription>
                Import single CSV, multiple CSV files, selected folders, or ZIP folder dumps into the active Log Data WITS-value pipeline.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0 pr-3">
              <LogDataMemoryImportPanel
                selectedChannel={selectedChannel}
                importBatch={logImportBatch}
                importFileName={importFileName}
                importError={logImportError}
                importScanning={logImportScanning}
                importCommitting={logImportCommitting}
                importProgress={logImportProgress}
                importResult={logImportCommitResult}
                onImportSelection={(files) => void handleLogDataImportSelection(files, selectedChannel?.witsId)}
                onFolderImport={openFolderImportPicker}
                onCommitImport={() => void handleCommitLogDataImport()}
              />
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={logImportCommitting}>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        ) : null}

        {activeActionDialog === "memory" ? (
          <DialogContent className="max-h-[calc(100dvh-3rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Memory Correlation Editor</DialogTitle>
              <DialogDescription>
                Memory import and correlation are handled by the dedicated backend memory workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 gap-3 lg:grid-cols-2">
              <Card className="rounded-xl p-4">
                <h3 className="font-semibold">Backend memory workflow</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use `/data-management/memory-import` for GET `/api/memory-files`, POST `/api/memory-files/import`, points review, dry-run correlation, and apply correlation.
                </p>
                <div className="mt-3 rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Current Log Data channel: {selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "none"}.
                </div>
              </Card>
              <Card className="rounded-xl border-dashed p-4">
                <h3 className="font-semibold">Local placeholder removed</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This dialog no longer runs local-only correlation, bit spacing, shift time, or copy-depth actions. Use backend edit tools in Log Data or the memory import page.
                </p>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button onClick={() => onNavigate?.("data-management-memory-import")}>
                Open Memory Import
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}

        {activeActionDialog === "batch" ? (
          <DialogContent className="max-h-[calc(100dvh-3rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Batch Settings Editor</DialogTitle>
              <DialogDescription>
                Review channel settings in a batch-friendly editor. Configuration persistence is ready for backend wiring.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="flex min-h-[320px] flex-col rounded-xl p-0 lg:min-h-0">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Configured WITS IDs</h3>
                  <p className="text-sm text-muted-foreground">Select channels to target with the batch settings form.</p>
                </div>
                <ScrollArea className="min-h-[260px] flex-1 lg:min-h-0">
                  <div className="space-y-2 p-3">
                    {allChannels.map((channel) => (
                      <label key={channel.witsId} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/40">
                        <Checkbox
                          checked={selectedToolWitsIds.includes(channel.witsId)}
                          onCheckedChange={() => toggleToolWitsId(channel.witsId)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-sm font-semibold">{channel.witsId}</span>
                          <span className="block truncate text-sm">{channel.label}</span>
                          <span className="block text-xs text-muted-foreground">Scale {channel.scaleFactor} | Decimals {channel.decimalPlaces}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
              <Card className="rounded-xl border-dashed p-4">
                <h3 className="font-semibold">Settings</h3>
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Decimal places</Label>
                    <Input type="number" defaultValue={selectedChannel?.decimalPlaces ?? 2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Scale factor</Label>
                    <Input type="number" defaultValue={selectedChannel?.scaleFactor ?? 1} />
                  </div>
                  <div className="space-y-2">
                    <Label>Plot name</Label>
                    <Input defaultValue={selectedChannel?.plotName ?? ""} />
                  </div>
                  <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Selected: {selectedToolChannels.length} WITS ID{selectedToolChannels.length === 1 ? "" : "s"}. Alarm and memory flags remain sourced from configured WITS IDs.
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={() => toast.message("Batch Settings Editor is a placeholder action")}>
                  Apply Settings
                </Button>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        ) : null}

        {activeActionDialog === "delete-range" ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Depth Range</DialogTitle>
              <DialogDescription>
                Delete backend log rows inside the selected depth range. This operation targets the selected WITS IDs only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start depth</Label>
                  <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>End depth</Label>
                  <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                </div>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <div className="font-medium text-destructive">Confirm backend deletion</div>
                <p className="mt-1 text-muted-foreground">
                  {selectedToolChannels.length > 0
                    ? `${selectedToolChannels.length} WITS ID selected from ${selectedRange.startDepth} to ${selectedRange.endDepth}. POST /api/mwd-data/edit/delete-depth-range will be called after this confirmation.`
                    : "No WITS ID selected. Choose a channel first from the list or detail mode."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDialogDeleteDepths}
                disabled={!canApplyEditTools || activeEditAction === "delete-depth-range"}
              >
                {activeEditAction === "delete-depth-range" ? "Deleting..." : "Delete Depths"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}

        {activeActionDialog === "export" ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Data</DialogTitle>
              <DialogDescription>
                Prepare a local export request for log records. File generation is currently a backend integration point.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>File type</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={exportFileType} onChange={(event) => setExportFileType(event.target.value)}>
                  <option value="LAS">LAS</option>
                  <option value="CSV">CSV</option>
                  <option value="TXT">TXT</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
                  <option value="selected">Selected WITS ID</option>
                  <option value="all">All configured WITS IDs</option>
                  <option value="range">Selected depth range only</option>
                </select>
              </div>
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <Checkbox checked={exportIncludeHidden} onCheckedChange={(checked) => setExportIncludeHidden(checked === true)} />
                Include hidden records
              </label>
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Current channel: {selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "none"}.
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button onClick={() => toast.message(`Export UI ready for ${exportFileType} (${exportScope})`)}>
                Export
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
    <AppLayout currentPage="data-management-log-data" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
