# Architecture Decisions

Status: Living decision log
Last reviewed: 2026-08-06

Each decision is either **Accepted** (normative), **Proposed** (requires implementation review), or **Open** (product decision unresolved).

## ADR-001 — Modular monolith

Status: Accepted

Keep the Expo mobile app and Express/Drizzle/PostgreSQL API as a modular monolith. Split oversized route/service files by domain responsibility, but do not introduce microservices without measured operational or scaling evidence.

Consequences:

- One transactional database remains the integrity boundary.
- Domain modules expose services/DTOs rather than sharing route internals.
- Background work may run in a separate worker process while remaining in the same codebase and database.

## ADR-002 — Global player identity

Status: Accepted

`players.user_id` is globally unique. Crew membership is many-to-many through `group_memberships`. OVR, card, bankroll, reliability, and fair-play projections attach to the global player.

Migration `0015_match_first_pivot.sql` expresses this direction but is not approved for production execution until its merge rules, soft-deleted duplicates, idempotency claims, backup, and validation procedure are corrected and rehearsed.

## ADR-003 — Match is the discoverable listing

Status: Accepted

Do not create a marketplace/listing entity. A nullable `matches.group_id` supports standalone and crew-associated matches. Publication state controls whether the same match is discoverable.

## ADR-004 — Match publication is not inventory

Status: Proposed

Represent crew-first operation with private/public state, optional `public_opens_at`, and an optional public-seat limit. Actual availability is derived from canonical match capacity and attendance under transaction. Do not maintain a disconnected public-place counter.

## ADR-005 — Capability-based authorization

Status: Proposed

Replace authorization based directly on broad `MatchRelation` labels with server-calculated capabilities. Relationship remains useful context; capability is the enforcement result.

Capabilities must be shared by read serializers and mutation guards so a public viewer cannot obtain internal data simply because a route reused an internal DTO.

## ADR-006 — OVR mathematics are frozen

Status: Accepted

OVR formula and constants remain unchanged. Changes may repair eligible inputs, authorization, trigger idempotency, and duplicated counters only after golden tests establish current formula behavior.

Reliability, fair play, and pronostics remain outside the OVR dependency graph.

## ADR-007 — Separate reputation evidence

Status: Proposed

Football ratings, RSVP, final attendance, late arrival, and behaviour reports use separate records. Reliability and fair-play projections consume only finalized evidence. Disputes do not affect aggregates.

## ADR-008 — Unique eligibility/event records over mutable counters

Status: Accepted and implemented for Phase 1 future writes

Card unlock and OVR processing require per-player/per-match unique records. Cached counts may exist for display but are projections, not the sole integrity mechanism.

Phase 1 implements `player_match_eligibilities UNIQUE(match_id, player_id)` and `ovr_processing_events UNIQUE(match_id, player_id, processing_type)`. `players.match_count` remains a transitional cache advanced only after a canonical eligibility insert; drift is observable and historical values are not reconciled without a separately approved real-data plan.

Historical OVR is never recomputed as part of card counter repair. Phase 1 evidence is explicitly versioned because final attendance does not yet exist; the later attendance phase strengthens the evidence without replacing the ledger.

## ADR-009 — Separate public and private DTOs

Status: Accepted

Public player, private owner, public match, participant match, and host administration responses are separate explicit schemas/serializers. Internal database rows are never returned wholesale.

Contracts should be shared from validated schemas or generated into the mobile client.

## ADR-010 — PostgreSQL is the concurrency boundary

Status: Proposed

Join, waitlist, cancellation, and promotion execute through one consistent transaction/locking strategy with database unique constraints and idempotency keys. Application-only counts are insufficient.

## ADR-011 — Durable outbox and jobs

Status: Proposed

Use PostgreSQL-backed job/outbox records for reminders, rating-window closure, recurring materialization, notification delivery, and object deletion. Jobs have unique deduplication keys, retry state, and observable terminal outcomes.

This does not require a microservice; one worker deployment is sufficient.

