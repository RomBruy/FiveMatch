# Existing Design-System Inventory

Status: Phase 0 preservation baseline  
Requirement: PR-055  
Captured: 2026-08-02

## Purpose

This inventory records the visual and interaction system already present in the mobile application. It is a preservation baseline, not a redesign brief. Future work must start from these files and patterns and may deviate only when a documented requirement makes a minimal deviation necessary.

Several source comments refer to a canonical `DESIGN.md`, but that file was not present in the audited repository. Until that source is restored and reconciled, the implemented token and shared-component files listed here are the verifiable baseline.

## Canonical tokens and treatments

| Concern | Existing source | Preserved rule |
|---|---|---|
| Palette and semantic colors | `apps/mobile/constants/colors.ts` | Reuse `Colors`; dark core surfaces and the limited paper treatment remain distinct. Do not add feature-local colors where a token exists. |
| Typography, radii and motion | `apps/mobile/constants/tokens.ts` | Reuse `Fonts`, `Type`, `Radius`, `Motion`, `MotionEasing` and `MotionSpring`. The radius scale is closed. |
| Render-only gradients/colors | `apps/mobile/constants/gradients.ts` | Reuse named treatments; keep one-off render colors out of feature components. |
| Fonts | `apps/mobile/app/_layout.tsx` | Bebas Neue is the display/stat voice; Inter is the body/interaction voice. Fonts load once at the root. |
| Reduced motion | root `ReducedMotionConfig`, `hooks/use-reduce-motion.ts` | Respect the operating-system preference. Prefer instant/crossfade behavior when motion is reduced. |
| Theme behavior | current constants/root layout | The audited app uses its established dark core plus named paper surfaces. No parallel theme or unrelated light/dark system may be introduced. |

## Shared UI primitives

Use the closest existing primitive before creating a new component:

- Primary and secondary actions: `PrimaryButton`, `SecondaryButton`.
- Interactive cards and rows: `PressableScale` with explicit accessibility props.
- Inputs and selections: `Input`, `CodeInput`, `Chip`, `RatingSlider`.
- Surfaces: `RaisedBlurSurface`, existing card patterns, `StatTile`.
- Navigation: `TabDock` and Expo Router layouts already in place.
- Headers: `CollapsingHeader`, `CollapsingHeaderTitle`, `useCollapsingHeader`.
- Loading and reveal: `Skeleton` presets, `StaggerItem`, `CountUpNumber`, `CountdownPill`.
- Identity and status: `DuotoneAvatar`, `FormDots`, `TextureType`.
- Match-specific patterns: `MatchCard`, `SpotsMeter`, `PitchBoard`, and existing match action rows.

Existing interaction conventions include pill-shaped primary actions, a short press response, raised dark surfaces with hairlines, one dominant display voice per screen, restrained glow, transform/opacity animation, explicit loading/disabled states, and supported reduced-motion behavior.

## Navigation baseline

The current primary dock contains exactly four product destinations:

1. Jouer (`index`)
2. Mes matchs (`matches`)
3. Crew (`crew`)
4. Profil (`profile/index`)

Match, player, group, pronostic and admin routes remain non-dock destinations. A functional requirement may add or change a route, but it does not authorize a new navigation concept or unrelated tab reorganization.

## Responsive and accessibility baseline

- Screens use safe-area insets and flexible React Native layout rather than fixed device frames.
- Primary actions expose button roles and disabled/busy state where supported.
- Selection controls expose selected/disabled state.
- Shared statistics expose a combined accessible label.
- Interactive surfaces are expected to retain established touch-target sizing and explicit labels for icon-only actions.
- Motion follows the system reduced-motion setting.
- English and French copy remain subject to the existing parity check and established tone.

These are current patterns, not proof that every screen is already accessible. Requirement-driven fixes may improve labels, ordering, errors, focus/reading order, touch targets or contrast while preserving the visual language.

## Dependency and change guard

`apps/mobile/scripts/design-baseline.json` records the current direct dependency names, required design files and four visible tabs. `pnpm --filter @fivematch/mobile check:design-baseline` fails when a direct dependency or visible primary tab is added without a deliberate baseline review.

