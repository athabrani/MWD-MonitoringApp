"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { VerticalTrajectory } from "@/components/contents/trajectory/vertical-trajectory";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { createSurveysFromMwdData, getSurveys } from "@/lib/surveys-api";
import { logSecurityDebug, logSecurityError } from "@/lib/security/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TrajectoryData, TrajectoryPoint } from "@/types";
import type { SurveyRecord } from "@/types/monitoring";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function sortSurveysByMd(surveys: SurveyRecord[]) {
  return [...surveys].sort((left, right) => left.md - right.md);
}

function hasBackendGeometry(surveys: SurveyRecord[]) {
  return surveys.some((survey, index) => {
    if (index === 0) return false;
    return Math.abs(survey.tvd) > 0 || Math.abs(survey.ns) > 0 || Math.abs(survey.ew) > 0;
  });
}

function surveysToTrajectoryPoints(surveys: SurveyRecord[]): TrajectoryPoint[] {
  const sortedSurveys = sortSurveysByMd(surveys);

  if (hasBackendGeometry(sortedSurveys)) {
    return sortedSurveys.map((survey) => ({
      md: survey.md,
      tvd: survey.tvd,
      inclination: survey.inc,
      azimuth: survey.azm,
      northing: survey.ns,
      easting: survey.ew,
    }));
  }

  let tvd = 0;
  let northing = 0;
  let easting = 0;
  let previousSurvey: SurveyRecord | null = null;

  return sortedSurveys.map((survey) => {
    if (previousSurvey) {
      const deltaMd = Math.max(survey.md - previousSurvey.md, 0);
      const averageInc = toRadians((previousSurvey.inc + survey.inc) / 2);
      const averageAzm = toRadians((previousSurvey.azm + survey.azm) / 2);

      tvd += deltaMd * Math.cos(averageInc);
      northing += deltaMd * Math.sin(averageInc) * Math.cos(averageAzm);
      easting += deltaMd * Math.sin(averageInc) * Math.sin(averageAzm);
    }

    previousSurvey = survey;

    return {
      md: survey.md,
      tvd,
      inclination: survey.inc,
      azimuth: survey.azm,
      northing,
      easting,
    };
  });
}

