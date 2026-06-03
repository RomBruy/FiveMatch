---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md
  - _bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/index.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-accueil-match.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-team-generator.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-rating-flow.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-card-share.html
workflowType: epics-and-stories
project_name: fit_five
user_name: Roro
date: 2026-05-31
status: complete
completedAt: 2026-05-31
---

# fit_five - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for `fit_five`, decomposing the requirements from the PRD, UX design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can sign in using Google, Apple, or email/password in a native mobile app.

FR2: Users can manage basic account details and personal app language, with French and English support.

FR3: Authenticated users can create a group with name, default language, play style, intensity, goalkeeper mode, and default generator style.

FR4: Group owners/admins can create invite links, and authenticated users can join through valid invite links.

FR5: Owners/admins can update group settings and manage membership, with future matches affected by new settings while locked history is preserved.

FR6: Players can complete identity fields including first name, last name, nickname, photo, language, bio/devise, and group association.

FR7: Players can complete football profile fields including preferred position/style, dominant foot, jersey number, club de formation, and play style.

FR8: Players can complete Vestiaire personality fields for humor, identity, cards, and social content without affecting competitive balance.

FR9: Players can submit one-time initial peer ratings for other players in the same group using 0-100 attribute groups, with self-ratings and duplicates prevented.

FR10: The app shows rating progress for the group and current user, including who needs ratings to unlock generation.

FR11: Team generation is blocked until every confirmed match player has at least 3 initial peer ratings, with a clear path to rate/remind.

FR12: Owners/admins can create matches with title, date/time, location, team size, attendance deadline, optional generator style override, and optional goalkeeper mode override.

FR13: Players can respond In, Out, or Maybe to an open match; In players are confirmed until capacity, then waitlisted.

FR14: The app maintains an ordered waitlist, promotes the first waitlisted player when a confirmed spot opens before teams lock, and shows waitlist position.

FR15: Owners/admins can generate saved team versions from confirmed players after baseline rating threshold is met.

FR16: Owners/admins can regenerate teams before confirmation, saving each version and limiting MVP regeneration to 5 versions.

FR17: Owners/admins can use one limited manual adjustment before team confirmation; fairness recalculates and version is marked manually adjusted.

FR18: Owners/admins can confirm and lock a team generation version; locked teams become the source of truth for result, stats, MVP votes, ratings, cards, and history.

FR19: Owners/admins can submit final score for locked teams, edit result data until finalization, and void finalized matches when needed.

FR20: Owners/admins can enter goals and assists by player, updating player statistics.

FR21: Confirmed match players can vote once for MVP, cannot vote for themselves, and can vote only from locked team participants.

FR22: Confirmed match players can quickly rate opponents after the match using a performance rating and optional tags, with skip allowed.

FR23: The system updates OVR, form, and attributes using post-match ratings, MVP votes, tags, stats, and team result; ratings can go up or down.

FR24: The system protects ratings from abuse by blocking self/duplicate ratings and reducing impact of suspicious or extreme behavior.

FR25: Group members can view leaderboards by Overall, Goals, Assists, MVPs, Form, Win Rate, and Attendance across supported periods.

FR26: Players can view group-specific statistics including matches, wins/losses/draws, win rate, goals, assists, MVPs, average match rating, form, attendance, best card, and recent matches.

FR27: Players can unlock and generate a live Panini-style player card after receiving an OVR.

FR28: Players can upload a photo, choose and validate a style prompt, and receive one successful generated Panini-style card image attempt, with app-rendered text/stats/branding.

FR29: All group members can generate available MVP cards and match result posters after match completion and export them through WhatsApp, Instagram, native share sheet, and PNG.

FR30: The app sends operational push notifications for rating reminders, match reminders, waitlist updates, teams generated/locked, score submitted, MVP voting, opponent rating reminder, card ready, and poster ready.

### NonFunctional Requirements

NFR1: Team generation should return a generated version within 3 seconds for normal MVP match sizes up to 22 confirmed players under typical backend conditions.

NFR2: Rating, attendance, team confirmation, MVP voting, and result submissions must be idempotent where duplicate taps or retries could occur.

NFR3: The app must support privacy policy requirements for App Store and Google Play distribution, including account deletion and safe handling/reporting of user-generated content.

NFR4: Uploaded photos and card prompts must pass automated safety checks before image generation, and generated outputs can be reported.

NFR5: All user-facing product text, push notification text, card text, and share asset text must support French and English.

NFR6: Push notifications must follow mobile platform permission rules and provide user controls/preferences.

NFR7: Core mobile flows must meet basic accessibility expectations, including screen-reader labels, touch targets, and status communication beyond color alone.

### Additional Requirements

AR1: Initialize a pnpm + Turborepo TypeScript monorepo with `apps/mobile`, `apps/api`, `packages/shared`, `packages/algorithm`, and `packages/config`.

AR2: Implement the native app with Expo React Native and Expo Router.

AR3: Implement the backend as a NestJS modular API.

