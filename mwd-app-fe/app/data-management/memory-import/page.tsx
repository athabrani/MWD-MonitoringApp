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
  const handleNavigate = (page: AppPage) =>
    onNavigate ? onNavigate(page) : router.push(getAppPagePath(page));

  const content = (
    <div className="space-y-3 sm:space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Badge variant="secondary" className="h-5 px-2 text-[10px] sm:h-6 sm:text-xs">
            Data Management
          </Badge>
          <Badge variant="outline" className="h-5 px-2 text-[10px] sm:h-6 sm:text-xs">
            Memory File Import
          </Badge>
        </div>
        <h1 className="text-xl font-bold leading-tight sm:mt-3 sm:text-3xl">Memory File Import</h1>
        <p className="max-w-3xl text-xs leading-snug text-muted-foreground sm:mt-2 sm:text-sm sm:leading-normal">
          Backend memory import workflow for uploading CSV or ZIP memory dumps, reviewing detected segments, and correlating imported memory data with active MWD data.
        </p>
        <Button
          size="sm"
          className="h-7 px-2 text-[7px] sm:mt-2 sm:h-9 sm:text-sm"
          onClick={() => handleNavigate("configuration")}
        >
          Open Configuration WITS IDs
        </Button>
      </div>

      <MemoryImportWizard />
    </div>
  );

  if (onNavigate) {
    return content;
  }

  return (
    <AppLayout
      currentPage="data-management-memory-import"
      onNavigate={handleNavigate}
    >
      {content}
    </AppLayout>
  );
}
