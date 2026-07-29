CREATE TYPE "public"."prono_bet_market" AS ENUM('result', 'score', 'mvp');--> statement-breakpoint
CREATE TYPE "public"."prono_bet_status" AS ENUM('pending', 'won', 'lost', 'close');--> statement-breakpoint
CREATE TABLE "prono_bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"market" "prono_bet_market" NOT NULL,
	"selection" text NOT NULL,
	"stake" integer NOT NULL,
	"odds_at_bet" numeric(6, 2) NOT NULL,
	"status" "prono_bet_status" DEFAULT 'pending' NOT NULL,
	"payout" integer,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "pronos_balance" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "prono_bets" ADD CONSTRAINT "prono_bets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prono_bets" ADD CONSTRAINT "prono_bets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prono_bets_match_id" ON "prono_bets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_prono_bets_player_id" ON "prono_bets" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_prono_bets_match_status" ON "prono_bets" USING btree ("match_id","status");