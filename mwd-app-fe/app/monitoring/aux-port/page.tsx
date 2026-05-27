"use client";

import { useRouter } from "next/navigation";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

      <Card className="rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Endpoint backend untuk fitur ini belum tersedia.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Dokumentasi backend belum menyediakan endpoint AUX khusus. Frontend tidak menampilkan
          data lokal sebagai data aktual dan action AUX yang membutuhkan backend dinonaktifkan.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" disabled>
            Refresh AUX
          </Button>
          <Button variant="outline" disabled>
            Send AUX Data
          </Button>
        </div>
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
