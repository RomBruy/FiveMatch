-- Phase 3A — final attendance outcomes (ADR-028).
--
-- Fully additive: one enum, five columns, one foreign key. No DROP, no DELETE,
-- no UPDATE. Nothing is backfilled: `outcome` stays NULL on every existing row
-- because a pre-Phase-3 match carries no evidence of what actually happened, and
-- an invented outcome would feed a reliability score that looks earned.

CREATE TYPE "attendance_outcome" AS ENUM ('attended', 'excused', 'late_cancel', 'no_show');
--> statement-breakpoint

ALTER TABLE "match_attendances"
ADD COLUMN "outcome" "attendance_outcome";
--> statement-breakpoint

-- Stored as a fact, not a verdict. `excused` vs `late_cancel` is derived from
-- this against the crew's deadline at finalization, so retuning the threshold
-- leaves history recomputable rather than frozen at the old rule.
ALTER TABLE "match_attendances"
ADD COLUMN "cancelled_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "match_attendances"
ADD COLUMN "arrived_late" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE "match_attendances"
ADD COLUMN "finalized_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "match_attendances"
ADD COLUMN "finalized_by" uuid;
--> statement-breakpoint

ALTER TABLE "match_attendances"
ADD CONSTRAINT "match_attendances_finalized_by_players_id_fk"
FOREIGN KEY ("finalized_by") REFERENCES "players"("id");
--> statement-breakpoint

-- Finalization sweeps unsettled rows for one match; without this it is a table
-- scan on every completed match.
CREATE INDEX IF NOT EXISTS "match_attendances_match_finalized_idx"
ON "match_attendances" ("match_id", "finalized_at");
--> statement-breakpoint

-- Per-crew override of the 12h platform default.
ALTER TABLE "groups"
ADD COLUMN "cancellation_deadline_hours" integer NOT NULL DEFAULT 12;
--> statement-breakpoint

ALTER TABLE "groups"
ADD CONSTRAINT "groups_cancellation_deadline_hours_range"
CHECK ("cancellation_deadline_hours" BETWEEN 0 AND 168);
