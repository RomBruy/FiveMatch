# FiveMatch PRD Addendum

This addendum preserves technical and algorithm details from the brainstorming session. It supports downstream architecture and implementation planning; the PRD remains the source of product requirements.

## Source Material

- Brainstorm: `_bmad-output/brainstorming/brainstorming-session-20260526-225324.md`

## Recommended Stack Direction

- Mobile app: React Native + Expo.
- Backend: Node.js, Next.js API, or standalone Node API.
- Database: PostgreSQL.
- Auth: Google, Apple, email/password.
- Push notifications: Expo Notifications for MVP.
- Image generation: server-side pipeline.
- Sharing: native share sheet plus PNG exports.

## Recommended API Domains

- `groups`
- `players`
- `ratings`
- `matches`
- `attendance`
- `teamGenerator`
- `matchResults`
- `leaderboards`
- `cards`
- `imageGeneration`
- `shareAssets`

## Recommended Tables

- `users`
- `groups`
- `group_settings`
- `group_members`
- `invitations`
- `players`
- `player_attributes`
- `initial_peer_ratings`
- `post_match_ratings`
- `rating_history`
- `matches`
- `match_attendance`
- `team_generation_versions`
- `team_generation_players`
- `match_events`
- `mvp_votes`
- `player_statistics`
- `achievements`
- `player_achievements`
- `player_cards`
- `share_assets`
- `image_generations`
- `push_tokens`
- `notifications`

## Team Generator Candidate Formula

Candidate score:

`candidate_score = rating_gap_penalty + attribute_gap_penalty + goalkeeper_penalty + position_style_penalty + form_penalty + repetition_penalty + generator_style_penalty`

The lowest candidate score wins. Fairness percentage is derived from normalized candidate score.

## Generator Style Weights

- Fair + Fresh: rating 45%, attributes 25%, history/repetition 20%, randomness 10%.
- Maximum Fairness: rating 60%, attributes 30%, history/repetition 8%, randomness 2%.
- More Variety: rating 35%, attributes 25%, history/repetition 25%, randomness 15%.

## Group Play Style Weights

- Fixed positions: rating balance 40%, position balance 25%, goalkeeper balance 20%, attribute balance 10%, repetition 5%.
- Flexible: rating balance 40%, attribute balance 30%, repetition 20%, position balance 5%, randomness 5%.
- Rotating: rating balance 35%, stamina/versatility 25%, attribute balance 20%, keeper rotation suitability 10%, repetition 10%.
- Hybrid: rating balance 40%, position balance 15%, attribute balance 25%, goalkeeper balance 10%, repetition 10%.

These should start as code-level tunable configuration.

## Rating Evolution Notes

Ratings should move slowly while form moves faster.

Example match impact:

`match_impact = 50% opponent_rating + 20% stats_impact + 20% MVP_impact + 10% team_result_impact`

Example OVR smoothing:

`new_ovr = old_ovr * 0.85 + match_impact * 0.15`

Tags softly influence attributes over time:

- Fast -> Speed.
- Technical -> Technique / Dribbling.
- Playmaker -> Passing / Vision.
- Finisher -> Shooting / Attack.
- Defensive Wall -> Defense / Physical.
- Team Player -> Vision / Passing / Fun.
- Aggressive -> Physical / Defense.
- Funny -> Fun.

## MVP OVR Starting Formula

Use 0-100 values everywhere. Start with a simple formula, then tune with real match data.

Early-stage OVR before enough matches:

`ovr = 70% initial_peer_overall + 30% weighted_attribute_score`

Mature OVR after enough matches:

`ovr = 45% evolved_attribute_score + 30% post_match_rating_average + 15% form + 10% stats_impact`

Position/style attribute weighting should start as:

Attacker:

- Attack 30%
- Speed 20%
- Technique 20%
- Physical 10%
- Stamina 10%
- Defense 5%
- Overall baseline 5%

Midfielder / playmaker:

