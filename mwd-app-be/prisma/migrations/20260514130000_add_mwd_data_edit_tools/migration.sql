ALTER TABLE "MWD_Data"
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "hiddenById" INTEGER,
ADD COLUMN "editNote" TEXT;

CREATE INDEX "MWD_Data_isHidden_idx" ON "MWD_Data"("isHidden");

CREATE TABLE "MWD_Data_Edit_Operation" (
  "id" BIGSERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "editedById" INTEGER NOT NULL,
  "operation" VARCHAR(50) NOT NULL,
  "depthMin" DECIMAL(12,4),
  "depthMax" DECIMAL(12,4),
  "affectedCount" INTEGER NOT NULL DEFAULT 0,
  "parameters" JSONB,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MWD_Data_Edit_Operation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MWD_Data_Edit_Operation_sessionId_idx" ON "MWD_Data_Edit_Operation"("sessionId");
CREATE INDEX "MWD_Data_Edit_Operation_editedById_idx" ON "MWD_Data_Edit_Operation"("editedById");
CREATE INDEX "MWD_Data_Edit_Operation_operation_idx" ON "MWD_Data_Edit_Operation"("operation");
CREATE INDEX "MWD_Data_Edit_Operation_createdAt_idx" ON "MWD_Data_Edit_Operation"("createdAt");

ALTER TABLE "MWD_Data_Edit_Operation"
ADD CONSTRAINT "MWD_Data_Edit_Operation_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MWD_Session"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MWD_Data_Edit_Operation"
ADD CONSTRAINT "MWD_Data_Edit_Operation_editedById_fkey"
FOREIGN KEY ("editedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
