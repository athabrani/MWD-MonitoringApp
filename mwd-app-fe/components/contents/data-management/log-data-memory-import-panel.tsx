"use client";

import { useState, type ChangeEvent } from "react";
import { ArrowRight, Database, FileUp, GitCompare, ServerOff } from "lucide-react";
import { toast } from "sonner";
import { AppPage } from "@/components/layouts/app-layout";
import { PlaceholderNote } from "@/components/layouts/workspace-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  onNavigate,
}: {
  selectedChannel: LogDataChannelSummary | null;
  channels: LogDataChannelSummary[];
  onNavigate?: (page: AppPage) => void;
}) {
  const [selectedFileName, setSelectedFileName] = useState("");

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileName = event.target.files?.[0]?.name ?? "";
    setSelectedFileName(fileName);

    if (fileName) {
      toast.message("CSV/LAS import endpoint belum tersedia.", {
        description: "File hanya dipilih untuk review UI; tidak ada data yang ditulis ke runtime.",
      });
    }
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
              Log Data does not create runtime rows from local files. Import actions either require a backend endpoint or route to the backend memory-file workflow.
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
                  Intended flow for importing external log files into backend MWD/WITS storage.
                </p>
              </div>
            </div>
            <Badge variant="outline">Blocked by backend</Badge>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="log-data-import-review-file">Source file review</Label>
              <Input
                id="log-data-import-review-file"
                type="file"
                accept=".csv,.las,.txt"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Selecting a file does not parse, upload, or mutate operational data.
              </p>
            </div>

            {selectedFileName ? (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                Selected file: <span className="font-medium">{selectedFileName}</span>
              </div>
            ) : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              CSV/LAS import requires a backend import endpoint. Until then, this page must show unavailable state instead of creating local data.
            </div>

            <Button
              variant="outline"
              disabled
              className="w-full justify-center"
              title="CSV/LAS import endpoint is not available yet."
            >
              <ServerOff className="mr-2 size-4" />
              Import endpoint unavailable
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
              Log Data runtime rows remain sourced from backend MWD/WITS endpoints. Move, copy, delete, hide, unhide, and rescale tools continue to use backend preview/apply endpoints.
            </p>
          </div>
        </div>
        <PlaceholderNote>
          No local CSV/LAS or memory import writes to `records` in this Log Data panel. Use backend endpoints or unavailable state only.
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