Updating that baseline is not automatic approval. The implementation report must identify the dependency or navigation deviation, explain why existing code cannot satisfy the requirement, and record explicit approval before implementation.

No screenshot renderer is currently installed in the mobile package. Phase 0 therefore adds no visual testing dependency and makes no screen change. For later UI work, supported-size screenshots or render snapshots are required wherever the approved testing setup supports them.

## Required screen-change record

Complete this before editing any screen:

| Field | Required entry |
|---|---|
| Requirement | Product requirement ID and acceptance criterion |
| Existing pattern reused | Token, primitive, component or screen pattern |
| Change type | Behavior-only, layout, styling, or a minimal combination |
| Necessity | Why the requirement cannot be met without the change |
| Supported sizes | Smallest and largest supported sizes checked |
| Accessibility | Roles, labels, reading order, touch targets, contrast and reduced motion checked |
| Visual evidence | Before/after screenshot or snapshot when supported |
| Deviation | `None`, or the approved unavoidable deviation and justification |

## Phase 1 screen-change record

| Requirement | Existing pattern reused | Change type | Necessity | Verification | Deviation |
|---|---|---|---|---|---|
| PR-015/016/055 — opponent-only post-match rating | Existing `PostMatchRatings`, `RatingSlider`, `PrimaryButton`, `InfoStrip`, `DuotoneAvatar`, `CountdownPill`, `Colors`, `Fonts`, `Radius` | Behavior/data selection only; no layout or styling change | The prior list selected teammates, contradicting the permanent opponent-only rule | Pure opponent/empty/error-state tests, mobile typecheck/lint, 620-key i18n parity and PR-055 dependency/navigation baseline; flexible existing layout remains unchanged | None |
| PR-045/055 — non-blocking crew approval | Existing pending welcome transition and established `/(app)` root | Navigation destination only; no layout or styling change | Initial crew ratings are disabled and cannot block joining or play | TypeScript and unchanged four-tab navigation baseline | None |

No visual dependency, token, color, typography, component, animation or navigation concept was added. No screenshot renderer exists in the approved setup, so the behavior-only change is covered by source-level design-baseline checks rather than a new visual dependency. Supported-size behavior continues to use the existing flexible card/scroll layout; device screenshot comparison remains a manual release-review item.

## Phase 2 screen-change record

| Requirement | Existing pattern reused | Change type | Necessity | Verification | Deviation |
|---|---|---|---|---|---|
| PR-040-042/055 — owner visibility settings | Existing Profile cards, `Chip`, `Colors`, `Fonts`, `Radius`, spacing and loading/error patterns | Minimal settings content inside the existing scroll layout; no styling-system change | Owners need an explicit action to select each field audience and inspect the private DTO | Mobile TypeScript/lint, 638-key parity, baseline check; compact/large source review confirmed flexible wrapping/scrolling and existing safe-area behavior | None |
| PR-040/043/055 — public player profile | Existing public player card and conditional sections | Behavior/data contract only | Hidden values must be absent rather than visually concealed, and the viewer's active crew must not be attached to the subject | Shared-schema typing, conditional-render source review and unchanged navigation/dependency baseline | None |
| PR-008/051/052/055 — public preview and match detail | Existing match cards, detail sections, loading/error states and city copy | Behavior/data contract only | The screens must consume capability-shaped DTOs and never receive private fields they merely hide | Shared mobile contract types, TypeScript/lint, four-tab baseline and compact/large flexible-layout source review | None |
| PR-051/052/055 — group identifiers | Existing Crew/group list, roster and request actions | Behavior/data identifiers only | Mobile actions must use purpose-specific membership/request/player IDs instead of account user IDs | TypeScript/lint and unchanged component/navigation baseline | None |

No visual dependency, token, palette, typography, radius, animation, tab or new navigation concept was added in Phase 2. The only new component, `ProfileVisibilityControls`, composes the established `Chip` and card treatment. The approved setup still has no screenshot renderer, so supported-size verification was a source-level review of the existing safe-area, scroll, flex and wrap behavior; device screenshots and screen-reader checks remain a manual release-review item.
