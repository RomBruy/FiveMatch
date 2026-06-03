---
title: FiveMatch
status: final
created: 2026-05-31
updated: 2026-05-31
---

# PRD: FiveMatch

## 0. Document Purpose

This PRD defines the MVP for FiveMatch, a native mobile app for private amateur football groups. It is intended for product, UX, architecture, and implementation planning. It builds from the brainstorming session at `_bmad-output/brainstorming/brainstorming-session-20260526-225324.md`; deeper algorithm, stack, and implementation notes are preserved in `addendum.md`.

## 1. Vision

FiveMatch helps groups of friends organize amateur football matches, generate trusted balanced teams, record match history, update rankings, and create shareable football-style content after every game.

The product should feel like FIFA Ultimate Team, Strava, Sunday League football, WhatsApp group organization, and fantasy sports gamification combined. It must be easy enough for casual players to use every week, but credible enough that the team generator becomes the trusted "football brain" of the group.

The MVP focuses on private groups of roughly 10-40 players, where each match uses a smaller confirmed player pool. The core value is the repeatable loop: join group -> rate players -> create match -> confirm attendance -> generate teams -> play -> record result -> update rankings -> share cards and recap.

### 1.1 Product Thesis

FiveMatch wins if the group trusts the app more than the WhatsApp debate. The product should make organizing a match feel lighter, make generated teams feel fair, and turn every completed match into social content players want to share.

### 1.2 MVP Trade-offs

- Prioritize the team generator and rating trust over broad social networking.
- Keep score/stat validation simple: organizer/admin owns official result entry for MVP.
- Keep cards live and shareable before building historical collectible mechanics.
- Keep Pronostics, tournaments, public leagues, and full social feed out of MVP so the weekly private-group loop is strong first.
- Use simple controls for complex algorithm behavior so groups can customize play style without managing raw weights.

## 2. Target User

### 2.1 Jobs To Be Done

- Organize amateur football matches without messy group-chat coordination.
- Know who is playing, who is waitlisted, and whether enough players are confirmed.
- Generate teams that feel fair, fresh, and explainable.
- Track personal and group performance over time.
- Create bragging rights through rankings, MVPs, stats, and live player cards.
- Share official-looking match recaps and Panini-style player cards.
- Keep the experience fun with locker-room personality, banter, and social identity.

### 2.2 Non-Users (v1)

- Public football leagues requiring formal federation workflows.
- Professional clubs needing coaching, scouting, payroll, or tactical analytics.
- Large tournament organizers needing multi-pitch scheduling and referee operations.
- Users looking only for a social feed without match organization.

### 2.3 Key User Journeys

- **UJ-1. Roro creates a private football group.**
  Roro opens the mobile app, signs in, creates a group, chooses French or English, sets play style, goalkeeper mode, intensity, and default generator style, then shares an invite link with friends. The group is ready to collect players and ratings.

- **UJ-2. A new player joins and becomes rateable.**
  A friend opens the invite link, joins the group, completes identity and football profile fields, and appears in the `Joueurs` list. Other players can rate them once so they receive an initial OVR and eventually unlock their live Panini card.

- **UJ-3. The group unlocks team generation for a match.**
  The organizer creates a 5v5 match. Players tap In, Out, or Maybe. The first 10 In players are confirmed, extra players move to waitlist. Team generation remains blocked until every confirmed player has at least 3 initial peer ratings. Once ready, the organizer generates balanced teams.

- **UJ-4. The organizer confirms fair teams.**
  The organizer reviews Team A, Team B, fairness percentage, simple explanation, and expandable details. They may regenerate before confirmation or use one limited manual adjustment flow. Once confirmed, teams lock and become the official source of truth for match result, stats, MVP votes, ratings, cards, and history.

- **UJ-5. Players complete the post-match loop.**
  After the match, the organizer/admin enters score, goals, and assists. Players vote MVP and are prompted to rate opponents quickly. Ratings can be skipped, but the app explains that ratings improve future team generation. Rankings, stats, and share assets update.

