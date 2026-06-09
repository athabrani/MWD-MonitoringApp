"use client";

import { MouseEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DepthScalePosition, UploadedUserFile } from "@/types/plotting";

export function DepthScalePositionEditor({
  files,
  positions,
  onSave,
}: {
  files: UploadedUserFile[];
  positions: DepthScalePosition[];
  onSave: (position: DepthScalePosition) => void;
}) {
  const pdfFiles = useMemo(() => files.filter((file) => file.type === "PDF"), [files]);
  const [selectedFileId, setSelectedFileId] = useState(pdfFiles[0]?.id ?? "");
  const savedPosition = positions.find((position) => position.fileId === selectedFileId);
  const [draftPosition, setDraftPosition] = useState<{ x: number; y: number }>(
    savedPosition ? { x: savedPosition.x, y: savedPosition.y } : { x: 50, y: 50 }
  );

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Number((((event.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = Number((((event.clientY - rect.top) / rect.height) * 100).toFixed(1));
    setDraftPosition({ x, y });
  };

  const selectedFile = pdfFiles.find((file) => file.id === selectedFileId);

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Depth Scale Position</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a PDF file and click the preview area to store the depth scale anchor.
          </p>
        </div>
        <Badge variant={savedPosition ? "secondary" : "outline"}>
          {savedPosition ? "Saved" : "Unsaved"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <Label>PDF File</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={selectedFileId}
            onChange={(event) => {
              const nextId = event.target.value;
              const nextSaved = positions.find((position) => position.fileId === nextId);
              setSelectedFileId(nextId);
              setDraftPosition(nextSaved ? { x: nextSaved.x, y: nextSaved.y } : { x: 50, y: 50 });
            }}
          >
            {pdfFiles.map((file) => (
              <option key={file.id} value={file.id}>
                {file.fileName}
              </option>
            ))}
          </select>
          <div className="rounded-xl border p-3 text-sm text-muted-foreground">
            {selectedFile?.description ?? "No PDF files uploaded yet."}
          </div>
          <Button
            className="w-full"
            onClick={() =>
              onSave({
                fileId: selectedFileId,
                x: draftPosition.x,
                y: draftPosition.y,
                savedAt: new Date().toISOString(),
              })
            }
            disabled={!selectedFileId}
          >
            Save Position
          </Button>
        </div>

        <div
          className="relative h-72 cursor-crosshair rounded-xl border bg-muted/30"
          onClick={handlePreviewClick}
        >
          <div className="absolute inset-x-8 top-6 h-10 rounded border bg-background/80" />
          <div className="absolute inset-x-8 top-24 h-28 rounded border bg-background/60" />
          <div className="absolute inset-x-8 bottom-6 h-16 rounded border bg-background/70" />
          <div
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-600 bg-emerald-500 shadow"
            style={{ left: `${draftPosition.x}%`, top: `${draftPosition.y}%` }}
          />
          <div className="absolute bottom-3 right-3 rounded-md border bg-background px-2 py-1 font-mono text-xs">
            x {draftPosition.x}% / y {draftPosition.y}%
          </div>
        </div>
      </div>
    </Card>
  );
}
