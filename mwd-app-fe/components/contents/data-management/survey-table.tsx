"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SurveyRecord } from "@/types/monitoring";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SurveyTable({
  records,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  records: SurveyRecord[];
  selectedId?: string;
  onSelect: (record: SurveyRecord) => void;
  onEdit: (record: SurveyRecord) => void;
  onDelete: (record: SurveyRecord) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>MD</TableHead>
            <TableHead>Inc</TableHead>
            <TableHead>Azm</TableHead>
            <TableHead>TVD</TableHead>
            <TableHead>DLS</TableHead>
            <TableHead>VS</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Captured</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow
              key={record.id}
              className={cn(
                "cursor-pointer",
                selectedId === record.id && "bg-muted/60"
              )}
              onClick={() => onSelect(record)}
            >
              <TableCell className="font-medium">{record.md.toFixed(1)}</TableCell>
              <TableCell>{record.inc.toFixed(2)}</TableCell>
              <TableCell>{record.azm.toFixed(2)}</TableCell>
              <TableCell>{record.tvd.toFixed(1)}</TableCell>
              <TableCell>{record.dls.toFixed(2)}</TableCell>
              <TableCell>{record.vs.toFixed(1)}</TableCell>
              <TableCell>
                <Badge variant={record.isProjection ? "secondary" : "outline"}>
                  {record.isProjection
                    ? record.projectionMethod ?? "Projection"
                    : record.toolfaceMode}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(record.timestamp), "dd MMM yyyy HH:mm")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(record);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(record);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
