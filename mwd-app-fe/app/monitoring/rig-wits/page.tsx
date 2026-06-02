"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { MonitoringModeToggle } from "@/components/contents/monitoring/monitoring-mode-toggle";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  generateWitsOutputFromLatest,
  getWitsOutputQueue,
  updateWitsOutputStatus,
  WitsOutputQueueItem,
  WitsOutputQueueStatus,
} from "@/lib/wits-output-api";
import { getMwdData, MwdDataRecord } from "@/lib/mwd-data-api";
import { decodeWitsPacket } from "@/lib/wits-map";
import { MonitoringMode, WitsPacketLog } from "@/types/monitoring";

function buildPacketStreamText(packets: WitsPacketLog[]) {
  const rawPackets = packets.map((packet) => packet.rawPacket.trim()).filter(Boolean);

  if (rawPackets.length === 0) {
    return "!!";
  }

  return ["&&", ...rawPackets].join("\n");
}

function PacketStream({
  packets,
}: {
  packets: WitsPacketLog[];
}) {
  return (
    <pre className="min-h-full w-full whitespace-pre-wrap break-words bg-background px-4 py-3 font-mono text-xs leading-5 text-foreground [overflow-wrap:anywhere] sm:text-sm sm:leading-6">
      {buildPacketStreamText(packets)}
    </pre>
  );
}

function PacketPanel({
  title,
  count,
  latestTimestamp,
  children,
}: {
  title: string;
  count: number;
  latestTimestamp?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-[clamp(380px,68vh,620px)] min-w-0 flex-col overflow-hidden rounded-2xl p-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="min-w-0 text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="outline">{count} packets</Badge>
          <Badge variant="secondary">
            {format(new Date(latestTimestamp ?? new Date().toISOString()), "HH:mm:ss")}
          </Badge>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
    </Card>
  );
}

function queueItemToPacketLog(item: WitsOutputQueueItem): WitsPacketLog {
  const decoded = decodeWitsPacket(item.rawPacket);
  const statusLabel = item.status ? `Queue status: ${item.status}` : "Backend WITS output queue";

  return {
    id: item.id,
    timestamp: item.timestamp ?? item.updatedAt ?? new Date().toISOString(),
    source: item.source ?? "WITS output queue",
    port: item.targetPort ?? "Output queue",
    rawPacket: item.rawPacket || item.message || item.reason || item.id,
    witsId: item.witsId ?? decoded?.witsId ?? "----",
    rawValue: item.rawValue ?? decoded?.rawValue ?? item.rawPacket,
    parsedValue: item.parsedValue ?? decoded?.parsedValue ?? item.status ?? "Queued",
    label: item.label ?? decoded?.label ?? "WITS output",
    description: item.message ?? item.reason ? `${statusLabel} - ${item.message ?? item.reason}` : statusLabel,
  };
}

function readRecordString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function mwdRecordToReceivedPacket(record: MwdDataRecord, index: number): WitsPacketLog {
  const raw = record.raw;
  const witsId = readRecordString(raw, ["witsId", "wits_id", "channel", "mnemonic"]) ?? "MWD";
  const metricEntries = Object.entries(record.metrics);
  const metricSummary = metricEntries
    .slice(0, 4)
    .map(([key, value]) => `${key}=${Number.isFinite(value) ? value.toFixed(2) : value}`)
    .join(", ");

  return {
    id: record.id ?? `received-mwd-${record.timestamp.toISOString()}-${index}`,
    timestamp: record.timestamp.toISOString(),
    source: readRecordString(raw, ["source", "dataSource", "data_source"]) ?? "MWD_Data",
    port: "Backend /api/mwd-data",
    rawPacket: JSON.stringify(raw),
    witsId,
    rawValue: metricSummary || (typeof record.depth === "number" ? `depth=${record.depth}` : "MWD record"),
    parsedValue: typeof record.depth === "number" ? `Depth ${record.depth.toFixed(2)}` : (record.status ?? "Translated"),
    label: readRecordString(raw, ["label", "parameter", "name"]) ?? "Translated MWD Data",
    description: "Received data translated by backend from raw/WITS input using WITS config mapping.",
  };
}

