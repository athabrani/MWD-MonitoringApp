"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpFromLine,
  Binary,
  FileSpreadsheet,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  PolarisAccessLevel,
  PolarisContact,
  PolarisDataSourceMode,
  PolarisDecoderConfiguration,
  PolarisSurveyConfiguration,
  PolarisSystemInfo,
  PolarisToolType,
  PolarisWellInformation,
  PolarisWitsId,
  WitsIdDataSourceType,
} from "@/types/polaris";
import {
  AppLayout,
  AppPage,
  getAppPagePath,
} from "@/components/layouts/app-layout";
import { PlaceholderNote, WorkspaceSection } from "@/components/layouts/workspace-section";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { WitsMemoryImportPanel } from "@/components/contents/configuration/wits-memory-import-panel";
import { cn } from "@/lib/utils";
import {
  createMwdSession,
  getMwdSessionById,
  mwdSessionToWellJobInfo,
  updateMwdSession,
  wellJobInfoToMwdSessionPayload,
} from "@/lib/mwd-sessions-api";
import {
  createWitsConfig,
  deleteWitsConfig,
  getWitsConfig,
  getWitsConfigById,
  updateWitsConfig,
  witsConfigToPayload,
} from "@/lib/api/wits";
import { getSafeErrorMessage, logSecurityError } from "@/lib/security/errors";
import { canPerformAction } from "@/lib/security/permissions";

const accessLevels: PolarisAccessLevel[] = ["MWD", "Guest", "None"];
const toolTypes: PolarisToolType[] = ["Mud Pulse", "EM", "Simulator", "Memory"];
const dataSourceModes: PolarisDataSourceMode[] = [
  "decoder",
  "manual",
  "derived",
];
type WitsViewMode = "list" | "detail";

const emptyContact: PolarisContact = {
  id: "",
  name: "",
  email: "",
  company: "",
  accessLevel: "Guest",
  active: true,
};

const emptyDecoderConfiguration: PolarisDecoderConfiguration = {
  toolType: "Mud Pulse",
  toolfaceModeInclination: 0,
  witsOutputTimer: 0,
  gvTagMapping: "",
};

const emptySystemInfo: PolarisSystemInfo = {
  smtpHost: "",
  smtpPort: 0,
  username: "",
  senderEmail: "",
  subjectTemplate: "",
  bodyTemplate: "",
  signature: "",
  reportLogoLight: "",
  reportLogoDark: "",
};

const emptyWellInformation: PolarisWellInformation = {
  companyName: "",
  surveyCompany: "",
  siteName: "",
  wellName: "",
  jobName: "",
  jobNumber: "",
  operator: "",
  rigName: "",
  rigId: "",
  fieldName: "",
  apiOrUwi: "",
  afe: "",
  location: "",
  stateOrProvince: "",
  countyOrParish: "",
  country: "",
  filePrefix: "",
  fileSuffix: "",
  fileSequence: "",
  startDate: "",
  endDate: "",
  startDepth: 0,
  endDepth: 0,
  drillingStatus: "Standby",
  backupDatabaseToDashboard: false,
  dashboardContactName: "",
  dashboardContactEmail: "",
  dashboardContactSecondary: "",
  dashboardContactPhone: "",
  dashboardCoordinator: "",
  notes: "",
};

const emptySurveyConfiguration: PolarisSurveyConfiguration = {
  units: "metric",
  proposedAzimuth: 0,
  surveyDepthOffset: 0,
  surveyDoglegUnit: "",
  plotPaperNote: "",
  northReference: "grid",
  magneticDeclination: 0,
  latitude: "",
  longitude: "",
  northing: 0,
  easting: 0,
  kb: 0,
  df: 0,
  gl: 0,
  subseaDepth: 0,
  surveyReportColumns: "",
  surveyRigPortSource: "database",
  plotInclination: true,
  plotAzimuth: true,
  plotTvd: true,
  plotVerticalSection: true,
  plotNorthSouth: true,
  plotEastWest: true,
  outputDoglegSeverity: true,
  outputCoordinates: true,
  outputTvdss: false,
  importWellplanFile: "",
};

const emptyWitsRecord: PolarisWitsId = {
  id: "",
  numericId: 0,
  enabled: true,
  name: "",
  units: "",
  decimalPlaces: 0,
  scaleFactor: 1,
  biasOffset: 0,
  sensorToBitSpacing: 0,
  sendToAux: false,
  sendToRigWits: false,
  doNotRepeat: false,
  realTimePlot: "",
  depthTracking: "",
  plotScaleInfo: "",
  leftScale: 0,
  rightScale: 0,
  lineColor: "#2563eb",
  wrapColor: "#ef4444",
  lasMnemonic: "",
  lasDescription: "",
  lasFilter: 0,
  alarmEnabled: false,
  alarmLow: 0,
  alarmHigh: 0,
  dataSourceType: "serial",
  dataSourceValue: 0,
  useForMemoryImportStorage: false,
  dataSourceMode: "decoder",
  scriptNotes: "",
};

function normalizeWellInfo(
  value?: Partial<PolarisWellInformation> | null
): PolarisWellInformation {
  return {
    ...emptyWellInformation,
    ...value,
  };
}

function normalizeContact(value?: Partial<PolarisContact> | null): PolarisContact {
  return {
    ...emptyContact,
    ...value,
  };
}

function normalizeSurveyConfig(
  value?: Partial<PolarisSurveyConfiguration> | null
): PolarisSurveyConfiguration {
  return {
    ...emptySurveyConfiguration,
    ...value,
  };
}

function normalizeDecoderConfig(
  value?: Partial<PolarisDecoderConfiguration> | null
): PolarisDecoderConfiguration {
  return {
    ...emptyDecoderConfiguration,
    ...value,
  };
}

function normalizeSystemInfo(
  value?: Partial<PolarisSystemInfo> | null
): PolarisSystemInfo {
  return {
    ...emptySystemInfo,
    ...value,
  };
}

function normalizeWitsRecord(
  value?: Partial<PolarisWitsId> | null
): PolarisWitsId {
  return {
    ...emptyWitsRecord,
    ...value,
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SummaryValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 overflow-hidden text-sm font-semibold leading-snug break-words [overflow-wrap:anywhere]">
      {children}
    </div>
  );
}

