"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MudResistivityCalculator({
  initialMudWeight = 10.4,
  initialRm = 0.26,
}: {
  initialMudWeight?: number;
  initialRm?: number;
}) {
  const [mudWeight, setMudWeight] = useState(initialMudWeight);
  const [rm, setRm] = useState(initialRm);

  const result = useMemo(() => {
    const weightFactor = Math.max(0.75, Math.min(1.4, mudWeight / 10));
    return {
      rmf: Number((rm * 0.82 * weightFactor).toFixed(3)),
      rmc: Number((rm * 1.34 * weightFactor).toFixed(3)),
    };
  }, [mudWeight, rm]);

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mud Resistivity Calculator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approximation helper for Rmf and Rmc until the calibrated engineering model is connected.
          </p>
        </div>
        <Badge variant="outline">Approximation</Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Current Mud Weight</Label>
          <Input
            type="number"
            step="0.1"
            value={mudWeight}
            onChange={(event) => setMudWeight(Number(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>Rm</Label>
          <Input
            type="number"
            step="0.001"
            value={rm}
            onChange={(event) => setRm(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Rmf</div>
          <div className="mt-1 font-mono text-lg font-semibold">{result.rmf}</div>
        </div>
        <div className="rounded-xl border px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Rmc</div>
          <div className="mt-1 font-mono text-lg font-semibold">{result.rmc}</div>
        </div>
      </div>
    </Card>
  );
}
