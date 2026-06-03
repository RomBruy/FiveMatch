---
name: FiveMatch
description: Mobile-first football group app with a trusted matchday brain, Panini-style identity, and Sunday League energy.
status: draft
created: 2026-05-31
updated: 2026-05-31
colors:
  surface-night: '#070A0D'
  surface-panel: '#11161D'
  surface-raised: '#171D26'
  surface-pitch: '#0B2A1D'
  text-primary: '#F4F7F5'
  text-secondary: '#9AA3B2'
  text-muted: '#6E7685'
  line-subtle: '#242B36'
  turf: '#2FB171'
  turf-dark: '#176C46'
  whistle: '#F4C430'
  card-gold: '#D8A73A'
  kit-red: '#EF3E36'
  ice-blue: '#8BD8FF'
  void: '#602126'
  success-bg: '#0F3527'
  warning-bg: '#3A3013'
  danger-bg: '#351417'
typography:
  display:
    fontFamily: 'Sora'
    fontSize: '32px'
    fontWeight: 800
    lineHeight: '38px'
    letterSpacing: '0'
  title:
    fontFamily: 'Sora'
    fontSize: '22px'
    fontWeight: 700
    lineHeight: '28px'
    letterSpacing: '0'
  section:
    fontFamily: 'Sora'
    fontSize: '13px'
    fontWeight: 800
    lineHeight: '18px'
    letterSpacing: '0.08em'
  body:
    fontFamily: 'DM Sans'
    fontSize: '16px'
    fontWeight: 500
    lineHeight: '22px'
    letterSpacing: '0'
  body-small:
    fontFamily: 'DM Sans'
    fontSize: '13px'
    fontWeight: 500
    lineHeight: '18px'
    letterSpacing: '0'
  score:
    fontFamily: 'Sora'
    fontSize: '48px'
    fontWeight: 800
    lineHeight: '54px'
    letterSpacing: '0'
rounded:
  sm: '4px'
  md: '8px'
  lg: '12px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  screen-margin: '20px'
  tabbar-height: '72px'
components:
  action-primary:
    background: '{colors.turf}'
    text: '{colors.surface-night}'
    radius: '{rounded.md}'
    height: '56px'
  action-secondary:
    background: '{colors.surface-raised}'
    text: '{colors.text-primary}'
    border: '{colors.line-subtle}'
    radius: '{rounded.md}'
  card-panel:
    background: '{colors.surface-panel}'
    border: '{colors.line-subtle}'
    radius: '{rounded.md}'
  status-confirmed:
    background: '{colors.success-bg}'
    accent: '{colors.turf}'
  status-waitlist:
    background: '{colors.warning-bg}'
    accent: '{colors.whistle}'
  status-out:
    background: '{colors.danger-bg}'
    accent: '{colors.kit-red}'
---

## Brand & Style

FiveMatch should feel like a night match under floodlights: focused, competitive, a little mischievous, and social without becoming noisy. The visual language borrows from five places: pitch markings, football stickers, scoreboard graphics, WhatsApp-like operational clarity, and locker-room banter.

The product is not a generic fitness tracker and not a pro-club analytics suite. It should feel like the official app for a private group of friends who take their amateur football seriously enough to argue, but not seriously enough to lose the fun.

The reference app screenshots establish a useful direction: dark mobile surfaces, green action states, yellow competitive accents, red out states, big match cards, visible attendance, bottom navigation, and playful profile fields. FiveMatch keeps that spirit while tightening hierarchy, accessibility, and card/share moments.

## Colors

`{colors.surface-night}` is the base app background. It should feel like evening football, not corporate dark mode.

`{colors.surface-panel}` and `{colors.surface-raised}` create depth for match cards, player rows, rating panels, and generated team blocks.

`{colors.turf}` is the primary action color for In, Generate, Confirm, Share, and active tab states.

`{colors.whistle}` marks attention, rating tasks, waitlist, MVP, and important prompts that are not errors.

