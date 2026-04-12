-- Add email_verified to users
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- Create email_tokens table
CREATE TABLE "email_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_tokens_token_key" ON "email_tokens"("token");

ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
