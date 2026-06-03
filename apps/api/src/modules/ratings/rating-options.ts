import type {
  GoalkeeperInitialPeerRatingAttribute,
  InitialPeerRatingAttribute,
  InitialPeerRatingAttributeSet,
  InitialPeerRatingValues,
  StandardInitialPeerRatingAttribute,
} from '@fit-five/shared';

const standardInitialPeerRatingAttributes = [
  'overall',
  'speed',
  'attack',
  'technique',
  'defense',
  'physical',
  'stamina',
  'fun',
] as const satisfies readonly StandardInitialPeerRatingAttribute[];
const goalkeeperInitialPeerRatingAttributes = [
  'overall',
  'reflexes',
  'positioning',
  'handling',
  'distribution',
  'communication',
  'physical',
  'fun',
] as const satisfies readonly GoalkeeperInitialPeerRatingAttribute[];

export function getInitialPeerRatingAttributeSet(
  preferredStyle: string | null,
): InitialPeerRatingAttributeSet {
  return preferredStyle === 'goalkeeper' ? 'goalkeeper' : 'standard';
}

export function getRequiredInitialPeerRatingAttributes(
  attributeSet: InitialPeerRatingAttributeSet,
) {
  return attributeSet === 'goalkeeper'
    ? goalkeeperInitialPeerRatingAttributes
    : standardInitialPeerRatingAttributes;
}

export function getValidatedRatingValue(
  values: InitialPeerRatingValues,
  attribute: InitialPeerRatingAttribute,
): number | null {
  const value = values[attribute];

  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return null;
  }

  return value;
}