AR4: Use PostgreSQL as the system of record with Prisma ORM and Prisma migrations.

AR5: Use backend-owned domain rules for team generation, ratings, locked teams, match finalization, voiding, and share asset policy.

AR6: Use REST API endpoints under `/api/v1` with OpenAPI as the app/API contract.

AR7: Use managed native-friendly authentication, with Clerk recommended for Expo MVP, while FiveMatch API owns internal authorization.

AR8: Use TanStack Query for mobile server state and small Zustand stores only for local UI/session state.

AR9: Keep team generation and rating calculations in a pure `packages/algorithm` package with tests and simulation fixtures.

AR10: Use idempotency keys, database uniqueness constraints, and standard error formats for retry-prone mutations.

AR11: Use BullMQ + Redis for async jobs including notifications, image generation, share assets, and rating evolution.

AR12: Use Expo Notifications for MVP push delivery and store push tokens/preferences server-side.

AR13: Use object storage with signed URLs for uploaded photos, generated portraits, and share assets.

AR14: Implement image generation as a server-side state machine with moderation, queued generation, technical failure handling, trusted text overlays, and reporting.

AR15: Use shared localization dictionaries for app strings, notification templates, algorithm explanations, funny card names, and share asset copy.

AR16: Store algorithm snapshots for every generated team version, including input player data, settings, score components, fairness, explanation data, and seed.

AR17: Add CI gates for typecheck, lint, algorithm tests, API integration tests, Prisma validation, OpenAPI generation, and mobile build sanity.

AR18: Deploy as native mobile app plus API process plus worker process, with managed PostgreSQL, managed Redis, and object storage.

### UX Design Requirements

UX-DR1: Implement a five-tab native bottom navigation: Accueil, Joueurs, Match, Vestiaire, Profil.

UX-DR2: Implement native design tokens from `DESIGN.md`, including dark matchday surfaces, turf green actions, whistle yellow prompts, kit red danger/out states, card gold identity moments, Sora display typography, and DM Sans body typography.

UX-DR3: Implement Match Card component with title, date/time, location, status badge, confirmed count, waitlist count, and In/Out/Maybe actions across open, full, generated, locked, completed, and cancelled states.

UX-DR4: Implement Player Row component variants for active roster, confirmed attendance, waitlist, needs rating, and team assignment.

UX-DR5: Implement Rating Task Card with one rated player at a time, 0-100 controls for Overall, Speed, Attack, Technique, Defense, Physical, Stamina, and Fun, plus goalkeeper attribute variant.

UX-DR6: Implement Team Generation Panel with Team A, Team B, team totals, fairness percentage, simple explanation, expandable details, regenerate action, manual adjustment entry, and confirm teams action.

UX-DR7: Implement Locked Teams Panel with locked state label, Team A/B, fairness percentage, and result-entry CTA for organizer/admin.

UX-DR8: Implement Post-Match Action Stack with Vote MVP, Rate Opponents, View Summary, and Share Recap.

UX-DR9: Implement Share Asset Picker with Match Result Poster, MVP Card, Live Player Card, thumbnail previews, export language selector if needed, and export action.

UX-DR10: Implement blocked team generation UX explaining missing ratings, showing missing players/needed count, and offering Rate Players and Remind Group actions.

UX-DR11: Implement waitlist UX showing full confirmed count, waitlist count, each waitlisted player's position, and moved-in notification behavior.

UX-DR12: Implement generated-but-not-locked UX showing version number, fairness percentage, regenerate, one manual adjustment, and confirm.

UX-DR13: Implement locked, voided match, card locked, and card generation attempt used states exactly as defined in the UX state patterns.

UX-DR14: Implement one-tap attendance actions with clear active state, In/Out as primary options, and Maybe as secondary.

UX-DR15: Implement team generator interaction flow from Generate through loading, generated version, expandable details, up to 5 regenerations, one manual adjustment, confirmation, and locked state.

UX-DR16: Implement manual adjustment as a secondary escape hatch that recalculates fairness and marks the version as manually adjusted.

UX-DR17: Implement initial rating as quick roster task and post-match rating as shorter opponent-focused flow with optional tags and skip reminder.

UX-DR18: Implement voluntary sharing through native share sheet and PNG export, available to all group members for eligible assets.

UX-DR19: Request notification permission after the user has joined a group or created their first match, not on first app launch.

UX-DR20: Implement accessibility floor: labels for icon-only actions, status text plus color, mobile-sized touch targets, non-drag-only rating controls, readable fairness/team totals, thumbnail alternatives, and actionable blocked/error states.

UX-DR21: Support key flows for Create Group and Invite, Join Group and Unlock Card, Confirm Attendance and Waitlist, Generate and Lock Teams, Complete Post-Match Loop, and Share Match Identity.

UX-DR22: Implement screen requirements for Accueil, Joueurs, Match, Vestiaire, Profil, Initial Rating Flow, Team Generator Detail, Match Summary, and Card Generation.

UX-DR23: Use the offline mockups as first visual references for Accueil/Match state, Team Generator, Initial Rating Flow, and Card/Share Flow.

