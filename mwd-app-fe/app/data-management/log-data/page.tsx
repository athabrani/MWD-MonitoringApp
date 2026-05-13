"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { EyeOff, FileUp, Filter, MoveHorizontal, Plus, Scale, Search } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/contents/data-management/confirm-delete-button";
import {
  LogDataChannelSummary,
  LogDataMemoryImportPanel,
} from "@/components/contents/data-management/log-data-memory-import-panel";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { PlaceholderNote, WorkspaceSection } from "@/components/layouts/workspace-section";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockLogDataRecords } from "@/data/monitoring-data";
import { mockPolarisWitsIds } from "@/data/polaris-config";
import { formatConfiguredWitsId, loadStoredWitsIds } from "@/lib/wits-config-store";
import { getWitsDescription } from "@/lib/wits-map";
import { DepthRange, LogDataRecord, RescaleMode, RescalePreview, RescaleRequest, RescaleResultSummary } from "@/types/monitoring";
import { PolarisWitsId } from "@/types/polaris";
import { cn } from "@/lib/utils";

function withinRange(depth: number, range: DepthRange) {
  return depth >= range.startDepth && depth <= range.endDepth;
}

function formatRescaleMode(mode: RescaleMode) {
  return mode === "example-value" ? "Example value" : "Percentage";
}

