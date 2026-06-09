UPDATE "Plot_Template"
SET
  "config" = $$
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
      "headerHeightFirstPage": 126,
      "headerHeightOtherPages": 18,
      "trackHeaderHeight": 172
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
      {
        "title": "Pressure",
        "min": 0,
        "max": 4000,
        "curves": [
          { "key": "annularPressure", "label": "Pressure - Annular", "unit": "psi", "min": 0, "max": 4000, "color": "#008000" },
          { "key": "borePressure", "label": "Pressure - Bore", "unit": "psi", "min": 0, "max": 4000, "color": "#1f77b4" },
          { "key": "standpipePressure", "label": "Pump Press", "unit": "PSI", "min": 0, "max": 4000, "color": "#ff7f0e" },
          { "key": "mwdPressure", "label": "APWD - memory", "unit": "", "min": 0, "max": 4000, "color": "#2ca02c" }
        ]
      },
      {
        "title": "Density Depth",
        "min": 0,
        "max": 2000,
        "curves": [
          { "key": "mudWeight", "label": "Mud Weight (SG)", "unit": "SG", "min": 0, "max": 2, "color": "#8c564b" },
          { "key": "ecd", "label": "ECD from Annular Pressure - SG", "unit": "SG", "min": 0, "max": 2, "color": "#9467bd" },
          { "key": "depthMd", "label": "Hole Depth", "unit": "m", "min": 0, "max": 2000, "color": "#111111" },
          { "key": "ecd2", "label": "ECD - calc from memory", "unit": "", "min": 0, "max": 2, "color": "#17becf" }
        ]
      },
      {
        "title": "Dynamics",
        "min": 0,
        "max": 100,
        "curves": [
          { "key": "shockAxial", "label": "Shock (ax,lat)", "unit": "g", "min": 0, "max": 90, "color": "#d62728" },
          { "key": "vibrationAxial", "label": "Vib (ax,lat)", "unit": "g", "min": 0, "max": 25, "color": "#2ca02c" },
          { "key": "ssi", "label": "SSI", "unit": "", "min": 0, "max": 5, "color": "#17becf" },
          { "key": "downholeRpm", "label": "RPM Downhole", "unit": "rpm", "min": 0, "max": 100, "color": "#bcbd22" },
          { "key": "temperature", "label": "Temp", "unit": "C", "min": 0, "max": 100, "color": "#e377c2" }
        ]
      },
      {
        "title": "Surface",
        "min": 0,
        "max": 30,
        "curves": [
          { "key": "rop", "label": "ROP", "unit": "", "min": 0, "max": 10, "color": "#7f7f7f" },
          { "key": "hookLoad", "label": "WOB", "unit": "klbs", "min": 0, "max": 20, "color": "#aec7e8" },
          { "key": "hookPosition", "label": "hookpos", "unit": "m", "min": 0, "max": 30, "color": "#ff7f0e" }
        ]
      }
    ]
  }
  $$::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'MWD MD 1:500';