- **UJ-6. A player shares their football identity.**
  Once rated, a player uploads a photo, validates a Panini-style card prompt, receives one generated card image attempt, and shares their live card or MVP/match poster through WhatsApp, Instagram, or PNG export.

## 3. Glossary

- **User** - A person with an authenticated app account.
- **Group** - A private football community containing members, players, matches, ratings, leaderboards, and cards.
- **Group Member** - A user inside a group with a role such as owner, admin, or member.
- **Owner** - The group member with full control over group settings, membership, and destructive admin actions.
- **Admin** - A group member trusted to manage matches, results, and operational workflows.
- **Organizer** - A group member who creates or runs a specific match.
- **Player** - A user's football identity inside one group. A user can have different player profiles across groups.
- **OVR** - Overall player rating on a 0-100 scale.
- **Attribute** - A player capability such as Speed, Attack, Technique, Defense, Physical, Stamina, Fun, or goalkeeper-specific equivalents.
- **Initial Peer Rating** - One-time rating submitted by one player about another player in the same group.
- **Post-Match Rating** - Short rating submitted after a match by a player about opponents.
- **Form** - Recent performance trend, moving faster than OVR.
- **Match** - A scheduled football event inside a group.
- **Attendance** - Player response to a match: In, Out, Maybe, or Waitlist.
- **Confirmed Player** - A player accepted into the match player pool.
- **Waitlist** - Ordered list of players who responded In after the match reached capacity.
- **Team Generation Version** - A saved team split produced before team confirmation.
- **Generator Style** - The selected behavior profile for the team generator, such as Fair + Fresh, Maximum Fairness, or More Variety.
- **Fairness Percentage** - User-facing score that summarizes how balanced a generated split is.
- **Locked Teams** - Confirmed teams that cannot be casually changed and become official for match history.
- **Match Completion Finalization** - The point when result data is considered official for stats, ratings, leaderboards, cards, and history.
- **Voided Match** - A finalized match marked invalid by an owner/admin and excluded from leaderboards and rating evolution while preserved in history.
- **MVP Vote** - One post-match vote for player of the match. Players cannot vote for themselves.
- **Live Player Card** - Panini-style player card reflecting current player identity, rating, stats, and form.
- **Vestiaire** - The fun/social layer for personality fields, group votes, banter awards, and locker-room identity.
- **Share Asset** - Generated image such as player card, MVP card, or match result poster.

## 4. Features

### 4.1 Authentication And Mobile App Access

**Description:** FiveMatch is a native mobile app distributed through Apple App Store and Google Play Store. Users authenticate before creating or joining groups.

#### FR-1: Mobile authentication

Users can sign in using Google, Apple, or email/password.

**Consequences:**
- Apple Sign In is available on iOS.
- Authenticated users can access their groups and player profiles.
- Unauthenticated users can open invite links but must authenticate before joining.
- Magic link authentication is deferred from MVP unless it is provided cheaply by the selected auth provider.

#### FR-2: Account and language preferences

Users can manage basic account details and personal app language.

**Consequences:**
- Supported app languages are French and English.
- Personal app language can differ from group default language.

### 4.2 Groups And Membership

**Description:** A group is the core private community. Users create or join groups, and each group stores its own players, ratings, matches, leaderboards, and cards.

#### FR-3: Create group

Authenticated users can create a group with name, default language, play style, intensity, goalkeeper mode, and default generator style.

**Consequences:**
- Default play style options are fixed, flexible, rotating, and hybrid.
- Default goalkeeper mode options are fixed goalkeeper, rotating goalkeeper, and no goalkeeper.
- Default generator style options are Fair + Fresh, Maximum Fairness, and More Variety.

#### FR-4: Invite and join group

Group owners/admins can create invite links, and authenticated users can join through valid invite links.

**Consequences:**
- Joined users become group members.
- Joined users can create a player profile in that group.

#### FR-5: Manage group roles and settings

Owners/admins can update group settings and manage membership.

**Consequences:**
- Changing group settings affects future team generation.
- Existing locked match history is preserved.

### 4.3 Player Profile And Identity

