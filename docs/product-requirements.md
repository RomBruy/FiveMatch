# FiveMatch Product Requirements

Status: Baseline approved; Phase 1 implemented and verified locally  
Last reviewed: 2026-08-06  
Scope: Match-first product, global player identity, crews, trust, privacy, and secondary engagement

## 1. Product objective

FiveMatch helps people organize and play five-a-side football. It must work for:

1. A solo player looking for a nearby match.
2. An organizer with an existing crew.
3. A crew that needs outside players to complete a match.

The primary promise is:

> Find a match, host your game, and fill missing spots with nearby players.

A match is the discoverable listing. FiveMatch must not create a second marketplace or a second inventory of places.

## 2. Success criteria

- A first-time visitor understands the product and sees a useful match in under 20 seconds.
- An eligible authenticated player can join from match detail in one action.
- A returning player can reach the next match and its required action in one tap.
- A returning organizer can immediately see missing confirmations, missing players, cancellations, waitlists, and missing results.
- A repeat host can create the next occurrence in a few taps by reusing prior settings.
- Confirmed attendance never exceeds capacity.
- A player has one global identity and can participate across any number of crews.

## 3. Product hierarchy

Core actions, in order:

1. Find a match.
2. Join or join the waitlist.
3. Host a standalone or crew match.
4. Manage confirmations, cancellations, remaining places, and the final lineup.
5. Maintain a crew and recurring schedule.

Secondary features must not block those actions:

- OVR and the player card belong in Profile and trust context.
- Reliability and level lead join decisions; OVR supports them.
- Pronostics have their own tab. Betting is placed inside an eligible match, but the bankroll, open markets and settled bets need one home; scattered across match detail they were unreachable and the balance was displayed nowhere.
- MVP, stories, and ceremonies belong after match completion.
- Crew leaderboards belong inside Crew, below operational match needs.

## 4. Intended navigation

### Jouer

- Nearby matches, Today, and This week.
- Date, radius, level, format, and price filters.
- Location permission, saved area, or manual area search without blocking the whole product.
- Match facts and a clear Join action.
- Host match as a visible secondary action.

### Mes matchs

- Needs your attention.
- Your next match.
- Upcoming hosted, joined, and waitlisted matches.
- Past matches.
- Clear role and status labels without separate navigation trees.

### Crew

- Crew switcher, create, and join.
- Next crew match and Host a match.
- Missing responses and open places.
- Members, invitations, roles, and administration.
- Schedule, history, and leaderboard.

### Pronos

- Bankroll balance.
- Open markets across every match the player is eligible for.
- Pending and settled bets.
- Crew bankroll leaderboard.

### Profil

- Identity, position, level, and preferences.
- Reliability, fair play, OVR, and their safe histories — owner-only detail per ADR-019.
- Player card and optional generated photo.

### Public profile exposure

A public profile shows the eligible match count and, once earned, a check mark. It does not show goals, assists, a reliability score, or anything derived from fair play. See ADR-019.
- Preferred area, travel radius, notification settings, and privacy controls.

## 5. Canonical first-time and returning journeys

### Solo player

Open Jouer -> use a cached/preferred area or choose GPS/manual area -> view real matches -> open detail -> Join -> authenticate only when committing -> return to the same match -> receive confirmed or waitlisted outcome.

Browsing and match understanding must not require a crew, ratings, a card, a photo, pronostics, or optional personality fields.

### Crew organizer

Crew -> Host match -> Repeat last/Next week/New setup -> confirm essential facts -> invite crew -> publish actual remaining capacity now or at a scheduled time -> manage final lineup.

### Crew missing players

Create one match -> collect crew responses -> show confirmed and remaining capacity -> publish the same match -> outside joins atomically reduce availability -> close or offer waitlist when full.

### Returning player

Open -> see next match and required action -> confirm/cancel, see waitlist position, or open directions.

### Returning organizer

Open -> see hosted matches requiring attention -> act on missing responses, open places, cancellations, waitlist, attendance deadline, or missing result.

## 6. Permanent requirement catalogue

These IDs are normative and are used by the audit, roadmap, and testing strategy.

### Identity and participation

- **PR-001 — Global player:** each account has exactly one global player profile.
- **PR-002 — Multiple crews:** a player may belong to multiple crews simultaneously.
- **PR-003 — Independent play:** crew membership must not restrict discovery, joining, or hosting outside that crew.
- **PR-004 — Global OVR:** one football OVR follows the player across all crews.
- **PR-005 — Standalone and crew hosting:** a player may host a standalone public match; a crew match requires the configured crew permission.

### Match, publication, and inventory

- **PR-006 — Match is listing:** discovery and publication use the match itself, never a marketplace copy.
- **PR-007 — Crew-first publication:** a crew match may start private and later publish actual remaining places.
- **PR-008 — Privacy-safe publication:** public availability must not expose pending members, private notes, internal attendance administration, or other private crew data.
- **PR-009 — Canonical capacity:** capacity, finalized confirmed attendance, and waitlist state are the availability source of truth.
- **PR-010 — Safe concurrency:** joins, cancellations, waitlist positions, and promotions are transactional, idempotent, deterministic, and never overfill a match.

