-- Phase 5 — Panini photo lifecycle (PR-032..037, rules 35-40, ADR-030).
--
-- Fully additive: one table, three columns, one index. No DROP, no DELETE.
-- `players.photo_consent_given` is deliberately left in place and kept in sync;
-- the consent table is the record of truth, but removing the boolean would be a
-- destructive change to a column other code still reads.

CREATE TABLE "photo_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  -- The policy text version the player actually saw. A consent under an older
  -- version is an agreement to different terms and is not treated as current.
  "policy_version" text NOT NULL,
  "purpose" text NOT NULL,
  "retention_days" integer NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "withdrawn_at" timestamp with time zone
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "photo_consents_player_idx"
ON "photo_consents" ("player_id", "granted_at");
--> statement-breakpoint

-- Existing consents are migrated as a distinct legacy version so they are NOT
-- treated as current. Those players are asked once, under text that actually
-- states purpose and retention — the boolean recorded neither, so carrying it
-- forward as informed consent would be a claim the data cannot support.
INSERT INTO "photo_consents" ("player_id", "policy_version", "purpose", "retention_days", "granted_at")
SELECT "id", 'legacy_boolean', 'panini_card_portrait_generation', 0, COALESCE("created_at", now())
FROM "players"
WHERE "photo_consent_given" = true;
--> statement-breakpoint

-- The generated object's key, so erasure never has to parse a URL to find it.
ALTER TABLE "card_photo_jobs"
ADD COLUMN "storage_key" text;
--> statement-breakpoint

-- Backfill keys for already-generated photos, which follow a fixed layout.
-- Without this, every photo generated before Phase 5 would be undeletable.
UPDATE "card_photo_jobs"
SET "storage_key" = 'card-photos/' || "id"::text || '.png'
WHERE "photo_url" IS NOT NULL AND "storage_key" IS NULL;
--> statement-breakpoint

-- The source photo, separate from the generated one. They shared a column, so a
-- second generation restyled the already-stylized output instead of the original.
ALTER TABLE "players"
ADD COLUMN "profile_photo_source_url" text;
