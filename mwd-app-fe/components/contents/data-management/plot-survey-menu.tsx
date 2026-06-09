"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, LineChart } from "lucide-react";

export interface PlotConfigState {
  plotType: string;
  depthFrom: number;
  depthTo: number;
  autoScale: boolean;
}

export function PlotSurveyMenu({
  config,
  open,
  onOpenChange,
  onConfigChange,
  onApply,
}: {
  config: PlotConfigState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigChange: (patch: Partial<PlotConfigState>) => void;
  onApply: () => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="justify-center whitespace-nowrap">
            <LineChart className="mr-2 size-4" />
            Plot Surveys
            <ChevronDown className="ml-2 size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {["Plan vs Actual", "Vertical Section", "TVD vs MD"].map((plotType) => (
            <DropdownMenuItem
              key={plotType}
              onClick={() => {
                onConfigChange({ plotType });
                onOpenChange(true);
              }}
            >
              {plotType}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Plot</DialogTitle>
            <DialogDescription>
              This configures a local plot request only. Backend rendering endpoint is not connected here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plot Type</Label>
              <Input value={config.plotType} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Auto-scale</Label>
              <div className="flex h-10 items-center rounded-md border px-3">
                <Checkbox
                  checked={config.autoScale}
                  onCheckedChange={(checked) => onConfigChange({ autoScale: Boolean(checked) })}
                />
                <span className="ml-2 text-sm">Auto-fit plotted range</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Depth From</Label>
              <Input
                type="number"
                value={config.depthFrom}
                onChange={(event) => onConfigChange({ depthFrom: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Depth To</Label>
              <Input
                type="number"
                value={config.depthTo}
                onChange={(event) => onConfigChange({ depthTo: Number(event.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onApply}>
              Queue Plot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
