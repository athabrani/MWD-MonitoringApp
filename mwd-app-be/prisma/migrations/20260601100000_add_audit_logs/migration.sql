CREATE TABLE "Audit_Log" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "details" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_Log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Audit_Log_userId_idx" ON "Audit_Log"("userId");
CREATE INDEX "Audit_Log_action_idx" ON "Audit_Log"("action");
CREATE INDEX "Audit_Log_createdAt_idx" ON "Audit_Log"("createdAt");

ALTER TABLE "Audit_Log"
ADD CONSTRAINT "Audit_Log_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