## ADR-012 — Geographic discovery abstraction

Status: Accepted

Keep numeric latitude/longitude initially. Place bounding-box, exact-distance, joinability, pagination, and ranking logic behind a discovery repository. Adopt grid/geohash or PostGIS only when measured city density/query plans justify it.

## ADR-013 — Pronostic arithmetic is frozen

Status: Accepted

The 1,000-point bankroll, stake rules, odds handling, payout rounding, close refund, settlement, and ledger reconstruction remain unchanged. Only capability enforcement and contract/testing gaps may change in current scope.

## ADR-014 — Photo lifecycle is global and consented

Status: Proposed

Card-photo settings live under global Profile. Consent is versioned and withdrawable. Raw input and generated output use distinct fields/objects. Every lifecycle endpoint is owner-only unless display visibility explicitly allows the asset. GDPR purge includes object deletion.

## ADR-015 — Additive migration strategy

Status: Accepted

Prefer additive columns/tables, dual-read or backfill reports, validation, then controlled cutover. Destructive migrations require:

- isolated restored clone;
- preflight report;
- backup;
- validation queries;
- tested rollback or forward-fix plan;
- explicit approval before existing data is changed.

## ADR-016 — Integration database isolation

Status: Accepted

Integration tests use a dedicated `TEST_DATABASE_URL` guarded against non-test database names/hosts. Test setup applies migrations only to a disposable database or schema. The application `DATABASE_URL` is never used for destructive test setup.

Phase 0 implements this with a guarded setup module, guarded migration wrapper and an ephemeral `docker-compose.test.yml` PostgreSQL service. The integration config serializes files and includes every `*.test.ts` below its integration directory.

## ADR-017 — Card invalidation after unlock

Status: Accepted

A card never re-locks. Once unlocked it stays unlocked, even if a later void drops active eligibility below four.

This codifies behaviour the code already had rather than changing it: `eligibility.service.ts` has always computed `nextCardState` as `unlocked` when the current state is `unlocked`, whatever the count says.

Rationale: the card reveal is the product's best moment and the reward the whole four-match arc builds toward. Taking it back is a uniquely bad experience, and an invalidation is usually administrative rather than the player's fault — a host voided a fixture, a result was corrected. The correction is still recorded honestly in the ledger, with its reason and actor; it simply does not reach backward into something already given.

Consequences:

- Eligibility count and card state can legitimately disagree after an invalidation. The ledger is the audit truth; `players.card_state` is a high-water mark.
- Anything reporting on eligibility must read the ledger, never infer a count from card state.
- Re-locking would need both an explicit product decision and a migration for the notifications already sent.

## ADR-029 — Automatic attendance finalization

Status: Accepted

A completed match whose attendance is still unfinalized `CARD_AUTO_FINALIZE_HOURS` (48) after completion is finalized by the system, with `finalized_by` null.

Phase 4 makes card eligibility depend on a finalized `attended` outcome, which is the correct evidence bar. Without this, a player's card progression would hang on whether their host remembered to confirm the sheet — punishing the player for someone else's admin. Automatic finalization derives outcomes from the same stored facts a host would have confirmed; it decides nothing a manual pass would not have.

A host who finalizes late finds nothing left to settle: finalization only ever touches rows that are still unsettled, so the automatic and manual paths cannot disagree.

## ADR-018 — Host participation

Status: Accepted

A host plays by default. Match creation seeds the host as `in`, counts them against capacity, and offers an explicit non-playing toggle.

Consequences:

- A non-playing host keeps `canManageAttendance` but gains no rating eligibility, because they are absent from the final participant snapshot.
- `canSubmitProno` extends to the host. The current predicate (`isParticipant || isGroupMember`) would otherwise lock a non-playing host out of betting on a standalone match they created.
- Capacity copy at creation states whether the host occupies a place.

## ADR-019 — Reliability and fair-play formulas

Status: Accepted

Both projections read finalized records only and live in `packages/types/src/trust-constants.ts` with their own version string.

