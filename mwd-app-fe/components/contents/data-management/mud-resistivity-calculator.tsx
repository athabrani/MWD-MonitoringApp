"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MudResistivityCalculator({
  initialMudWeight = 10.4,
  initialRm = 0.26,
  onApplyToHeader,
}: {
  initialMudWeight?: number;
  initialRm?: number;
  onApplyToHeader?: (values: { rmf: number; rmc: number }) => void;
}) {
  const [mudWeight, setMudWeight] = useState(String(initialMudWeight));
  const [rm, setRm] = useState(String(initialRm));
  const [calculatedValues, setCalculatedValues] = useState<{ rmf: number; rmc: number } | null>(null);

  const calculation = useMemo(() => {
    const mudWeightValue = Number(mudWeight);
    const rmValue = Number(rm);
    if (!Number.isFinite(mudWeightValue) || !Number.isFinite(rmValue) || mudWeightValue <= 0 || rmValue <= 0) {
      return null;
    }

    const weightFactor = Math.max(0.75, Math.min(1.4, mudWeightValue / 10));
    return {
      rmf: Number((rmValue * 0.82 * weightFactor).toFixed(3)),
      rmc: Number((rmValue * 1.34 * weightFactor).toFixed(3)),
    };
  }, [mudWeight, rm]);

  const errorMessage = calculation ? "" : "Enter positive numeric Mud Weight and Rm values before calculating.";
  const result = calculatedValues ?? calculation;

  const handleCalculate = () => {
    if (!calculation) {
      setCalculatedValues(null);
      return;
    }
    setCalculatedValues(calculation);
  };

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Mud Resistivity Calculator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Calculates estimated Rmf and Rmc from Mud Weight and Rm. This uses a bounded engineering approximation until a calibrated model is connected.
          </p>
        </div>
        <Badge variant="outline">Approximation</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Current Mud Weight</Label>
            <Input
              type="number"
              step="0.1"
              value={mudWeight}
              onChange={(event) => setMudWeight(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Used as a bounded density factor in the approximation.</p>
          </div>
          <div className="space-y-2">
            <Label>Rm</Label>
            <Input
              type="number"
              step="0.001"
              value={rm}
              onChange={(event) => setRm(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mud resistivity input at the current measurement basis.</p>
          </div>
        </div>
        <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
          Formula note: Rmf = Rm x 0.82 x density factor; Rmc = Rm x 1.34 x density factor. Density factor is clamped from 0.75 to 1.4.
        </div>
      </div>

      {errorMessage ? <div className="mt-3 text-sm text-destructive">{errorMessage}</div> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Rmf</div>
          <Input readOnly value={result?.rmf ?? ""} className="mt-2 font-mono text-lg font-semibold" />
        </div>
        <div className="rounded-xl border px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Rmc</div>
          <Input readOnly value={result?.rmc ?? ""} className="mt-2 font-mono text-lg font-semibold" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleCalculate} disabled={!calculation}>
          Calculate
        </Button>
        <Button
          variant="outline"
          disabled={!result || !onApplyToHeader}
          onClick={() => result && onApplyToHeader?.(result)}
        >
          Apply to Header
        </Button>
      </div>
    </Card>
  );
}
