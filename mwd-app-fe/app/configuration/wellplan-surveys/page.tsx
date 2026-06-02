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
  const [draftSurvey, setDraftSurvey] = useState<SurveyRecord>(emptySurvey);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
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
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load wellplan surveys.", loadError);
      }
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

  const importCsv = async (file?: File) => {
    if (!file) return;

    if (!token || !canManage) {
      toast.warning("Only admin or engineer users can import wellplan CSV.");
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before importing wellplan CSV.");
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }

    setImporting(true);

    try {
      await importSurveysCsv(token, {
        content: await file.text(),
        sessionId: activeMwdSessionId,
        stationType: "plan",
        verticalSectionAzimuth: DEFAULT_VERTICAL_SECTION_AZIMUTH,
      });
      toast.success("Wellplan CSV imported.");
      await loadSurveys();
    } catch (importError) {
      toast.error("Unable to import wellplan CSV", {
        description: importError instanceof Error ? importError.message : "Backend request failed.",
      });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const content = (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Configuration</Badge>
            <Badge variant="outline">Well Plan Surveys</Badge>
            {activeMwdSessionId ? <Badge variant="outline">Session {activeMwdSessionId}</Badge> : null}
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Well Plan Surveys Editor</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Uses /api/surveys with stationType=plan for read, create, update, and delete.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => void importCsv(event.target.files?.[0])}
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={importing || !canManage || !activeMwdSessionId}
          >
            {importing ? "Importing..." : "Import CSV"}
          </Button>
          <Button variant="outline" onClick={() => void loadSurveys()} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
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
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Survey Rows</div>
          <div className="mt-2 text-2xl font-semibold">{totals.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Max MD</div>
          <div className="mt-2 text-2xl font-semibold">{totals.maxMd.toFixed(2)}</div>
        </Card>
      </div>

      <Card className="max-w-full p-4">
        <h2 className="text-lg font-semibold">Add Plan Survey</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {surveyColumns.map((column) => (
            <div key={column} className="min-w-0 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{column}</div>
              <Input type="number" className="h-9" value={draftSurvey[column]} onChange={(event) => updateDraft(column, event.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void addSurvey()} disabled={saving || !canManage || !activeMwdSessionId}>
            <Plus className="mr-2 size-4" />
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
