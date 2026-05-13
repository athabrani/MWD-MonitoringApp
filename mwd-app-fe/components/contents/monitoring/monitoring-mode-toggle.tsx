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
    <div className="inline-flex rounded-xl border border-muted bg-muted/30 p-1">
      {(["raw", "details"] as const).map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant="ghost"
          className={cn(
            "rounded-lg capitalize",
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
