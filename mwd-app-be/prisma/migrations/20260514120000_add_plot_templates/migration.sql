CREATE TABLE "Plot_Template" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "config" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plot_Template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plot_Template_name_key" ON "Plot_Template"("name");
CREATE INDEX "Plot_Template_isDefault_idx" ON "Plot_Template"("isDefault");

INSERT INTO "Plot_Template" ("name", "description", "config", "isDefault", "updatedAt")
VALUES (
  'MWD MD 1:500',
  'Default MWD log plot template based on MD 1:500 layout',
  $$
  {
    "title": "MD 1:500",
    "scaleRatio": 500,
    "depthPerPage": 150,
    "depthStep": 50,
    "minorDepthStep": 10,
    "page": {
      "size": "a4",
      "orientation": "portrait",
      "marginTop": 28,
      "marginRight": 22,
      "marginBottom": 24,
      "marginLeft": 24,
      "headerHeightFirstPage": 132,
      "headerHeightOtherPages": 38,
      "trackHeaderHeight": 78
    },
    "headerFields": [
      { "label": "Company", "value": "" },
      { "label": "Well Name", "source": "wellName" },
      { "label": "Field", "value": "" },
      { "label": "Rig Id", "source": "rigName" },
      { "label": "Well ID", "value": "" },
      { "label": "Job number", "value": "" },
      { "label": "Province", "value": "" },
      { "label": "County/Parish", "value": "" },
      { "label": "Country", "value": "" },
      { "label": "Location", "value": "" },
      { "label": "Start Date", "value": "" },
      { "label": "End Date", "value": "" }
    ],
    "tracks": [
      { "title": "Pressure - Annular", "unit": "psi", "min": 0, "max": 4000, "curves": [{ "key": "annularPressure", "label": "Pressure - Annular", "color": "#008000" }] },
      { "title": "Pressure - Bore", "unit": "psi", "min": 0, "max": 4000, "curves": [{ "key": "borePressure", "label": "Pressure - Bore", "color": "#1f77b4" }] },
      { "title": "Pump Press", "unit": "PSI", "min": 0, "max": 4000, "curves": [{ "key": "standpipePressure", "label": "Pump Press", "color": "#ff7f0e" }] },
      { "title": "Mud Weight (SG)", "unit": "SG", "min": 0, "max": 2, "curves": [{ "key": "mudWeight", "label": "Mud Weight", "color": "#8c564b" }] },
      { "title": "ECD", "unit": "SG", "min": 0, "max": 2, "curves": [{ "key": "ecd", "label": "ECD", "color": "#9467bd" }] },
      { "title": "Hole Depth", "unit": "m", "min": 0, "max": 2000, "curves": [{ "key": "depthMd", "label": "Hole Depth", "color": "#111111" }] },
      { "title": "Shock (ax,lat)", "unit": "g", "min": 0, "max": 90, "curves": [{ "key": "shockAxial", "label": "Shock Axial", "color": "#d62728" }, { "key": "shockLateral", "label": "Shock Lateral", "color": "#ff9896" }] },
      { "title": "Vib (ax,lat)", "unit": "g", "min": 0, "max": 25, "curves": [{ "key": "vibrationAxial", "label": "Vib Axial", "color": "#2ca02c" }, { "key": "vibrationLateral", "label": "Vib Lateral", "color": "#98df8a" }] },
      { "title": "SSI", "unit": "", "min": 0, "max": 5, "curves": [{ "key": "ssi", "label": "SSI", "color": "#17becf" }] },
      { "title": "RPM Downhole", "unit": "rpm", "min": 0, "max": 100, "curves": [{ "key": "downholeRpm", "label": "RPM Downhole", "color": "#bcbd22" }] },
      { "title": "Temp", "unit": "C", "min": 0, "max": 100, "curves": [{ "key": "temperature", "label": "Temp", "color": "#e377c2" }] },
      { "title": "ROP", "unit": "", "min": 0, "max": 10, "curves": [{ "key": "rop", "label": "ROP", "color": "#7f7f7f" }] },
      { "title": "WOB", "unit": "klbs", "min": 0, "max": 20, "curves": [{ "key": "hookLoad", "label": "WOB", "color": "#aec7e8" }] },
      { "title": "hookpos", "unit": "m", "min": 0, "max": 30, "curves": [{ "key": "hookPosition", "label": "hookpos", "color": "#ffbb78" }] }
    ]
  }
  $$::jsonb,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "config" = EXCLUDED."config",
  "isDefault" = EXCLUDED."isDefault",
  "updatedAt" = CURRENT_TIMESTAMP;
