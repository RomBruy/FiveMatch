-- Phase 7C — durable notifications (outbox).
--
-- Fully additive: one enum, one table, one index. No DROP, no DELETE.
--
-- Sending was fire-and-forget: a transient provider failure, a network fault or
-- a restart mid-flight lost the notification permanently, leaving nothing behind
-- to show it had ever been attempted.

CREATE TYPE "notification_outbox_status" AS ENUM ('pending', 'sent', 'dead');
--> statement-breakpoint

CREATE TABLE "notification_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  -- The whole payload, so delivery needs nothing else to reconstruct it.
  "payload" jsonb NOT NULL,
  -- Optional idempotency key. A retried request or a job that runs twice
  -- collides here rather than notifying someone twice about one thing.
  "dedupe_key" text UNIQUE,
  "status" "notification_outbox_status" NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Kept for the dead-letter case: "it failed" is not a diagnosis.
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone
);
--> statement-breakpoint

-- The drain query: pending rows whose time has come, oldest first.
CREATE INDEX IF NOT EXISTS "notification_outbox_claim_idx"
ON "notification_outbox" ("status", "next_attempt_at");