### OVR, ratings, and reputation

- **PR-011 — Preserve OVR math:** do not change the existing OVR formula, weights, calibration, or mathematical constants.
- **PR-012 — Golden OVR guard:** protect the current OVR formula with golden tests before changing inputs or triggers.
- **PR-013 — Separate concepts:** OVR is ability, reliability is commitment, and fair play is behaviour; none is a substitute for another.
- **PR-014 — OVR isolation:** reliability, fair play, and pronostics never affect OVR.
- **PR-015 — Eligible ratings:** football ratings are allowed only for an attended opponent after a completed, valid match.
- **PR-016 — Forbidden ratings:** reject self, teammate, nonparticipant, nonattendee, cancelled-match, incomplete-match, and out-of-window ratings on the backend.
- **PR-017 — Rating uniqueness:** enforce one football rating per match, rater, and rated player with a database constraint.
- **PR-018 — Rating privacy:** never expose rater identity, individual scores, raw rating records, or reconstructable single-person data.
- **PR-019 — Safe aggregates:** a player may see safe averages, sample counts, trends, and confidence/sample bands.

### Attendance and fair play

- **PR-020 — RSVP separation:** pre-match RSVP and final attendance outcome are separate concepts.
- **PR-021 — Explicit outcomes:** final outcomes include attended, excused absence, and no-show.
- **PR-022 — Late arrival:** late arrival is stored separately from attendance outcome.
- **PR-023 — Behaviour records:** behaviour reports store match, reporter, subject, category, optional structured detail, resolution, validator, and timestamps.
- **PR-024 — Finalization gate:** disputed attendance or behaviour does not affect aggregates until finalized.
- **PR-025 — Conflict policy:** validation authority and conflicts involving an organizer must have an explicit auditable resolution path.

### Card eligibility

- **PR-026 — Four eligible matches:** the global player card unlocks after exactly four eligible completed matches.
- **PR-027 — Count once:** one match can contribute at most one card-eligibility record per player.
- **PR-028 — Eligibility definition:** a match counts only when completed with a valid result, the player is in the final participant snapshot, their final outcome is attended, and the match is not cancelled or voided.
- **PR-029 — Exclusions:** no-show, unused waitlist, cancelled, incomplete, and voided matches do not count.
- **PR-030 — OVR preservation during repair:** repairing card eligibility must not recompute or rewrite historical OVR values.
- **PR-031 — Global card:** the card belongs to the global player, never to one crew identity.

### Photo consent and lifecycle

- **PR-032 — Optional generation:** Panini-style photo transformation is optional and initiated by the player.
- **PR-033 — Current explicit consent:** processing requires current consent recording timestamp, policy version, purpose, retention, display visibility, and withdrawal support.
- **PR-034 — Withdrawal and deletion:** the owner can revoke consent and delete generated photos.
- **PR-035 — Storage erasure:** account deletion and GDPR purge remove generated files from object storage as well as database references.
- **PR-036 — Owner-only lifecycle:** consent, status, generation, deletion, and generated assets are owner-only unless visibility explicitly permits public display.
- **PR-037 — Image safety:** enforce input size/type/download/redirect limits, face detection, and moderation of input and output.

### Pronostics

- **PR-038 — Prono eligibility:** an eligible participant or active member of the associated crew may submit pronostics.
- **PR-039 — Preserve economy:** starting bankroll remains 1,000 and stake, odds, payout, refund, settlement, and ledger reconstruction arithmetic remain unchanged.

### Profiles and privacy

- **PR-040 — Separate DTOs:** private and public profile responses use separate DTOs and serializers.
- **PR-041 — Field visibility:** fun and identity fields have field-level audience controls, including third half, favorite excuse, special skill, locker-room style, clubs, profile photo, and other personality fields.
- **PR-042 — Conservative defaults:** new visibility settings default to private.
- **PR-043 — Reporter privacy:** a subject never receives reporter identity through direct or indirect APIs.

### Usability and operations

- **PR-044 — Fast value:** a new visitor sees a useful match within 20 seconds.
- **PR-045 — Deferred secondary setup:** OVR, ratings, cards, pronostics, and optional profile fields never block core match actions.
- **PR-046 — Obvious next action:** next-match and organizer-attention actions are immediately visible.
- **PR-047 — Progressive creation:** match creation shows essential fields before advanced settings and supports safe reuse.
- **PR-048 — Deep-link continuity:** authentication preserves the intended match, invitation, or notification destination.
- **PR-049 — Accessible language:** use football-oriented labels, accessible controls, field-specific errors, and consistent English/French copy.

### Architecture and correctness

