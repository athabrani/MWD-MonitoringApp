import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const toastTone = {
  default: {
    accent: "bg-sky-500",
    iconWrap: "bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300",
    icon: Info,
  },
  info: {
    accent: "bg-sky-500",
    iconWrap: "bg-sky-50 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300",
    icon: Info,
  },
  success: {
    accent: "bg-emerald-500",
    iconWrap: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  warning: {
    accent: "bg-amber-500",
    iconWrap: "bg-amber-50 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300",
    icon: AlertTriangle,
  },
  destructive: {
    accent: "bg-red-500",
    iconWrap: "bg-red-50 text-red-600 dark:bg-red-500/12 dark:text-red-300",
    icon: XCircle,
  },
} as const;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = props.variant ?? "info";
        const tone = toastTone[variant] ?? toastTone.info;
        const StatusIcon = tone.icon;
        const role = variant === "destructive" || variant === "warning" ? "alert" : "status";

        return (
          <Toast key={id} role={role} {...props}>
            <div className={cn("w-1 self-stretch", tone.accent)} />
            <div className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 pr-9">
              <span className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full", tone.iconWrap)}>
                <StatusIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                {title ? <ToastTitle className="text-sm font-semibold leading-5">{title}</ToastTitle> : null}
                {description ? <ToastDescription>{description}</ToastDescription> : null}
              </div>
              {action}
            </div>
            <ToastClose aria-label="Dismiss notification" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
