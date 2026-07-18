ALTER TABLE "users" ADD COLUMN "current_club" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "former_club" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_position" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "strong_foot" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "player_style" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "team_a_ovr_at_lock" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "team_b_ovr_at_lock" numeric(5, 2);