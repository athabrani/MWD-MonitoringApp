"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectionMethod } from "@/types/monitoring";

export function ProjectionDialog({
  open,
  measuredDepth,
  method,
  onOpenChange,
  onMeasuredDepthChange,
  onMethodChange,
  onSubmit,
}: {
  open: boolean;
  measuredDepth: number;
  method: ProjectionMethod;
  onOpenChange: (open: boolean) => void;
  onMeasuredDepthChange: (value: number) => void;
  onMethodChange: (value: ProjectionMethod) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Projection</DialogTitle>
          <DialogDescription>
            Create a projected survey record and store it through the survey API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Measured Depth</Label>
            <Input
              type="number"
              value={measuredDepth}
              onChange={(event) => onMeasuredDepthChange(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Projection Method</Label>
            <Select value={method} onValueChange={(value) => onMethodChange(value as ProjectionMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Straight-Line">Straight-Line</SelectItem>
                <SelectItem value="Last Build/Turn">Last Build/Turn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit}>
            Add Projection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
