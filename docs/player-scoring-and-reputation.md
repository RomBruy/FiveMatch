# Player Scoring and Reputation

Status: Normative baseline with Phase 1 local implementation record  
Last reviewed: 2026-08-06

## 1. Domain boundaries

FiveMatch exposes three separate trust concepts:

| Concept | Meaning | Canonical evidence | Must not consume |
|---|---|---|---|
| OVR | Football ability | Eligible opponent football ratings, match outcome, locked team strength, goals, assists, MVP, existing OVR history | Reliability, fair play, pronostics |
| Reliability | Whether the player keeps commitments | Finalized attendance, no-shows, excused absences, late cancellations, sample size, recent attendance | Football attributes, OVR, pronostics |
| Fair play | Behaviour and sportsmanship | Finalized behaviour cases with an auditable resolution | Football ability, prediction results, unresolved reports |

UI labels must name the concept. A team-generation `fairnessScore` means balance between generated teams and is not the player's fair-play score.

## 2. Global player invariant

- `players.user_id` is the canonical one-to-one link to `users.id`.
- OVR, card state, reputation aggregates, and pronostic bankroll belong to this global player.
- Crew-specific membership and future crew-specific statistics belong to `group_memberships` or a crew-stat projection, not duplicate player rows.
- Joining or leaving a crew must not create, reset, anonymize, or delete the global player.
- Ordinary crew removal preserves match participation and global history. GDPR account erasure is a separate workflow.

## 3. Existing OVR calculation: frozen mathematics

The current formula is implemented in:

- `packages/types/src/algorithm-constants.ts`
- `apps/api/src/services/players/ovr.service.ts`
- `apps/api/src/services/players/seeding.service.ts`

The following are frozen by PR-011:

- Attribute weights.
- Calibration anchors.
- EMA base, decay, floor, and ceiling.
- Rater diversity and agreement factors.
- Crew-tier multiplier.
- Goal, assist, MVP, and outcome adjustments.
- OVR clamp and trend threshold.
- Existing initial-seed mathematics where it remains applicable.

Implementation may repair eligibility, authorization, duplicated triggers, and inconsistent input counters. It must not silently tune or redesign the formula.

Before modifying any OVR input or trigger:

1. Snapshot constants and representative outputs.
2. Add golden regression cases for current calculation functions.
3. Record the existing input defect being fixed.
4. Demonstrate identical formula output for identical valid input.
5. Confirm reliability, fair play, and pronostics remain absent from the input type and runtime query.

## 4. Phase 1 OVR input corrections

Phase 1 corrects the verified input/trigger defects for future local writes:

1. Result completion conditionally transitions `in_progress -> completed` once and creates canonical eligibility in the same transaction.
2. OVR processing never increments `players.matchCount`, changes card state, or writes `lastMatchAt`.
3. Only a new `player_match_eligibilities` row advances the transitional cached count; drift can be reported without rewriting history.
4. Post-match ratings require a completed result, open window, two final-snapshot participants, distinct players and opposing teams.
5. New initial crew ratings are disabled; the compatibility GET is empty/non-blocking and historical rows remain untouched.
6. `ovr_processing_events` claims each `(match, player, MATCH_UPDATE)` once, and `rating_events.match_id` records the match with its own uniqueness boundary.
7. OVR input queries exclude initial, self, same-team, nonparticipant, cancelled and incomplete rating evidence.

Durable scheduled closure remains open under PR-053. No historical counter, rating, event or OVR value was reconciled or recomputed.

## 5. Football rating eligibility

A football rating is eligible only when all conditions are true:

- Match status is completed.
- A valid result exists.
- Match is not cancelled or voided.
- Rating window is open.
- Rater is in the final participant snapshot.
- Rater's finalized attendance outcome is attended.
- Target is in the final participant snapshot.
- Target's finalized attendance outcome is attended.
- Target is on the opposing team.
- Target is not the rater.
- The `(match, rater, target)` rating does not already exist.

The API must derive the target from server-owned participant data. The mobile-provided `ratedPlayerId` is an identifier to validate, not evidence of eligibility.

A database unique constraint on `(match_id, rater_player_id, rated_player_id)` is mandatory for non-initial ratings. Read-before-write checks may improve errors but are not an integrity boundary.

### Initial ratings

Phase 1 retires creation of new initial peer ratings because they conflict with PR-015. `POST /v1/groups/:groupId/ratings/initial` returns `410 INITIAL_RATINGS_DISABLED`; the pending endpoint returns no required work, and group membership/play is not blocked. Historical ratings and OVR values are preserved.

No replacement seeding formula was invented. The safest current default is that players can play and accumulate eligible completed-match evidence without an initial crew seed. Whether the existing seed mathematics should later consume eligible opponent evidence remains the unresolved ADR-020 decision.

## 6. Rating privacy and aggregate history

Raw rating records are internal evidence. They are never serialized to the rated player, public profile, crew leaderboard, match response, notification, export, or analytics payload.

Private player responses may contain:

- Safe aggregate attribute averages.
- Rating sample count.
- Confidence/sample band.
- OVR value and safe trend.
- Sanitized OVR change history containing no rater or raw-rating reference.
- Explanation categories such as match result, objective contribution, or evidence confidence only when they cannot reconstruct an individual's input.