export default function RigWitsPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { activeMwdSessionId } = useApp();
  const [mode, setMode] = useState<MonitoringMode>("raw");
  const [receivedRecords, setReceivedRecords] = useState<MwdDataRecord[]>([]);
  const [receivedLoading, setReceivedLoading] = useState(false);
  const [receivedError, setReceivedError] = useState("");
  const [outputQueue, setOutputQueue] = useState<WitsOutputQueueItem[]>([]);
  const [outputQueueLoading, setOutputQueueLoading] = useState(false);
  const [outputQueueError, setOutputQueueError] = useState("");
  const [outputQueueStatusFilter, setOutputQueueStatusFilter] = useState<WitsOutputQueueStatus | "all">("all");
  const [generatingLatestOutput, setGeneratingLatestOutput] = useState(false);
  const [updatingQueueItemId, setUpdatingQueueItemId] = useState("");
  const receivedPackets = useMemo(
    () => receivedRecords.map(mwdRecordToReceivedPacket),
    [receivedRecords]
  );
  const transmittedDisplayPackets = useMemo(
    () => outputQueue.map(queueItemToPacketLog),
    [outputQueue]
  );
  const outputQueueStatusCounts = useMemo(() => {
    return outputQueue.reduce<Record<string, number>>((accumulator, item) => {
      const status = item.status ?? "unknown";
      accumulator[status] = (accumulator[status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [outputQueue]);
  const canGenerateLatestOutput = user?.role === "admin" || user?.role === "engineer";

  const loadReceivedData = useCallback(async () => {
    if (!token || !activeMwdSessionId) {
      setReceivedRecords([]);
      setReceivedError("");
      return;
    }

    setReceivedLoading(true);
    setReceivedError("");

    try {
      const records = await getMwdData(token, {
        sessionId: activeMwdSessionId,
        limit: 50,
      });
      setReceivedRecords(records);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load Rig WITS received data.", error);
      }
      setReceivedRecords([]);
      setReceivedError("Gagal memuat data dari backend.");
    } finally {
      setReceivedLoading(false);
    }
  }, [activeMwdSessionId, token]);

  const loadOutputQueue = useCallback(async () => {
    if (!token || !activeMwdSessionId) {
      setOutputQueue([]);
      setOutputQueueError("");
      return;
    }

    setOutputQueueLoading(true);
    setOutputQueueError("");

    try {
      const items = await getWitsOutputQueue(token, {
        sessionId: activeMwdSessionId,
        status: outputQueueStatusFilter === "all" ? undefined : outputQueueStatusFilter,
        limit: 50,
      });
      setOutputQueue(items);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load WITS output queue.", error);
      }
      setOutputQueue([]);
      setOutputQueueError("Gagal memuat data dari backend.");
    } finally {
      setOutputQueueLoading(false);
    }
  }, [activeMwdSessionId, outputQueueStatusFilter, token]);

  useEffect(() => {
    void loadReceivedData();
  }, [loadReceivedData]);

  useEffect(() => {
    void loadOutputQueue();
  }, [loadOutputQueue]);

  const handleGenerateLatestOutput = async () => {
    if (!token) {
      toast.error("Please sign in before generating WITS output.");
      return;
    }

    if (!activeMwdSessionId) {
      toast.error("Select an active MWD session before generating WITS output.");
      return;
    }

    if (!canGenerateLatestOutput) {
      toast.error("Your role cannot generate WITS output manually.");
      return;
    }

    setGeneratingLatestOutput(true);

    try {
      await generateWitsOutputFromLatest(token, { sessionId: activeMwdSessionId });
      toast.success("Latest WITS output queued");
      await loadReceivedData();
      await loadOutputQueue();
    } catch (error) {
      toast.error("Unable to generate latest WITS output", {
        description: error instanceof Error ? error.message : "Backend request failed.",
      });
    } finally {
      setGeneratingLatestOutput(false);
    }
  };

  const handleUpdateQueueStatus = async (item: WitsOutputQueueItem, status: WitsOutputQueueStatus) => {
    if (!token) {
      toast.error("Please sign in before updating WITS output status.");
      return;
    }

    setUpdatingQueueItemId(item.id);

    try {
      await updateWitsOutputStatus(token, item.id, { status });
      toast.success(`Output queue marked ${status}.`);
      await loadOutputQueue();
    } catch (error) {
      toast.error("Unable to update WITS output status", {
        description: error instanceof Error ? error.message : "Backend request failed.",
      });
    } finally {
      setUpdatingQueueItemId("");
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Rig WITS</h1>
          <Badge variant="secondary">Monitoring</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <MonitoringModeToggle mode={mode} onChange={setMode} />
          <Button
            variant="outline"
            onClick={() => {
              void loadReceivedData();
              void loadOutputQueue();
            }}
            disabled={receivedLoading || outputQueueLoading}
          >
            <RefreshCw className={`mr-2 size-4 ${receivedLoading || outputQueueLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canGenerateLatestOutput ? (
            <Button
              variant="outline"
              onClick={() => void handleGenerateLatestOutput()}
              disabled={generatingLatestOutput || !activeMwdSessionId}
            >
              <RefreshCw className={`mr-2 size-4 ${generatingLatestOutput ? "animate-spin" : ""}`} />
              Generate Latest Output
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PacketPanel
          title="Received Data"
          count={receivedPackets.length}
          latestTimestamp={receivedPackets[0]?.timestamp}
        >
          <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Source: /api/mwd-data</Badge>
              {receivedLoading ? <Badge variant="outline">Loading received data</Badge> : null}
              {receivedError ? <Badge variant="outline">Gagal memuat data dari backend.</Badge> : null}
            </div>
            {receivedError ? (
              <p className="mt-1 text-xs text-muted-foreground">{receivedError}</p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {mode === "raw" ? (
              receivedPackets.length > 0 ? (
                <PacketStream packets={receivedPackets} />
              ) : (
                <div className="flex h-full items-center justify-center px-4 py-8 text-sm text-muted-foreground">
                  Belum ada received data untuk session ini.
                </div>
              )
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Time</TableHead>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead className="w-28">Value</TableHead>
                    <TableHead className="w-32">Raw</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedPackets.map((packet) => (
                    <TableRow key={packet.id}>
                      <TableCell>{format(new Date(packet.timestamp), "HH:mm:ss")}</TableCell>
                      <TableCell className="font-mono">{packet.witsId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{packet.label}</div>
                      </TableCell>
                      <TableCell>{packet.parsedValue}</TableCell>
                      <TableCell className="truncate font-mono text-xs" title={packet.rawPacket}>
                        {packet.rawPacket}
                      </TableCell>
                    </TableRow>
                  ))}
                  {receivedPackets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Belum ada received data untuk session ini.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </div>
          </div>
        </PacketPanel>

        <PacketPanel
          title="Output Queue"
          count={transmittedDisplayPackets.length}
          latestTimestamp={transmittedDisplayPackets[0]?.timestamp}
        >
          <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={outputQueueStatusFilter}
                onValueChange={(value) => setOutputQueueStatusFilter(value as WitsOutputQueueStatus | "all")}
              >
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => void loadOutputQueue()}
                disabled={outputQueueLoading}
              >
                <RefreshCw className={`mr-1 size-3.5 ${outputQueueLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {outputQueueLoading ? <Badge variant="outline">Loading output queue</Badge> : null}
              <Badge variant="secondary">Backend queue</Badge>
              {Object.entries(outputQueueStatusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline" className="capitalize">
                  {status}: {count}
                </Badge>
              ))}
              {outputQueueError ? <Badge variant="outline">Gagal memuat data dari backend.</Badge> : null}
            </div>
            {outputQueueError ? (
              <p className="mt-1 text-xs text-muted-foreground">{outputQueueError}</p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {mode === "raw" ? (
              transmittedDisplayPackets.length > 0 ? (
                <PacketStream packets={transmittedDisplayPackets} />
              ) : (
                <div className="flex h-full items-center justify-center px-4 py-8 text-sm text-muted-foreground">
                  Belum ada output queue untuk session ini.
                </div>
              )
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Time</TableHead>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead className="w-28">Value</TableHead>
                    <TableHead className="w-32">Raw</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="w-48">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outputQueue.map((item) => {
                    const packet = queueItemToPacketLog(item);
                    const isUpdating = updatingQueueItemId === item.id;

                    return (
                    <TableRow key={item.id}>
                      <TableCell>{format(new Date(packet.timestamp), "HH:mm:ss")}</TableCell>
                      <TableCell className="font-mono">{item.witsId ?? packet.witsId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.label ?? packet.label}</div>
                      </TableCell>
                      <TableCell>{item.parsedValue ?? packet.parsedValue}</TableCell>
                      <TableCell className="truncate font-mono text-xs" title={item.rawPacket}>
                        {item.rawPacket}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.status ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => void handleUpdateQueueStatus(item, "sent")}
                            disabled={isUpdating || !token}
                          >
                            Sent
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => void handleUpdateQueueStatus(item, "skipped")}
                            disabled={isUpdating || !token}
                          >
                            Skip
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {!outputQueueLoading && outputQueue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        Belum ada output queue untuk session ini.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </div>
          </div>
        </PacketPanel>
      </div>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="monitoring-rig-wits" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
