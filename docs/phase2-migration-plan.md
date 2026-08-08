# Phase 2 Migration Plan

Status: approved local implementation only  
Migration: `0017_phase2_privacy_boundaries.sql`  
Date: 2026-08-06

## Change

Add one `jsonb NOT NULL` column, `users.profile_field_visibility`, containing independent audience settings for every profile/photo/personality field in the Phase 2 catalogue. A database check accepts only `private`, `group`, `participants`, and `public`, and requires all current keys.

The default assigns `private` to every key. PostgreSQL can apply the constant default as metadata on supported versions; no application row-by-row backfill is part of this migration. Existing profile data therefore does not become visible.

## Read-only preflight

`apps/api/src/db/migrations/preflight/0017_phase2_privacy_boundaries_preflight.sql` reports only counts:

- total existing users;
- how many rows have each controlled field populated;
- how many players have a generated card photo;
- invalid visibility-shape count if a clone is partially migrated.

It does not select or print profile values. The preflight must run against an explicitly approved clone before any future non-local migration. Phase 2 local implementation does not authorize a real-data run.

## Conflicts and forward repair

An invalid or partial visibility object blocks application schema parsing and the database constraint. On an isolated clone, repair means rebuilding the object from the supported key list and mapping missing/unknown values to `private`. No automatic real-data repair or inference from populated fields is authorized.

## Rollback

Before dependent code is deployed, rollback is:

```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_profile_field_visibility_valid;
ALTER TABLE users DROP COLUMN IF EXISTS profile_field_visibility;
```

After dependent code is deployed, use a forward migration instead. Do not run the rollback against an environment without confirming the exact target and application version.
