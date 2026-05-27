"use client";

import { ChangeEvent, ComponentType, useMemo, useState } from "react";
import { ArrowDownUp, Copy, FileSearch, FileUp, GitCompare, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceholderNote } from "@/components/layouts/workspace-section";
import {
  applyCorrelationSettings,
  buildCompareRows,
  createGapFillRequest,
  importMemorySegment,
  parseMemoryCsv,
} from "@/lib/memory-import";
import {
  GapFillRequest,
  ImportedMemoryDataset,
  MemoryCorrelationSettings,
  MemoryImportFile,
  MemoryImportSegment,
  WitsIdStorageChannel,
} from "@/types/memory-import";
import { PolarisWitsId } from "@/types/polaris";
import { cn } from "@/lib/utils";

const reservedRealtimeIds = new Set(["0110", "0113", "0121", "0130", "0713", "0714", "0716", "0717", "0823", "0824", "0836", "0921"]);
const badMemoryExamples = new Set(["0126", "0166", "0855"]);
const targetWitsIds = ["0824", "0716", "0717", "0921"];

function fourDigitWitsId(value: number): string {
  return String(value).padStart(4, "0");
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function getMemoryStorageWarning(record: PolarisWitsId, allWitsIds: PolarisWitsId[]): string | null {
  const witsId = fourDigitWitsId(record.numericId);
  const duplicate = allWitsIds.some((item) => item.id !== record.id && item.numericId === record.numericId);

  if (!/^\d{4}$/.test(witsId)) {
    return "Memory storage should use a four-digit WITS ID.";
  }

  if (duplicate || reservedRealtimeIds.has(witsId)) {
    return "This WITS ID appears to conflict with an existing real-time or configured WITS channel.";
  }

  if (witsId.startsWith("0") || badMemoryExamples.has(witsId)) {
    return "Avoid low/reserved-looking IDs such as 0126, 0166, and 0855 for memory storage.";
  }

  return null;
}

function toStorageChannel(record: PolarisWitsId): WitsIdStorageChannel {
  return {
    id: `config-memory-${record.id}`,
    configurationWitsRecordId: record.id,
    witsId: fourDigitWitsId(record.numericId),
    name: record.name,
    decimalPlaces: record.decimalPlaces,
    scaleFactor: record.scaleFactor,
    bitOffset: record.biasOffset,
    sensorSpacing: record.sensorToBitSpacing,
    plotScaleInfo: record.plotScaleInfo || record.realTimePlot,
    createdAt: new Date().toISOString(),
    source: "configuration",
  };
}

function SegmentSparkline({ segment }: { segment: MemoryImportSegment }) {
  const values = segment.rows.map((row) => row.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <div className="flex h-12 items-end gap-1 rounded-md border bg-muted/30 p-2">
      {segment.rows.slice(0, 24).map((row, index) => (
        <div
          key={`${segment.id}-${index}`}
          className="w-full rounded-sm bg-primary/70"
          style={{ height: `${20 + ((row.value - min) / range) * 72}%` }}
        />
      ))}
    </div>
  );
}

export function WitsMemoryImportPanel({
  activeWitsRecord,
  allWitsIds,
  onUpdateWits,
}: {
  activeWitsRecord: PolarisWitsId;
  allWitsIds: PolarisWitsId[];
  onUpdateWits: (patch: Partial<PolarisWitsId>) => void;
}) {
  const [memoryFile, setMemoryFile] = useState<MemoryImportFile | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [selectedFieldName, setSelectedFieldName] = useState("");
  const [datasets, setDatasets] = useState<ImportedMemoryDataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState("");
  const [correlationSettings, setCorrelationSettings] = useState<MemoryCorrelationSettings>({
    timeShiftSeconds: 0,
    depthShift: 0,
    scaleFactor: 1,
  });
  const [gapTargetWitsId, setGapTargetWitsId] = useState(targetWitsIds[0]);
  const [gapMode, setGapMode] = useState<GapFillRequest["mode"]>("fill-gaps-only");
  const [gapRequests, setGapRequests] = useState<GapFillRequest[]>([]);

  const storageWarning = getMemoryStorageWarning(activeWitsRecord, allWitsIds);
  const storageChannel = useMemo(() => toStorageChannel(activeWitsRecord), [activeWitsRecord]);
  const selectedSegment = memoryFile?.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const witsDatasets = datasets.filter((dataset) => dataset.storageWitsId === storageChannel.witsId);
  const activeDataset = witsDatasets.find((dataset) => dataset.id === activeDatasetId) ?? witsDatasets[0] ?? null;
  const compareRows = useMemo(() => buildCompareRows(activeDataset, []), [activeDataset]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = parseMemoryCsv(file.name, await file.text());
      setMemoryFile(parsed);
      setSelectedSegmentId(parsed.segments[0]?.id ?? "");
      setSelectedFieldName(parsed.segments[0]?.fieldName ?? parsed.detectedFields[0] ?? "");
      toast.success(`${parsed.fileName} scanned for WITS ID ${storageChannel.witsId}`);
    } catch {
      toast.error("Unable to read memory CSV file");
    } finally {
      event.target.value = "";
    }
  };

  const importSelectedSegment = () => {
    if (!activeWitsRecord.useForMemoryImportStorage) {
      toast.error("Enable this WITS ID as memory import storage first");
      return;
    }

    if (storageWarning) {
      toast.error(storageWarning);
      return;
    }

    if (!memoryFile || !selectedSegment || !selectedFieldName) {
      toast.error("Select a file, segment, and data field before import");
      return;
    }

    const dataset = importMemorySegment(storageChannel, memoryFile, selectedSegment, selectedFieldName);
    setDatasets((current) => [dataset, ...current]);
    setActiveDatasetId(dataset.id);
    toast.success(`${dataset.samples.length} samples imported to WITS ID ${dataset.storageWitsId}`);
  };

  const applyCorrelation = () => {
    if (!activeDataset) {
      toast.error("Import memory data before correlation");
      return;
    }

    const settings = { ...correlationSettings, updatedAt: new Date().toISOString() };
    setDatasets((current) =>
      current.map((dataset) => (dataset.id === activeDataset.id ? applyCorrelationSettings(dataset, settings) : dataset))
    );
    setCorrelationSettings(settings);
    toast.success("Memory data correlation updated locally");
  };

  const stageGapFill = () => {
    if (!activeDataset) {
      toast.error("Import memory data before staging gap fill");
      return;
    }

    const depths = activeDataset.samples.map((sample) => sample.depth);
    const request = createGapFillRequest({
      dataset: activeDataset,
      targetWitsId: gapTargetWitsId,
      startDepth: Math.min(...depths),
      endDepth: Math.max(...depths),
      mode: gapMode,
    });

    setGapRequests((current) => [request, ...current]);
    setDatasets((current) =>
      current.map((dataset) => (dataset.id === activeDataset.id ? { ...dataset, status: "gap-fill-staged" } : dataset))
    );
    toast.success(`${request.affectedSamples} samples staged for local gap fill`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h5 className="font-semibold">Memory import storage target</h5>
            <p className="mt-1 text-sm text-muted-foreground">
              Polaris flow starts by creating a unique WITS ID that stores imported memory data. Good examples: 7001, 2055, 8023. Avoid 0126, 0166, 0855 and IDs already used by real-time rig or MWD tool data.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <Label htmlFor="memory-storage-switch" className="text-sm">Use for memory import storage</Label>
            <Switch
              id="memory-storage-switch"
              checked={activeWitsRecord.useForMemoryImportStorage}
              onCheckedChange={(value) => onUpdateWits({ useForMemoryImportStorage: value })}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SummaryTile label="Storage WITS ID" value={storageChannel.witsId} />
          <SummaryTile label="Scale / decimals" value={`${activeWitsRecord.scaleFactor} / ${activeWitsRecord.decimalPlaces}`} />
          <SummaryTile label="Plot scale info" value={activeWitsRecord.plotScaleInfo || "Not set"} />
        </div>

        {storageWarning ? (
          <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {storageWarning}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            This WITS ID is available for local memory import storage.
          </div>
        )}
      </Card>

      <Tabs defaultValue="file" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="file">File and Segment</TabsTrigger>
          <TabsTrigger value="correlate">Correlate</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="gap-fill">Gap Fill</TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <Card className="p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileUp className="size-4" />
                Select memory CSV
              </div>
              <div className="mt-4 space-y-3">
                <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={!activeWitsRecord.useForMemoryImportStorage} />
                <PlaceholderNote>
                  Parser and imported storage are browser local state. No production backend write is performed.
                </PlaceholderNote>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileSearch className="size-4" />
                Scan summary
              </div>
              {memoryFile ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SummaryTile label="File" value={memoryFile.fileName} />
                  <SummaryTile label="Rows" value={String(memoryFile.totalRows)} />
                  <SummaryTile label="Fields" value={memoryFile.detectedFields.join(", ")} />
                  <SummaryTile label="Segments" value={String(memoryFile.segments.length)} />
                  <SummaryTile label="Start" value={formatDateTime(memoryFile.detectedTimeSpan.start)} />
                  <SummaryTile label="End" value={formatDateTime(memoryFile.detectedTimeSpan.end)} />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Belum ada memory file.</div>
              )}
            </Card>
          </div>

          {memoryFile ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="p-4">
                <h5 className="font-semibold">Detected segments</h5>
                <div className="mt-3 space-y-3">
                  {memoryFile.segments.map((segment) => (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => setSelectedSegmentId(segment.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40",
                        selectedSegmentId === segment.id && "border-primary bg-primary/10"
                      )}
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{segment.name}</span>
                            <Badge variant="outline">{segment.sampleCount} samples</Badge>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <span>Start: {formatDateTime(segment.startTime)}</span>
                            <span>End: {formatDateTime(segment.endTime)}</span>
                            <span>Depth: {formatNumber(segment.startDepth)} - {formatNumber(segment.endDepth)}</span>
                            <span>Default field: {segment.fieldName}</span>
                          </div>
                        </div>
                        <SegmentSparkline segment={segment} />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h5 className="font-semibold">Data field mapping</h5>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the memory CSV field that will be written into this WITS ID storage channel.
                </p>
                <div className="mt-4 space-y-2">
                  <Label>Memory data field</Label>
                  <Select value={selectedFieldName} onValueChange={setSelectedFieldName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {memoryFile.detectedFields.map((field) => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="mt-4" onClick={importSelectedSegment}>
                  Import file to WITS ID {storageChannel.witsId}
                </Button>
              </Card>
            </div>
          ) : null}

          {witsDatasets.length > 0 ? (
            <DatasetTable datasets={witsDatasets} activeDatasetId={activeDataset?.id ?? ""} onSelect={setActiveDatasetId} />
          ) : null}
        </TabsContent>

        <TabsContent value="correlate" className="space-y-4">
          {activeDataset ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Re-correlate time shift seconds</Label>
                  <Input type="number" value={correlationSettings.timeShiftSeconds} onChange={(event) => setCorrelationSettings((current) => ({ ...current, timeShiftSeconds: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Shift depths up/down</Label>
                  <Input type="number" step="0.1" value={correlationSettings.depthShift} onChange={(event) => setCorrelationSettings((current) => ({ ...current, depthShift: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Re-scale data factor</Label>
                  <Input type="number" step="0.01" value={correlationSettings.scaleFactor} onChange={(event) => setCorrelationSettings((current) => ({ ...current, scaleFactor: Number(event.target.value) }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard icon={ArrowDownUp} label="Depth samples" value={`${activeDataset.samples.length} rows`} />
                <SummaryCard icon={Scale} label="First value" value={formatNumber(activeDataset.samples[0]?.value ?? 0, 3)} />
                <SummaryCard icon={GitCompare} label="Dataset status" value={activeDataset.status} />
              </div>
              <Button onClick={applyCorrelation}>
                <Scale className="mr-2 size-4" />
                Apply correlation locally
              </Button>
            </>
          ) : (
            <PlaceholderNote>Import a segment into this WITS ID before correlation tools are available.</PlaceholderNote>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          {activeDataset ? (
            <>
              <div className="flex max-w-sm items-center gap-2">
                <Label className="shrink-0">Real-time WITS ID</Label>
                <Select value={gapTargetWitsId} onValueChange={setGapTargetWitsId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {targetWitsIds.map((witsId) => <SelectItem key={witsId} value={witsId}>{witsId}</SelectItem>)}
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
            </>
          ) : (
            <PlaceholderNote>Import memory data before comparing against real-time records.</PlaceholderNote>
          )}
        </TabsContent>

        <TabsContent value="gap-fill" className="space-y-4">
          {activeDataset ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Target WITS ID</Label>
                  <Select value={gapTargetWitsId} onValueChange={setGapTargetWitsId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {targetWitsIds.map((witsId) => <SelectItem key={witsId} value={witsId}>{witsId}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={gapMode} onValueChange={(value) => setGapMode(value as GapFillRequest["mode"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fill-gaps-only">Fill gaps only</SelectItem>
                      <SelectItem value="copy-depths">Copy depths</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={stageGapFill}>
                    <Copy className="mr-2 size-4" />
                    Stage local gap fill
                  </Button>
                </div>
              </div>
              <PlaceholderNote>
                This creates a local gap-fill request only. It does not overwrite live WITS data or backend storage.
              </PlaceholderNote>
              {gapRequests.length > 0 ? (
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
                    {gapRequests.map((request) => (
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
            </>
          ) : (
            <PlaceholderNote>Import memory data before staging copy-depths or gap-fill actions.</PlaceholderNote>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
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
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2 text-base font-semibold">{value}</div>
    </Card>
  );
}

function DatasetTable({
  datasets,
  activeDatasetId,
  onSelect,
}: {
  datasets: ImportedMemoryDataset[];
  activeDatasetId: string;
  onSelect: (datasetId: string) => void;
}) {
  return (
    <Card className="p-4">
      <h5 className="font-semibold">Imported datasets for this WITS ID</h5>
      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Dataset</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Samples</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Imported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datasets.map((dataset) => (
            <TableRow
              key={dataset.id}
              className={activeDatasetId === dataset.id ? "bg-muted/60" : ""}
              onClick={() => onSelect(dataset.id)}
            >
              <TableCell>{dataset.segmentName}</TableCell>
              <TableCell>{dataset.fileName}</TableCell>
              <TableCell>{dataset.samples.length}</TableCell>
              <TableCell><Badge variant="outline">{dataset.status}</Badge></TableCell>
              <TableCell>{formatDateTime(dataset.importedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
