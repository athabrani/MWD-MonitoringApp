"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PortStatus } from "@/types/monitoring";

export function PortStatusBadge({ status }: { status: PortStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 border px-3 py-1 text-xs font-medium",
        status === "Open"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status === "Open" ? "bg-emerald-500" : "bg-slate-500"
        )}
      />
      {status}
    </Badge>
  );
}
