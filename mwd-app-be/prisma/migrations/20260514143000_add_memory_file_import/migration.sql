CREATE TABLE "Memory_File" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "importedById" INTEGER NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "source" VARCHAR(100) NOT NULL DEFAULT 'memory_file',
  "depthField" VARCHAR(100),
  "measuredAtField" VARCHAR(100),
  "columns" JSONB,
  "fieldMappings" JSONB,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Memory_File_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Memory_Data_Point" (
  "id" BIGSERIAL NOT NULL,
  "memoryFileId" INTEGER NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "measuredAt" TIMESTAMP(3),
  "depthMd" DECIMAL(12,4),
  "values" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Memory_Data_Point_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Memory_Correlation" (
  "id" BIGSERIAL NOT NULL,
  "memoryFileId" INTEGER NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "correlatedById" INTEGER NOT NULL,
  "mode" VARCHAR(30) NOT NULL,
  "depthOffset" DECIMAL(12,4),
  "measuredAtOffsetMs" INTEGER,
  "maxDepthDifference" DECIMAL(12,4),
  "maxTimeDifferenceMs" INTEGER,
  "fieldMappings" JSONB,
  "affectedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Memory_Correlation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Memory_File_sessionId_idx" ON "Memory_File"("sessionId");
CREATE INDEX "Memory_File_importedById_idx" ON "Memory_File"("importedById");
CREATE INDEX "Memory_File_createdAt_idx" ON "Memory_File"("createdAt");

CREATE INDEX "Memory_Data_Point_memoryFileId_idx" ON "Memory_Data_Point"("memoryFileId");
CREATE INDEX "Memory_Data_Point_sessionId_idx" ON "Memory_Data_Point"("sessionId");
CREATE INDEX "Memory_Data_Point_measuredAt_idx" ON "Memory_Data_Point"("measuredAt");
CREATE INDEX "Memory_Data_Point_depthMd_idx" ON "Memory_Data_Point"("depthMd");

CREATE INDEX "Memory_Correlation_memoryFileId_idx" ON "Memory_Correlation"("memoryFileId");
CREATE INDEX "Memory_Correlation_sessionId_idx" ON "Memory_Correlation"("sessionId");
CREATE INDEX "Memory_Correlation_correlatedById_idx" ON "Memory_Correlation"("correlatedById");
CREATE INDEX "Memory_Correlation_mode_idx" ON "Memory_Correlation"("mode");
CREATE INDEX "Memory_Correlation_createdAt_idx" ON "Memory_Correlation"("createdAt");

ALTER TABLE "Memory_File"
ADD CONSTRAINT "Memory_File_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Memory_File"
ADD CONSTRAINT "Memory_File_importedById_fkey"
FOREIGN KEY ("importedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Memory_Data_Point"
ADD CONSTRAINT "Memory_Data_Point_memoryFileId_fkey"
FOREIGN KEY ("memoryFileId") REFERENCES "Memory_File"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Memory_Data_Point"
ADD CONSTRAINT "Memory_Data_Point_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Memory_Correlation"
ADD CONSTRAINT "Memory_Correlation_memoryFileId_fkey"
FOREIGN KEY ("memoryFileId") REFERENCES "Memory_File"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Memory_Correlation"
ADD CONSTRAINT "Memory_Correlation_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Memory_Correlation"
ADD CONSTRAINT "Memory_Correlation_correlatedById_fkey"
FOREIGN KEY ("correlatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
