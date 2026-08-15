import type { ProfileFieldVisibility, ProfileVisibilityAudience } from '@fivematch/types'

/**
 * Named privacy settings.
 *
 * The profile used to render all twelve fields against all four audiences —
 * forty-eight chips a user had to reason about one at a time, sitting under
 * their own card. Almost nobody wants per-field control; almost everybody wants
 * to say "keep the jokes among my crew" once.
 *
 * The full grid still exists behind these, so nothing is taken away. What is
 * taken away is the obligation to use it.
 */
export type PresetId = 'discreet' | 'normal' | 'open'

/** The three groups a person actually thinks in. */
const IDENTITY = ['currentClub', 'formerClub', 'preferredPosition', 'strongFoot', 'playerStyle'] as const
const VESTIAIRE = ['specialSkill', 'favoriteExcuse', 'badFaithLevel', 'lockerRoomStyle', 'thirdHalfProfile'] as const

function build(
  photo: ProfileVisibilityAudience,
  cardPhoto: ProfileVisibilityAudience,
  identity: ProfileVisibilityAudience,
  vestiaire: ProfileVisibilityAudience,
): ProfileFieldVisibility {
  const out = { profilePhoto: photo, generatedCardPhoto: cardPhoto } as ProfileFieldVisibility
  for (const f of IDENTITY) out[f] = identity
  for (const f of VESTIAIRE) out[f] = vestiaire
  return out
}

export const PRESETS: Record<PresetId, ProfileFieldVisibility> = {
  // Nothing leaves the crew except the face that has to, so people can
  // recognise you when you turn up.
  discreet: build('public', 'group', 'group', 'private'),
  // Players you actually share a pitch with see how you play; the jokes stay
  // with the people who were there for them.
  normal: build('public', 'participants', 'participants', 'group'),
  open: build('public', 'public', 'public', 'public'),
}

export const PRESET_ORDER: PresetId[] = ['discreet', 'normal', 'open']

/** Which preset a saved visibility matches, or null when it is hand-tuned. */
export function detectPreset(current: ProfileFieldVisibility): PresetId | null {
  return PRESET_ORDER.find((id) => {
    const preset = PRESETS[id]
    return (Object.keys(preset) as (keyof ProfileFieldVisibility)[])
      .every((field) => preset[field] === current[field])
  }) ?? null
}

/** How many fields a preset exposes to anyone at all — shown on the summary row. */
export function publicFieldCount(v: ProfileFieldVisibility): number {
  return Object.values(v).filter((a) => a === 'public').length
}