Public responses must apply a minimum sample/privacy rule before showing aggregate football attributes or fair-play values. An aggregate based on one person's rating is reconstructable and is not safe merely because it is labeled an average.

`rating_events.breakdown` is an internal audit record. A future private history serializer must explicitly allow fields rather than return the JSON object directly.

## 7. RSVP, attendance, and reliability

RSVP represents intention before the match:

```text
invited | confirmed | waitlisted | declined | cancelled
```

Final attendance represents observed outcome:

```text
attended | excused_absence | no_show
```

Additional independent facts:

- `arrivedLate`: boolean or timestamp/duration.
- `cancelledAt`: supports late-cancellation policy.
- `finalizedAt`, `finalizedBy`, and resolution source.

Changing RSVP from confirmed to cancelled after attendance lock is a late cancellation, not automatically a no-show. A no-show can be assigned only through final attendance processing.

Reliability is calculated only from finalized facts. The player-facing response should prefer transparent components over an opaque composite:

- commitments;
- attended;
- excused absences;
- no-shows;
- late cancellations;
- late arrivals where relevant;
- sample band;
- recent trend.

The exact reliability presentation formula is an unresolved product decision. It must not be folded into OVR.

## 8. Fair play and behaviour reports

Behaviour reporting is separate from football ratings and attendance outcomes.

Minimum report fields:

- match ID;
- reporter player ID;
- subject player ID;
- category;
- optional structured detail;
- status: pending, disputed, finalized, dismissed;
- validator user ID and authority;
- created, disputed, resolved, and finalized timestamps.

Recommended policy baseline:

1. Reports require a valid completed match relationship.
2. The subject can see the category/status relevant to them but never the reporter identity or raw report.
3. Undisputed organizer-recorded attendance can finalize after a review window.
4. Disputed or conflicting records do not update aggregates.
5. A host can resolve ordinary attendance disputes.
6. If the host is reporter or subject, a co-host or platform moderator resolves it.
7. Behaviour penalties require corroboration or moderator resolution; one unresolved accusation never changes fair play.
8. Finalization and reversal are idempotent and auditable.

The exact fair-play aggregation formula and report-category taxonomy remain unresolved. Neither may influence OVR.

## 9. Card eligibility

Card unlock is driven by a unique eligibility ledger, not by a mutable counter shared with OVR.

Implemented Phase 1 canonical record:

```text
player_match_eligibilities
- match_id
- player_id
- evidence_version
- created_at
- invalidated_at
- invalidation_reason
UNIQUE(match_id, player_id)
```

A Phase 1 record is created only for a player in the final participant snapshot of a completed match with both result scores. Cancelled and incomplete matches are excluded. Because finalized attendance and a first-class void flag do not yet exist, `phase1_final_participant_v1` is not proof of attended status. Attended/no-show/void enforcement remains required in the attendance phase.

Card state is calculated from the number of active canonical records and unlocks at exactly four. `players.matchCount` remains a compatibility cache advanced only after a new record is inserted. Two unique matches processed twice remain two; four unique matches unlock.

Repair requirements:

- Before any existing-environment migration, run the read-only preflight comparing current `matchCount`, participant rows, OVR events and proposed eligibility.
- Do not update existing development/production data during report generation.
- Do not recompute historical OVR.
- Apply only an approved additive/backfill migration after isolated rehearsal.
- Keep correction events if a match is later invalidated.

No Phase 1 historical backfill is authorized. Synthetic fixtures alone were reconciled to prove future-write behavior.

Whether an administrative invalidation below four re-locks an already revealed card is an unresolved product decision.

## 10. Pronostic isolation

Pronostics remain a separate fictional-points ledger. Preserve exactly:

- Starting bankroll: 1,000.
- Stake validation and maximum.
- Frozen odds.
- Payout rounding.
- Close-refund calculation.
- Settlement arithmetic and idempotency.
- Ledger reconstruction.

Eligible submitters are:

- an eligible participant in the match; or
- an active member of the match's associated crew.

An unrelated viewer, unused waitlist player, out/unknown player, removed member, or non-playing standalone host is not eligible. Authorization changes must not alter any calculation.

## 11. Required auditability

- One match produces at most one OVR-processing event per player.
- One match produces at most one card-eligibility record per player.
- Reliability/fair-play finalization is idempotent.
- Corrections append or retain an audit trail.
- Sensitive raw evidence is accessible only to authorized internal resolution processes.
- User-visible histories are purpose-built safe projections, never internal row dumps.

## 12. Phase 2 aggregate and history privacy

`PUBLIC_RATING_AGGREGATE_MIN_SAMPLE` is the single visibility-policy constant and is conservatively set to four. It gates only whether aggregate football attributes leave the server; it does not enter OVR computation, weighting, calibration, triggering or persistence.

An eligible aggregate includes non-initial match ratings only when both players have active canonical eligibility for that match and final participant sides prove they were opponents. The owner may see the sample count at every size, but attributes remain `null` below four. Public, group and participant profiles use the same minimum.

Owner OVR history is projected from internal events into coarse date, rounded resulting OVR, direction, optional match reference and `match_update` category. Event IDs, raw breakdowns, rater IDs, individual attributes and exact submission timestamps are excluded. The public profile has no OVR-history field.

Reliability remains the existing separate summary. Fair play and final attendance are still unmodeled and are not inferred or included in OVR.
