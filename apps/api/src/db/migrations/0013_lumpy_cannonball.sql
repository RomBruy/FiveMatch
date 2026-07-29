CREATE TYPE "public"."series_frequency" AS ENUM('weekly', 'biweekly');--> statement-breakpoint
CREATE TABLE "match_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"frequency" "series_frequency" NOT NULL,
	"location" text,
	"format" "format_preset" NOT NULL,
	"players_per_team" integer NOT NULL,
	"goalkeeper_mode" "goalkeeper_mode" NOT NULL,
	"generator_style" "generator_style" DEFAULT 'pure_ovr' NOT NULL,
	"last_occurrence_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "match_series" ADD CONSTRAINT "match_series_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_series" ADD CONSTRAINT "match_series_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;