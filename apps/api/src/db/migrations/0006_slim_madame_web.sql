CREATE TYPE "public"."card_photo_job_state" AS ENUM('idle', 'pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "card_photo_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"state" "card_photo_job_state" DEFAULT 'idle' NOT NULL,
	"idempotency_key" text NOT NULL,
	"photo_url" text,
	"error_message" text,
	"generation_month" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_photo_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "photo_consent_given" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "profile_photo_card_url" text;--> statement-breakpoint
ALTER TABLE "card_photo_jobs" ADD CONSTRAINT "card_photo_jobs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_photo_jobs" ADD CONSTRAINT "card_photo_jobs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;