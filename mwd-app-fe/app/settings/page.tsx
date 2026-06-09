"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Bell, Eye, Gauge, RefreshCw, Ruler, Search } from "lucide-react";
import { toast } from "sonner";
import { SystemHealthPanel } from "@/components/system-health-panel";
import {
  checkBackendReachability,
  type BackendReachability,
} from "@/lib/admin-backend-health-api";
import { updateWitsConfig, witsConfigToPayload } from "@/lib/api/wits";
import { groupWitsThresholdConfigs, resolveWitsConfigThreshold, WitsThresholdGroup } from "@/lib/dashboard-thresholds";
import { PolarisWitsId } from "@/types/polaris";

type WitsThresholdDraft = Pick<PolarisWitsId, "alarmEnabled" | "alarmLow" | "alarmHigh">;

export const SettingsPage: React.FC<{
  onNavigate?: (page: AppPage) => void;
}> = ({ onNavigate }) => {
  const router = useRouter();
  const { token, user } = useAuth();
  const {
    settings,
    updateSettings,
    witsConfig,
    witsConfigLoading,
    witsConfigError,
    refreshWitsConfig,
    events,
  } = useApp();

  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, WitsThresholdDraft>>({});
  const [thresholdSearch, setThresholdSearch] = useState("");
  const [thresholdsSaving, setThresholdsSaving] = useState(false);
  const [backendReachability, setBackendReachability] = useState<BackendReachability>({
    status: "checking",
  });
  const canManageSettings = user?.role === "engineer" || user?.role === "admin";
  const notificationEvents = events.filter((event) => event.type !== "alarm").slice(0, 20);

  const thresholdRows = useMemo(
    () =>
      [...witsConfig].sort((left, right) => {
        if (left.numericId !== right.numericId) return left.numericId - right.numericId;
        return left.name.localeCompare(right.name);
      }),
    [witsConfig]
  );
  const thresholdGroups = useMemo(
    () => groupWitsThresholdConfigs(thresholdRows),
    [thresholdRows]
  );

  useEffect(() => {
    setThresholdDrafts(
      Object.fromEntries(
        thresholdGroups.map((group) => {
          const resolved = resolveWitsConfigThreshold(group.configs[0], settings.thresholds);

          return [
            group.key,
            {
              alarmEnabled: resolved.enabled,
              alarmLow: resolved.low,
              alarmHigh: resolved.high,
            },
          ];
        })
      )
    );
  }, [settings.thresholds, thresholdGroups]);

  const getThresholdDraft = (group: WitsThresholdGroup): WitsThresholdDraft => {
    const resolved = resolveWitsConfigThreshold(group.configs[0], settings.thresholds);

    return thresholdDrafts[group.key] ?? {
      alarmEnabled: resolved.enabled,
      alarmLow: resolved.low,
      alarmHigh: resolved.high,
    };
  };

  const patchThreshold = (groupKey: string, patch: Partial<WitsThresholdDraft>) => {
    if (!canManageSettings) {
      toast.warning("Operator role can view settings only.");
      return;
    }

    setThresholdDrafts((current) => ({
      ...current,
      [groupKey]: {
        ...(current[groupKey] ?? { alarmEnabled: false, alarmLow: 0, alarmHigh: 0 }),
        ...patch,
      },
    }));
  };

  const isGeneratedConfigId = (config: PolarisWitsId) => config.id.startsWith("wits-");

  const changedThresholdGroups = thresholdGroups.filter((group) => {
    const draft = getThresholdDraft(group);

    return group.configs.some((config) => {
      const resolved = resolveWitsConfigThreshold(config, settings.thresholds);

      return (
        draft.alarmEnabled !== resolved.enabled ||
        draft.alarmLow !== resolved.low ||
        draft.alarmHigh !== resolved.high
      );
    });
  });
  const changedThresholdConfigs = changedThresholdGroups.flatMap((group) =>
    group.configs.map((config) => ({
      config,
      draft: getThresholdDraft(group),
    }))
  );

  const totalGroupedThresholdMembers = thresholdGroups.reduce(
    (count, group) => count + Math.max(0, group.configs.length - 1),
    0
  );

  const normalizedThresholdSearch = thresholdSearch.trim().toLowerCase();
  const visibleThresholdGroups = useMemo(() => {
    if (!normalizedThresholdSearch) return thresholdGroups;

    return thresholdGroups.filter((group) => {
      const searchable = [
        group.label,
        group.unit,
        group.mappedField,
        group.category,
        ...group.configs.flatMap((config) => [
          config.name,
          config.units,
          config.mappedField,
          config.dataSourceType,
          config.lasMnemonic,
          config.lasDescription,
          config.realTimePlot,
          config.depthTracking,
          String(config.numericId).padStart(4, "0"),
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedThresholdSearch);
    });
  }, [normalizedThresholdSearch, thresholdGroups]);

  const thresholdCardCount = thresholdGroups.length;
  const rawThresholdRowCount = thresholdRows.length;

  const getGroupResolvedSources = (group: WitsThresholdGroup) => {
    const sources = group.configs.map((config) => resolveWitsConfigThreshold(config, settings.thresholds));

    return {
      low: Array.from(new Set(sources.map((source) => source.lowSource))).join("/"),
      high: Array.from(new Set(sources.map((source) => source.highSource))).join("/"),
    };
  };

  const getGroupReadOnly = (group: WitsThresholdGroup) => group.configs.every(isGeneratedConfigId);
  const getGroupMemberWitsIds = (group: WitsThresholdGroup) =>
    group.configs.map((config) => String(config.numericId).padStart(4, "0"));

  const getGroupScaleLabel = (group: WitsThresholdGroup) => {
    const scaleLabels = Array.from(
      new Set(group.configs.map((config) => `${config.leftScale} - ${config.rightScale}`))
    );
    return scaleLabels.length === 1 ? scaleLabels[0] : "Mixed";
  };

  const handleSaveThresholds = async () => {
    if (!canManageSettings) {
      toast.warning("Operator role can view thresholds only.");
      return;
    }

    if (!token) {
      toast.error("Missing auth token. Please login again.");
      return;
    }

    const persistableConfigs = changedThresholdConfigs.filter(({ config }) => !isGeneratedConfigId(config));
    const skippedConfigs = changedThresholdConfigs.length - persistableConfigs.length;

    if (persistableConfigs.length === 0) {
      toast.info(skippedConfigs > 0 ? "Some WITS config rows do not expose a backend id for update." : "No threshold changes to save.");
      return;
    }

    setThresholdsSaving(true);

    try {
      await Promise.all(
        persistableConfigs.map(({ config, draft }) => {
          return updateWitsConfig(
            token,
            config.id,
            witsConfigToPayload({
              ...config,
              alarmEnabled: draft.alarmEnabled,
              alarmLow: draft.alarmLow,
              alarmHigh: draft.alarmHigh,
            })
          );
        })
      );
      await refreshWitsConfig();
      toast.success(
        skippedConfigs > 0
          ? `Saved ${changedThresholdGroups.length} threshold group(s) across ${persistableConfigs.length} WITS config(s). ${skippedConfigs} read-only row(s) were skipped.`
          : `Saved ${changedThresholdGroups.length} threshold group(s) across ${persistableConfigs.length} WITS config(s).`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save WITS threshold config.");
    } finally {
      setThresholdsSaving(false);
    }
  };

  const refreshBackendReachability = useCallback(async () => {
    if (!token) {
      setBackendReachability({
        status: "auth-error",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: "Missing auth token.",
      });
      return;
    }

    setBackendReachability((current) => ({
      ...current,
      status: "checking",
    }));
    setBackendReachability(await checkBackendReachability(token, "/api/mwd-sessions"));
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setBackendReachability({
          status: "auth-error",
          lastCheckedAt: new Date().toISOString(),
          errorMessage: "Missing auth token.",
        });
      });
      return () => {
        cancelled = true;
      };
    }

    void checkBackendReachability(token, "/api/mwd-sessions").then((health) => {
      if (!cancelled) setBackendReachability(health);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateDisplay = (display: Partial<typeof settings.display>) => {
    if (!canManageSettings) {
      toast.warning("Operator role can view settings only.");
      return;
    }

    updateSettings({ display: { ...settings.display, ...display } });
  };

  const content = (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
          <p className="break-words text-xs leading-snug text-muted-foreground sm:text-sm">
            Local UI preferences only. Operational data, WITS runtime config, surveys, alarms, and plot templates come from backend APIs.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-xs sm:flex sm:gap-2">
          <StatusPill label="Density" value={settings.display.density} />
          <StatusPill label="Units" value={settings.units} />
          <StatusPill
            label="Refresh"
            value={settings.display.autoRefresh ? `${settings.display.refreshInterval}s` : "paused"}
          />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-3 sm:space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:justify-start">
          <TabsTrigger value="dashboard" className="min-h-8 text-[11px] sm:text-sm">
            <Eye className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
            Dashboard View
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="min-h-8 text-[11px] sm:text-sm">
            <Gauge className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-8 text-[11px] sm:text-sm">
            <Bell className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="system-health" className="min-h-8 text-[11px] sm:text-sm">
            <Activity className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <div className="grid gap-3 xl:grid-cols-3">
            <SettingCard icon={Eye} title="Display" description="Dashboard spacing and theme behavior.">
              <CompactRow label="Density" description="Affects dashboard card count and spacing.">
                <Select
                  value={settings.display.density}
                  disabled={!canManageSettings}
                  onValueChange={(value) => updateDisplay({ density: value as "compact" | "comfortable" })}
                >
                  <SelectTrigger className="h-9 w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border/70">
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                  </SelectContent>
                </Select>
              </CompactRow>
            </SettingCard>

            <SettingCard icon={RefreshCw} title="Live Updates" description="Controls backend refresh cadence.">
              <CompactRow label="Auto-refresh" description="Pause or resume realtime updates.">
                <Switch
                  checked={settings.display.autoRefresh}
                  disabled={!canManageSettings}
                  onCheckedChange={(checked) => updateDisplay({ autoRefresh: checked })}
                />
              </CompactRow>
              <CompactRow label="Interval" description="Used by AppContext update loop.">
                <Select
                  value={settings.display.refreshInterval.toString()}
                  disabled={!canManageSettings || !settings.display.autoRefresh}
                  onValueChange={(value) => updateDisplay({ refreshInterval: parseInt(value, 10) })}
                >
                  <SelectTrigger className="h-9 w-full sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border/70">
                    <SelectItem value="1">1 sec</SelectItem>
                    <SelectItem value="5">5 sec</SelectItem>
                    <SelectItem value="10">10 sec</SelectItem>
                    <SelectItem value="30">30 sec</SelectItem>
                  </SelectContent>
                </Select>
              </CompactRow>
            </SettingCard>

            <SettingCard icon={Ruler} title="Units" description="Dashboard depth and ROP display units.">
              <CompactRow label="Unit system" description="Shared formatting preference.">
                <Select
                  value={settings.units}
                  disabled={!canManageSettings}
                  onValueChange={(value) => updateSettings({ units: value as "metric" | "imperial" })}
                >
                  <SelectTrigger className="h-9 w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border/70">
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="imperial">Imperial</SelectItem>
                  </SelectContent>
                </Select>
              </CompactRow>
            </SettingCard>
          </div>
        </TabsContent>

        <TabsContent value="thresholds" className="mt-0">
          <Card className="p-3 sm:p-4">
            <div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold sm:text-base">Parameter Thresholds</h3>
                <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
                  Backend WITS alarm limits with structured defaults used only when backend values are missing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refreshWitsConfig()}
                  disabled={witsConfigLoading || thresholdsSaving}
                  className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                >
                  <RefreshCw className="mr-2 size-3.5" />
                  Refresh
                </Button>
                {canManageSettings ? (
                  <Button
                    size="sm"
                    onClick={() => void handleSaveThresholds()}
                    disabled={witsConfigLoading || thresholdsSaving || changedThresholdGroups.length === 0}
                    className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                  >
                    {thresholdsSaving ? "Saving..." : `Save${changedThresholdGroups.length ? ` (${changedThresholdGroups.length})` : ""}`}
                  </Button>
                ) : null}
              </div>
            </div>
            {!canManageSettings ? (
              <div className="mb-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-900 sm:mb-3 sm:rounded-xl sm:px-3 sm:text-sm">
                Operator role can view backend-driven thresholds but cannot change operational settings.
              </div>
            ) : null}

            <div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={thresholdSearch}
                  onChange={(event) => setThresholdSearch(event.target.value)}
                  placeholder="Search thresholds by name, unit, tag, or WITS ID"
                  className="h-9 !pl-10 pr-3 text-sm sm:!pl-10"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {visibleThresholdGroups.length} of {thresholdCardCount} groups
                {totalGroupedThresholdMembers > 0 ? ` (${rawThresholdRowCount} WITS rows)` : ""}
              </div>
            </div>

            {witsConfigLoading ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground sm:rounded-xl sm:p-4 sm:text-sm">
                Loading WITS parameter thresholds...
              </div>
            ) : witsConfigError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive sm:rounded-xl sm:p-4 sm:text-sm">
                {witsConfigError}
              </div>
            ) : thresholdGroups.length === 0 ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground sm:rounded-xl sm:p-4 sm:text-sm">
                No WITS config rows were returned by /api/wits-config.
              </div>
            ) : visibleThresholdGroups.length === 0 ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground sm:rounded-xl sm:p-4 sm:text-sm">
                No threshold parameters match {thresholdSearch}.
              </div>
            ) : (
              <div className="grid gap-2 min-[420px]:grid-cols-2 sm:gap-3 2xl:grid-cols-4">
                {visibleThresholdGroups.map((group) => {
                  const draft = getThresholdDraft(group);
                  const resolvedSources = getGroupResolvedSources(group);
                  const memberWitsIds = getGroupMemberWitsIds(group);
                  const visibleWitsIds = memberWitsIds.slice(0, 6);
                  const hiddenWitsIdCount = Math.max(0, memberWitsIds.length - visibleWitsIds.length);
                  const readOnly = getGroupReadOnly(group);
                  const readOnlyCount = group.configs.filter(isGeneratedConfigId).length;
                  const decimalLabels = Array.from(
                    new Set(
                      group.configs
                        .map((config) => config.decimalPlaces)
                        .filter((value): value is number => value !== undefined)
                    )
                  );
                  const decimalLabel = decimalLabels.length === 0 ? null : decimalLabels.length === 1 ? decimalLabels[0] : "Mixed";

                  return (
                    <div key={group.key} className="rounded-lg border border-border/80 bg-background/70 p-2.5 sm:rounded-xl sm:p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <Label className="text-xs font-medium sm:text-sm">{group.label}</Label>
                          <div className="truncate text-xs text-muted-foreground">
                            {group.unit} | {group.configs.length} WITS ID{group.configs.length > 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground sm:px-2 sm:text-[10px]">
                            {group.mappedField || group.category}
                          </span>
                          <Switch
                            checked={draft.alarmEnabled}
                            disabled={!canManageSettings || thresholdsSaving || readOnly}
                            onCheckedChange={(alarmEnabled) => patchThreshold(group.key, { alarmEnabled })}
                          />
                        </div>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1">
                        {visibleWitsIds.map((witsId) => (
                          <span key={witsId} className="rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            WITS {witsId}
                          </span>
                        ))}
                        {hiddenWitsIdCount > 0 ? (
                          <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{hiddenWitsIdCount} more
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ThresholdInput
                          label="Low"
                          value={draft.alarmLow}
                          disabled={!canManageSettings || thresholdsSaving || readOnly}
                          onChange={(alarmLow) => patchThreshold(group.key, { alarmLow })}
                        />
                        <ThresholdInput
                          label="High"
                          value={draft.alarmHigh}
                          disabled={!canManageSettings || thresholdsSaving || readOnly}
                          onChange={(alarmHigh) => patchThreshold(group.key, { alarmHigh })}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-tight text-muted-foreground">
                        <span>Scale {getGroupScaleLabel(group)}</span>
                        {decimalLabel !== null ? <span>Decimals {decimalLabel}</span> : null}
                        <span>Low {resolvedSources.low}</span>
                        <span>High {resolvedSources.high}</span>
                        {readOnly ? <span>Read-only: missing backend id</span> : null}
                        {!readOnly && readOnlyCount > 0 ? <span>{readOnlyCount} read-only member(s) skipped on save</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <Card className="p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
              <div>
                <h3 className="text-sm font-semibold sm:text-base">Notifications</h3>
                <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
                  Connection, failover, health, and system events generated from current backend/status state.
                </p>
              </div>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
                {notificationEvents.length} events
              </Badge>
            </div>
            {notificationEvents.length === 0 ? (
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground sm:rounded-xl sm:p-4 sm:text-sm">
                Belum ada notification event. Connection or health issues will appear here when detected.
              </div>
            ) : (
              <div className="space-y-2">
                {notificationEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border/70 bg-background/70 p-2.5 sm:rounded-xl sm:p-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-sm font-medium leading-snug sm:text-base">{event.message}</span>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">{event.type}</Badge>
                      <Badge variant={event.severity === "critical" ? "destructive" : "secondary"} className="h-5 px-1.5 text-[10px] sm:h-6 sm:px-2 sm:text-xs">
                        {event.severity}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {event.timestamp.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="system-health" className="mt-0">
          <SystemHealthPanel
            mode="settings"
            title="System Health"
            description="Read-only connection health for user troubleshooting. No admin actions are exposed here."
            backendReachability={backendReachability}
            onRefreshBackendReachability={refreshBackendReachability}
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (onNavigate) {
    return content;
  }

  const handleRouteNavigate = (page: AppPage) => {
    router.push(getAppPagePath(page));
  };

  return (
    <AppLayout currentPage="settings" onNavigate={handleRouteNavigate}>
      {content}
    </AppLayout>
  );
};

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/70 px-2 py-1.5 sm:rounded-xl sm:px-3 sm:py-2">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">{label}</div>
      <div className="truncate text-xs font-medium capitalize text-foreground sm:text-sm">{value}</div>
    </div>
  );
}

function SettingCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-2 flex min-w-0 items-start gap-2 sm:mb-3 sm:gap-3">
        <div className="rounded-md bg-primary/10 p-1.5 text-primary sm:rounded-lg sm:p-2">
          <Icon className="size-3.5 sm:size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
          <p className="break-words text-xs leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-2 sm:space-y-3">{children}</div>
    </Card>
  );
}

function CompactRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:p-3">
      <div className="min-w-0">
        <Label className="text-xs sm:text-sm">{label}</Label>
        <p className="break-words text-xs leading-snug text-muted-foreground">{description}</p>
      </div>
      <div className="w-full shrink-0 sm:w-auto">{children}</div>
    </div>
  );
}

function ThresholdInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 text-sm sm:h-9"
      />
    </div>
  );
}

function NotificationCard({
  title,
  description,
  defaultChecked = false,
  disabled = false,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="min-w-0">
        <Label className="text-sm">{title}</Label>
        <p className="break-words text-xs leading-snug text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} disabled={disabled} />
    </Card>
  );
}

export default SettingsPage;