export default function ConfigurationPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const {
    mwdSessions,
    activeMwdSessionId,
    setActiveMwdSessionId,
    mwdSessionsLoading,
    mwdSessionsError,
    refreshMwdSessions,
    refreshWitsConfig,
  } = useApp();
  const [wellInfo, setWellInfo] = useState<PolarisWellInformation>(() =>
    normalizeWellInfo(emptyWellInformation)
  );
  const [wellInfoDirty, setWellInfoDirty] = useState(false);
  const [wellSessionLoading, setWellSessionLoading] = useState(false);
  const [wellSessionSaving, setWellSessionSaving] = useState(false);
  const [wellSessionError, setWellSessionError] = useState("");
  const [loadedWellSessionId, setLoadedWellSessionId] = useState("");
  const [contacts, setContacts] = useState<PolarisContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [draftContact, setDraftContact] = useState<PolarisContact>(() =>
    normalizeContact(emptyContact)
  );
  const [surveyConfig, setSurveyConfig] = useState<PolarisSurveyConfiguration>(() =>
    normalizeSurveyConfig(emptySurveyConfiguration)
  );
  const [witsIds, setWitsIds] = useState<PolarisWitsId[]>([]);
  const [selectedWitsId, setSelectedWitsId] = useState<string>("");
  const [witsViewMode, setWitsViewMode] = useState<WitsViewMode>("list");
  const [newWitsIdInput, setNewWitsIdInput] = useState("");
  const [newWitsIdError, setNewWitsIdError] = useState("");
  const [witsConfigLoading, setWitsConfigLoading] = useState(false);
  const [witsConfigDetailLoading, setWitsConfigDetailLoading] = useState(false);
  const [witsConfigSaving, setWitsConfigSaving] = useState(false);
  const [witsConfigDeleting, setWitsConfigDeleting] = useState(false);
  const [witsConfigError, setWitsConfigError] = useState("");
  const canManageWitsConfig = canPerformAction(user, "wits-config:write");
  const canManageConfiguration = canPerformAction(user, "configuration:write");
  const [decoderConfig, setDecoderConfig] = useState<PolarisDecoderConfiguration>(() =>
    normalizeDecoderConfig(emptyDecoderConfiguration)
  );
  const [systemInfo, setSystemInfo] = useState<PolarisSystemInfo>(() =>
    normalizeSystemInfo(emptySystemInfo)
  );

  const activeWitsRecord = useMemo(
    () => {
      const selectedRecord = witsIds.find((item) => item.id === selectedWitsId);
      return selectedRecord ? normalizeWitsRecord(selectedRecord) : null;
    },
    [selectedWitsId, witsIds]
  );

  const safeWellInfo = normalizeWellInfo(wellInfo);
  const safeDraftContact = normalizeContact(draftContact);
  const safeSurveyConfig = normalizeSurveyConfig(surveyConfig);
  const safeDecoderConfig = normalizeDecoderConfig(decoderConfig);
  const safeSystemInfo = normalizeSystemInfo(systemInfo);

  const loadWitsConfigFromApi = React.useCallback(async (preferredId?: string) => {
    if (!token) {
      setWitsIds([]);
      setSelectedWitsId("");
      setWitsConfigError("Backend session is not available. Please sign in again.");
      return;
    }

    setWitsConfigLoading(true);
    setWitsConfigError("");

    try {
      const records = await getWitsConfig(token);
      setWitsIds(records);
      setSelectedWitsId((current) =>
        preferredId && records.some((record) => record.id === preferredId)
          ? preferredId
          : current && records.some((record) => record.id === current)
            ? current
            : records[0]?.id ?? ""
      );
      await refreshWitsConfig();
    } catch (error) {
      logSecurityError("Unable to load WITS config.", error);
      const message = "Gagal memuat data dari backend.";
      setWitsIds([]);
      setSelectedWitsId("");
      setWitsViewMode("list");
      setWitsConfigError(message);
      toast.error(message);
    } finally {
      setWitsConfigLoading(false);
    }
  }, [refreshWitsConfig, token]);

  useEffect(() => {
    void loadWitsConfigFromApi();
  }, [loadWitsConfigFromApi]);

  useEffect(() => {
    if (!token || !activeMwdSessionId || activeMwdSessionId === loadedWellSessionId || wellInfoDirty) {
      return;
    }

    let cancelled = false;
    setWellSessionLoading(true);
    setWellSessionError("");

    getMwdSessionById(token, activeMwdSessionId)
      .then((session) => {
        if (cancelled) return;
        setWellInfo((current) => mwdSessionToWellJobInfo(session, normalizeWellInfo(current)));
        setLoadedWellSessionId(session.id);
      })
      .catch((error) => {
        if (cancelled) return;
        logSecurityError("Unable to load MWD session detail.", error);
        setWellSessionError("Gagal memuat data dari backend.");
      })
      .finally(() => {
        if (!cancelled) setWellSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMwdSessionId, loadedWellSessionId, token, wellInfoDirty]);

  const patchWellInfo = (patch: Partial<PolarisWellInformation>) => {
    if (!canManageConfiguration) {
      return;
    }

    setWellInfo((prev) => ({ ...prev, ...patch }));
    setWellInfoDirty(true);
  };

  const selectMwdSession = (sessionId: string) => {
    if (wellInfoDirty) {
      const discardDraft = window.confirm(
        "Discard unsaved Well and Job Information changes and load the selected session?"
      );

      if (!discardDraft) return;
    }

    setWellInfoDirty(false);
    setWellSessionError("");
    setLoadedWellSessionId("");
    setActiveMwdSessionId(sessionId);
  };

  const startNewMwdSessionDraft = () => {
    if (!canManageConfiguration) {
      toast.warning("Operator role can view sessions only.");
      return;
    }

    if (wellInfoDirty) {
      const discardDraft = window.confirm(
        "Discard unsaved Well and Job Information changes and start a new session draft?"
      );

      if (!discardDraft) return;
    }

    setWellInfo(normalizeWellInfo({}));
    setWellInfoDirty(true);
    setLoadedWellSessionId("");
    setWellSessionError("");
    setActiveMwdSessionId("");
  };

  const validateWellSessionDraft = (draft: PolarisWellInformation) => {
    if (!draft.wellName.trim()) return "Well Name is required before saving a session.";
    if (!draft.jobName.trim() && !draft.jobNumber.trim()) {
      return "Job Name or Job Number is required before saving a session.";
    }
    if (!Number.isFinite(draft.startDepth)) return "Start Depth must be a valid number.";
    if (!Number.isFinite(draft.endDepth)) return "End Depth must be a valid number.";
    if (draft.endDepth > 0 && draft.startDepth > draft.endDepth) {
      return "Start Depth cannot be greater than End Depth.";
    }
    if (draft.startDate && Number.isNaN(new Date(draft.startDate).getTime())) {
      return "Start Date must be a valid date.";
    }
    if (draft.endDate && Number.isNaN(new Date(draft.endDate).getTime())) {
      return "End Date must be a valid date.";
    }
    if (draft.startDate && draft.endDate && new Date(draft.endDate) < new Date(draft.startDate)) {
      return "End Date cannot be before Start Date.";
    }

    return "";
  };

  const saveWellSession = async () => {
    if (!canManageConfiguration) {
      toast.warning("Operator role can view sessions only.");
      return;
    }

    if (!token) {
      toast.error("Backend session is not available. Please sign in again.");
      return;
    }

    const validation = validateWellSessionDraft(safeWellInfo);
    if (validation) {
      toast.warning(validation);
      return;
    }

    setWellSessionSaving(true);
    setWellSessionError("");

    try {
      const payload = wellJobInfoToMwdSessionPayload(safeWellInfo);
      const savedSession = activeMwdSessionId
        ? await updateMwdSession(token, activeMwdSessionId, payload)
        : await createMwdSession(token, payload);

      setActiveMwdSessionId(savedSession.id);
      setLoadedWellSessionId(savedSession.id);
      setWellInfo((current) => mwdSessionToWellJobInfo(savedSession, normalizeWellInfo(current)));
      setWellInfoDirty(false);
      await refreshMwdSessions();
      toast.success(
        activeMwdSessionId
          ? "Well and Job Information updated."
          : "MWD session created from Well and Job Information."
      );
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to save MWD session.");
      setWellSessionError(message);
      toast.error(message);
    } finally {
      setWellSessionSaving(false);
    }
  };

  const saveContactDraft = () => {
    if (!canManageConfiguration) {
      toast.warning("Operator role can view contacts only.");
      return;
    }

    if (!draftContact.name || !draftContact.email) {
      toast.error("Contact name dan email wajib diisi.");
      return;
    }

    const nextContact = {
      ...draftContact,
      id: draftContact.id || `contact-${Date.now()}`,
    };

    setContacts((prev) => {
      const exists = prev.some((item) => item.id === nextContact.id);
      return exists
        ? prev.map((item) => (item.id === nextContact.id ? nextContact : item))
        : [...prev, nextContact];
    });
    setSelectedContactId(nextContact.id);
    setDraftContact(normalizeContact(nextContact));
    toast.success("Contact saved as local UI-only draft.");
  };

  const deleteSelectedContact = () => {
    if (!canManageConfiguration) {
      toast.warning("Operator role can view contacts only.");
      return;
    }

    if (!selectedContactId) return;

    setContacts((prev) => prev.filter((item) => item.id !== selectedContactId));
    setSelectedContactId("");
    setDraftContact(normalizeContact(emptyContact));
    toast.success("Contact removed from local configuration.");
  };

  const updateActiveWits = (patch: Partial<PolarisWitsId>) => {
    if (!canManageWitsConfig) {
      return;
    }

    if (!activeWitsRecord) return;
    setWitsIds((prev) =>
      prev.map((item) =>
        item.id === activeWitsRecord.id ? normalizeWitsRecord({ ...item, ...patch }) : item
      )
    );
  };

  const replaceWitsRecord = (record: PolarisWitsId) => {
    setWitsIds((prev) => {
      const exists = prev.some((item) => item.id === record.id);
      return exists
        ? prev.map((item) => (item.id === record.id ? normalizeWitsRecord(record) : item))
        : [normalizeWitsRecord(record), ...prev];
    });
  };

  const validateWitsRecord = (record: PolarisWitsId) => {
    if (!Number.isInteger(record.numericId) || record.numericId < 0) {
      return "WITS ID must be a valid positive number.";
    }
    if (!Number.isFinite(record.decimalPlaces) || record.decimalPlaces < 0) {
      return "Decimal Places must be a valid non-negative number.";
    }
    if (!Number.isFinite(record.scaleFactor)) {
      return "Scale Factor must be a valid number.";
    }
    if (!Number.isFinite(record.leftScale) || !Number.isFinite(record.rightScale)) {
      return "Plot scale values must be valid numbers.";
    }
    if (!Number.isFinite(record.alarmLow) || !Number.isFinite(record.alarmHigh)) {
      return "Alarm thresholds must be valid numbers.";
    }

    return "";
  };

  const openWitsDetail = async (recordId: string) => {
    setSelectedWitsId(recordId);
    setWitsViewMode("detail");

    if (!token) return;

    setWitsConfigDetailLoading(true);
    setWitsConfigError("");

    try {
      const detail = await getWitsConfigById(token, recordId);
      replaceWitsRecord(detail);
    } catch (error) {
      logSecurityError("Unable to load WITS config detail.", error);
      setWitsConfigError("Gagal memuat data dari backend.");
    } finally {
      setWitsConfigDetailLoading(false);
    }
  };

  const validateNewWitsId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter a WITS ID before adding.";
    if (!/^\d+$/.test(trimmed)) return "WITS ID must contain numbers only.";
    if (trimmed.length > 4) return "WITS ID should be 1 to 4 digits.";

    const numericId = Number(trimmed);
    if (!Number.isInteger(numericId) || numericId < 0) {
      return "WITS ID must be a valid positive number.";
    }

    if (witsIds.some((item) => item.numericId === numericId)) {
      return `WITS ID ${trimmed} already exists.`;
    }

    return "";
  };

  const buildDefaultWitsRecord = (numericId: number): PolarisWitsId =>
    normalizeWitsRecord({
      id: `wits-${Date.now()}`,
      numericId,
      enabled: true,
      name: "",
      units: "",
      decimalPlaces: 2,
      scaleFactor: 1,
      biasOffset: 0,
      sensorToBitSpacing: 0,
      plotScaleInfo: "0-100 neutral scale",
      leftScale: 0,
      rightScale: 100,
      lineColor: "#2563eb",
      wrapColor: "#ef4444",
      useForMemoryImportStorage: false,
      sendToAux: false,
      sendToRigWits: false,
      doNotRepeat: false,
      realTimePlot: "Unassigned",
      depthTracking: "Tracks Bit Depth (default)",
      lasMnemonic: `W${String(numericId).padStart(4, "0")}`,
      lasDescription: "",
      lasFilter: 0,
      alarmEnabled: false,
      alarmLow: 0,
      alarmHigh: 0,
      dataSourceType: "serial",
      dataSourceValue: 0,
      dataSourceMode: "manual",
      scriptNotes: "Configure source, plotting, LAS, and alarms before field use.",
    });

  const addWitsIdFromInput = async () => {
    if (!token) {
      toast.error("Backend session is not available. Please sign in again.");
      return;
    }
    if (!canManageWitsConfig) {
      toast.warning("Only admin or engineer users can create WITS config.");
      return;
    }

    const validation = validateNewWitsId(newWitsIdInput);
    if (validation) {
      setNewWitsIdError(validation);
      toast.error(validation);
      return;
    }

    const nextRecord = buildDefaultWitsRecord(Number(newWitsIdInput.trim()));

    setWitsConfigSaving(true);
    setWitsConfigError("");

    try {
      const savedRecord = await createWitsConfig(token, witsConfigToPayload(nextRecord));
      await loadWitsConfigFromApi(savedRecord.id);
      setSelectedWitsId(savedRecord.id);
      setWitsViewMode("detail");
      setNewWitsIdInput("");
      setNewWitsIdError("");
      toast.success(`WITS ID ${savedRecord.numericId} added. Editor opened.`);
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to create WITS config.");
      setWitsConfigError(message);
      toast.error("Unable to create WITS config", {
        description: message,
      });
    } finally {
      setWitsConfigSaving(false);
    }
  };

  const saveActiveWits = async () => {
    if (!activeWitsRecord) return;
    if (!token) {
      toast.error("Backend session is not available. Please sign in again.");
      return;
    }
    if (!canManageWitsConfig) {
      toast.warning("Only admin or engineer users can update WITS config.");
      return;
    }

    const validation = validateWitsRecord(activeWitsRecord);
    if (validation) {
      toast.warning(validation);
      return;
    }

    setWitsConfigSaving(true);
    setWitsConfigError("");

    try {
      const savedRecord = await updateWitsConfig(token, activeWitsRecord.id, witsConfigToPayload(activeWitsRecord));
      await loadWitsConfigFromApi(savedRecord.id);
      toast.success(`WITS ID ${savedRecord.numericId} changes saved.`);
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to save WITS config.");
      setWitsConfigError(message);
      toast.error("Unable to save WITS config", {
        description: message,
      });
    } finally {
      setWitsConfigSaving(false);
    }
  };

  const deleteActiveWits = async () => {
    if (!activeWitsRecord) return;
    if (!token) {
      toast.error("Backend session is not available. Please sign in again.");
      return;
    }
    if (!canManageWitsConfig) {
      toast.warning("Only admin or engineer users can delete WITS config.");
      return;
    }

    const confirmed = window.confirm(
      `Delete WITS ID ${activeWitsRecord.numericId}? This removes the selected WITS configuration.`
    );
    if (!confirmed) return;

    setWitsConfigDeleting(true);
    setWitsConfigError("");

    try {
      await deleteWitsConfig(token, activeWitsRecord.id);
      await loadWitsConfigFromApi();
      setSelectedWitsId("");
      setWitsViewMode("list");
      toast.success(`WITS ID ${activeWitsRecord.numericId} deleted.`);
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to delete WITS config.");
      setWitsConfigError(message);
      toast.error("Unable to delete WITS config", {
        description: message,
      });
    } finally {
      setWitsConfigDeleting(false);
    }
  };

  const addMemoryStorageWitsId = async () => {
    if (!token) {
      toast.error("Backend session is not available. Please sign in again.");
      return;
    }
    if (!canManageWitsConfig) {
      toast.warning("Only admin or engineer users can create WITS config.");
      return;
    }

    const preferredIds = [7001, 2055, 8023];
    const nextNumericId =
      preferredIds.find((id) => !witsIds.some((item) => item.numericId === id)) ??
      Math.max(...witsIds.map((item) => item.numericId), 7000) + 1;

    const nextRecord: PolarisWitsId = normalizeWitsRecord({
      id: `wits-memory-${Date.now()}`,
      numericId: nextNumericId,
      enabled: true,
      name: "Memory Import Storage",
      units: "memory",
      decimalPlaces: 2,
      scaleFactor: 1,
      biasOffset: 0,
      sensorToBitSpacing: 0,
      plotScaleInfo: "Set plot scale after memory import scan",
      leftScale: 0,
      rightScale: 100,
      lineColor: "#2563eb",
      wrapColor: "#ef4444",
      useForMemoryImportStorage: true,
      sendToAux: false,
      sendToRigWits: false,
      doNotRepeat: true,
      realTimePlot: "Memory Import",
      depthTracking: "Hole depth correlation",
      lasMnemonic: `MEM${String(nextNumericId).slice(-2)}`,
      lasDescription: "Memory import storage",
      lasFilter: 0,
      alarmEnabled: false,
      alarmLow: 0,
      alarmHigh: 0,
      dataSourceType: "serial",
      dataSourceValue: 0,
      dataSourceMode: "manual",
      scriptNotes:
        "Local memory import storage target. Import CSV, scan segment, correlate to hole depth, then stage gap fill if needed.",
    });

    setWitsConfigSaving(true);
    setWitsConfigError("");

    try {
      const savedRecord = await createWitsConfig(token, witsConfigToPayload(nextRecord));
      await loadWitsConfigFromApi(savedRecord.id);
      setSelectedWitsId(savedRecord.id);
      setWitsViewMode("detail");
      toast.success(`Memory storage WITS ID ${savedRecord.numericId} created.`);
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to create memory storage WITS config.");
      setWitsConfigError(message);
      toast.error("Unable to create memory storage WITS config", {
        description: message,
      });
    } finally {
      setWitsConfigSaving(false);
    }
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Software Configuration</Badge>
            <Badge variant="outline">Phase 1</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Configuration Workspace</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Well/job sessions and WITS config use backend APIs. Contacts, decoder config,
            SMTP/report settings, and system info are local UI-only until endpoints are documented.
          </p>
        </div>

        {canManageConfiguration ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast.message("Settings without backend endpoints are local UI-only drafts.")}>
              <Save className="mr-2 size-4" />
              Save Draft
            </Button>
            <Button onClick={() => toast.message("Endpoint backend untuk fitur ini belum tersedia.")}>
              <Settings2 className="mr-2 size-4" />
              Generate Review
            </Button>
          </div>
        ) : null}
      </div>

      <Tabs defaultValue="well" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          <TabsTrigger value="well">Well Information</TabsTrigger>
          <TabsTrigger value="contacts">Email / Login</TabsTrigger>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="wits">WITS IDs</TabsTrigger>
          <TabsTrigger value="decoder">Decoder</TabsTrigger>
          <TabsTrigger value="system">System Info</TabsTrigger>
        </TabsList>

        <TabsContent value="well" className="space-y-4">
          <WorkspaceSection
            title="Well and Job Information"
            description="Primary job identity, naming convention, drilling status, and dashboard contact placeholders."
            badge={activeMwdSessionId ? "Backend session" : "New session draft"}
          >
            <Card className="mb-3 border-dashed p-3 sm:mb-4 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto] xl:grid-cols-[minmax(220px,360px)_auto_auto] xl:items-end">
                  <FormField label="MWD Session">
                    <Select
                      value={activeMwdSessionId}
                      onValueChange={selectMwdSession}
                      disabled={mwdSessionsLoading || mwdSessions.length === 0 || wellSessionSaving}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={mwdSessionsLoading ? "Loading sessions..." : "Belum ada job/session. Buat session baru untuk mulai monitoring."}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {mwdSessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-end gap-1.5 sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                      onClick={() => void refreshMwdSessions()}
                      disabled={mwdSessionsLoading || wellSessionSaving}
                      aria-label="Refresh MWD sessions"
                      title="Refresh MWD sessions"
                    >
                      <RefreshCw className={cn("size-3.5 sm:mr-2 sm:size-4", mwdSessionsLoading && "animate-spin")} />
                      <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    {canManageConfiguration ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                        onClick={startNewMwdSessionDraft}
                        disabled={wellSessionSaving}
                        aria-label="New MWD session"
                        title="New MWD session"
                      >
                        <Plus className="size-3.5 sm:mr-2 sm:size-4" />
                        <span className="hidden sm:inline">New Session</span>
                      </Button>
                    ) : null}
                  </div>

                {canManageConfiguration ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 w-full px-3 text-xs sm:col-span-2 sm:text-sm xl:col-span-1 xl:w-auto"
                    onClick={() => void saveWellSession()}
                    disabled={wellSessionSaving || wellSessionLoading}
                  >
                    <Save className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
                    {wellSessionSaving
                      ? "Saving..."
                      : activeMwdSessionId
                        ? "Update Session"
                        : "Create Session"}
                  </Button>
                ) : null}
              </div>

              {mwdSessionsError || wellSessionError ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{wellSessionError || mwdSessionsError}</span>
                </div>
              ) : null}
              {wellSessionLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading selected session detail...</p>
              ) : null}
              {!canManageConfiguration ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Operator role can view session and configuration details, but cannot create or update sessions.
                </p>
              ) : null}
              {wellInfoDirty ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Unsaved Well and Job Information changes will be sent to the MWD Sessions API when you save.
                </p>
              ) : null}
            </Card>

            <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
              <Card className="border-dashed p-3 sm:p-4">
                <h4 className="text-sm font-medium sm:text-base">Well Identification</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <FormField label="Company Name">
                    <Input
                      value={safeWellInfo.companyName}
                      onChange={(e) =>
                        patchWellInfo({ companyName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Survey Company">
                    <Input
                      value={safeWellInfo.surveyCompany}
                      onChange={(e) =>
                        patchWellInfo({ surveyCompany: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Well Name">
                    <Input
                      value={safeWellInfo.wellName}
                      onChange={(e) =>
                        patchWellInfo({ wellName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Job Name">
                    <Input
                      value={safeWellInfo.jobName}
                      onChange={(e) =>
                        patchWellInfo({ jobName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Rig ID">
                    <Input
                      value={safeWellInfo.rigId}
                      onChange={(e) =>
                        patchWellInfo({ rigId: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Rig Name">
                    <Input
                      value={safeWellInfo.rigName}
                      onChange={(e) =>
                        patchWellInfo({ rigName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="API or UWI">
                    <Input
                      value={safeWellInfo.apiOrUwi}
                      onChange={(e) =>
                        patchWellInfo({ apiOrUwi: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="AFE">
                    <Input
                      value={safeWellInfo.afe}
                      onChange={(e) =>
                        patchWellInfo({ afe: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Field">
                    <Input
                      value={safeWellInfo.fieldName}
                      onChange={(e) =>
                        patchWellInfo({ fieldName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Location">
                    <Input
                      value={safeWellInfo.location}
                      onChange={(e) =>
                        patchWellInfo({ location: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="State / Province">
                    <Input
                      value={safeWellInfo.stateOrProvince}
                      onChange={(e) =>
                        patchWellInfo({ stateOrProvince: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="County / Parish">
                    <Input
                      value={safeWellInfo.countyOrParish}
                      onChange={(e) =>
                        patchWellInfo({ countyOrParish: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Country">
                    <Input
                      value={safeWellInfo.country}
                      onChange={(e) =>
                        patchWellInfo({ country: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Site Name">
                    <Input
                      value={safeWellInfo.siteName}
                      onChange={(e) =>
                        patchWellInfo({ siteName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Operator">
                    <Input
                      value={safeWellInfo.operator}
                      onChange={(e) =>
                        patchWellInfo({ operator: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              </Card>

              <Card className="border-dashed p-3 sm:p-4">
                <h4 className="text-sm font-medium sm:text-base">Job Details and File Naming</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <FormField label="Job Number">
                    <Input
                      value={safeWellInfo.jobNumber}
                      onChange={(e) =>
                        patchWellInfo({ jobNumber: e.target.value })
                      }
                    />
                  </FormField>
                  <div className="grid gap-2 min-[300px]:grid-cols-2 sm:col-span-2 sm:gap-4">
                    <FormField label="Start Date">
                      <Input
                        type="date"
                        value={safeWellInfo.startDate}
                        onChange={(e) =>
                          patchWellInfo({ startDate: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="End Date">
                      <Input
                        type="date"
                        value={safeWellInfo.endDate}
                        onChange={(e) =>
                          patchWellInfo({ endDate: e.target.value })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="grid gap-2 min-[300px]:grid-cols-2 sm:col-span-2 sm:gap-4">
                    <FormField label="Start Depth">
                      <Input
                        type="number"
                        value={safeWellInfo.startDepth}
                        onChange={(e) =>
                          patchWellInfo({ startDepth: Number(e.target.value) })
                        }
                      />
                    </FormField>
                    <FormField label="End Depth">
                      <Input
                        type="number"
                        value={safeWellInfo.endDepth}
                        onChange={(e) =>
                          patchWellInfo({ endDepth: Number(e.target.value) })
                        }
                      />
                    </FormField>
                  </div>
                  <FormField label="File Name Prefix">
                    <Input
                      value={safeWellInfo.filePrefix}
                      onChange={(e) =>
                        patchWellInfo({ filePrefix: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="File Name Suffix">
                    <Input
                      value={safeWellInfo.fileSuffix}
                      onChange={(e) =>
                        patchWellInfo({ fileSuffix: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="File Sequence">
                    <Input
                      value={safeWellInfo.fileSequence}
                      onChange={(e) =>
                        patchWellInfo({ fileSequence: e.target.value })
                      }
                    />
                  </FormField>
                </div>

                <div className="mt-3 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground sm:mt-4 sm:p-3 sm:text-sm">
                  Preview: {safeWellInfo.filePrefix}_{safeWellInfo.wellName}_{safeWellInfo.fileSequence}_{safeWellInfo.fileSuffix}
                </div>
              </Card>
            </div>

            <div className="mt-4 grid gap-3 sm:gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-dashed p-3 sm:p-4">
                <h4 className="text-sm font-medium sm:text-base">Dashboard Drilling Status</h4>
                <div className="mt-3 space-y-3 sm:space-y-4">
                  <FormField label="Rig Status">
                    <Select
                      value={safeWellInfo.drillingStatus}
                      onValueChange={(value) =>
                        patchWellInfo({
                          drillingStatus: value as PolarisWellInformation["drillingStatus"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Drilling", "Circulating", "Tripping", "Surveying", "Standby"].map(
                          (status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-start justify-between gap-3 rounded-lg border p-2.5 sm:gap-4 sm:p-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium sm:text-base">Backup database to dashboard</div>
                      <div className="text-xs text-muted-foreground">
                        Placeholder for automatic push when TD or reporting milestones are selected.
                      </div>
                    </div>
                    <Switch
                      checked={safeWellInfo.backupDatabaseToDashboard}
                      onCheckedChange={(value) =>
                        patchWellInfo({ backupDatabaseToDashboard: value })
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs sm:text-sm"
                    onClick={() =>
                      toast.message("Database backup trigger is a Phase 2 placeholder.")
                    }
                  >
                    Trigger database backup
                  </Button>
                </div>
              </Card>

              <Card className="border-dashed p-3 sm:p-4">
                <h4 className="text-sm font-medium sm:text-base">Dashboard Contact Information</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <FormField label="MWD Contact 1">
                    <Input
                      value={safeWellInfo.dashboardContactName}
                      onChange={(e) =>
                        patchWellInfo({ dashboardContactName: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="MWD Contact 2">
                    <Input
                      value={safeWellInfo.dashboardContactSecondary}
                      onChange={(e) =>
                        patchWellInfo({ dashboardContactSecondary: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Contact Email">
                    <Input
                      value={safeWellInfo.dashboardContactEmail}
                      onChange={(e) =>
                        patchWellInfo({ dashboardContactEmail: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Contact Phone">
                    <Input
                      value={safeWellInfo.dashboardContactPhone}
                      onChange={(e) =>
                        patchWellInfo({ dashboardContactPhone: e.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Coordinator">
                    <Input
                      value={safeWellInfo.dashboardCoordinator}
                      onChange={(e) =>
                        patchWellInfo({ dashboardCoordinator: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              </Card>
            </div>

            <div className="mt-4 sm:mt-5">
              <FormField label="Operator Notes">
                <Textarea
                  rows={3}
                  value={safeWellInfo.notes}
                  onChange={(e) =>
                    patchWellInfo({ notes: e.target.value })
                  }
                />
              </FormField>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <WorkspaceSection
            title="Email / Login Contacts"
            description="Local UI-only contacts. No backend contact endpoint is documented yet."
            badge="Endpoint backend untuk fitur ini belum tersedia."
          >
            {canManageConfiguration ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraftContact({ ...emptyContact, id: "" });
                    setSelectedContactId("");
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add Contact
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.message("Endpoint backend untuk fitur ini belum tersedia.")
                  }
                  disabled
                >
                  <ArrowUpFromLine className="mr-2 size-4" />
                  Import CSV
                </Button>
                <Button variant="outline" onClick={deleteSelectedContact} disabled={!selectedContactId}>
                  <Trash2 className="mr-2 size-4" />
                  Delete Selected
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-dashed p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow
                        key={contact.id}
                        className={selectedContactId === contact.id ? "bg-muted/60" : ""}
                        onClick={() => {
                          setSelectedContactId(contact.id);
                          setDraftContact(contact);
                        }}
                      >
                        <TableCell>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-xs text-muted-foreground">{contact.email}</div>
                        </TableCell>
                        <TableCell>{contact.company}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contact.accessLevel}</Badge>
                        </TableCell>
                        <TableCell>{contact.active ? "Active" : "Disabled"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="border-dashed p-4">
                <h4 className="font-medium">Contact Detail</h4>
                <div className="mt-4 space-y-4">
                  <FormField label="Name">
                    <Input
                      value={safeDraftContact.name}
                      onChange={(e) =>
                        setDraftContact((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Email">
                    <Input
                      value={safeDraftContact.email}
                      onChange={(e) =>
                        setDraftContact((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Company">
                    <Input
                      value={safeDraftContact.company}
                      onChange={(e) =>
                        setDraftContact((prev) => ({ ...prev, company: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Access Level">
                    <Select
                      value={safeDraftContact.accessLevel}
                      onValueChange={(value) =>
                        setDraftContact((prev) => ({
                          ...prev,
                          accessLevel: value as PolarisAccessLevel,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessLevels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">Active Contact</div>
                      <div className="text-xs text-muted-foreground">
                        Controls whether this user appears in the software contact list.
                      </div>
                    </div>
                    <Switch
                      checked={safeDraftContact.active}
                      onCheckedChange={(checked) =>
                        setDraftContact((prev) => ({ ...prev, active: checked }))
                      }
                    />
                  </div>
                  {canManageConfiguration ? (
                    <Button className="w-full" onClick={saveContactDraft}>
                      Save Contact
                    </Button>
                  ) : null}
                </div>
              </Card>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-4">
          <WorkspaceSection
            title="Surveys Configuration"
            description="Configure survey calculations, report columns, rig-port source, and wellplan survey actions."
            badge="Wellplan import placeholder"
          >
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.9fr]">
              <div className="space-y-4 xl:col-span-2">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-4">
                    <Card className="border-dashed p-4">
                      <h4 className="font-medium">Units and Directional Setup</h4>
                      <div className="mt-4 space-y-4">
                        <FormField label="Units of Measurement">
                          <Select
                            value={safeSurveyConfig.units}
                            onValueChange={(value) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                units: value as PolarisSurveyConfiguration["units"],
                                surveyDoglegUnit:
                                  value === "imperial" ? "Degrees / 100 ft" : "Degrees / 30 m",
                                plotPaperNote:
                                  value === "imperial"
                                    ? "U.S. paper and plot scales active."
                                    : "Metric paper and plot scales active.",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="imperial">U.S.</SelectItem>
                              <SelectItem value="metric">Metric</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                          <div>Dogleg: {safeSurveyConfig.surveyDoglegUnit}</div>
                          <div className="mt-1 text-xs">{safeSurveyConfig.plotPaperNote}</div>
                        </div>

                        <FormField label="Proposed Azimuth">
                          <Input
                            type="number"
                            value={safeSurveyConfig.proposedAzimuth}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                proposedAzimuth: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Survey Depth">
                          <Input
                            type="number"
                            value={safeSurveyConfig.surveyDepthOffset}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                surveyDepthOffset: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="North Reference">
                          <Select
                            value={safeSurveyConfig.northReference}
                            onValueChange={(value) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                northReference: value as PolarisSurveyConfiguration["northReference"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">True North</SelectItem>
                              <SelectItem value="magnetic">Magnetic North</SelectItem>
                              <SelectItem value="grid">Grid North</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label="Declination">
                          <Input
                            type="number"
                            value={safeSurveyConfig.magneticDeclination}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                magneticDeclination: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <div className="text-xs text-muted-foreground">
                          North reference and declination are used for survey header/report display.
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card className="border-dashed p-4">
                      <h4 className="font-medium">National Geophysical Data Center</h4>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <FormField label="Latitude">
                          <Input
                            value={safeSurveyConfig.latitude}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, latitude: e.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Longitude">
                          <Input
                            value={safeSurveyConfig.longitude}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, longitude: e.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Northing">
                          <Input
                            type="number"
                            value={safeSurveyConfig.northing}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                northing: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Easting">
                          <Input
                            type="number"
                            value={safeSurveyConfig.easting}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                easting: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="KB">
                          <Input
                            type="number"
                            value={safeSurveyConfig.kb}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, kb: Number(e.target.value) }))
                            }
                          />
                        </FormField>
                        <FormField label="DF">
                          <Input
                            type="number"
                            value={safeSurveyConfig.df}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, df: Number(e.target.value) }))
                            }
                          />
                        </FormField>
                        <FormField label="GL">
                          <Input
                            type="number"
                            value={safeSurveyConfig.gl}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({ ...prev, gl: Number(e.target.value) }))
                            }
                          />
                        </FormField>
                        <FormField label="Subsea Depth">
                          <Input
                            type="number"
                            value={safeSurveyConfig.subseaDepth}
                            onChange={(e) =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                subseaDepth: Number(e.target.value),
                              }))
                            }
                          />
                        </FormField>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border bg-muted/20 px-3 py-2">
                          Northing/Easting support closure calculations when positional math is enabled.
                        </div>
                        <div className="rounded-lg border bg-muted/20 px-3 py-2">
                          Latitude/longitude, KB, DF, GL, and subsea depth feed headers and TVDSS plot output.
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                <Card className="border-dashed p-4">
                  <h4 className="font-medium">Current Survey Notes</h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Proposed Azimuth
                      </div>
                      <SummaryValue>{safeSurveyConfig.proposedAzimuth}</SummaryValue>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Survey Depth Offset
                      </div>
                      <SummaryValue>{safeSurveyConfig.surveyDepthOffset}</SummaryValue>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rig Port Source
                      </div>
                      <SummaryValue>
                        {safeSurveyConfig.surveyRigPortSource === "database"
                          ? "Survey Database"
                          : "Real-time Decoder"}
                      </SummaryValue>
                    </div>
                    <div className="min-w-0 rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Wellplan File
                      </div>
                      <SummaryValue>{safeSurveyConfig.importWellplanFile}</SummaryValue>
                    </div>
                  </div>
                </Card>

                <Card className="border-dashed p-4">
                  <h4 className="font-medium">Well Plan Surveys</h4>
                  <div className="mt-4 flex flex-col gap-3">
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        toast.message("Wellplan CSV import remains a placeholder in Phase 1.")
                      }
                    >
                      <FileSpreadsheet className="mr-2 size-4" />
                      Import Wellplan surveys from CSV file...
                    </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate("configuration-wellplan-surveys");
                        return;
                      }
                      router.push(getAppPagePath("configuration-wellplan-surveys"));
                    }}
                  >
                    Edit Wellplan surveys
                  </Button>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border-dashed p-4">
                  <h4 className="font-medium">Survey Reports and Plot Output</h4>
                  <div className="mt-4 space-y-4">
                    <FormField label="Columns on Survey Reports">
                      <Input
                        value={safeSurveyConfig.surveyReportColumns}
                        onChange={(e) =>
                          setSurveyConfig((prev) => ({
                            ...prev,
                            surveyReportColumns: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        toast.message("Survey reports tab configuration remains a placeholder.")
                      }
                    >
                      Open Survey Reports Tab
                    </Button>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 font-medium">Survey data sent to rig port</div>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 text-sm leading-snug">
                          <input
                            type="radio"
                            name="surveyRigPortSource"
                            checked={safeSurveyConfig.surveyRigPortSource === "database"}
                            onChange={() =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                surveyRigPortSource: "database",
                              }))
                            }
                          />
                          <span>From Survey Database</span>
                        </label>
                        <label className="flex items-start gap-3 text-sm leading-snug">
                          <input
                            type="radio"
                            name="surveyRigPortSource"
                            checked={safeSurveyConfig.surveyRigPortSource === "realtime"}
                            onChange={() =>
                              setSurveyConfig((prev) => ({
                                ...prev,
                                surveyRigPortSource: "realtime",
                              }))
                            }
                          />
                          <span>Real-time MWD Decoder</span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 font-medium">Survey Data on Plots</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ["Inclination", safeSurveyConfig.plotInclination, "plotInclination"],
                          ["Azimuth", safeSurveyConfig.plotAzimuth, "plotAzimuth"],
                          ["TVD", safeSurveyConfig.plotTvd, "plotTvd"],
                          ["Vertical Section", safeSurveyConfig.plotVerticalSection, "plotVerticalSection"],
                          ["North/South", safeSurveyConfig.plotNorthSouth, "plotNorthSouth"],
                          ["East/West", safeSurveyConfig.plotEastWest, "plotEastWest"],
                          ["DogLeg Severity", safeSurveyConfig.outputDoglegSeverity, "outputDoglegSeverity"],
                        ] as const).map(([label, checked, key]) => (
                          <label
                            key={label}
                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-xs sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm"
                          >
                            <span className="min-w-0 break-words leading-tight sm:leading-snug [overflow-wrap:anywhere]">
                              {label}
                            </span>
                            <Checkbox
                              className="shrink-0 self-center data-[state=checked]:scale-95 sm:data-[state=checked]:scale-100"
                              checked={Boolean(checked)}
                              onCheckedChange={(value) =>
                                setSurveyConfig((prev) => ({
                                  ...prev,
                                  [key]: value === true,
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 font-medium">Additional Survey Output</div>
                      <div className="grid gap-3">
                        {([
                          ["Output Coordinates", safeSurveyConfig.outputCoordinates, "outputCoordinates"],
                          ["Output TVDSS", safeSurveyConfig.outputTvdss, "outputTvdss"],
                        ] as const).map(([label, checked, key]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between rounded-lg border px-3 py-2"
                          >
                            <div className="font-medium">{label}</div>
                            <Switch
                              checked={Boolean(checked)}
                              onCheckedChange={(value) =>
                                setSurveyConfig((prev) => ({
                                  ...prev,
                                  [key]: value,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="wits" className="space-y-4">
          <WorkspaceSection
            title="WITS ID Configuration"
            description="Manage logging, scaling, alarms, LAS mapping, plot configuration, and memory import storage per WITS record."
            badge="Backend /api/wits-config"
          >
            {witsViewMode === "list" ? (
              <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Memory module import follows the Polaris flow: create a unique storage WITS ID, mark it for memory import storage, open that WITS ID editor, scan CSV segments, import the selected field, then correlate to hole depth. Good examples: 7001, 2055, 8023. Bad examples: 0126, 0166, 0855.
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void loadWitsConfigFromApi()}
                    disabled={witsConfigLoading}
                  >
                    <RefreshCw className={cn("mr-2 size-4", witsConfigLoading && "animate-spin")} />
                    Refresh API
                  </Button>
                  {canManageWitsConfig ? (
                    <Button
                      variant="outline"
                      onClick={() => void addMemoryStorageWitsId()}
                      disabled={witsConfigSaving}
                    >
                      <Plus className={cn("mr-2 size-4", witsConfigSaving && "animate-spin")} />
                      Add Memory Storage WITS ID
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!canManageWitsConfig ? (
              <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                WITS config create, update, and delete actions are available only for admin or engineer users.
              </div>
            ) : null}
            {witsConfigError ? (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {witsConfigError}
              </div>
            ) : null}

            <div className="grid gap-4">
              {witsViewMode === "list" ? (
                <Card className="border-dashed p-4">
                {canManageWitsConfig ? (
                <div className="mb-4 rounded-lg border bg-card p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <FormField label="Add WITS ID">
                      <Input
                        inputMode="numeric"
                        placeholder="e.g. 1234"
                        value={newWitsIdInput}
                        disabled={!canManageWitsConfig}
                        onChange={(e) => {
                          setNewWitsIdInput(e.target.value);
                          setNewWitsIdError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void addWitsIdFromInput();
                          }
                        }}
                      />
                    </FormField>
                    <Button
                      onClick={() => void addWitsIdFromInput()}
                      disabled={witsConfigSaving || !canManageWitsConfig}
                    >
                      <Plus className={cn("mr-2 size-4", witsConfigSaving && "animate-spin")} />
                      Add
                    </Button>
                  </div>
                  {newWitsIdError ? (
                    <p className="mt-2 text-xs text-destructive">{newWitsIdError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Numbers only, 1-4 digits, and must not duplicate an existing WITS ID.
                    </p>
                  )}
                </div>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Plot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {witsIds.length === 0 && !witsConfigLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          Belum ada konfigurasi WITS. Tambahkan WITS ID terlebih dahulu.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {witsIds.map((item) => (
                      <TableRow
                        key={item.id}
                        className={selectedWitsId === item.id ? "bg-muted/60" : ""}
                        onClick={() => void openWitsDetail(item.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{item.numericId}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.enabled ? "Enabled" : "Disabled"}
                          </div>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">{item.dataSourceMode}</Badge>
                            {item.useForMemoryImportStorage ? (
                              <Badge variant="secondary">Memory</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{item.realTimePlot}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              ) : null}

              {witsViewMode === "detail" && activeWitsRecord ? (
                <Card className="border-dashed p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium">{activeWitsRecord.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        WITS ID {activeWitsRecord.numericId} configuration editor
                      </p>
                      {witsConfigDetailLoading ? (
                        <p className="mt-1 text-xs text-muted-foreground">Loading backend detail...</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => setWitsViewMode("list")}>
                        Back to WITS ID list
                      </Button>
                      {canManageWitsConfig ? (
                        <Button
                          variant="outline"
                          className="border-red-400/40 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => void deleteActiveWits()}
                          disabled={witsConfigDeleting}
                        >
                          <Trash2 className={cn("mr-2 size-4", witsConfigDeleting && "animate-spin")} />
                          Delete
                        </Button>
                      ) : null}
                      <Switch
                        checked={activeWitsRecord.enabled}
                        disabled={!canManageWitsConfig}
                        onCheckedChange={(value) => updateActiveWits({ enabled: value })}
                      />
                    </div>
                  </div>

                  <Tabs defaultValue="general" className="space-y-4">
                    <TabsList className="h-auto flex-wrap justify-start">
                      <TabsTrigger value="general">General</TabsTrigger>
                      {canManageWitsConfig ? <TabsTrigger value="memory">Memory Import</TabsTrigger> : null}
                    </TabsList>

                    <TabsContent value="general" className="space-y-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h5 className="font-semibold">General Information</h5>
                              <p className="text-xs text-muted-foreground">
                                Backend WITS ID identity, scaling, mapped field, unit, and bit spacing.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                              <Label className="text-xs">Enable Logging</Label>
                              <Switch
                                checked={activeWitsRecord.enabled}
                                disabled={!canManageWitsConfig}
                                onCheckedChange={(value) => updateActiveWits({ enabled: value })}
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField label="WITS ID">
                              <Input
                                type="number"
                                value={activeWitsRecord.numericId}
                                onChange={(e) =>
                                  updateActiveWits({ numericId: Number(e.target.value) })
                                }
                              />
                            </FormField>
                            <FormField label="Name">
                              <Input
                                value={activeWitsRecord.name}
                                onChange={(e) => updateActiveWits({ name: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Units">
                              <Input
                                value={activeWitsRecord.units}
                                onChange={(e) => updateActiveWits({ units: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Decimal Places">
                              <Input
                                type="number"
                                value={activeWitsRecord.decimalPlaces}
                                onChange={(e) =>
                                  updateActiveWits({ decimalPlaces: Number(e.target.value) })
                                }
                              />
                            </FormField>
                            <FormField label="Scale Factor">
                              <Input
                                type="number"
                                value={activeWitsRecord.scaleFactor}
                                onChange={(e) =>
                                  updateActiveWits({ scaleFactor: Number(e.target.value) })
                                }
                              />
                            </FormField>
                            <FormField label="Bias Offset">
                              <Input
                                type="number"
                                value={activeWitsRecord.biasOffset}
                                onChange={(e) =>
                                  updateActiveWits({ biasOffset: Number(e.target.value) })
                                }
                              />
                            </FormField>
                            <FormField label="Sensor To Bit Spacing">
                              <Input
                                type="number"
                                value={activeWitsRecord.sensorToBitSpacing}
                                onChange={(e) =>
                                  updateActiveWits({ sensorToBitSpacing: Number(e.target.value) })
                                }
                              />
                            </FormField>
                            <FormField label="Depth Tracking">
                              <Input
                                value={activeWitsRecord.depthTracking}
                                onChange={(e) => updateActiveWits({ depthTracking: e.target.value })}
                              />
                            </FormField>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h5 className="font-semibold">Real-Time Plot</h5>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <FormField label="Real-Time Plot">
                              <Input
                                value={activeWitsRecord.realTimePlot}
                                onChange={(e) => updateActiveWits({ realTimePlot: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Plot Scale Info">
                              <Input
                                value={activeWitsRecord.plotScaleInfo}
                                onChange={(e) => updateActiveWits({ plotScaleInfo: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Left Scale">
                              <Input
                                type="number"
                                value={activeWitsRecord.leftScale}
                                onChange={(e) => updateActiveWits({ leftScale: Number(e.target.value) })}
                              />
                            </FormField>
                            <FormField label="Right Scale">
                              <Input
                                type="number"
                                value={activeWitsRecord.rightScale}
                                onChange={(e) => updateActiveWits({ rightScale: Number(e.target.value) })}
                              />
                            </FormField>
                            <FormField label="Line Color">
                              <Input
                                type="color"
                                value={activeWitsRecord.lineColor}
                                onChange={(e) => updateActiveWits({ lineColor: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Wrap Color">
                              <Input
                                type="color"
                                value={activeWitsRecord.wrapColor}
                                onChange={(e) => updateActiveWits({ wrapColor: e.target.value })}
                              />
                            </FormField>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h5 className="font-semibold">Output / Transmission</h5>
                          <div className="mt-4 grid gap-3">
                            {([
                              ["Send to AUX port", activeWitsRecord.sendToAux, "sendToAux"],
                              ["Send to Rig WITS port", activeWitsRecord.sendToRigWits, "sendToRigWits"],
                              ["Do Not Repeat", activeWitsRecord.doNotRepeat, "doNotRepeat"],
                              ["Use for Memory Import Storage", activeWitsRecord.useForMemoryImportStorage, "useForMemoryImportStorage"],
                            ] as const).map(([label, checked, key]) => (
                              <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                                <div className="font-medium">{label}</div>
                                <Switch
                                  checked={Boolean(checked)}
                                  onCheckedChange={(value) =>
                                    updateActiveWits({ [key]: value } as Partial<PolarisWitsId>)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h5 className="font-semibold">LAS Settings</h5>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <FormField label="LAS Tag">
                              <Input
                                value={activeWitsRecord.lasMnemonic}
                                onChange={(e) => updateActiveWits({ lasMnemonic: e.target.value })}
                              />
                            </FormField>
                            <FormField label="LAS Filter">
                              <Input
                                type="number"
                                value={activeWitsRecord.lasFilter}
                                onChange={(e) => updateActiveWits({ lasFilter: Number(e.target.value) })}
                              />
                            </FormField>
                            <div className="md:col-span-2">
                              <FormField label="LAS Description">
                                <Input
                                  value={activeWitsRecord.lasDescription}
                                  onChange={(e) => updateActiveWits({ lasDescription: e.target.value })}
                                />
                              </FormField>
                            </div>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <h5 className="font-semibold">Alarm Settings</h5>
                              <p className="text-xs text-muted-foreground">
                                Backend alarm min/max thresholds for this WITS channel.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                              <Label className="text-xs">Enable Alarm</Label>
                              <Switch
                                checked={activeWitsRecord.alarmEnabled}
                                onCheckedChange={(value) => updateActiveWits({ alarmEnabled: value })}
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField label="Alarm Low">
                              <Input
                                type="number"
                                value={activeWitsRecord.alarmLow}
                                onChange={(e) => updateActiveWits({ alarmLow: Number(e.target.value) })}
                              />
                            </FormField>
                            <FormField label="Alarm High">
                              <Input
                                type="number"
                                value={activeWitsRecord.alarmHigh}
                                onChange={(e) => updateActiveWits({ alarmHigh: Number(e.target.value) })}
                              />
                            </FormField>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h5 className="font-semibold">Data Source</h5>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <FormField label="Data Source Type">
                              <Select
                                value={activeWitsRecord.dataSourceType}
                                onValueChange={(value) =>
                                  updateActiveWits({ dataSourceType: value as WitsIdDataSourceType })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="serial">Serial Port WITS</SelectItem>
                                  <SelectItem value="constant">Constant Value</SelectItem>
                                  <SelectItem value="1DivX.sh">1DivX.sh</SelectItem>
                                  <SelectItem value="1kDivDenom.sh">1kDivDenom.sh</SelectItem>
                                  <SelectItem value="add.sh">add.sh</SelectItem>
                                  <SelectItem value="azinc.sh">azinc.sh</SelectItem>
                                  <SelectItem value="degC2degF.sh">degC2degF.sh</SelectItem>
                                  <SelectItem value="degF2degC.sh">degF2degC.sh</SelectItem>
                                  <SelectItem value="divide.sh">divide.sh</SelectItem>
                                  <SelectItem value="duplicate.sh">duplicate.sh</SelectItem>
                                  <SelectItem value="ecd.sh">ecd.sh</SelectItem>
                                  <SelectItem value="ftPerHour2minPerFt.sh">ftPerHour2minPerFt.sh</SelectItem>
                                  <SelectItem value="subtract.sh">subtract.sh</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormField>
                            <FormField label="Value">
                              <Input
                                type="number"
                                value={activeWitsRecord.dataSourceValue}
                                onChange={(e) => updateActiveWits({ dataSourceValue: Number(e.target.value) })}
                                disabled={activeWitsRecord.dataSourceType !== "constant"}
                              />
                            </FormField>
                            <FormField label="Data Source Mode">
                              <Select
                                value={activeWitsRecord.dataSourceMode}
                                onValueChange={(value) =>
                                  updateActiveWits({
                                    dataSourceMode: value as PolarisDataSourceMode,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {dataSourceModes.map((mode) => (
                                    <SelectItem key={mode} value={mode}>
                                      {mode}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormField>
                            <div className="md:col-span-2">
                              <FormField label="Scripting / Data Source UI Placeholder">
                                <Textarea
                                  rows={5}
                                  value={activeWitsRecord.scriptNotes}
                                  onChange={(e) => updateActiveWits({ scriptNotes: e.target.value })}
                                />
                              </FormField>
                            </div>
                          </div>
                        </Card>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {canManageWitsConfig ? (
                          <>
                            <Button variant="outline" onClick={() => toast.message("Current editor values are already held in local state.")}>
                              Reset / Cancel
                            </Button>
                            <Button
                              onClick={() => void saveActiveWits()}
                              disabled={witsConfigSaving}
                            >
                              <Save className={cn("mr-2 size-4", witsConfigSaving && "animate-spin")} />
                              Save Changes
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="memory" className="space-y-4">
                      {canManageWitsConfig ? (
                        <WitsMemoryImportPanel
                          activeWitsRecord={activeWitsRecord}
                          allWitsIds={witsIds}
                          onUpdateWits={updateActiveWits}
                        />
                      ) : null}
                    </TabsContent>
                  </Tabs>
                </Card>
              ) : null}
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="decoder" className="space-y-4">
          <WorkspaceSection
            title="Decoder Configuration"
            description="Local UI-only decoder draft. No decoder config endpoint is documented yet."
            badge="Endpoint backend untuk fitur ini belum tersedia."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Tool Type">
                <Select
                  value={safeDecoderConfig.toolType}
                  onValueChange={(value) =>
                    setDecoderConfig((prev) => ({
                      ...prev,
                      toolType: value as PolarisToolType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toolTypes.map((toolType) => (
                      <SelectItem key={toolType} value={toolType}>
                        {toolType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Toolface Mode Inclination">
                <Input
                  type="number"
                  value={safeDecoderConfig.toolfaceModeInclination}
                  onChange={(e) =>
                    setDecoderConfig((prev) => ({
                      ...prev,
                      toolfaceModeInclination: Number(e.target.value),
                    }))
                  }
                />
              </FormField>
              <FormField label="WITS Output Timer (sec)">
                <Input
                  type="number"
                  value={safeDecoderConfig.witsOutputTimer}
                  onChange={(e) =>
                    setDecoderConfig((prev) => ({
                      ...prev,
                      witsOutputTimer: Number(e.target.value),
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="mt-5">
              <FormField label="GV Tag Mapping">
                <Textarea
                  rows={7}
                  value={safeDecoderConfig.gvTagMapping}
                  onChange={(e) =>
                    setDecoderConfig((prev) => ({ ...prev, gvTagMapping: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </WorkspaceSection>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <WorkspaceSection
            title="System Info"
            description="Local UI-only SMTP/report draft. Email report endpoints must be active before delivery is enabled."
            badge="Endpoint backend untuk fitur ini belum tersedia."
          >
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-dashed p-4">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">SMTP Configuration</h4>
                    <p className="text-sm text-muted-foreground">
                      Software-side email profile only. No external driver or OS setup is included.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <FormField label="SMTP Host">
                    <Input
                      value={safeSystemInfo.smtpHost}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, smtpHost: e.target.value }))
                      }
                    />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="SMTP Port">
                      <Input
                        type="number"
                        value={safeSystemInfo.smtpPort}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({
                            ...prev,
                            smtpPort: Number(e.target.value),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Username">
                      <Input
                        value={safeSystemInfo.username}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({ ...prev, username: e.target.value }))
                        }
                      />
                    </FormField>
                  </div>
                  <FormField label="Sender Email">
                    <Input
                      value={safeSystemInfo.senderEmail}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, senderEmail: e.target.value }))
                      }
                    />
                  </FormField>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.message("Email reports belum aktif.")
                    }
                    disabled
                  >
                    Test SMTP Profile
                  </Button>
                </div>
              </Card>

              <Card className="border-dashed p-4">
                <div className="flex items-start gap-2">
                  <Binary className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Templates and Branding</h4>
                    <p className="text-sm text-muted-foreground">
                      Subject/body template, signature field, and upload placeholders for report logos.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <FormField label="Subject Template">
                    <Input
                      value={safeSystemInfo.subjectTemplate}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({
                          ...prev,
                          subjectTemplate: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Body Template">
                    <Textarea
                      rows={4}
                      value={safeSystemInfo.bodyTemplate}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, bodyTemplate: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Signature">
                    <Textarea
                      rows={3}
                      value={safeSystemInfo.signature}
                      onChange={(e) =>
                        setSystemInfo((prev) => ({ ...prev, signature: e.target.value }))
                      }
                    />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Report Logo Light">
                      <Input
                        value={safeSystemInfo.reportLogoLight}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({
                            ...prev,
                            reportLogoLight: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Report Logo Dark">
                      <Input
                        value={safeSystemInfo.reportLogoDark}
                        onChange={(e) =>
                          setSystemInfo((prev) => ({
                            ...prev,
                            reportLogoDark: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </Card>
            </div>

            <PlaceholderNote>
              Endpoint backend untuk fitur ini belum tersedia. Jika backend email report mengembalikan 503, tampilkan "Email reports belum aktif".
            </PlaceholderNote>
          </WorkspaceSection>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="font-medium">Phase 1 scope marker</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Backend-backed sections must use documented endpoints only. UI-only sections are labelled as local drafts and are not operational source data.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout
      currentPage="configuration"
      onNavigate={(page) => router.push(getAppPagePath(page))}
    >
      {content}
    </AppLayout>
  );
}
