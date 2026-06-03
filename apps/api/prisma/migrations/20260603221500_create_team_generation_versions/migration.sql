-- CreateTable
CREATE TABLE "team_generation_versions" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "generated_by_user_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "algorithm_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "team_a" JSONB NOT NULL,
    "team_b" JSONB NOT NULL,
    "team_a_total" DOUBLE PRECISION NOT NULL,
    "team_b_total" DOUBLE PRECISION NOT NULL,
    "fairness_percentage" INTEGER NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "score_components" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_generation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_generation_versions_match_version" ON "team_generation_versions"("match_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_team_generation_versions_match_id" ON "team_generation_versions"("match_id");

-- CreateIndex
CREATE INDEX "idx_team_generation_versions_generated_by_user_id" ON "team_generation_versions"("generated_by_user_id");

-- AddForeignKey
ALTER TABLE "team_generation_versions" ADD CONSTRAINT "team_generation_versions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_generation_versions" ADD CONSTRAINT "team_generation_versions_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
