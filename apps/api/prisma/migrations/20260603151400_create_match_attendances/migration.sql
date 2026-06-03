-- CreateTable
CREATE TABLE "match_attendances" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "waitlist_position" INTEGER,
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_attendances_match_id_player_id" ON "match_attendances"("match_id", "player_id");

-- CreateIndex
CREATE INDEX "idx_match_attendances_match_id_status" ON "match_attendances"("match_id", "status");

-- CreateIndex
CREATE INDEX "idx_match_attendances_player_id" ON "match_attendances"("player_id");

-- AddForeignKey
ALTER TABLE "match_attendances" ADD CONSTRAINT "match_attendances_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_attendances" ADD CONSTRAINT "match_attendances_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
