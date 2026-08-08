# Phase 2 Completion Report — Privacy and Permissions

Date: 2026-08-06  
Environment: isolated local workspace and disposable `fivematch_test` PostgreSQL only  
Status: implementation complete locally; final unrestricted verification rerun pending

## 1. Executive summary

Phase 2 replaces broad internal-object responses with explicit, strict, viewer-shaped contracts for profiles, match previews/details and attendance. Profile fields default private, rating evidence stays internal, public aggregates require four eligible samples, and authorization is calculated from canonical relationship state rather than the mere presence of an attendance row.

No production, staging, Hetzner, Backblaze, normal development database or real data was accessed. No deployment, real-data backfill, Phase 3 attendance/fair-play model, OVR formula change, pronostic calculation change or redesign occurred.

The code, shared contracts, additive migration, mobile consumers and documentation are complete. Static/mobile checks pass and the isolated migration/preflight passed. The final unrestricted API and expanded integration rerun remains outstanding because this runner denied local ephemeral sockets after its execution allowance was exhausted.

## 2. Files changed

The Phase 2 work is grouped as follows:

- Shared contracts: `packages/types/src/privacy-contracts.ts`, package exports/dependency metadata.
- Database: users schema, migration `0017_phase2_privacy_boundaries.sql`, migration journal and read-only preflight.
- Authorization/privacy services: capability resolver, profile privacy evaluator and owner/public player-profile service.
- API surfaces: player, match, attendance, public-preview, group, rating/pronostic-context and card-status routes/services.
- Tests/fixtures: capability, serializer, recursive contract, route-permission and deterministic PostgreSQL audience fixtures/suites.
- Mobile: shared match/profile types, owner/public profile, match/public-preview and group consumers, plus `ProfileVisibilityControls`.
- Documentation: product, architecture, data, privacy, scoring, match/group, roadmap, testing, audit traceability, migration/design records and this report.

The worktree also contains accepted Phase 0/1 and user changes; those were preserved and are not all attributable to Phase 2.

## 3. Migrations and database fields

Migration `0017_phase2_privacy_boundaries.sql` additively creates `users.profile_field_visibility JSONB NOT NULL`. Its constant default sets every supported key to `private`; a database check requires the complete key set and permits only `private`, `group`, `participants` or `public`.

The read-only preflight reports counts only and works before or after the column exists. The migration journal through `0017` and the preflight passed only on disposable tmpfs PostgreSQL; no existing-record migration or backfill was performed. A future existing-environment run requires an explicitly approved clone, preflight review and separate authorization.

## 4. Private profile contract

`PrivatePlayerProfileSchema` is the owner-only contract. It includes the global player/profile identity, all personal and fun fields, complete visibility settings, global OVR, sanitized OVR history, current reliability summary, completed eligible-match/card state, bankroll, rating sample count and threshold-safe aggregate attributes.

It excludes raw rating rows/scores, rater or reporter identity, internal rating/OVR-processing identifiers, raw breakdowns, migration metadata and any value from which one person's submission can be reconstructed.

## 5. Public profile contract

`PublicPlayerProfileSchema` is independently defined and allow-listed. It contains stable player identity/display data, public-safe match/card/OVR/reliability summaries, sample count, threshold-safe aggregate attributes and only fields permitted for the resolved viewer relationship.

It has no visibility-settings object, bankroll, OVR history, account/contact/deletion metadata, raw evidence or internal identifiers. The public player screen no longer attaches the viewer's active crew to the subject.

## 6. Profile visibility model

Visibility is evaluated independently for profile photo, generated card photo, current/former club, preferred position, strong foot, player style, special skill, favorite excuse, bad-faith level, locker-room style and third-half profile.

Audiences are not hierarchical shortcuts:

- `private`: owner only.
- `group`: owner or active shared-group member.
- `participants`: owner or a viewer sharing a final participant snapshot/confirmed non-waitlisted match.
- `public`: any viewer.

Missing, partial or invalid settings normalize to the complete all-private value. Former membership, waitlist, `out` and `unknown` do not qualify. Multiple groups are checked for an actual shared active relationship.

## 7. Viewer capability model

The central resolver returns explicit profile/match capabilities, including private/group/participant field access, private match detail, roster, waitlist/pending administration, attendance management, private notes, rating and pronostic submission.

Inputs are the host, active associated-group role, confirmed non-waitlisted RSVP, final participant snapshot, publication, capacity and relevant match state. Relationship labels are context only. An ordinary group member is not promoted to participant; an associated-group organizer is a manager; ambiguous state selects the least revealing serializer.

## 8. Public match-preview contract

`PublicMatchPreviewSchema` exposes match ID, schedule/duration, format/level, price, city-level location, public status, capacity/availability/waitlist state, joinability and an approved host display summary.

It excludes exact venue/address/coordinates, group ID/name, roster or attendance identities, pending/declined/waitlisted identities, attendance source, organizer/private notes, generator configuration, contact data and processing fields. A private-group match may publish its actual outside availability without publishing private group information.

## 9. Authenticated match-detail contracts

Strict contracts are selected server-side:

- Viewer: the public-safe fields only.
- Active group member: public fields plus associated group ID/name and permitted score summary, but no exact venue or roster merely because of membership.
- Confirmed/final participant: exact location, approved confirmed/final roster and result.
- Host or active associated-group organizer: participant detail plus attendance administration, private notes and configuration.

The API never sends one complete internal match object for mobile to hide.

## 10. Attendance privacy changes

Viewer/group attendance responses contain counts and the caller's own state only. Participant responses may add confirmed/final participant identities. Manager responses may add pending, waitlist, out and source administration.

