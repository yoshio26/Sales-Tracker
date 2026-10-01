CREATE TABLE "rate_limit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bucket" VARCHAR(20) NOT NULL,
  "key_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rate_limit_events_bucket_key_hash_created_at_idx" ON "rate_limit_events"("bucket", "key_hash", "created_at");
CREATE INDEX "rate_limit_events_created_at_idx" ON "rate_limit_events"("created_at");