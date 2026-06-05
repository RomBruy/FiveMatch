-- CreateTable
CREATE TABLE "match_opponent_ratings" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "rater_player_id" TEXT NOT NULL,
    "rated_player_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_opponent_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_opponent_rating_completions" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_opponent_rating_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_opponent_ratings_match_rater_rated" ON "match_opponent_ratings"("match_id", "rater_player_id", "rated_player_id");

-- CreateIndex
CREATE INDEX "idx_match_opponent_ratings_match_rated_player" ON "match_opponent_ratings"("match_id", "rated_player_id");

-- CreateIndex
CREATE INDEX "idx_match_opponent_ratings_rater_player_id" ON "match_opponent_ratings"("rater_player_id");

-- CreateIndex
CREATE INDEX "idx_match_opponent_ratings_rated_player_id" ON "match_opponent_ratings"("rated_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_opponent_rating_completions_match_player" ON "match_opponent_rating_completions"("match_id", "player_id");

-- CreateIndex
CREATE INDEX "idx_match_opponent_rating_completions_match_status" ON "match_opponent_rating_completions"("match_id", "status");

-- CreateIndex
CREATE INDEX "idx_match_opponent_rating_completions_player_id" ON "match_opponent_rating_completions"("player_id");

-- AddForeignKey
ALTER TABLE "match_opponent_ratings" ADD CONSTRAINT "match_opponent_ratings_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_opponent_ratings" ADD CONSTRAINT "match_opponent_ratings_rater_player_id_fkey" FOREIGN KEY ("rater_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_opponent_ratings" ADD CONSTRAINT "match_opponent_ratings_rated_player_id_fkey" FOREIGN KEY ("rated_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_opponent_rating_completions" ADD CONSTRAINT "match_opponent_rating_completions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_opponent_rating_completions" ADD CONSTRAINT "match_opponent_rating_completions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