### FR Coverage Map

FR1: Epic 1 - Native access and authentication.

FR2: Epic 1 - Account and language preferences.

FR3: Epic 1 - Group creation and default settings.

FR4: Epic 1 - Invite links and group joining.

FR5: Epic 1 - Group roles, settings, and membership management.

FR6: Epic 1 - Player identity profile.

FR7: Epic 1 - Football profile.

FR8: Epic 1 - Vestiaire personality profile.

FR9: Epic 2 - One-time initial peer ratings.

FR10: Epic 2 - Rating progress and readiness visibility.

FR11: Epic 2 - Baseline threshold block for team generation.

FR12: Epic 3 - Match creation.

FR13: Epic 3 - Attendance responses.

FR14: Epic 3 - Waitlist management.

FR15: Epic 4 - Team version generation.

FR16: Epic 4 - Regeneration before confirmation.

FR17: Epic 4 - Limited manual adjustment.

FR18: Epic 4 - Team confirmation and locking.

FR19: Epic 5 - Final score, editing, finalization, and voiding.

FR20: Epic 5 - Goals and assists.

FR21: Epic 5 - MVP voting.

FR22: Epic 5 - Quick opponent ratings.

FR23: Epic 5 - OVR/form/attribute evolution.

FR24: Epic 5 - Rating anti-abuse.

FR25: Epic 6 - Leaderboards.

FR26: Epic 6 - Player statistics.

FR27: Epic 7 - Live player card unlock.

FR28: Epic 7 - Panini-style card image generation.

FR29: Epic 7 - MVP cards, result posters, and share exports.

FR30: Epic 8 - Operational push notifications.

## Epic List

### Epic 1: Native Onboarding, Groups, And Player Identity

Users can install/open the native app, authenticate, create or join a private group, configure group settings, and complete their football/Vestiaire identity so the group becomes usable.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8.

**Primary UX coverage:** KF-1, KF-2, SR-1, SR-2, SR-4, SR-5, UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR20.

**Architecture coverage:** AR1, AR2, AR3, AR4, AR5, AR6, AR7, AR8, AR15, AR17.

### Epic 2: Fast Player Ratings And Team Generation Readiness

Players can rate each other quickly and anonymously enough to establish trusted baseline ratings, while the group can see exactly what is missing before teams can be generated.

**FRs covered:** FR9, FR10, FR11.

**Primary UX coverage:** CP-3, SP-1, SR-2, SR-6, KF-2, UX-DR5, UX-DR10, UX-DR17, UX-DR20, UX-DR23.

**Architecture coverage:** AR4, AR5, AR6, AR9, AR10, AR15, AR16, AR17.

### Epic 3: Match Creation, Attendance, And Waitlist

Organizers can create matches and players can quickly say whether they are In, Out, or Maybe, with first-come confirmed spots and clear waitlist behavior.

**FRs covered:** FR12, FR13, FR14.

**Primary UX coverage:** CP-1, CP-2, SP-2, SR-1, SR-3, KF-3, UX-DR3, UX-DR4, UX-DR11, UX-DR14, UX-DR20, UX-DR23.

**Architecture coverage:** AR4, AR5, AR6, AR8, AR10, AR15, AR17.

### Epic 4: Trusted Smart Team Generator

Organizers can generate, review, explain, regenerate, manually adjust once, and lock fair teams that the group can trust as the official match source of truth.

**FRs covered:** FR15, FR16, FR17, FR18.

**Primary UX coverage:** CP-4, CP-5, SP-3, SP-4, SR-3, SR-7, KF-4, UX-DR6, UX-DR7, UX-DR12, UX-DR15, UX-DR16, UX-DR20, UX-DR23.

**Architecture coverage:** AR5, AR6, AR9, AR10, AR15, AR16, AR17.

### Epic 5: Post-Match Results, MVP, Opponent Ratings, And Rating Evolution

After a played match, organizers can record the official result and players can vote/rate quickly, causing stats, OVR, form, and history to update truthfully.

**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR24.

**Primary UX coverage:** CP-6, SP-5, SR-3, SR-8, KF-5, UX-DR8, UX-DR13, UX-DR17, UX-DR20.

**Architecture coverage:** AR4, AR5, AR6, AR9, AR10, AR11, AR15, AR17.

### Epic 6: Player Statistics, Leaderboards, And Match History

Group members can see rankings, player stats, performance periods, and match history so the group has a living competitive memory.

**FRs covered:** FR25, FR26.

**Primary UX coverage:** SR-1, SR-2, SR-5, SR-8, KF-5, UX-DR20, UX-DR22.

**Architecture coverage:** AR4, AR5, AR6, AR8, AR10, AR15, AR17.

### Epic 7: Live Cards, Image Generation, And Viral Sharing

Players can unlock live Panini-style identity cards, generate one moderated image, and share player cards, MVP cards, and match posters as official-looking FiveMatch assets.

**FRs covered:** FR27, FR28, FR29.

