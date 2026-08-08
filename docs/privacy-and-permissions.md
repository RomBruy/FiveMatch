# Privacy and Permissions

Status: Normative security/privacy baseline with Phase 1 integrity record  
Last reviewed: 2026-08-06

## 1. Principles

- Deny sensitive data by default.
- Authorize and shape data on the server.
- Return purpose-built DTOs, never internal records with client-side hiding.
- Treat identity, football ratings, behaviour reports, attendance administration, and photos as distinct data classes.
- Store the minimum data required for a documented purpose.
- Make deletion, correction, and audit behavior explicit.

## 2. Capability authorization

Broad relationship labels such as host, participant, crew, and viewer are context inputs, not final authorization decisions.

The server should calculate capabilities including:

- `canViewMatch`;
- `canViewPrivateDetails`;
- `canJoin`;
- `canJoinWaitlist`;
- `canLeave`;
- `canEditMatch`;
- `canCancelMatch`;
- `canInvitePlayers`;
- `canPublish`;
- `canManageAttendance`;
- `canPromoteWaitlist`;
- `canRate`;
- `canReportAttendance`;
- `canReportBehaviour`;
- `canSubmitProno`;
- `canResolveDispute`;
- `canViewPrivateProfile`;
- `canManagePhoto`.

Capabilities are derived from canonical match state, explicit attendance state/outcome, match organizer records, active crew membership, field visibility, and caller identity. Every mutation checks its capability on the server.

## 3. Player profile DTOs

### Private owner DTO

The private owner response may contain:

- account and global player identity;
- every editable profile field;
- field-level visibility configuration;
- safe OVR/reliability/fair-play aggregates, sample counts, confidence, and sanitized trends;
- card eligibility progress;
- photo consent/lifecycle state;
- bankroll and personal prediction history.

It never contains another person's identity attached to a rating or report, raw rating rows, or raw report evidence.

### Public player DTO

The public response is separately defined and serialized. It may include only:

- public display name;
- fields whose audience permits the caller;
- public level/trust summaries;
- OVR/card when unlocked and allowed;
- sufficiently sampled aggregates that cannot reconstruct one individual's input.

It must not be implemented by building the private object and deleting fields afterward.

### Field-level visibility

Minimum audience enum:

```text
private | crew | participants | public
```

Fields requiring explicit settings include:

- profile photo;
- generated card photo;
- current club;
- former club;
- special skill;
- favorite/best excuse;
- bad-faith/personality level;
- locker-room style;
- third-half profile;
- any future personality field.

New settings default to `private`. Existing data must not silently become public during migration. A migration report must show how many existing populated fields will receive each default.

## 4. Rating and report confidentiality

The rated/reported subject must never receive:

- rater or reporter player/user IDs;
- display name or avatar of a rater/reporter;
- individual football attribute scores;
- raw behaviour report;
- raw internal rating/report IDs when those enable correlation;
- timestamps precise enough to identify one reporter where avoidable;
- a one-person aggregate from which the raw value can be reconstructed.

Safe owner aggregates may include averages, sample count, a coarse time period, trend, and confidence. Public aggregates require a documented minimum sample threshold.

Internal evidence access is restricted to the resolution purpose. Organizer authority does not grant access to anonymous football-rating identities.

Notifications, logs, Sentry context, analytics, story exports, group leaderboards, and match endpoints are part of the privacy boundary and require tests.

### Phase 1 enforcement

`POST /v1/matches/:matchId/ratings` accepts the target identifier only as a value to validate. The server loads both final participant rows and rejects self, teammate, missing-participant, incomplete/cancelled match, closed-window and duplicate submissions. The database enforces one `(match, rater, target)` row under concurrency.

Neither `player_match_eligibilities`, `ovr_processing_events`, `rating_events.match_id`, processing IDs nor raw rating rows are added to mobile/public responses. Current player and completed-match contract tests retain a recursive denylist for rater/reporter/raw evidence. Full separate owner/public serializers and minimum-sample aggregate policy remain Phase 2 work.

New initial crew rating writes are disabled. Historical raw rows remain restricted internal evidence and are not exposed or deleted by Phase 1.

## 5. Match publication privacy

Publishing a crew match reveals the public match DTO, not the crew's internal record.

