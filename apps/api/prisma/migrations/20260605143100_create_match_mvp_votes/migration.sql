-- CreateTable
CREATE TABLE "match_mvp_votes" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "voter_player_id" TEXT NOT NULL,
    "voted_player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_mvp_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_mvp_votes_match_voter" ON "match_mvp_votes"("match_id", "voter_player_id");

-- CreateIndex
CREATE INDEX "idx_match_mvp_votes_match_voted_player" ON "match_mvp_votes"("match_id", "voted_player_id");

-- CreateIndex
CREATE INDEX "idx_match_mvp_votes_voter_player_id" ON "match_mvp_votes"("voter_player_id");

-- CreateIndex
CREATE INDEX "idx_match_mvp_votes_voted_player_id" ON "match_mvp_votes"("voted_player_id");

-- AddForeignKey
ALTER TABLE "match_mvp_votes" ADD CONSTRAINT "match_mvp_votes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_mvp_votes" ADD CONSTRAINT "match_mvp_votes_voter_player_id_fkey" FOREIGN KEY ("voter_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_mvp_votes" ADD CONSTRAINT "match_mvp_votes_voted_player_id_fkey" FOREIGN KEY ("voted_player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
