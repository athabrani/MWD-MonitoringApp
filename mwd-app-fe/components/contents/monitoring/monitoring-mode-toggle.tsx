"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MonitoringMode } from "@/types/monitoring";

export function MonitoringModeToggle({
  mode,
  onChange,
}: {
  mode: MonitoringMode;
  onChange: (mode: MonitoringMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-muted bg-muted/30 p-0.5">
      {(["raw", "details"] as const).map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            "h-8 rounded-md px-2.5 text-xs capitalize",
            mode === item && "bg-background shadow-sm"
          )}
          onClick={() => onChange(item)}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}
