-- Migration: replace integer OVR columns with numeric(6,3) for float precision.
-- Pre-launch: no production data exists; existing rows lose integer values.
ALTER TABLE "players" DROP COLUMN "ovr_score";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "previous_ovr_score";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "ovr_score_float" numeric(6,3);--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "previous_ovr_score_float" numeric(6,3);
