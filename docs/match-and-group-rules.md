# Match and Group Rules

Status: Normative baseline with Phase 1 local implementation record  
Last reviewed: 2026-08-06

## 1. Core entities

- A **player** is the global football identity for one account.
- A **crew** is a persistent group with memberships and roles.
- A **match** is a specific football event and the only discoverable listing.
- A match may be standalone or associated with one crew.
- A crew membership never owns the player's OVR, card, bankroll, or global history.

## 2. Hosting

### Standalone

Any authenticated user with a completed global player profile may create a standalone match with `groupId = null`. Crew membership is not required.

### Crew-associated

A crew match has a nullable `matches.groupId` populated and requires an active role with the explicit `canCreateCrewMatch` capability. The current role model grants this only to `organizer`. Co-host/admin roles are a future additive capability, not an implicit assumption.

### Host participation

The current application does not automatically place a standalone host in attendance. Product must decide whether the host:

- counts as a playing participant by default;
- explicitly chooses “I am playing”; or
- may remain a non-playing organizer.

Capacity and creation copy must make this explicit before Phase 6.

## 3. Visibility and publication

### Private

Visible only to the host, authorized co-hosts, invited players, and active members of the associated crew according to capability rules.

### Crew first

Represented by a private match plus a future `publicOpensAt` or an explicit host publication action. It is not a marketplace status or duplicate listing.

### Public

Visible through discovery with only the privacy-safe public match DTO. Public visibility does not imply access to crew membership, pending responses, internal notes, waitlist identities, or attendance administration.

The public state should support:

- optional public opening time;
- optional organizer limit on publicly claimable seats;
- actual remaining capacity computed from canonical attendance;
- immediate withdrawal when the match is cancelled, expired, or no longer joinable.

## 4. Capacity and availability

Total capacity is the match's player capacity. Availability is derived under one database transaction from:

- match state and kickoff;
- total capacity;
- finalized seat-holding confirmations;
- optional public-seat limit;
- waitlist policy.

`openSpots` must not become an independent inventory counter. A publication limit may restrict how many seats are offered publicly, but it cannot claim capacity that no longer exists.

The following operations share one lock/order policy:

- join;
- join waitlist;
- leave/cancel;
- automatic promotion;
- manual promotion;
- host capacity or publication change.

Required invariants:

- confirmed seats never exceed capacity;
- one player has at most one active match participation state;
- a duplicate join request returns the existing outcome;
- waitlist order is stable and deterministic;
- replaying promotion cannot fill one seat twice;
- cancelled, completed, expired, locked-to-outsiders, and private matches reject public joins;
- discovery and join use the same joinability rules.

## 5. Attendance lifecycle

Pre-match participation and final outcome are separate.

Suggested lifecycle:

```text
invited -> confirmed -> attended
                   -> excused_absence
                   -> no_show
invited -> declined
confirmed -> cancelled
full join -> waitlisted -> confirmed (promotion)
```

Attendance source is separate from status and role:

```text
crew | discovery | direct_invite | shared_link | waitlist_promotion
```

Match role is also separate:

```text
host | cohost | player
```

Late arrival is stored independently. Late cancellation is derived from a cancellation timestamp and documented deadline, not recorded as no-show.

## 6. Waitlist

- Public users may join the waitlist when a full match permits it.
- Position uses deterministic ordering and transaction-safe assignment.
- The player can see their own position.
- Public viewers do not see waitlist identities.
- Hosts/co-hosts with `canManageAttendance` see and manage the full list.
- Promotion is idempotent and consumes one actual free seat.
- Promotion source is recorded.
- Notification delivery failure does not roll back the seat, but a durable job records and retries notification.

## 7. Match state and core actions

Each state exposes a clear primary action derived from capabilities:

| Context | Primary action examples |
|---|---|
| Joinable outsider | Join |
| Full outsider | Join waitlist |
| Confirmed player | Cancel/leave or Confirm attendance |
| Waitlisted player | View position or Leave waitlist |
| Host missing players | Publish remaining places |
| Host with pending crew | Manage responses |
| Host after cancellation | Promote waitlist |
| Completed match | View result; eligible secondary ratings/pronostics settlement |

Hosts require edit and cancel operations. Locking teams must not require an artificially full nominal capacity if the organizer deliberately finalizes a smaller match; the product rule for minimum playable size remains unresolved.

## 8. Crew lifecycle

