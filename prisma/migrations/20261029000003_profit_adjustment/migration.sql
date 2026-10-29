CREATE TABLE "profit_adjustments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "profit_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "profit_adjustments_user_id_deleted_at_updated_at_idx" ON "profit_adjustments"("user_id", "deleted_at", "updated_at");
CREATE UNIQUE INDEX "profit_adjustments_one_active_per_user_idx" ON "profit_adjustments"("user_id") WHERE "deleted_at" IS NULL;

ALTER TABLE "profit_adjustments" ADD CONSTRAINT "profit_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
