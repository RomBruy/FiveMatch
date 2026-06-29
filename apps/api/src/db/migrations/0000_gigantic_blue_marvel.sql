CREATE TYPE "public"."format_preset" AS ENUM('5v5', '6v6', '7v7', 'custom');--> statement-breakpoint
CREATE TYPE "public"."generator_style" AS ENUM('pure_ovr', 'position_aware', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."goalkeeper_mode" AS ENUM('fixed', 'rotating', 'none');--> statement-breakpoint
CREATE TYPE "public"."play_style" AS ENUM('fixed', 'flexible', 'rotating', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('organizer', 'member', 'pending_member');--> statement-breakpoint
CREATE TYPE "public"."card_state" AS ENUM('not_started', 'in_progress_1', 'in_progress_2', 'in_progress_3', 'unlocked');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('planning', 'attendance_open', 'attendance_locked', 'teams_generated', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('in', 'out', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."team_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."team_gen_job_status" AS ENUM('processing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"profile_photo_url" text,
	"language_preference" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"format_preset" "format_preset" NOT NULL,
	"goalkeeper_mode" "goalkeeper_mode" NOT NULL,
	"play_style" "play_style",
	"generator_style" "generator_style" DEFAULT 'pure_ovr' NOT NULL,
	"tier" text DEFAULT 'amateur' NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"invite_code" text,
	"searchable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "group_memberships_group_id_user_id_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"ovr_score" integer,
	"card_state" "card_state" DEFAULT 'not_started' NOT NULL,
	"avg_pace" numeric(5, 2),
	"avg_technique" numeric(5, 2),
	"avg_passing" numeric(5, 2),
	"avg_defending" numeric(5, 2),
	"avg_physicality" numeric(5, 2),
	"avg_effort" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "players_group_id_user_id_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_user_id_token_unique" UNIQUE("user_id","token")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_type_unique" UNIQUE("user_id","type")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"rater_player_id" uuid,
	"rated_player_id" uuid NOT NULL,
	"pace" integer NOT NULL,
	"technique" integer NOT NULL,
	"passing" integer NOT NULL,
	"defending" integer NOT NULL,
	"physicality" integer NOT NULL,
	"effort" integer NOT NULL,
	"mentality" integer NOT NULL,
	"is_initial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'attendance_open' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location" text,
	"format" "format_preset" NOT NULL,
	"players_per_team" integer NOT NULL,
	"goalkeeper_mode" "goalkeeper_mode" NOT NULL,
	"generator_style" "generator_style" DEFAULT 'pure_ovr' NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"match_full_notified" boolean DEFAULT false NOT NULL,
	"attendance_reminder_sent" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"rating_window_closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid,
	"status" "attendance_status" DEFAULT 'unknown' NOT NULL,
	"waitlist_position" integer,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"team_side" "team_side" NOT NULL,
	"position" text,
	"was_goalkeeper" boolean DEFAULT false NOT NULL,
	"goals_scored" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"match_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"status" "team_gen_job_status" DEFAULT 'processing' NOT NULL,
	"generation_number" integer NOT NULL,
	"fairness_score" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_generation_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "team_generation_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"player_id" uuid,
	"team_side" "team_side" NOT NULL,
	"ovr_at_generation" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rated_player_id_players_id_fk" FOREIGN KEY ("rated_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_attendances" ADD CONSTRAINT "match_attendances_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_attendances" ADD CONSTRAINT "match_attendances_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_generation_jobs" ADD CONSTRAINT "team_generation_jobs_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_generation_jobs" ADD CONSTRAINT "team_generation_jobs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_generation_players" ADD CONSTRAINT "team_generation_players_job_id_team_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."team_generation_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_generation_players" ADD CONSTRAINT "team_generation_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;