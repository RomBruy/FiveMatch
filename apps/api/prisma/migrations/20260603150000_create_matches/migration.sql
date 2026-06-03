-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "organizer_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "players_per_team" INTEGER NOT NULL,
    "max_players" INTEGER NOT NULL,
    "attendance_deadline_at" TIMESTAMP(3) NOT NULL,
    "generator_style_override" TEXT,
    "goalkeeper_mode_override" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_matches_group_id_starts_at" ON "matches"("group_id", "starts_at");

-- CreateIndex
CREATE INDEX "idx_matches_organizer_user_id" ON "matches"("organizer_user_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_organizer_user_id_fkey" FOREIGN KEY ("organizer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
