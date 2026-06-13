"use client";

import { useRouter } from "next/navigation";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuxPortPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Aux Port</h1>
          <Badge variant="secondary">Monitoring</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Packets</div>
          <div className="mt-2 text-2xl font-semibold">0</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
          <div className="mt-2 text-2xl font-semibold">Idle</div>
        </Card>
        <Card className="rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest</div>
          <div className="mt-2 text-2xl font-semibold">-</div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">AUX Data</h2>
            <p className="text-sm text-muted-foreground">
              No AUX records are available for the current session.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Refresh
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                AUX port data will appear here when a backend data source is connected.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
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
