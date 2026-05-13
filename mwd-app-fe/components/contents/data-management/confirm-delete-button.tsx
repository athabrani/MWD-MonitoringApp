"use client";

import type { MouseEvent } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDeleteButton({
  title = "Delete item?",
  description = "This action only updates local state for now, but the item will be removed from this view.",
  confirmLabel = "Delete",
  triggerLabel,
  size = "icon",
  variant = "ghost",
  className,
  onConfirm,
  onClickCapture,
  disabled,
}: {
  title?: string;
  description?: string;
  confirmLabel?: string;
  triggerLabel?: string;
  size?: "sm" | "icon";
  variant?: "ghost" | "outline";
  className?: string;
  onConfirm: () => void;
  onClickCapture?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          disabled={disabled}
          className={cn("text-destructive", className)}
          onClick={(event) => {
            event.stopPropagation();
            onClickCapture?.(event);
          }}
        >
          <Trash2 className={cn("size-4", triggerLabel && "mr-2")} />
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
