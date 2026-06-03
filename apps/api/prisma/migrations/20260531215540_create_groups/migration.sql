CREATE TABLE "groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_settings" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "default_language" TEXT NOT NULL,
  "play_style" TEXT NOT NULL,
  "intensity" TEXT NOT NULL,
  "goalkeeper_mode" TEXT NOT NULL,
  "generator_style" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "group_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_members" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_groups_owner_user_id" ON "groups"("owner_user_id");
CREATE UNIQUE INDEX "group_settings_group_id_key" ON "group_settings"("group_id");
CREATE UNIQUE INDEX "uq_group_members_group_id_user_id" ON "group_members"("group_id", "user_id");
CREATE INDEX "idx_group_members_user_id" ON "group_members"("user_id");

ALTER TABLE "groups"
  ADD CONSTRAINT "groups_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "group_settings"
  ADD CONSTRAINT "group_settings_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
