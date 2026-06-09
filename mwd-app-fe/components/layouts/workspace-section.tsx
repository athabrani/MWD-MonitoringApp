import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function WorkspaceSection({
  title,
  description,
  badge,
  children,
  className,
}: {
  title: string;
  description?: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-3 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground sm:text-lg">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:mt-1 sm:text-sm sm:leading-normal">{description}</p>
          ) : null}
        </div>
        {badge ? <Badge variant="outline" className="max-w-full truncate">{badge}</Badge> : null}
      </div>
      {children}
    </Card>
  );
}

export function PlaceholderNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
