-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection_Status" (
    "id" SERIAL NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Failover_event" (
    "id" SERIAL NOT NULL,
    "connectionStatusId" INTEGER NOT NULL,
    "fromNode" VARCHAR(100),
    "toNode" VARCHAR(100),
    "reason" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Failover_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MWD_Session" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "connectionStatusId" INTEGER,
    "sessionCode" VARCHAR(100) NOT NULL,
    "wellName" VARCHAR(150),
    "rigName" VARCHAR(150),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MWD_Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Export Record" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "exportedById" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "filePath" VARCHAR(500),
    "rowCount" INTEGER,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Export Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MWD_Data" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "depthMd" DECIMAL(12,4),
    "inclination" DECIMAL(8,4),
    "azimuth" DECIMAL(8,4),
    "gammaRay" DECIMAL(10,4),
    "rop" DECIMAL(10,4),
    "hookLoad" DECIMAL(10,4),
    "standpipePressure" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MWD_Data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Websocket" (
    "id" SERIAL NOT NULL,
    "connectionStatusId" INTEGER,
    "clientId" VARCHAR(120),
    "channel" VARCHAR(100),
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Websocket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "Connection_Status_status_idx" ON "Connection_Status"("status");

-- CreateIndex
CREATE INDEX "Connection_Status_checkedAt_idx" ON "Connection_Status"("checkedAt");

-- CreateIndex
CREATE INDEX "Failover_event_connectionStatusId_idx" ON "Failover_event"("connectionStatusId");

-- CreateIndex
CREATE INDEX "Failover_event_eventAt_idx" ON "Failover_event"("eventAt");

-- CreateIndex
CREATE UNIQUE INDEX "MWD_Session_sessionCode_key" ON "MWD_Session"("sessionCode");

-- CreateIndex
CREATE INDEX "MWD_Session_userId_idx" ON "MWD_Session"("userId");

-- CreateIndex
CREATE INDEX "MWD_Session_connectionStatusId_idx" ON "MWD_Session"("connectionStatusId");

-- CreateIndex
CREATE INDEX "MWD_Session_startedAt_idx" ON "MWD_Session"("startedAt");

-- CreateIndex
CREATE INDEX "Export Record_sessionId_idx" ON "Export Record"("sessionId");

-- CreateIndex
CREATE INDEX "Export Record_exportedById_idx" ON "Export Record"("exportedById");

-- CreateIndex
CREATE INDEX "Export Record_exportedAt_idx" ON "Export Record"("exportedAt");

-- CreateIndex
CREATE INDEX "MWD_Data_sessionId_idx" ON "MWD_Data"("sessionId");

-- CreateIndex
CREATE INDEX "MWD_Data_measuredAt_idx" ON "MWD_Data"("measuredAt");

-- CreateIndex
CREATE INDEX "Websocket_connectionStatusId_idx" ON "Websocket"("connectionStatusId");

-- CreateIndex
CREATE INDEX "Websocket_clientId_idx" ON "Websocket"("clientId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Failover_event" ADD CONSTRAINT "Failover_event_connectionStatusId_fkey" FOREIGN KEY ("connectionStatusId") REFERENCES "Connection_Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MWD_Session" ADD CONSTRAINT "MWD_Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MWD_Session" ADD CONSTRAINT "MWD_Session_connectionStatusId_fkey" FOREIGN KEY ("connectionStatusId") REFERENCES "Connection_Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export Record" ADD CONSTRAINT "Export Record_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Export Record" ADD CONSTRAINT "Export Record_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MWD_Data" ADD CONSTRAINT "MWD_Data_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Websocket" ADD CONSTRAINT "Websocket_connectionStatusId_fkey" FOREIGN KEY ("connectionStatusId") REFERENCES "Connection_Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;
