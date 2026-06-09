INSERT INTO "WITS_Config" ("witsId", "name", "mappedField", "units", "lasTag", "decimalPlaces", "scaleFactor", "biasOffset", "enableLogging", "dataSource")
VALUES
('0112', 'WITS 0112', NULL, NULL, 'W0112', 2, 1, 0, true, 'serial_port_wits'),
('0119', 'WITS 0119', NULL, NULL, 'W0119', 2, 1, 0, true, 'serial_port_wits'),
('0128', 'WITS 0128', NULL, NULL, 'W0128', 2, 1, 0, true, 'serial_port_wits'),
('0140', 'WITS 0140', NULL, NULL, 'W0140', 2, 1, 0, true, 'serial_port_wits'),
('0722', 'WITS 0722', NULL, NULL, 'W0722', 2, 1, 0, true, 'serial_port_wits'),
('0836', 'WITS 0836', NULL, NULL, 'W0836', 2, 1, 0, true, 'serial_port_wits')
ON CONFLICT ("witsId") DO NOTHING;
