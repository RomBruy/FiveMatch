# Input Reconciliation - Brainstorming Session

Source: `_bmad-output/brainstorming/brainstorming-session-20260526-225324.md`

## Verdict

The PRD captures the core brainstorming decisions and keeps implementation-heavy material in `addendum.md`. No phase-blocking gaps remain before UX or architecture planning.

## Captured In PRD

- Native mobile app direction for Apple App Store and Google Play Store.
- Private groups as the MVP community model.
- Group settings: language, play style, intensity, goalkeeper mode, generator style.
- Large group / per-match confirmed player model.
- First-come attendance and waitlist.
- 0-100 ratings.
- One-time initial peer ratings.
- Team generation blocked until confirmed players have enough baseline ratings.
- Team generator with fairness percentage, regeneration, limited manual adjustment, and locked teams.
- Organizer/admin score, goals, and assists entry.
- MVP voting and quick opponent ratings.
- Rating evolution with ratings able to go up and down.
- Period-based leaderboards and player stats.
- Live Panini card, MVP card, and match result poster.
- Prompt-based card image generation with one successful attempt.
- French and English localization.
- Push notifications.
- Five-tab mobile IA: Accueil, Joueurs, Match, Vestiaire, Profil.
- Deferred scope: Pronostics, tournaments, public leagues, historical card snapshots, subscriptions, venue integrations.

## Captured In Addendum

- Recommended stack direction.
- API domain list.
- Database table suggestions.
- Candidate team scoring formula.
- Generator style weights.
- Group play style weights.
- Draft OVR formula.
- Draft goalkeeper normalization formula.
- Draft fairness percentage normalization.
- Image generation pipeline.
- Store readiness notes.

## Non-Blocking Items Left For Later

- Formula tuning requires simulation and real group playtests.
- Voided match external-share handling needs product copy and UI treatment.
- Image moderation provider/process should be selected during architecture.
- App Store / Google Play policy details should be verified before release submission.
