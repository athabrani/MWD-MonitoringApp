"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileArchive,
  HardDrive,
  Info,
  Network,
  RefreshCw,
  ServerCog,
  Trash2,
  Upload,
  Wifi,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { WorkspaceSection } from "@/components/layouts/workspace-section";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  backupConfiguration,
  backupSession,
  clearData,
  getClearDataTargets,
  getConfigBackupTargets,
  previewClearData,
  restoreConfiguration,
  restoreSession,
  type ClearDataPreviewResponse,
} from "@/lib/api/system-utilities";
import { getSurveys } from "@/lib/surveys-api";
import { getSafeErrorMessage, logSecurityError } from "@/lib/security/errors";
import { parseFiniteNumber, validateDepthRange, validateJsonFile } from "@/lib/security/input";
import { requireActionPermission } from "@/lib/security/permissions";
import { cn } from "@/lib/utils";

type BackupJson = Record<string, unknown>;

const clearTargetLabels: Record<string, string> = {
  mwd_data: "MWD Data",
  wits_values: "WITS Values",
  wits_alarms: "WITS Alarms",
  surveys: "Surveys",
  depth_tracking: "Depth Tracking",
  wits_output: "WITS Output",
  edit_history: "Edit History",
};

const configTargetLabels: Record<string, string> = {
  wits_configs: "WITS Configurations",
  plot_templates: "Plot Templates",
};

function runUnavailableAction() {
  toast.message("Endpoint backend untuk fitur ini belum tersedia.");
}

function targetLabel(target: string, labels: Record<string, string>) {
  return labels[target] ?? target.replaceAll("_", " ");
}

function timestampForFileName() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function isBackupObject(value: unknown): value is BackupJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length > 0;
}

function unwrapBackupJson(value: BackupJson): BackupJson {
  const nestedBackup = value.backup;
  if (isBackupObject(nestedBackup)) {
    return nestedBackup;
  }

  return value;
}

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readJsonFile(file: File): Promise<BackupJson> {
  return new Promise((resolve, reject) => {
    const validationError = validateJsonFile(file, { maxSizeMb: 5 });
    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ""));
        if (!isBackupObject(parsed)) {
          reject(new Error("Backup JSON must be a non-empty object."));
          return;
        }
        resolve(unwrapBackupJson(parsed));
      } catch {
        reject(new Error("Backup file contains invalid JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read backup file."));
    reader.readAsText(file);
  });
}

function UtilityActionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl p-3 sm:rounded-2xl sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 gap-2.5 sm:gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-10 sm:rounded-xl">
            <Icon className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">{description}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div>
      </div>
    </Card>
  );
}

