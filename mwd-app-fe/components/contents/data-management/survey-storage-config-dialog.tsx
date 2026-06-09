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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SurveyStorageConfig } from "@/types/monitoring";

export function SurveyStorageConfigDialog({
  open,
  config,
  onOpenChange,
  onConfigChange,
  onSave,
}: {
  open: boolean;
  config: SurveyStorageConfig;
  onOpenChange: (open: boolean) => void;
  onConfigChange: (config: SurveyStorageConfig) => void;
  onSave: () => void;
}) {
  const updateColumn = (key: keyof SurveyStorageConfig["columnLabels"], value: string) => {
    onConfigChange({
      ...config,
      columnLabels: {
        ...config.columnLabels,
        [key]: value,
      },
    });
  };

  const toggleFields: Array<{
    label: string;
    checked: boolean;
    key: keyof Pick<
      SurveyStorageConfig,
      "captureRigWits" | "captureAuxDecoded" | "captureToolfaceMode"
    >;
  }> = [
    { label: "Capture Rig WITS", checked: config.captureRigWits, key: "captureRigWits" },
    { label: "Capture AUX decoded", checked: config.captureAuxDecoded, key: "captureAuxDecoded" },
    { label: "Capture toolface mode", checked: config.captureToolfaceMode, key: "captureToolfaceMode" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configure Survey Storage</DialogTitle>
          <DialogDescription>
            Configure local column labels, user-defined inputs, and WITS capture preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(config.columnLabels).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label className="capitalize">{key}</Label>
              <Input value={value} onChange={(event) => updateColumn(key as keyof SurveyStorageConfig["columnLabels"], event.target.value)} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>User-defined data input</Label>
          <Textarea
            rows={4}
            value={config.userDefinedInput}
            onChange={(event) =>
              onConfigChange({
                ...config,
                userDefinedInput: event.target.value,
              })
            }
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {toggleFields.map(({ label, checked, key }) => (
            <div key={label} className="flex items-center justify-between rounded-xl border px-3 py-3">
              <div className="text-sm font-medium">{label}</div>
              <Switch
                checked={checked}
                onCheckedChange={(value) =>
                  onConfigChange({
                    ...config,
                    [key]: value,
                  })
                }
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
