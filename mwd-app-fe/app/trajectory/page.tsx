"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Download, Maximize2, RefreshCw, Target } from "lucide-react";
import {
  CartesianGrid,
  Legend,
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
import { getSurveys } from "@/lib/surveys-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TrajectoryData, TrajectoryPoint } from "@/types";
import type { SurveyRecord } from "@/types/monitoring";

function surveyToTrajectoryPoint(survey: SurveyRecord): TrajectoryPoint {
  return {
    md: survey.md,
    tvd: survey.tvd,
    inclination: survey.inc,
    azimuth: survey.azm,
    northing: survey.ns,
    easting: survey.ew,
  };
}

function formatValue(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

export const TrajectoryPage: React.FC = () => {
  const { token } = useAuth();
  const { activeMwdSessionId } = useApp();
  const [view, setView] = useState<"vertical" | "plan" | "3d">("vertical");
  const [depthSlider, setDepthSlider] = useState(100);
  const [actualSurveys, setActualSurveys] = useState<SurveyRecord[]>([]);
  const [plannedSurveys, setPlannedSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (nextError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to load trajectory surveys.", nextError);
      }
      setActualSurveys([]);
      setPlannedSurveys([]);
      setError("Gagal memuat data dari backend.");
    } finally {
      setLoading(false);
    }
  }, [activeMwdSessionId, token]);

  useEffect(() => {
    void loadTrajectory();
  }, [loadTrajectory]);

  const trajectoryData = useMemo<TrajectoryData>(
    () => ({
      actual: actualSurveys.map(surveyToTrajectoryPoint),
      planned: plannedSurveys.map(surveyToTrajectoryPoint),
    }),
    [actualSurveys, plannedSurveys]
  );

  const hasActualTrajectory = trajectoryData.actual.length > 0;
  const currentDepthIndex = hasActualTrajectory
    ? Math.min(Math.floor((depthSlider / 100) * (trajectoryData.actual.length - 1)), trajectoryData.actual.length - 1)
    : 0;
  const visiblePlanned = trajectoryData.planned.slice(0, Math.min(currentDepthIndex + 1, trajectoryData.planned.length));
  const visibleActual = trajectoryData.actual.slice(0, currentDepthIndex + 1);
  const currentActual = trajectoryData.actual[currentDepthIndex];
  const currentPlanned = trajectoryData.planned[Math.min(currentDepthIndex, Math.max(trajectoryData.planned.length - 1, 0))];

  const crossTrackError =
    currentActual && currentPlanned
      ? Math.sqrt((currentActual.northing - currentPlanned.northing) ** 2 + (currentActual.easting - currentPlanned.easting) ** 2)
      : null;
  const deltaTVD = currentActual && currentPlanned ? Math.abs(currentActual.tvd - currentPlanned.tvd) : null;
  const deltaInc = currentActual && currentPlanned ? Math.abs(currentActual.inclination - currentPlanned.inclination) : null;
  const deltaAzi = currentActual && currentPlanned ? Math.abs(currentActual.azimuth - currentPlanned.azimuth) : null;

  const planViewData = {
    planned: visiblePlanned.map((point) => ({ x: point.easting, y: point.northing, md: point.md })),
    actual: visibleActual.map((point) => ({ x: point.easting, y: point.northing, md: point.md })),
  };

  const handleSnapshot = () => toast.message("Endpoint backend untuk fitur ini belum tersedia.");
  const handleExport = () => toast.message("Endpoint backend untuk fitur ini belum tersedia.");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Trajectory Analysis</h1>
          <p className="text-muted-foreground">Planned vs actual trajectory from backend surveys.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/trajectory/well-plot">Well Plots</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadTrajectory()} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={handleSnapshot}>
            <Camera className="mr-2 size-4" />
            Snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
        </div>
      </div>

      {!activeMwdSessionId ? (
        <Card className="p-6 text-sm text-muted-foreground">Pilih job/session sebelum membuka trajectory.</Card>
      ) : error ? (
        <Card className="space-y-3 border-destructive/40 p-6">
          <div className="font-semibold text-destructive">Gagal memuat data dari backend.</div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void loadTrajectory()}>Retry</Button>
        </Card>
      ) : loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading trajectory survey...</Card>
      ) : !hasActualTrajectory ? (
        <Card className="p-6 text-sm text-muted-foreground">Belum ada survey untuk session ini.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
            <MetricCard label="Current MD" value={formatValue(currentActual.md)} unit="m" />
            <MetricCard label="Current TVD" value={formatValue(currentActual.tvd)} unit="m" />
            <MetricCard label="Inclination" value={formatValue(currentActual.inclination)} unit="deg" />
            <MetricCard label="Azimuth" value={formatValue(currentActual.azimuth)} unit="deg" />
            <MetricCard label="Cross-track Error" value={crossTrackError === null ? "-" : formatValue(crossTrackError, 2)} unit="m" />
            <MetricCard label="Delta TVD" value={deltaTVD === null ? "-" : formatValue(deltaTVD, 2)} unit="m" />
            <MetricCard label="Delta Inc" value={deltaInc === null ? "-" : formatValue(deltaInc, 2)} unit="deg" />
            <MetricCard label="Delta Azi" value={deltaAzi === null ? "-" : formatValue(deltaAzi, 2)} unit="deg" />
          </div>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Depth Position</h3>
                <p className="text-sm text-muted-foreground">Slide to view backend trajectory at different survey stations.</p>
              </div>
              <Badge variant="secondary" className="text-sm">{formatValue(currentActual.md)} m MD</Badge>
            </div>
            <Slider value={[depthSlider]} onValueChange={(value) => setDepthSlider(value[0] ?? 100)} max={100} step={1} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Start</span>
              <span>Current: {depthSlider}%</span>
              <span>Last: {formatValue(trajectoryData.actual.at(-1)?.md ?? currentActual.md, 0)} m</span>
            </div>
          </Card>

          <Tabs value={view} onValueChange={(value) => setView(value as "vertical" | "plan" )}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vertical">Vertical Section</TabsTrigger>
              <TabsTrigger value="plan">Plan View</TabsTrigger>
            </TabsList>

            <TabsContent value="vertical" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
                <VerticalTrajectory data={trajectoryData} currentDepthPercent={depthSlider} height={600} />
                <Card className="p-6">
                  <h3 className="mb-4 font-semibold">Survey Summary</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricTile label="Actual stations" value={String(trajectoryData.actual.length)} />
                    <MetricTile label="Plan stations" value={String(trajectoryData.planned.length)} />
                    <MetricTile label="First actual MD" value={`${formatValue(trajectoryData.actual[0]?.md ?? 0)} m`} />
                    <MetricTile label="Last actual MD" value={`${formatValue(trajectoryData.actual.at(-1)?.md ?? 0)} m`} />
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="plan" className="mt-6">
              <Card className="p-6">
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" dataKey="x" name="Easting" label={{ value: "Easting (m)", position: "bottom" }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="number" dataKey="y" name="Northing" label={{ value: "Northing (m)", angle: -90, position: "left" }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(2)} m`, name]} />
                    <Legend />
                    <Scatter name="Planned Path" data={planViewData.planned} fill="#3b82f6" line={{ stroke: "#3b82f6", strokeWidth: 2 }} />
                    <Scatter name="Actual Path" data={planViewData.actual} fill="#10b981" line={{ stroke: "#10b981", strokeWidth: 2 }} />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>

            <TabsContent value="3d" className="mt-6">
              <Card className="p-6">
                <div className="flex h-[500px] flex-col items-center justify-center text-center">
                  <Maximize2 className="mb-4 size-16 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold">3D Visualization</h3>
                  <p className="max-w-md text-sm text-muted-foreground">Endpoint backend untuk fitur ini belum tersedia.</p>
                  <Button variant="outline" className="mt-4" disabled>
                    <Target className="mr-2 size-4" />
                    Load 3D Viewer
                  </Button>
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
    <Card className="p-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold font-mono">{value}</div>
      <div className="text-xs text-muted-foreground">{unit}</div>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

export default TrajectoryPage;
