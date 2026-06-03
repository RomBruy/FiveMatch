---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'FiveMatch product concept, rating system, player archetypes, and team generation algorithm'
session_goals: 'Define the MVP and progressively explore data model, rating attributes, team balancing algorithm, UX flow, cards, social sharing, API, and future architecture'
selected_approach: 'progressive-flow'
techniques_used: ['What If Scenarios', 'Solution Matrix', 'First Principles Thinking', 'Decision Tree Mapping']
ideas_generated: ['Fun-first trusted team coach with strong algorithm and complete match history', 'Group play-style setup: fixed positions vs rotating/everyone plays everywhere', 'Editable group identity controls algorithm weighting', 'Public overall rating with algorithmic sub-scores', 'Bilingual app and card identity in French and English', 'Language layers: group default, personal app language, export language', 'MVP trusted Fair + Fresh generator with simple controls', 'Quick initial ratings, detailed post-match ratings', 'Private rating smoothing based on baseline coverage and match history', 'Social and viral sharing as the product amplification layer', 'Player-chosen post-match sharing', 'All group users can view and generate share assets', 'Simple visibility and validation, strong algorithmic depth', 'Large groups with per-match selected players, future inter-group tournaments', 'First-come attendance overflow for MVP']
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Roro
**Date:** 2026-05-26

## Session Overview

**Topic:** FiveMatch product concept, rating system, player archetypes, and team generation algorithm.

**Goals:** Define a strong MVP and progressively explore all major product areas: data model, rating attributes, team balancing algorithm, UX flow, card system, social sharing, API design, and future architecture.

### Context Guidance

FiveMatch is a mobile-first native app for private amateur football groups. The key product loop is: players join a group, rate each other, confirm match attendance, receive automatically balanced teams, record match outcomes, update rankings, unlock/share player cards, and repeat.

### Session Setup

The current brainstorming focus is the core differentiator: a trusted team generation engine powered by player attributes rated on a 0-100 scale. The system should support outfield and goalkeeper attributes, generate a useful overall score, balance teams fairly, avoid repetitive pairings, and create playful French-style player archetypes such as "Le Guerrier", "Le Maestro", or "Le Sniper".

## Technique Selection

**Approach:** Progressive Technique Flow

**Journey Design:** Systematic development from broad product exploration to an implementation-ready algorithm spec.

**Progressive Techniques:**

- **Phase 1 - Exploration:** What If Scenarios for expanding the rating, fairness, card, and social mechanics.
- **Phase 2 - Pattern Recognition:** Solution Matrix for organizing attributes, positions, stats, peer ratings, form, chemistry, archetypes, and fairness.
- **Phase 3 - Development:** First Principles Thinking for defining what must be true for the algorithm to be trusted.
- **Phase 4 - Action Planning:** Decision Tree Mapping for converting the system into build decisions, fallback rules, and MVP boundaries.

**Journey Rationale:** FiveMatch needs a product loop that feels playful and viral, but its core algorithm must feel trustworthy enough to settle real group debates. This flow protects both sides: creative exploration first, then structure, then hard algorithm decisions.

## Technique Execution Results

**What If Scenarios:**

