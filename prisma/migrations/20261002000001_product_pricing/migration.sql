ALTER TABLE "products" ADD COLUMN "price_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD CONSTRAINT "products_price_cents_check" CHECK ("price_cents" >= 0);
