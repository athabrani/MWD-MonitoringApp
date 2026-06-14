ALTER TABLE "MWD_Data"
ADD COLUMN IF NOT EXISTS "gatewaySequence" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "MWD_Data_gatewaySequence_idx"
ON "MWD_Data"("gatewaySequence");
