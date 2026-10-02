ALTER TABLE "products" ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD CONSTRAINT "products_stock_quantity_check" CHECK ("stock_quantity" >= 0);

CREATE TABLE "stock_purchases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "product_name_snapshot" VARCHAR(200) NOT NULL,
  "category_snapshot" VARCHAR(100) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "total_cost_cents" INTEGER NOT NULL,
  "purchased_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_purchases_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_total_cost_cents_check" CHECK ("total_cost_cents" > 0);
CREATE INDEX "stock_purchases_user_id_purchased_at_idx" ON "stock_purchases"("user_id", "purchased_at");
CREATE INDEX "stock_purchases_user_id_product_id_purchased_at_idx" ON "stock_purchases"("user_id", "product_id", "purchased_at");
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_product_id_user_id_fkey" FOREIGN KEY ("product_id", "user_id") REFERENCES "products"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;