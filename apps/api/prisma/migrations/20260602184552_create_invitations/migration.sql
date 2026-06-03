CREATE TABLE "invitations" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3),
  "last_accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");
CREATE INDEX "idx_invitations_group_id" ON "invitations"("group_id");
CREATE INDEX "idx_invitations_created_by_user_id" ON "invitations"("created_by_user_id");

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
