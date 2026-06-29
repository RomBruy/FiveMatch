ALTER TABLE "ratings" ADD COLUMN "match_id" uuid;--> statement-breakpoint
ALTER TABLE "match_attendances" ADD COLUMN "rating_reminder_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;