- Technique 25%
- Stamina 20%
- Attack 15%
- Defense 15%
- Speed 10%
- Physical 10%
- Overall baseline 5%

Defender:

- Defense 30%
- Physical 20%
- Stamina 15%
- Technique 10%
- Speed 10%
- Attack 5%
- Overall baseline 10%

All-rounder / flexible:

- Attack 15%
- Speed 15%
- Technique 20%
- Defense 15%
- Physical 15%
- Stamina 15%
- Overall baseline 5%

Fun should be excluded from competitive OVR, except for social/card identity.

## Goalkeeper Normalization Starting Formula

Goalkeeper OVR should be normalized onto the same 0-100 scale as outfield OVR.

Fixed goalkeeper mode:

`gk_ovr = 25% reflexes + 20% positioning + 15% handling + 15% communication + 10% distribution + 10% physical + 5% overall_baseline`

Rotating goalkeeper mode:

`keeper_suitability = 30% defense + 25% physical + 20% stamina + 15% technique + 10% overall_baseline`

No goalkeeper mode:

Ignore goalkeeper-specific attributes for team balance.

If a true goalkeeper plays outfield, use the best available outfield estimate with conservative smoothing.

If an outfield player is assigned temporary goalkeeper suitability, use rotating goalkeeper formula rather than fixed goalkeeper formula.

## Fairness Percentage Starting Formula

Candidate splits produce a raw penalty score.

Starting penalties:

- Rating gap penalty: normalized total OVR difference.
- Attribute gap penalty: weighted attack, defense, speed, technique, physical, and stamina gaps.
- Goalkeeper penalty: mode-specific keeper gap.
- Position/style penalty: only meaningful for fixed and hybrid groups.
- Form penalty: recent form imbalance.
- Repetition penalty: repeated teammate pairings from recent matches.
- Randomness modifier: controlled by generator style.

Starting conversion:

`fairness = clamp(100 - normalized_penalty, 0, 100)`

Display rounded integer fairness percentage.

Target UI bands:

- 95-100: Excellent balance.
- 90-94: Very fair.
- 80-89: Fair.
- 70-79: Playable but uneven.
- Below 70: Avoid unless no better split exists.

The exact normalization should be validated by simulation and real match feedback.

## Anti-Abuse Notes

- One initial peer rating per rater, rated player, and group.
- One post-match rating per rater, rated player, and match.
- No self-rating.
- Only opponents can be rated after match.
- MVP self-votes are blocked.
- Extreme outlier ratings should be softened or ignored.
- Repeated suspicious rating behavior should reduce influence over time.

## Image Generation Notes

Recommended pipeline:

1. User uploads a photo.
2. User selects controlled style options and optional prompt.
3. User validates generation request.
4. Server generates Panini-style portrait/card artwork.
5. App overlays real text, OVR, stats, QR code, and branding.
6. Final share asset is exported as PNG or through native share sheet.

The generated visual layer should not be trusted to render readable text or numbers.

## MVP Image Generation Policy

- One free successful generated card image attempt per player profile per group.
- Technical failures do not consume the attempt.
- Aesthetic retries are deferred from MVP.
- Prompt and image moderation happen before generation.
- Generated outputs can be reported.
- Additional attempts can become a future paid, admin-granted, or event-based feature.

## Match Voiding Policy

MVP should distinguish between score submission and match completion finalization.

- Before completion finalization, organizer/admin can edit score, goals, assists, and match events.
- After completion finalization, owner/admin can void the match.
- Voided matches remain visible in history as voided.
- Voided matches are excluded from leaderboards and rating evolution.
- If share assets were already exported externally, the app cannot retract them; the app should mark in-app recap assets as voided.

## Store Readiness Notes

FiveMatch must prepare for:

- Apple Sign In.
- Account deletion.
- Privacy policy.
- Terms of use.
- Image upload moderation.
- Prompt moderation.
- Notification permissions.
- User content reporting.
- Data export/delete path.
