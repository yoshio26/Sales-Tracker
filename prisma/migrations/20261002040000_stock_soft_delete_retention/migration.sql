ALTER TABLE "products" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "stock_purchases" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

CREATE INDEX "products_user_id_active_deleted_at_idx" ON "products"("user_id", "active", "deleted_at");
CREATE INDEX "products_user_id_deleted_at_idx" ON "products"("user_id", "deleted_at");
CREATE INDEX "stock_purchases_user_id_deleted_at_idx" ON "stock_purchases"("user_id", "deleted_at");
