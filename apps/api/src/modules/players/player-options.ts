import type {
  PlayerDominantFoot,
  PlayerPreferredStyle,
  PlayerProfile,
  PlayerProfileField,
  PlayerVestiaireField,
} from '@fit-five/shared';

const supportedDominantFeet = ['left', 'right', 'both'] as const;
const supportedPreferredStyles = [
  'goalkeeper',
  'defender',
  'midfielder',
  'attacker',
  'all_rounder',
] as const;

export const requiredPlayerProfileFields = [
  'firstName',
  'lastName',
  'nickname',
  'photoUrl',
  'bio',
  'dominantFoot',
  'jerseyNumber',
  'preferredStyle',
  'clubDeFormation',
] as const satisfies readonly PlayerProfileField[];
export const requiredPlayerVestiaireFields = [
  'specialty',
  'favoriteExcuse',
  'badFaithLevel',
  'lockerRoomStyle',
  'thirdHalfProfile',
  'warCry',
  'signatureCelebration',
  'worstOnPitchHabit',
  'legendaryPhrase',
] as const satisfies readonly PlayerVestiaireField[];

function isOneOf<const TValue extends readonly string[]>(
  value: unknown,
  values: TValue,
): value is TValue[number] {
  return typeof value === 'string' && values.includes(value);
}

export function isSupportedDominantFoot(
  value: unknown,
): value is PlayerDominantFoot {
  return isOneOf(value, supportedDominantFeet);
}

export function isSupportedPreferredStyle(
  value: unknown,
): value is PlayerPreferredStyle {
  return isOneOf(value, supportedPreferredStyles);
}

export function normalizeDominantFoot(
  value: unknown,
): PlayerDominantFoot | null {
  return isSupportedDominantFoot(value) ? value : null;
}

export function normalizePreferredStyle(
  value: unknown,
): PlayerPreferredStyle | null {
  return isSupportedPreferredStyle(value) ? value : null;
}

export function getMissingPlayerProfileFields(
  player: Pick<
    PlayerProfile,
    | 'firstName'
    | 'lastName'
    | 'nickname'
    | 'photoUrl'
    | 'bio'
    | 'dominantFoot'
    | 'jerseyNumber'
    | 'preferredStyle'
    | 'clubDeFormation'
  >,
): PlayerProfileField[] {
  return requiredPlayerProfileFields.filter((field) => {
    const value = player[field];

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    return value === null || value === undefined;
  });
}

export function getMissingPlayerVestiaireFields(
  player: Pick<
    PlayerProfile,
    | 'specialty'
    | 'favoriteExcuse'
    | 'badFaithLevel'
    | 'lockerRoomStyle'
    | 'thirdHalfProfile'
    | 'warCry'
    | 'signatureCelebration'
    | 'worstOnPitchHabit'
    | 'legendaryPhrase'
  >,
): PlayerVestiaireField[] {
  return requiredPlayerVestiaireFields.filter((field) => {
    const value = player[field];

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    return value === null || value === undefined;
  });
}
