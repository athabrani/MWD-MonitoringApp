CREATE TABLE "Survey_Config" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "wellName" VARCHAR(150),
    "rigName" VARCHAR(150),
    "companyName" VARCHAR(150),
    "fieldName" VARCHAR(150),
    "location" VARCHAR(255),
    "units" VARCHAR(50),
    "proposedAzimuth" DECIMAL(8,4),
    "surveyDepthOffset" DECIMAL(12,4),
    "northReference" VARCHAR(80),
    "declination" DECIMAL(8,4),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "northingOrigin" DECIMAL(12,4),
    "eastingOrigin" DECIMAL(12,4),
    "elevationKb" DECIMAL(12,4),
    "elevationDf" DECIMAL(12,4),
    "elevationGl" DECIMAL(12,4),
    "sectionType" VARCHAR(80),
    "plotTemplateId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_Config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Survey_Config_sessionId_key" ON "Survey_Config"("sessionId");
CREATE INDEX "Survey_Config_plotTemplateId_idx" ON "Survey_Config"("plotTemplateId");

ALTER TABLE "Survey_Config"
ADD CONSTRAINT "Survey_Config_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Survey_Config"
ADD CONSTRAINT "Survey_Config_plotTemplateId_fkey"
FOREIGN KEY ("plotTemplateId") REFERENCES "Plot_Template"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