**Description:** Players have a competitive profile for ratings and team balance, and a personality profile for cards, Vestiaire, and sharing.

#### FR-6: Complete player identity

Players can set first name, last name, nickname, photo, language, bio/devise, and group association.

**Consequences:**
- Player identity appears in roster, match, card, and leaderboard views.
- Photo is used for card generation and roster avatars.

#### FR-7: Complete football profile

Players can set preferred position/style, dominant foot, jersey number, club de formation, and play style.

**Consequences:**
- Football profile can inform display and future algorithm weighting.
- OVR and attributes are calculated from ratings and match history, not free-text profile claims alone.

#### FR-8: Complete Vestiaire personality

Players can add fun fields such as specialty, favorite excuse, bad-faith level, locker-room style, third-half profile, war cry, signature celebration, worst on-pitch habit, and legendary phrase.

**Consequences:**
- Vestiaire fields influence card flavor and social content.
- Vestiaire fields do not materially affect competitive team balance.

### 4.4 Initial Peer Ratings

**Description:** Initial peer ratings seed player OVR and attributes. The flow must be structured enough to support the algorithm but fast enough for real group completion.

#### FR-9: Submit one-time initial peer rating

Players can rate other players in the same group once using simplified 0-100 attribute groups.

**Consequences:**
- Initial rating groups are Overall, Speed, Attack, Technique, Defense, Physical, Stamina, and Fun.
- Goalkeeper baseline groups are Overall, Reflexes, Positioning, Handling, Distribution, Communication, Physical, and Fun.
- A player cannot rate themselves.
- Duplicate ratings from the same rater to the same rated player in the same group are prevented.
- Baseline rating values are anonymous by default; players can see progress counts, not who gave which score.
- Players can edit an initial peer rating until that rating is used in a confirmed team generation version.

#### FR-10: Show rating progress

The app shows rating progress for the group and for the current user.

**Consequences:**
- Players can see who still needs ratings to unlock team generation.
- Team generation readiness is based only on confirmed players for the match.
- Progress can show counts such as "7 ratings received" without exposing individual rater scores.

#### FR-11: Block team generation until baseline threshold is met

Team generation is blocked until every confirmed match player has at least 3 initial peer ratings.

**Consequences:**
- The app explains which confirmed players need more ratings.
- The app provides a path to rate players or remind the group.

### 4.5 Match Creation And Attendance

**Description:** Organizers create matches, players respond, and the app builds a confirmed player pool for team generation.

#### FR-12: Create match

Owners/admins can create matches with title, date/time, location, team size, attendance deadline, optional generator style override, and optional goalkeeper mode override.

**Consequences:**
- Presets include 5v5, 6v6, and 7v7.
- Custom match sizes are supported.
- Max players are calculated from players per team multiplied by two.
- MVP supports a minimum playable format of 4v4 and recommends 5v5 as the default first match format.

#### FR-13: Submit attendance

Players can respond In, Out, or Maybe to an open match.

**Consequences:**
- In players are confirmed until max players is reached.
- Additional In players are waitlisted by confirmation time.
- Maybe does not count as confirmed and affects reminders only; it does not influence waitlist priority.

#### FR-14: Manage waitlist

The app maintains an ordered waitlist when a match is full.

**Consequences:**
- If a confirmed player cancels before teams are locked, the first waitlisted player moves into confirmed status.
- Players can see their waitlist position.

### 4.6 Team Generation

**Description:** The team generator is the core differentiator. It creates fair, fresh, explainable teams from confirmed players.

#### FR-15: Generate team versions

Owners/admins can generate team versions from confirmed players after baseline ratings meet the threshold.

**Consequences:**
- Generated versions include Team A, Team B, team totals, fairness percentage, simple explanation, and expandable details.
- The algorithm considers OVR, attributes, form, group play style, goalkeeper mode, generator style, and previous teammate pairing history.
- Generated versions are saved.

#### FR-16: Regenerate teams before confirmation

Owners/admins can regenerate teams before confirmation.

