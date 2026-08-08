# Phase 1 Additive Migration Plan

Status: Implemented and rehearsed on disposable local PostgreSQL only; no real-data migration/backfill

## Objects

1. Table `player_match_eligibilities`: UUID primary key; `match_id` and `player_id` no-action foreign keys; non-null `evidence_version`; creation timestamp; nullable invalidation timestamp/reason; constraint `player_match_eligibilities_match_player_unique`; index `player_match_eligibilities_player_idx`.
2. Table `ovr_processing_events`: UUID primary key; `match_id` and `player_id` no-action foreign keys; non-null `processing_type`; processing timestamp; constraint `ovr_processing_events_match_player_type_unique`; index `ovr_processing_events_player_idx`.
3. Nullable column `rating_events.match_id` plus no-action foreign key to `matches.id`; historical rows remain null. Unique index `rating_events_match_player_type_unique` protects non-null match/player/event identities.
4. Unique index `ratings_match_rater_rated_unique` protects `(match_id, rater_player_id, rated_player_id)`. PostgreSQL null semantics preserve historical initial rows with no match/rater.

Migration file: `apps/api/src/db/migrations/0016_phase1_integrity.sql`. Read-only preflight: `apps/api/src/db/migrations/preflight/0016_phase1_integrity_preflight.sql`.

## Duplicate/conflict preflight

The read-only preflight must report counts and internal IDs for:

- multiple `ratings` rows sharing non-null match/rater/target;
- duplicate non-null player rows in a match participant snapshot;
- multiple historical `MATCH_UPDATE` events whose JSON breakdown identifies the same match/player;
- post-match ratings whose rater/target is missing, identical, absent from the snapshot, on the same team, or attached to a non-completed/incomplete match.

The local synthetic suite intentionally classifies duplicate fixtures in a temporary unconstrained table and separately proves the final constraints reject duplicates. A future real-data migration is blocked by any unexplained preflight conflict.

## Forward-fix strategy

No migration deletes, merges, rewrites or guesses historical rows. Future real-data conflicts must be classified and resolved through an approved deterministic backfill/manual-review plan before the unique constraint is applied. Runtime inserts use conflict-safe deterministic responses.

## Rollback limitation

The migration is additive and application code can stop reading/writing the new objects. Once new eligibility/processing evidence exists, dropping the tables or constraints would discard the integrity boundary and is not an acceptable routine rollback. Use a compatible application rollback or reviewed forward fix. Historical OVR and pronostic data are never recomputed.

## Local rehearsal result — 2026-08-06

The full migration journal through `0016` applied successfully to the separately named tmpfs-backed `fivematch_test` container. Deterministic fixtures proved duplicate classification, live uniqueness, concurrent conflict handling and idempotent replay. The normal application `DATABASE_URL` was explicitly unset. This is not evidence that an existing environment is conflict-free and does not authorize deployment.
