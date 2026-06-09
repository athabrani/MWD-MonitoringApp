CREATE TABLE "Report_Email_Log" (
  "id" BIGSERIAL NOT NULL,
  "sessionId" INTEGER,
  "sentById" INTEGER NOT NULL,
  "toRecipients" JSONB NOT NULL,
  "ccRecipients" JSONB,
  "bccRecipients" JSONB,
  "subject" VARCHAR(255) NOT NULL,
  "message" TEXT,
  "status" VARCHAR(30) NOT NULL,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "attachmentTypes" JSONB,
  "attachments" JSONB,
  "errorMessage" TEXT,
  "providerMessageId" VARCHAR(255),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Report_Email_Log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_Email_Log_sessionId_idx" ON "Report_Email_Log"("sessionId");
CREATE INDEX "Report_Email_Log_sentById_idx" ON "Report_Email_Log"("sentById");
CREATE INDEX "Report_Email_Log_status_idx" ON "Report_Email_Log"("status");
CREATE INDEX "Report_Email_Log_sentAt_idx" ON "Report_Email_Log"("sentAt");
CREATE INDEX "Report_Email_Log_createdAt_idx" ON "Report_Email_Log"("createdAt");

ALTER TABLE "Report_Email_Log"
ADD CONSTRAINT "Report_Email_Log_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report_Email_Log"
ADD CONSTRAINT "Report_Email_Log_sentById_fkey"
FOREIGN KEY ("sentById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