function formatValue(value?: number | null, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function getCurrentPoint(points: TrajectoryPoint[], depthSlider: number) {
  if (points.length === 0) return undefined;
  const index = Math.min(
    Math.floor((depthSlider / 100) * Math.max(points.length - 1, 0)),
    Math.max(points.length - 1, 0)
  );
  return points[index];
}

function getClosestByMd(points: TrajectoryPoint[], md?: number) {
  if (points.length === 0 || typeof md !== "number") return undefined;

  return points.reduce((closest, point) =>
    Math.abs(point.md - md) < Math.abs(closest.md - md) ? point : closest
  );
}

type TrajectoryPageProps = {
  onNavigate?: (page: "trajectory-well-plot") => void;
};

export const TrajectoryPage: React.FC<TrajectoryPageProps> = ({ onNavigate }) => {
  const router = useRouter();
  const { token, user } = useAuth();
  const { activeMwdSessionId, activeMwdSession } = useApp();
  const [view, setView] = useState<"vertical" | "plan">("vertical");
  const [depthSlider, setDepthSlider] = useState(100);
  const [actualSurveys, setActualSurveys] = useState<SurveyRecord[]>([]);
  const [plannedSurveys, setPlannedSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingActual, setGeneratingActual] = useState(false);
  const [error, setError] = useState("");
  const canGenerateActual = user?.role === "admin" || user?.role === "engineer";

  const loadTrajectory = useCallback(async () => {
    if (!token || !activeMwdSessionId) {
      setActualSurveys([]);
      setPlannedSurveys([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [actual, plan] = await Promise.all([
        getSurveys(token, { sessionId: activeMwdSessionId, stationType: "actual" }),
        getSurveys(token, { sessionId: activeMwdSessionId, stationType: "plan" }),
      ]);

      setActualSurveys(actual);
      setPlannedSurveys(plan);

      logSecurityDebug("[Trajectory Analysis] survey load", {
        sessionId: activeMwdSessionId,
        actualCount: actual.length,
        plannedCount: plan.length,
        actualSample: actual[0] ?? null,
        plannedSample: plan[0] ?? null,
      });
    } catch (nextError) {
      logSecurityError("Unable to load trajectory surveys.", nextError);
      setActualSurveys([]);
      setPlannedSurveys([]);
      setError("Gagal memuat survey trajectory dari backend.");
    } finally {
      setLoading(false);
    }
  }, [activeMwdSessionId, token]);

  useEffect(() => {
    void loadTrajectory();
  }, [loadTrajectory]);

  const trajectoryData = useMemo<TrajectoryData>(
    () => ({
      actual: surveysToTrajectoryPoints(actualSurveys),
      planned: surveysToTrajectoryPoints(plannedSurveys),
    }),
    [actualSurveys, plannedSurveys]
  );

  const hasActualTrajectory = trajectoryData.actual.length > 0;
  const hasPlannedTrajectory = trajectoryData.planned.length > 0;
  const hasTrajectory = hasActualTrajectory || hasPlannedTrajectory;
  const referenceSeries = hasActualTrajectory ? trajectoryData.actual : trajectoryData.planned;
  const currentReference = getCurrentPoint(referenceSeries, depthSlider);
  const currentActual = getClosestByMd(trajectoryData.actual, currentReference?.md);
  const currentPlanned = getClosestByMd(trajectoryData.planned, currentReference?.md);

  const crossTrackError =
    currentActual && currentPlanned
      ? Math.sqrt((currentActual.northing - currentPlanned.northing) ** 2 + (currentActual.easting - currentPlanned.easting) ** 2)
      : null;
  const deltaTVD = currentActual && currentPlanned ? Math.abs(currentActual.tvd - currentPlanned.tvd) : null;

  const planViewData = {
    planned: trajectoryData.planned.map((point) => ({ x: point.easting, y: point.northing, md: point.md })),
    actual: trajectoryData.actual.map((point) => ({ x: point.easting, y: point.northing, md: point.md })),
  };

  const handleSnapshot = async () => {
    if (!hasTrajectory) {
      toast.warning("Tidak ada trajectory untuk disnapshot.");
      return;
    }

    const snapshot = [
      `Trajectory Analysis Snapshot`,
      `Session: ${activeMwdSession?.name ?? activeMwdSession?.wellName ?? activeMwdSessionId}`,
      `Actual stations: ${actualSurveys.length}`,
      `Planned stations: ${plannedSurveys.length}`,
      `Current MD: ${formatValue(currentReference?.md)} m`,
      `Cross-track error: ${crossTrackError === null ? "-" : `${formatValue(crossTrackError, 2)} m`}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(snapshot);
      toast.success("Trajectory snapshot copied to clipboard.");
    } catch {
      toast.message(snapshot);
    }
  };

  const openWellPlots = () => {
    if (onNavigate) {
      onNavigate("trajectory-well-plot");
      return;
    }

    router.push("/trajectory/well-plot");
  };

  const handleGenerateActual = async () => {
    if (!token || !activeMwdSessionId || !canGenerateActual) return;

    setGeneratingActual(true);
    setError("");

    try {
      const generated = await createSurveysFromMwdData(token, {
        sessionId: activeMwdSessionId,
        stationType: "actual",
      });
      setActualSurveys(generated);
      toast.success(`Generated ${generated.length} actual survey station${generated.length === 1 ? "" : "s"} from MWD data.`);
      await loadTrajectory();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to generate actual surveys from MWD data.";
      setError(message);
      toast.error("Unable to generate actual surveys", { description: message });
    } finally {
      setGeneratingActual(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:gap-4 sm:pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Trajectory Analysis</h1>
          <p className="mt-1 max-w-3xl text-sm leading-snug text-muted-foreground sm:text-base sm:leading-normal">
            Planned and actual trajectory from session surveys. Source: GET /api/surveys by active session.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openWellPlots}>
            Well Plots
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadTrajectory()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleSnapshot()} disabled={!hasTrajectory}>
            <Camera className="mr-2 size-4" />
            Snapshot
          </Button>
        </div>
      </div>

      {!activeMwdSessionId ? (
        <Card className="p-6 text-sm text-muted-foreground">Pilih job/session sebelum membuka trajectory.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <MetricCard label="Actual Stations" value={String(actualSurveys.length)} unit="survey" />
            <MetricCard label="Planned Stations" value={String(plannedSurveys.length)} unit="survey" />
            <MetricCard label="Reference MD" value={formatValue(currentReference?.md)} unit="m" />
            <MetricCard label="Cross-track Error" value={crossTrackError === null ? "-" : formatValue(crossTrackError, 2)} unit="m" />
          </div>

          {!hasTrajectory ? (
            <Card className="flex flex-col gap-3 border-dashed p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">No trajectory survey data for this session.</div>
                <p className="mt-1 text-muted-foreground">
                  The analysis layout stays ready; actual and planned series will appear here when surveys are available.
                </p>
              </div>
              {canGenerateActual ? (
                <Button size="sm" onClick={() => void handleGenerateActual()} disabled={generatingActual}>
                  {generatingActual ? "Generating..." : "Generate Actual From MWD"}
                </Button>
              ) : null}
            </Card>
          ) : null}

          {(loading || error || (!hasActualTrajectory && hasTrajectory) || (!hasPlannedTrajectory && hasTrajectory)) ? (
            <Card className="flex flex-col gap-3 border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                {loading ? <p>Loading trajectory survey...</p> : null}
                {!hasActualTrajectory && hasTrajectory ? <p>Actual trajectory is not available for this session.</p> : null}
                {!hasPlannedTrajectory && hasTrajectory ? <p>Planned trajectory is not available for this session.</p> : null}
                {error ? <p className="text-destructive">{error}</p> : null}
              </div>
              {error ? (
                <Button size="sm" variant="outline" onClick={() => void loadTrajectory()} disabled={loading}>
                  Retry
                </Button>
              ) : !hasActualTrajectory && hasTrajectory && canGenerateActual ? (
                <Button size="sm" onClick={() => void handleGenerateActual()} disabled={generatingActual}>
                  {generatingActual ? "Generating..." : "Generate Actual From MWD"}
                </Button>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Depth Position</h3>
                <p className="text-sm text-muted-foreground">Slide through the active trajectory series.</p>
              </div>
              <Badge variant="secondary" className="w-fit text-sm">{formatValue(currentReference?.md)} m MD</Badge>
            </div>
            <Slider value={[depthSlider]} onValueChange={(value) => setDepthSlider(value[0] ?? 100)} max={100} step={1} disabled={!hasTrajectory} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Start</span>
              <span>{depthSlider}%</span>
              <span>Last: {formatValue(referenceSeries.at(-1)?.md, 0)} m</span>
            </div>
          </Card>

          <Tabs value={view} onValueChange={(value) => setView(value as "vertical" | "plan")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vertical">Vertical Section</TabsTrigger>
              <TabsTrigger value="plan">Plan View</TabsTrigger>
            </TabsList>

            <TabsContent value="vertical" className="mt-4 sm:mt-5">
              <div className="grid gap-3 sm:gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                <VerticalTrajectory data={trajectoryData} currentDepthPercent={depthSlider} height={560} />
                <Card className="p-2.5 sm:p-5">
                  <h3 className="mb-2 text-sm font-semibold sm:mb-3 sm:text-base">Trajectory Summary</h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <MetricTile label="First actual MD" value={hasActualTrajectory ? `${formatValue(trajectoryData.actual[0]?.md)} m` : "-"} />
                    <MetricTile label="Last actual MD" value={hasActualTrajectory ? `${formatValue(trajectoryData.actual.at(-1)?.md)} m` : "-"} />
                    <MetricTile label="First plan MD" value={hasPlannedTrajectory ? `${formatValue(trajectoryData.planned[0]?.md)} m` : "-"} />
                    <MetricTile label="Last plan MD" value={hasPlannedTrajectory ? `${formatValue(trajectoryData.planned.at(-1)?.md)} m` : "-"} />
                    <MetricTile label="Delta TVD" value={deltaTVD === null ? "-" : `${formatValue(deltaTVD, 2)} m`} />
                    <MetricTile label="Current Inc / Azi" value={`${formatValue(currentReference?.inclination)} deg / ${formatValue(currentReference?.azimuth)} deg`} />
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="plan" className="mt-5">
              <Card className="p-4 sm:p-5">
                    <div className="mb-4">
                      <h3 className="font-semibold">Plan View</h3>
                      <p className="text-sm text-muted-foreground">Northing vs Easting, rendered from survey trajectory coordinates.</p>
                    </div>
                    <ResponsiveContainer width="100%" height={460}>
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 44, left: 42 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" dataKey="x" name="Easting" label={{ value: "Easting (m)", position: "bottom" }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis type="number" dataKey="y" name="Northing" label={{ value: "Northing (m)", angle: -90, position: "left" }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(2)} m`, name]} />
                        <Scatter name="Planned Path" data={planViewData.planned} fill="#3b82f6" line={{ stroke: "#3b82f6", strokeWidth: 2 }} />
                        <Scatter name="Actual Path" data={planViewData.actual} fill="#10b981" line={{ stroke: "#10b981", strokeWidth: 2 }} />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="h-0.5 w-6 border-t-2 border-dashed border-blue-500" />
                        <span className="text-muted-foreground">Planned Path</span>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="h-0.5 w-6 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">Actual Path</span>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
        </>
      )}
    </div>
  );
};

function MetricCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card className="min-w-0 p-2.5 sm:p-4">
      <div className="truncate text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{label}</div>
      <div className="mt-1 min-w-0 break-words font-mono text-lg font-semibold leading-none sm:text-2xl">{value}</div>
      <div className="mt-1 text-[10px] leading-none text-muted-foreground sm:text-xs">{unit}</div>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 p-2 sm:p-3">
      <div className="truncate text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{label}</div>
      <div className="mt-1 min-w-0 break-words font-mono text-sm font-semibold leading-tight sm:text-lg">{value}</div>
    </div>
  );
}

export default TrajectoryPage;
