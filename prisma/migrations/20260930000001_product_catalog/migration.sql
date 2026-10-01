CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "products" ADD CONSTRAINT "products_active_archived_at_check" CHECK (("active" AND "archived_at" IS NULL) OR (NOT "active" AND "archived_at" IS NOT NULL));
CREATE UNIQUE INDEX "products_user_id_name_key" ON "products"("user_id", "name");
CREATE INDEX "products_user_id_active_idx" ON "products"("user_id", "active");
CREATE INDEX "products_user_id_category_idx" ON "products"("user_id", "category");
CREATE INDEX "products_user_id_updated_at_idx" ON "products"("user_id", "updated_at");
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;