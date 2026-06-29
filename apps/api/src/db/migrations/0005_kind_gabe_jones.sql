ALTER TABLE "players" ADD COLUMN "previous_ovr_score" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "player_tier" text DEFAULT 'rookie' NOT NULL;