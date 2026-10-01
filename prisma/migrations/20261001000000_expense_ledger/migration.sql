CREATE UNIQUE INDEX "products_id_user_id_key" ON "products"("id", "user_id");

CREATE TABLE "expenses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "product_name_snapshot" VARCHAR(200) NOT NULL,
  "category_snapshot" VARCHAR(100) NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "note" TEXT,
  "spent_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_cents_check" CHECK ("amount_cents" > 0);
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_quantity_check" CHECK ("quantity" > 0);
CREATE INDEX "expenses_user_id_deleted_at_spent_at_idx" ON "expenses"("user_id", "deleted_at", "spent_at");
CREATE INDEX "expenses_user_id_product_id_deleted_at_idx" ON "expenses"("user_id", "product_id", "deleted_at");
CREATE INDEX "expenses_user_id_category_snapshot_deleted_at_idx" ON "expenses"("user_id", "category_snapshot", "deleted_at");
CREATE INDEX "expenses_user_id_deleted_at_updated_at_idx" ON "expenses"("user_id", "deleted_at", "updated_at");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_product_id_user_id_fkey" FOREIGN KEY ("product_id", "user_id") REFERENCES "products"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;