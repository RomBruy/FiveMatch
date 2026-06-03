---
name: FiveMatch Experience
description: UX contract for the FiveMatch MVP mobile app.
status: draft
created: 2026-05-31
updated: 2026-05-31
sources:
  - ../prds/prd-fit_five-2026-05-31/prd.md
  - ../prds/prd-fit_five-2026-05-31/addendum.md
visual_identity: DESIGN.md
---

# EXPERIENCE: FiveMatch

## Foundation

FiveMatch is a native mobile app for private amateur football groups. The UX must make three things feel effortless: saying whether you are playing, trusting generated teams, and sharing the official story after the match.

Visual identity is governed by `DESIGN.md`. Behavioral specs reference visual tokens using `{path.to.token}`.

Primary form factor is iOS and Android phone. MVP assumes portrait orientation. Tablet-specific layouts are out of scope.

The user experience should prioritize the weekly match loop:

1. Join group.
2. Complete profile.
3. Rate players.
4. Confirm attendance.
5. Generate and lock teams.
6. Record result.
7. Vote/rate.
8. Share recap/card.

## Visual Mockups

The first UX mockups cover the highest-risk and highest-value MVP moments:

- [Mockup gallery](mockups/index.html)
- [Accueil + Match state](mockups/key-accueil-match.html)
- [Team Generator](mockups/key-team-generator.html)
- [Initial Rating Flow](mockups/key-rating-flow.html)
- [Card + Share Flow](mockups/key-card-share.html)

These are offline HTML references, not implementation code. They exist to align IA, visual language, component hierarchy, and interaction priority before native implementation.

## Information Architecture

Bottom navigation has five tabs:

- **Accueil** - group pulse and next action.
- **Joueurs** - roster, rating progress, player cards.
- **Match** - attendance, waitlist, team generation, locked teams, result operations.
- **Vestiaire** - fun/social identity, votes, banter, achievements.
- **Profil** - personal profile, card setup, settings, groups.

### Accueil

Purpose: answer "what matters right now?"

Priority order:

1. Current group identity.
2. Next match status.
3. User attendance state.
4. Team-generation readiness or locked teams.
5. Latest result.
6. Top ranking highlights.
7. Share latest recap/card.

### Joueurs

Purpose: manage the social roster and rating work.

Priority order:

1. Rating CTA if team generation is blocked.
2. Search.
3. Active player list.
4. Rating counts/progress.
5. Player card/share action.
6. Player detail.

### Match

Purpose: operate the next or current match.

Priority order:

1. Match card and attendance actions.
2. Confirmed player count and waitlist.
3. Team generation / locked teams.
4. Result entry when match is played.
5. Latest match summary.

### Vestiaire

Purpose: make the group feel alive without distracting from operations.

MVP content:

- MVP voting shortcut when open.
- Fun awards and achievements.
- Player personality prompts.
- Group-only banter widgets.

Vestiaire must not block the match loop.

### Profil

Purpose: personal identity and settings.

Priority order:

1. Profile summary and stats.
2. Groups.
3. Edit profile.
4. Football identity.
5. Vestiaire personality.
6. Live Panini card setup/unlock.
7. Language and notification preferences.
8. Logout/account controls.

## Voice And Tone

Tone: direct, football-aware, playful but never confusing.

Operational copy should be short:

- "In"
- "Out"
- "Waitlist #2"
- "Teams locked"
- "Needs 1 more rating"

Algorithm copy should build trust:

- "Fairness: 96%"
- "Ratings are almost equal."
- "Repeated teammate pairs were avoided."
- "Goalkeepers are balanced."

Rating copy should motivate without guilt:

- "Your rating helps the next match feel fair."
- "Skip for now"
- "The algorithm works better with fresh ratings."

French and English should feel native. Do not translate funny labels mechanically when flavor matters.

## Component Patterns

### CP-1: Match Card

Use on Accueil and Match.

Contains:

- Match title.
- Date/time.
- Location.
- Attendance status badge.
- Confirmed count.
- Waitlist count.
- In / Out / Maybe actions.

States:

- Open.
- Full with waitlist.
- Teams generated.
- Teams locked.
- Completed.
- Cancelled.

### CP-2: Player Row

Use in Joueurs, rating progress, attendance lists, team lists, and MVP vote lists.

Contains:

- Avatar.
- Nickname or display name.
- Secondary name/status.
- Contextual trailing action.

Variants:

