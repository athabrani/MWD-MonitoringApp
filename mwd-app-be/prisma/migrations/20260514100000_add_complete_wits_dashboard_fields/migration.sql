ALTER TABLE "MWD_Data"
ADD COLUMN "toolRunTime" DECIMAL(12,4),
ADD COLUMN "slideIndicator" DECIMAL(10,4),
ADD COLUMN "verticalSection" DECIMAL(12,4),
ADD COLUMN "rotaryTorque" DECIMAL(10,4),
ADD COLUMN "flowOut" DECIMAL(10,4),
ADD COLUMN "flowIn" DECIMAL(10,4),
ADD COLUMN "gasAverage" DECIMAL(10,4),
ADD COLUMN "mwdPressure" DECIMAL(10,4),
ADD COLUMN "kpwd2" DECIMAL(10,4),
ADD COLUMN "ecdDd" DECIMAL(10,4),
ADD COLUMN "confidence" DECIMAL(10,4),
ADD COLUMN "pulseAmplitude" DECIMAL(10,4),
ADD COLUMN "decoderPressure" DECIMAL(10,4),
ADD COLUMN "avo" DECIMAL(10,4),
ADD COLUMN "shallowResistivity" DECIMAL(12,4);

INSERT INTO "WITS_Config" ("witsId", "name", "mappedField", "units", "lasTag", "decimalPlaces", "scaleFactor", "biasOffset", "enableLogging", "dataSource")
VALUES
('0010', 'Tool Run Time', 'toolRunTime', NULL, 'TRTIME', 2, 1, 0, true, 'serial_port_wits'),
('0012', 'Slide Indicator', 'slideIndicator', NULL, 'SLIDE', 2, 1, 0, true, 'serial_port_wits'),
('0119', 'Rotary Torque', 'rotaryTorque', NULL, 'RTORQ', 2, 1, 0, true, 'serial_port_wits'),
('0128', 'Flow Out', 'flowOut', NULL, 'FLOOUT', 2, 1, 0, true, 'serial_port_wits'),
('0130', 'Flow In', 'flowIn', NULL, 'FLOIN', 2, 1, 0, true, 'serial_port_wits'),
('0140', 'Gas Avg', 'gasAverage', NULL, 'GASAVG', 2, 1, 0, true, 'serial_port_wits'),
('0150', 'Mud Weight', 'mudWeight', NULL, 'MWT', 2, 1, 0, true, 'serial_port_wits'),
('0709', 'TVD', 'tvdCalc', 'm', 'TVD', 2, 1, 0, true, 'serial_port_wits'),
('0723', 'Vertical Section', 'verticalSection', 'm', 'VS', 2, 1, 0, true, 'serial_port_wits'),
('0733', 'Temperature', 'temperature', 'C', 'TEMP', 2, 1, 0, true, 'serial_port_wits'),
('0801', 'KPWD DPWD', 'differentialPressure', NULL, 'KDPWD', 2, 1, 0, true, 'serial_port_wits'),
('0802', 'KPWD IPWD', 'mwdPressure', NULL, 'KIPWD', 2, 1, 0, true, 'serial_port_wits'),
('0803', 'KPWD APWD', 'annularPressure', NULL, 'KAPWD', 2, 1, 0, true, 'serial_port_wits'),
('0835', 'Temperature', 'temperature', 'C', 'TEMP', 2, 1, 0, true, 'serial_port_wits'),
('0836', 'Temperature', 'temperature', 'C', 'TEMP', 2, 1, 0, true, 'serial_port_wits'),
('0850', 'ECD TVD Survey Based', 'ecdTvd', NULL, 'ECDTVD', 2, 1, 0, true, 'serial_port_wits'),
('0851', 'ECD Calculation SG', 'ecd', NULL, 'ECDSG', 2, 1, 0, true, 'serial_port_wits'),
('0852', 'ECD Calculation PPG', 'ecd2', NULL, 'ECDPPG', 2, 1, 0, true, 'serial_port_wits'),
('0853', 'TVD Calc', 'tvdCalc', 'm', 'TVDC', 2, 1, 0, true, 'serial_port_wits'),
('0888', 'MWD Pressure', 'mwdPressure', NULL, 'MWDPRS', 2, 1, 0, true, 'serial_port_wits'),
('0899', 'KPWD Bore', 'borePressure', NULL, 'KBORE', 2, 1, 0, true, 'serial_port_wits'),
('0900', 'KPWD 2', 'kpwd2', NULL, 'KPWD2', 2, 1, 0, true, 'serial_port_wits'),
('5717', 'GTF Relog', 'gravityToolface', 'deg', 'GTF', 2, 1, 0, true, 'serial_port_wits'),
('5731', 'Total Gravity Relog', 'totalGravity', 'g', 'GTOT', 2, 1, 0, true, 'serial_port_wits'),
('5732', 'Mag Field Relog', 'magneticField', 'g', 'BTOT', 2, 1, 0, true, 'serial_port_wits'),
('5733', 'Temperature Relog', 'temperature', 'C', 'TEMP', 2, 1, 0, true, 'serial_port_wits'),
('5734', 'Battery Voltage Relog', 'batteryVoltage', 'V', 'BATV', 2, 1, 0, true, 'serial_port_wits'),
('5735', 'Battery 2 Relog', 'battery2OnOff', NULL, 'BAT2', 2, 1, 0, true, 'serial_port_wits'),
('5757', 'Pressure - Annular Relog', 'annularPressure', NULL, 'PANN', 2, 1, 0, true, 'serial_port_wits'),
('5758', 'Pressure - Bore Relog', 'borePressure', NULL, 'PBORE', 2, 1, 0, true, 'serial_port_wits'),
('5759', 'Diff Pressure Relog', 'differentialPressure', NULL, 'DPRES', 2, 1, 0, true, 'serial_port_wits'),
('5760', 'Annular Differential Restriction Relog', 'annularDifferentialPressure', NULL, 'ADP', 2, 1, 0, true, 'serial_port_wits'),
('5835', 'Temperature Relog', 'temperature', 'C', 'TEMP', 2, 1, 0, true, 'serial_port_wits'),
('5836', 'Temperature Relog', 'temperature', 'C', 'TEMP', 2, 1, 0, true, 'serial_port_wits'),
('5850', 'ECD Calculation Relog', 'ecd', NULL, 'ECD', 2, 1, 0, true, 'serial_port_wits'),
('5851', 'ECD Calculation SG Relog', 'ecd', NULL, 'ECDSG', 2, 1, 0, true, 'serial_port_wits'),
('5852', 'ECD Calculation PPG Relog', 'ecd2', NULL, 'ECDPPG', 2, 1, 0, true, 'serial_port_wits'),
('5853', 'TVD Calc Relog', 'tvdCalc', 'm', 'TVDC', 2, 1, 0, true, 'serial_port_wits'),
('5888', 'MWD Pressure Relog', 'mwdPressure', NULL, 'MWDPRS', 2, 1, 0, true, 'serial_port_wits'),
('6410', 'Confidence', 'confidence', NULL, 'CONF', 2, 1, 0, true, 'serial_port_wits'),
('6411', 'Pulse Amp', 'pulseAmplitude', NULL, 'PAMP', 2, 1, 0, true, 'serial_port_wits'),
('6425', 'Decoder Pressure', 'decoderPressure', NULL, 'DECPRS', 2, 1, 0, true, 'serial_port_wits'),
('6666', 'TVD CAL CINC', 'tvdCalc', 'm', 'TVDC', 2, 1, 0, true, 'serial_port_wits'),
('7777', 'AVO', 'avo', NULL, 'AVO', 2, 1, 0, true, 'serial_port_wits'),
('8888', 'ECD DD', 'ecdDd', NULL, 'ECDDD', 2, 1, 0, true, 'serial_port_wits'),
('9910', 'Shallow Res', 'shallowResistivity', NULL, 'RSHAL', 2, 1, 0, true, 'serial_port_wits')
ON CONFLICT ("witsId") DO UPDATE SET
  "name" = EXCLUDED."name",
  "mappedField" = EXCLUDED."mappedField",
  "units" = EXCLUDED."units",
  "lasTag" = EXCLUDED."lasTag",
  "enableLogging" = EXCLUDED."enableLogging";

UPDATE "WITS_Config"
SET
  "name" = 'Dip Angle',
  "mappedField" = 'dipAngle',
  "units" = 'deg',
  "lasTag" = 'DIPA',
  "enableLogging" = true
WHERE "witsId" = '0722';

UPDATE "WITS_Config"
SET
  "name" = 'G Total',
  "mappedField" = 'totalGravity',
  "units" = 'g',
  "lasTag" = 'GTOT',
  "enableLogging" = true
WHERE "witsId" = '0724';

UPDATE "WITS_Config"
SET
  "name" = 'Flow Out',
  "mappedField" = 'flowOut',
  "lasTag" = 'FLOOUT',
  "enableLogging" = true
WHERE "witsId" = '0128';

UPDATE "WITS_Config"
SET
  "name" = 'Gas Avg',
  "mappedField" = 'gasAverage',
  "lasTag" = 'GASAVG',
  "enableLogging" = true
WHERE "witsId" = '0140';
