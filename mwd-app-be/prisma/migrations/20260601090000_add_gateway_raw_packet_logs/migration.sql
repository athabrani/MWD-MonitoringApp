CREATE TABLE "Gateway_Raw_Packet_Log" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" INTEGER,
    "channel" VARCHAR(30) NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "messageType" VARCHAR(50),
    "rawMessage" TEXT NOT NULL,
    "payload" JSONB,
    "sequence" VARCHAR(100),
    "rssi" DECIMAL(10,4),
    "snr" DECIMAL(10,4),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingested" BOOLEAN NOT NULL DEFAULT false,
    "selectedByFusion" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gateway_Raw_Packet_Log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Gateway_Raw_Packet_Log_sessionId_idx" ON "Gateway_Raw_Packet_Log"("sessionId");
CREATE INDEX "Gateway_Raw_Packet_Log_channel_idx" ON "Gateway_Raw_Packet_Log"("channel");
CREATE INDEX "Gateway_Raw_Packet_Log_source_idx" ON "Gateway_Raw_Packet_Log"("source");
CREATE INDEX "Gateway_Raw_Packet_Log_messageType_idx" ON "Gateway_Raw_Packet_Log"("messageType");
CREATE INDEX "Gateway_Raw_Packet_Log_receivedAt_idx" ON "Gateway_Raw_Packet_Log"("receivedAt");
CREATE INDEX "Gateway_Raw_Packet_Log_selectedByFusion_idx" ON "Gateway_Raw_Packet_Log"("selectedByFusion");

ALTER TABLE "Gateway_Raw_Packet_Log"
ADD CONSTRAINT "Gateway_Raw_Packet_Log_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
