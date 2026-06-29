CREATE TYPE "public"."prediction_result" AS ENUM('teamA', 'draw', 'teamB');--> statement-breakpoint
CREATE TABLE "pronos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"prediction_result" "prediction_result" NOT NULL,
	"prediction_mvp_player_id" uuid,
	"prediction_score" text NOT NULL,
	"points_earned" integer,
	"submitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pronos_match_player_unique" UNIQUE("match_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pronos" ADD CONSTRAINT "pronos_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronos" ADD CONSTRAINT "pronos_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pronos" ADD CONSTRAINT "pronos_prediction_mvp_player_id_players_id_fk" FOREIGN KEY ("prediction_mvp_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;