They must never enter `algorithm-constants.ts`. The OVR golden regression freezes `ALGORITHM_CONSTANTS_VERSION` by exact value, so adding a trust constant there would break the guard that protects the OVR formula. A `trust-signal-isolation` test asserts no OVR path imports the trust module, mirroring the existing `pronos-signal-isolation` test.

### Reliability

Rolling window of the last 20 finalized matches, exponential recency decay with a half-life of 10 matches. Score is the weighted mean × 100.

| Outcome | Weight |
|---|---|
| `attended` | 1.0 |
| `excused` — first two inside the window | 1.0 |
| `excused` — third and beyond | 0.7 |
| `attended` with `arrivedLate` | 0.85 |
| `late_cancel` | 0.3 |
| `no_show` | 0.0 |

The two-excuse allowance is scoped to the window, so it refreshes as old records age out. No separate counter is stored.

### Fair play

Starts at 100. Severity-weighted finalized negatives subtract across the same 20-match window; positives add and are capped at +10. Clamped to 0–100.

Categories — negative: `dangerous_play`, `aggression`, `abusive_language`, `unsporting`. Positive: `good_spirit`, `helped_organize`.

A single uncorroborated report never moves the score. It counts only once a validator finalizes it (ADR-027) or at least two independent reporters in the same match agree. One grudge must not be able to move another player's standing.

### Exposure

Reliability and fair play are computed for everyone but are not public reputation displays.

| Audience | Reliability | Fair play |
|---|---|---|
| Public profile | Match count, plus an earned check mark | Nothing |
| Host reviewing a join request | Coarse, recent-only, at the decision point | Nothing |
| Owner | Full score, history, and cause of change | Full, including their own submitted reports |
| Dispute validator | — | Only the report under review |

The public profile carries `eligibleMatchCount` and a boolean check mark. Goals and assists are not published. `PublicPlayerProfileSchema.reliability` is removed — a raw public score is exactly the exposure this decision rejects.

The check requires at least 8 finalized matches, so most players without it simply have not played enough yet. **Absence of the mark must never become a reliable negative signal**; if tuning ever makes absence read as "unreliable", the threshold is wrong. The mark carries a tap-to-reveal label so it is not misread as identity verification.

Fair play is never displayed to anyone but the owner and a dispute validator. A sufficiently poor record produces an action — losing access to public matches — rather than a label. Actions are appealable and reversible; labels are not.

Rationale for withholding negatives: the exposure is asymmetric. Nobody joins a match because a player scores well, but a visible negative quietly excludes them, at a cost far out of proportion to missing recreational football. Publishing a computed behavioural judgment to the general public is also a distinct processing purpose from showing it to the subject or to a host making a decision. Audit rule 19 sets a ceiling on what may ever be exposed; it does not require publication.

## ADR-020 — Initial OVR seeding source

Status: Accepted

A new player has no OVR. `ovrScore` stays `null` until their first eligible completed match, then seeds from those opponent ratings using the existing seeding math. No new formula is introduced and historical OVR is preserved.

Discovery and join decisions run on self-declared `players.skill_level` and reliability, which matches the product hierarchy: level and reliability lead, OVR supports.

Consequences:

- The Phase 1 interim stub becomes the permanent answer. Initial crew ratings keep returning `410 INITIAL_RATINGS_DISABLED`, the pending endpoint stays an empty compatibility response, and crew approval routes directly to the app.
- Every surface showing OVR must render an unrated state rather than a placeholder number.
- No pre-match rating ceremony exists in any flow.

## ADR-021 — Preserve the existing design system

Status: Accepted

The established mobile design system and product identity are constraints, not a redesign target. Implementation reuses existing tokens, shared components, primitives, layout conventions, navigation patterns, animation style, responsive behavior, accessible interaction patterns, and existing theme behavior.

Before changing a screen, the implementation report must state:

- the existing component or pattern being reused;
- whether the change affects layout, styling, or behavior only;
- the requirement that makes the change necessary;
- supported-size, accessibility, and visual-consistency verification.