**Consequences:**
- Each regeneration creates a saved version.
- The organizer can compare versions and choose one to confirm.
- MVP allows up to 5 generated versions before confirmation to prevent endless rerolling.

#### FR-17: Use one limited manual adjustment flow

Owners/admins can use one limited manual adjustment flow before team confirmation.

**Consequences:**
- The app does not promote manual editing as the main path.
- Team sizes must remain valid.
- Fairness percentage recalculates after manual adjustment.
- The version is marked manually adjusted.

#### FR-18: Confirm and lock teams

Owners/admins can confirm a team generation version, after which teams lock.

**Consequences:**
- Locked teams become the source of truth for score, stats, MVP votes, ratings, cards, and match history.
- Casual edits after confirmation are not allowed.
- Before score submission, an organizer/admin can cancel locked teams and reopen team generation if a real-life change happens.
- After score submission, team changes are not allowed; organizer/admin must correct the result data before finalization or use the owner/admin void flow after finalization.

### 4.7 Match Results And Post-Match Flow

**Description:** After play, the app records match outcome, stats, MVP votes, and opponent ratings.

#### FR-19: Submit final score

Owners/admins can submit final score for locked teams.

**Consequences:**
- Result is visible to all group members.
- Score submission enables post-match flow.
- Organizer/admin can edit score and match events until match completion is finalized.
- After completion finalization, owner/admin can void a match; voided matches are excluded from leaderboards and rating evolution and preserved in history as voided.

#### FR-20: Submit goals and assists

Owners/admins can enter goals and assists by player.

**Consequences:**
- Goals and assists update player statistics.
- Player-submitted stats are out of MVP scope.

#### FR-21: Submit MVP vote

Confirmed match players can vote for one MVP.

**Consequences:**
- Players cannot vote for themselves.
- A player can vote only once per match.
- Only confirmed players from locked teams can vote.

#### FR-22: Submit quick opponent ratings

Confirmed match players can rate opponents quickly after the match.

**Consequences:**
- Players can only rate opponents.
- Ratings include performance rating and optional tags.
- Players can skip, but the app explains that ratings improve future team generation.

### 4.8 Rating Evolution And Anti-Abuse

**Description:** Ratings evolve after matches. OVR should be truthful and stable; form should reflect recent performance.

#### FR-23: Evolve OVR and form after matches

The system updates OVR, form, and attributes using post-match ratings, MVP votes, tags, stats, and team result.

**Consequences:**
- Ratings can go up or down.
- OVR moves slower than form.
- Fun mainly affects identity and social content.

#### FR-24: Protect ratings from abuse

The system reduces the impact of suspicious or extreme rating behavior.

**Consequences:**
- Self-ratings are blocked.
- Duplicate ratings are blocked.
- Extreme outlier ratings are softened or ignored.
- Repeated suspicious rating behavior has reduced influence.

### 4.9 Leaderboards And Statistics

**Description:** FiveMatch tracks competitive history and creates banter through rankings.

#### FR-25: Show leaderboards

Group members can view leaderboards by Overall, Goals, Assists, MVPs, Form, Win rate, and Attendance.

**Consequences:**
- Leaderboards support All-time, This month, Last 5 matches, and Season periods.
- MVP prepares the Season data model, but visible season management is deferred unless implementation cost is low.

#### FR-26: Show player statistics

Players can view matches played, wins, losses, draws, win rate, goals, assists, MVPs, average match rating, current form, attendance percentage, best card, and recent matches.

**Consequences:**
- Stats update after match completion.
- Stats are group-specific.

### 4.10 Cards, Image Generation, And Sharing

**Description:** Cards and match posters create the viral layer, but they support the match loop rather than replacing it.

#### FR-27: Unlock live player card after OVR

Players can generate their live Panini-style player card after they have an OVR.

**Consequences:**
- Before OVR exists, the card is locked.
- The live card reflects current rating, attributes, stats, form, identity, and group.

#### FR-28: Generate Panini-style card image

Players can upload a photo, choose and validate a style prompt, and receive one generated card image attempt.