Waitlisted/pending identities and private membership information are absent from public/unrelated endpoints. Group DTOs use purpose-specific `groupId`, `memberId`, `requestId` and `playerId` values rather than exposing account `userId` as a public control identifier.

## 11. Rating aggregate privacy

`PUBLIC_RATING_AGGREGATE_MIN_SAMPLE` is defined once and set conservatively to `4`. It is a visibility policy only. Eligible samples are non-initial completed-match opponent ratings backed by canonical eligibility and opposing final sides.

Sample count may be shown, but aggregate football attributes are `null` below four samples. No rater ID, individual score, raw row/event or precisely identifying submission timestamp is serialized. Owner OVR history contains only coarse date, rounded result, direction, optional match reference and `match_update` category.

## 12. Mobile changes

Mobile consumes the separate shared profile/match/attendance contracts. The owner Profile screen reads `/players/me` and adds per-field visibility choices; the public player screen uses only the public DTO; public sharing uses city rather than exact venue; match/group consumers handle the capability-shaped and purpose-ID responses.

Unavailable optional fields are omitted cleanly so no `undefined`, empty label or hidden-value marker is rendered. No new tab or navigation concept was introduced.

## 13. Design-system impact

PR-055 was preserved. `ProfileVisibilityControls` composes the existing `Chip`, card, token, typography, spacing, loading and error patterns. Other screen changes are data/behavior adaptations.

No visual dependency, palette, typography, spacing scale, radius, shadow, icon system, animation system, component library or unrelated layout was added. Baseline verification remains 13 primitives, 4 tabs and 52 direct dependencies. The repository has no approved screenshot renderer; compact/large behavior received source-level safe-area/flex/wrap/scroll review, while device screenshots and screen-reader checks remain manual release items. There is no design deviation.

## 14. Privacy impact

The server now minimizes data before serialization. The principal Phase 2 exposures—shared owner/public player loaders, public attendance identities, exact venue/group leakage, viewer-crew decoration, raw identifier-shaped group controls and under-sampled aggregates—are closed locally.

Card-photo status is owner-checked. Photo consent versioning/withdrawal, generated-object deletion/moderation and future attendance/fair-play reporter projections remain explicitly open.

## 15. Exact test results

Executed on 2026-08-06:

- API TypeScript: passed.
- API ESLint: passed.
- Shared-types TypeScript/ESLint: passed.
- Mobile test command: 3/3 units passed; 638 English and 638 French keys; design baseline 13 primitives, 4 tabs, 52 dependencies; TypeScript passed.
- Mobile ESLint: 0 errors; 1 pre-existing generated Expo Router unused-disable warning.
- Isolated migration journal through `0017`: passed earlier in this Phase 2 run.
- `0017` read-only preflight on the isolated empty target: passed with zero affected and zero invalid rows.
- Last unrestricted API run before the two owner-only card route tests: 40 files / 317 tests passed.
- Current restricted API run: 41 files / 319 tests collected; 23 files / 217 non-socket tests passed. The remaining 18 files / 102 Supertest tests stopped before assertions because the sandbox denied `listen` on an ephemeral local socket (`EPERM`).
- Phase 2 PostgreSQL integration file: its earlier six deterministic cases passed. The final expanded six-case form, which adds anonymous preview, multiple-group and sanitized-history assertions, has not been rerun due the same runner permission/allowance limit.

Required final rerun before promotion:

```sh
pnpm --filter @fivematch/api test
TEST_DATABASE_URL=postgresql://fivematch_test:fivematch_test@127.0.0.1:55432/fivematch_test pnpm --filter @fivematch/api test:integration
```

This report does not treat sandbox-blocked tests as passing.

## 16. OVR regression confirmation

The current restricted run passed all 53 existing OVR service tests and all 4 OVR golden-regression tests. No OVR constant, weight, calibration anchor, formula, persistence output or history was rewritten. Phase 2 adds only an output-visibility threshold, which is not imported by OVR calculation paths.

## 17. Pronostic regression confirmation

The current restricted run passed 20 odds-engine, 16 bankroll-service, 17 bet-service and 3 pronostic golden-regression tests (56 pure pronostic tests). The starting 1,000-point bankroll, odds, payout, close-refund and settlement arithmetic remain unchanged. Route tests were among the socket-blocked cases and require the final unrestricted rerun.

## 18. Remaining risks

- Final API route and expanded PostgreSQL suite evidence is incomplete because of the local-socket execution restriction.
- Explicit finalized attendance/late/no-show/void evidence does not exist; current participant evidence remains the strongest truthful Phase 1 boundary.
- Public match expiry/cancellation/capacity concurrency still needs the later canonical availability work.
- Photo consent, moderation and object deletion lifecycle remain incomplete.
- The four-sample privacy threshold is documented but remains a product policy subject to future approval.
- Manual device-size, screen-reader and screenshot review remains required before release.
- Migration `0017` has no existing-environment evidence and must not be applied there without a new approval.

## 19. Deferred work

Phase 3 attendance outcomes, late arrival, behaviour/fair-play reports, disputes, validator authority and reporter-safe projections are deferred. Capacity/waitlist concurrency, broader discovery lifecycle, photo-processing lifecycle, durable jobs, operational infrastructure and all real-data reconciliation remain in their documented later phases.

Historical records were not inferred, republished, backfilled or recomputed.

## 20. Whether Phase 3 is safe to begin

Not yet. The Phase 2 implementation forms the intended local privacy baseline, but Phase 3 should begin only after the final 319-test API run and the final expanded isolated PostgreSQL integration suite both pass in an environment permitted to open local loopback sockets. Phase 3 also requires separate explicit approval; this work did not begin it.
