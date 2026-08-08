-- Phase 6A — publication model and host participation (AF-007, ADR-018/032/033).
--
-- Fully additive: two columns. No DROP, no DELETE.
--
-- `open_spots` is NOT backfilled. Its meaning changes from "a separate pool of
-- public places" to "an optional cap on the places that actually remain", and
-- every existing value is still valid under the new reading. Rewriting them
-- would be guessing at hosts' intent.

-- Crew-first publishing. NULL with public visibility means public immediately,
-- which is how every existing public match already behaves.
ALTER TABLE "matches"
ADD COLUMN "public_opens_at" timestamp with time zone;
--> statement-breakpoint

-- Default true: a five-a-side host is almost always playing. Existing matches
-- inherit true, which matches reality for essentially all of them — and the
-- column only affects seeding at creation, so no past sheet is altered.
ALTER TABLE "matches"
ADD COLUMN "host_plays" boolean DEFAULT true NOT NULL;
