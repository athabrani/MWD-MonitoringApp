"use client";

import { Activity, CheckCircle2, Clock, RefreshCw, Signal, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";

type HealthLevel = "connected" | "degraded" | "disconnected" | "loading" | "unknown";

type HealthItem = {
  key: string;
  label: string;
  level: HealthLevel;
  value: string;
  description: string;
  updatedAt?: string | Date;
  detail?: string;
};

type SystemHealthPanelProps = {
  title?: string;
  description?: string;
  mode?: "admin" | "settings";
  showRefresh?: boolean;
  className?: string;
};

function normalizeLevel(value?: string): HealthLevel {
  const status = value?.toLowerCase();

  if (!status) return "unknown";
  if (status === "connected" || status === "online" || status === "open") return "connected";
  if (status === "connecting" || status === "reconnecting" || status === "degraded") return "degraded";
  if (status === "disconnected" || status === "offline" || status === "closed" || status === "error") {
    return "disconnected";
  }

  return "unknown";
}

function formatDateTime(value?: string | Date) {
  if (!value) return "-";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString();
}

function healthBadgeVariant(level: HealthLevel) {
  if (level === "connected") return "secondary" as const;
  if (level === "disconnected") return "destructive" as const;
  return "outline" as const;
}

function healthIcon(level: HealthLevel) {
  if (level === "connected") return CheckCircle2;
  if (level === "disconnected") return WifiOff;
  if (level === "loading") return RefreshCw;
  return Signal;
}

function getSummaryLevel(items: HealthItem[]): HealthLevel {
  if (items.some((item) => item.level === "disconnected")) return "disconnected";
  if (items.some((item) => item.level === "degraded" || item.level === "loading" || item.level === "unknown")) {
    return "degraded";
  }
  return "connected";
}

export function SystemHealthPanel({
  title = "System Health",
  description = "Live connection health from current backend and realtime state.",
  mode = "settings",
  showRefresh = true,
  className,
}: SystemHealthPanelProps) {
  const {
    activeMwdSession,
    activeMwdSessionId,
    connectionState,
    connectionStatusLoading,
    connectionStatusError,
    refreshConnectionStatus,
    failoverEventsLoading,
    refreshFailoverEvents,
    serialStatus,
    serialStatusLoading,
    serialStatusError,
    refreshSerialStatus,
    espWsStatus,
    espWsStatusLoading,
    espWsStatusError,
    refreshEspWsStatus,
    realtimeStatus,
    realtimeError,
  } = useApp();

  const connectionLevel = connectionStatusLoading
    ? "loading"
    : connectionStatusError
      ? "disconnected"
      : normalizeLevel(connectionState.status);
  const serialLevel = serialStatusLoading
    ? "loading"
    : serialStatusError
      ? "disconnected"
      : normalizeLevel(serialStatus?.status);
  const espLevel = espWsStatusLoading
    ? "loading"
    : espWsStatusError || espWsStatus?.lastError
      ? "disconnected"
      : normalizeLevel(espWsStatus?.status);
  const realtimeLevel = realtimeError ? "disconnected" : normalizeLevel(realtimeStatus);
  const sessionLevel = activeMwdSessionId ? "connected" : "unknown";

  const signalDetails = [
    typeof espWsStatus?.signal?.rssi === "number" ? `RSSI ${espWsStatus.signal.rssi}` : null,
    typeof espWsStatus?.signal?.snr === "number" ? `SNR ${espWsStatus.signal.snr}` : null,
    espWsStatus?.signal?.quality ? `Quality ${espWsStatus.signal.quality}` : null,
    espWsStatus?.signal?.sequence ? `Seq ${espWsStatus.signal.sequence}` : null,
  ].filter(Boolean).join(" | ");

  const items: HealthItem[] = [
    {
      key: "app",
      label: "Application / API",
      level: connectionLevel,
      value: connectionStatusLoading ? "Loading" : connectionState.status,
      description: connectionStatusError || `Primary source: ${connectionState.dataSource}`,
      updatedAt: connectionState.lastReceived,
      detail: connectionState.reconnecting ? "Reconnect in progress" : undefined,
    },
    {
      key: "serial",
      label: "Serial",
      level: serialLevel,
      value: serialStatusLoading ? "Loading" : serialStatus?.status ?? "No status",
      description: serialStatusError || serialStatus?.message || serialStatus?.port || "Backend serial bridge status.",
      updatedAt: serialStatus?.lastReceivedAt,
      detail: serialStatus?.port ? `Port ${serialStatus.port}` : undefined,
    },
    {
      key: "esp",
      label: "ESP WS",
      level: espLevel,
      value: espWsStatusLoading ? "Loading" : espWsStatus?.status ?? "No status",
      description: espWsStatusError || espWsStatus?.lastError || espWsStatus?.message || "ESP gateway websocket status.",
      updatedAt: espWsStatus?.lastReceivedAt,
      detail: signalDetails || (typeof espWsStatus?.clientCount === "number" ? `${espWsStatus.clientCount} clients` : undefined),
    },
    {
      key: "realtime",
      label: "Realtime",
      level: realtimeLevel,
      value: realtimeError ? "Error" : realtimeStatus,
      description: realtimeError || "Frontend WebSocket client state.",
      detail: realtimeStatus === "reconnecting" || realtimeStatus === "connecting" ? "Waiting for backend realtime stream" : undefined,
    },
    {
      key: "session",
      label: "Active Session",
      level: sessionLevel,
      value: activeMwdSessionId ? "Selected" : "Not selected",
      description: activeMwdSession?.name ?? activeMwdSession?.wellName ?? "Select a job/session to scope realtime data.",
      detail: activeMwdSessionId ? `Session ${activeMwdSessionId}` : undefined,
    },
  ];

  const summaryLevel = getSummaryLevel(items);
  const gridClass = mode === "admin" ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-5";

  const handleRefresh = () => {
    void refreshConnectionStatus();
    void refreshFailoverEvents();
    void refreshSerialStatus();
    void refreshEspWsStatus();
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <Badge variant={healthBadgeVariant(summaryLevel)} className="capitalize">
              {summaryLevel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {showRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleRefresh}
            disabled={connectionStatusLoading || failoverEventsLoading || serialStatusLoading || espWsStatusLoading}
          >
            <RefreshCw
              className={cn(
                "mr-2 size-4",
                (connectionStatusLoading || failoverEventsLoading || serialStatusLoading || espWsStatusLoading) &&
                  "animate-spin"
              )}
            />
            Refresh Health
          </Button>
        ) : null}
      </div>

      <div className={cn("grid gap-3", gridClass)}>
        {items.map((item) => {
          const Icon = healthIcon(item.level);

          return (
            <div key={item.key} className="min-w-0 rounded-xl border border-border/80 bg-background/70 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", item.level === "loading" && "animate-spin")} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.value}</div>
                  </div>
                </div>
                <Badge variant={healthBadgeVariant(item.level)} className="shrink-0 capitalize">
                  {item.level}
                </Badge>
              </div>
              <p className="min-h-8 break-words text-xs text-muted-foreground">{item.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDateTime(item.updatedAt)}
                </span>
                {item.detail ? (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="size-3" />
                    {item.detail}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
