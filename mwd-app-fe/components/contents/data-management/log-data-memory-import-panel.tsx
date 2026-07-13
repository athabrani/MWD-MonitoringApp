"use client";

import { type ChangeEvent } from "react";
import { FileUp, FolderOpen, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LogDataImportBatch } from "@/lib/log-data-import";

export interface LogDataChannelSummary {
  witsId: string;
  mappedField?: string;
  label: string;
  units: string;
  enabled: boolean;
  count: number;
  hiddenCount: number;
  decimalPlaces: number;
  scaleFactor: number;
  sensorSpacing: number;
  lasMnemonic: string;
  alarmEnabled: boolean;
  alarmLow: number;
  alarmHigh: number;
  plotName: string;
  isMemoryStorage: boolean;
  hasRecords: boolean;
}

export function LogDataMemoryImportPanel({
  selectedChannel,
  importBatch,
  importFileName,
  importError,
  importScanning,
  importCommitting,
  importProgress,
  importResult,
  onImportSelection,
  onFolderImport,
  onCommitImport,
}: {
  selectedChannel: LogDataChannelSummary | null;
  importBatch: LogDataImportBatch | null;
  importFileName: string;
  importError: string;
  importScanning: boolean;
  importCommitting: boolean;
  importProgress: {
    phase: "idle" | "preparing" | "importing" | "retrying" | "refreshing" | "complete";
    message: string;
    currentRequest: number;
    totalRequests: number;
    importedValues: number;
  };
  importResult: { importedValues: number; failedValues: number; postedRequests: number; totalRequests: number; fileErrors: Array<{ fileName: string; row: number; reason: string }> } | null;
  onImportSelection: (files: File[]) => void;
  onFolderImport?: () => void;
  onCommitImport: () => void;
}) {
  const activeImportPhase =
    importScanning ||
    importCommitting ||
    importProgress.phase === "preparing" ||
    importProgress.phase === "importing" ||
    importProgress.phase === "retrying" ||
    importProgress.phase === "refreshing";
  const progressPercent =
    importProgress.totalRequests > 0
      ? Math.min(
          100,
          Math.max(
            4,
            Math.round(
              (importProgress.currentRequest / importProgress.totalRequests) *
                100,
            ),
          ),
        )
      : activeImportPhase
        ? 12
        : 0;
  const progressLabel = importScanning
    ? "Scanning"
    : importProgress.phase === "retrying"
      ? "Retrying"
      : importProgress.phase === "refreshing"
        ? "Refreshing"
        : importCommitting || importProgress.phase === "importing"
          ? "Importing"
          : importProgress.phase === "complete"
            ? "Completed"
            : "Ready";
  const resultVariant = importResult
    ? importResult.failedValues > 0
      ? importResult.importedValues > 0
        ? "partial"
        : "failed"
      : "success"
    : null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    onImportSelection(files);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-muted p-2">
                <FileUp className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">CSV/LAS Log Import</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose CSV files, a ZIP dump, or a folder, then import mapped WITS values into the active session.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">CSV/LAS</Badge>
              {activeImportPhase ? <Badge>Import running</Badge> : null}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {activeImportPhase ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {importScanning
                          ? "Scanning selected import sources..."
                          : importProgress.message || "Importing data..."}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Keep this page open while the backend writes WITS values.
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {progressLabel}
                  </Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {importProgress.totalRequests > 0
                      ? `Request ${importProgress.currentRequest} of ${importProgress.totalRequests}`
                      : "Preparing import queue"}
                  </span>
                  <span>
                    Imported {importProgress.importedValues} value(s)
                  </span>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="log-data-import-review-file">CSV/LAS source</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="log-data-import-review-file"
                  type="file"
                  accept=".csv,.zip,.las,text/csv,application/zip"
                  multiple
                  onChange={handleFileChange}
                  disabled={activeImportPhase}
                />
                {onFolderImport ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={onFolderImport}
                    disabled={activeImportPhase}
                  >
                    <FolderOpen className="mr-2 size-4" />
                    Select folder
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected WITS context: {selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "none"}. CSV and ZIP folder dumps are imported through POST /api/mwd-data. LAS files remain visible as future support and are reported as skipped until a LAS parser endpoint exists.
              </p>
            </div>

            {importFileName ? (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                Selected source(s): <span className="font-medium">{importFileName}</span>
              </div>
            ) : null}

            {importError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {importError}
              </div>
            ) : null}

            {importScanning ? (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Scanning CSV source and matching rows to WITS storage...
              </div>
            ) : null}

            {importCommitting || importProgress.phase !== "idle" ? (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {importCommitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  <span>{importProgress.message || "Preparing import..."}</span>
                </div>
                {importProgress.totalRequests > 0 ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Request {importProgress.currentRequest} of {importProgress.totalRequests}; imported {importProgress.importedValues} value(s).
                  </div>
                ) : null}
              </div>
            ) : null}

            {importBatch ? (
              <div className="rounded-xl border p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <SummaryTile label="Input files" value={String(importBatch.sourceBatch.inputFileCount)} />
                  <SummaryTile label="ZIP files" value={String(importBatch.sourceBatch.zipFileCount)} />
                  <SummaryTile label="Valid CSV" value={String(importBatch.sourceBatch.validCsvCount)} />
                  <SummaryTile label="Mapped files" value={String(importBatch.mappedFiles.length)} />
                  <SummaryTile label="Importable values" value={String(importBatch.totalImportableValues)} />
                  <SummaryTile label="Skipped/unmapped" value={String(importBatch.unmappedFiles.length + importBatch.sourceBatch.skippedSources.length)} />
                </div>
                <ScrollArea className="mt-3 h-[180px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Rows</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importBatch.mappedFiles.map((file) => (
                        <TableRow key={file.source.id}>
                          <TableCell className="max-w-[220px] truncate">{file.source.fileName}</TableCell>
                          <TableCell className="font-mono">{file.target.witsId}</TableCell>
                          <TableCell>{file.values.length}</TableCell>
                        </TableRow>
                      ))}
                      {importBatch.mappedFiles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                            No rows are mapped safely yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {(importBatch.unmappedFiles.length > 0 || importBatch.sourceBatch.skippedSources.length > 0 || importBatch.sourceBatch.duplicateFileNames.length > 0) ? (
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-xs">
                    {importBatch.sourceBatch.duplicateFileNames.length > 0 ? (
                      <div className="mb-2 text-amber-700 dark:text-amber-300">
                        Duplicate names: {importBatch.sourceBatch.duplicateFileNames.join(", ")}
                      </div>
                    ) : null}
                    <ScrollArea className="max-h-[140px]">
                      <div className="space-y-1">
                        {importBatch.unmappedFiles.map((file) => (
                          <div key={`unmapped-${file.source.id}`} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                            <span className="truncate font-medium">{file.source.sourcePath}</span>
                            <span className="text-muted-foreground">{file.reason}</span>
                          </div>
                        ))}
                        {importBatch.sourceBatch.skippedSources.map((source, index) => (
                          <div key={`skipped-${source.sourcePath}-${index}`} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                            <span className="truncate font-medium">{source.sourcePath}</span>
                            <span className="text-muted-foreground">{source.reason}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : null}
              </div>
            ) : null}

            {importResult ? (
              <div
                className={
                  resultVariant === "success"
                    ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
                    : resultVariant === "partial"
                      ? "rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
                      : "rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
                }
              >
                <div className="font-medium">
                  {resultVariant === "success"
                    ? "Import completed"
                    : resultVariant === "partial"
                      ? "Import partially completed"
                      : "Import failed"}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Imported {importResult.importedValues} value(s); failed {importResult.failedValues} value(s). Backend POST requests: {importResult.postedRequests}/{importResult.totalRequests}.
                </div>
              </div>
            ) : null}

            <Button
              onClick={onCommitImport}
              disabled={!importBatch || importBatch.totalImportableValues === 0 || activeImportPhase || !selectedChannel}
              className="w-full justify-center"
            >
              {activeImportPhase ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 size-4" />
              )}
              {activeImportPhase ? "Import in progress..." : "Import mapped WITS values"}
            </Button>
          </div>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-xs font-semibold">{value}</div>
    </div>
  );
}
