"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { MonitoringModeToggle } from "@/components/contents/monitoring/monitoring-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  mockAuxPortReceivedPackets,
  mockAuxPortTransmittedPackets,
} from "@/data/monitoring-data";
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

export default function AuxPortPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<MonitoringMode>("raw");
  const [receivedPackets] = useState<WitsPacketLog[]>(mockAuxPortReceivedPackets);
  const [transmittedPackets] = useState<WitsPacketLog[]>(mockAuxPortTransmittedPackets);

  const decodedPackets = useMemo(
    () =>
      receivedPackets.map((packet) => ({
        packet,
        decoded: decodeWitsPacket(packet.rawPacket),
      })),
    [receivedPackets]
  );

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Aux Port</h1>
          <Badge variant="secondary">Monitoring</Badge>
        </div>
        <MonitoringModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl p-0">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="text-lg font-semibold">Data Received</h2>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="outline">{receivedPackets.length} packets</Badge>
              <Badge variant="secondary">
                {format(new Date(receivedPackets[0]?.timestamp ?? new Date().toISOString()), "HH:mm:ss")}
              </Badge>
            </div>
          </div>
          <ScrollArea className="h-[420px]">
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
                  {decodedPackets.map(({ packet, decoded }) => (
                    <TableRow key={packet.id}>
                      <TableCell>{format(new Date(packet.timestamp), "HH:mm:ss")}</TableCell>
                      <TableCell className="font-mono">{decoded?.witsId ?? "----"}</TableCell>
                      <TableCell>
                        <div className="font-medium">{decoded?.label ?? "Unknown WITS ID"}</div>
                      </TableCell>
                      <TableCell>{decoded?.parsedValue ?? "Unparsed"}</TableCell>
                      <TableCell className="truncate font-mono text-xs" title={packet.rawPacket}>
                        {packet.rawPacket}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>

        <Card className="rounded-2xl p-0">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="text-lg font-semibold">Data Transmitted</h2>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="outline">{transmittedPackets.length} packets</Badge>
              <Badge variant="secondary">
                {format(new Date(transmittedPackets[0]?.timestamp ?? new Date().toISOString()), "HH:mm:ss")}
              </Badge>
            </div>
          </div>
          <ScrollArea className="h-[420px]">
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
        </Card>
      </div>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout currentPage="monitoring-aux-port" onNavigate={(page) => router.push(getAppPagePath(page))}>
      {content}
    </AppLayout>
  );
}