**Consequences:**
- Supported styling includes retro football sticker look, France-inspired jersey, historical football-inspired jersey, hairstyle changes, and football-era themes.
- Text, OVR, stats, QR code, and branding are rendered by the app after image generation.
- MVP includes one free successful generated card image attempt per player profile per group.
- Failed technical generation attempts do not count against the user's attempt.
- Aesthetic retries are deferred from MVP.
- Uploaded photos and prompts must pass automated safety checks before generation.
- Users can report generated cards or uploaded profile images.

#### FR-29: Generate MVP card and match result poster

All group members can generate available MVP cards and match result posters after match completion.

**Consequences:**
- Share assets can be exported to WhatsApp, Instagram, native share sheet, and PNG.
- Users choose what to share.

### 4.11 Notifications

**Description:** Push notifications bring users back into the operational match loop.

#### FR-30: Send operational push notifications

The app sends push notifications for rating reminders, match reminders, waitlist updates, teams generated, teams locked, score submitted, MVP voting open, opponent rating reminder, card ready, and match poster ready.

**Consequences:**
- Users can manage notification preferences.
- Push notifications handle operations; WhatsApp and Instagram handle viral sharing.

## 5. Information Architecture

MVP bottom navigation:

- **Accueil** - Group pulse: current group, next match, attendance status, organizer CTA, last result, top ranking highlights, latest share recap.
- **Joueurs** - Roster and rating: search, player list, rating progress, rating CTA, player cards, share card action, player details.
- **Match** - Match operations: details, attendance list, waitlist, team generation, locked teams, result entry, previous match summary.
- **Vestiaire** - Fun/social layer: group votes, MVP shortcuts, banter awards, achievements, locker-room titles, playful identity prompts.
- **Profil** - Personal identity/settings: photo, name, nickname, football identity, Panini card setup, groups, language, stats summary, logout.

## 6. Platform And Localization

FiveMatch MVP targets native mobile distribution through Apple App Store and Google Play Store.

Supported languages are French and English.

The product supports:

- Personal app language.
- Group default language.
- Export language for share assets.

Shared card and poster text should use localized flavor, not only literal translation.

## 7. Cross-Cutting Non-Functional Requirements

### NFR-1: Team generation responsiveness

Team generation should return a generated version within 3 seconds for a normal MVP match size up to 22 confirmed players under typical backend conditions.

**Consequences:**
- If generation takes longer, the app shows an active loading state.
- Failed generation attempts return a clear retryable error and do not lock teams.

### NFR-2: Rating and result data integrity

Rating, attendance, team confirmation, and match result submissions must be idempotent where duplicate taps or retries could occur.

**Consequences:**
- Duplicate peer ratings, duplicate post-match ratings, duplicate MVP votes, and duplicate attendance writes are prevented.
- Locked teams remain the source of truth for match scoring and post-match flows.

### NFR-3: Privacy and account control

The app must support privacy policy requirements for App Store and Google Play distribution.

**Consequences:**
- Users can request account deletion.
- Baseline rating values remain anonymous by default.
- User-generated profile images, generated cards, and prompts can be reported or blocked.

### NFR-4: Image safety and moderation

Uploaded photos and card prompts must pass automated safety checks before image generation.

**Consequences:**
- Blocked prompts/images do not generate a card attempt.
- Technical failures do not consume the user's one free successful generation attempt.
- Generated outputs can be reported.

### NFR-5: Localization

All user-facing product text, push notification text, card text, and share asset text must support French and English.

**Consequences:**
- Personal app language, group default language, and export language are independently supported.
- Shared cards and posters use localized flavor rather than literal-only translations.

### NFR-6: Notification consent and control

Push notifications must follow mobile platform permission rules and provide user controls.

**Consequences:**
- Users are asked for notification permission before receiving push notifications.
- Users can manage notification preferences.
- Operational notifications are separate from viral sharing actions.

### NFR-7: Accessibility baseline

The mobile app should support basic accessibility expectations for a consumer app.

**Consequences:**
- Core flows are usable with screen-reader labels for buttons and form controls.
- Color should not be the only way to distinguish critical status such as In, Out, Waitlist, Teams locked, or Voided Match.
- Touch targets for primary actions meet mobile accessibility norms.

