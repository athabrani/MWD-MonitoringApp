"use client";

import { useState } from "react";
import { Activity, CheckCircle2, Clock, Eye, RefreshCw, Signal, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  BACKEND_REACHABILITY_PROBE_PATH,
  type BackendReachability,
} from "@/lib/admin-backend-health-api";
import {
  getGatewayRawPacketById,
  type GatewayRawPacket,
} from "@/lib/gateway-raw-packets-api";
import { cn } from "@/lib/utils";

type HealthLevel = "connected" | "degraded" | "disconnected" | "disabled" | "loading" | "unknown";

type HealthItem = {
  key: string;
  label: string;
  level: HealthLevel;
  value: string;
  description: string;
  updatedAt?: string | Date;
  detail?: string;
  rawPacket?: string;
  affectsSummary?: boolean;
};

type SystemHealthPanelProps = {
  title?: string;
  description?: string;
  mode?: "admin" | "settings";
  showRefresh?: boolean;
  className?: string;
  backendReachability?: BackendReachability;
  onRefreshBackendReachability?: () => void | Promise<void>;
};

function normalizeLevel(value?: string): HealthLevel {
  const status = value?.toLowerCase();

  if (!status) return "unknown";
  if (status === "connected" || status === "online" || status === "open" || status === "ok" || status === "healthy") {
    return "connected";
  }
  if (status === "disabled") return "disabled";
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

function backendBadgeLabel(status: BackendReachability["status"]) {
  if (status === "checking") return "Checking";
  if (status === "online") return "Connected";
  if (status === "offline") return "Disconnected";
  if (status === "unsupported") return "Unsupported";
  if (status === "auth-error") return "Auth Error";
  return "Error";
}

function backendBadgeVariant(status: BackendReachability["status"]) {
  if (status === "online") return "secondary" as const;
  if (status === "offline" || status === "error") return "destructive" as const;
  return "outline" as const;
}

function backendBadgeClassName(status: BackendReachability["status"]) {
  if (status === "online") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "auth-error") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return undefined;
}

function formatBackendProbeLatency(health: BackendReachability) {
  if (health.status === "checking") return "Checking...";
  if (
    (health.status === "online" || health.status === "auth-error") &&
    typeof health.latencyMs === "number" &&
    Number.isFinite(health.latencyMs)
  ) {
    return `${health.latencyMs} ms`;
  }

  return "- ms";
}

function getSummaryLevel(items: HealthItem[]): HealthLevel {
  if (items.some((item) => item.level === "disconnected")) return "disconnected";
  if (items.some((item) => item.level === "degraded" || item.level === "loading" || item.level === "unknown")) {
    return "degraded";
  }
  return "connected";
}

const RAW_PACKET_STALE_AFTER_MS = 2 * 60 * 1000;

function parseTimestamp(value?: string | Date) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPacketFreshness(receivedAt?: string) {
  const parsed = parseTimestamp(receivedAt);
  if (!parsed) return "Timestamp unavailable";

  const ageSeconds = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000));
  if (ageSeconds < 60) return `${ageSeconds}s ago`;

  const ageMinutes = Math.round(ageSeconds / 60);
  return `${ageMinutes}m ago`;
}

function packetPreview(packet: GatewayRawPacket) {
  const source = packet.packet ?? JSON.stringify(packet.raw);
  return source.length > 180 ? `${source.slice(0, 180)}...` : source;
}

function packetMetaDetails(packet: GatewayRawPacket) {
  return [
    packet.sessionId ? `Session ${packet.sessionId}` : null,
    packet.source ? `Source ${packet.source}` : null,
    packet.transmitterId ? `TX ${packet.transmitterId}` : null,
    typeof packet.rssi === "number" ? `RSSI ${packet.rssi}` : null,
    typeof packet.snr === "number" ? `SNR ${packet.snr}` : null,
    packet.sequence ? `Seq ${packet.sequence}` : null,
    packet.parseStatus ? `Parse ${packet.parseStatus}` : null,
    packet.error ? `Error ${packet.error}` : null,
  ].filter(Boolean).join(" | ");
}