- Active roster row.
- Confirmed attendance row.
- Waitlist row.
- Needs rating row.
- Team assignment row.

### CP-3: Rating Task Card

Use for initial peer ratings.

Each card focuses on one rated player and uses 0-100 controls for:

- Overall.
- Speed.
- Attack.
- Technique.
- Defense.
- Physical.
- Stamina.
- Fun.

Controls must be large and fast. Preset labels may map to numeric values, but the stored value remains 0-100.

### CP-4: Team Generation Panel

Contains:

- Team A list.
- Team B list.
- Team totals.
- Fairness percentage.
- Simple explanation.
- Expandable details.
- Regenerate action.
- Manual adjustment entry.
- Confirm teams action.

Confirm action must be visually stronger than regenerate once the organizer is happy with a version.

### CP-5: Locked Teams Panel

Contains:

- Locked state label.
- Team A and Team B.
- Fairness percentage from confirmed version.
- Result-entry CTA for organizer/admin.

Locked teams should feel official.

### CP-6: Post-Match Action Stack

After score submission, show action cards:

- Vote MVP.
- Rate opponents.
- View summary.
- Share recap.

Players can skip opponent ratings, but the app should keep a low-friction reminder.

### CP-7: Share Asset Picker

Shows available assets:

- Match result poster.
- MVP card.
- Live player card.

Each option has thumbnail, language selector if needed, and export action.

## State Patterns

### SP-1: Rating Blocked Team Generation

When generation is blocked:

- Show "Teams need ratings first."
- Show missing players and needed count.
- Provide "Rate players" and "Remind group."
- Do not show a disabled generate button without explanation.

### SP-2: Waitlist

When match is full:

- Show confirmed count as full.
- Show waitlist count.
- Show each waitlisted player's position.
- If a spot opens, notify the first waitlisted player moved in.

### SP-3: Generated But Not Locked

When teams are generated:

- Show generated version number.
- Show fairness percentage.
- Allow regenerate.
- Allow one manual adjustment flow.
- Allow confirm.

### SP-4: Locked

When teams lock:

- Remove casual editing.
- Show "Teams locked."
- Use locked teams for MVP voting, opponent ratings, score, stats, and recap.

### SP-5: Voided Match

When a match is voided:

- Mark in-app recap as voided.
- Exclude from leaderboards and rating evolution.
- Preserve in match history.
- Do not attempt to retract externally shared images.

### SP-6: Card Locked

Before player has OVR:

- Show card locked.
- Explain "Get rated to reveal your official FiveMatch card."
- Link to rating progress.

### SP-7: Card Generation Attempt Used

After one successful generation:

- Show saved generated image.
- Allow share/export.
- Do not offer aesthetic retry in MVP.

## Interaction Primitives

### Attendance

Attendance actions should be one tap with clear active state. In and Out are primary choices. Maybe is secondary.

### Team Generation

The generator flow:

1. Organizer taps Generate.
2. Loading state explains balancing.
3. Generated version appears with fairness.
4. Organizer can expand details.
5. Organizer can regenerate up to 5 versions.
6. Organizer can use one manual adjustment flow.
7. Organizer confirms teams.
8. Teams lock.

### Manual Adjustment

Manual adjustment is an escape hatch.

Rules:

- Secondary placement under "More options."
- Warn that fairness will recalculate.
- Mark version as manually adjusted.
- Do not encourage manual edit as default.

### Rating

Initial rating should feel like a quick roster task, not a survey.

Post-match rating should feel even shorter:

1. Choose opponent.
2. Set performance rating.
3. Optional tags.
4. Next.

### Sharing

Sharing is voluntary and personal.

All group members can generate available share assets. Export uses native share sheet plus PNG.

### Notifications

Notification permission should be requested after the user has joined a group or created their first match, not on first app launch.

## Accessibility Floor

- Every icon-only action must have an accessible label.
- Critical statuses use text plus color, never color alone.
- In / Out / Maybe buttons have touch targets suitable for mobile use.
- Rating controls must be operable without precise dragging; provide tap presets or step controls.
- Fairness percentage and team totals must be readable by screen readers.
- Share asset thumbnails must have text alternatives.
- Error and blocked states must explain the next available action.

## Key Flows

### KF-1: Create Group And Invite

Persona: Roro, organizer of a weekly 5v5 group.

Steps:

1. Opens app and signs in.
2. Creates group.
3. Sets language, play style, intensity, goalkeeper mode, and generator style.
4. Shares invite link.
5. Sees group dashboard with empty roster and rating prompt.

