# Phase 2 Field and Audience Catalogue

Status: implementation baseline  
Date: 2026-08-06

This catalogue is normative for Phase 2 serializers. Database rows are internal and must never be returned directly.

## Player profiles

| Field class | Owner | Shared group | Confirmed co-participant | Unrelated authenticated viewer |
| --- | --- | --- | --- | --- |
| Global player ID and display name | yes | yes | yes | yes |
| Editable football/personality fields | yes | only when that field is `group` | only when that field is `participants` | only when that field is `public` |
| Profile/generated card photo | yes | only when its field permits | only when its field permits | only when its field permits |
| Visibility settings | yes | no | no | no |
| Eligible-match count/card progress | yes | public card state/count only | public card state/count only | public card state/count only |
| OVR and trend | yes, sanitized | when card is unlocked | when card is unlocked | when card is unlocked |
| Attribute aggregates | at/above privacy threshold | at/above public threshold | at/above public threshold | at/above public threshold |
| Rating sample count/history | aggregate and sanitized only | no | no | no |
| Raw rating/report records or actor IDs | never | never | never | never |
| Bankroll | yes | no | no | no |

Audience values are independent. `group` means an active shared group; `participants` means a shared match where both players are confirmed non-waitlisted attendees or final participants. `out`, `unknown`, cancelled membership, deleted membership, and waitlist rows do not qualify. New or missing visibility data is treated as `private`.

The independently controlled fields are: profile photo, generated card photo, current club, former club, preferred position, strong foot, player style, special skill, favorite excuse, bad-faith level, locker-room style, and third-half profile.

## Match responses

| Field class | Public preview/discovery | Authenticated viewer | Active group member | Confirmed participant | Manager |
| --- | --- | --- | --- | --- | --- |
| Schedule, duration, format, skill, price, city | yes | yes | yes | yes | yes |
| Capacity and joinability counts | yes | yes | yes | yes | yes |
| Group identity | no | no | associated group only | associated group only | associated group only |
| Exact venue/address/coordinates | no | no | no | yes | yes |
| Confirmed roster/final lineup | no | no | no | yes | yes |
| Waitlist/pending/out identities | no | no | no | no | yes |
| Attendance source and administrative trust data | no | no | no | no | yes |
| Private notes and generator configuration | no | no | no | no | yes |
| Result and participant statistics | no | no | group summary only | yes | yes |

The match host and an active organizer of the associated group are managers. A group member is not automatically a participant. All location and roster decisions default to the least revealing audience if state is ambiguous.

## Capability source of truth

The server resolves explicit capabilities from the match row, active group membership, confirmed non-waitlisted attendance, final participant evidence, and caller identity. Relationship labels are display context only and are not sufficient authorization.

Phase 2 capabilities include private-detail, exact-location, roster, waitlist, pending attendance, private-note, attendance-management, rating, pronostic, leave, join, and waitlist-join decisions. Every protected route must check the relevant capability on the server.

## Cross-surface forbidden data

Public, owner, match, group, notification, analytics/export, and mobile payload tests recursively reject raw rating/report records, rater/reporter identifiers, internal user IDs, private notes/configuration, precise private coordinates, pending/waitlist identity outside manager responses, and raw evidence identifiers.