export function SystemHealthPanel({
  title = "System Health",
  description,
  mode = "settings",
  showRefresh = true,
  className,
  backendReachability,
  onRefreshBackendReachability,
}: SystemHealthPanelProps) {
  const { token } = useAuth();
  const [selectedRawPacket, setSelectedRawPacket] = useState<GatewayRawPacket | null>(null);
  const [rawPacketDetailLoadingId, setRawPacketDetailLoadingId] = useState("");
  const [rawPacketDetailError, setRawPacketDetailError] = useState("");
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
    systemHealth,
    systemHealthLoading,
    systemHealthError,
    refreshSystemHealth,
    gatewayRawPackets,
    gatewayRawPacketsLoading,
    gatewayRawPacketsError,
    gatewayRawPacketsReachable,
    refreshGatewayRawPackets,
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
  const systemHealthLevel = systemHealthLoading
    ? "loading"
    : systemHealthError
      ? "disconnected"
      : normalizeLevel(systemHealth?.status);
  const latestRawPacket = gatewayRawPackets[0];
  const latestRawPacketTimestamp = parseTimestamp(latestRawPacket?.receivedAt);
  const latestRawPacketAgeMs = latestRawPacketTimestamp ? Date.now() - latestRawPacketTimestamp.getTime() : undefined;
  const rawPacketLevel = gatewayRawPacketsLoading
    ? "loading"
    : gatewayRawPacketsError
      ? "degraded"
      : !latestRawPacket
        ? gatewayRawPacketsReachable
          ? "connected"
          : "unknown"
        : typeof latestRawPacketAgeMs === "number"
          ? latestRawPacketAgeMs <= RAW_PACKET_STALE_AFTER_MS
            ? "connected"
            : "degraded"
          : "unknown";
  const rawPacketValue = gatewayRawPacketsLoading
    ? "Loading"
    : gatewayRawPacketsError
      ? "Unavailable"
      : !latestRawPacket
        ? gatewayRawPacketsReachable
          ? "Reachable"
          : "No packets"
        : typeof latestRawPacketAgeMs === "number"
          ? latestRawPacketAgeMs <= RAW_PACKET_STALE_AFTER_MS
            ? "Active"
            : "Stale"
          : "Logs available";
  const sessionLevel = activeMwdSessionId ? "connected" : "unknown";

  const signalDetails = [
    typeof espWsStatus?.signal?.rssi === "number" ? `RSSI ${espWsStatus.signal.rssi}` : null,
    typeof espWsStatus?.signal?.snr === "number" ? `SNR ${espWsStatus.signal.snr}` : null,
    espWsStatus?.signal?.quality ? `Quality ${espWsStatus.signal.quality}` : null,
    espWsStatus?.signal?.sequence ? `Seq ${espWsStatus.signal.sequence}` : null,
  ].filter(Boolean).join(" | ");
  const loadRawPacketDetail = async (packet: GatewayRawPacket) => {
    if (!token) {
      setRawPacketDetailError("Please sign in before loading raw packet detail.");
      return;
    }

    setRawPacketDetailLoadingId(packet.id);
    setRawPacketDetailError("");

    try {
      const detail = await getGatewayRawPacketById(token, packet.id);
      setSelectedRawPacket(detail);
    } catch (error) {
      setSelectedRawPacket(packet);
      setRawPacketDetailError(
        error instanceof Error ? error.message : "Unable to load gateway raw packet detail."
      );
    } finally {
      setRawPacketDetailLoadingId("");
    }
  };

  const items: HealthItem[] = [
    {
      key: "hardware",
      label: "Hardware Connection",
      level: connectionLevel,
      value: connectionStatusLoading ? "Loading" : connectionState.status,
      description: connectionStatusError || (
        activeMwdSessionId
          ? `Session-scoped source: ${connectionState.dataSource}`
          : `Global backend source: ${connectionState.dataSource}`
      ),
      updatedAt: connectionState.lastReceived ?? undefined,
      detail: connectionState.reconnecting ? "Reconnect in progress" : undefined,
    },
    {
      key: "serial",
      label: "Serial Gateway",
      level: serialLevel,
      value: serialStatusLoading ? "Loading" : serialStatus?.status ?? "Unavailable",
      description: serialStatusError || serialStatus?.message || serialStatus?.port || "Serial status endpoint unavailable or no status returned.",
      updatedAt: serialStatus?.lastReceivedAt,
      detail: serialStatus?.port ? `Port ${serialStatus.port}` : undefined,
    },
    {
      key: "esp",
      label: "ESP WebSocket",
      level: espLevel,
      value: espWsStatusLoading ? "Loading" : espWsStatus?.status ?? "Unavailable",
      description: espWsStatusError || espWsStatus?.lastError || espWsStatus?.message || "ESP WS status endpoint unavailable or no status returned.",
      updatedAt: espWsStatus?.lastReceivedAt,
      detail: signalDetails || (typeof espWsStatus?.clientCount === "number" ? `${espWsStatus.clientCount} clients` : undefined),
    },
    {
      key: "system-health",
      label: "Backend System Health",
      level: systemHealthLevel,
      value: systemHealthLoading ? "Loading" : systemHealth?.status ?? "Unavailable",
      description:
        systemHealthError ||
        systemHealth?.message ||
        [
          systemHealth?.version ? `Version ${systemHealth.version}` : null,
          systemHealth?.databaseStatus ? `DB ${systemHealth.databaseStatus}` : null,
          typeof systemHealth?.uptimeSeconds === "number" ? `Uptime ${systemHealth.uptimeSeconds}s` : null,
        ].filter(Boolean).join(" | ") ||
        "System health endpoint returned no status.",
      updatedAt: systemHealth?.checkedAt,
      detail: systemHealth?.dependencies.length ? `${systemHealth.dependencies.length} dependencies` : undefined,
    },
    {
      key: "raw-packets",
      label: "Gateway Raw Packets",
      level: rawPacketLevel,
      value: rawPacketValue,
      description:
        gatewayRawPacketsError ||
        [
          latestRawPacket?.source ? `Source ${latestRawPacket.source}` : null,
          latestRawPacket?.sessionId ? `Session ${latestRawPacket.sessionId}` : null,
          latestRawPacket?.status ? `Status ${latestRawPacket.status}` : null,
          latestRawPacket?.parseStatus ? `Parse ${latestRawPacket.parseStatus}` : null,
          typeof latestRawPacket?.rssi === "number" ? `RSSI ${latestRawPacket.rssi}` : null,
          typeof latestRawPacket?.snr === "number" ? `SNR ${latestRawPacket.snr}` : null,
          latestRawPacket ? `Freshness ${formatPacketFreshness(latestRawPacket.receivedAt)}` : null,
        ].filter(Boolean).join(" | ") ||
        (gatewayRawPacketsReachable
          ? "GET /api/gateway-raw-packets returned no packet logs."
          : "GET /api/gateway-raw-packets has not returned packet logs yet."),
      updatedAt: latestRawPacket?.receivedAt,
      detail: `${gatewayRawPackets.length} recent packets`,
      rawPacket: latestRawPacket?.packet,
      affectsSummary: false,
    },
    {
      key: "realtime",
      label: "Realtime WebSocket",
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

  const summaryLevel = getSummaryLevel(items.filter((item) => item.affectsSummary !== false));
  const gridClass = mode === "admin" ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-5";
  const healthLoading =
    connectionStatusLoading ||
    failoverEventsLoading ||
    serialStatusLoading ||
    espWsStatusLoading ||
    systemHealthLoading ||
    gatewayRawPacketsLoading ||
    backendReachability?.status === "checking";

  const handleRefresh = () => {
    void onRefreshBackendReachability?.();
    void refreshConnectionStatus();
    void refreshFailoverEvents();
    void refreshSerialStatus();
    void refreshEspWsStatus();
    void refreshSystemHealth();
    void refreshGatewayRawPackets();
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            {backendReachability ? (
              <Badge
                variant={backendBadgeVariant(backendReachability.status)}
                className={cn("capitalize", backendBadgeClassName(backendReachability.status))}
              >
                {backendBadgeLabel(backendReachability.status)}
              </Badge>
            ) : (
              <Badge variant={healthBadgeVariant(summaryLevel)} className="capitalize">
                {summaryLevel}
              </Badge>
            )}
          </div>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {backendReachability ? (
            <p className="mt-1 text-xs text-muted-foreground">
              API probe latency: {formatBackendProbeLatency(backendReachability)} via {BACKEND_REACHABILITY_PROBE_PATH}.
            </p>
          ) : null}
        </div>
        {showRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleRefresh}
            disabled={healthLoading}
          >
            <RefreshCw
              className={cn(
                "mr-2 size-4",
                healthLoading && "animate-spin"
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
              {item.key === "raw-packets" ? (
                <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Gateway raw packet diagnostics
                  </div>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Diagnostic signal only. System health still comes from connection, serial, ESP WS, and backend health endpoints.
                  </p>
                  {gatewayRawPackets.length > 0 ? (
                    <div className="space-y-2">
                      {gatewayRawPackets.slice(0, 5).map((packet) => (
                        <div key={packet.id} className="rounded-md border bg-background/80 p-2">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 text-[11px]">
                              <span className="font-medium">{packet.source ?? "Unknown source"}</span>
                              <span className="text-muted-foreground"> · {formatDateTime(packet.receivedAt)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => void loadRawPacketDetail(packet)}
                              disabled={rawPacketDetailLoadingId === packet.id}
                            >
                              <Eye className="mr-1 size-3" />
                              {rawPacketDetailLoadingId === packet.id ? "Loading" : "Detail"}
                            </Button>
                          </div>
                          {packetMetaDetails(packet) ? (
                            <div className="mb-1 break-words text-[10px] text-muted-foreground">
                              {packetMetaDetails(packet)}
                            </div>
                          ) : null}
                          <pre className="max-h-20 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
                            {packetPreview(packet)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {gatewayRawPacketsReachable
                        ? "GET /api/gateway-raw-packets returned no packet logs."
                        : "No raw packets returned by the backend for this token/session context."}
                    </p>
                  )}
                  {rawPacketDetailError ? (
                    <p className="mt-2 text-xs text-destructive">{rawPacketDetailError}</p>
                  ) : null}
                  {selectedRawPacket ? (
                    <div className="mt-3 rounded-md border bg-background/80 p-2">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-medium">Selected packet detail</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setSelectedRawPacket(null)}
                        >
                          Close
                        </Button>
                      </div>
                      <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
                        {JSON.stringify(selectedRawPacket.raw, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
