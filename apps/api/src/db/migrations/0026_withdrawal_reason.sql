-- Why a player gave up a seat.
--
-- Fully additive: one enum and one nullable column. No DROP, no DELETE, no
-- backfill — every existing cancellation genuinely has no recorded reason, and
-- NULL says exactly that rather than inventing one.
--
-- `match_attendances.cancelled_at` already records *that* someone withdrew, and
-- finalization derives `excused` vs `late_cancel` from it against the crew's
-- deadline. What was missing is *why*, and the why is what makes withdrawing
-- socially cheaper than going silent: the organiser gets a sentence instead of
-- an unexplained gap, so nobody has to write an awkward message to ten people.
--
-- Deliberately a closed enum, not free text. Three options a person can pick in
-- one tap under time pressure — they are already late, that is the whole
-- situation — and no typing means no excuse-writing and no moderation surface.
--
--   unexpected — work, transport, family, health. The overwhelming majority.
--   injured    — distinct because it predicts the next few weeks too, and the
--                app can offer to stop nagging about upcoming fixtures.
--   wrong_date — not a withdrawal at all in spirit; they were never coming.
--                Kept separate so it never counts as a reliability signal.
--
-- Never used to compute reliability. `excused` vs `late_cancel` stays a function
-- of timing against the deadline (ADR-028); a self-declared reason is not
-- evidence, and making it load-bearing would just teach everyone to pick the
-- softest option.

CREATE TYPE "cancellation_reason" AS ENUM ('unexpected', 'injured', 'wrong_date');

ALTER TABLE "match_attendances" ADD COLUMN "cancellation_reason" "cancellation_reason";
