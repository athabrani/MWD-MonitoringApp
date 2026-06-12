"use client";

import { type ChangeEvent } from "react";
import { ArrowRight, Database, FileUp, GitCompare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppPage } from "@/components/layouts/app-layout";
import { PlaceholderNote } from "@/components/layouts/workspace-section";
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
  channels,
  importBatch,
  importFileName,
  importError,
  importScanning,
  importCommitting,
  importProgress,
  importResult,
  onImportSelection,
  onCommitImport,
  onNavigate,
}: {
  selectedChannel: LogDataChannelSummary | null;
  channels: LogDataChannelSummary[];
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
  onCommitImport: () => void;
  onNavigate?: (page: AppPage) => void;
}) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    onImportSelection(files);
  };

  const openMemoryWorkflow = () => {
    if (onNavigate) {
      onNavigate("data-management-memory-import");
      return;
    }

    toast.message("Open /data-management/memory-import to use backend memory import.");
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-dashed p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Import and Memory Workflows</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              CSV import writes through the backend MWD/WITS pipeline, then Log Data reloads WITS values for the active session.
            </p>
          </div>
          <Badge variant="secondary">{selectedChannel ? `${selectedChannel.witsId} selected` : "No WITS ID selected"}</Badge>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-muted p-2">
                <FileUp className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">CSV/LAS Log Import</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  CSV is active now for WITS value import. LAS remains visible here as future log import support and does not block CSV.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">CSV active</Badge>
              <Badge variant="outline">LAS future</Badge>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="log-data-import-review-file">CSV/LAS source</Label>
              <Input
                id="log-data-import-review-file"
                type="file"
                accept=".csv,.las,text/csv"
                multiple
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Selected WITS context: {selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "none"}. CSV rows are imported through POST /api/mwd-data. LAS files are reported as skipped until a LAS log parser endpoint exists.
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
                  <SummaryTile label="Mapped files" value={String(importBatch.mappedFiles.length)} />
                  <SummaryTile label="Importable values" value={String(importBatch.totalImportableValues)} />
                  <SummaryTile label="Unmapped files" value={String(importBatch.unmappedFiles.length)} />
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
              </div>
            ) : null}

            {importResult ? (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                Imported {importResult.importedValues} value(s); failed {importResult.failedValues} value(s). Backend POST requests: {importResult.postedRequests}/{importResult.totalRequests}.
              </div>
            ) : null}

            <Button
              onClick={onCommitImport}
              disabled={!importBatch || importBatch.totalImportableValues === 0 || importScanning || importCommitting || !selectedChannel}
              className="w-full justify-center"
            >
              <FileUp className="mr-2 size-4" />
              {importCommitting ? "Importing..." : "Import mapped WITS values"}
            </Button>
          </div>
        </Card>

        <Card className="rounded-2xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-muted p-2">
                <GitCompare className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">Memory Import and Correlation</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the dedicated memory workflow for backend memory files, point review, dry-run correlation, and apply correlation.
                </p>
              </div>
            </div>
            <Badge variant="secondary">Backend workflow</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Backend file list" value="GET /api/memory-files" />
            <SummaryTile label="Import file" value="POST /api/memory-files/import" />
            <SummaryTile label="Points review" value="GET /api/memory-files/:id/points" />
            <SummaryTile label="Correlation" value="POST /api/memory-files/:id/correlate" />
          </div>

          <div className="mt-4 rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {channels.length} configured WITS ID{channels.length === 1 ? "" : "s"} available from Log Data context. Current channel:{" "}
            <span className="font-medium text-foreground">{selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "none"}</span>.
          </div>

          <Button className="mt-4 w-full justify-center" onClick={openMemoryWorkflow}>
            Open Memory Import
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </Card>
      </div>

      <Card className="rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border bg-muted p-2">
            <Database className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Runtime Data Boundary</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Log Data runtime rows remain sourced from backend MWD/WITS endpoints. CSV import, move, copy, delete, hide, unhide, and rescale tools use backend write/preview/apply endpoints.
            </p>
          </div>
        </div>
        <PlaceholderNote>
          CSV import posts mapped WITS values through `POST /api/mwd-data`, which writes backend WITS data values and then refreshes the Log Data view.
        </PlaceholderNote>
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
