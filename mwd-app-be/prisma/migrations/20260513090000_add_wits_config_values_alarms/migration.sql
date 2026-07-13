-- CreateTable
CREATE TABLE "WITS_Config" (
    "id" SERIAL NOT NULL,
    "witsId" VARCHAR(4) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "units" VARCHAR(50),
    "mappedField" VARCHAR(100),
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "scaleFactor" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "biasOffset" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "sensorToBitSpacing" DECIMAL(12,4),
    "enableLogging" BOOLEAN NOT NULL DEFAULT true,
    "alarmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alarmMin" DECIMAL(16,6),
    "alarmMax" DECIMAL(16,6),
    "customDepthWitsId" VARCHAR(4),
    "dataSource" VARCHAR(100) NOT NULL DEFAULT 'serial_port_wits',
    "sendToAuxPort" BOOLEAN NOT NULL DEFAULT false,
    "sendToRigWitsPort" BOOLEAN NOT NULL DEFAULT false,
    "doNotRepeat" BOOLEAN NOT NULL DEFAULT false,
    "lasTag" VARCHAR(32),
    "lasDescription" VARCHAR(255),
    "lasFilter" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WITS_Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WITS_Data_Value" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "witsConfigId" INTEGER,
    "witsId" VARCHAR(4) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "depthMd" DECIMAL(12,4),
    "rawValue" DECIMAL(16,6),
    "value" DECIMAL(16,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WITS_Data_Value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WITS_Alarm_Event" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "witsConfigId" INTEGER,
    "witsId" VARCHAR(4) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(16,6) NOT NULL,
    "limitType" VARCHAR(10) NOT NULL,
    "limitValue" DECIMAL(16,6) NOT NULL,
    "message" TEXT,
    "acknowledgedById" INTEGER,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WITS_Alarm_Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WITS_Config_witsId_key" ON "WITS_Config"("witsId");

-- CreateIndex
CREATE INDEX "WITS_Config_enableLogging_idx" ON "WITS_Config"("enableLogging");

-- CreateIndex
CREATE INDEX "WITS_Data_Value_sessionId_idx" ON "WITS_Data_Value"("sessionId");

-- CreateIndex
CREATE INDEX "WITS_Data_Value_witsId_idx" ON "WITS_Data_Value"("witsId");

-- CreateIndex
CREATE INDEX "WITS_Data_Value_measuredAt_idx" ON "WITS_Data_Value"("measuredAt");

-- CreateIndex
CREATE INDEX "WITS_Data_Value_depthMd_idx" ON "WITS_Data_Value"("depthMd");

-- CreateIndex
CREATE INDEX "WITS_Alarm_Event_sessionId_idx" ON "WITS_Alarm_Event"("sessionId");

-- CreateIndex
CREATE INDEX "WITS_Alarm_Event_witsId_idx" ON "WITS_Alarm_Event"("witsId");

-- CreateIndex
CREATE INDEX "WITS_Alarm_Event_measuredAt_idx" ON "WITS_Alarm_Event"("measuredAt");

-- CreateIndex
CREATE INDEX "WITS_Alarm_Event_acknowledgedAt_idx" ON "WITS_Alarm_Event"("acknowledgedAt");

-- AddForeignKey
ALTER TABLE "WITS_Data_Value" ADD CONSTRAINT "WITS_Data_Value_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WITS_Data_Value" ADD CONSTRAINT "WITS_Data_Value_witsConfigId_fkey" FOREIGN KEY ("witsConfigId") REFERENCES "WITS_Config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WITS_Alarm_Event" ADD CONSTRAINT "WITS_Alarm_Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WITS_Alarm_Event" ADD CONSTRAINT "WITS_Alarm_Event_witsConfigId_fkey" FOREIGN KEY ("witsConfigId") REFERENCES "WITS_Config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WITS_Alarm_Event" ADD CONSTRAINT "WITS_Alarm_Event_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedDefaultWitsConfig
INSERT INTO "WITS_Config" ("witsId", "name", "mappedField", "units", "lasTag", "decimalPlaces", "scaleFactor", "biasOffset", "enableLogging", "dataSource")
VALUES
('0108', 'Bit Depth', 'depthMd', NULL, 'DEPT', 2, 1, 0, true, 'serial_port_wits'),
('0110', 'Hole Depth', 'depthMd', NULL, 'DEPT', 2, 1, 0, true, 'serial_port_wits'),
('0112', 'WITS 0112', NULL, NULL, 'W0112', 2, 1, 0, true, 'serial_port_wits'),
('0113', 'Rate of Penetration', 'rop', NULL, 'ROP', 2, 1, 0, true, 'serial_port_wits'),
('0117', 'Weight on Bit', 'hookLoad', NULL, 'HKLD', 2, 1, 0, true, 'serial_port_wits'),
('0119', 'WITS 0119', NULL, NULL, 'W0119', 2, 1, 0, true, 'serial_port_wits'),
('0120', 'Rotary Speed', 'rotationSpeed', 'rpm', 'RPM', 2, 1, 0, true, 'serial_port_wits'),
('0121', 'Pump Pressure', 'standpipePressure', NULL, 'SPPA', 2, 1, 0, true, 'serial_port_wits'),
('0128', 'WITS 0128', NULL, NULL, 'W0128', 2, 1, 0, true, 'serial_port_wits'),
('0140', 'WITS 0140', NULL, NULL, 'W0140', 2, 1, 0, true, 'serial_port_wits'),
('0142', 'Total Gravity Field', 'totalGravity', 'g', 'GTOT', 2, 1, 0, true, 'serial_port_wits'),
('0143', 'Total Magnetic Field', 'magneticField', 'g', 'BTOT', 2, 1, 0, true, 'serial_port_wits'),
('0145', 'Dip Angle', 'dipAngle', 'deg', 'DIPA', 2, 1, 0, true, 'serial_port_wits'),
('0146', 'Vibration', 'vibration', 'g', 'VIB', 2, 1, 0, true, 'serial_port_wits'),
('0713', 'Inclination', 'inclination', 'deg', 'INCL', 2, 1, 0, true, 'serial_port_wits'),
('0714', 'Azimuth', 'azimuth', 'deg', 'AZIM', 2, 1, 0, true, 'serial_port_wits'),
('0715', 'Azimuth', 'azimuth', 'deg', 'AZIM', 2, 1, 0, true, 'serial_port_wits'),
('0716', 'Magnetic Toolface', 'magneticToolface', 'deg', 'MTF', 2, 1, 0, true, 'serial_port_wits'),
('0717', 'Gravity Toolface', 'gravityToolface', 'deg', 'GTF', 2, 1, 0, true, 'serial_port_wits'),
('0724', 'Battery Voltage', 'batteryVoltage', 'V', 'BATV', 2, 1, 0, true, 'serial_port_wits'),
('0722', 'WITS 0722', NULL, NULL, 'W0722', 2, 1, 0, true, 'serial_port_wits'),
('0725', 'Total Magnetic Field', 'magneticField', 'g', 'BTOT', 2, 1, 0, true, 'serial_port_wits'),
('0726', 'Total Gravity Field', 'totalGravity', 'g', 'GTOT', 2, 1, 0, true, 'serial_port_wits'),
('0728', 'Dip Angle', 'dipAngle', 'deg', 'DIPA', 2, 1, 0, true, 'serial_port_wits'),
('0730', 'Dip Angle', 'dipAngle', 'deg', 'DIPA', 2, 1, 0, true, 'serial_port_wits'),
('0731', 'Total Gravity', 'totalGravity', 'g', 'GTOT', 2, 1, 0, true, 'serial_port_wits'),
('0732', 'Magnetic Field', 'magneticField', 'g', 'BTOT', 2, 1, 0, true, 'serial_port_wits'),
('0734', 'Battery Voltage', 'batteryVoltage', 'V', 'BATV', 2, 1, 0, true, 'serial_port_wits'),
('0735', 'Battery 2 On/Off', 'battery2OnOff', NULL, 'BAT2', 2, 1, 0, true, 'serial_port_wits'),
('0736', 'Shock', 'shock', 'g', 'SHK', 2, 1, 0, true, 'serial_port_wits'),
('0737', 'Vibration', 'vibration', 'g', 'VIB', 2, 1, 0, true, 'serial_port_wits'),
('0738', 'Rotation Speed', 'rotationSpeed', 'rpm', 'RPM', 2, 1, 0, true, 'serial_port_wits'),
('0757', 'Generic Variable 0', 'genericVariable0', NULL, 'GV0', 2, 1, 0, false, 'serial_port_wits'),
('0758', 'Generic Variable 1', 'genericVariable1', NULL, 'GV1', 2, 1, 0, false, 'serial_port_wits'),
('0759', 'Generic Variable 2', 'genericVariable2', NULL, 'GV2', 2, 1, 0, false, 'serial_port_wits'),
('0760', 'Generic Variable 3', 'genericVariable3', NULL, 'GV3', 2, 1, 0, false, 'serial_port_wits'),
('0761', 'Generic Variable 4', 'genericVariable4', NULL, 'GV4', 2, 1, 0, false, 'serial_port_wits'),
('0762', 'Generic Variable 5', 'genericVariable5', NULL, 'GV5', 2, 1, 0, false, 'serial_port_wits'),
('0763', 'Generic Variable 6', 'genericVariable6', NULL, 'GV6', 2, 1, 0, false, 'serial_port_wits'),
('0764', 'Generic Variable 7', 'genericVariable7', NULL, 'GV7', 2, 1, 0, false, 'serial_port_wits'),
('0765', 'Raw Sensor Ax', 'rawSensorAx', 'g', 'AX', 2, 1, 0, true, 'serial_port_wits'),
('0766', 'Raw Sensor Ay', 'rawSensorAy', 'g', 'AY', 2, 1, 0, true, 'serial_port_wits'),
('0767', 'Raw Sensor Az', 'rawSensorAz', 'g', 'AZ', 2, 1, 0, true, 'serial_port_wits'),
('0768', 'Raw Sensor Mx', 'rawSensorMx', 'g', 'MX', 2, 1, 0, true, 'serial_port_wits'),
('0769', 'Raw Sensor My', 'rawSensorMy', 'g', 'MY', 2, 1, 0, true, 'serial_port_wits'),
('0770', 'Raw Sensor Mz', 'rawSensorMz', 'g', 'MZ', 2, 1, 0, true, 'serial_port_wits'),
('0780', 'Continuous Inclination', 'continuousInclination', 'deg', 'CINC', 2, 1, 0, true, 'serial_port_wits'),
('0781', 'Continuous Azimuth', 'continuousAzimuth', 'deg', 'CAZM', 2, 1, 0, true, 'serial_port_wits'),
('0823', 'Gamma', 'gammaRay', 'cps', 'GR', 2, 1, 0, true, 'serial_port_wits'),
('0824', 'Gamma Corrected', 'gammaRay', 'cps', 'GR', 2, 1, 0, true, 'serial_port_wits'),
('0836', 'WITS 0836', NULL, NULL, 'W0836', 2, 1, 0, true, 'serial_port_wits'),
('0921', 'Battery Voltage', 'batteryVoltage', 'V', 'BATV', 2, 1, 0, true, 'serial_port_wits'),
('8916', 'Magnetic Toolface', 'magneticToolface', 'deg', 'MTF', 2, 1, 0, true, 'serial_port_wits'),
('8917', 'Gravity Toolface', 'gravityToolface', 'deg', 'GTF', 2, 1, 0, true, 'serial_port_wits'),
('9014', 'Dip Angle', 'dipAngle', 'deg', 'DIPA', 2, 1, 0, true, 'serial_port_wits'),
('9016', 'Total Magnetic Field', 'magneticField', 'g', 'BTOT', 2, 1, 0, true, 'serial_port_wits'),
('9017', 'Total Gravity Field', 'totalGravity', 'g', 'GTOT', 2, 1, 0, true, 'serial_port_wits')
ON CONFLICT ("witsId") DO NOTHING;
