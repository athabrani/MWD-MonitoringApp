"use client";

import { ChangeEvent, ComponentType, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Check,
  Copy,
  Database,
  FileSearch,
  FileUp,
  GitCompare,
  Loader2,
  Plus,
  RotateCcw,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceSection, PlaceholderNote } from "@/components/layouts/workspace-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  applyCorrelationSettings,
  buildCompareRows,
  createGapFillRequest,
  createMemoryStorageChannel,
  importMemorySegment,
  parseMemoryCsv,
  validateMemoryWitsId,
} from "@/lib/memory-import";
import { mockLogDataRecords } from "@/data/monitoring-data";
import {
  CorrelationSettings,
  GapFillRequest,
  ImportedMemoryDataset,
  MemoryImportFile,
  MemoryImportSegment,
  MemoryStorageChannel,
} from "@/types/memory-import";
import { cn } from "@/lib/utils";

type WizardStep = "storage" | "upload" | "scan" | "import" | "correlate";

const steps: Array<{ id: WizardStep; title: string; description: string }> = [
  { id: "storage", title: "Storage WITS ID", description: "Create or select memory storage" },
  { id: "upload", title: "Upload CSV", description: "Load vendor export file" },
  { id: "scan", title: "Scan Segment", description: "Review detected runs" },
  { id: "import", title: "Import", description: "Store selected samples locally" },
  { id: "correlate", title: "Correlate", description: "Shift, rescale, compare, fill gaps" },
];

const initialChannels: MemoryStorageChannel[] = [
  {
    id: "memory-channel-demo-7001",
    witsId: "7001",
    name: "Memory Gamma Ray",
    decimalPlaces: 2,
    scaleFactor: 1,
    bitOffset: 0,
    sensorSpacing: 0,
    plotScaleInfo: "0-200 API",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    source: "mock-local",
  },
];

const existingWitsTargets = ["0824", "0716", "0717", "0921"];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function stepStatus(step: WizardStep, activeStep: WizardStep, completedSteps: Set<WizardStep>) {
  if (completedSteps.has(step)) return "completed";
  if (step === activeStep) return "current";
  return "pending";
}

