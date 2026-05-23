"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
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
import { Bell, Eye, Gauge, RefreshCw, Ruler } from "lucide-react";
import { toast } from "sonner";
import { ThresholdSettings } from "@/types";
import {
  dashboardThresholdDefinitions,
  mergeDashboardThresholds,
} from "@/lib/dashboard-thresholds";

export const SettingsPage: React.FC<{
  onNavigate?: (page: AppPage) => void;
}> = ({ onNavigate }) => {
  const router = useRouter();
  const { settings, updateSettings } = useApp();

  const defaultThresholds = useMemo<ThresholdSettings[]>(
    () => mergeDashboardThresholds(settings.thresholds),
    [settings.thresholds]
  );

  const [thresholdDrafts, setThresholdDrafts] = useState<ThresholdSettings[]>(
    defaultThresholds
  );

  const thresholdRows = thresholdDrafts
    .map((threshold) => {
      const parameter = dashboardThresholdDefinitions.find((item) => item.key === threshold.parameter);
      return parameter ? { threshold, parameter } : null;
    })
    .filter((row): row is { threshold: ThresholdSettings; parameter: (typeof dashboardThresholdDefinitions)[number] } => Boolean(row));

  const patchThreshold = (
    parameter: string,
    patch: Partial<ThresholdSettings>
  ) => {
    setThresholdDrafts((current) =>
      current.map((threshold) =>
        threshold.parameter === parameter ? { ...threshold, ...patch } : threshold
      )
    );
  };

  const handleSaveThresholds = () => {
    updateSettings({ thresholds: thresholdDrafts });
    toast.success("Thresholds synced to dashboard alarms");
  };

  const updateDisplay = (display: Partial<typeof settings.display>) => {
    updateSettings({ display: { ...settings.display, ...display } });
  };

  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Shared dashboard preferences, alarm thresholds, and session behavior.
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
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <div className="grid gap-3 lg:grid-cols-3">
            <SettingCard icon={Eye} title="Display" description="Dashboard spacing and theme behavior.">
              <CompactRow label="Density" description="Affects dashboard card count and spacing.">
                <Select
                  value={settings.display.density}
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

            <SettingCard icon={RefreshCw} title="Live Updates" description="Controls dashboard realtime mock stream.">
              <CompactRow label="Auto-refresh" description="Pause or resume realtime updates.">
                <Switch
                  checked={settings.display.autoRefresh}
                  onCheckedChange={(checked) => updateDisplay({ autoRefresh: checked })}
                />
              </CompactRow>
              <CompactRow label="Interval" description="Used by AppContext update loop.">
                <Select
                  value={settings.display.refreshInterval.toString()}
                  disabled={!settings.display.autoRefresh}
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
                  Saved low/high ranges feed Main Dashboard card status and AppContext KPI status.
                </p>
              </div>
              <Button size="sm" onClick={handleSaveThresholds}>
                Save Thresholds
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {thresholdRows.map(({ threshold, parameter }) => (
                <div key={threshold.parameter} className="rounded-xl border border-border/80 bg-background/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm font-medium">{parameter.label}</Label>
                      <div className="text-xs text-muted-foreground">{parameter.unit}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {parameter.category}
                      </span>
                      <Switch
                        checked={threshold.enabled ?? true}
                        onCheckedChange={(enabled) => patchThreshold(threshold.parameter, { enabled })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ThresholdInput
                      label="Low"
                      value={threshold.low ?? 0}
                      onChange={(value) =>
                        patchThreshold(threshold.parameter, {
                          low: value,
                          warning: threshold.high ?? threshold.warning,
                        })
                      }
                    />
                    <ThresholdInput
                      label="High"
                      value={threshold.high ?? 0}
                      onChange={(value) =>
                        patchThreshold(threshold.parameter, {
                          high: value,
                          warning: value,
                          critical: value,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <NotificationCard
              title="Browser Notifications"
              description="Placeholder toggle for critical alarm browser notifications."
              defaultChecked
            />
            <NotificationCard
              title="Sound Alerts"
              description="Placeholder toggle for critical alarm sounds."
              defaultChecked
            />
            <NotificationCard
              title="Email Alerts"
              description="Placeholder until SMTP/alarm delivery is wired."
            />
          </div>
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
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
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </Card>
  );
}

export default SettingsPage;