- Users may create and join multiple crews.
- One active crew may be selected for UI convenience, but it cannot scope global identity or discovery.
- Crew removal ends membership only; it does not anonymize historical participation.
- Account deletion/GDPR erasure is the only flow that anonymizes personal history.
- Organizer transfer updates both membership roles and the canonical `groups.organizerId` in one transaction.
- Crew invitations and pending membership are private.
- Crew screen prioritizes next match, actions, open places, invitations, and members before leaderboards.

Phase 1 implementation: ordinary removal calls the membership service to set only `group_memberships.deleted_at`. It does not modify `players`, `match_participants`, match statistics, ratings, pronostics, bets or match/group attribution. Re-adding the same `(group,user)` reactivates that membership record without replacing the global player or historical evidence. The separate GDPR service remains the only path authorized to anonymize account-linked history.

The join approval journey no longer redirects into initial crew ratings. It preserves the existing welcome transition and then returns to the established app navigation, making secondary scoring setup non-blocking.

## 9. Discovery

Discovery includes only matches an unrelated eligible user can realistically join or waitlist.

Minimum filters:

- future time window;
- public/joinable state;
- actual availability or enabled waitlist;
- exact radius after bounding-box prefilter;
- date;
- format;
- level;
- price;
- stable cursor pagination.

Default ranking remains predictable: time and distance first, followed by clear availability. Level fit and host reliability may be transparent secondary signals. Do not introduce an opaque marketplace ranking.

Plain numeric coordinates remain acceptable initially. Geographic queries must be isolated behind a discovery repository so grid/geohash or PostGIS can be adopted only after measured query-plan and volume evidence.

## 10. Public and private match responses

### Public match DTO

May include:

- date/time and duration;
- public venue/location appropriate for joining;
- format, level, price;
- actual public availability and waitlist availability;
- host's explicitly public trust summary;
- public match instructions.

Must not include:

- internal group ID unless there is a documented public need;
- pending/declined crew members;
- waitlist identities;
- private notes;
- internal attendance source;
- private member details;
- private organizer controls.

### Participant/crew/host responses

Additional data is added through explicit capabilities and purpose-built DTOs. The server must never return an internal full record and rely on mobile hiding.

## 11. Pronostics

Pronostics are match-scoped secondary engagement. Submission capability is granted to an eligible participant or active member of the associated crew. Odds may be readable according to match visibility, but submitting a bet requires `canSubmitProno`.

The 1,000-point economy and every existing arithmetic rule are frozen.

## 12. Phase 1 completion and rating boundary

- A result is accepted only by the request that atomically changes the match from `in_progress` to `completed`; repeated/concurrent submissions receive the controlled already-submitted outcome.
- The successful result transaction creates at most one canonical eligibility row for each non-anonymized final participant.
- A post-match football rating is server-authorized against the completed match and final participant team snapshot. Only an opponent may be rated once per match/rater/target.
- Final participant presence is the temporary Phase 1 boundary. It is not an inference that an RSVP or waitlist state proves attendance.
- Phase 3 must add explicit attended/excused/no-show outcomes, separate late arrival and disputes, then strengthen these checks.

## 13. Usability rules

- Essential creation fields first: date, time, venue/area, capacity, level, visibility.
- Advanced fields second: price, notes, goalkeeper mode, generator style, recurrence.
- Repeat last match, Next week, crew defaults, prior venue, and prior invite list are shortcuts, not new required choices.
- Deep links survive authentication.
- Push permission is requested after a contextual action such as join or host.
- Labels use player, crew, open place, confirmed, and waitlist—not listing, market, source, or match context.

## 14. Phase 2 enforced response variants

- `public`/`viewer`: city, schedule, format, level, price, status, host public summary and availability/joinability only.
- `group`: public fields plus associated group ID/name and completed score summary; active membership is required and does not grant exact venue or roster.
- `participant`: exact location, confirmed/final participant roster and result; requires a confirmed non-waitlisted seat or final snapshot.
- `manager`: host or active associated-group organizer; adds exact location, attendance administration, private notes and generator configuration.

`out`, `unknown`, waitlisted, removed or unrelated rows do not become participants. Attendance responses expose counts and the caller's own state to viewer/group audiences, confirmed identities only to participants, and pending/waitlist/out/source identities only to managers. Public preview and discovery never return the associated group ID or exact venue.

Mobile shares use the city even when the caller can see the exact venue because shared text accompanies a public link.
