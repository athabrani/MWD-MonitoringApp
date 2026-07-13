"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  createSurvey,
  deleteSurvey,
  getSurveys,
  importSurveysCsv,
  surveyRecordToPayload,
  updateSurvey,
} from "@/lib/surveys-api";
import { collectImportSources, countCsvRecords, ImportSourceBatch } from "@/lib/import-sources";
import { logSecurityError } from "@/lib/security/errors";
import { DEFAULT_VERTICAL_SECTION_AZIMUTH } from "@/lib/survey-defaults";
import { SurveyRecord } from "@/types/monitoring";

const emptySurvey: SurveyRecord = {
  id: "",
  md: 0,
  inc: 0,
  azm: 0,
  tvd: 0,
  vs: 0,
  ns: 0,
  ew: 0,
  dls: 0,
  toolfaceMode: "Plan",
  timestamp: new Date().toISOString(),
  isProjection: false,
};

const surveyColumns: Array<keyof Pick<SurveyRecord, "md" | "inc" | "azm" | "tvd" | "vs" | "ns" | "ew" | "dls">> = [
  "md",
  "inc",
  "azm",
  "tvd",
  "vs",
  "ns",
  "ew",
  "dls",
];

export default function WellplanSurveysPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { activeMwdSessionId } = useApp();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const folderImportInputRef = useRef<HTMLInputElement | null>(null);
  const [draftSurvey, setDraftSurvey] = useState<SurveyRecord>(emptySurvey);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [importBatch, setImportBatch] = useState<ImportSourceBatch | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: string[];
    failed: Array<{ fileName: string; message: string }>;
  } | null>(null);
  const canManage = user?.role === "engineer" || user?.role === "admin";

  const loadSurveys = useCallback(async () => {
    if (!token) {
      setSurveys([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await getSurveys(token, {
        sessionId: activeMwdSessionId || undefined,
        stationType: "plan",
      });
      setSurveys(rows);
    } catch (loadError) {
      logSecurityError("Unable to load wellplan surveys.", loadError);
      const message = "Gagal memuat data dari backend.";
      setSurveys([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeMwdSessionId, token]);

  useEffect(() => {
    void loadSurveys();
  }, [loadSurveys]);

  useEffect(() => {
    folderImportInputRef.current?.setAttribute("webkitdirectory", "");
    folderImportInputRef.current?.setAttribute("directory", "");
  }, []);

  const totals = useMemo(
    () => ({
      count: surveys.length,
      maxMd: Math.max(...surveys.map((survey) => survey.md), 0),
    }),
    [surveys]
  );

  const updateDraft = (field: (typeof surveyColumns)[number], value: string) => {
    setDraftSurvey((prev) => ({
      ...prev,
      [field]: Number(value),
    }));
  };

  const updateRow = async (survey: SurveyRecord, field: (typeof surveyColumns)[number], value: string) => {
    if (!token || !canManage) return;

    const nextSurvey = {
      ...survey,
      [field]: Number(value),
    };

    setSurveys((prev) => prev.map((row) => (row.id === survey.id ? nextSurvey : row)));

    try {
      const saved = await updateSurvey(token, survey.id, surveyRecordToPayload(nextSurvey, activeMwdSessionId, "plan"));
      setSurveys((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    } catch (updateError) {
      toast.error("Unable to update wellplan survey", {
        description: updateError instanceof Error ? updateError.message : "Backend request failed.",
      });
      await loadSurveys();
    }
  };

  const addSurvey = async () => {
    if (!token) {
      toast.error("Please sign in before creating wellplan surveys.");
      return;
    }

    if (!canManage) {
      toast.warning("Only admin or engineer users can create wellplan surveys.");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before creating wellplan surveys.");
      return;
    }

    const hasInvalidValue = surveyColumns.some((column) => !Number.isFinite(Number(draftSurvey[column])));

    if (hasInvalidValue) {
      toast.error("Pastikan semua field numerik berisi nilai yang valid.");
      return;
    }

    setSaving(true);

    try {
      const saved = await createSurvey(token, surveyRecordToPayload(draftSurvey, activeMwdSessionId, "plan"));
      setSurveys((prev) => [...prev, saved]);
      setDraftSurvey({ ...emptySurvey, timestamp: new Date().toISOString() });
      toast.success("Wellplan survey saved.");
    } catch (createError) {
      toast.error("Unable to create wellplan survey", {
        description: createError instanceof Error ? createError.message : "Backend request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeSurvey = async (survey: SurveyRecord) => {
    if (!token || !canManage) return;

    setDeletingId(survey.id);

    try {
      await deleteSurvey(token, survey.id);
      setSurveys((prev) => prev.filter((row) => row.id !== survey.id));
      toast.success("Wellplan survey deleted.");
    } catch (deleteError) {
      toast.error("Unable to delete wellplan survey", {
        description: deleteError instanceof Error ? deleteError.message : "Backend request failed.",
      });
    } finally {
      setDeletingId("");
    }
  };

  const prepareImportBatch = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!token || !canManage) {
      toast.warning("Only admin or engineer users can import wellplan CSV.");
      if (importInputRef.current) importInputRef.current.value = "";
      if (folderImportInputRef.current) folderImportInputRef.current.value = "";
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before importing wellplan CSV.");
      if (importInputRef.current) importInputRef.current.value = "";
      if (folderImportInputRef.current) folderImportInputRef.current.value = "";
      return;
    }

    setImporting(true);
    setImportBatch(null);
    setImportResult(null);

    try {
      const batch = await collectImportSources(files);
      setImportBatch(batch);
      if (batch.validCsvCount === 0) {
        toast.warning("No valid wellplan CSV files found.");
      } else {
        toast.success(`${batch.validCsvCount} wellplan CSV file(s) ready for import.`);
      }
    } catch (importError) {
      toast.error("Unable to scan wellplan import files", {
        description: importError instanceof Error ? importError.message : "Backend request failed.",
      });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
      if (folderImportInputRef.current) folderImportInputRef.current.value = "";
    }
  };

  const commitImportBatch = async () => {
    if (!importBatch || importBatch.validSources.length === 0) {
      toast.error("Select at least one valid CSV before importing.");
      return;
    }

    if (!token || !canManage || !activeMwdSessionId) {
      toast.warning("Backend login, engineer/admin access, and an active session are required.");
      return;
    }

    setImporting(true);

    const imported: string[] = [];
    const failed: Array<{ fileName: string; message: string }> = [];

    for (const source of importBatch.validSources) {
      try {
        await importSurveysCsv(token, {
          content: source.content,
          sessionId: activeMwdSessionId,
          stationType: "plan",
          verticalSectionAzimuth: DEFAULT_VERTICAL_SECTION_AZIMUTH,
        });
        imported.push(source.fileName);
      } catch (importError) {
        failed.push({
          fileName: source.fileName,
          message: importError instanceof Error ? importError.message : "Backend request failed.",
        });
      }
    }

    setImportResult({ imported, failed });

    try {
      if (imported.length > 0) await loadSurveys();
      if (imported.length > 0 && failed.length > 0) {
        toast.warning(`${imported.length} wellplan CSV imported, ${failed.length} failed.`);
      } else if (imported.length > 0) {
        toast.success(`${imported.length} wellplan CSV file(s) imported.`);
      } else {
        toast.error("No wellplan CSV files were imported.");
      }
    } finally {
      setImporting(false);
    }
  };

  const content = (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
              Configuration
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
              Well Plan Surveys
            </Badge>
            {activeMwdSessionId ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
                Session {activeMwdSessionId}
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-2 text-xl font-bold sm:mt-3 sm:text-3xl">Well Plan Surveys Editor</h1>
          <p className="text-xs leading-snug text-muted-foreground sm:text-base sm:leading-normal">
            Uses /api/surveys with stationType=plan for read, create, update, and delete.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
            className="hidden"
            multiple
            onChange={(event) => void prepareImportBatch(event.target.files)}
          />
          <input
            ref={folderImportInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            multiple
            onChange={(event) => void prepareImportBatch(event.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm"
            onClick={() => importInputRef.current?.click()}
            disabled={importing || !canManage || !activeMwdSessionId}
          >
            {importing ? "Working..." : "Import CSV / ZIP"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm"
            onClick={() => folderImportInputRef.current?.click()}
            disabled={importing || !canManage || !activeMwdSessionId}
          >
            Select Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm"
            onClick={() => void loadSurveys()}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 size-3.5 sm:mr-2 sm:size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm"
            onClick={() => {
              if (onNavigate) {
                onNavigate("configuration");
                return;
              }
              router.push(getAppPagePath("configuration"));
            }}
          >
            Close Window
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:p-4">
          {error}
        </Card>
      ) : null}

      {importBatch ? (
        <Card className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold sm:text-lg">Wellplan import summary</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Selected CSV files and CSVs found inside ZIP/folders are imported through the existing wellplan survey endpoint.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void commitImportBatch()} disabled={importing || importBatch.validCsvCount === 0}>
                {importing ? "Importing..." : "Import Valid CSVs"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setImportBatch(null);
                  setImportResult(null);
                }}
                disabled={importing}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryMetric label="Selected" value={String(importBatch.inputFileCount)} />
            <SummaryMetric label="ZIP files" value={String(importBatch.zipFileCount)} />
            <SummaryMetric label="Discovered" value={String(importBatch.discoveredFileCount)} />
            <SummaryMetric label="Valid CSV" value={String(importBatch.validCsvCount)} />
            <SummaryMetric label="Skipped" value={String(importBatch.skippedSources.length)} />
          </div>
          {importBatch.duplicateFileNames.length > 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              Duplicate file names: {importBatch.duplicateFileNames.join(", ")}
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold">Valid CSV files</div>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
                {importBatch.validSources.slice(0, 12).map((source) => (
                  <div key={source.id} className="flex justify-between gap-3">
                    <span className="truncate">{source.sourcePath}</span>
                    <span className="shrink-0">{countCsvRecords(source.content)} rows</span>
                  </div>
                ))}
                {importBatch.validSources.length > 12 ? <div>+{importBatch.validSources.length - 12} more</div> : null}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold">Skipped / invalid files</div>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
                {importBatch.skippedSources.length > 0 ? (
                  importBatch.skippedSources.slice(0, 12).map((source) => (
                    <div key={`${source.sourcePath}-${source.reason}`} className="flex justify-between gap-3">
                      <span className="truncate">{source.sourcePath}</span>
                      <span className="shrink-0">{source.reason}</span>
                    </div>
                  ))
                ) : (
                  <div>No skipped files.</div>
                )}
                {importBatch.skippedSources.length > 12 ? <div>+{importBatch.skippedSources.length - 12} more</div> : null}
              </div>
            </div>
          </div>
          {importResult ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                Imported: {importResult.imported.length}
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                Failed: {importResult.failed.length}
                {importResult.failed.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {importResult.failed.slice(0, 6).map((failure) => (
                      <div key={`${failure.fileName}-${failure.message}`}>{failure.fileName}: {failure.message}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Card className="p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Survey Rows</div>
          <div className="mt-1 text-xl font-semibold sm:mt-2 sm:text-2xl">{totals.count}</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Max MD</div>
          <div className="mt-1 text-xl font-semibold sm:mt-2 sm:text-2xl">{totals.maxMd.toFixed(2)}</div>
        </Card>
      </div>

      <Card className="max-w-full p-3 sm:p-4">
        <h2 className="text-base font-semibold sm:text-lg">Add Plan Survey</h2>
        <div className="mt-3 grid gap-2.5 min-[420px]:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {surveyColumns.map((column) => (
            <div key={column} className="min-w-0 space-y-1.5 sm:space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{column}</div>
              <Input type="number" className="h-9" value={draftSurvey[column]} onChange={(event) => updateDraft(column, event.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end sm:mt-4">
          <Button size="sm" className="h-9 text-xs sm:text-sm" onClick={() => void addSurvey()} disabled={saving || !canManage || !activeMwdSessionId}>
            <Plus className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
            {saving ? "Saving..." : "Add Survey"}
          </Button>
        </div>
      </Card>

      <Card className="max-w-full overflow-hidden p-0">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {surveyColumns.map((column) => (
                  <TableHead key={column} className="text-center uppercase">
                    {column}
                  </TableHead>
                ))}
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id} className="border-b border-slate-300 dark:border-slate-700">
                  {surveyColumns.map((column) => (
                    <TableCell key={`${survey.id}-${column}`} className="min-w-[92px] px-2 py-3 sm:min-w-[104px]">
                      <Input
                        type="number"
                        className="h-8 min-w-0 text-right text-sm"
                        value={survey[column]}
                        disabled={!canManage}
                        onChange={(event) => void updateRow(survey, column, event.target.value)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="min-w-[96px] px-2 py-3 text-right sm:min-w-[120px]">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canManage || deletingId === survey.id}
                      onClick={() => void removeSurvey(survey)}
                    >
                      <Trash2 className="mr-0 size-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && surveys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={surveyColumns.length + 1} className="py-8 text-center text-sm text-muted-foreground">
                    Belum ada survey untuk session ini.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="configuration-wellplan-surveys" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