New UI is built by extending the closest existing pattern. A new component or visual dependency requires an explicit explanation of why existing primitives cannot satisfy the requirement. Functional usability fixes remain allowed, but broad or unrelated visual redesigns do not.

The audited implementation baseline is catalogued in `docs/design-system-inventory.md`. Its dependency/navigation guard is a review gate, not permission to redesign by updating a snapshot.

## ADR-022 — Production hosting model and European data location

Status: Open

PostgreSQL remains the application database. No paid production infrastructure may be purchased, provisioned or deployed until Phase 8 is explicitly approved and this decision becomes Accepted with verified owner, region, processor, cost and recovery evidence.

### Option A — European VPS with self-hosted PostgreSQL and API

Proposed shape: a European VPS running the API, worker, PgBouncer and PostgreSQL through a reviewed container configuration, with encrypted off-server backups.

Assessment required before selection:

- verified monthly server, backup, monitoring and administration cost;
- named owner responsible for OS/PostgreSQL upgrades, security patches and incident response;
- backup encryption, restore testing, RPO and RTO;
- monitoring, capacity limits and scale-up procedure;
- single-server and operator-availability risks;
- verified server, database, backup, image and processing regions;
- DPA and international-transfer position.

The current Hetzner/Docker files are repository evidence of a prior intended topology only. They are not proof of a live, secure, owner-controlled or compliant deployment.

### Option B — API hosting with managed PostgreSQL

Assessment required before selection:

- verified API, worker, database, backup and failover regions;
- monthly base and usage costs at current, 1,000 and 10,000 active users;
- automatic backup/PITR, restore process, RPO and RTO;
- upgrade, failover and incident responsibilities;
- connection/pooling limits and compatibility with the existing Drizzle/PostgreSQL stack;
- private connectivity and least-privilege role support;
- DPA, subprocessors, retention and international transfers;
- operational simplicity and owner-access workflow.

### Decision criteria and required record

The accepted decision must compare both options using the same expected workload and recovery targets, name the app and billing owners, record the actual country/region for every data store/processor, list excluded alternatives, and explain rollback/exit portability. Convenience or an existing configuration file is not sufficient justification.

Until Accepted, all development and database activity remains local and isolated. Optional photo processing remains disabled for production until its processor chain, regions, retention, consent and deletion are separately approved.

## ADR-023 — Phase 1 final-participant integrity boundary

Status: Accepted as temporary

Until explicit finalized attendance outcomes exist, a completed match with a non-null result plus the final `match_participants` snapshot is the strongest truthful evidence available for card counting and opponent rating authorization. RSVP states (`in`, `out`, `unknown`, waitlist) are never treated as final attendance proof.

The boundary is intentionally temporary. Phase 3 must add explicit outcomes and disputes; its tests must replace or extend the Phase 1 snapshot-only cases. Historical outcomes remain unknown rather than inferred. A future real-data preflight is required before migration `0016` is considered for any existing environment.

## ADR-024 — Per-field global-profile visibility

Status: Accepted for local implementation

One JSONB object on the account-owned `users` record stores independent visibility for profile/card photo, football identity and personality fields. Supported values are `private`, `group`, `participants` and `public`; all keys default to `private` and server normalization also falls back to `private`.

Audiences are not hierarchical. `group` means an active shared group. `participants` means a shared final snapshot or confirmed non-waitlisted match. The owner always sees their own values. Public serialization begins from an explicit allow-list and never subtracts fields from the owner DTO.

## ADR-025 — Capability-shaped match and attendance contracts

Status: Accepted for local implementation

Relationship labels are display context. Authorization is calculated from canonical match state, caller identity, active group role, confirmed non-waitlisted RSVP, final participant evidence, publication and available places. Strict response variants are public/viewer, group, participant and manager.

Exact location defaults to participant/manager only. Private notes and pending/waitlist/out/source administration default to manager only. An active associated-group organizer is a manager; an ordinary group member is not a participant. Ambiguous state selects the least revealing serializer.

