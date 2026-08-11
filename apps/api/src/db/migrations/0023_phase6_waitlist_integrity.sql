-- Phase 6B — waitlist ordering integrity (AF-005, AF-008).
--
-- Additive: one unique constraint. No DROP, no DELETE.
--
-- Positions are assigned behind a per-match row lock, so a duplicate should
-- already be impossible. This makes it impossible rather than merely unlikely:
-- if the lock is ever bypassed by new code, the write fails loudly instead of
-- silently seating two people in the same place in the queue.
--
-- NULLs are distinct in Postgres, so confirmed players (position NULL) do not
-- collide with one another.

ALTER TABLE "match_attendances"
ADD CONSTRAINT "match_attendances_match_waitlist_position_unique"
UNIQUE ("match_id", "waitlist_position");
