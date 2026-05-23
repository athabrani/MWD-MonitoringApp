"use client";

import { ChangeEvent, Dispatch, SetStateAction, useMemo, useState } from "react";
import { ArrowDownUp, Copy, FileSearch, FileUp, GitCompare, RotateCcw, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PlaceholderNote } from "@/components/layouts/workspace-section";
import {
  applyCorrelationSettings,
  buildCompareRows,
  importMemorySegment,
  parseMemoryCsv,
} from "@/lib/memory-import";
import { AppPage } from "@/components/layouts/app-layout";
import {
  CopyDepthRequest,
  ImportedMemoryDataset,
  MemoryCorrelationSettings,
  MemoryImportFile,
  MemoryImportSegment,
  MemoryStorageChannel,
} from "@/types/memory-import";
import { LogDataRecord } from "@/types/monitoring";
import { cn } from "@/lib/utils";

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
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function segmentColor(index: number): string {
  const colors = ["bg-emerald-500", "bg-red-500", "bg-amber-500", "bg-violet-500", "bg-sky-500"];
  return colors[index % colors.length];
}

function toStorageChannel(channel: LogDataChannelSummary): MemoryStorageChannel {
  return {
    id: `log-memory-${channel.witsId}`,
    witsId: channel.witsId,
    name: channel.label,
    decimalPlaces: channel.decimalPlaces,
    scaleFactor: channel.scaleFactor,
    bitOffset: 0,
    sensorSpacing: channel.sensorSpacing,
    plotScaleInfo: "Log Data memory import storage",
    createdAt: new Date().toISOString(),
    source: "configuration",
  };
}

function segmentDepthRange(segment: MemoryImportSegment): string {
  return `${formatNumber(segment.startDepth)} - ${formatNumber(segment.endDepth)}`;
}

