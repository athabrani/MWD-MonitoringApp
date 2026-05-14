INSERT INTO "WITS_Config" ("witsId", "name", "mappedField", "units", "lasTag", "decimalPlaces", "scaleFactor", "biasOffset", "enableLogging", "dataSource")
VALUES
('0724', 'Battery Voltage', 'batteryVoltage', 'V', 'BATV', 2, 1, 0, true, 'serial_port_wits')
ON CONFLICT ("witsId") DO UPDATE SET
  "name" = EXCLUDED."name",
  "mappedField" = EXCLUDED."mappedField",
  "units" = EXCLUDED."units",
  "lasTag" = EXCLUDED."lasTag",
  "enableLogging" = EXCLUDED."enableLogging";
