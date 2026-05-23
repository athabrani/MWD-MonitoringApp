"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { MonitoringModeToggle } from "@/components/contents/monitoring/monitoring-mode-toggle";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  mockRigWitsReceivedPackets,
  mockRigWitsTransmittedPackets,
} from "@/data/monitoring-data";
import {
  generateWitsOutputFromLatest,
  getWitsOutputQueue,
  WitsOutputQueueItem,
  WitsOutputQueueStatus,
} from "@/lib/wits-output-api";
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
    <pre className="min-h-full whitespace-pre-wrap break-all bg-background px-4 py-3 font-mono text-sm leading-6 text-foreground">
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
    <Card className="flex min-h-[420px] flex-col rounded-2xl p-0">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="outline">{count} packets</Badge>
          <Badge variant="secondary">
            {format(new Date(latestTimestamp ?? new Date().toISOString()), "HH:mm:ss")}
          </Badge>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
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

export default function RigWitsPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const { token, user } = useAuth();
  const { activeMwdSessionId } = useApp();
  const [mode, setMode] = useState<MonitoringMode>("raw");
  const [receivedPackets] = useState<WitsPacketLog[]>(mockRigWitsReceivedPackets);
  const [transmittedPackets, setTransmittedPackets] = useState<WitsPacketLog[]>(
    mockRigWitsTransmittedPackets
  );
  const [outputQueue, setOutputQueue] = useState<WitsOutputQueueItem[]>([]);
  const [outputQueueLoading, setOutputQueueLoading] = useState(false);
  const [outputQueueError, setOutputQueueError] = useState("");
  const [outputQueueStatusFilter, setOutputQueueStatusFilter] = useState<WitsOutputQueueStatus | "all">("all");
  const [generatingLatestOutput, setGeneratingLatestOutput] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [draftPacket, setDraftPacket] = useState("0824,26.45");
  const [draftSource, setDraftSource] = useState("Manual operator send");
  const transmittedDisplayPackets = useMemo(
    () => (outputQueue.length ? outputQueue.map(queueItemToPacketLog) : transmittedPackets),
    [outputQueue, transmittedPackets]
  );
  const outputQueueStatusCounts = useMemo(() => {
    return outputQueue.reduce<Record<string, number>>((accumulator, item) => {
      const status = item.status ?? "unknown";
      accumulator[status] = (accumulator[status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [outputQueue]);
  const canGenerateLatestOutput = user?.role === "admin" || user?.role === "engineer";

  const loadOutputQueue = useCallback(async () => {
    if (!token) {
      setOutputQueue([]);
      setOutputQueueError("");
      return;
    }

    setOutputQueueLoading(true);
    setOutputQueueError("");

    try {
      const items = await getWitsOutputQueue(token, {
        sessionId: activeMwdSessionId || undefined,
        status: outputQueueStatusFilter === "all" ? undefined : outputQueueStatusFilter,
        limit: 50,
      });
      setOutputQueue(items);
    } catch (error) {
      setOutputQueue([]);
      setOutputQueueError(error instanceof Error ? error.message : "Unable to load WITS output queue.");
    } finally {
      setOutputQueueLoading(false);
    }
  }, [activeMwdSessionId, outputQueueStatusFilter, token]);

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
      await loadOutputQueue();
    } catch (error) {
      toast.error("Unable to generate latest WITS output", {
        description: error instanceof Error ? error.message : "Backend request failed.",
      });
    } finally {
      setGeneratingLatestOutput(false);
    }
  };

  const handleSendPacket = () => {
    const decoded = decodeWitsPacket(draftPacket);
    const timestamp = new Date().toISOString();
    const nextPacket: WitsPacketLog = {
      id: `manual-${Date.now()}`,
      timestamp,
      source: draftSource || "Manual operator send",
      port: "TCP 10.20.0.14",
      rawPacket: draftPacket,
      witsId: decoded?.witsId ?? "----",
      rawValue: decoded?.rawValue ?? draftPacket,
      parsedValue: decoded?.parsedValue ?? "Manual packet stored without decode",
      label: decoded?.label ?? "Unknown WITS ID",
      description: decoded?.description ?? "Packet stored locally for UI validation",
    };

    setTransmittedPackets((current) => [nextPacket, ...current]);
    setSendDialogOpen(false);
    toast.success("WITS packet added to transmitted queue");
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
          <Button variant="outline" onClick={() => setSendDialogOpen(true)}>
            <Send className="mr-2 size-4" />
            Send WITS Data
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PacketPanel
          title="Data Received"
          count={receivedPackets.length}
          latestTimestamp={receivedPackets[0]?.timestamp}
        >
          <ScrollArea className="h-[360px]">
            {mode === "raw" ? (
              <PacketStream packets={receivedPackets} />
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
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </PacketPanel>

        <PacketPanel
          title="Data Transmitted"
          count={transmittedDisplayPackets.length}
          latestTimestamp={transmittedDisplayPackets[0]?.timestamp}
        >
          <div className="border-b px-4 py-2">
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
              {outputQueue.length ? <Badge variant="secondary">Backend queue</Badge> : <Badge variant="outline">Local preview</Badge>}
              {Object.entries(outputQueueStatusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline" className="capitalize">
                  {status}: {count}
                </Badge>
              ))}
              {outputQueueError ? <Badge variant="outline">Queue API unavailable</Badge> : null}
            </div>
            {outputQueueError ? (
              <p className="mt-1 text-xs text-muted-foreground">{outputQueueError}</p>
            ) : null}
          </div>
          <ScrollArea className="h-[360px]">
            {mode === "raw" ? (
              <PacketStream packets={transmittedDisplayPackets} />
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
                  {transmittedDisplayPackets.map((packet) => (
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
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </PacketPanel>
      </div>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WITS Data</DialogTitle>
            <DialogDescription>
              Manual packet entry updates the transmitted list locally. No live backend send is triggered.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>WITS packet</Label>
              <Textarea value={draftPacket} onChange={(event) => setDraftPacket(event.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Source label</Label>
              <Input value={draftSource} onChange={(event) => setDraftSource(event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSendPacket}>
              Add to transmitted list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
