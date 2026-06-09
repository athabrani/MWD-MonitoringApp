ALTER TABLE "MWD_Data"
ADD COLUMN "temperature" DECIMAL(10,4),
ADD COLUMN "downholeRpm" DECIMAL(10,4),
ADD COLUMN "shockAxial" DECIMAL(10,4),
ADD COLUMN "shockLateral" DECIMAL(10,4),
ADD COLUMN "vibrationAxial" DECIMAL(10,4),
ADD COLUMN "vibrationLateral" DECIMAL(10,4),
ADD COLUMN "hookPosition" DECIMAL(12,4),
ADD COLUMN "annularPressure" DECIMAL(10,4),
ADD COLUMN "borePressure" DECIMAL(10,4),
ADD COLUMN "differentialPressure" DECIMAL(10,4),
ADD COLUMN "annularDifferentialPressure" DECIMAL(10,4),
ADD COLUMN "mudWeight" DECIMAL(10,4),
ADD COLUMN "ecd" DECIMAL(10,4),
ADD COLUMN "ecd2" DECIMAL(10,4),
ADD COLUMN "ecdTvd" DECIMAL(10,4),
ADD COLUMN "ssi" DECIMAL(10,4),
ADD COLUMN "tvdCalc" DECIMAL(12,4);

UPDATE "WITS_Config"
SET
  "name" = 'Hook Position',
  "mappedField" = 'hookPosition',
  "lasTag" = 'HKPOS',
  "enableLogging" = true
WHERE "witsId" = '0112';

UPDATE "WITS_Config"
SET
  "name" = 'Differential Pressure',
  "mappedField" = 'differentialPressure',
  "lasTag" = 'DPRES',
  "enableLogging" = true
WHERE "witsId" = '0128';

UPDATE "WITS_Config"
SET
  "name" = 'Temperature',
  "mappedField" = 'temperature',
  "units" = 'C',
  "lasTag" = 'TEMP',
  "enableLogging" = true
WHERE "witsId" = '0140';

UPDATE "WITS_Config"
SET
  "name" = 'Annular Differential Pressure',
  "mappedField" = 'annularDifferentialPressure',
  "lasTag" = 'ADP',
  "enableLogging" = true
WHERE "witsId" = '0722';

UPDATE "WITS_Config"
SET
  "name" = 'Downhole RPM',
  "mappedField" = 'downholeRpm',
  "units" = 'rpm',
  "lasTag" = 'DHRPM',
  "enableLogging" = true
WHERE "witsId" = '0738';

UPDATE "WITS_Config"
SET
  "name" = 'Shock Axial',
  "mappedField" = 'shockAxial',
  "units" = 'g',
  "lasTag" = 'SHKAX',
  "enableLogging" = true
WHERE "witsId" = '0736';

UPDATE "WITS_Config"
SET
  "name" = 'Vibration Axial',
  "mappedField" = 'vibrationAxial',
  "units" = 'g',
  "lasTag" = 'VIBAX',
  "enableLogging" = true
WHERE "witsId" = '0737';

UPDATE "WITS_Config"
SET
  "name" = 'Pressure - Annular',
  "mappedField" = 'annularPressure',
  "lasTag" = 'PANN',
  "enableLogging" = true
WHERE "witsId" = '0757';

UPDATE "WITS_Config"
SET
  "name" = 'Pressure - Bore',
  "mappedField" = 'borePressure',
  "lasTag" = 'PBORE',
  "enableLogging" = true
WHERE "witsId" = '0758';
