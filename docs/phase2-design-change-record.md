# Phase 2 Design Change Record — PR-055

Status: recorded before screen modification  
Date: 2026-08-06

| Screen | Existing pattern to reuse | Change class | Requirement | Consistency verification |
| --- | --- | --- | --- | --- |
| Own profile | Existing profile section/card layout, `Chip`, shared colors/spacing/type tokens | behavior plus minimal in-section layout | field visibility must be owner-controlled | dependency/design-baseline check, compact and large-width review, labels and touch targets |
| Public player profile | Existing `PaniniCard`, `ProfileStorySections`, trust row and empty omission behavior | behavior only | omit fields the server does not permit and remove viewer-group decoration | typecheck, hidden-field rendering tests, compact and large-width review |
| Match discovery/card | Existing `MatchCard` and `SpotsMeter` | behavior only | consume city-only sanitized discovery DTO | typecheck and design-baseline check |
| Shared public match preview | Existing page layout and typography | behavior/copy only | never display exact venue to a public viewer | sanitized-schema test and supported-width review |
| Match detail/attendance | Existing sections, buttons, cards, sheets and action ordering | behavior only unless an unavailable section collapses | render only server-granted variant/capabilities | role-matrix tests, typecheck, compact and large-width review |

No navigation, component library, visual dependency, token family, or unrelated layout change is approved. Any additional deviation must be added here before implementation.
