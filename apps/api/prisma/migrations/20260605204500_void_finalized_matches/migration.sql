-- AlterTable
ALTER TABLE "matches" ADD COLUMN "voided_at" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "voided_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "match_player_stats" ADD COLUMN "voided_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "player_rating_history" ADD COLUMN "voided_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_matches_voided_by_user_id" ON "matches"("voided_by_user_id");

-- CreateIndex
CREATE INDEX "idx_matches_status_voided_at" ON "matches"("status", "voided_at");

-- CreateIndex
CREATE INDEX "idx_match_player_stats_player_voided_at" ON "match_player_stats"("player_id", "voided_at");

-- CreateIndex
CREATE INDEX "idx_player_rating_history_player_voided_at" ON "player_rating_history"("player_id", "voided_at");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
