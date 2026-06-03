CREATE TABLE "players" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "nickname" TEXT,
  "photo_url" TEXT,
  "bio" TEXT,
  "dominant_foot" TEXT,
  "jersey_number" INTEGER,
  "preferred_style" TEXT,
  "club_de_formation" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_players_group_id_user_id" ON "players"("group_id", "user_id");
CREATE INDEX "idx_players_user_id" ON "players"("user_id");

ALTER TABLE "players"
  ADD CONSTRAINT "players_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "players"
  ADD CONSTRAINT "players_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