**Primary UX coverage:** CP-7, SP-6, SP-7, SR-5, SR-8, SR-9, KF-2, KF-6, UX-DR9, UX-DR13, UX-DR18, UX-DR20, UX-DR23.

**Architecture coverage:** AR11, AR13, AR14, AR15, AR17, AR18.

### Epic 8: Operational Notifications, Localization, And Store-Ready Quality

Users receive the right operational reminders at the right moment, can control notification/language preferences, and the app meets native release, safety, accessibility, and reliability expectations.

**FRs covered:** FR30.

**Primary UX coverage:** Notifications interaction primitive, UX-DR2, UX-DR19, UX-DR20, UX-DR21, UX-DR22.

**Architecture coverage:** AR7, AR10, AR11, AR12, AR15, AR17, AR18.

## Epic 1: Native Onboarding, Groups, And Player Identity

Users can install/open the native app, authenticate, create or join a private group, configure group settings, and complete their football/Vestiaire identity so the group becomes usable.

### Story 1.1: Initialize Native App And API Workspace

As a product team,
I want the FiveMatch mobile/API monorepo initialized,
So that every future feature has the correct native, backend, shared, and algorithm foundations.

**Acceptance Criteria:**

**Given** the repository is empty of implementation code
**When** the workspace is initialized
**Then** it contains `apps/mobile`, `apps/api`, `packages/shared`, `packages/algorithm`, and `packages/config`
**And** root scripts support typecheck, lint, test, and development commands.

**Given** the mobile and API apps are initialized
**When** a developer runs the local health flow
**Then** the API exposes a health endpoint
**And** the mobile app can call it through the shared API client.

### Story 1.2: Authenticate With Native Sign-In

As a new user,
I want to sign in with Google, Apple, or email/password,
So that I can securely access my football groups.

**Acceptance Criteria:**

**Given** I open the app unauthenticated
**When** I choose Google, Apple, or email/password sign-in
**Then** I can complete authentication through the native app flow
**And** the backend creates or links my internal user record.

**Given** I am authenticated
**When** I reopen the app
**Then** my session is restored
**And** protected screens do not show unauthenticated content.

### Story 1.3: Manage Account Language And Preferences

As a user,
I want to set my account language and basic preferences,
So that the app feels natural in French or English.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I open my profile settings
**Then** I can choose French or English as my app language
**And** the choice persists across app restarts.

**Given** the app language is changed
**When** I view core navigation and settings screens
**Then** user-facing labels use the selected language
**And** missing translations fall back safely.

### Story 1.4: Create A Private Football Group

As an organizer,
I want to create a private group with football settings,
So that my friends can organize matches with the right rules.

**Acceptance Criteria:**

**Given** I am authenticated and have no group selected
**When** I create a group
**Then** I can set name, default language, play style, intensity, goalkeeper mode, and default generator style
**And** I become the group owner.

**Given** the group is created
**When** I open Accueil
**Then** I see the group identity and next recommended action
**And** no empty technical state is shown.

### Story 1.5: Invite And Join Group

As a group owner or admin,
I want to share invite links,
So that players can join the private group easily.

**Acceptance Criteria:**

**Given** I am a group owner or admin
**When** I create an invite link
**Then** the link can be shared outside the app
**And** the backend records the invitation state.

**Given** an invited user opens a valid invite link
**When** they authenticate and accept the invite
**Then** they become a group member
**And** they are prompted to create their player profile.

### Story 1.6: Manage Group Roles And Settings

As a group owner,
I want to manage members, roles, and group settings,
So that the group can adapt without breaking match history.

**Acceptance Criteria:**

**Given** I am the group owner
**When** I update play style, goalkeeper mode, intensity, or generator style
**Then** future matches use the new settings
**And** existing locked match history remains unchanged.

**Given** I manage members
**When** I change a member role or remove a member
**Then** backend authorization reflects the change immediately
**And** unauthorized users cannot perform owner/admin actions.

### Story 1.7: Complete Player Identity And Football Profile

As a player,
I want to complete my identity and football profile,
So that my group knows who I am and the app can display me correctly.

**Acceptance Criteria:**

**Given** I joined a group
**When** I edit my player profile
**Then** I can save first name, last name, nickname, photo, bio/devise, dominant foot, jersey number, preferred style, and club de formation
**And** the roster displays my player identity.

**Given** profile information is incomplete
**When** I view my profile
**Then** the app shows clear missing fields
**And** it does not allow free-text profile claims to directly change competitive OVR.

### Story 1.8: Complete Vestiaire Personality

As a player,
I want to add funny locker-room personality details,
So that my profile and cards feel personal and fun.

**Acceptance Criteria:**

**Given** I edit my Vestiaire profile
**When** I add specialty, favorite excuse, bad-faith level, locker-room style, third-half profile, celebration, or legendary phrase
**Then** the values are saved to my group player profile
**And** they can be used in profile/card flavor.

**Given** Vestiaire fields are saved
**When** team generation or OVR is calculated
**Then** Vestiaire fields do not materially affect competitive balance
**And** Fun remains social/card-oriented unless future product decisions change it.

