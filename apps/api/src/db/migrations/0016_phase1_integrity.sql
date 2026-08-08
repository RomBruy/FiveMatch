-- Phase 1 additive integrity boundaries.
-- No historical row is deleted, merged, rewritten or backfilled here.

CREATE TABLE IF NOT EXISTS "player_match_eligibilities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "evidence_version" text DEFAULT 'phase1_final_participant_v1' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "invalidated_at" timestamp with time zone,
  "invalidation_reason" text,
  CONSTRAINT "player_match_eligibilities_match_player_unique" UNIQUE("match_id", "player_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_match_eligibilities"
    ADD CONSTRAINT "player_match_eligibilities_match_id_matches_id_fk"
    FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_match_eligibilities"
    ADD CONSTRAINT "player_match_eligibilities_player_id_players_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_match_eligibilities_player_idx"
  ON "player_match_eligibilities" ("player_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ovr_processing_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "processing_type" text DEFAULT 'MATCH_UPDATE' NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ovr_processing_events_match_player_type_unique"
    UNIQUE("match_id", "player_id", "processing_type")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ovr_processing_events"
    ADD CONSTRAINT "ovr_processing_events_match_id_matches_id_fk"
    FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ovr_processing_events"
    ADD CONSTRAINT "ovr_processing_events_player_id_players_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ovr_processing_events_player_idx"
  ON "ovr_processing_events" ("player_id");

--> statement-breakpoint
ALTER TABLE "rating_events" ADD COLUMN IF NOT EXISTS "match_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "rating_events"
    ADD CONSTRAINT "rating_events_match_id_matches_id_fk"
    FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ratings
    WHERE match_id IS NOT NULL AND rater_player_id IS NOT NULL
    GROUP BY match_id, rater_player_id, rated_player_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Phase 1 preflight blocked: duplicate match/rater/target ratings require review';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ratings_match_rater_rated_unique"
  ON "ratings" ("match_id", "rater_player_id", "rated_player_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rating_events_match_player_type_unique"
  ON "rating_events" ("match_id", "player_id", "event_type");
