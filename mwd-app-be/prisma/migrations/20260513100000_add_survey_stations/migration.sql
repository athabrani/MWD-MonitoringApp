-- CreateTable
CREATE TABLE "Survey_Station" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "stationType" VARCHAR(30) NOT NULL DEFAULT 'actual',
    "measuredDepth" DECIMAL(12,4) NOT NULL,
    "inclination" DECIMAL(8,4) NOT NULL,
    "azimuth" DECIMAL(8,4) NOT NULL,
    "tvd" DECIMAL(12,4),
    "northing" DECIMAL(12,4),
    "easting" DECIMAL(12,4),
    "verticalSection" DECIMAL(12,4),
    "doglegSeverity" DECIMAL(10,4),
    "buildRate" DECIMAL(10,4),
    "turnRate" DECIMAL(10,4),
    "closureDistance" DECIMAL(12,4),
    "closureAzimuth" DECIMAL(8,4),
    "courseLength" DECIMAL(12,4),
    "verticalSectionAzimuth" DECIMAL(8,4),
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_Station_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Survey_Station_sessionId_stationType_measuredDepth_key" ON "Survey_Station"("sessionId", "stationType", "measuredDepth");

-- CreateIndex
CREATE INDEX "Survey_Station_sessionId_idx" ON "Survey_Station"("sessionId");

-- CreateIndex
CREATE INDEX "Survey_Station_stationType_idx" ON "Survey_Station"("stationType");

-- CreateIndex
CREATE INDEX "Survey_Station_measuredDepth_idx" ON "Survey_Station"("measuredDepth");

-- AddForeignKey
ALTER TABLE "Survey_Station" ADD CONSTRAINT "Survey_Station_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
