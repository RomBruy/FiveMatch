-- Phase 4 — card eligibility (PR-026..031, ADR-017, ADR-029).
--
-- Fully additive: four columns and two foreign keys. No DROP, no DELETE, no
-- UPDATE. Nothing is backfilled: existing eligibility rows keep their Phase 1
-- `evidence_version`, because a row created from a team sheet cannot be
-- retroactively claimed as proof that someone turned up.

-- Who struck an eligibility. Null when the system did it, via a voided match.
ALTER TABLE "player_match_eligibilities"
ADD COLUMN "invalidated_by" uuid;
--> statement-breakpoint

ALTER TABLE "player_match_eligibilities"
ADD CONSTRAINT "player_match_eligibilities_invalidated_by_players_id_fk"
FOREIGN KEY ("invalidated_by") REFERENCES "players"("id");
--> statement-breakpoint

-- A voided match happened but stops counting toward cards. Distinct from
-- `cancelled`, which means it never happened at all.
ALTER TABLE "matches"
ADD COLUMN "voided_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "matches"
ADD COLUMN "voided_by" uuid;
--> statement-breakpoint

ALTER TABLE "matches"
ADD COLUMN "void_reason" text;
--> statement-breakpoint

ALTER TABLE "matches"
ADD CONSTRAINT "matches_voided_by_users_id_fk"
FOREIGN KEY ("voided_by") REFERENCES "users"("id");
--> statement-breakpoint

-- The auto-finalize sweep looks for completed matches with unsettled rows.
CREATE INDEX IF NOT EXISTS "matches_completed_voided_idx"
ON "matches" ("status", "completed_at", "voided_at");
