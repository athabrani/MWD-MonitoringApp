"use client";

import React from "react";
import { WellPlotPanel } from "@/components/well-plot-panel";

export default function WellPlotPage() {
  return (
    <WellPlotPanel
      showAllTracks
      maxVisibleTracks={4}
      responsiveTrackWindow
    />
  );
}
