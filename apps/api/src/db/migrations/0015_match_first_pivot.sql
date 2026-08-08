-- Match-first pivot.
--
-- Three structural changes, in dependency order:
--   1. `players` collapses from one row per (group, user) to one global row per user.
--   2. `matches` stops requiring a group and gains the discovery/marketplace columns.
--   3. attendance records where a player came from, so open spots can be counted.
--
-- Step 1 is destructive: a user who belonged to N crews had N identities with N
-- separate OVRs. We keep the most-played one and repoint every foreign key at it.
-- Statement-level idempotency is deliberate — this file is safe to re-run.

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."match_visibility" AS ENUM('private', 'public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."skill_level" AS ENUM('casual', 'intermediate', 'competitive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."attendance_source" AS ENUM('crew', 'open');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. Collapse players to a global identity
-- ---------------------------------------------------------------------------
--> statement-breakpoint
DROP TABLE IF EXISTS player_merge_map;
--> statement-breakpoint
CREATE TEMP TABLE player_merge_map AS
WITH ranked AS (
  SELECT
    id,
    user_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY match_count DESC, created_at ASC, id ASC
    ) AS survivor_id
  FROM players
  WHERE deleted_at IS NULL
)
SELECT id AS old_id, survivor_id AS new_id
FROM ranked
WHERE id <> survivor_id;

--> statement-breakpoint
UPDATE match_attendances a SET player_id = m.new_id
  FROM player_merge_map m WHERE a.player_id = m.old_id;
--> statement-breakpoint
UPDATE match_participants p SET player_id = m.new_id
  FROM player_merge_map m WHERE p.player_id = m.old_id;
--> statement-breakpoint
UPDATE ratings r SET rated_player_id = m.new_id
  FROM player_merge_map m WHERE r.rated_player_id = m.old_id;
--> statement-breakpoint
UPDATE ratings r SET rater_player_id = m.new_id
  FROM player_merge_map m WHERE r.rater_player_id = m.old_id;
--> statement-breakpoint
UPDATE mvp_votes v SET voter_player_id = m.new_id
  FROM player_merge_map m WHERE v.voter_player_id = m.old_id;
--> statement-breakpoint
UPDATE mvp_votes v SET nominated_player_id = m.new_id
  FROM player_merge_map m WHERE v.nominated_player_id = m.old_id;
--> statement-breakpoint
UPDATE pronos p SET player_id = m.new_id
  FROM player_merge_map m WHERE p.player_id = m.old_id;
--> statement-breakpoint
UPDATE pronos p SET prediction_mvp_player_id = m.new_id
  FROM player_merge_map m WHERE p.prediction_mvp_player_id = m.old_id;
--> statement-breakpoint
UPDATE prono_bets b SET player_id = m.new_id
  FROM player_merge_map m WHERE b.player_id = m.old_id;
--> statement-breakpoint
UPDATE rating_events e SET player_id = m.new_id
  FROM player_merge_map m WHERE e.player_id = m.old_id;
--> statement-breakpoint
UPDATE raw_initial_seed_ratings s SET player_id = m.new_id
  FROM player_merge_map m WHERE s.player_id = m.old_id;
--> statement-breakpoint
UPDATE card_photo_jobs j SET player_id = m.new_id
  FROM player_merge_map m WHERE j.player_id = m.old_id;
--> statement-breakpoint
UPDATE team_generation_players g SET player_id = m.new_id
  FROM player_merge_map m WHERE g.player_id = m.old_id;
--> statement-breakpoint
UPDATE matches x SET mvp_player_id = m.new_id
  FROM player_merge_map m WHERE x.mvp_player_id = m.old_id;

-- Repointing can collide with rows the survivor already owned. These uniques are
-- (match, player) scoped, so the duplicate is genuinely the same fact recorded twice.
--> statement-breakpoint
DELETE FROM match_attendances a USING match_attendances b
  WHERE a.match_id = b.match_id AND a.player_id = b.player_id AND a.id > b.id;
--> statement-breakpoint
DELETE FROM pronos a USING pronos b
  WHERE a.match_id = b.match_id AND a.player_id = b.player_id AND a.id > b.id;
--> statement-breakpoint
DELETE FROM match_participants a USING match_participants b
  WHERE a.match_id = b.match_id AND a.player_id = b.player_id AND a.id > b.id;
--> statement-breakpoint
DELETE FROM mvp_votes a USING mvp_votes b
  WHERE a.match_id = b.match_id AND a.voter_player_id = b.voter_player_id AND a.id > b.id;

--> statement-breakpoint
DELETE FROM players WHERE id IN (SELECT old_id FROM player_merge_map);
--> statement-breakpoint
DROP TABLE player_merge_map;

--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "players_group_id_user_id_unique";
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "players_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN IF EXISTS "group_id";
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_unique" UNIQUE("user_id");
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "skill_level" "skill_level" DEFAULT 'casual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "commitment_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "no_show_count" integer DEFAULT 0 NOT NULL;

-- Backfill commitments from the sheet so reliability isn't blank on day one.
--> statement-breakpoint
UPDATE players p SET commitment_count = GREATEST(p.match_count, sub.confirmed)
  FROM (
    SELECT player_id, COUNT(*)::int AS confirmed
    FROM match_attendances
    WHERE status = 'in' AND waitlist_position IS NULL AND player_id IS NOT NULL
    GROUP BY player_id
  ) sub
  WHERE p.id = sub.player_id;

-- ---------------------------------------------------------------------------
-- 2. Matches become the root entity
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" RENAME COLUMN "organizer_id" TO "host_id";
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60 NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "venue_name" text;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "city" text;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "visibility" "match_visibility" DEFAULT 'private' NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "open_spots" integer;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "skill_level" "skill_level" DEFAULT 'casual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "price_per_player" numeric(6, 2);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'EUR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_discovery_idx" ON "matches" ("visibility", "scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_geo_idx" ON "matches" ("latitude", "longitude");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_group_idx" ON "matches" ("group_id", "scheduled_at");

--> statement-breakpoint
ALTER TABLE "match_series" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "match_series" RENAME COLUMN "organizer_id" TO "host_id";
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "venue_name" text;
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "city" text;
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "visibility" "match_visibility" DEFAULT 'private' NOT NULL;
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "open_spots" integer;
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "skill_level" "skill_level" DEFAULT 'casual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "match_series" ADD COLUMN IF NOT EXISTS "price_per_player" numeric(6, 2);

-- ---------------------------------------------------------------------------
-- 3. Attendance provenance + the constraint that guards open joins
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "match_attendances" ADD COLUMN IF NOT EXISTS "source" "attendance_source" DEFAULT 'crew' NOT NULL;
--> statement-breakpoint
ALTER TABLE "match_attendances" ADD CONSTRAINT "match_attendances_match_player_unique" UNIQUE("match_id", "player_id");

-- ---------------------------------------------------------------------------
-- 4. Group scope becomes optional downstream; drop the never-wired column
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "ratings" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "team_generation_jobs" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "card_photo_jobs" ALTER COLUMN "group_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN IF EXISTS "searchable";