**[Product #1]: Fun-First Trusted Team Coach**
_Concept_: FiveMatch should feel fun and easy for casual football groups, while using a strong algorithm and full match history underneath. The app becomes trusted because it remembers every match, every team split, every rating, and every result.
_Novelty_: The product does not present itself as a dry statistics tool; it presents itself as a playful football companion that quietly carries the authority of a serious ranking and balancing system.

**[Algorithm #2]: Group Play-Style Setup**
_Concept_: When a group is created, FiveMatch asks whether the group plays with fixed positions or whether everyone rotates and plays everywhere. This setting changes how strongly position balance affects team generation.
_Novelty_: Instead of forcing professional football structure onto casual games, the algorithm adapts to the group's real culture: serious positional roles, casual rotation, or a hybrid mode.

**[Algorithm #3]: Editable Group Identity Controls Algorithm Weighting**
_Concept_: The organizer selects the group identity during group creation and can later change it in group settings. Changing this identity updates the team generation weights, such as how much position balance, goalkeeper balance, physicality, technical skill, or randomness matters.
_Novelty_: FiveMatch treats each group as its own football universe with configurable rules, making the same algorithm feel personalized instead of generic.

**[Rating #4]: Public Overall Rating with Algorithmic Sub-Scores**
_Concept_: Each player has one simple public overall rating on a 0-100 scale, while the algorithm also maintains sub-scores such as attacking, defending, technical, physical, versatility, form, and fun. Different group play styles decide which sub-scores matter most when generating teams.
_Novelty_: The user experience stays simple and card-like, but the balancing engine remains nuanced enough to adapt to fixed-position, flexible, rotating, or hybrid groups.

**[UX #5]: Bilingual App and Card Identity**
_Concept_: FiveMatch should support French and English for all product text, group settings, algorithm explanations, player cards, achievements, and funny archetype names. Card titles should have localized flavor rather than direct literal translations.
_Novelty_: The viral identity layer travels better because players can share cards in the language of their group while keeping the same underlying rating and algorithm data.

**[UX #6]: Language Layers for App and Sharing**
_Concept_: FiveMatch should support a group default language, each user's personal app language, and an export language choice for player cards and match posters. This lets bilingual groups operate naturally while social content is shared in the language that fits the audience.
_Novelty_: Localization becomes part of the sharing engine, not only a settings checkbox.

**[Algorithm #7]: MVP Trusted Fair + Fresh Generator**
_Concept_: The MVP should launch with one trusted default team generator, supported by simple controls such as Fair + Fresh, Maximum Fairness, and More Variety. Branded modes like Rivalry Night, Chaos Mode, and Development Mode should come later after users trust the core engine.
_Novelty_: The product protects algorithm trust early while leaving room for playful mode expansion after the balancing system proves itself.

**[Rating #8]: Quick Initial Ratings, Detailed Post-Match Ratings**
_Concept_: Initial group setup should use quick ratings so onboarding stays easy. After the first match, FiveMatch collects richer data: each player rates opponents, votes for one MVP, and match stats/history begin shaping the algorithm.
_Novelty_: The system starts fast with approximate social knowledge, then naturally becomes more accurate as real match data accumulates.

**[Rating #9]: Private Rating Smoothing from Coverage and History**
_Concept_: Before the first match, all group members should quickly rate every other player to establish a baseline. After each match, players submit a very small rating flow for opponents plus MVP voting. FiveMatch should use baseline coverage and match history internally to smooth ratings, but should not show a visible confidence score.
_Novelty_: The app protects rating quality without adding an extra visible metric that could make the experience feel too technical or serious.

**[Growth #10]: Social and Viral Sharing as Amplification Layer**
_Concept_: FiveMatch should use cards, match results, MVP moments, rankings, and statistics as shareable social artifacts. The experience should feel like FIFA Ultimate Team plus Strava plus Sunday League banter plus WhatsApp organization plus fantasy sports gamification.
_Novelty_: The app does not rely only on utility; every completed match creates content that players want to share back into WhatsApp, Instagram, and private group chats.

**[Growth #11]: Player-Chosen Post-Match Sharing**
_Concept_: After match completion, FiveMatch generates shareable assets such as match posters, MVP cards, player cards, ranking snapshots, and achievement unlocks, but each player chooses what they want to export or share.
_Novelty_: Sharing feels personal and voluntary, reducing spam while increasing pride and social motivation.

**[Growth #12]: Open Group Share Asset Generation**
_Concept_: All users in a group can see match results, player cards, ranking snapshots, and shareable assets, and all users can generate/export the available images. Organizer-only controls should be reserved for match administration, not social sharing.
_Novelty_: Social sharing is democratized across the group, so the viral loop does not depend on one organizer doing all the posting.

**[MVP #13]: Simple Visibility and Validation, Strong Algorithmic Depth**
_Concept_: The MVP should avoid complex visibility restrictions and heavy result-validation workflows. Organizer/admin users can submit and edit official match results, while all group members can see the results and generate share assets. Product sophistication should focus on the team balancing algorithm, ratings, history, and player evolution.
_Novelty_: FiveMatch keeps the social product lightweight while investing complexity where it creates trust and differentiation.

**[Competition #14]: Large Groups, Per-Match Selection, Future Inter-Group Tournaments**
_Concept_: A group can contain many players, such as 40 members, but each match uses only the players who confirm attendance for that match. For MVP, the generator creates two teams from the confirmed player pool. Later, FiveMatch can support tournaments and matches between groups.
_Novelty_: The architecture can support large communities without forcing tournament complexity into the first version.

**[Attendance #15]: First-Come Attendance Overflow for MVP**
_Concept_: If more players confirm than the match format allows, MVP uses first-come, first-served based on confirmation time. Extra players are placed on a waitlist. Smarter rotation or attendance-priority logic can be added later.
_Novelty_: The attendance flow stays predictable and easy to understand while preserving future space for fair-rotation mechanics.

**Solution Matrix:**

**Group Settings Accepted for MVP**

- Group name
- Default language: French / English
- Play style: Fixed / Flexible / Rotating / Hybrid
- Intensity: Casual / Balanced / Competitive
- Default generator: Fair + Fresh / Maximum Fairness / More Variety

These settings control how the team generation algorithm weights position balance, rating balance, history, repetition, and randomness.

**Match Settings Accepted for MVP**

- Title
- Date
- Time
- Location
- Format presets: 5v5 / 6v6 / 7v7
- Custom format support for other sizes
- Max players
- Attendance deadline
- Organizer
- Status: open / full / teams generated / completed / cancelled
- Generator style: use group default or override

Custom format support is important because amateur groups may play many different sizes depending on venue and attendance.

**Player Rating Inputs - Direction**

FiveMatch should use FIFA-like attributes as first-class inputs for the overall rating and team balancing algorithm, not only a single generic rating.

Outfield attributes:

- Speed
- Shooting
- Passing
- Dribbling / Technique
- Defense
- Physical
- Stamina
- Vision
- Fun

Goalkeeper attributes:

- Reflexes
- Positioning
- Handling
- Distribution
- Communication
- Diving
- Reactions
- Fun

The player-visible OVR should be derived from these attributes, match ratings, tags, form, and stats. Fun contributes to identity, cards, achievements, and social labels, but should have little or no effect on competitive team balance.

**Player Rating Lifecycle**

Players rate other players once to create the initial attribute baseline. After that, the algorithm takes over and evolves ratings using match ratings, MVP votes, tags, stats, form, and match history.

This prevents rating fatigue while still giving the algorithm enough structured data to start.

**Initial Peer Rating Format**

Use simplified attribute groups for the one-time baseline rating:

- Overall
- Speed
- Attack
- Technique
- Defense
- Physical
- Stamina
- Fun

The system maps these simplified groups into detailed FIFA-like attributes for cards and balancing. This is the best MVP tradeoff between accuracy and speed.

**Goalkeeper Mode Support**

FiveMatch should support multiple goalkeeper styles:

- Fixed goalkeeper
- Rotating goalkeeper
- No goalkeeper

This can be configured at group level and overridden at match level. The balancing algorithm adjusts whether goalkeeper attributes matter strongly, lightly, or not at all.

**Team Generation Output**

The algorithm should show a visible fairness percentage, such as 94%, alongside Team A and Team B. This gives users a simple trust signal without exposing all internal calculations.

**Regeneratable Team Versions**

The organizer can regenerate teams multiple times. Each generated split should be saved as a version with its fairness percentage, team totals, and explanation. The organizer can compare versions and confirm the preferred split.

**Manual Team Edit Rule**

The organizer can manually edit a generated team split only once, as an exception for real-life context the algorithm may not know. The UI should not push or promote manual editing. If an edit is made, FiveMatch recalculates the fairness percentage and marks the team split as manually adjusted.

**Team Locking Rule**

Teams should be locked once the organizer confirms the generated team version. Before confirmation, the organizer can regenerate or use the limited manual adjustment flow. After confirmation, the teams become the official match teams used for score, stats, ratings, and history.

**Algorithm Explanation Display**

Show a simple explanation by default, with expandable details for users who want more transparency. Default explanation should use short trust-building bullets. Expanded details can show team totals, attribute gaps, goalkeeper comparison, form balance, and history/repetition impact.

**First Principles for FiveMatch Algorithm**

1. The algorithm only uses confirmed players for the specific match.
2. Ratings use a 0-100 scale and are seeded once by group peer ratings.
3. After the baseline, ratings evolve from match data, post-match ratings, tags, MVP votes, stats, form, and history.
4. Group play style changes algorithm weights.
5. MVP team generation creates two teams.
6. Fairness is shown as a percentage.
7. Teams lock once the organizer confirms them.
8. All group members can view and generate share assets.
9. The social UX stays simple while the algorithm logic remains deep and trustworthy.

**Decision Tree for Team Generation**

1. Check whether the match is open for attendance.
2. Check whether enough players confirmed.
3. If confirmed players exceed max players, use first-come confirmed players and waitlist the rest.
4. If teams are already confirmed, teams are locked.
5. If teams are not confirmed, generate teams using group play style, goalkeeper mode, and generator style.
6. Generate candidate team splits.
7. Score each split using rating gap, attribute balance, goalkeeper balance, form balance, and repeated-pairing history.
8. Show the selected team version with fairness percentage, simple explanation, and expandable details.
9. Allow regeneration before confirmation.
10. Allow one limited manual adjustment flow before confirmation.
11. Once confirmed, lock teams for score, stats, ratings, MVP, cards, and match history.

**Team Generator Response Shape**

The generator should return match ID, version number, Team A, Team B, fairness percentage, team totals, simple explanation bullets, and expandable details such as rating gap, attack gap, defense gap, speed gap, goalkeeper gap, form gap, and repetition penalty.

**MVP User Flow**

1. User creates group.
2. Organizer sets group language, play style, intensity, goalkeeper mode, and generator style.
3. Organizer invites players.
4. Players join group.
5. Players complete profile.
6. Players rate each other once.
7. Organizer creates match.
8. Players confirm attendance.
9. If match is full, extra players go waitlist.
10. Organizer generates teams.
11. Organizer confirms teams.
12. Teams lock.
13. Match is played.
14. Organizer/admin enters score.
15. Organizer/admin enters goals and assists.
16. Players vote MVP.
17. Players rate opponents quickly.
18. Rankings and stats update.
19. Cards/result images become available to all group members.
20. Players choose what to share.

**Post-Match Rating Completion Rule**

Players can skip opponent ratings, but the UI should clearly communicate that completing ratings improves the next match's team generation. Skipping should be allowed but not recommended.

**Match Stat Entry Rule**

For MVP, organizer/admin users enter the final score, goals, and assists. This keeps match data clean and avoids heavy validation workflows. Later versions can support player-submitted stats with organizer confirmation.

**Leaderboard and Statistics Scope**

MVP leaderboards should include overall ranking, goals, assists, MVPs, form, win rate, and attendance. Player profiles should track matches played, wins, losses, draws, win rate, goals, assists, MVPs, average match rating, current form, attendance percentage, best card, and recent matches.

Leaderboards should support periods:

- All-time
- This month
- Last 5 matches
- Season

Period-based rankings create both long-term prestige and short-term comeback opportunities.

**MVP Share Asset Scope**

MVP should support three image types:

- Player card
- MVP card
- Match result poster

Player cards should be live, reflecting the player's current rating, stats, form, and identity. Historical collectible card snapshots can be added later.

**Card Visual Direction**

Player cards should lean Panini/sticker-style for MVP, with collectible, playful, football-culture energy rather than a purely serious pro-card style.

Players should be able to upload a picture of themselves for their card. Prompt-based image customization is an important requirement: users can describe the vibe of their player image/card visual. This must remain controlled enough to keep cards consistent, safe, recognizable, and on-brand.

**Card Image Generation Rule**

Users validate what they want before generation, then get one generated card image attempt. The goal is to transform the uploaded photo into a Panini-style football image, with controlled styling options such as retro France jersey, historical football jerseys, different hairstyle, classic sticker look, or football-era themes.

## Technical Structure Notes

**Core Data Areas**

- Users and authentication
- Groups and group settings
- Players and player profiles
- Initial peer ratings
- Player attributes and evolved ratings
- Matches and attendance
- Team generation versions
- Locked teams and team players
- Match events, goals, assists, and score
- MVP votes
- Post-match opponent ratings
- Statistics and leaderboards
- Player cards and image generations
- Share/export assets

**Recommended Tables**

- `users`
- `groups`
- `group_settings`
- `group_members`
- `players`
- `player_attributes`
- `initial_peer_ratings`
- `post_match_ratings`
- `matches`
- `match_attendance`
- `team_generation_versions`
- `team_generation_players`
- `match_events`
- `mvp_votes`
- `player_statistics`
- `player_cards`
- `image_generations`

**Important Database Rules**

- A user can belong to many groups.
- A player profile belongs to one user inside one group.
- Initial peer ratings are submitted once per rater, rated player, and group.
- Team generation versions are saved before confirmation.
- Confirmed teams are locked and used as the source of truth for score, stats, MVP votes, ratings, cards, and match history.
- Player cards are live in MVP.
- Prompt-based card image generation has one validated generation attempt.

**Recommended API Domains**

- `groups`: create group, update settings, get members, create invite, join by invite.
- `players`: profile, photo upload, card, stats.
- `ratings`: initial peer rating, rating progress, post-match ratings, skipped ratings.
- `matches`: create/update/cancel match, attendance, match detail, group schedule.
- `teamGenerator`: generate teams, regenerate teams, manual adjustment, confirm version, get versions.
- `matchResults`: final score, goals, assists, MVP vote, complete match.
- `leaderboards`: overall rankings, period rankings, player rank, ranking snapshot.
- `cards`: live player card, MVP card, match poster, exports.
- `imageGeneration`: prompt validation, player image generation, status, generated image confirmation.

**Team Generator Service Contract**

Input should be small: match ID and optional generator style override. The service loads match data, group settings, confirmed players, player attributes, ratings, history, previous pairings, and goalkeeper mode internally.

Output should include match ID, version number, Team A, Team B, fairness percentage, team totals, simple explanation bullets, and expandable details including rating gap, attack gap, defense gap, speed gap, physical gap, stamina gap, goalkeeper gap, form gap, and repetition penalty.

**Manual Adjustment Rules**

- Allowed only before team confirmation.
- Allowed as one limited manual adjustment flow.
- Team sizes must remain valid.
- Fairness is recalculated.
- The version is marked manually adjusted.

**Team Scoring Formula**

The generator creates many possible team splits and scores each candidate:

`candidate_score = rating_gap_penalty + attribute_gap_penalty + goalkeeper_penalty + position_style_penalty + form_penalty + repetition_penalty + generator_style_penalty`

The best split has the lowest candidate score. Fairness percentage is derived from the normalized candidate score.

**Generator Style Weights**

- Fair + Fresh: rating 45%, attributes 25%, history/repetition 20%, randomness 10%.
- Maximum Fairness: rating 60%, attributes 30%, history/repetition 8%, randomness 2%.
- More Variety: rating 35%, attributes 25%, history/repetition 25%, randomness 15%.

**Group Play Style Weights**

- Fixed positions: rating balance 40%, position balance 25%, goalkeeper balance 20%, attribute balance 10%, repetition 5%.
- Flexible: rating balance 40%, attribute balance 30%, repetition 20%, position balance 5%, randomness 5%.
- Rotating: rating balance 35%, stamina/versatility 25%, attribute balance 20%, keeper rotation suitability 10%, repetition 10%.
- Hybrid: rating balance 40%, position balance 15%, attribute balance 25%, goalkeeper balance 10%, repetition 10%.

These weights should live in code as tunable config so the algorithm can improve over time.

**Rating Evolution Formula**

Ratings should move slowly, while form can move faster. OVR represents long-term level. Form represents recent performance.

After each match, calculate match impact from opponent performance ratings, stats impact, MVP votes, team result impact, and tags.

Example formula:

`match_impact = 50% opponent_rating + 20% stats_impact + 20% MVP_impact + 10% team_result_impact`

OVR update should be smoothed:

`new_ovr = old_ovr * 0.85 + match_impact * 0.15`

Form should use a weighted average of recent match impacts, such as the last 3-5 matches.

Ratings can go up or down. FiveMatch should be truthful about player level rather than only showing positive progression. Form can create exciting short-term movement, while OVR stays stable and credible.

Tags softly influence attributes over time:

- Fast -> Speed
- Technical -> Technique / Dribbling
- Playmaker -> Passing / Vision
- Finisher -> Shooting / Attack
- Defensive Wall -> Defense / Physical
- Team Player -> Vision / Passing / Fun
- Aggressive -> Physical / Defense
- Funny -> Fun

**Basic Anti-Abuse Rules for Ratings**

- One initial peer rating per rater, rated player, and group.
- One post-match rating per rater, rated player, and match.
- Players cannot rate themselves.
- Players can only rate opponents after a match.
- MVP voters cannot vote for themselves.
- Extreme outlier ratings should be softened or ignored by the algorithm.
- Repeated suspicious rating behavior should have reduced influence over time.
- Ratings should be used as signal, not absolute truth.

## UX Flow Notes

**MVP Screens**

- Login
- Create / join group
- Group dashboard
- Group settings
- Player profile
- Initial rating flow
- Create match
- Match detail / attendance
- Team generator
- Generated teams
- Match result entry
- MVP voting
- Opponent rating
- Match summary
- Leaderboards
- Player card
- Share / export

**Dashboard Direction**

Use a group-first dashboard by default. The first screen should prioritize the next match, attendance status, latest result, leaderboard highlights, and quick actions. Player identity remains visible through the user's live card and personal stats, but the main job of the app is organizing and sustaining group matches.

**Reference App Inspiration**

The existing vibe-coded app provides a strong functional direction for FiveMatch:

- Mobile-first dark interface.
- Bottom navigation with Accueil, Joueurs, Match, Vestiaire, Pronos, Profil.
- Match screen with attendance, confirmed players, waitlist, and team generation.
- Player list with search, active status, card-style avatars, and share action.
- Initial player rating flow with progress and per-player evaluation.
- Profile setup with personal identity, football identity, and playful locker-room personality fields.
- Pronostics area for predictions and last-match recap.
- Vestiaire area for voting or group-only interaction.

FiveMatch can reuse the spirit of this structure, but should focus the MVP around group organization, ratings, team generation, match history, stats, and social sharing.

**Recommended FiveMatch Bottom Navigation**

For MVP, use:

- Accueil
- Joueurs
- Match
- Vestiaire
- Profil

Rankings can live inside Accueil and Joueurs at first. `Pronos` is a strong later gamification feature, but should not distract from the core MVP loop unless it is very cheap to keep.

**Reference App Features to Keep**

- Attendance card with In / Out and waitlist.
- Confirmed player list with order numbers.
- Generate teams button near attendance.
- Last result card.
- Player rating progress.
- Player profile with personal identity, football identity, and locker-room personality.
- Fun vestiaire fields for card/social identity.

**Reference App Features to Reframe**

- `Pronos` can become a later fantasy/gamification layer.
- `Vestiaire` should become the social/fun hub: votes, banter prompts, funny awards, and group-only personality content.
- Player profile should connect directly to live Panini card generation and sharing.

**FiveMatch Screen Architecture**

`Accueil` is the group pulse screen: current group, next match, attendance status, organizer CTA, last result, top ranking highlights, and latest share recap.

`Joueurs` is the roster and rating screen: search players, player list, rating progress, rating CTA, player cards, share card action, and player detail entry.

`Match` is the match operations screen: next match details, attendance list, waitlist, team generation, confirmed locked teams, result entry, and previous match summary.

`Vestiaire` is the fun/social layer: group votes, MVP shortcuts, banter awards, achievements, locker-room titles, and playful identity prompts.

`Profil` is personal identity and settings: photo, name, nickname, football identity, Panini card setup, groups, language, stats summary, and logout.

**Competitive vs Personality Data**

Competitive data drives ratings and team balance: attributes, OVR, form, stats, match ratings, MVP votes, attendance, and match history.

Personality data drives cards and social sharing: specialities, excuses, bad-faith level, locker-room style, third-half profile, funny titles, and card flavor.

**Player Profile Field Structure**

Identity:

- First name
- Last name
- Nickname
- Photo
- Language
- Bio / devise
- Groups

Football profile:

- Preferred position/style
- Dominant foot
- Jersey number
- Club de formation
- Play style
- OVR
- Attributes
- Stats
- Form
- Live Panini card

Vestiaire personality:

- Speciality
- Favorite excuse
- Bad-faith level
- Locker-room style
- Third-half profile
- War cry
- Signature celebration
- Worst on-pitch habit
- Legendary phrase

Official live Panini card generation should happen after the player has been rated and has an OVR, so the card feels earned and official.

**Rating Progress and Unlock Rules**

The app should show rating progress, such as how many players the user has rated and how many ratings a player has received.

Team generation should be blocked until required baseline ratings are complete enough for the match's confirmed players. This protects trust in the first algorithm output.

Card generation should also unlock after the player has an OVR.

MVP baseline threshold: each confirmed match player needs at least 3 initial peer ratings before team generation unlocks. Only confirmed players for the match need to meet this threshold, not every player in the group.

**Mobile App and Notifications Direction**

FiveMatch should be designed as a mobile app distributed through the Apple App Store and Google Play Store, not only as a hosted web app.

Notifications are important for MVP:

- Invite joined
- Rating reminder
- Match attendance reminder
- Match full / waitlist update
- Teams generated
- Teams locked
- Score submitted
- MVP voting open
- Opponent rating reminder
- Card ready
- Match poster ready

Push notifications should support the weekly match loop and reduce dependence on manual WhatsApp reminders, while social sharing still uses WhatsApp/Instagram for viral distribution.

## Structured Product Spec Draft

### Product Positioning

FiveMatch is a mobile-first football group app for amateur players. It helps private groups organize matches, rate players, generate fair teams, track history, update rankings, and create shareable Panini-style football content.

The product should feel like FIFA Ultimate Team, Strava, Sunday League football, WhatsApp group organization, and fantasy sports gamification combined.

### MVP Product Goal

The MVP must prove that a private football group can organize a match, generate trusted balanced teams, record the result, update player rankings, and share a fun official recap.

The core loop is:

Players join a group -> players rate each other -> match is created -> players confirm attendance -> teams are generated -> match is played -> stats, ratings, and MVP votes are recorded -> rankings update -> cards and results become shareable.

### MVP Scope

- Native mobile app for Apple App Store and Google Play Store.
- User authentication with Google, Apple, and email/password.
- Create and join private groups.
- Invite players to groups.
- Group settings for language, play style, intensity, goalkeeper mode, and default generator style.
- Player profile with identity, football identity, and vestiaire personality fields.
- Initial peer rating flow.
- Match creation with custom team size support.
- Attendance with first-come confirmed spots and waitlist.
- Team generation with fairness percentage.
- Regeneration before confirmation.
- One limited manual adjustment flow before confirmation.
- Locked teams once organizer confirms.
- Organizer/admin score, goals, and assists entry.
- MVP voting.
- Quick post-match opponent rating, skippable but not recommended.
- Player stats and period-based leaderboards.
- Live Panini-style player card.
- MVP card.
- Match result poster.
- Push notifications for the match loop.
- WhatsApp, Instagram, and PNG sharing.

### Deferred Scope

- Public leagues.
- City rankings.
- Group-vs-group tournaments.
- Multi-team rotation modes.
- Pronostics as a full fantasy feature.
- Full social feed with comments and reactions.
- Player-submitted stats with organizer validation.
- Historical collectible card snapshots.
- Advanced card rarity economy.
- Subscriptions.
- Venue integrations.

### Group Model

A group is the private football community. A group can contain many players, such as 10-40 members. Each match uses only the players who confirm attendance for that specific match.

MVP team generation creates two teams from confirmed players. Future versions can support group-vs-group tournaments and broader league structures.

Group settings:

- Group name.
- Default language: French or English.
- Play style: fixed, flexible, rotating, hybrid.
- Intensity: casual, balanced, competitive.
- Goalkeeper mode: fixed goalkeeper, rotating goalkeeper, no goalkeeper.
- Default generator style: Fair + Fresh, Maximum Fairness, More Variety.

### Match Model

Match settings:

- Title.
- Date and time.
- Location.
- Format presets: 5v5, 6v6, 7v7.
- Custom format support.
- Max players calculated from players per team.
- Attendance deadline.
- Organizer.
- Status: open, full, teams generated, teams locked, completed, cancelled.
- Optional generator style override.
- Optional goalkeeper mode override.

Attendance rule:

If more players confirm than the match allows, MVP uses first-come, first-served. Extra players go to a waitlist. If someone cancels before teams are locked, the first waitlisted player moves in.

### Rating System

FiveMatch uses a 0-100 rating system everywhere.

Players rate other players once to create the initial baseline. After that, the algorithm evolves ratings using match ratings, MVP votes, tags, stats, form, and history.

Initial simplified rating groups:

- Overall.
- Speed.
- Attack.
- Technique.
- Defense.
- Physical.
- Stamina.
- Fun.

Goalkeeper simplified rating groups:

- Overall.
- Reflexes.
- Positioning.
- Handling.
- Distribution.
- Communication.
- Physical.
- Fun.

Fun affects identity, cards, achievements, and vestiaire flavor. It should have little or no effect on competitive team balance.

Team generation is blocked until every confirmed match player has at least 3 initial peer ratings.

### Rating Evolution

Ratings can go up or down. FiveMatch should be truthful about player level.

OVR represents long-term level and should move slowly. Form represents recent performance and can move faster.

Example match impact formula:

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

### Team Algorithm

The team generator is the key feature of the app.

Inputs:

- Confirmed players for the match.
- Player OVR and attributes.
- Player form.
- Player stats.
- Group play style.
- Match format.
- Goalkeeper mode.
- Generator style.
- Previous teammate pairing history.

Candidate score:

`candidate_score = rating_gap_penalty + attribute_gap_penalty + goalkeeper_penalty + position_style_penalty + form_penalty + repetition_penalty + generator_style_penalty`

The lowest candidate score wins. Fairness percentage is derived from the normalized candidate score.

Visible output:

- Team A.
- Team B.
- Team totals.
- Fairness percentage.
- Simple explanation.
- Expandable details.

Simple explanation examples:

- Team ratings are almost equal.
- Speed and physicality are balanced.
- Repeated teammate pairs were avoided.
- Goalkeepers are balanced.

Expandable details:

- Rating gap.
- Attack gap.
- Defense gap.
- Speed gap.
- Physical gap.
- Stamina gap.
- Goalkeeper gap.
- Form gap.
- Repetition penalty.

### Team Generation Rules

- Generate teams only from confirmed match players.
- Apply waitlist before generation.
- Save each generated version.
- Allow regeneration before confirmation.
- Allow one limited manual adjustment flow before confirmation.
- Recalculate fairness after manual adjustment.
- Lock teams once confirmed.
- Locked teams become the source of truth for score, stats, ratings, MVP votes, cards, and match history.

### Leaderboards And Stats

Leaderboards:

- Overall.
- Goals.
- Assists.
- MVPs.
- Form.
- Win rate.
- Attendance.

Periods:

- All-time.
- This month.
- Last 5 matches.
- Season.

Player stats:

- Matches played.
- Wins.
- Losses.
- Draws.
- Win rate.
- Goals.
- Assists.
- MVPs.
- Average match rating.
- Current form.
- Attendance percentage.
- Best card.
- Recent matches.

### Cards And Sharing

MVP share assets:

- Live player card.
- MVP card.
- Match result poster.

Player cards are live in MVP. They reflect the current player OVR, attributes, stats, form, identity, and group.

Card visual direction:

- Panini-style football sticker energy.
- Uploaded player photo.
- Prompt-based transformation.
- Controlled football styling.
- FiveMatch branding.
- French and English localization.

Card image generation:

- User uploads a photo.
- User chooses and validates style.
- User gets one generated image attempt.
- The generated portrait/card art should support options such as retro France-inspired jersey, historical football-inspired jersey, different hairstyle, classic sticker look, or era-based football theme.
- Text, OVR, attributes, QR code, and branding should be rendered by the app after image generation so the final card stays readable.

All group members can generate and share available images.

### Mobile UX Architecture

Recommended MVP bottom navigation:

- Accueil.
- Joueurs.
- Match.
- Vestiaire.
- Profil.

Accueil:

Group pulse screen with current group, next match, attendance status, organizer CTA, last result, top ranking highlights, and latest share recap.

Joueurs:

Roster and rating screen with search, player list, rating progress, rating CTA, player cards, share card action, and player detail entry.

Match:

Match operations screen with next match details, attendance list, waitlist, team generation, confirmed locked teams, result entry, and previous match summary.

Vestiaire:

Fun/social layer with group votes, MVP shortcuts, banter awards, achievements, locker-room titles, and playful identity prompts.

Profil:

Personal identity and settings with photo, name, nickname, football identity, Panini card setup, groups, language, stats summary, and logout.

### Notifications

Push notifications are part of the MVP engagement loop.

Notification events:

- Invite joined.
- Rating reminder.
- Match attendance reminder.
- Match full / waitlist update.
- Spot opened from waitlist.
- Teams generated.
- Teams locked.
- Score submitted.
- MVP voting open.
- Opponent rating reminder.
- Card ready.
- Match poster ready.

Product split:

Push notifications handle operational reminders. WhatsApp and Instagram handle viral sharing.

### Technical Direction

Recommended stack:

- Mobile app: React Native + Expo.
- Backend: Node.js, Next.js API, or standalone Node API.
- Database: PostgreSQL.
- Auth: Google, Apple, email/password.
- Push: Expo Notifications for MVP.
- Image generation: server-side pipeline.
- Sharing: native share sheet plus PNG exports.

Core API domains:

- `groups`.
- `players`.
- `ratings`.
- `matches`.
- `attendance`.
- `teamGenerator`.
- `matchResults`.
- `leaderboards`.
- `cards`.
- `imageGeneration`.
- `shareAssets`.

Recommended tables:

- `users`.
- `groups`.
- `group_settings`.
- `group_members`.
- `invitations`.
- `players`.
- `player_attributes`.
- `initial_peer_ratings`.
- `post_match_ratings`.
- `rating_history`.
- `matches`.
- `match_attendance`.
- `team_generation_versions`.
- `team_generation_players`.
- `match_events`.
- `mvp_votes`.
- `player_statistics`.
- `achievements`.
- `player_achievements`.
- `player_cards`.
- `share_assets`.
- `image_generations`.
- `push_tokens`.
- `notifications`.

### Product Principles

- Keep the social UX simple.
- Make the football algorithm deep and trustworthy.
- Let every group feel configurable without exposing scary math.
- Make the app fun before and after the match.
- Make post-match sharing voluntary and personal.
- Keep rankings truthful, including rating decreases.
- Treat cards as identity and sharing, not the whole product.
- Build for private groups first, but keep the architecture open for tournaments later.

### MVP Build Phases

Phase 1: Foundation

- Mobile app shell.
- Authentication.
- User profile.
- Group creation.
- Group invite and join flow.
- Group settings.
- Bottom navigation.
- Basic bilingual support for French and English.

Phase 2: Players And Ratings

- Player profile setup.
- Football identity fields.
- Vestiaire personality fields.
- Player roster.
- Initial peer rating flow.
- Rating progress tracking.
- OVR and attribute baseline calculation.
- Team generation unlock rule based on baseline rating coverage.

Phase 3: Match Organization

- Match creation.
- Custom match sizes.
- Attendance: In / Out / Maybe.
- First-come confirmed list.
- Waitlist.
- Attendance notifications.
- Match detail screen.

Phase 4: Team Generator

- Balance profile calculation.
- Candidate team split generation.
- Fairness percentage.
- Simple explanation.
- Expandable details.
- Regeneration.
- One limited manual adjustment flow.
- Confirm and lock teams.
- Team generation version history.

Phase 5: Match Results

- Score entry.
- Goal and assist entry.
- MVP voting.
- Quick opponent rating.
- Skippable post-match ratings.
- Rating evolution.
- Stats update.
- Match history.

Phase 6: Rankings And Cards

- Period-based leaderboards.
- Player statistics.
- Live Panini card unlock after OVR.
- Player card generation flow.
- MVP card.
- Match result poster.
- Share/export to WhatsApp, Instagram, and PNG.

Phase 7: Notifications And Polish

- Push notification preferences.
- Rating reminders.
- Match reminders.
- Waitlist updates.
- Teams generated/locked notifications.
- Post-match reminders.
- Card/poster ready notifications.
- App Store and Google Play readiness.

### Future Roadmap

V1.1:

- Pronostics as a lightweight prediction game.
- Ranking snapshot share images.
- Achievement unlock images.
- More card styles.
- Better rating insights.
- Organizer analytics.

V1.5:

- Seasons.
- Historical collectible card snapshots.
- Inform cards.
- Achievement system expansion.
- More algorithm modes such as Rivalry Night, Development Mode, and Chaos Mode.
- Player-submitted stats with organizer validation.

V2:

- Group-vs-group matches.
- City leagues.
- Tournament mode.
- Public rankings.
- Push notification automation improvements.
- Subscription model.
- Venue integrations.
- Native AI match predictions.

### Key Product Risks

Algorithm trust risk:

If teams feel unfair, users will not trust the product. The MVP must prioritize strong baseline ratings, transparent fairness percentage, and understandable explanations.

Rating fatigue risk:

If players must rate too much, they will stop. Initial peer rating should be structured but fast. Post-match ratings should be very short.

Over-gamification risk:

Cards, vestiaire, and social features should support the match loop, not replace it. The core product remains organizing and improving real football matches.

Image generation complexity risk:

Prompt-based Panini card generation is important, but it introduces cost, moderation, consistency, and user expectation risks. The app should keep the final card text and stats rendered outside the AI image.

Mobile store readiness risk:

Because the goal is App Store and Google Play distribution, the product needs account deletion, privacy policy, notification permissions, image moderation, terms, and safe sharing controls.

### Open Decisions

- Exact minimum group size for creating a first match.
- Whether `Maybe` counts toward notifications only or affects waitlist priority.
- Whether baseline ratings are anonymous or visible.
- Whether players can edit initial peer ratings before the first match.
- Exact OVR formula by position/style.
- Exact goalkeeper normalization formula.
- Whether card image generation is free for every user or limited by group/app policy.
- Whether `Pronos` is hidden for MVP or included as a simple later tab.
- Whether seasons are visible in MVP or only prepared in the data model.
- Maximum number of team regenerations before confirmation.
- What happens if a player cancels after teams are locked.
- Whether magic link auth is part of MVP or deferred.

### Brainstorm Coverage Audit

Overall, the brainstorm is coherent and covers the major FiveMatch product areas: private groups, player ratings, match attendance, team generation, locked teams, match history, stats, leaderboards, Panini-style cards, social sharing, mobile distribution, notifications, data model, APIs, build phases, risks, and roadmap.

Strongly covered:

- Core user flow from group join to post-match sharing.
- Team generation as the key differentiator.
- 0-100 ratings and FIFA-like attributes.
- One-time peer baseline ratings, then algorithm-led evolution.
- Group play styles and goalkeeper modes.
- Attendance, first-come confirmed list, and waitlist.
- Fairness percentage and explainable algorithm output.
- Locked teams after confirmation.
- Panini-style live cards and prompt-based card image generation.
- French and English localization.
- Native mobile app direction with push notifications.
- MVP versus future roadmap.

Needs more detail in the PRD:

- Exact OVR formulas by play style and position.
- Exact goalkeeper normalization.
- Exact fairness percentage normalization.
- Rating anonymity and edit rules.
- Post-lock cancellation handling.
- MVP vote eligibility rules.
- Achievement definitions.
- Share asset templates and export sizes.
- Push notification permission and preference flows.
- Image generation safety, moderation, and retry/error handling.
- App Store and Google Play compliance details.

Minor corrections made during audit:

- Product positioning now says native mobile app instead of web app.
- Recommended tables now include invitations, rating history, achievements, share assets, push tokens, and notifications.

### Recommended Immediate Next Step

Turn this brainstorm into a PRD with:

- Product overview.
- User personas.
- MVP scope.
- User stories.
- Functional requirements.
- Non-functional requirements.
- Data model.
- API contracts.
- Algorithm specification.
- Mobile screen requirements.
- Acceptance criteria.