`{colors.kit-red}` marks Out, destructive actions, and void/error states.

`{colors.card-gold}` is reserved for Panini-style card moments, MVP, achievements, and special share assets.

Do not make every surface green. Green means action or confirmed status. Gold means football glory. Red means absence, danger, or cancellation.

## Typography

Use Sora for display, screen titles, section labels, scores, OVR, and card identity. Use DM Sans for body, form fields, lists, and helper text.

Screen titles should be confident and compact. Match scores and OVR numbers can be large. Form labels, explanations, and rating helper copy should stay short.

Section labels use uppercase Sora with modest letter spacing for football-broadcast structure: `PROCHAIN MATCH`, `CONFIRMES`, `FAIRNESS`, `VESTIAIRE`, `DERNIER MATCH`.

## Layout & Spacing

The app is native mobile first. Primary layouts use a single vertical scroll with `{spacing.screen-margin}` horizontal margins.

Top areas should establish context quickly: group, next match, attendance, team status, or player identity. Keep the primary action close to the state it changes.

Use compact repeated rows for players and ratings. Use larger panels only for match cards, result cards, card previews, and team-generation output.

Bottom navigation is persistent and uses `{spacing.tabbar-height}` plus device safe area. It should never obscure primary confirmation buttons; screens with bottom actions must include enough scroll padding.

## Elevation & Depth

Depth is tonal more than shadow-heavy. Use darker/lighter surfaces and 1px borders instead of large soft shadows.

Important panels can use a subtle pitch-tint background, such as `{colors.surface-pitch}`, when they represent live match state.

Panini cards may use stronger glow, foil, or metallic treatments, but the core app UI should stay cleaner than the generated share assets.

## Shapes

Most UI cards use `{rounded.md}`. Keep repeated rows and panels crisp enough to feel sporty and structured.

Pills, status badges, and avatars may use `{rounded.full}`. Player photos can use `{rounded.lg}` only when the image is the hero object.

Avoid large soft blobs and decorative orbs. Use pitch lines, sticker edges, score blocks, and broadcast-style separators instead.

## Components

**Match Card**

Large panel showing title, date/time, location, status badge, attendance bar, waitlist count, and attendance actions. Uses `{components.card-panel}` and status tint based on user attendance.

**Attendance Buttons**

In uses `{colors.turf}`. Out uses `{colors.kit-red}` on `{colors.danger-bg}`. Maybe uses `{colors.whistle}` on `{colors.warning-bg}`.

**Player Row**

Avatar, nickname/name, rating progress or status, and contextual action. Rows should remain scannable for 20-40 player groups.

**Team Generation Panel**

Shows Team A, Team B, fairness percentage, team totals, explanation bullets, and expandable details. The fairness number should be as visually prominent as the team totals.

**Rating Card**

One player at a time, with 0-100 controls for Overall, Speed, Attack, Technique, Defense, Physical, Stamina, and Fun. Use segmented presets or sliders with large touch targets.

**Live Panini Card Preview**

Card-like object with photo, OVR, name/nickname, attributes, group, and FiveMatch branding. It may use `{colors.card-gold}` and textured sticker treatments more freely than core UI panels.

**Share Asset Picker**

Post-match picker showing Match Poster, MVP Card, and My Player Card. Each option should include a visual thumbnail and export formats.

## Do's and Don'ts

Do make the weekly match state obvious within two seconds.

Do make the team generator feel like the hero feature.

Do make rating tasks feel quick, structured, and important.

Do use French and English strings with local flavor.

Do keep the app operationally calm and let cards/posters carry the visual spectacle.

Do not bury attendance behind a calendar-style screen.

Do not turn Vestiaire into the primary product before the match loop works.

Do not expose raw algorithm weights to normal users.

Do not make ratings look like school grades or performance reviews.

Do not let AI-generated card art render critical text, OVR, or stats.