## Epic 2: Fast Player Ratings And Team Generation Readiness

Players can rate each other quickly and anonymously enough to establish trusted baseline ratings, while the group can see exactly what is missing before teams can be generated.

### Story 2.1: Submit One-Time Initial Peer Rating

As a group player,
I want to rate another player once on clear 0-100 attributes,
So that the group has a fair baseline before matches are played.

**Acceptance Criteria:**

**Given** I am a player in a group
**When** I rate another non-self player
**Then** I can submit Overall, Speed, Attack, Technique, Defense, Physical, Stamina, and Fun values from 0-100
**And** duplicate ratings for the same rated player in the same group are blocked.

**Given** the rated player is a goalkeeper profile
**When** I rate them
**Then** the goalkeeper attribute set is used
**And** the stored values remain normalized to the 0-100 system.

### Story 2.2: Edit Initial Rating Until Used

As a rater,
I want to adjust an initial peer rating before it affects locked team generation,
So that early mistakes can be corrected without corrupting history.

**Acceptance Criteria:**

**Given** I submitted an initial rating
**When** it has not been used in a confirmed team generation version
**Then** I can edit the rating
**And** the latest value is used for readiness and baseline calculations.

**Given** the rating has been used in a confirmed team generation version
**When** I try to edit it
**Then** the edit is blocked
**And** the app explains that the rating is locked because it affected official teams.

### Story 2.3: Show Rating Progress And Readiness

As a group member,
I want to see rating progress,
So that I know what is blocking team generation.

**Acceptance Criteria:**

**Given** I open Joueurs or a blocked Match state
**When** ratings are incomplete
**Then** I see player rating counts and missing rating needs
**And** individual rating values remain anonymous by default.

**Given** confirmed match players all have at least 3 ratings
**When** I view the match readiness state
**Then** the app shows that team generation is ready
**And** the organizer/admin can access generation.

### Story 2.4: Block Team Generation Until Baseline Threshold

As an organizer,
I want generation blocked until confirmed players have enough ratings,
So that the first generated teams feel credible.

**Acceptance Criteria:**

**Given** a match has confirmed players below the rating threshold
**When** an organizer tries to generate teams
**Then** generation is blocked
**And** the app shows which confirmed players need more ratings.

**Given** generation is blocked
**When** users view the blocked state
**Then** they can choose Rate Players or Remind Group
**And** the disabled action includes an explanation rather than a silent failure.

## Epic 3: Match Creation, Attendance, And Waitlist

Organizers can create matches and players can quickly say whether they are In, Out, or Maybe, with first-come confirmed spots and clear waitlist behavior.

### Story 3.1: Create A Match

As an organizer,
I want to create a match with football-specific settings,
So that players can confirm attendance for a specific session.

**Acceptance Criteria:**

**Given** I am an owner/admin organizer
**When** I create a match
**Then** I can set title, date/time, location, team size, attendance deadline, generator style override, and goalkeeper mode override
**And** the max player count is calculated as players per team times two.

**Given** a match is created
**When** group members open Accueil or Match
**Then** they see the next match card with date/time, location, format, and attendance status.

### Story 3.2: Submit Attendance Response

As a player,
I want to respond In, Out, or Maybe in one tap,
So that the group knows whether I am playing.

**Acceptance Criteria:**

**Given** a match is open
**When** I tap In, Out, or Maybe
**Then** my attendance response is saved idempotently
**And** the active state is clear in the Match Card.

**Given** I tap In before capacity is reached
**When** the response is saved
**Then** I become a confirmed player
**And** the confirmed count updates.

### Story 3.3: Manage Full Match Waitlist

As a player,
I want to see my waitlist position when a match is full,
So that I know whether I might still play.

**Acceptance Criteria:**

**Given** a match is full
**When** I tap In
**Then** I am added to the ordered waitlist
**And** the app shows my waitlist position.

**Given** a confirmed player cancels before teams lock
**When** a waitlisted player is next in line
**Then** that player moves into confirmed status
**And** the waitlist order updates.

### Story 3.4: Display Attendance Lists

As a group member,
I want to see confirmed and waitlisted players,
So that match status is obvious without checking chat.

**Acceptance Criteria:**

**Given** I open the Match screen
**When** attendance exists
**Then** I see confirmed players and waitlisted players using Player Row variants
**And** the count and status text do not rely on color alone.

**Given** the match has Maybe responses
**When** I view availability
**Then** Maybe players are visible separately
**And** Maybe does not affect confirmed count or waitlist priority.

## Epic 4: Trusted Smart Team Generator

Organizers can generate, review, explain, regenerate, manually adjust once, and lock fair teams that the group can trust as the official match source of truth.

### Story 4.1: Generate Saved Team Version

As an organizer,
I want to generate a fair saved team version,
So that the group can play with a trusted split.

**Acceptance Criteria:**

