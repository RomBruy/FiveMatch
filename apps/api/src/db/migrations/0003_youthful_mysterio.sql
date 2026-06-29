CREATE TABLE "mvp_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"voter_player_id" uuid NOT NULL,
	"nominated_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mvp_votes_match_voter_unique" UNIQUE("match_id","voter_player_id")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "mvp_player_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "mvp_voting_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_attendances" ADD COLUMN "mvp_reminder_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mvp_votes" ADD CONSTRAINT "mvp_votes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_votes" ADD CONSTRAINT "mvp_votes_voter_player_id_players_id_fk" FOREIGN KEY ("voter_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mvp_votes" ADD CONSTRAINT "mvp_votes_nominated_player_id_players_id_fk" FOREIGN KEY ("nominated_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;