## 8. Constraints And Guardrails

- The social layer should stay simple; algorithm trust is the priority.
- Ratings must not become too time-consuming.
- Image generation must keep the player recognizable and the card readable.
- AI-generated visuals must follow safety and moderation rules.
- Uploaded photos, prompts, and generated images must be blockable or reportable.
- The app must support account deletion and privacy policy requirements for store distribution.
- The app must request notification permissions clearly.
- The app must avoid exposing hidden confidence or smoothing metrics as user-facing clutter.

## 9. Non-Goals

- Public leagues are not in MVP.
- City rankings are not in MVP.
- Group-vs-group tournaments are not in MVP.
- Multi-team rotation modes are not in MVP.
- Full Pronostics/fantasy feature is not in MVP.
- Pronostics is hidden or deferred in MVP; it can return as a lightweight prediction game in V1.1.
- Full social feed with comments and reactions is not in MVP.
- Player-submitted stats with organizer validation are not in MVP.
- Historical collectible card snapshots are not in MVP.
- Advanced card rarity economy is not in MVP.
- Subscriptions and venue integrations are not in MVP.

## 10. MVP Scope

### 10.1 In Scope

- Native mobile app shell.
- Authentication.
- Group creation and invites.
- Group settings.
- Player profile and roster.
- Initial peer rating flow.
- Match creation.
- Attendance and waitlist.
- Team generator.
- Team confirmation and locking.
- Score, goals, and assists entry.
- MVP voting.
- Quick opponent ratings.
- Rating evolution.
- Player statistics.
- Period-based leaderboards.
- Live Panini card.
- MVP card.
- Match result poster.
- Push notifications.
- WhatsApp, Instagram, native share, and PNG export.

### 10.2 Out Of Scope For MVP

- Public leagues.
- Group-vs-group tournaments.
- Multi-team modes.
- Full Pronostics.
- Full social feed.
- Player-submitted stats.
- Historical card collection.
- Subscriptions.
- Venue integrations.

## 11. Success Metrics

**Primary**

- **SM-1:** Team generation trust - At least 80% of generated matches are accepted without manual adjustment after the first month. Validates FR-15, FR-16, FR-18.
- **SM-2:** Weekly match completion - At least 60% of active groups complete one match within two weeks of creating a group. Validates FR-3, FR-12, FR-19.
- **SM-3:** Rating coverage - At least 80% of confirmed match players reach the 3-rating threshold before team generation. Validates FR-9, FR-10, FR-11.

**Secondary**

- **SM-4:** Post-match completion - At least 60% of confirmed players submit MVP vote or opponent ratings after match completion. Validates FR-21, FR-22.
- **SM-5:** Share activation - At least 40% of completed matches produce at least one shared card or poster. Validates FR-27, FR-29.
- **SM-6:** Return usage - At least 50% of groups that complete one match create a second match within 30 days. Validates the core loop.

**Counter-metrics**

- **SM-C1:** Rating fatigue - Do not optimize rating prompts if post-match rating completion drops below 40%.
- **SM-C2:** Manual override dependency - Do not optimize for more manual edits; manual adjustment rate should stay low.
- **SM-C3:** Image generation cost - Do not optimize card generation volume without monitoring cost and moderation load.

## 12. Open Questions

1. What are the exact OVR formulas by position/style after real match data exists? Owner: product + algorithm/engineering. Revisit after simulation and first real group playtests.
2. What is the exact goalkeeper normalization formula after playtesting? Owner: product + algorithm/engineering. Revisit after matches with fixed and rotating goalkeeper modes.
3. What is the exact fairness percentage normalization after simulation testing? Owner: product + algorithm/engineering. Revisit before public beta.
4. Which formula tuning targets should be adjusted after the first real group playtests? Owner: product. Revisit after 3-5 completed matches from at least one pilot group.

## 13. Assumptions Index

No unresolved assumptions remain in the PRD. Remaining questions are tuning or operational policy details.