export function LogDataMemoryImportPanel({
  selectedChannel,
  channels,
  records,
  setRecords,
  onNavigate,
}: {
  selectedChannel: LogDataChannelSummary | null;
  channels: LogDataChannelSummary[];
  records: LogDataRecord[];
  setRecords: Dispatch<SetStateAction<LogDataRecord[]>>;
  onNavigate?: (page: AppPage) => void;
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
  const [compareTargetWitsId, setCompareTargetWitsId] = useState(channels[0]?.witsId ?? "");
  const [copyTargetWitsId, setCopyTargetWitsId] = useState(channels.find((channel) => channel.witsId !== selectedChannel?.witsId)?.witsId ?? "");
  const [copyRange, setCopyRange] = useState({ startDepth: 0, endDepth: 0 });
  const [copyRequests, setCopyRequests] = useState<CopyDepthRequest[]>([]);

  const selectedSegment = memoryFile?.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const channelDatasets = selectedChannel
    ? datasets.filter((dataset) => dataset.storageWitsId === selectedChannel.witsId)
    : [];
  const activeDataset = channelDatasets.find((dataset) => dataset.id === activeDatasetId) ?? channelDatasets[0] ?? null;
  const existingRecords = useMemo(
    () =>
      selectedChannel
        ? records.filter((record) => record.witsId === selectedChannel.witsId && !record.hidden)
        : [],
    [records, selectedChannel]
  );
  const existingDepthRange = useMemo(() => {
    if (existingRecords.length === 0) return null;
    const depths = existingRecords.map((record) => record.depth);
    return { startDepth: Math.min(...depths), endDepth: Math.max(...depths) };
  }, [existingRecords]);
  const compareRows = useMemo(
    () => buildCompareRows(activeDataset, records.filter((record) => record.witsId === compareTargetWitsId && !record.hidden)),
    [activeDataset, compareTargetWitsId, records]
  );
  const copyPreviewRows = activeDataset
    ? activeDataset.samples.filter((sample) => sample.depth >= copyRange.startDepth && sample.depth <= copyRange.endDepth)
    : [];

  const updateCopyRangeFromDataset = (dataset: ImportedMemoryDataset) => {
    const depths = dataset.samples.map((sample) => sample.depth);
    setCopyRange({
      startDepth: Math.min(...depths),
      endDepth: Math.max(...depths),
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = parseMemoryCsv(file.name, await file.text());
      setMemoryFile(parsed);
      setSelectedSegmentId(parsed.segments[0]?.id ?? "");
      setSelectedFieldName(parsed.segments[0]?.fieldName ?? parsed.detectedFields[0] ?? "");
      toast.success(`${parsed.fileName} scanned for import`);
    } catch {
      toast.error("Unable to read memory CSV file");
    } finally {
      event.target.value = "";
    }
  };

  const loadMockFile = () => {
    const parsed = parseMemoryCsv("vendor-memory-export-demo.csv", "");
    setMemoryFile(parsed);
    setSelectedSegmentId(parsed.segments[0]?.id ?? "");
    setSelectedFieldName(parsed.segments[0]?.fieldName ?? "gamma");
    toast.success("Mock memory CSV scanned locally");
  };

  const importSelectedSegment = () => {
    if (!selectedChannel || !memoryFile || !selectedSegment || !selectedFieldName) {
      toast.error("Select WITS ID, file, data field, and segment before import");
      return;
    }

    const dataset = importMemorySegment(toStorageChannel(selectedChannel), memoryFile, selectedSegment, selectedFieldName);
    const importedRecords: LogDataRecord[] = dataset.samples.map((sample) => ({
      id: sample.id,
      witsId: dataset.storageWitsId,
      label: dataset.storageName,
      depth: sample.depth,
      value: sample.value,
      timestamp: sample.timestamp,
      hidden: false,
      source: "Memory Import",
      notes: `${dataset.fileName} / ${dataset.segmentName}`,
    }));

    setDatasets((current) => [dataset, ...current]);
    setActiveDatasetId(dataset.id);
    updateCopyRangeFromDataset(dataset);
    setRecords((current) => [...current, ...importedRecords]);
    toast.success(`${dataset.samples.length} samples imported into WITS ID ${dataset.storageWitsId}`);
  };

  const applyCorrelation = () => {
    if (!activeDataset) {
      toast.error("Import a memory segment before correlation");
      return;
    }

    const settings = { ...correlationSettings, updatedAt: new Date().toISOString() };
    const correlated = applyCorrelationSettings(activeDataset, settings);
    setDatasets((current) => current.map((dataset) => (dataset.id === activeDataset.id ? correlated : dataset)));
    setRecords((current) =>
      current.map((record) => {
        const sample = correlated.samples.find((item) => item.id === record.id);
        return sample
          ? {
              ...record,
              timestamp: sample.timestamp,
              depth: sample.depth,
              value: sample.value,
              notes: `${record.notes ?? ""} Correlated`.trim(),
            }
          : record;
      })
    );
    toast.success("Imported data correlation applied locally");
  };

  const applyCopyDepths = () => {
    if (!activeDataset || !copyTargetWitsId || copyPreviewRows.length === 0) {
      toast.error("Review copy depths source, target, and depth range");
      return;
    }

    const target = channels.find((channel) => channel.witsId === copyTargetWitsId);
    const copiedRecords: LogDataRecord[] = copyPreviewRows.map((sample) => ({
      id: `copy-${activeDataset.id}-${sample.id}-${Date.now()}`,
      witsId: copyTargetWitsId,
      label: target?.label ?? `WITS ${copyTargetWitsId}`,
      depth: sample.depth,
      value: sample.value,
      timestamp: new Date().toISOString(),
      hidden: false,
      source: "Copy Depths",
      notes: `Copied from ${activeDataset.storageWitsId} ${activeDataset.segmentName}`,
    }));
    const request: CopyDepthRequest = {
      id: `copy-depth-${Date.now()}`,
      sourceDatasetId: activeDataset.id,
      sourceWitsId: activeDataset.storageWitsId,
      targetWitsId: copyTargetWitsId,
      startDepth: copyRange.startDepth,
      endDepth: copyRange.endDepth,
      affectedRows: copiedRecords.length,
      createdAt: new Date().toISOString(),
      status: "applied-local",
    };

    setRecords((current) => [...current, ...copiedRecords]);
    setCopyRequests((current) => [request, ...current]);
    setDatasets((current) =>
      current.map((dataset) => (dataset.id === activeDataset.id ? { ...dataset, status: "gap-fill-staged" } : dataset))
    );
    toast.success(`${copiedRecords.length} rows copied to WITS ID ${copyTargetWitsId}`);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-dashed p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Memory File Import</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Import memory CSV data into the selected WITS ID, choose the file field and run segment, then correlate and copy depths for gap filling.
            </p>
          </div>
          <Badge variant="secondary">{selectedChannel ? `${selectedChannel.witsId} target` : "No WITS ID selected"}</Badge>
        </div>
      </Card>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="correlate">Correlate</TabsTrigger>
          <TabsTrigger value="copy-depths">Copy Depths</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileUp className="size-4" />
                Select memory CSV
              </div>
              <div className="mt-4 space-y-3">
                <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={!selectedChannel} />
                <Button variant="outline" onClick={loadMockFile} disabled={!selectedChannel}>
                  <RotateCcw className="mr-2 size-4" />
                  Load mock vendor CSV
                </Button>
                <PlaceholderNote>
                  This parser is local and basic. It scans CSV headers, detects depth/time/value fields, and stores imported rows in local state.
                </PlaceholderNote>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileSearch className="size-4" />
                Scan results
              </div>
              {memoryFile ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SummaryTile label="File" value={memoryFile.fileName} />
                  <SummaryTile label="Rows" value={String(memoryFile.totalRows)} />
                  <SummaryTile label="Fields" value={memoryFile.detectedFields.join(", ")} />
                  <SummaryTile label="Time span" value={`${formatDateTime(memoryFile.detectedTimeSpan.start)} - ${formatDateTime(memoryFile.detectedTimeSpan.end)}`} />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Scan a CSV file to choose data and segment for this WITS ID.
                </div>
              )}
            </Card>
          </div>

          {memoryFile ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="p-4">
                <h3 className="font-semibold">Choose data and segment</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data field imported into this WITS ID</Label>
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
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Selected field will be imported into WITS ID <span className="font-semibold text-foreground">{selectedChannel?.witsId}</span>. Existing rows are not overwritten.
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {memoryFile.segments.map((segment, index) => (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => setSelectedSegmentId(segment.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40",
                        selectedSegmentId === segment.id && "border-primary bg-primary/10"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{segment.name}</span>
                            <Badge className={cn("text-white", segmentColor(index))}>{segment.sampleCount} samples</Badge>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <span>From: {formatDateTime(segment.startTime)}</span>
                            <span>To: {formatDateTime(segment.endTime)}</span>
                            <span>Depth: {segmentDepthRange(segment)}</span>
                            <span>Field: {segment.fieldName}</span>
                          </div>
                        </div>
                        <Badge variant={selectedSegmentId === segment.id ? "default" : "outline"}>
                          {selectedSegmentId === segment.id ? "Selected" : "Select"}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>

                <Button className="mt-4" onClick={importSelectedSegment} disabled={!selectedChannel || !selectedSegment || !selectedFieldName}>
                  Import selected segment
                </Button>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold">Date/time profile</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Blue indicates current database range; colored bands indicate memory file segments.
                </p>
                <div className="mt-4 space-y-3">
                  <TimelineBand label="Existing database" className="bg-blue-600" value={existingDepthRange ? `${formatNumber(existingDepthRange.startDepth)} - ${formatNumber(existingDepthRange.endDepth)}` : "No existing rows"} />
                  {memoryFile.segments.map((segment, index) => (
                    <TimelineBand
                      key={segment.id}
                      label={segment.name}
                      className={segmentColor(index)}
                      value={`${formatDateTime(segment.startTime)} - ${formatDateTime(segment.endTime)}`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-blue-600 text-white">Existing database range</Badge>
                  {memoryFile.segments.map((segment, index) => (
                    <Badge key={segment.id} className={cn("text-white", segmentColor(index))}>{segment.name}</Badge>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {channelDatasets.length > 0 ? (
            <DatasetTable datasets={channelDatasets} activeDatasetId={activeDataset?.id ?? ""} onSelect={setActiveDatasetId} />
          ) : null}
        </TabsContent>

        <TabsContent value="correlate" className="space-y-4">
          {activeDataset ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Compare imported data to real-time data</h3>
                      <p className="text-sm text-muted-foreground">Use this preview before re-correlating to hole depth.</p>
                    </div>
                    <div className="flex min-w-[240px] items-center gap-2">
                      <Label className="shrink-0">Compare to</Label>
                      <Select value={compareTargetWitsId} onValueChange={setCompareTargetWitsId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((channel) => (
                            <SelectItem key={channel.witsId} value={channel.witsId}>{channel.witsId} - {channel.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Table className="mt-4">
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
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold">Correlation tools</h3>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Re-correlate time shift seconds</Label>
                      <Input type="number" value={correlationSettings.timeShiftSeconds} onChange={(event) => setCorrelationSettings((current) => ({ ...current, timeShiftSeconds: Number(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Shift depths up/down</Label>
                      <Input type="number" step="0.1" value={correlationSettings.depthShift} onChange={(event) => setCorrelationSettings((current) => ({ ...current, depthShift: Number(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Re-scale data</Label>
                      <Input type="number" step="0.01" value={correlationSettings.scaleFactor} onChange={(event) => setCorrelationSettings((current) => ({ ...current, scaleFactor: Number(event.target.value) }))} />
                    </div>
                    <Button className="w-full" onClick={applyCorrelation}>
                      <Scale className="mr-2 size-4" />
                      Apply correlate
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => onNavigate?.("data-management-plotting")}>
                      Plot Configurations
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard icon={GitCompare} label="Imported dataset" value={activeDataset.segmentName} />
                <SummaryCard icon={ArrowDownUp} label="Imported rows" value={String(activeDataset.samples.length)} />
                <SummaryCard icon={Scale} label="Status" value={activeDataset.status} />
              </div>
            </>
          ) : (
            <PlaceholderNote>Import memory data first. The Correlate section appears for the selected WITS ID after import.</PlaceholderNote>
          )}
        </TabsContent>

        <TabsContent value="copy-depths" className="space-y-4">
          {activeDataset ? (
            <Card className="p-4">
              <h3 className="font-semibold">Gap filling with Copy Depths</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Copy imported memory samples from source WITS ID {activeDataset.storageWitsId} into another WITS ID over the selected depth range.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Target WITS ID</Label>
                  <Select value={copyTargetWitsId} onValueChange={setCopyTargetWitsId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels
                        .filter((channel) => channel.witsId !== activeDataset.storageWitsId)
                        .map((channel) => (
                          <SelectItem key={channel.witsId} value={channel.witsId}>{channel.witsId} - {channel.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start depth</Label>
                  <Input type="number" value={copyRange.startDepth} onChange={(event) => setCopyRange((current) => ({ ...current, startDepth: Number(event.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>End depth</Label>
                  <Input type="number" value={copyRange.endDepth} onChange={(event) => setCopyRange((current) => ({ ...current, endDepth: Number(event.target.value) }))} />
                </div>
                <div className="flex items-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" disabled={!copyTargetWitsId || copyPreviewRows.length === 0}>
                        <Copy className="mr-2 size-4" />
                        Copy Depths
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Copy imported depths?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {copyPreviewRows.length} imported memory rows will be copied from WITS ID {activeDataset.storageWitsId} to WITS ID {copyTargetWitsId}. Existing source data will remain unchanged.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={applyCopyDepths}>Apply Copy Depths</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
                Preview: <span className="font-semibold">{copyPreviewRows.length}</span> rows will be copied in depth range {formatNumber(copyRange.startDepth)} - {formatNumber(copyRange.endDepth)}.
              </div>
              {copyRequests.length > 0 ? (
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Depth range</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {copyRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.sourceWitsId}</TableCell>
                        <TableCell>{request.targetWitsId}</TableCell>
                        <TableCell>{formatNumber(request.startDepth)} - {formatNumber(request.endDepth)}</TableCell>
                        <TableCell>{request.affectedRows}</TableCell>
                        <TableCell><Badge variant="outline">{request.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </Card>
          ) : (
            <PlaceholderNote>Import and correlate memory data before using Copy Depths for gap filling.</PlaceholderNote>
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-base font-semibold">{value}</div>
    </Card>
  );
}

function TimelineBand({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{value}</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-muted">
        <div className={cn("h-3 rounded-full", className)} style={{ width: "76%" }} />
      </div>
    </div>
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
      <h3 className="font-semibold">Imported datasets</h3>
      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Dataset</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Rows</TableHead>
            <TableHead>Status</TableHead>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
