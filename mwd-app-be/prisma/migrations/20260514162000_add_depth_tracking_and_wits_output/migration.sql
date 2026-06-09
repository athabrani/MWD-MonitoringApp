CREATE TABLE "Depth_Tracking_State" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "mode" VARCHAR(50) NOT NULL DEFAULT 'bit_depth',
  "bitDepth" DECIMAL(12,4),
  "holeDepth" DECIMAL(12,4),
  "blockDepth" DECIMAL(12,4),
  "rop" DECIMAL(10,4),
  "status" VARCHAR(50) NOT NULL DEFAULT 'unknown',
  "source" VARCHAR(100) NOT NULL DEFAULT 'manual',
  "lastMeasuredAt" TIMESTAMP(3),
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Depth_Tracking_State_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Depth_Tracking_Sample" (
  "id" BIGSERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "stateId" INTEGER,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "bitDepth" DECIMAL(12,4),
  "holeDepth" DECIMAL(12,4),
  "blockDepth" DECIMAL(12,4),
  "rop" DECIMAL(10,4),
  "status" VARCHAR(50) NOT NULL DEFAULT 'unknown',
  "source" VARCHAR(100) NOT NULL DEFAULT 'manual',
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Depth_Tracking_Sample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WITS_Output_Message" (
  "id" BIGSERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "targetPort" VARCHAR(20) NOT NULL,
  "witsId" VARCHAR(4) NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "depthMd" DECIMAL(12,4),
  "value" DECIMAL(16,6),
  "payload" TEXT NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'queued',
  "reason" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WITS_Output_Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Depth_Tracking_State_sessionId_key" ON "Depth_Tracking_State"("sessionId");
CREATE INDEX "Depth_Tracking_State_lastMeasuredAt_idx" ON "Depth_Tracking_State"("lastMeasuredAt");
CREATE INDEX "Depth_Tracking_State_status_idx" ON "Depth_Tracking_State"("status");

CREATE INDEX "Depth_Tracking_Sample_sessionId_idx" ON "Depth_Tracking_Sample"("sessionId");
CREATE INDEX "Depth_Tracking_Sample_stateId_idx" ON "Depth_Tracking_Sample"("stateId");
CREATE INDEX "Depth_Tracking_Sample_measuredAt_idx" ON "Depth_Tracking_Sample"("measuredAt");
CREATE INDEX "Depth_Tracking_Sample_status_idx" ON "Depth_Tracking_Sample"("status");

CREATE INDEX "WITS_Output_Message_sessionId_idx" ON "WITS_Output_Message"("sessionId");
CREATE INDEX "WITS_Output_Message_targetPort_idx" ON "WITS_Output_Message"("targetPort");
CREATE INDEX "WITS_Output_Message_witsId_idx" ON "WITS_Output_Message"("witsId");
CREATE INDEX "WITS_Output_Message_status_idx" ON "WITS_Output_Message"("status");
CREATE INDEX "WITS_Output_Message_measuredAt_idx" ON "WITS_Output_Message"("measuredAt");
CREATE INDEX "WITS_Output_Message_createdAt_idx" ON "WITS_Output_Message"("createdAt");

ALTER TABLE "Depth_Tracking_State"
ADD CONSTRAINT "Depth_Tracking_State_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Depth_Tracking_Sample"
ADD CONSTRAINT "Depth_Tracking_Sample_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Depth_Tracking_Sample"
ADD CONSTRAINT "Depth_Tracking_Sample_stateId_fkey"
FOREIGN KEY ("stateId") REFERENCES "Depth_Tracking_State"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WITS_Output_Message"
ADD CONSTRAINT "WITS_Output_Message_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