Climax: Roro sees the group ready to invite and configure, not a blank app.

### KF-2: Join Group And Unlock Player Card

Persona: Alex, invited player.

Steps:

1. Opens invite.
2. Authenticates.
3. Completes profile and football identity.
4. Adds Vestiaire personality fields.
5. Waits for ratings and rates other players.
6. Unlocks OVR.
7. Generates live Panini card.

Climax: Alex sees an official FiveMatch card with their current OVR.

### KF-3: Confirm Attendance And Waitlist

Persona: Mehdi, group regular.

Steps:

1. Opens notification for next match.
2. Taps In.
3. If match has room, sees confirmed state.
4. If full, sees waitlist position.
5. If spot opens, receives notification.

Climax: Mehdi knows instantly whether he is playing.

### KF-4: Generate And Lock Teams

Persona: Roro, match organizer.

Steps:

1. Opens Match tab.
2. Sees 10/10 confirmed and rating threshold complete.
3. Taps Generate.
4. Reviews teams, fairness percentage, and explanation.
5. Optionally regenerates.
6. Confirms teams.
7. Teams lock.

Climax: The group receives an official fair split that feels hard to argue with.

### KF-5: Complete Post-Match Loop

Persona: Ced, confirmed player.

Steps:

1. Organizer enters score, goals, and assists.
2. Ced receives MVP vote prompt.
3. Ced votes MVP.
4. Ced rates opponents or skips.
5. Ced sees updated rankings and recap.

Climax: Ced sees the match count toward the group's living history.

### KF-6: Share Match Identity

Persona: Chichi, player who likes the banter.

Steps:

1. Opens Match Summary.
2. Chooses Match Poster or My Player Card.
3. Selects export language.
4. Shares through WhatsApp or Instagram.

Climax: Chichi posts an official-looking football artifact that brings people back into the app.

## Screen Requirements

### SR-1: Accueil

Must show next match state, user attendance state, latest result, and top ranking highlights.

Primary action depends on state:

- No group: create/join group.
- No match: create match for organizer/admin.
- Match open: In / Out / Maybe.
- Ratings missing: rate players.
- Teams ready: generate teams for organizer/admin.
- Teams locked: view teams.
- Match completed: share recap.

### SR-2: Joueurs

Must support search, rating progress, player list, player detail, and card/share entry.

Blocked-generation missing ratings should be actionable here.

### SR-3: Match

Must support attendance, waitlist, team generation, locked teams, result entry, and latest result.

This is the highest-complexity screen and should receive a visual mock before implementation.

### SR-4: Vestiaire

Must stay light in MVP.

Allowed MVP modules:

- MVP vote shortcut.
- Achievements.
- Fun awards.
- Personality prompts.

Avoid full feed behavior in MVP.

### SR-5: Profil

Must support profile edit, football identity, Vestiaire personality, card unlock/generation, group list, language, notification preferences, and account controls.

### SR-6: Initial Rating Flow

Must show progress, one player at a time, fast numeric input, and clear save/next action.

### SR-7: Team Generator Detail

Must show:

- Version number.
- Team A.
- Team B.
- Fairness percentage.
- Simple explanation.
- Expandable details.
- Regenerate count.
- Manual adjustment state.
- Confirm teams.

### SR-8: Match Summary

Must show:

- Final score.
- Teams.
- MVP.
- Goals and assists.
- Rating/ranking movement.
- Share assets.

### SR-9: Card Generation

Must show:

- Uploaded photo.
- Style choices.
- Prompt preview.
- Validation before generation.
- One-attempt policy.
- Generated card preview.
- Share/export.

## Inspiration And Anti-Patterns

Use the reference app screenshots as inspiration for:

- Dark football-first mobile aesthetic.
- Bottom navigation.
- Attendance card.
- Confirmed/waitlist lists.
- Rating progress.
- Profile personality fields.
- Last result card.

Avoid:

- Hiding ratings behind too many taps.
- Making Pronostics equal to core match operations in MVP.
- Turning every panel into a decorative card.
- Letting the profile page dominate the weekly match loop.

## Responsive And Platform

MVP targets iOS and Android phones.

Use native safe areas for status bar, bottom tab bar, and gesture areas.

Primary actions should remain reachable on small phones.

Large rosters should use virtualized lists in implementation; UX should assume 10-40 players.