function SegmentProfile({ segment }: { segment: MemoryImportSegment }) {
  const values = segment.rows.map((row) => row.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = segment.rows.slice(0, 28);

  return (
    <div className="flex h-16 items-end gap-1 rounded-md border bg-muted/30 p-2">
      {points.map((row, index) => (
        <div
          key={`${segment.id}-${index}`}
          className="w-full rounded-sm bg-primary/70"
          style={{ height: `${22 + ((row.value - min) / range) * 70}%` }}
          title={`${formatNumber(row.depth)} ft: ${formatNumber(row.value, 3)}`}
        />
      ))}
    </div>
  );
}

function Stepper({
  activeStep,
  completedSteps,
  onStepSelect,
}: {
  activeStep: WizardStep;
  completedSteps: Set<WizardStep>;
  onStepSelect: (step: WizardStep) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-5">
      {steps.map((step, index) => {
        const status = stepStatus(step.id, activeStep, completedSteps);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepSelect(step.id)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left transition-colors",
              status === "current" && "border-primary bg-primary/10",
              status === "completed" && "border-emerald-500/40 bg-emerald-500/10",
              status === "pending" && "bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  status === "completed" && "border-emerald-500 bg-emerald-500 text-white",
                  status === "current" && "border-primary bg-primary text-primary-foreground"
                )}
              >
                {status === "completed" ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="text-sm font-semibold">{step.title}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{step.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export function MemoryImportWizard() {
  const [activeStep, setActiveStep] = useState<WizardStep>("storage");
  const [storageChannels, setStorageChannels] = useState<MemoryStorageChannel[]>(initialChannels);
  const [selectedStorageId, setSelectedStorageId] = useState(initialChannels[0].id);
  const [storageDraft, setStorageDraft] = useState({
    witsId: "8023",
    name: "Memory Resistivity",
    decimalPlaces: 2,
    scaleFactor: 1,
    bitOffset: 0,
    sensorSpacing: 0,
    plotScaleInfo: "Auto plot scale after import",
  });
  const [importFile, setImportFile] = useState<MemoryImportFile | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [datasets, setDatasets] = useState<ImportedMemoryDataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string>("");
  const [correlationSettings, setCorrelationSettings] = useState<CorrelationSettings>({
    timeShiftSeconds: 0,
    depthShift: 0,
    scaleFactor: 1,
  });
  const [gapTargetWitsId, setGapTargetWitsId] = useState(existingWitsTargets[0]);
  const [gapMode, setGapMode] = useState<GapFillRequest["mode"]>("fill-gaps-only");
  const [gapFillRequests, setGapFillRequests] = useState<GapFillRequest[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const selectedStorage = storageChannels.find((channel) => channel.id === selectedStorageId) ?? null;
  const selectedSegment = importFile?.segments.find((segment) => segment.id === selectedSegmentId) ?? null;
  const activeDataset = datasets.find((dataset) => dataset.id === activeDatasetId) ?? datasets[0] ?? null;
  const storageValidation = validateMemoryWitsId(storageDraft.witsId, storageChannels);

  const completedSteps = useMemo(() => {
    const completed = new Set<WizardStep>();
    if (selectedStorage) completed.add("storage");
    if (importFile) completed.add("upload");
    if (selectedSegment) completed.add("scan");
    if (activeDataset) completed.add("import");
    if (activeDataset?.status === "correlated" || gapFillRequests.length > 0) completed.add("correlate");
    return completed;
  }, [activeDataset, gapFillRequests.length, importFile, selectedSegment, selectedStorage]);

  const compareRows = useMemo(
    () => buildCompareRows(activeDataset, mockLogDataRecords.filter((record) => record.witsId === gapTargetWitsId && !record.hidden)),
    [activeDataset, gapTargetWitsId]
  );

  const progressValue = (completedSteps.size / steps.length) * 100;

  const handleCreateStorage = () => {
    const validation = validateMemoryWitsId(storageDraft.witsId, storageChannels);
    if (validation) {
      toast.error(validation);
      return;
    }

    const channel = createMemoryStorageChannel({
      witsId: storageDraft.witsId.trim(),
      name: storageDraft.name.trim() || `Memory ${storageDraft.witsId}`,
      decimalPlaces: storageDraft.decimalPlaces,
      scaleFactor: storageDraft.scaleFactor,
      bitOffset: storageDraft.bitOffset,
      sensorSpacing: storageDraft.sensorSpacing,
      plotScaleInfo: storageDraft.plotScaleInfo,
    });

    setStorageChannels((current) => [channel, ...current]);
    setSelectedStorageId(channel.id);
    setActiveStep("upload");
    toast.success(`Storage WITS ID ${channel.witsId} registered locally`);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const text = await file.text();
      const parsedFile = parseMemoryCsv(file.name, text);
      setImportFile(parsedFile);
      setSelectedSegmentId(parsedFile.segments[0]?.id ?? "");
      setActiveStep("scan");
      toast.success(`${parsedFile.fileName} scanned with ${parsedFile.segments.length} detected segment(s)`);
    } catch {
      toast.error("Unable to read memory CSV file");
    } finally {
      setIsParsing(false);
      event.target.value = "";
    }
  };

  const handleLoadMockFile = () => {
    const parsedFile = parseMemoryCsv("vendor-memory-export-demo.csv", "");
    setImportFile(parsedFile);
    setSelectedSegmentId(parsedFile.segments[0]?.id ?? "");
    setActiveStep("scan");
    toast.success("Mock vendor CSV loaded for demo workflow");
  };

  const handleImportSegment = () => {
    if (!selectedStorage || !importFile || !selectedSegment) {
      toast.error("Select storage and segment before import");
      return;
    }

    const dataset = importMemorySegment(selectedStorage, importFile, selectedSegment);
    setDatasets((current) => [dataset, ...current]);
    setActiveDatasetId(dataset.id);
    setActiveStep("correlate");
    toast.success(`${dataset.samples.length} samples imported to WITS ID ${dataset.storageWitsId}`);
  };

  const handleApplyCorrelation = () => {
    if (!activeDataset) {
      toast.error("Import a segment before correlation");
      return;
    }

    const settings = { ...correlationSettings, updatedAt: new Date().toISOString() };
    setDatasets((current) =>
      current.map((dataset) => (dataset.id === activeDataset.id ? applyCorrelationSettings(dataset, settings) : dataset))
    );
    setCorrelationSettings(settings);
    toast.success("Correlation settings applied locally");
  };

  const handleGapFill = () => {
    if (!activeDataset || activeDataset.samples.length === 0) {
      toast.error("No imported dataset available for gap fill");
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

    setGapFillRequests((current) => [request, ...current]);
    setDatasets((current) =>
      current.map((dataset) => (dataset.id === activeDataset.id ? { ...dataset, status: "gap-fill-staged" } : dataset))
    );
    toast.success(`${request.affectedSamples} imported samples staged for local gap fill`);
  };

  return (
    <div className="space-y-5">
      <WorkspaceSection
        title="Memory File Import"
        description="Operational wizard for vendor CSV memory exports. Storage, parsing, import, correlation, and gap fill are local demo workflows until a backend store is connected."
        badge="Mock local storage"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileSearch className="size-4" />
                Workflow
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
                <div>1. Select or register a non-conflicting WITS ID.</div>
                <div>2. Upload vendor CSV memory export.</div>
                <div>3. Scan detected fields and segments.</div>
                <div>4. Import selected segment to memory storage.</div>
                <div>5. Correlate and stage gap filling.</div>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold">WITS ID helper rule</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Good examples</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["7001", "2055", "8023"].map((id) => (
                      <Badge key={id} variant="secondary">{id}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bad examples</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["0126", "0166", "0855"].map((id) => (
                      <Badge key={id} variant="outline">{id}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Progress value={progressValue} />
          <Stepper activeStep={activeStep} completedSteps={completedSteps} onStepSelect={setActiveStep} />
        </div>
      </WorkspaceSection>

      {activeStep === "storage" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
          <WorkspaceSection title="Select Existing Memory Storage" description="Local state storage channels available for this browser session.">
            <div className="space-y-3">
              {storageChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedStorageId(channel.id)}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/40",
                    selectedStorageId === channel.id && "border-primary bg-primary/10"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{channel.witsId} - {channel.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Decimals {channel.decimalPlaces} | Scale {channel.scaleFactor} | Sensor spacing {channel.sensorSpacing}
                      </div>
                    </div>
                    <Badge variant="outline">{channel.source}</Badge>
                  </div>
                </button>
              ))}
              <Button onClick={() => setActiveStep("upload")} disabled={!selectedStorage}>
                Continue to upload
              </Button>
            </div>
          </WorkspaceSection>

          <WorkspaceSection title="Create/Register Storage WITS ID" description="Registers a mock local storage channel; no backend or decoder setting is changed.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>WITS ID</Label>
                <Input value={storageDraft.witsId} onChange={(event) => setStorageDraft((current) => ({ ...current, witsId: event.target.value }))} />
                {storageValidation ? <p className="text-xs text-destructive">{storageValidation}</p> : <p className="text-xs text-emerald-600">Available for mock memory storage.</p>}
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={storageDraft.name} onChange={(event) => setStorageDraft((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Decimal places</Label>
                <Input type="number" min={0} max={6} value={storageDraft.decimalPlaces} onChange={(event) => setStorageDraft((current) => ({ ...current, decimalPlaces: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Scale factor</Label>
                <Input type="number" step="0.01" value={storageDraft.scaleFactor} onChange={(event) => setStorageDraft((current) => ({ ...current, scaleFactor: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Bit offset</Label>
                <Input type="number" step="0.1" value={storageDraft.bitOffset} onChange={(event) => setStorageDraft((current) => ({ ...current, bitOffset: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Sensor spacing</Label>
                <Input type="number" step="0.1" value={storageDraft.sensorSpacing} onChange={(event) => setStorageDraft((current) => ({ ...current, sensorSpacing: Number(event.target.value) }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Plot scale info</Label>
                <Input value={storageDraft.plotScaleInfo} onChange={(event) => setStorageDraft((current) => ({ ...current, plotScaleInfo: event.target.value }))} />
              </div>
            </div>
            <Button className="mt-4" onClick={handleCreateStorage} disabled={Boolean(storageValidation)}>
              <Plus className="mr-2 size-4" />
              Register local storage
            </Button>
          </WorkspaceSection>
        </div>
      ) : null}

      {activeStep === "upload" ? (
        <WorkspaceSection title="Upload Memory File" description="CSV parser detects time/depth/value fields. If the file is empty or unreadable, the demo mock parser can be loaded explicitly.">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileUp className="size-4" />
                Select vendor CSV
              </div>
              <div className="mt-4 space-y-3">
                <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={isParsing} />
                <Button variant="outline" onClick={handleLoadMockFile} disabled={isParsing}>
                  {isParsing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RotateCcw className="mr-2 size-4" />}
                  Load mock vendor CSV
                </Button>
                <PlaceholderNote>
                  Real backend import is not wired. This page reads CSV in the browser and stores imported datasets in React local state.
                </PlaceholderNote>
              </div>
            </Card>

            <Card className="p-4">
              <div className="font-semibold">File summary</div>
              {importFile ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SummaryTile label="File name" value={importFile.fileName} />
                  <SummaryTile label="Parser mode" value={importFile.parserMode} />
                  <SummaryTile label="Detected fields" value={importFile.detectedFields.join(", ")} />
                  <SummaryTile label="Total rows" value={String(importFile.totalRows)} />
                  <SummaryTile label="Start" value={formatDateTime(importFile.detectedTimeSpan.start)} />
                  <SummaryTile label="End" value={formatDateTime(importFile.detectedTimeSpan.end)} />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No memory file loaded yet.</div>
              )}
            </Card>
          </div>
        </WorkspaceSection>
      ) : null}

      {activeStep === "scan" ? (
        <WorkspaceSection title="Scan and Select Segment" description="Detected segments are split by large time gaps. Select one run before importing to WITS ID storage.">
          {importFile ? (
            <div className="grid gap-3">
              {importFile.segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setSelectedSegmentId(segment.id)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors hover:bg-muted/40",
                    selectedSegmentId === segment.id && "border-primary bg-primary/10"
                  )}
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{segment.name}</div>
                        <Badge variant="outline">{segment.fieldName}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>Start: {formatDateTime(segment.startTime)}</div>
                        <div>End: {formatDateTime(segment.endTime)}</div>
                        <div>Samples: {segment.sampleCount}</div>
                        <div>Depth: {formatNumber(segment.startDepth)} - {formatNumber(segment.endDepth)}</div>
                      </div>
                    </div>
                    <SegmentProfile segment={segment} />
                  </div>
                </button>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setActiveStep("upload")} variant="outline">Back to upload</Button>
                <Button onClick={() => setActiveStep("import")} disabled={!selectedSegment}>Continue to import</Button>
              </div>
            </div>
          ) : (
            <PlaceholderNote>Upload or load a mock CSV before scanning segments.</PlaceholderNote>
          )}
        </WorkspaceSection>
      ) : null}

      {activeStep === "import" ? (
        <WorkspaceSection title="Import to Storage" description="Selected segment is copied into the chosen memory WITS storage as a separate local dataset. Existing log data is not overwritten.">
          <div className="grid gap-4 lg:grid-cols-3">
            <SummaryCard icon={Database} label="Target storage" value={selectedStorage ? `${selectedStorage.witsId} - ${selectedStorage.name}` : "None"} />
            <SummaryCard icon={FileSearch} label="Selected segment" value={selectedSegment ? `${selectedSegment.name}, ${selectedSegment.sampleCount} samples` : "None"} />
            <SummaryCard icon={Check} label="Existing datasets" value={`${datasets.length} local dataset(s)`} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setActiveStep("scan")}>Back to scan</Button>
            <Button onClick={handleImportSegment} disabled={!selectedStorage || !selectedSegment}>
              <Database className="mr-2 size-4" />
              Import selected segment
            </Button>
          </div>
          {datasets.length > 0 ? (
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">Import result summary</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WITS ID</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Samples</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>{dataset.storageWitsId}</TableCell>
                      <TableCell>{dataset.segmentName}</TableCell>
                      <TableCell>{dataset.samples.length}</TableCell>
                      <TableCell><Badge variant="outline">{dataset.status}</Badge></TableCell>
                      <TableCell>{formatDateTime(dataset.importedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </WorkspaceSection>
      ) : null}

      {activeStep === "correlate" ? (
        <WorkspaceSection title="Correlate Imported Data" description="Apply local time/depth/value adjustments and compare imported memory samples against existing real-time log data.">
          {activeDataset ? (
            <Tabs defaultValue="correlate" className="space-y-4">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="correlate">Correlation</TabsTrigger>
                <TabsTrigger value="compare">Compare</TabsTrigger>
                <TabsTrigger value="gap-fill">Gap Fill Helper</TabsTrigger>
              </TabsList>

              <TabsContent value="correlate" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Time shift seconds</Label>
                    <Input type="number" value={correlationSettings.timeShiftSeconds} onChange={(event) => setCorrelationSettings((current) => ({ ...current, timeShiftSeconds: Number(event.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Shift depths up/down</Label>
                    <Input type="number" step="0.1" value={correlationSettings.depthShift} onChange={(event) => setCorrelationSettings((current) => ({ ...current, depthShift: Number(event.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rescale imported data</Label>
                    <Input type="number" step="0.01" value={correlationSettings.scaleFactor} onChange={(event) => setCorrelationSettings((current) => ({ ...current, scaleFactor: Number(event.target.value) }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard icon={ArrowDownUp} label="Depth range" value={`${formatNumber(Math.min(...activeDataset.samples.map((sample) => sample.depth)))} - ${formatNumber(Math.max(...activeDataset.samples.map((sample) => sample.depth)))}`} />
                  <SummaryCard icon={Scale} label="Value preview" value={`${formatNumber(activeDataset.samples[0]?.value ?? 0, 3)} first sample`} />
                  <SummaryCard icon={GitCompare} label="Dataset" value={`${activeDataset.storageWitsId} ${activeDataset.segmentName}`} />
                </div>
                <Button onClick={handleApplyCorrelation}>
                  <Scale className="mr-2 size-4" />
                  Apply correlation locally
                </Button>
              </TabsContent>

              <TabsContent value="compare" className="space-y-4">
                <div className="flex max-w-sm items-center gap-2">
                  <Label className="shrink-0">Compare to WITS ID</Label>
                  <Select value={gapTargetWitsId} onValueChange={setGapTargetWitsId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {existingWitsTargets.map((witsId) => (
                        <SelectItem key={witsId} value={witsId}>{witsId}</SelectItem>
                      ))}
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
              </TabsContent>

              <TabsContent value="gap-fill" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Target existing WITS ID</Label>
                    <Select value={gapTargetWitsId} onValueChange={setGapTargetWitsId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {existingWitsTargets.map((witsId) => (
                          <SelectItem key={witsId} value={witsId}>{witsId}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gap fill mode</Label>
                    <Select value={gapMode} onValueChange={(value) => setGapMode(value as GapFillRequest["mode"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fill-gaps-only">Fill gaps only</SelectItem>
                        <SelectItem value="copy-depths">Copy depths</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleGapFill}>
                      <Copy className="mr-2 size-4" />
                      Stage local gap fill
                    </Button>
                  </div>
                </div>
                <PlaceholderNote>
                  Gap fill helper stages a local request and reports affected samples. It does not write to a backend or mutate real-time channels permanently.
                </PlaceholderNote>
                {gapFillRequests.length > 0 ? (
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
                      {gapFillRequests.map((request) => (
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
              </TabsContent>
            </Tabs>
          ) : (
            <PlaceholderNote>Import a selected segment before running correlation and gap filling tools.</PlaceholderNote>
          )}
        </WorkspaceSection>
      ) : null}
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
