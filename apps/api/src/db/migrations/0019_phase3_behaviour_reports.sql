-- Phase 3B — behaviour reports and dispute workflow (ADR-027).
--
-- Fully additive: two enums, one enum value, one table. No DROP, no DELETE, no
-- UPDATE of existing rows. Adding 'co_host' to member_role cannot affect any
-- existing membership; every current row keeps the role it already had.

ALTER TYPE "member_role" ADD VALUE IF NOT EXISTS 'co_host' AFTER 'organizer';
--> statement-breakpoint

CREATE TYPE "behaviour_report_category" AS ENUM (
  'dangerous_play',
  'aggression',
  'abusive_language',
  'unsporting',
  'good_spirit',
  'helped_organize'
);
--> statement-breakpoint

CREATE TYPE "behaviour_report_status" AS ENUM ('pending', 'finalized', 'dismissed', 'expired');
--> statement-breakpoint

CREATE TABLE "behaviour_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  -- Nullable so a GDPR erasure can detach the reporter without destroying the
  -- record the subject's resolved standing was built from.
  "reporter_player_id" uuid REFERENCES "players"("id"),
  "subject_player_id" uuid NOT NULL REFERENCES "players"("id"),
  "category" "behaviour_report_category" NOT NULL,
  "status" "behaviour_report_status" NOT NULL DEFAULT 'pending',
  "detail" text,
  "validator_player_id" uuid REFERENCES "players"("id"),
  "resolved_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- One reporter, one voice, per subject per category per match. Without this a
-- single person could manufacture corroboration by filing the same report twice.
ALTER TABLE "behaviour_reports"
ADD CONSTRAINT "behaviour_reports_reporter_subject_category_unique"
UNIQUE ("match_id", "reporter_player_id", "subject_player_id", "category");
--> statement-breakpoint

ALTER TABLE "behaviour_reports"
ADD CONSTRAINT "behaviour_reports_no_self_report"
CHECK ("reporter_player_id" IS NULL OR "reporter_player_id" <> "subject_player_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "behaviour_reports_corroboration_idx"
ON "behaviour_reports" ("match_id", "subject_player_id", "category");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "behaviour_reports_subject_status_idx"
ON "behaviour_reports" ("subject_player_id", "status");