Never expose to an unrelated public viewer:

- pending, declined, unknown, or cancelled crew attendance;
- waitlist identities;
- private crew notes;
- internal source labels;
- member email/contact data;
- internal group IDs without a documented need;
- organizer-only controls or dispute details.

The public response may expose a host's public reliability/sample summary and the actual number of public places. Participant names require an explicit match privacy policy and must not be inherited accidentally from internal attendance responses.

## 6. Photo consent and processing

Panini-style photo generation is an optional owner action.

Consent record requirements:

- player ID;
- granted timestamp;
- policy version;
- processing purpose;
- named processor categories/services;
- retention statement/version;
- chosen display visibility;
- withdrawn timestamp;
- source channel.

Consent must be current at job creation and again when the worker begins processing. Withdrawal prevents new processing and schedules deletion according to policy.

### Input controls

- Owner-only upload or approved trusted source.
- Allow-listed MIME types verified from bytes, not filename alone.
- Pixel and byte limits.
- Download timeout and maximum response size.
- Restricted redirect count and destination validation.
- No private/link-local/loopback network targets for server fetches.
- Face detection and input moderation.
- Temporary raw data deleted according to the disclosed retention policy.

### Output controls

- Generated output type and dimensions verified.
- Generated output moderated before publication.
- Object uses non-guessable ownership and access policy.
- Public URL is returned only when display visibility permits it.
- Processor/upload failures produce safe user errors and durable retry state.

### Deletion

- Owner can delete generated output and revoke consent independently.
- Database reference and object-storage file are deleted or tombstoned consistently.
- Account/GDPR purge deletes database jobs, references, raw temporary objects, and generated objects.
- Deletion failures are retried and observable.

The current consent copy claiming no retention must be corrected before launch because generated assets and job metadata are retained.

## 7. Data retention and account deletion

Ordinary crew removal is not account deletion and must preserve history.

Phase 1 ordinary crew removal changes only membership lifecycle state. It never calls GDPR anonymization; tests verify historical participant, rating, pronostic and bet rows survive removal/re-addition and multiple memberships.

Account deletion flow:

1. Soft-delete account and active memberships.
2. Block new processing and revoke active photo consent.
3. After the documented retention window, anonymize participant snapshots where required.
4. Delete ratings/reports/predictions according to the documented legal basis and aggregation policy.
5. Delete object-storage photo assets.
6. Record purge completion without retaining unnecessary identity.

Any preservation of aggregate statistics must be demonstrably non-identifying and must not retain a hidden rater/reporter link.

## 8. Logging and observability

Do not log:

- rating payload values with rater/target identity together;
- raw behaviour report details;
- authentication tokens;
- private profile fields;
- image bytes or processor payloads;
- precise private location beyond operational necessity.

Audit logs for sensitive actions should record actor, capability, entity, action, result, and coarse reason without duplicating private evidence.

## 9. Phase 2 verified controls

- Owner and public profiles use different strict schemas and service methods.
- The per-field visibility object defaults every key to `private`; public values require explicit owner action.
- Former memberships, `out`, `unknown` and waitlisted RSVP rows do not grant profile participant/group fields or participant match detail.
- Public preview/discovery and unrelated authenticated match detail omit exact location, group ID, notes, configuration and attendance identities.
- Attendance identity lists are participant/manager shaped; waitlist, pending, out and source details are manager-only.
- Public/owner football attribute aggregates are withheld below four eligible samples; raw rating evidence is never serialized.
- Owner OVR history excludes breakdowns, internal processing/event IDs, raters and individual submissions.
- Card-photo status now checks player ownership.
- Public player cards no longer attach the viewer's active group.
- External group DTOs and roster/approval controls use purpose-specific group/member/request/player identifiers rather than account user IDs.

## 10. Remaining verified privacy gaps

- Photo consent is a non-versioned boolean and cannot be withdrawn.
- Object-storage deletion is absent from GDPR purge.
- Generated output moderation is absent.
- The card photo source/output field is conflated.
- Final attendance outcomes and behaviour/fair-play reports do not exist; Phase 2 cannot implement their future reporter/dispute projections.
- Public participant-name policy remains conservative: only participant/manager variants receive the roster.

These remain open until the defect register marks them verified complete.
