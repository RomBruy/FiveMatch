-- The match chat.
--
-- Fully additive: two new tables, one new enum, one index. Nothing existing is
-- touched — no DROP, no ALTER, no backfill.
--
-- Why the app needs this at all: organising happened in WhatsApp, so FiveMatch
-- only ever saw the click that said "I'm in" and never the twenty messages that
-- decide whether the match actually happens. A thread the app itself writes into
-- is what keeps the group inside the product between signing up and kickoff.
--
-- `kind` carries system events in the same fil as human messages, deliberately.
-- Teams drawn, a seat released, odds opening — those ARE the conversation, and
-- splitting them into an "activity" tab means nobody reads either. It also means
-- the thread is never empty: by the time someone opens it there are already
-- several rows, so speaking first costs nothing.
--
-- System rows store `meta` and no prose. Copy is rendered client-side from kind
-- + meta, so the thread follows the reader's language and wording stays fixable.
-- Freezing a rendered French sentence into history would lose both.
--
-- Reads are a high-water mark rather than per-message receipts: the only
-- question the product asks is "is there anything new for me", and one row per
-- player answers it instead of one row per player per message.

CREATE TYPE "match_message_kind" AS ENUM (
  'text',
  'player_joined',
  'player_withdrew',
  'waitlist_promoted',
  'teams_drawn',
  'odds_open',
  'result_recorded',
  'match_cancelled'
);

CREATE TABLE "match_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  -- Nullable: system rows have no author, and an erased player leaves their
  -- messages behind rather than tearing holes in someone else's conversation.
  "player_id" uuid REFERENCES "players"("id"),
  "kind" "match_message_kind" DEFAULT 'text' NOT NULL,
  "body" text,
  "meta" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Soft delete. A thread that silently reflows is how a group ends up arguing
  -- about what somebody actually said.
  "deleted_at" timestamp with time zone
);

-- The only read pattern there is: one match's thread, in order, paginated.
CREATE INDEX "match_messages_match_created_idx"
  ON "match_messages" ("match_id", "created_at");

CREATE TABLE "match_message_reads" (
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "match_message_reads_pkey" PRIMARY KEY ("match_id", "player_id")
);
