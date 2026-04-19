/*
  Warnings:

  - You are about to drop the `Export Record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Export Record" DROP CONSTRAINT "Export Record_exportedById_fkey";

-- DropForeignKey
ALTER TABLE "Export Record" DROP CONSTRAINT "Export Record_sessionId_fkey";

-- DropTable
DROP TABLE "Export Record";

-- CreateTable
CREATE TABLE "Export_Record" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "exportedById" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "filePath" VARCHAR(500),
    "rowCount" INTEGER,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Export_Record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Export_Record_sessionId_idx" ON "Export_Record"("sessionId");

-- CreateIndex
CREATE INDEX "Export_Record_exportedById_idx" ON "Export_Record"("exportedById");

-- CreateIndex
CREATE INDEX "Export_Record_exportedAt_idx" ON "Export_Record"("exportedAt");

-- AddForeignKey
ALTER TABLE "Export_Record" ADD CONSTRAINT "Export_Record_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export_Record" ADD CONSTRAINT "Export_Record_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