## ADR-026 — Public rating aggregate threshold

Status: Accepted as a privacy policy constant; formula policy remains open

`PUBLIC_RATING_AGGREGATE_MIN_SAMPLE = 4` is the conservative local visibility threshold. It is not an OVR constant and must never be imported into OVR calculation paths. Changing it requires a privacy/product decision plus contract regression tests, not historical OVR recomputation.

## ADR-027 — Dispute resolution authority

Status: Accepted

`member_role` gains `co_host`. Crew authority runs organizer → co_host → member → pending_member.

A disputed attendance outcome or behaviour report is resolved by a party who is not the reporter, not the subject, and not the host when the host is themselves involved. Authority resolves in order: crew organizer, then crew co-host.

A standalone match has no such authority and none is invented. Its disputes settle by corroboration and timeout: two or more independent corroborating reports within 72 hours finalize the record; otherwise it expires unfinalized and never affects any projection. FiveMatch operates no moderation team, and an endpoint nobody staffs is worse than an explicit expiry.

New capabilities: `canReportAttendance`, `canManageAttendance`, `canResolveDispute`.

Consequences:

- Unfinalized and expired records are inert. Only finalized records reach reliability or fair play.
- Reporter identity is never exposed to the subject at any stage, including resolution notifications.
- A dispute involving the only available authority expires rather than being self-resolved.

## ADR-028 — Cancellation deadline

Status: Accepted

The boundary between an excused absence and a late cancellation is 12 hours before kickoff, stored as `groups.cancellation_deadline_hours` with a default of 12. Standalone matches use the platform default.

Twelve hours is deliberate: 24 is punitive for amateur five-a-side, while 6 leaves no realistic chance of finding a replacement. It gives a host one evening to fill the place.

`cancelledAt` is stored as a timestamp and the outcome is derived at finalization, never recorded as an early judgment. If the threshold is ever retuned, history stays recomputable from the underlying facts.

Classification:

| Event | Outcome |
|---|---|
| Cancelled more than 12h before kickoff | `excused` |
| Cancelled 12h or less before kickoff | `late_cancel` |
| Confirmed `in` and did not appear | `no_show` |
| Never responded and did not appear | `no_show` |

## ADR-030 — Photo consent as an event, not a flag

Status: Accepted

Consent to face processing is a row in `photo_consents` carrying policy version, purpose, retention and timestamps, not a boolean on `players`. Consent counts as *current* only when it is not withdrawn and its policy version matches the live one.

The boolean it replaces could not say when consent was obtained, what the player was told, or that they had ever withdrawn it — which is most of what a consent record exists to prove. A grant after a withdrawal is inserted as a new row rather than updating the old one, because "they said no, then later said yes" is two facts and overwriting erases the first.

Existing boolean consents were migrated under the distinct version `legacy_boolean` and are therefore **not** current. Those players are asked once more, under text that actually states purpose and retention. Carrying the boolean forward as informed consent would be a claim the stored data cannot support.

Consequences:

- Bumping `PHOTO_CONSENT_POLICY_VERSION` re-asks everyone. That is the intended cost of changing what people agreed to.
- `players.photo_consent_given` is kept in sync as a mirror for existing readers; the table is the record of truth.
- Generation re-checks consent at job execution, not only at the route, because a job can sit queued across a withdrawal.

## ADR-031 — Erasure reaches object storage

Status: Accepted

Withdrawal of consent and GDPR purge both delete the generated objects from the bucket, driven by `card_photo_jobs.storage_key` rather than by parsing a URL.

Before Phase 5 there was no delete path at all: purging a user removed the job rows and left the images in storage indefinitely. Deleting the only record of where an object lives, while leaving the object, is worse than not deleting either — nothing afterwards can find it.

Storage deletion runs after the database transaction commits and never throws. A storage outage must not roll back an erasure that has otherwise succeeded, nor leave a player unable to withdraw consent. The failure is logged; a sweep is the remedy, not a retry that would have to redo the whole purge.
