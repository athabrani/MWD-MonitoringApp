"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { EyeOff, FileUp, Filter, MoveHorizontal, Plus, Scale, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { PlaceholderNote, WorkspaceSection } from "@/components/layouts/workspace-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockLogDataRecords } from "@/data/monitoring-data";
import { getWitsDescription } from "@/lib/wits-map";
import { DepthRange, LogDataRecord } from "@/types/monitoring";
import { cn } from "@/lib/utils";

function withinRange(depth: number, range: DepthRange) {
  return depth >= range.startDepth && depth <= range.endDepth;
}

export default function LogDataPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [records, setRecords] = useState<LogDataRecord[]>(mockLogDataRecords);
  const [search, setSearch] = useState("");
  const [selectedWitsId, setSelectedWitsId] = useState<string>(mockLogDataRecords[0]?.witsId ?? "");
  const [selectedRange, setSelectedRange] = useState<DepthRange>({ startDepth: 3810, endDepth: 3840 });
  const [valueFilter, setValueFilter] = useState({ min: 0, max: 9999 });
  const [moveOffset, setMoveOffset] = useState(5);
  const [copyOffset, setCopyOffset] = useState(10);
  const [scaleMultiplier, setScaleMultiplier] = useState(1.05);
  const [scaleBias, setScaleBias] = useState(0);
  const [newDepth, setNewDepth] = useState(3855);
  const [newValue, setNewValue] = useState(27.1);
  const [newNotes, setNewNotes] = useState("Manual QA insertion");

  const channels = useMemo(() => {
    const grouped = records.reduce<Record<string, { witsId: string; label: string; count: number; hiddenCount: number }>>(
      (accumulator, record) => {
        if (!accumulator[record.witsId]) {
          accumulator[record.witsId] = {
            witsId: record.witsId,
            label: record.label,
            count: 0,
            hiddenCount: 0,
          };
        }

        accumulator[record.witsId].count += 1;
        if (record.hidden) {
          accumulator[record.witsId].hiddenCount += 1;
        }

        return accumulator;
      },
      {}
    );

    return Object.values(grouped).filter((channel) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        channel.witsId.toLowerCase().includes(query) ||
        channel.label.toLowerCase().includes(query)
      );
    });
  }, [records, search]);

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
    runForSelectedChannel((record) =>
      withinRange(record.depth, selectedRange)
        ? {
            ...record,
            value: Number((record.value * scaleMultiplier + scaleBias).toFixed(3)),
          }
        : record
    );
    toast.success("Selected values rescaled locally");
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
                      {channel.hiddenCount} hidden rows
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
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">{selectedChannel?.label ?? "No channel selected"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedChannel ? getWitsDescription(selectedChannel.witsId) : "Choose a channel from the left list."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => toast.message("CSV/LAS import workflow is still scaffolded")}>
                    <FileUp className="mr-2 size-4" />
                    Import Data
                  </Button>
                  <Button variant="outline" onClick={() => toast.message("Export UI ready; backend export not wired")}>
                    Export Data
                  </Button>
                  <Button variant="outline" onClick={() => toast.message("Memory Correlation Editor is a placeholder action")}>
                    Memory Correlation Editor
                  </Button>
                  <Button variant="outline" onClick={() => toast.message("Batch Settings Editor is a placeholder action")}>
                    Batch Settings Editor
                  </Button>
                </div>
              </div>
            </Card>

            <Tabs defaultValue="edit" className="space-y-4">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
                <TabsTrigger value="edit">Edit Data</TabsTrigger>
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
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setRecords((current) => current.filter((item) => item.id !== record.id))
                                  }
                                >
                                  <Trash2 className="size-4" />
                                </Button>
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
                    <Button variant="outline" onClick={handleDeleteDepths}>
                      <Trash2 className="mr-2 size-4" />
                      Delete Depths
                    </Button>
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
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Move offset</Label>
                      <Input type="number" value={moveOffset} onChange={(event) => setMoveOffset(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Copy offset</Label>
                      <Input type="number" value={copyOffset} onChange={(event) => setCopyOffset(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Scale multiplier</Label>
                      <Input type="number" value={scaleMultiplier} onChange={(event) => setScaleMultiplier(Number(event.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Scale bias</Label>
                      <Input type="number" value={scaleBias} onChange={(event) => setScaleBias(Number(event.target.value))} />
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
                    <Button variant="outline" onClick={handleRescale}>
                      <Scale className="mr-2 size-4" />
                      Rescale Data
                    </Button>
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
