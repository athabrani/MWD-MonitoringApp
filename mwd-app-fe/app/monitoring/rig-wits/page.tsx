"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
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
  mockRigWitsReceivedPackets,
  mockRigWitsTransmittedPackets,
} from "@/data/monitoring-data";
import { decodeWitsPacket } from "@/lib/wits-map";
import { MonitoringMode, WitsPacketLog } from "@/types/monitoring";

function buildDelimitedPacket(packet: WitsPacketLog) {
  return ["&&", packet.rawPacket, "!!"].join("\n");
}

function PacketStream({
  packets,
}: {
  packets: WitsPacketLog[];
}) {
  return (
    <pre className="min-h-full whitespace-pre-wrap break-all bg-background px-4 py-3 font-mono text-sm leading-6 text-foreground">
      {packets.map((packet) => buildDelimitedPacket(packet)).join("\n")}
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

export default function RigWitsPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<MonitoringMode>("raw");
  const [receivedPackets] = useState<WitsPacketLog[]>(mockRigWitsReceivedPackets);
  const [transmittedPackets, setTransmittedPackets] = useState<WitsPacketLog[]>(
    mockRigWitsTransmittedPackets
  );
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [draftPacket, setDraftPacket] = useState("0824,26.45");
  const [draftSource, setDraftSource] = useState("Manual operator send");

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
          count={transmittedPackets.length}
          latestTimestamp={transmittedPackets[0]?.timestamp}
        >
          <ScrollArea className="h-[360px]">
            {mode === "raw" ? (
              <PacketStream packets={transmittedPackets} />
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
