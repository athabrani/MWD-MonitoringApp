import * as React from "react";
import { Toaster as AppToaster } from "@/components/ui/toaster";
import { toast as baseToast } from "@/hooks/use-toast";
import type { ToastActionElement } from "@/components/ui/toast";

type AppToastType = "success" | "warning" | "error" | "info";

type ToastOptions = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  className?: string;
  duration?: number;
};

type ToastMessage = React.ReactNode;

type ShowAppToastInput = {
  type?: AppToastType;
  title?: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
  action?: ToastActionElement;
};

type ToastFn = ((message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>) & {
  success: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  error: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  info: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  warning: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  message: (message: ToastMessage, options?: ToastOptions) => ReturnType<typeof baseToast>;
  dismiss: () => void;
};

const toastDefaults: Record<AppToastType, { title: string; variant: ToastOptions["variant"] }> = {
  success: { title: "Success", variant: "success" },
  warning: { title: "Warning", variant: "warning" },
  error: { title: "Error", variant: "destructive" },
  info: { title: "Info", variant: "info" },
};

const resolveToastContent = (
  type: AppToastType,
  message?: ToastMessage,
  options?: ToastOptions
): Pick<ToastOptions, "title" | "description"> => {
  const fallbackTitle = toastDefaults[type].title;

  if (options?.title) {
    return {
      title: options.title,
      description: options.description ?? message,
    };
  }

  if (options?.description) {
    return {
      title: message ?? fallbackTitle,
      description: options.description,
    };
  }

  return {
    title: fallbackTitle,
    description: message,
  };
};

const makeToast = (type: AppToastType, message?: ToastMessage, options?: ToastOptions) => {
  const content = resolveToastContent(type, message, options);

  return baseToast({
    title: content.title,
    description: content.description,
    action: options?.action,
    variant: options?.variant ?? toastDefaults[type].variant,
    className: options?.className,
    duration: options?.duration ?? 4200,
  });
};

export function showAppToast({
  type = "info",
  title,
  description,
  duration,
  action,
}: ShowAppToastInput) {
  return makeToast(type, description, { title, duration, action });
}

export const appToast = {
  success: (title: React.ReactNode, description?: React.ReactNode, options?: Omit<ToastOptions, "title" | "description" | "variant">) =>
    makeToast("success", description ?? title, description ? { ...options, title } : options),
  warning: (title: React.ReactNode, description?: React.ReactNode, options?: Omit<ToastOptions, "title" | "description" | "variant">) =>
    makeToast("warning", description ?? title, description ? { ...options, title } : options),
  error: (title: React.ReactNode, description?: React.ReactNode, options?: Omit<ToastOptions, "title" | "description" | "variant">) =>
    makeToast("error", description ?? title, description ? { ...options, title } : options),
  info: (title: React.ReactNode, description?: React.ReactNode, options?: Omit<ToastOptions, "title" | "description" | "variant">) =>
    makeToast("info", description ?? title, description ? { ...options, title } : options),
};

export const toast = Object.assign(
  (message: ToastMessage, options?: ToastOptions) => makeToast("info", message, options),
  {
    success: (message: ToastMessage, options?: ToastOptions) =>
      makeToast("success", message, options),
    error: (message: ToastMessage, options?: ToastOptions) =>
      makeToast("error", message, options),
    info: (message: ToastMessage, options?: ToastOptions) =>
      makeToast("info", message, options),
    warning: (message: ToastMessage, options?: ToastOptions) =>
      makeToast("warning", message, options),
    message: (message: ToastMessage, options?: ToastOptions) =>
      makeToast("info", message, options),
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
