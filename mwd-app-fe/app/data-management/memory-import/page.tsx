"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { MemoryImportWizard } from "@/components/contents/data-management/memory-import-wizard";

export default function MemoryImportPage({
  onNavigate,
}: {
  onNavigate?: (page: AppPage) => void;
}) {
  const router = useRouter();

  return (
    <AppLayout
      currentPage="data-management-memory-import"
      onNavigate={(page) => (onNavigate ? onNavigate(page) : router.push(getAppPagePath(page)))}
    >
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Data Management</Badge>
            <Badge variant="outline">Memory File Import</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Memory File Import</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Legacy standalone view. The primary Polaris workflow now lives in Configuration &gt; WITS IDs, inside each WITS ID editor Memory Import tab.
          </p>
          <Button
            className="mt-4"
            onClick={() => (onNavigate ? onNavigate("configuration") : router.push(getAppPagePath("configuration")))}
          >
            Open Configuration WITS IDs
          </Button>
        </div>

        <MemoryImportWizard />
      </div>
    </AppLayout>
  );
}