export default function LogDataPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [records, setRecords] = useState<LogDataRecord[]>(mockLogDataRecords);
  const [configuredWitsIds] = useState<PolarisWitsId[]>(() =>
    loadStoredWitsIds(mockPolarisWitsIds)
  );
  const [search, setSearch] = useState("");
  const [selectedWitsId, setSelectedWitsId] = useState<string>(mockLogDataRecords[0]?.witsId ?? "");
  const [activeLogTab, setActiveLogTab] = useState("edit");
  const [selectedRange, setSelectedRange] = useState<DepthRange>({ startDepth: 3810, endDepth: 3840 });
  const [valueFilter, setValueFilter] = useState({ min: 0, max: 9999 });
  const [moveOffset, setMoveOffset] = useState(5);
  const [copyOffset, setCopyOffset] = useState(10);
  const [rescaleMode, setRescaleMode] = useState<RescaleMode>("example-value");
  const [originalExampleValue, setOriginalExampleValue] = useState(80);
  const [desiredExampleValue, setDesiredExampleValue] = useState(95);
  const [rescalePercentage, setRescalePercentage] = useState(10);
  const [newDepth, setNewDepth] = useState(3855);
  const [newValue, setNewValue] = useState(27.1);
  const [newNotes, setNewNotes] = useState("Manual QA insertion");

  const channels = useMemo(() => {
    const recordCounts = records.reduce<Record<string, { count: number; hiddenCount: number }>>(
      (accumulator, record) => {
        if (!accumulator[record.witsId]) {
          accumulator[record.witsId] = { count: 0, hiddenCount: 0 };
        }
        accumulator[record.witsId].count += 1;
        if (record.hidden) {
          accumulator[record.witsId].hiddenCount += 1;
        }
        return accumulator;
      },
      {}
    );

    return configuredWitsIds.map<LogDataChannelSummary>((config) => {
      const witsId = formatConfiguredWitsId(config.numericId);
      const counts = recordCounts[witsId];
      return {
        witsId,
        label: config.name || `WITS ${witsId}`,
        units: config.units,
        enabled: config.enabled,
        count: counts?.count ?? 0,
        hiddenCount: counts?.hiddenCount ?? 0,
        decimalPlaces: config.decimalPlaces,
        scaleFactor: config.scaleFactor,
        sensorSpacing: config.sensorToBitSpacing,
        lasMnemonic: config.lasMnemonic,
        alarmEnabled: config.alarmEnabled,
        alarmLow: config.alarmLow,
        alarmHigh: config.alarmHigh,
        plotName: config.realTimePlot,
        isMemoryStorage: config.useForMemoryImportStorage,
        hasRecords: Boolean(counts?.count),
      };
    }).filter((channel) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        channel.witsId.toLowerCase().includes(query) ||
        channel.label.toLowerCase().includes(query) ||
        channel.units.toLowerCase().includes(query) ||
        channel.lasMnemonic.toLowerCase().includes(query)
      );
    });
  }, [configuredWitsIds, records, search]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.witsId === selectedWitsId) ?? channels[0] ?? null,
    [channels, selectedWitsId]
  );

  const channelRecords = useMemo(() => {
    if (!selectedChannel) {
      return [];
    }

    return records
      .filter((record) => record.witsId === selectedChannel.witsId)
      .filter((record) => record.value >= valueFilter.min && record.value <= valueFilter.max)
      .sort((left, right) => left.depth - right.depth);
  }, [records, selectedChannel, valueFilter.max, valueFilter.min]);

  const rescaleScaleFactor = useMemo(() => {
    if (rescaleMode === "example-value") {
      if (originalExampleValue === 0) {
        return 0;
      }

      return desiredExampleValue / originalExampleValue;
    }

    return 1 + rescalePercentage / 100;
  }, [desiredExampleValue, originalExampleValue, rescaleMode, rescalePercentage]);

  const rescaleAffectedRecords = useMemo(() => {
    if (!selectedChannel) {
      return [];
    }

    return records
      .filter((record) => record.witsId === selectedChannel.witsId && withinRange(record.depth, selectedRange))
      .sort((left, right) => left.depth - right.depth);
  }, [records, selectedChannel, selectedRange]);

  const rescalePreview: RescalePreview[] = useMemo(
    () =>
      rescaleAffectedRecords.slice(0, 8).map((record) => ({
        recordId: record.id,
        depth: record.depth,
        beforeValue: record.value,
        afterValue: Number((record.value * rescaleScaleFactor).toFixed(3)),
      })),
    [rescaleAffectedRecords, rescaleScaleFactor]
  );

  const rescaleRequest: RescaleRequest | null = selectedChannel
    ? {
        channelWitsId: selectedChannel.witsId,
        mode: rescaleMode,
        startDepth: selectedRange.startDepth,
        endDepth: selectedRange.endDepth,
        scaleFactor: rescaleScaleFactor,
        originalExampleValue: rescaleMode === "example-value" ? originalExampleValue : undefined,
        desiredExampleValue: rescaleMode === "example-value" ? desiredExampleValue : undefined,
        percentage: rescaleMode === "percentage" ? rescalePercentage : undefined,
      }
    : null;

  const rescaleSummary: RescaleResultSummary | null = rescaleRequest
    ? {
        channelWitsId: rescaleRequest.channelWitsId,
        mode: rescaleRequest.mode,
        scaleFactor: rescaleRequest.scaleFactor,
        startDepth: rescaleRequest.startDepth,
        endDepth: rescaleRequest.endDepth,
        affectedRows: rescaleAffectedRecords.length,
      }
    : null;

  const canApplyRescale =
    Boolean(selectedChannel) &&
    rescaleAffectedRecords.length > 0 &&
    Number.isFinite(rescaleScaleFactor) &&
    rescaleScaleFactor > 0;

  const updateSelectedRange = (key: keyof DepthRange, value: number) => {
    setSelectedRange((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const runForSelectedChannel = (updater: (record: LogDataRecord) => LogDataRecord | null) => {
    if (!selectedChannel) {
      toast.error("Select a WITS ID first");
      return;
    }

    setRecords((current) =>
      current.flatMap((record) => {
        if (record.witsId !== selectedChannel.witsId) {
          return [record];
        }
        const result = updater(record);
        return result ? [result] : [];
      })
    );
  };

  const handleHideRange = () => {
    runForSelectedChannel((record) =>
      withinRange(record.depth, selectedRange)
        ? {
            ...record,
            hidden: true,
          }
        : record
    );
    toast.success("Selected depth range hidden locally");
  };

  const handleDeleteDepths = () => {
    runForSelectedChannel((record) => (withinRange(record.depth, selectedRange) ? null : record));
    toast.success("Selected depth range deleted locally");
  };

  const handleMoveDepths = () => {
    runForSelectedChannel((record) =>
      withinRange(record.depth, selectedRange)
        ? {
            ...record,
            depth: Number((record.depth + moveOffset).toFixed(2)),
          }
        : record
    );
    toast.success("Depths moved in local state");
  };

  const handleCopyDepths = () => {
    if (!selectedChannel) {
      return;
    }

    const copied = records
      .filter((record) => record.witsId === selectedChannel.witsId && withinRange(record.depth, selectedRange))
      .map((record) => ({
        ...record,
        id: `${record.id}-copy-${Date.now()}-${record.depth}`,
        depth: Number((record.depth + copyOffset).toFixed(2)),
        notes: `${record.notes ?? ""} Copied locally`.trim(),
      }));

    setRecords((current) => [...current, ...copied]);
    toast.success("Depth range copied locally");
  };

  const handleRescale = () => {
    if (!selectedChannel || !rescaleSummary || !canApplyRescale) {
      toast.error("Review rescale settings before applying");
      return;
    }

    setRecords((current) =>
      current.map((record) =>
        record.witsId === selectedChannel.witsId && withinRange(record.depth, selectedRange)
          ? {
              ...record,
              value: Number((record.value * rescaleScaleFactor).toFixed(3)),
              notes: `${record.notes ?? ""} Rescaled ${rescaleScaleFactor.toFixed(4)}x`.trim(),
            }
          : record
      )
    );

    toast.success(`${rescaleSummary.affectedRows} ${selectedChannel.label} rows rescaled locally`);
  };

  const handleAddData = () => {
    if (!selectedChannel) {
      return;
    }

    setRecords((current) => [
      ...current,
      {
        id: `log-${Date.now()}`,
        witsId: selectedChannel.witsId,
        label: selectedChannel.label,
        depth: newDepth,
        value: newValue,
        timestamp: new Date().toISOString(),
        hidden: false,
        source: "Manual entry",
        notes: newNotes,
      },
    ]);
    toast.success("Log data row added locally");
  };

  const content = (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Data Management</Badge>
          <Badge variant="outline">Log Data</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Log Data</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Edit and manipulate stored WITS channel values with local range tools, batch actions, and channel-focused review.
        </p>
      </div>

      <WorkspaceSection
        title="Log Data Editor"
        description="Select a WITS ID on the left to inspect or manipulate its stored values on the right."
        badge="Local editing only"
      >
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-2xl p-0">
            <div className="border-b px-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search WITS ID or label"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="h-[640px]">
              <div className="space-y-2 p-3">
                {channels.map((channel) => (
                  <button
                    key={channel.witsId}
                    type="button"
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      selectedChannel?.witsId === channel.witsId
                        ? "border-primary/40 bg-primary/10"
                        : "hover:bg-muted/40"
                    )}
                    onClick={() => setSelectedWitsId(channel.witsId)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-sm font-semibold">{channel.witsId}</div>
                      <Badge variant="outline">{channel.count}</Badge>
                    </div>
                    <div className="mt-1 text-sm font-medium">{channel.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {channel.units || "No units"} | {channel.lasMnemonic || "No LAS tag"}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <span>{channel.hiddenCount} hidden</span>
                      <Badge variant={channel.enabled ? "secondary" : "outline"}>
                        {channel.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {channel.isMemoryStorage ? <Badge variant="secondary">Memory</Badge> : null}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-2xl border-dashed p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{selectedChannel?.witsId ?? "No channel"}</Badge>
                    <Badge variant="outline">{selectedChannel?.label ?? "Select a channel"}</Badge>
                    {selectedChannel?.units ? <Badge variant="outline">{selectedChannel.units}</Badge> : null}
                    {selectedChannel?.isMemoryStorage ? <Badge variant="secondary">Memory Storage</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{selectedChannel?.label ?? "No channel selected"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedChannel ? getWitsDescription(selectedChannel.witsId) : "Choose a channel from the left list."}
                  </p>
                  {selectedChannel ? (
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        Decimals: <span className="font-medium text-foreground">{selectedChannel.decimalPlaces}</span>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        Scale: <span className="font-medium text-foreground">{selectedChannel.scaleFactor}</span>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        Plot: <span className="font-medium text-foreground">{selectedChannel.plotName}</span>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        Alarm:{" "}
                        <span className="font-medium text-foreground">
                          {selectedChannel.alarmEnabled
                            ? `${selectedChannel.alarmLow} - ${selectedChannel.alarmHigh}`
                            : "Disabled"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setActiveLogTab("memory")}>
                    <FileUp className="mr-2 size-4" />
                    Import Data
                  </Button>
                  <Button variant="outline" onClick={() => toast.message("Export UI ready; backend export not wired")}>
                    Export Data
                  </Button>
                  <Button variant="outline" onClick={() => setActiveLogTab("memory")}>
                    Memory Correlation Editor
                  </Button>
                  <Button variant="outline" onClick={() => toast.message("Batch Settings Editor is a placeholder action")}>
                    Batch Settings Editor
                  </Button>
                </div>
              </div>
            </Card>

            <Tabs value={activeLogTab} onValueChange={setActiveLogTab} className="space-y-4">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
                <TabsTrigger value="edit">Edit Data</TabsTrigger>
                <TabsTrigger value="memory">Import / Correlate</TabsTrigger>
                <TabsTrigger value="ranges">Hide / Delete / Filter</TabsTrigger>
                <TabsTrigger value="transform">Move / Copy / Rescale</TabsTrigger>
                <TabsTrigger value="batch">Batch Operations</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4">
                <Card className="rounded-2xl p-0">
                  <ScrollArea className="h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Depth</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {channelRecords.map((record) => (
                          <TableRow
                            key={record.id}
                            className={cn(
                              withinRange(record.depth, selectedRange) && "bg-muted/40",
                              record.hidden && "opacity-60"
                            )}
                          >
                            <TableCell>{record.depth.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={record.value}
                                onChange={(event) =>
                                  setRecords((current) =>
                                    current.map((item) =>
                                      item.id === record.id
                                        ? { ...item, value: Number(event.target.value) }
                                        : item
                                    )
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(record.timestamp), "dd MMM HH:mm")}
                            </TableCell>
                            <TableCell>{record.source}</TableCell>
                            <TableCell>
                              <Input
                                value={record.notes ?? ""}
                                onChange={(event) =>
                                  setRecords((current) =>
                                    current.map((item) =>
                                      item.id === record.id
                                        ? { ...item, notes: event.target.value }
                                        : item
                                    )
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setRecords((current) =>
                                      current.map((item) =>
                                        item.id === record.id
                                          ? { ...item, hidden: !item.hidden }
                                          : item
                                      )
                                    )
                                  }
                                >
                                  <EyeOff className="size-4" />
                                </Button>
                                <ConfirmDeleteButton
                                  title="Delete log data row?"
                                  description={`Depth ${record.depth.toFixed(2)} for ${record.witsId} will be removed from local log data.`}
                                  onConfirm={() => {
                                    setRecords((current) => current.filter((item) => item.id !== record.id));
                                    toast.success("Log data row deleted locally");
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>

                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Add data</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Depth</Label>
                      <Input type="number" value={newDepth} onChange={(event) => setNewDepth(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Value</Label>
                      <Input type="number" value={newValue} onChange={(event) => setNewValue(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input value={newNotes} onChange={(event) => setNewNotes(event.target.value)} />
                    </div>
                  </div>
                  <Button className="mt-4" onClick={handleAddData}>
                    <Plus className="mr-2 size-4" />
                    Add Data
                  </Button>
                </Card>
              </TabsContent>

              <TabsContent value="memory" className="space-y-4">
                <LogDataMemoryImportPanel
                  selectedChannel={selectedChannel}
                  channels={channels}
                  records={records}
                  setRecords={setRecords}
                  onNavigate={onNavigate}
                />
              </TabsContent>

              <TabsContent value="ranges" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Range tools</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Start depth</Label>
                      <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End depth</Label>
                      <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Filter min value</Label>
                      <Input type="number" value={valueFilter.min} onChange={(event) => setValueFilter((current) => ({ ...current, min: Number(event.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Filter max value</Label>
                      <Input type="number" value={valueFilter.max} onChange={(event) => setValueFilter((current) => ({ ...current, max: Number(event.target.value) }))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleHideRange}>
                      <EyeOff className="mr-2 size-4" />
                      Hide Depth Range
                    </Button>
                    <ConfirmDeleteButton
                      title="Delete selected depth range?"
                      description={`Rows from ${selectedRange.startDepth} to ${selectedRange.endDepth} for the selected WITS ID will be removed locally.`}
                      triggerLabel="Delete Depths"
                      size="sm"
                      variant="outline"
                      onConfirm={handleDeleteDepths}
                    />
                    <Button variant="outline" onClick={() => toast.success("Value filter applied to table view")}>
                      <Filter className="mr-2 size-4" />
                      Filter Value Range
                    </Button>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="transform" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Depth and value transforms</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Move offset</Label>
                      <Input type="number" value={moveOffset} onChange={(event) => setMoveOffset(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Copy offset</Label>
                      <Input type="number" value={copyOffset} onChange={(event) => setCopyOffset(Number(event.target.value))} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleMoveDepths}>
                      <MoveHorizontal className="mr-2 size-4" />
                      Move Depths
                    </Button>
                    <Button variant="outline" onClick={handleCopyDepths}>
                      Copy Depths
                    </Button>
                  </div>
                </Card>

                <Card className="rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Rescaling Logged Data</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Rescale the selected WITS channel inside the active depth range only.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedChannel?.witsId ?? "No channel"}</Badge>
                      <Badge variant="outline">{rescaleAffectedRecords.length} affected rows</Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Channel</Label>
                          <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            value={selectedWitsId}
                            onChange={(event) => setSelectedWitsId(event.target.value)}
                          >
                            {channels.map((channel) => (
                              <option key={channel.witsId} value={channel.witsId}>
                                {channel.witsId} - {channel.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Start depth</Label>
                          <Input type="number" value={selectedRange.startDepth} onChange={(event) => updateSelectedRange("startDepth", Number(event.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label>End depth</Label>
                          <Input type="number" value={selectedRange.endDepth} onChange={(event) => updateSelectedRange("endDepth", Number(event.target.value))} />
                        </div>
                      </div>

                      <Tabs value={rescaleMode} onValueChange={(value) => setRescaleMode(value as RescaleMode)} className="space-y-4">
                        <TabsList className="h-auto flex-wrap justify-start">
                          <TabsTrigger value="example-value">Example Value</TabsTrigger>
                          <TabsTrigger value="percentage">Percentage</TabsTrigger>
                        </TabsList>

                        <TabsContent value="example-value" className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Original / example value</Label>
                              <Input type="number" value={originalExampleValue} onChange={(event) => setOriginalExampleValue(Number(event.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Desired / new value</Label>
                              <Input type="number" value={desiredExampleValue} onChange={(event) => setDesiredExampleValue(Number(event.target.value))} />
                            </div>
                          </div>
                          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                            New scale factor = desired value / original value ={" "}
                            <span className="font-semibold">{rescaleScaleFactor.toFixed(6)}</span>
                          </div>
                        </TabsContent>

                        <TabsContent value="percentage" className="space-y-4">
                          <div className="max-w-sm space-y-2">
                            <Label>Percentage adjustment</Label>
                            <Input type="number" value={rescalePercentage} onChange={(event) => setRescalePercentage(Number(event.target.value))} />
                          </div>
                          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                            New scale factor = 1 + percentage / 100 ={" "}
                            <span className="font-semibold">{rescaleScaleFactor.toFixed(6)}</span>
                          </div>
                        </TabsContent>
                      </Tabs>

                      <Card className="rounded-xl p-0">
                        <div className="border-b px-4 py-3">
                          <h3 className="font-semibold">Before / after preview</h3>
                          <p className="text-sm text-muted-foreground">Preview shows up to 8 records from the affected depth range.</p>
                        </div>
                        <ScrollArea className="h-[220px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Depth</TableHead>
                                <TableHead>Before</TableHead>
                                <TableHead>After</TableHead>
                                <TableHead>Delta</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rescalePreview.map((preview) => (
                                <TableRow key={preview.recordId}>
                                  <TableCell>{preview.depth.toFixed(2)}</TableCell>
                                  <TableCell>{preview.beforeValue.toFixed(3)}</TableCell>
                                  <TableCell>{preview.afterValue.toFixed(3)}</TableCell>
                                  <TableCell>{(preview.afterValue - preview.beforeValue).toFixed(3)}</TableCell>
                                </TableRow>
                              ))}
                              {rescalePreview.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                    No records match this channel and depth range.
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </Card>
                    </div>

                    <Card className="rounded-xl border-dashed p-4">
                      <h3 className="font-semibold">Rescale summary</h3>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Channel</span>
                          <span className="text-right font-medium">{selectedChannel ? `${selectedChannel.witsId} - ${selectedChannel.label}` : "None"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Mode</span>
                          <span className="font-medium">{formatRescaleMode(rescaleMode)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Scale factor</span>
                          <span className="font-mono font-medium">{rescaleScaleFactor.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Depth range</span>
                          <span className="font-medium">{selectedRange.startDepth} - {selectedRange.endDepth}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Affected rows</span>
                          <span className="font-medium">{rescaleAffectedRecords.length}</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        This applies to local state only and updates values inside the selected channel and depth range.
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="mt-4 w-full" disabled={!canApplyRescale}>
                            <Scale className="mr-2 size-4" />
                            Apply Rescale
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apply rescale to logged data?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {rescaleSummary
                                ? `${rescaleSummary.affectedRows} rows in ${rescaleSummary.channelWitsId} from ${rescaleSummary.startDepth} to ${rescaleSummary.endDepth} will be multiplied by ${rescaleSummary.scaleFactor.toFixed(6)}.`
                                : "Review the rescale settings before applying."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRescale}>Apply Rescale</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </Card>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="batch" className="space-y-4">
                <Card className="rounded-2xl border-dashed p-4">
                  <h2 className="text-lg font-semibold">Batch operations</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These actions scaffold the workflow surfaces required by Polaris-style log data management.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {[
                      "Import data from CSV/LAS",
                      "Memory Correlation Editor",
                      "Batch Settings Editor",
                      "Export Data",
                    ].map((actionLabel) => (
                      <div key={actionLabel} className="rounded-xl border px-4 py-3">
                        <div className="font-medium">{actionLabel}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Local placeholder action with UI routing ready for later backend integration.
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3"
                          onClick={() => toast.message(`${actionLabel} is currently a UI placeholder`)}
                        >
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>

            <PlaceholderNote>
              Search, depth range selection, hide/unhide, add data, move, copy, and rescale all operate on local state only.
            </PlaceholderNote>
          </div>
        </div>
      </WorkspaceSection>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="data-management-log-data" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
