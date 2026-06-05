-- AlterTable
ALTER TABLE "matches" ADD COLUMN "team_a_score" INTEGER;
ALTER TABLE "matches" ADD COLUMN "team_b_score" INTEGER;
ALTER TABLE "matches" ADD COLUMN "score_submitted_by_user_id" TEXT;
ALTER TABLE "matches" ADD COLUMN "score_submitted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_matches_score_submitted_by_user_id" ON "matches"("score_submitted_by_user_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_score_submitted_by_user_id_fkey" FOREIGN KEY ("score_submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
