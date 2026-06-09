ALTER TABLE "MWD_Data"
ADD COLUMN IF NOT EXISTS "hole_depth" DECIMAL(12,4);

UPDATE "WITS_Config"
SET
  "name" = 'Hole Depth',
  "mappedField" = 'hole_depth',
  "lasTag" = 'HDEPT',
  "enableLogging" = true
WHERE "witsId" = '0110';

UPDATE "Plot_Template"
SET "config" = replace(
  replace(
    "config"::text,
    '"key": "depthMd", "label": "Hole Depth"',
    '"key": "hole_depth", "label": "Hole Depth"'
  ),
  '"key":"depthMd","label":"Hole Depth"',
  '"key":"hole_depth","label":"Hole Depth"'
)::jsonb
WHERE "config"::text LIKE '%"Hole Depth"%';
