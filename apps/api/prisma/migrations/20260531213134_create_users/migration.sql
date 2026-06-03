CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "clerk_user_id" TEXT NOT NULL,
  "email_address" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "image_url" TEXT,
  "preferred_locale" TEXT NOT NULL DEFAULT 'fr',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");