**Given** a match has a valid confirmed player pool and rating threshold complete
**When** I tap Generate
**Then** the backend creates a saved team generation version
**And** the response includes Team A, Team B, team totals, fairness percentage, and simple explanation.

**Given** the algorithm runs
**When** it creates a version
**Then** the API stores the algorithm input snapshot, score components, seed, and explanation data
**And** the mobile UI does not calculate fairness itself.

### Story 4.2: Show Team Generator Detail

As an organizer,
I want to review generated teams with clear explanation,
So that I can trust the split before locking it.

**Acceptance Criteria:**

**Given** a generated version exists
**When** I view Team Generator Detail
**Then** I see version number, Team A, Team B, totals, fairness percentage, and simple explanation
**And** I can expand details without seeing raw confusing weights.

**Given** the teams are displayed
**When** a screen reader reads the screen
**Then** team totals, fairness, and player assignments are accessible.

### Story 4.3: Regenerate Up To Five Versions

As an organizer,
I want to regenerate teams a limited number of times,
So that I can choose a good split without endless rerolling.

**Acceptance Criteria:**

**Given** teams are generated but not locked
**When** I tap Regenerate
**Then** a new saved version is created
**And** the previous version remains available for comparison.

**Given** five versions have been generated
**When** I try to regenerate again
**Then** regeneration is blocked
**And** the app explains the MVP regeneration limit.

### Story 4.4: Perform One Manual Adjustment

As an organizer,
I want one limited manual adjustment,
So that I can handle a real-world exception while keeping fairness visible.

**Acceptance Criteria:**

**Given** generated teams are not locked
**When** I use manual adjustment
**Then** I can make one valid player swap or move that preserves team size
**And** fairness recalculates immediately.

**Given** a version has been manually adjusted
**When** it is displayed
**Then** it is marked manually adjusted
**And** additional manual adjustment is blocked for MVP.

### Story 4.5: Confirm And Lock Teams

As an organizer,
I want to lock the selected team version,
So that the match has an official source of truth.

**Acceptance Criteria:**

**Given** a generated version exists
**When** I confirm teams
**Then** that version becomes locked
**And** casual edits/regeneration are no longer available.

**Given** teams are locked
**When** score, MVP voting, opponent ratings, stats, or share assets are created
**Then** they use the locked teams as the source of truth
**And** backend authorization enforces this rule.

## Epic 5: Post-Match Results, MVP, Opponent Ratings, And Rating Evolution

After a played match, organizers can record the official result and players can vote/rate quickly, causing stats, OVR, form, and history to update truthfully.

### Story 5.1: Submit And Edit Final Score

As an organizer,
I want to submit the final score for locked teams,
So that the match result becomes official inside the group.

**Acceptance Criteria:**

**Given** teams are locked
**When** an organizer/admin submits Team A and Team B scores
**Then** the result is saved idempotently
**And** all group members can view the score.

**Given** completion is not finalized
**When** an organizer/admin edits the score
**Then** the corrected result is saved
**And** downstream finalization has not yet run.

### Story 5.2: Record Goals And Assists

As an organizer,
I want to assign goals and assists to players,
So that player statistics reflect the match.

**Acceptance Criteria:**

**Given** a locked match has a submitted score
**When** I enter goals and assists
**Then** I can assign counts to players from locked teams only
**And** invalid player assignments are rejected.

**Given** goals and assists are saved
**When** the match summary is viewed
**Then** goalscorers and assists are displayed
**And** player statistics are ready for finalization.

### Story 5.3: Vote For MVP

As a confirmed match player,
I want to vote once for MVP,
So that the group can recognize the best performer.

**Acceptance Criteria:**

**Given** MVP voting is open for a locked match
**When** I vote for a player who is not myself
**Then** my vote is saved once
**And** duplicate votes are blocked.

**Given** I try to vote for myself or I was not confirmed in the match
**When** I submit a vote
**Then** the vote is rejected
**And** the app explains the rule.

### Story 5.4: Submit Quick Opponent Rating

As a confirmed match player,
I want to rate opponents quickly after the match,
So that future teams become more accurate without a long survey.

**Acceptance Criteria:**

**Given** post-match ratings are open
**When** I rate opponents
**Then** I can submit one performance rating per opponent and optional tags
**And** teammates and self-rating are not allowed.

**Given** I choose to skip opponent ratings
**When** I skip
**Then** the app lets me continue
**And** it shows a low-friction reminder that ratings improve future team generation.

### Story 5.5: Finalize Match And Evolve Ratings

As a group member,
I want completed matches to update ratings and stats truthfully,
So that rankings reflect actual performance over time.

**Acceptance Criteria:**

**Given** score and match events are ready
**When** an organizer/admin finalizes the match
**Then** stats, OVR, form, rating history, MVP counts, and leaderboards are updated
**And** OVR moves slower than form.

**Given** suspicious or extreme rating input exists
**When** rating evolution runs
**Then** anti-abuse policy softens or ignores suspicious influence
**And** the rating history records the update.

### Story 5.6: Void Finalized Match

