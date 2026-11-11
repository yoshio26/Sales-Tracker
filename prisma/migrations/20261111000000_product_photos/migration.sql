ALTER TABLE "products" ADD COLUMN "image_url" TEXT, ADD COLUMN "image_public_id" TEXT;
ALTER TABLE "stock_purchases" ADD COLUMN "image_url" TEXT, ADD COLUMN "image_public_id" TEXT;
CREATE INDEX "products_image_public_id_idx" ON "products"("image_public_id");
CREATE INDEX "stock_purchases_image_public_id_idx" ON "stock_purchases"("image_public_id");
UPDATE "stock_purchases" AS purchase
SET "image_url" = product."image_url", "image_public_id" = product."image_public_id"
FROM "products" AS product
WHERE purchase."product_id" = product."id" AND purchase."user_id" = product."user_id";