CREATE TABLE "notification_settings" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "recipient_email" VARCHAR(320),
  "added_enabled" BOOLEAN NOT NULL DEFAULT true,
  "deleted_enabled" BOOLEAN NOT NULL DEFAULT true,
  "changed_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;