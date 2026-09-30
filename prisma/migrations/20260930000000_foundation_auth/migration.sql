CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "allowed_emails" (
  "email" VARCHAR(320) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "allowed_emails_pkey" PRIMARY KEY ("email")
);

CREATE TABLE "login_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "code_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 5);
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_expires_after_created_check" CHECK ("expires_at" > "created_at");
CREATE INDEX "login_codes_email_created_at_idx" ON "login_codes"("email", "created_at");
CREATE INDEX "login_codes_email_expires_at_idx" ON "login_codes"("email", "expires_at");
CREATE INDEX "login_codes_expires_at_idx" ON "login_codes"("expires_at");

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expires_after_created_check" CHECK ("expires_at" > "created_at");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
