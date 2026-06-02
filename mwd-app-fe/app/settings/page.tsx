"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, AppPage, getAppPagePath } from "@/components/layouts/app-layout";
import { Card } from "@/components/ui/card";
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
import { resolveWitsConfigThreshold } from "@/lib/dashboard-thresholds";
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
  } = useApp();

  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, WitsThresholdDraft>>({});
  const [thresholdSearch, setThresholdSearch] = useState("");
  const [thresholdsSaving, setThresholdsSaving] = useState(false);
  const [backendReachability, setBackendReachability] = useState<BackendReachability>({
    status: "checking",
  });
  const canManageSettings = user?.role === "engineer" || user?.role === "admin";

  const thresholdRows = useMemo(
    () =>
      [...witsConfig].sort((left, right) => {
        if (left.numericId !== right.numericId) return left.numericId - right.numericId;
        return left.name.localeCompare(right.name);
      }),
    [witsConfig]
  );

  useEffect(() => {
    setThresholdDrafts(
      Object.fromEntries(
        witsConfig.map((config) => {
          const resolved = resolveWitsConfigThreshold(config, settings.thresholds);

          return [
            config.id,
            {
              alarmEnabled: resolved.enabled,
              alarmLow: resolved.low,
              alarmHigh: resolved.high,
            },
          ];
        })
      )
    );
  }, [settings.thresholds, witsConfig]);

  const getThresholdDraft = (config: PolarisWitsId): WitsThresholdDraft => {
    const resolved = resolveWitsConfigThreshold(config, settings.thresholds);

    return thresholdDrafts[config.id] ?? {
      alarmEnabled: resolved.enabled,
      alarmLow: resolved.low,
      alarmHigh: resolved.high,
    };
  };

  const patchThreshold = (configId: string, patch: Partial<WitsThresholdDraft>) => {
    if (!canManageSettings) {
      toast.warning("Operator role can view settings only.");
      return;
    }

    setThresholdDrafts((current) => ({
      ...current,
      [configId]: {
        ...(current[configId] ?? { alarmEnabled: false, alarmLow: 0, alarmHigh: 0 }),
        ...patch,
      },
    }));
  };

  const isGeneratedConfigId = (config: PolarisWitsId) => config.id.startsWith("wits-");

  const changedThresholdConfigs = thresholdRows.filter((config) => {
    const draft = getThresholdDraft(config);
    const resolved = resolveWitsConfigThreshold(config, settings.thresholds);

    return (
      draft.alarmEnabled !== resolved.enabled ||
      draft.alarmLow !== resolved.low ||
      draft.alarmHigh !== resolved.high
    );
  });

  const normalizedThresholdSearch = thresholdSearch.trim().toLowerCase();
  const visibleThresholdRows = useMemo(() => {
    if (!normalizedThresholdSearch) return thresholdRows;

    return thresholdRows.filter((config) => {
      const witsId = String(config.numericId).padStart(4, "0");
      const searchable = [
        config.name,
        config.units,
        config.mappedField,
        config.dataSourceType,
        config.lasMnemonic,
        config.lasDescription,
        config.realTimePlot,
        config.depthTracking,
        witsId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedThresholdSearch);
    });
  }, [normalizedThresholdSearch, thresholdRows]);

  const handleSaveThresholds = async () => {
    if (!canManageSettings) {
      toast.warning("Operator role can view thresholds only.");
      return;
    }

    if (!token) {
      toast.error("Missing auth token. Please login again.");
      return;
    }

    const persistableConfigs = changedThresholdConfigs.filter((config) => !isGeneratedConfigId(config));
    const skippedConfigs = changedThresholdConfigs.length - persistableConfigs.length;

    if (persistableConfigs.length === 0) {
      toast.info(skippedConfigs > 0 ? "Some WITS config rows do not expose a backend id for update." : "No threshold changes to save.");
      return;
    }

    setThresholdsSaving(true);

    try {
      await Promise.all(
        persistableConfigs.map((config) => {
          const draft = getThresholdDraft(config);
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
          ? `Saved ${persistableConfigs.length} threshold config(s). ${skippedConfigs} row(s) were read-only because backend id is missing.`
          : `Saved ${persistableConfigs.length} threshold config(s).`
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Local UI preferences only. Operational data, WITS runtime config, surveys, alarms, and plot templates come from backend APIs.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:flex">
          <StatusPill label="Density" value={settings.display.density} />
          <StatusPill label="Units" value={settings.units} />
          <StatusPill
            label="Refresh"
            value={settings.display.autoRefresh ? `${settings.display.refreshInterval}s` : "paused"}
          />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="dashboard">
            <Eye className="mr-2 size-4" />
            Dashboard View
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <Gauge className="mr-2 size-4" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="system-health">
            <Activity className="mr-2 size-4" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <div className="grid gap-3 lg:grid-cols-3">
            <SettingCard icon={Eye} title="Display" description="Dashboard spacing and theme behavior.">
              <CompactRow label="Density" description="Affects dashboard card count and spacing.">
                <Select
                  value={settings.display.density}
                  disabled={!canManageSettings}
                  onValueChange={(value) => updateDisplay({ density: value as "compact" | "comfortable" })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="imperial">Imperial</SelectItem>
                  </SelectContent>
                </Select>
              </CompactRow>
            </SettingCard>
          </div>
        </TabsContent>

        <TabsContent value="thresholds" className="mt-0">
          <Card className="p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Parameter Thresholds</h3>
                <p className="text-sm text-muted-foreground">
                  Backend WITS alarm limits with structured defaults used only when backend values are missing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refreshWitsConfig()}
                  disabled={witsConfigLoading || thresholdsSaving}
                >
                  <RefreshCw className="mr-2 size-3.5" />
                  Refresh
                </Button>
                {canManageSettings ? (
                  <Button
                    size="sm"
                    onClick={() => void handleSaveThresholds()}
                    disabled={witsConfigLoading || thresholdsSaving || changedThresholdConfigs.length === 0}
                  >
                    {thresholdsSaving ? "Saving..." : `Save${changedThresholdConfigs.length ? ` (${changedThresholdConfigs.length})` : ""}`}
                  </Button>
                ) : null}
              </div>
            </div>
            {!canManageSettings ? (
              <div className="mb-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Operator role can view backend-driven thresholds but cannot change operational settings.
              </div>
            ) : null}

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={thresholdSearch}
                  onChange={(event) => setThresholdSearch(event.target.value)}
                  placeholder="Search thresholds by name, unit, tag, or WITS ID..."
                  className="pl-9"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {visibleThresholdRows.length} of {thresholdRows.length}
              </div>
            </div>

            {witsConfigLoading ? (
              <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                Loading WITS parameter thresholds...
              </div>
            ) : witsConfigError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {witsConfigError}
              </div>
            ) : thresholdRows.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                No WITS config rows were returned by /api/wits-config.
              </div>
            ) : visibleThresholdRows.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                No threshold parameters match {thresholdSearch}.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {visibleThresholdRows.map((config) => {
                  const draft = getThresholdDraft(config);
                  const resolved = resolveWitsConfigThreshold(config, settings.thresholds);
                  const witsId = String(config.numericId).padStart(4, "0");
                  const label = config.name || config.lasMnemonic || `WITS ${witsId}`;
                  const readOnly = isGeneratedConfigId(config);

                  return (
                    <div key={config.id} className="rounded-xl border border-border/80 bg-background/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <Label className="text-sm font-medium">{label}</Label>
                          <div className="truncate text-xs text-muted-foreground">
                            WITS {witsId} {config.units ? `| ${config.units}` : "| No unit"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {config.mappedField || config.dataSourceType}
                          </span>
                          <Switch
                            checked={draft.alarmEnabled}
                            disabled={!canManageSettings || thresholdsSaving || readOnly}
                            onCheckedChange={(alarmEnabled) => patchThreshold(config.id, { alarmEnabled })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ThresholdInput
                          label="Low"
                          value={draft.alarmLow}
                          disabled={!canManageSettings || thresholdsSaving || readOnly}
                          onChange={(alarmLow) => patchThreshold(config.id, { alarmLow })}
                        />
                        <ThresholdInput
                          label="High"
                          value={draft.alarmHigh}
                          disabled={!canManageSettings || thresholdsSaving || readOnly}
                          onChange={(alarmHigh) => patchThreshold(config.id, { alarmHigh })}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span>Scale {config.leftScale} - {config.rightScale}</span>
                        {config.decimalPlaces !== undefined ? <span>Decimals {config.decimalPlaces}</span> : null}
                        <span>Low {resolved.lowSource}</span>
                        <span>High {resolved.highSource}</span>
                        {readOnly ? <span>Read-only: missing backend id</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <NotificationCard
              title="Browser Notifications"
              description="Placeholder toggle for critical alarm browser notifications."
              defaultChecked
              disabled={!canManageSettings}
            />
            <NotificationCard
              title="Sound Alerts"
              description="Placeholder toggle for critical alarm sounds."
              defaultChecked
              disabled={!canManageSettings}
            />
            <NotificationCard
              title="Email Alerts"
              description="Placeholder until SMTP/alarm delivery is wired."
              disabled={!canManageSettings}
            />
          </div>
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
    <div className="rounded-xl border border-border/80 bg-background/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium capitalize text-foreground">{value}</div>
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
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
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
        className="h-9"
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
    <Card className="flex items-center justify-between gap-3 p-4">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} disabled={disabled} />
    </Card>
  );
}

export default SettingsPage;