- **PR-050 — Modular monolith:** retain the modular monolith until measured need justifies extraction.
- **PR-051 — Capability authorization:** sensitive operations are enforced by explicit server capabilities.
- **PR-052 — Shared contracts:** API schemas and DTOs are shared or generated; mobile handwritten response types must not drift.
- **PR-053 — Durable jobs:** reminders, rating closure, recurring materialization, notification delivery, and retries do not depend on read traffic or one process lifetime.
- **PR-054 — Safe migrations:** destructive migrations require isolated rehearsal, backup, validation, rollback/forward-fix planning, and must not run against existing development or production data during automated testing.
- **PR-055 — Existing design-system preservation:** preserve the established visual language, tokens, typography, spacing, radii, shadows, icons, cards, buttons, navigation, animation, hierarchy, naming, copy tone, responsiveness, accessibility, and existing theme behavior. Reuse or minimally extend existing primitives before creating UI; do not add an unrelated redesign or visual dependency.

### PR-055 acceptance criteria

- Existing screens remain visually consistent.
- Shared components and tokens are reused rather than duplicated.
- No visual dependency is added without explicit documented justification.
- Functional changes contain no unrelated redesign.
- Affected screens are checked at supported sizes.
- Accessibility is preserved or improved.
- Visual changes use screenshots or snapshot comparisons where supported.
- Any unavoidable deviation is listed and approved before implementation.
- Before modifying a screen, the implementation report records the existing pattern being reused, whether the change affects layout, styling, or behavior only, why it is required, and how consistency will be verified.

Preservation does not protect broken usability. Clearer labels, action ordering, privacy-safe information, validation, and missing states are allowed when required by another documented requirement, but must use the current design language.

## 7. Phase 1 implementation boundary

Phase 1 implements PR-015 through PR-017 and the strongest currently provable portion of PR-026 through PR-030:

- `player_match_eligibilities` is the canonical future record for a unique player/match completion. It requires a completed match, non-null result and membership in the final participant snapshot.
- Explicit final attendance and a first-class void state are not yet available. The Phase 1 evidence version is therefore `phase1_final_participant_v1`; it must not be described as proof of attendance. PR-015/016 nonattendee enforcement and PR-028/029 no-show/attended-only semantics remain incomplete until the attendance phase.
- `players.match_count` remains a transitional cached projection. Only a newly inserted canonical eligibility record may advance it; result and OVR paths may not increment it independently. Historical drift is reported and is not rewritten in Phase 1.
- Card state is derived from the active canonical eligibility count and unlocks at four unique records. Later invalidation/re-lock policy remains ADR-017.
- New initial crew ratings are disabled and non-blocking. Historical rows and OVR values are preserved. The long-term new-player seed source remains open under ADR-020.
- Ordinary crew removal ends only the selected membership and preserves the global player and all historical match, rating and pronostic evidence.

No Phase 1 implementation changes the OVR v2.3 mathematics/constants or any pronostic arithmetic/bankroll rule.

## 8. Phase 2 implementation boundary

Phase 2 implements the local privacy boundary for PR-008, PR-018/019, PR-040 through PR-043, PR-051/052 and PR-055:

- `/v1/players/me` returns a strict owner DTO; `/v1/players/:playerId` uses an independently defined audience-filtered public DTO.
- Profile photo, generated card photo, football identity and personality fields each use `private | group | participants | public`; missing/invalid settings are treated as `private`.
- `group` requires an active shared membership. `participants` requires a shared final-participant snapshot or two confirmed, non-waitlisted `in` rows. Former, `out`, `unknown` and waitlisted records do not qualify.
- Public match preview/discovery returns city, public availability and joinability only. Exact venue/address/coordinates, group identity, private notes/configuration and attendance identities are absent.
- Authenticated match and attendance responses are strict viewer, group, participant or manager variants selected by server capabilities.
- Public football attributes require four eligible rating samples. This visibility threshold does not change OVR inputs or mathematics.
- Owner OVR history is a sanitized date/result/direction/category projection and never returns internal event IDs, breakdowns, raters or individual values.
- Phase 2 makes no claim about finalized attendance/fair-play evidence and does not begin PR-020 through PR-025.

Migration `0017_phase2_privacy_boundaries.sql` is additive and was applied only to the disposable local test database. No real-data backfill or existing-environment migration is authorized.

## 9. Product metrics

- Median time to first useful match view: under 20 seconds; p90 under 45 seconds.
- Authenticated join API p95: under 500 ms.
- Over-capacity confirmations: zero.
- False-open discovery cards: below 0.5%, with zero internal state inconsistencies as the target.
- Repeat-match creation median: under 30 seconds.
- Match creation completion: above 70% for new setup and 85% for repeat setup.
- Crash-free mobile sessions: above 99.8%.
- Card eligibility duplicate events: zero.
- Rating/privacy DTO leakage incidents: zero.
- Reminder/job enqueue correctness: above 99.5%, with observable final delivery state.

## 9. Change control

Any change to PR-011 or PR-039 requires an explicit new product decision and is outside the approved implementation scope. Any deviation from PR-055 requires explicit approval before implementation. All other changes must update the traceability matrix in `docs/audit-findings.md`, tests in `docs/testing-strategy.md`, and the applicable architecture decision before being marked complete.
