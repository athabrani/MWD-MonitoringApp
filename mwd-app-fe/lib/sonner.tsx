import * as React from "react";
import { Toaster as AppToaster } from "@/components/ui/toaster";
import { toast as baseToast } from "@/hooks/use-toast";
import type { ToastActionElement } from "@/components/ui/toast";

type ToastOptions = {
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "destructive";
  className?: string;
  duration?: number;
};

type ToastMessage = React.ReactNode;

type ToastFn = ((message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>) & {
  success: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  error: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  info: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  warning: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  message: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  dismiss: () => void;
};

const makeToast = (message: ToastMessage, options?: ToastOptions) =>
  baseToast({
    title: message == null ? "" : String(message),
    description: options?.description,
    action: options?.action,
    variant: options?.variant,
    className: options?.className,
  });

export const toast = Object.assign(
  (message: ToastMessage, options?: ToastOptions) => makeToast(message, options),
  {
    success: (message: ToastMessage, options?: ToastOptions) =>
      makeToast(message, options),
    error: (message: ToastMessage, options?: ToastOptions) =>
      makeToast(message, {
        ...options,
        variant: "destructive",
      }),
    info: (message: ToastMessage, options?: ToastOptions) =>
      makeToast(message, options),
    warning: (message: ToastMessage, options?: ToastOptions) =>
      makeToast(message, options),
    message: (message: ToastMessage, options?: ToastOptions) =>
      makeToast(message, options),
    dismiss: () => undefined,
  }
) as ToastFn;

type ToasterProps = {
  position?: string;
  richColors?: boolean;
  closeButton?: boolean;
  toastOptions?: unknown;
};

export function Toaster(_props: ToasterProps) {
  void _props;
  return <AppToaster />;
}
