-- AlterTable
ALTER TABLE "matches" ADD COLUMN "finalized_at" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "finalized_by_user_id" TEXT;

-- CreateTable
CREATE TABLE "player_rating_states" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "overall_rating" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "form_rating" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "mvp_awards" INTEGER NOT NULL DEFAULT 0,
    "mvp_votes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_rating_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_player_stats" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "team_label" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "mvp_votes" INTEGER NOT NULL DEFAULT 0,
    "mvp_awarded" BOOLEAN NOT NULL DEFAULT false,
    "opponent_average_rating" DOUBLE PRECISION,
    "performance_score" DOUBLE PRECISION NOT NULL,
    "overall_before" DOUBLE PRECISION NOT NULL,
    "overall_after" DOUBLE PRECISION NOT NULL,
    "form_before" DOUBLE PRECISION NOT NULL,
    "form_after" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_rating_history" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "overall_before" DOUBLE PRECISION NOT NULL,
    "overall_after" DOUBLE PRECISION NOT NULL,
    "form_before" DOUBLE PRECISION NOT NULL,
    "form_after" DOUBLE PRECISION NOT NULL,
    "overall_delta" DOUBLE PRECISION NOT NULL,
    "form_delta" DOUBLE PRECISION NOT NULL,
    "reason" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_matches_finalized_by_user_id" ON "matches"("finalized_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_rating_states_player_id_key" ON "player_rating_states"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_player_stats_match_player" ON "match_player_stats"("match_id", "player_id");

-- CreateIndex
CREATE INDEX "idx_match_player_stats_player_id" ON "match_player_stats"("player_id");

-- CreateIndex
CREATE INDEX "idx_match_player_stats_match_team" ON "match_player_stats"("match_id", "team_label");

-- CreateIndex
CREATE UNIQUE INDEX "uq_player_rating_history_match_player" ON "player_rating_history"("match_id", "player_id");

-- CreateIndex
CREATE INDEX "idx_player_rating_history_player_created_at" ON "player_rating_history"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_player_rating_history_match_id" ON "player_rating_history"("match_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_finalized_by_user_id_fkey" FOREIGN KEY ("finalized_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_rating_states" ADD CONSTRAINT "player_rating_states_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_player_stats" ADD CONSTRAINT "match_player_stats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_player_stats" ADD CONSTRAINT "match_player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
