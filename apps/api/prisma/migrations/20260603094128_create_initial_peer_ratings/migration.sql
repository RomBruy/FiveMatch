CREATE TABLE "initial_peer_ratings" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "rater_player_id" TEXT NOT NULL,
  "rated_player_id" TEXT NOT NULL,
  "attribute_set" TEXT NOT NULL,
  "overall" INTEGER NOT NULL,
  "speed" INTEGER,
  "attack" INTEGER,
  "technique" INTEGER,
  "defense" INTEGER,
  "reflexes" INTEGER,
  "positioning" INTEGER,
  "handling" INTEGER,
  "distribution" INTEGER,
  "communication" INTEGER,
  "physical" INTEGER NOT NULL,
  "stamina" INTEGER,
  "fun" INTEGER NOT NULL,
  "locked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "initial_peer_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_initial_peer_ratings_group_rater_rated"
  ON "initial_peer_ratings"("group_id", "rater_player_id", "rated_player_id");

CREATE INDEX "idx_initial_peer_ratings_rated_player_id"
  ON "initial_peer_ratings"("rated_player_id");

CREATE INDEX "idx_initial_peer_ratings_rater_player_id"
  ON "initial_peer_ratings"("rater_player_id");

ALTER TABLE "initial_peer_ratings"
  ADD CONSTRAINT "initial_peer_ratings_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "initial_peer_ratings"
  ADD CONSTRAINT "initial_peer_ratings_rater_player_id_fkey"
  FOREIGN KEY ("rater_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "initial_peer_ratings"
  ADD CONSTRAINT "initial_peer_ratings_rated_player_id_fkey"
  FOREIGN KEY ("rated_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