function SessionSelector({
  activeMwdSessionId,
  disabled,
  mwdSessions,
  setActiveMwdSessionId,
}: {
  activeMwdSessionId: string;
  disabled?: boolean;
  mwdSessions: Array<{ id: string; name: string; wellName?: string; jobName?: string }>;
  setActiveMwdSessionId: (sessionId: string) => void;
}) {
  return (
    <div className="space-y-1.5 sm:space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">Active Session / Job</Label>
      <Select value={activeMwdSessionId} onValueChange={setActiveMwdSessionId} disabled={disabled || mwdSessions.length === 0}>
        <SelectTrigger>
          <SelectValue placeholder="Select active session" />
        </SelectTrigger>
        <SelectContent>
          {mwdSessions.map((session) => (
            <SelectItem key={session.id} value={session.id}>
              {session.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TargetCheckboxList({
  labelMap,
  selectedTargets,
  targets,
  toggleTarget,
}: {
  labelMap: Record<string, string>;
  selectedTargets: string[];
  targets: string[];
  toggleTarget: (target: string) => void;
}) {
  if (targets.length === 0) {
    return <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Endpoint backend untuk fitur ini belum tersedia.</div>;
  }

  return (
    <div className="grid gap-1.5 min-[420px]:grid-cols-2 sm:gap-2">
      {targets.map((target) => (
        <label key={target} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/40 sm:min-h-11 sm:gap-3 sm:rounded-xl sm:p-3">
          <Checkbox checked={selectedTargets.includes(target)} onCheckedChange={() => toggleTarget(target)} />
          <span className="min-w-0 text-xs font-medium capitalize leading-tight sm:text-sm">{targetLabel(target, labelMap)}</span>
        </label>
      ))}
    </div>
  );
}

function DatabaseTab({
  activeMwdSessionId,
  clearTargets,
  configTargets,
  configTargetsError,
  configTargetsLoading,
  isAdmin,
  mwdSessions,
  refreshAfterConfigRestore,
  refreshAfterDataMutation,
  setActiveMwdSessionId,
  token,
}: {
  activeMwdSessionId: string;
  clearTargets: string[];
  configTargets: string[];
  configTargetsError: string;
  configTargetsLoading: boolean;
  isAdmin: boolean;
  mwdSessions: Array<{ id: string; name: string; wellName?: string; jobName?: string }>;
  refreshAfterConfigRestore: () => Promise<void>;
  refreshAfterDataMutation: () => Promise<void>;
  setActiveMwdSessionId: (sessionId: string) => void;
  token: string | null;
}) {
  const sessionRestoreInputRef = useRef<HTMLInputElement | null>(null);
  const configRestoreInputRef = useRef<HTMLInputElement | null>(null);
  const [startDepth, setStartDepth] = useState(0);
  const [endDepth, setEndDepth] = useState(99999);
  const [selectedSessionTargets, setSelectedSessionTargets] = useState<string[]>([]);
  const [selectedConfigTargets, setSelectedConfigTargets] = useState<string[]>([]);
  const [sessionBackupLoading, setSessionBackupLoading] = useState(false);
  const [sessionRestoreLoading, setSessionRestoreLoading] = useState(false);
  const [configBackupLoading, setConfigBackupLoading] = useState(false);
  const [configRestoreLoading, setConfigRestoreLoading] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [sessionBackupJson, setSessionBackupJson] = useState<BackupJson | null>(null);
  const [sessionBackupFileName, setSessionBackupFileName] = useState("");
  const [configBackupJson, setConfigBackupJson] = useState<BackupJson | null>(null);
  const [configBackupFileName, setConfigBackupFileName] = useState("");
  const [configBackupCounts, setConfigBackupCounts] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState("");
  const toggleSessionTarget = (target: string) => {
    setSelectedSessionTargets((current) =>
      current.includes(target) ? current.filter((item) => item !== target) : [...current, target]
    );
  };
  const toggleConfigTarget = (target: string) => {
    setSelectedConfigTargets((current) =>
      current.includes(target) ? current.filter((item) => item !== target) : [...current, target]
    );
  };

  useEffect(() => {
    setSelectedSessionTargets((current) => current.filter((target) => clearTargets.includes(target)));
  }, [clearTargets]);

  useEffect(() => {
    setSelectedConfigTargets((current) => current.filter((target) => configTargets.includes(target)));
  }, [configTargets]);

  const validateSessionBackupPayload = () => {
    if (!token) return "Backend login is required.";
    if (!isAdmin) return "Only admin users can use System Utilities.";
    if (!activeMwdSessionId) return "Select an active MWD session.";
    const depthError = validateDepthRange(startDepth, endDepth);
    if (depthError) return depthError;
    if (selectedSessionTargets.length === 0) return "Select at least one data target.";
    return "";
  };

  const handleBackupSession = async () => {
    const validationError = validateSessionBackupPayload();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSessionBackupLoading(true);
    setActionError("");

    try {
      const response = await backupSession(token!, {
        sessionId: activeMwdSessionId,
        startDepth,
        endDepth,
        targets: selectedSessionTargets,
      });
      downloadJsonFile(response.backup, `mwd-session-backup-session-${activeMwdSessionId}-${timestampForFileName()}.json`);
      toast.success("Backup downloaded successfully");
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to backup session.");
      setActionError(message);
      toast.error("Unable to backup session", { description: message });
    } finally {
      setSessionBackupLoading(false);
    }
  };

  const handleReadSessionBackupFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await readJsonFile(file);
      setSessionBackupJson(parsed);
      setSessionBackupFileName(file.name);
      toast.success("Session backup JSON loaded");
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to read session backup.");
      setSessionBackupJson(null);
      setSessionBackupFileName("");
      toast.error("Invalid backup file", { description: message });
    } finally {
      if (sessionRestoreInputRef.current) sessionRestoreInputRef.current.value = "";
    }
  };

  const handleRestoreSession = async () => {
    const permissionError = requireActionPermission(isAdmin ? { role: "admin" } : null, "system:restore");
    if (permissionError) {
      toast.error(permissionError);
      return;
    }
    if (!token) {
      toast.error("Backend login is required.");
      return;
    }
    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session.");
      return;
    }
    if (!isBackupObject(sessionBackupJson)) {
      toast.error("Load a non-empty session backup JSON first.");
      return;
    }
    if (selectedSessionTargets.length === 0) {
      toast.error("Select at least one restore target.");
      return;
    }

    setSessionRestoreLoading(true);
    setActionError("");

    try {
      await restoreSession(token, {
        sessionId: activeMwdSessionId,
        replaceExisting,
        targets: selectedSessionTargets,
        backup: sessionBackupJson,
        confirm: `RESTORE_DATA_SESSION_${activeMwdSessionId}`,
      });
      toast.success("Restore session completed");
      await refreshAfterDataMutation();
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to restore session.");
      setActionError(message);
      toast.error("Unable to restore session", { description: message });
    } finally {
      setSessionRestoreLoading(false);
    }
  };

  const handleBackupConfiguration = async () => {
    const permissionError = requireActionPermission(isAdmin ? { role: "admin" } : null, "system:backup");
    if (permissionError) {
      toast.error(permissionError);
      return;
    }
    if (!token) {
      toast.error("Backend login is required.");
      return;
    }
    if (selectedConfigTargets.length === 0) {
      toast.error("Select at least one configuration target.");
      return;
    }

    setConfigBackupLoading(true);
    setActionError("");

    try {
      const response = await backupConfiguration(token, { targets: selectedConfigTargets });
      setConfigBackupCounts(response.counts ?? {});
      downloadJsonFile(response.backup, `mwd-config-backup-${timestampForFileName()}.json`);
      toast.success("Configuration backup downloaded");
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to backup configuration.");
      setActionError(message);
      toast.error("Unable to backup configuration", { description: message });
    } finally {
      setConfigBackupLoading(false);
    }
  };

  const handleReadConfigBackupFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await readJsonFile(file);
      if (typeof parsed.type === "string" && parsed.type !== "configuration_backup") {
        throw new Error("Selected JSON is not a configuration backup.");
      }
      setConfigBackupJson(parsed);
      setConfigBackupFileName(file.name);
      toast.success("Configuration backup JSON loaded");
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to read configuration backup.");
      setConfigBackupJson(null);
      setConfigBackupFileName("");
      toast.error("Invalid configuration backup", { description: message });
    } finally {
      if (configRestoreInputRef.current) configRestoreInputRef.current.value = "";
    }
  };

  const handleRestoreConfiguration = async () => {
    const permissionError = requireActionPermission(isAdmin ? { role: "admin" } : null, "system:restore");
    if (permissionError) {
      toast.error(permissionError);
      return;
    }
    if (!token) {
      toast.error("Backend login is required.");
      return;
    }
    if (!isBackupObject(configBackupJson)) {
      toast.error("Load a non-empty configuration backup JSON first.");
      return;
    }
    if (selectedConfigTargets.length === 0) {
      toast.error("Select at least one configuration target.");
      return;
    }

    setConfigRestoreLoading(true);
    setActionError("");

    try {
      await restoreConfiguration(token, {
        targets: selectedConfigTargets,
        backup: configBackupJson,
        confirm: "RESTORE_CONFIGURATION",
      });
      toast.success("Configuration restore completed");
      await refreshAfterConfigRestore();
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to restore configuration.");
      setActionError(message);
      toast.error("Unable to restore configuration", { description: message });
    } finally {
      setConfigRestoreLoading(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="rounded-xl p-3 sm:rounded-2xl sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
          <div>
            <h2 className="text-base font-semibold sm:text-lg">Depth-based Data Storage</h2>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">
              Back up and restore the depth database used by logged WITS channels.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
              Session {activeMwdSessionId || "not selected"}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
              {selectedSessionTargets.length} targets
            </Badge>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:mt-4">
          <Card className="rounded-xl border-dashed p-3 sm:rounded-2xl sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,0.9fr)] lg:gap-4">
              <SessionSelector
                activeMwdSessionId={activeMwdSessionId}
                disabled={!isAdmin}
                mwdSessions={mwdSessions}
                setActiveMwdSessionId={setActiveMwdSessionId}
              />
              <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-3">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">Start Depth</Label>
                  <Input type="number" value={startDepth} disabled={!isAdmin} onChange={(event) => setStartDepth(parseFiniteNumber(event.target.value, startDepth))} />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">End Depth</Label>
                  <Input type="number" value={endDepth} disabled={!isAdmin} onChange={(event) => setEndDepth(parseFiniteNumber(event.target.value, endDepth))} />
                </div>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-sm sm:normal-case sm:tracking-normal sm:text-foreground">
                Session Data Targets
              </div>
              <TargetCheckboxList
                labelMap={clearTargetLabels}
                selectedTargets={selectedSessionTargets}
                targets={clearTargets}
                toggleTarget={toggleSessionTarget}
              />
            </div>
          </Card>

          <UtilityActionCard
            icon={Database}
            title="Download Session Backup"
            description="Generate a session backup JSON for the selected depth range and targets."
          >
            <Button size="sm" className="h-9 text-xs sm:text-sm" onClick={() => void handleBackupSession()} disabled={!isAdmin || sessionBackupLoading || selectedSessionTargets.length === 0}>
              <Download className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
              {sessionBackupLoading ? "Backing up..." : "Backup Session"}
            </Button>
          </UtilityActionCard>

          <UtilityActionCard
            icon={Upload}
            title="Restore Session Data from JSON"
            description="Load a session backup JSON and restore selected targets after confirmation."
          >
            <Input
              type="file"
              ref={sessionRestoreInputRef}
              accept=".json,application/json"
              className="h-9 w-full text-xs sm:w-64 sm:text-sm"
              disabled={!isAdmin}
              onChange={(event) => void handleReadSessionBackupFile(event.target.files?.[0])}
            />
            <label className="flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
              <Checkbox checked={replaceExisting} disabled={!isAdmin} onCheckedChange={(checked) => setReplaceExisting(checked === true)} />
              Replace existing rows
            </label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs sm:text-sm"
                  disabled={!isAdmin || sessionRestoreLoading || !sessionBackupJson || selectedSessionTargets.length === 0}
                >
                  {sessionRestoreLoading ? "Restoring..." : "Restore Session"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore session data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action may overwrite operational data for session {activeMwdSessionId}. Make sure you trust the selected backup file.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  File: {sessionBackupFileName || "No file"}<br />
                  Targets: {selectedSessionTargets.map((target) => targetLabel(target, clearTargetLabels)).join(", ")}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleRestoreSession()}>
                    Confirm Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </UtilityActionCard>
        </div>
      </Card>

      <div className="grid gap-3 sm:gap-4 2xl:grid-cols-2">
        <Card className="rounded-xl p-3 sm:rounded-2xl sm:p-4">
          <h2 className="text-base font-semibold sm:text-lg">Configuration Backups</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">
            Back up configuration files and restore configuration snapshots. This does not back up logging data.
          </p>
          <div className="mt-3 grid gap-3 sm:mt-4">
            {configTargetsLoading ? <Badge variant="outline">Loading config targets</Badge> : null}
            {configTargetsError ? (
              <Alert variant="destructive" className="rounded-xl">
                <AlertTriangle className="size-4" />
                <AlertDescription>{configTargetsError}</AlertDescription>
              </Alert>
            ) : null}
            <TargetCheckboxList
              labelMap={configTargetLabels}
              selectedTargets={selectedConfigTargets}
              targets={configTargets}
              toggleTarget={toggleConfigTarget}
            />
            <UtilityActionCard
              icon={FileArchive}
              title="Download Configuration Backup"
              description="Generate a local JSON backup for selected configuration targets."
            >
              <Button size="sm" className="h-9 text-xs sm:text-sm" onClick={() => void handleBackupConfiguration()} disabled={!isAdmin || configBackupLoading || selectedConfigTargets.length === 0}>
                {configBackupLoading ? "Backing up..." : "Backup Configurations"}
              </Button>
            </UtilityActionCard>
            {Object.keys(configBackupCounts).length > 0 ? (
              <div className="rounded-xl border bg-muted/20 p-2.5 text-xs sm:p-3 sm:text-sm">
                <div className="font-medium">Last configuration backup counts</div>
                <div className="mt-2 grid gap-1">
                  {Object.entries(configBackupCounts).map(([target, count]) => (
                    <div key={target} className="flex justify-between gap-3">
                      <span>{targetLabel(target, configTargetLabels)}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <UtilityActionCard
              icon={Upload}
              title="Restore Configuration from JSON"
              description="Open a configuration backup JSON and restore selected targets after confirmation."
            >
              <Input
                ref={configRestoreInputRef}
                type="file"
                accept=".json,application/json"
                className="h-9 w-full text-xs sm:w-56 sm:text-sm"
                disabled={!isAdmin}
                onChange={(event) => void handleReadConfigBackupFile(event.target.files?.[0])}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="h-9 text-xs sm:text-sm" variant="outline" disabled={!isAdmin || configRestoreLoading || !configBackupJson || selectedConfigTargets.length === 0}>
                    {configRestoreLoading ? "Restoring..." : "Restore Configuration"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restore configuration?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action may overwrite WITS configurations or plot templates. Make sure the selected JSON is a trusted configuration backup.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                    File: {configBackupFileName || "No file"}<br />
                    Targets: {selectedConfigTargets.map((target) => targetLabel(target, configTargetLabels)).join(", ")}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleRestoreConfiguration()}>
                      Confirm Restore
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </UtilityActionCard>
          </div>
        </Card>

        <Card className="rounded-xl p-3 sm:rounded-2xl sm:p-4">
          <h2 className="text-base font-semibold sm:text-lg">Time-based Data Storage</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">
            Back up and restore the time logging database used for time-based acquisition.
          </p>
          <div className="mt-3 grid gap-3 sm:mt-4">
            <UtilityActionCard
              icon={HardDrive}
              title="Time logging database backup"
              description="Create a backup of time-indexed logging storage."
            >
              <Button size="sm" className="h-9 text-xs sm:text-sm" onClick={runUnavailableAction}>Backup</Button>
            </UtilityActionCard>
            <UtilityActionCard
              icon={Upload}
              title="Restore time data backup"
              description="Choose a time-data backup file and stage it for restore."
            >
              <Input type="file" accept=".bak,.zip,.db" className="h-9 w-full text-xs sm:w-56 sm:text-sm" />
              <Button size="sm" className="h-9 text-xs sm:text-sm" variant="outline" onClick={runUnavailableAction}>
                Restore File
              </Button>
            </UtilityActionCard>
          </div>
        </Card>
      </div>
      {actionError ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="size-4" />
          <AlertTitle>System Utilities Error</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

type DiagnosticLevel = "ok" | "warning" | "critical" | "unknown";

type DiagnosticStatusItem = {
  label: string;
  value: string;
  level: DiagnosticLevel;
  description?: string;
  detail?: string;
  updatedAt?: Date | string;
  icon?: React.ComponentType<{ className?: string }>;
};

function formatDiagnosticTime(value?: Date | string) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function normalizeDiagnosticLevel(value?: string | null): DiagnosticLevel {
  const normalized = value?.toLowerCase();
  if (!normalized) return "unknown";
  if (["connected", "online", "running", "open", "healthy", "ok", "available"].includes(normalized)) return "ok";
  if (["connecting", "reconnecting", "degraded", "warning", "idle"].includes(normalized)) return "warning";
  if (["offline", "disconnected", "closed", "error", "failed", "down", "unreachable"].includes(normalized)) return "critical";
  return "unknown";
}

function statusBadgeClass(level: DiagnosticLevel) {
  if (level === "ok") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (level === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (level === "critical") return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-border bg-muted/40 text-muted-foreground";
}

function DiagnosticStatusCard({ item }: { item: DiagnosticStatusItem }) {
  const Icon = item.icon ?? Info;
  const updatedAt = formatDiagnosticTime(item.updatedAt);

  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", statusBadgeClass(item.level))}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{item.label}</h3>
              <Badge variant="outline" className={cn("capitalize", statusBadgeClass(item.level))}>
                {item.value}
              </Badge>
            </div>
            {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
            {item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
            {updatedAt ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                Updated {updatedAt}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SystemInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function textIncludesAny(value: string, patterns: string[]) {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function SystemInfoTab() {
  const {
    activeMwdSession,
    activeMwdSessionId,
    connectionState,
    connectionStatusLoading,
    connectionStatusError,
    refreshConnectionStatus,
    failoverEventsLoading,
    failoverEventsError,
    refreshFailoverEvents,
    serialStatus,
    serialStatusLoading,
    serialStatusError,
    refreshSerialStatus,
    espWsStatus,
    espWsStatusLoading,
    espWsStatusError,
    refreshEspWsStatus,
    realtimeStatus,
    realtimeError,
    events,
  } = useApp();

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "Not configured";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "Not configured";
  const browserHost = typeof window === "undefined" ? "Unavailable" : window.location.host;

  const refreshDiagnostics = async () => {
    await Promise.allSettled([
      refreshConnectionStatus(),
      refreshFailoverEvents(),
      refreshSerialStatus(),
      refreshEspWsStatus(),
    ]);
  };

  const connectionLevel = connectionStatusLoading
    ? "warning"
    : connectionStatusError
      ? "critical"
      : normalizeDiagnosticLevel(connectionState.status);
  const serialLevel = serialStatusLoading
    ? "warning"
    : serialStatusError
      ? "critical"
      : normalizeDiagnosticLevel(serialStatus?.status);
  const espLevel = espWsStatusLoading
    ? "warning"
    : espWsStatusError || espWsStatus?.lastError
      ? "critical"
      : normalizeDiagnosticLevel(espWsStatus?.status);
  const realtimeLevel = normalizeDiagnosticLevel(realtimeStatus);

  const processItems: DiagnosticStatusItem[] = [
    {
      label: "Backend Connection Monitor",
      value: connectionStatusLoading ? "checking" : connectionState.status,
      level: connectionLevel,
      description: connectionStatusError || `Data source: ${connectionState.dataSource}. Latency ${connectionState.latency} ms, packet loss ${connectionState.packetLoss}%.`,
      updatedAt: connectionState.lastReceived ?? undefined,
      icon: Network,
    },
    {
      label: "Realtime WebSocket Client",
      value: realtimeStatus,
      level: realtimeError ? "critical" : realtimeLevel,
      description: realtimeError || (wsUrl === "Not configured" ? "NEXT_PUBLIC_WS_URL is not configured." : "Frontend realtime client status."),
      detail: wsUrl,
      icon: Wifi,
    },
    {
      label: "Logging Process",
      value: "unknown",
      level: "unknown",
      description: "Backend process-status endpoint is not available yet, so running/not running cannot be verified.",
      detail: "Expected future source: diagnostics/process status API.",
      icon: Activity,
    },
    {
      label: "Helper Process",
      value: "unknown",
      level: "unknown",
      description: "Backend process-status endpoint is not available yet, so helper process state cannot be verified.",
      detail: "Expected future source: diagnostics/process status API.",
      icon: Activity,
    },
  ];

  const portItems: DiagnosticStatusItem[] = [
    {
      label: "Serial Gateway",
      value: serialStatusLoading ? "checking" : serialStatus?.status ?? "unavailable",
      level: serialLevel,
      description: serialStatusError || serialStatus?.message || "Source: GET /api/serial/status.",
      detail: serialStatus?.port ? `Port ${serialStatus.port}` : "No serial port returned.",
      updatedAt: serialStatus?.lastReceivedAt,
      icon: Cable,
    },
    {
      label: "ESP WebSocket Gateway",
      value: espWsStatusLoading ? "checking" : espWsStatus?.status ?? "unavailable",
      level: espLevel,
      description: espWsStatusError || espWsStatus?.lastError || espWsStatus?.message || "Source: GET /api/esp-ws/status.",
      detail: [
        typeof espWsStatus?.clientCount === "number" ? `${espWsStatus.clientCount} clients` : null,
        typeof espWsStatus?.signal?.rssi === "number" ? `RSSI ${espWsStatus.signal.rssi}` : null,
        typeof espWsStatus?.signal?.snr === "number" ? `SNR ${espWsStatus.signal.snr}` : null,
      ].filter(Boolean).join(" | ") || "No signal detail returned.",
      updatedAt: espWsStatus?.lastReceivedAt,
      icon: Wifi,
    },
  ];

  const diagnosticText = [
    serialStatusError,
    serialStatus?.message,
    espWsStatusError,
    espWsStatus?.lastError ?? undefined,
    espWsStatus?.message,
    espWsStatus?.lastRawMessage,
    espWsStatus?.lastPayload,
    espWsStatus?.lastLine,
    espWsStatus?.rawPacket,
    realtimeError,
    connectionStatusError,
    failoverEventsError,
    ...events.slice(0, 20).map((event) => event.message),
  ].filter((value): value is string => Boolean(value));

  const hints = [
    connectionLevel === "critical"
      ? "Backend connection monitor reports offline/error. Check backend API reachability and active data source before troubleshooting UI widgets."
      : null,
    connectionLevel === "warning"
      ? "Backend connection is degraded/checking. Review failover events and packet loss before trusting realtime values."
      : null,
    serialLevel === "critical"
      ? "Serial gateway is disconnected or errored. Check rig WITS port, serial adapter, baud rate, and null-modem serial cable."
      : null,
    espLevel === "critical"
      ? "ESP WebSocket gateway is disconnected or errored. Check ESP gateway process, network path, and websocket status endpoint."
      : null,
    realtimeError || ["disconnected", "error"].includes(realtimeStatus)
      ? "Realtime frontend websocket is not connected. Verify NEXT_PUBLIC_WS_URL and backend websocket availability."
      : null,
    textIncludesAny(diagnosticText.join("\n"), ["illegal character received", "illegal character"])
      ? "System message mentions illegal characters. Polaris guide indicates possible faulty null-modem cable or rig monitoring equipment sending garbage data."
      : null,
    textIncludesAny(diagnosticText.join("\n"), ["hangup signal received", "hangup signal", "hangup"])
      ? "System message mentions hangup signal. Check serial cable, device power, and data transmission stability."
      : null,
    failoverEventsError
      ? "Failover events could not be loaded. Backend failover diagnostics may be unavailable or access may be denied."
      : null,
  ].filter((hint): hint is string => Boolean(hint));

  const recentDiagnostics = events
    .filter((event) => ["connection", "failover", "system"].includes(event.type))
    .slice(0, 6);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <Card className="rounded-2xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">System Information Summary</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Runtime diagnostics from the frontend state and available backend status endpoints. Process and system-log status are shown honestly when backend support is not available.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshDiagnostics()} disabled={connectionStatusLoading || failoverEventsLoading || serialStatusLoading || espWsStatusLoading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh Diagnostics
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SystemInfoRow label="Active Session" value={activeMwdSession?.name ?? activeMwdSession?.wellName ?? activeMwdSessionId ?? "No active session"} />
        <SystemInfoRow label="Frontend Host" value={browserHost} />
        <SystemInfoRow label="Backend API Base URL" value={apiBaseUrl} />
        <SystemInfoRow label="Realtime WS URL" value={wsUrl} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">Process / Service Status</h3>
            <p className="text-sm text-muted-foreground">Operational services and process-like runtime components.</p>
          </div>
          <div className="grid gap-3">
            {processItems.map((item) => <DiagnosticStatusCard key={item.label} item={item} />)}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">Port / Connection Status</h3>
            <p className="text-sm text-muted-foreground">Serial, ESP, and realtime transport status from backend/state.</p>
          </div>
          <div className="grid gap-3">
            {portItems.map((item) => <DiagnosticStatusCard key={item.label} item={item} />)}
          </div>
        </section>
      </div>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Diagnostic Notes</h3>
              <p className="text-sm text-muted-foreground">Hints are shown only when current status or diagnostic messages indicate a problem.</p>
            </div>
            <Badge variant={hints.length > 0 ? "destructive" : "secondary"}>
              {hints.length > 0 ? `${hints.length} warning${hints.length === 1 ? "" : "s"}` : "No active hints"}
            </Badge>
          </div>
          {hints.length > 0 ? (
            <div className="space-y-2">
              {hints.map((hint) => (
                <Alert key={hint} className="rounded-xl border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{hint}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              No status-driven diagnostic hints are active.
            </div>
          )}
        </Card>

        <Card className="rounded-2xl p-4">
          <div className="mb-3">
            <h3 className="font-semibold">System Log Availability</h3>
            <p className="text-sm text-muted-foreground">Backend system log endpoint is not integrated yet.</p>
          </div>
          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            Recent backend process logs such as &quot;illegal character received&quot; or &quot;hangup signal received&quot; are not available as a dedicated API yet. This panel scans available status/error messages only.
          </div>
        </Card>
      </section>

      <Card className="rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Recent Connection/System Events</h3>
            <p className="text-sm text-muted-foreground">Events generated from real connection, failover, and system state.</p>
          </div>
          <Badge variant="outline">{recentDiagnostics.length} event{recentDiagnostics.length === 1 ? "" : "s"}</Badge>
        </div>
        {recentDiagnostics.length > 0 ? (
          <div className="space-y-2">
            {recentDiagnostics.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
                {event.severity === "critical" ? <XCircle className="mt-0.5 size-4 text-destructive" /> : event.severity === "warning" ? <AlertTriangle className="mt-0.5 size-4 text-amber-500" /> : <Info className="mt-0.5 size-4 text-muted-foreground" />}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{event.message}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {event.type} | {formatDiagnosticTime(event.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            No recent connection/system diagnostic events are available.
          </div>
        )}
      </Card>
    </div>
  );
}

function ClearDataTab({
  activeMwdSessionId,
  clearTargets,
  clearTargetsError,
  clearTargetsLoading,
  isAdmin,
  mwdSessions,
  refreshAfterDataMutation,
  setActiveMwdSessionId,
  token,
}: {
  activeMwdSessionId: string;
  clearTargets: string[];
  clearTargetsError: string;
  clearTargetsLoading: boolean;
  isAdmin: boolean;
  mwdSessions: Array<{ id: string; name: string; wellName?: string; jobName?: string }>;
  refreshAfterDataMutation: () => Promise<void>;
  setActiveMwdSessionId: (sessionId: string) => void;
  token: string | null;
}) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [startDepth, setStartDepth] = useState(0);
  const [endDepth, setEndDepth] = useState(99999);
  const [preview, setPreview] = useState<ClearDataPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const selectedCategoryLabels = useMemo(
    () =>
      clearTargets
        .filter((target) => selectedCategories.includes(target))
        .map((target) => targetLabel(target, clearTargetLabels)),
    [clearTargets, selectedCategories]
  );
  const previewTotal = useMemo(
    () => Object.values(preview?.counts ?? {}).reduce((total, count) => total + Number(count ?? 0), 0),
    [preview]
  );

  useEffect(() => {
    setSelectedCategories((current) => current.filter((target) => clearTargets.includes(target)));
  }, [clearTargets]);

  useEffect(() => {
    setPreview(null);
  }, [activeMwdSessionId, endDepth, selectedCategories, startDepth]);

  const validateClearPayload = () => {
    if (!token) return "Backend login is required.";
    if (!isAdmin) return "Only admin users can use Clear Data.";
    if (!activeMwdSessionId) return "Select an active MWD session.";
    const depthError = validateDepthRange(startDepth, endDepth);
    if (depthError) return depthError;
    if (selectedCategories.length === 0) return "Select at least one clear target.";
    return "";
  };

  const payload = useMemo(
    () => ({
      sessionId: activeMwdSessionId,
      startDepth,
      endDepth,
      targets: selectedCategories,
    }),
    [activeMwdSessionId, endDepth, selectedCategories, startDepth]
  );

  const handlePreviewClearData = async () => {
    const validationError = validateClearPayload();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setPreviewLoading(true);
    setActionError("");

    try {
      const result = await previewClearData(token!, payload);
      setPreview(result);
      toast.success("Clear data preview loaded");
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to preview clear data.");
      setPreview(null);
      setActionError(message);
      toast.error("Unable to preview clear data", { description: message });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBackupSession = async () => {
    const validationError = validateClearPayload();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setBackupLoading(true);
    setActionError("");

    try {
      const response = await backupSession(token!, payload);
      downloadJsonFile(response.backup, `mwd-session-backup-session-${activeMwdSessionId}-${timestampForFileName()}.json`);
      toast.success("Backup downloaded successfully");
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to backup session.");
      setActionError(message);
      toast.error("Unable to backup session", { description: message });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleClearData = async () => {
    const validationError = validateClearPayload();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!preview?.requiredConfirm) {
      toast.error("Preview clear data before clearing.");
      return;
    }

    setClearLoading(true);
    setActionError("");

    try {
      const response = await clearData(token!, {
        ...payload,
        confirm: preview.requiredConfirm,
      });

      if ("backup" in response) {
        downloadJsonFile(response.backup, `mwd-clear-data-backup-session-${activeMwdSessionId}-${timestampForFileName()}.json`);
      }

      toast.success("Clear data completed");
      setPreview(null);
      await refreshAfterDataMutation();
    } catch (error) {
      const message = getSafeErrorMessage(error, "Unable to clear data.");
      setActionError(message);
      toast.error("Unable to clear data", { description: message });
    } finally {
      setClearLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((current) =>
      current.includes(categoryId) ? current.filter((item) => item !== categoryId) : [...current, categoryId]
    );
  };

  const toggleAll = () => {
    setSelectedCategories((current) =>
      current.length === clearTargets.length ? [] : clearTargets
    );
  };

  return (
    <div className="grid gap-3 sm:gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="rounded-xl p-3 sm:rounded-2xl sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div>
            <h2 className="text-base font-semibold sm:text-lg">Clear Data Targets</h2>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">
              Targets are loaded from /api/system-utilities/clear-data/targets.
            </p>
          </div>
          <Button size="sm" className="h-9 text-xs sm:text-sm" variant="outline" onClick={toggleAll}>
            {selectedCategories.length === clearTargets.length ? "Clear Selection" : "Select All"}
          </Button>
        </div>
        {clearTargetsLoading ? <Badge variant="outline" className="mt-3 sm:mt-4">Loading clear targets</Badge> : null}
        {clearTargetsError ? (
          <Alert variant="destructive" className="mt-3 rounded-xl sm:mt-4">
            <AlertTriangle className="size-4" />
            <AlertDescription>{clearTargetsError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="mt-3 grid gap-1.5 min-[460px]:grid-cols-2 sm:mt-4 sm:gap-2 lg:gap-3">
          {clearTargets.map((target) => (
            <label key={target} className="flex min-h-12 cursor-pointer gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/40 sm:min-h-14 sm:gap-3 sm:rounded-xl sm:p-3">
              <Checkbox checked={selectedCategories.includes(target)} onCheckedChange={() => toggleCategory(target)} disabled={!isAdmin} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium sm:text-sm">{targetLabel(target, clearTargetLabels)}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground sm:mt-1 sm:text-xs">{target}</span>
              </span>
            </label>
          ))}
          {!clearTargetsLoading && !clearTargetsError && clearTargets.length === 0 ? (
            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground sm:p-4 min-[460px]:col-span-2">
              Endpoint backend untuk fitur ini belum tersedia.
            </div>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3 sm:space-y-4">
        <Card className="rounded-xl p-3 sm:rounded-2xl sm:p-4">
          <h2 className="text-base font-semibold sm:text-lg">Depth Range</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">Use the active session and a valid depth interval before previewing clear data.</p>
          <div className="mt-3 grid gap-3 sm:mt-4">
            <SessionSelector
              activeMwdSessionId={activeMwdSessionId}
              disabled={!isAdmin}
              mwdSessions={mwdSessions}
              setActiveMwdSessionId={setActiveMwdSessionId}
            />
            <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-3">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">Start Depth</Label>
                <Input type="number" value={startDepth} disabled={!isAdmin} onChange={(event) => setStartDepth(parseFiniteNumber(event.target.value, startDepth))} />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">End Depth</Label>
                <Input type="number" value={endDepth} disabled={!isAdmin} onChange={(event) => setEndDepth(parseFiniteNumber(event.target.value, endDepth))} />
              </div>
            </div>
          </div>
        </Card>

        <Alert variant="destructive" className="rounded-xl py-3 sm:rounded-2xl sm:py-4">
          <AlertTriangle className="size-4" />
          <AlertTitle>Dangerous action</AlertTitle>
          <AlertDescription className="text-xs leading-snug sm:text-sm">
            Cleared data cannot be restored unless a valid backup exists. Confirm that database and configuration backups are available before continuing.
          </AlertDescription>
        </Alert>

        <Card className="rounded-xl border-destructive/30 p-3 sm:rounded-2xl sm:p-4">
          <h2 className="text-base font-semibold sm:text-lg">Clear Data Action</h2>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm">
            Selected categories: {selectedCategoryLabels.length > 0 ? selectedCategoryLabels.length : "none"}.
          </p>
          <div className="mt-3 grid gap-2 sm:mt-4">
            <Button size="sm" className="h-9 text-xs sm:text-sm" variant="outline" onClick={() => void handlePreviewClearData()} disabled={!isAdmin || previewLoading || selectedCategories.length === 0}>
              {previewLoading ? "Previewing..." : "Preview Clear Data"}
            </Button>
            <Button size="sm" className="h-9 text-xs sm:text-sm" variant="outline" onClick={() => void handleBackupSession()} disabled={!isAdmin || backupLoading || selectedCategories.length === 0}>
              <Download className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
              {backupLoading ? "Backing up..." : "Download Backup"}
            </Button>
          </div>
          {preview ? (
            <div className="mt-3 rounded-xl border bg-muted/30 p-2.5 text-xs sm:mt-4 sm:p-3 sm:text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Preview counts</div>
                <Badge variant="secondary">{preview.requiredConfirm}</Badge>
              </div>
              <div className="mt-2 grid gap-1">
                {Object.entries(preview.counts).map(([target, count]) => (
                  <div key={target} className="flex justify-between gap-3">
                    <span>{targetLabel(target, clearTargetLabels)}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
                <div className="border-t pt-1 font-medium flex justify-between gap-3">
                  <span>Total</span>
                  <span className="font-mono">{previewTotal}</span>
                </div>
              </div>
            </div>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="mt-3 h-9 w-full text-xs sm:mt-4 sm:text-sm" variant="destructive" disabled={!isAdmin || clearLoading || !preview?.requiredConfirm}>
                <Trash2 className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
                {clearLoading ? "Clearing..." : "Clear Data"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear selected system data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear {selectedCategoryLabels.length} selected data targets from depth {startDepth} to {endDepth}.
                  This action may delete operational data. Make sure you have downloaded a backup before continuing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="font-medium">Selected categories</div>
                <div className="mt-2 text-muted-foreground">{selectedCategoryLabels.join(", ")}</div>
                <div className="mt-2 font-mono text-xs">Confirm token: {preview?.requiredConfirm}</div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void handleClearData()}
                >
                  Confirm Clear Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {actionError ? <p className="mt-3 text-xs text-destructive sm:text-sm">{actionError}</p> : null}
        </Card>
      </div>
    </div>
  );
}

export default function SystemUtilitiesPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user, isLoading } = useAuth();
  const {
    activeMwdSessionId,
    mwdSessions,
    refreshMwdData,
    refreshMwdSessions,
    refreshPlotTemplates,
    refreshWitsAlarms,
    refreshWitsDataValues,
    setActiveMwdSessionId,
  } = useApp();
  const [clearTargets, setClearTargets] = useState<string[]>([]);
  const [clearTargetsLoading, setClearTargetsLoading] = useState(false);
  const [clearTargetsError, setClearTargetsError] = useState("");
  const [configTargets, setConfigTargets] = useState<string[]>([]);
  const [configTargetsLoading, setConfigTargetsLoading] = useState(false);
  const [configTargetsError, setConfigTargetsError] = useState("");

  const isAdmin = user?.role === "admin";

  const loadClearTargets = useCallback(async () => {
    if (!token || !isAdmin) {
      setClearTargets([]);
      return;
    }

    setClearTargetsLoading(true);
    setClearTargetsError("");

    try {
      const targets = await getClearDataTargets(token);
      setClearTargets(targets);
    } catch (error) {
      logSecurityError("Unable to load clear-data targets.", error);
      const message = "Gagal memuat data dari backend.";
      setClearTargets([]);
      setClearTargetsError(message);
    } finally {
      setClearTargetsLoading(false);
    }
  }, [isAdmin, token]);

  const loadConfigTargets = useCallback(async () => {
    if (!token || !isAdmin) {
      setConfigTargets([]);
      return;
    }

    setConfigTargetsLoading(true);
    setConfigTargetsError("");

    try {
      const targets = await getConfigBackupTargets(token);
      setConfigTargets(targets);
    } catch (error) {
      logSecurityError("Unable to load configuration backup targets.", error);
      const message = "Gagal memuat data dari backend.";
      setConfigTargets([]);
      setConfigTargetsError(message);
    } finally {
      setConfigTargetsLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    void loadClearTargets();
    void loadConfigTargets();
  }, [loadClearTargets, loadConfigTargets]);

  const refreshAfterDataMutation = useCallback(async () => {
    await Promise.allSettled([
      refreshMwdData(),
      refreshMwdSessions(),
      refreshWitsAlarms(),
      refreshWitsDataValues(),
      ...(token && activeMwdSessionId
        ? [
            getSurveys(token, { sessionId: activeMwdSessionId, stationType: "actual" }),
            getSurveys(token, { sessionId: activeMwdSessionId, stationType: "plan" }),
          ]
        : []),
    ]);
  }, [activeMwdSessionId, refreshMwdData, refreshMwdSessions, refreshWitsAlarms, refreshWitsDataValues, token]);

  const refreshAfterConfigRestore = useCallback(async () => {
    await Promise.allSettled([
      refreshPlotTemplates(),
    ]);
  }, [refreshPlotTemplates]);

  const content = (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">System Utilities</Badge>
          <Badge variant="outline">Admin protected</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">System Utilities</h1>
        <p className="break-words text-sm text-muted-foreground sm:text-base">
          Operational backup, restore, diagnostics, and controlled clear-data utilities.
        </p>
      </div>

      {!isLoading && !isAdmin ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="size-4" />
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>
            System Utilities can clear or restore operational data, so this page is restricted to admin users.
          </AlertDescription>
        </Alert>
      ) : null}

      <WorkspaceSection
        title="Utilities Workspace"
        description="Use these tools for backup, troubleshooting, and controlled job-start data cleanup."
        badge={isAdmin ? "Backend connected" : "Restricted"}
      >
        <Tabs defaultValue="database" className={cn("space-y-4", !isAdmin && "pointer-events-none opacity-60")}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
            <TabsTrigger value="database">
              <Database className="mr-2 size-4" />
              Database
            </TabsTrigger>
            <TabsTrigger value="system-info">
              <ServerCog className="mr-2 size-4" />
              System Info
            </TabsTrigger>
            <TabsTrigger value="clear-data">
              <Trash2 className="mr-2 size-4" />
              Clear Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="database">
            <DatabaseTab
              activeMwdSessionId={activeMwdSessionId}
              clearTargets={clearTargets}
              configTargets={configTargets}
              configTargetsError={configTargetsError}
              configTargetsLoading={configTargetsLoading}
              isAdmin={isAdmin}
              mwdSessions={mwdSessions}
              refreshAfterConfigRestore={refreshAfterConfigRestore}
              refreshAfterDataMutation={refreshAfterDataMutation}
              setActiveMwdSessionId={setActiveMwdSessionId}
              token={token}
            />
          </TabsContent>
          <TabsContent value="system-info">
            <SystemInfoTab />
          </TabsContent>
          <TabsContent value="clear-data">
            <ClearDataTab
              activeMwdSessionId={activeMwdSessionId}
              clearTargets={clearTargets}
              clearTargetsError={clearTargetsError}
              clearTargetsLoading={clearTargetsLoading}
              isAdmin={isAdmin}
              mwdSessions={mwdSessions}
              refreshAfterDataMutation={refreshAfterDataMutation}
              setActiveMwdSessionId={setActiveMwdSessionId}
              token={token}
            />
          </TabsContent>
        </Tabs>
      </WorkspaceSection>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="system-utilities" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