As an owner/admin,
I want to void a finalized match,
So that incorrect or invalid matches do not distort rankings.

**Acceptance Criteria:**

**Given** a match has been finalized
**When** an owner/admin voids it
**Then** the match remains visible as voided in history
**And** it is excluded from leaderboards and rating evolution.

**Given** external share assets may already exist
**When** a match is voided
**Then** in-app recap assets are marked voided
**And** the app does not promise to retract externally shared images.

## Epic 6: Player Statistics, Leaderboards, And Match History

Group members can see rankings, player stats, performance periods, and match history so the group has a living competitive memory.

### Story 6.1: View Period-Based Leaderboards

As a group member,
I want to view leaderboards by multiple categories and periods,
So that competitive banter has a trusted source.

**Acceptance Criteria:**

**Given** finalized match data exists
**When** I open leaderboards
**Then** I can rank players by Overall, Goals, Assists, MVPs, Form, Win Rate, and Attendance
**And** I can switch between All-time, This month, Last 5 matches, and Season periods.

**Given** voided matches exist
**When** leaderboards are calculated
**Then** voided matches are excluded
**And** the UI does not show them as contributing results.

### Story 6.2: View Player Statistics

As a player,
I want to view my stats and recent performance,
So that I can understand my level and history in the group.

**Acceptance Criteria:**

**Given** I open a player profile
**When** stats exist
**Then** I see matches played, wins, losses, draws, win rate, goals, assists, MVPs, average rating, form, attendance, best card, and recent matches
**And** stats are group-specific.

**Given** a player has no completed matches
**When** their profile is viewed
**Then** the app shows an empty state with the next useful action
**And** it avoids misleading zero-based rankings.

### Story 6.3: View Match History And Summary

As a group member,
I want to browse match history and summaries,
So that the group can remember results beyond the latest match.

**Acceptance Criteria:**

**Given** completed matches exist
**When** I view match history
**Then** I can see final score, teams, MVP, goals, assists, date, and void status where applicable
**And** each summary uses locked team data.

**Given** a match has share assets
**When** I view its summary
**Then** I can access eligible recap/card share actions
**And** unavailable assets explain why they are locked or pending.

## Epic 7: Live Cards, Image Generation, And Viral Sharing

Players can unlock live Panini-style identity cards, generate one moderated image, and share player cards, MVP cards, and match posters as official-looking FiveMatch assets.

### Story 7.1: Unlock Live Player Card After OVR

As a player,
I want my live card to unlock when I have an OVR,
So that my football identity feels official.

**Acceptance Criteria:**

**Given** I do not yet have an OVR
**When** I open my card screen
**Then** the card is locked
**And** the app explains how rating progress unlocks it.

**Given** I have an OVR
**When** I open my card screen
**Then** I see a live card preview with OVR, position/style, attributes, stats, group, and FiveMatch branding
**And** the values reflect current group-specific data.

### Story 7.2: Configure Card Prompt And Upload Photo

As a player,
I want to upload a photo and validate my card style prompt,
So that the generated card looks like my football identity.

**Acceptance Criteria:**

**Given** my live card is unlocked
**When** I upload a photo and choose style options
**Then** I can preview the prompt request before generation
**And** the app explains the one-successful-attempt policy.

**Given** an uploaded photo or prompt fails moderation
**When** I try to generate
**Then** generation is blocked
**And** the blocked attempt does not consume my successful generation attempt.

### Story 7.3: Generate Panini-Style Card Image

As a player,
I want one successful generated Panini-style card image,
So that I can share a fun version of myself.

**Acceptance Criteria:**

**Given** my photo and prompt pass moderation
**When** I confirm generation
**Then** the image generation request is queued
**And** I can see generation status until it is ready or technically failed.

**Given** generation succeeds
**When** the final card asset is rendered
**Then** FiveMatch overlays trusted text, OVR, stats, QR code, and branding
**And** my successful generation attempt is consumed.

### Story 7.4: Generate MVP Card And Match Poster

As a group member,
I want to generate MVP cards and match result posters,
So that completed matches become shareable group memories.

**Acceptance Criteria:**

**Given** a match is completed
**When** I open share assets
**Then** I can generate available MVP card and match result poster assets
**And** the assets include score, teams, MVP, goalscorers/assists, date/location, fairness, and branding where applicable.

**Given** a share asset is still generating
**When** I view it
**Then** I see a pending state
**And** I am notified or can refresh when it becomes ready.

### Story 7.5: Export Share Assets

As a group member,
I want to export cards and posters through native sharing,
So that I can post them on WhatsApp or Instagram.

**Acceptance Criteria:**

**Given** a share asset is ready
**When** I choose export
**Then** I can use native share sheet or save/export PNG
**And** I can choose supported export language where relevant.

**Given** I share a generated asset
**When** it is rendered
**Then** it includes FiveMatch branding and a join/CTA element where appropriate
**And** the app records the share asset metadata.

## Epic 8: Operational Notifications, Localization, And Store-Ready Quality

