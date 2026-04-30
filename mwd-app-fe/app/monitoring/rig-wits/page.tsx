"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Send, Wifi } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { WorkspaceSection } from "@/components/layouts/workspace-section";
import { MonitoringModeToggle } from "@/components/contents/monitoring/monitoring-mode-toggle";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultRigPortStatus,
  mockRigWitsReceivedPackets,
  mockRigWitsTransmittedPackets,
} from "@/data/monitoring-data";
import { decodeWitsPacket } from "@/lib/wits-map";
import { MonitoringMode, PortStatus, WitsPacketLog } from "@/types/monitoring";

function buildDelimitedPacket(packet: WitsPacketLog) {
  return ["&&", packet.rawPacket, "!!"].join("\n");
}

function PacketPanel({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex min-h-[420px] flex-col rounded-2xl p-0">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{count} items</Badge>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

export default function RigWitsPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [portStatus, setPortStatus] = useState<PortStatus>(defaultRigPortStatus);
  const [mode, setMode] = useState<MonitoringMode>("raw");
  const [receivedPackets] = useState<WitsPacketLog[]>(mockRigWitsReceivedPackets);
  const [transmittedPackets, setTransmittedPackets] = useState<WitsPacketLog[]>(
    mockRigWitsTransmittedPackets
  );
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [draftPacket, setDraftPacket] = useState("0824,26.45");
  const [draftSource, setDraftSource] = useState("Manual operator send");

  const latestPacket = useMemo(
    () => receivedPackets[0]?.timestamp ?? transmittedPackets[0]?.timestamp ?? new Date().toISOString(),
    [receivedPackets, transmittedPackets]
  );

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Monitoring</Badge>
            <Badge variant="outline">Rig WITS</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Rig WITS</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Diagnose Rig WITS traffic with raw packet history and structured record breakdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setSendDialogOpen(true)}>
            <Send className="mr-2 size-4" />
            Send WITS Data
          </Button>
        </div>
      </div>

      <WorkspaceSection
        title="Port Status and Mode"
        description="This page uses local state to model port availability and WITS send behavior."
        badge="Mock runtime"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-dashed px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Last packet</div>
              <div className="mt-1 text-sm font-medium">
                {format(new Date(latestPacket), "dd MMM yyyy HH:mm:ss")}
              </div>
            </Card>
          </div>

          <MonitoringModeToggle mode={mode} onChange={setMode} />
        </div>
      </WorkspaceSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <PacketPanel
          title="Data Received"
          description="Incoming Rig WITS feed history from local mock runtime."
          count={receivedPackets.length}
        >
          <ScrollArea className="h-[360px]">
            {mode === "raw" ? (
              <div className="space-y-3 p-4">
                {receivedPackets.map((packet) => (
                  <div key={packet.id} className="rounded-xl border bg-muted/10 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(packet.timestamp), "HH:mm:ss")}</span>
                      <span>{packet.source}</span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm leading-6 text-foreground">
                      {buildDelimitedPacket(packet)}
                    </pre>
                  </div>
                ))}
              </div>
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
                        <div className="text-xs text-muted-foreground">{packet.description}</div>
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
          description="Outgoing WITS messages queued locally from decoder and manual sends."
          count={transmittedPackets.length}
        >
          <ScrollArea className="h-[360px]">
            {mode === "raw" ? (
              <div className="space-y-3 p-4">
                {transmittedPackets.map((packet) => (
                  <div key={packet.id} className="rounded-xl border bg-muted/10 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(packet.timestamp), "HH:mm:ss")}</span>
                      <span>{packet.source}</span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-sm leading-6 text-foreground">
                      {buildDelimitedPacket(packet)}
                    </pre>
                  </div>
                ))}
              </div>
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
                  {transmittedPackets.map((packet) => (
                    <TableRow key={packet.id}>
                      <TableCell>{format(new Date(packet.timestamp), "HH:mm:ss")}</TableCell>
                      <TableCell className="font-mono">{packet.witsId}</TableCell>
                      <TableCell>
                        <div className="font-medium">{packet.label}</div>
                        <div className="text-xs text-muted-foreground">{packet.source}</div>
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