Users receive the right operational reminders at the right moment, can control notification/language preferences, and the app meets native release, safety, accessibility, and reliability expectations.

### Story 8.1: Request And Store Push Permission

As a user,
I want notification permission requested at the right moment,
So that push prompts feel useful rather than intrusive.

**Acceptance Criteria:**

**Given** I first launch the app
**When** I have not joined a group or created a match
**Then** the app does not request push permission
**And** no push token is required for core browsing.

**Given** I join a group or create my first match
**When** notifications become useful
**Then** the app requests permission with clear context
**And** approved Expo push tokens are stored server-side.

### Story 8.2: Send Operational Notifications

As a group member,
I want timely match and rating notifications,
So that I do not miss important group actions.

**Acceptance Criteria:**

**Given** I have push notifications enabled
**When** rating reminders, match reminders, waitlist updates, teams generated/locked, score submitted, MVP voting, opponent rating reminders, card ready, or poster ready events occur
**Then** the system enqueues and sends the correct localized notification
**And** send attempts are logged.

**Given** I disable a notification preference
**When** that event occurs
**Then** the notification is not sent to me
**And** other enabled notification types still work.

### Story 8.3: Complete Localization Coverage

As a French or English user,
I want the app and share content in my chosen language,
So that FiveMatch feels native to my group.

**Acceptance Criteria:**

**Given** app language, group default language, and export language can differ
**When** UI, notifications, algorithm explanations, cards, and posters render
**Then** each uses the correct language source
**And** missing translations are detected in development.

**Given** funny/card labels need local flavor
**When** French and English labels are authored
**Then** they are stored as separate localized strings
**And** the app does not rely only on literal machine-style translation.

### Story 8.4: Enforce Accessibility And Store-Ready Guardrails

As a mobile user,
I want the app to be accessible, safe, and controllable,
So that it is ready for real App Store and Google Play usage.

**Acceptance Criteria:**

**Given** core screens use icon actions, status colors, rating controls, thumbnails, or blocked states
**When** accessibility is tested
**Then** labels, status text, touch targets, non-drag controls, and actionable errors are present
**And** color is not the only critical status signal.

**Given** a user needs account/privacy controls
**When** they open account settings
**Then** they can access account deletion, privacy/terms links, notification preferences, and report flows
**And** moderation/reporting paths exist for profile images and generated content.

## Final Validation

### Requirements Coverage

**Functional Requirements:** 30/30 mapped to epics and represented by stories.

**Non-Functional Requirements:** 7/7 represented across story acceptance criteria and epic scope:

- NFR1: Covered by Epic 4 team generation responsiveness and algorithm boundaries.
- NFR2: Covered by idempotency requirements across Epics 2, 3, 4, and 5.
- NFR3: Covered by Epic 8 privacy, account deletion, and reporting guardrails.
- NFR4: Covered by Epic 7 moderation and image-generation state handling.
- NFR5: Covered by Epics 1, 7, and 8 localization requirements.
- NFR6: Covered by Epic 8 notification consent and preferences.
- NFR7: Covered across UX-driven acceptance criteria, especially Epics 1, 2, 3, 4, 7, and 8.

**Architecture Requirements:** 18/18 represented across the story plan:

- Starter setup is explicitly covered by Story 1.1.
- Backend-owned domain rules are covered by Epics 2, 4, and 5.
- Pure algorithm package requirements are covered by Epics 2 and 4.
- Async jobs, notifications, media pipeline, and deployment shape are covered by Epics 7 and 8.

**UX Design Requirements:** 23/23 represented across story plan:

- Navigation, design tokens, Match Card, Player Row, rating, team generation, locked teams, post-match flow, share picker, blocked states, waitlist states, locked/voided/card states, accessibility, and mockup references are all mapped to story acceptance criteria.

### Story Quality Validation

- Total epics: 8.
- Total stories: 39.
- Stories are sequenced so each story depends only on previous stories or established platform foundations.
- Stories avoid one massive upfront database/model creation pass; entities are introduced through the feature stories that need them.
- Technical foundation is limited to Story 1.1 because Architecture requires it as the first implementation story.
- All remaining stories are framed around user-visible or product-operational value.

### Dependency Validation

- Epic 1 establishes app access, groups, and player identity.
- Epic 2 uses Epic 1 group/player identity and unlocks rating readiness.
- Epic 3 uses Epic 1 group membership to create match attendance flow.
- Epic 4 uses Epic 2 ratings and Epic 3 confirmed players to generate and lock teams.
- Epic 5 uses Epic 4 locked teams to complete the match and evolve ratings.
- Epic 6 uses finalized match data from Epic 5 to expose stats/history.
- Epic 7 uses OVR/stats/history from previous epics to unlock and share cards.
- Epic 8 strengthens notifications, localization, accessibility, safety, and store readiness across the MVP.

### Development Readiness

**Overall Status:** READY FOR IMPLEMENTATION PLANNING

The epics and stories are ready to feed sprint planning or story automation. The natural first implementation story is Story 1.1: Initialize Native App And API Workspace.
