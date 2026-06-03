import type { InitialPeerRating } from '@fit-five/shared';
import type { InternalInitialPeerRating } from './ratings.service';

export function serializeInitialPeerRating(
  rating: InternalInitialPeerRating,
): InitialPeerRating {
  return {
    id: rating.id,
    groupId: rating.groupId,
    raterPlayerId: rating.raterPlayerId,
    ratedPlayerId: rating.ratedPlayerId,
    attributeSet: rating.attributeSet,
    overall: rating.overall,
    speed: rating.speed,
    attack: rating.attack,
    technique: rating.technique,
    defense: rating.defense,
    reflexes: rating.reflexes,
    positioning: rating.positioning,
    handling: rating.handling,
    distribution: rating.distribution,
    communication: rating.communication,
    physical: rating.physical,
    stamina: rating.stamina,
    fun: rating.fun,
    lockedAt: rating.lockedAt ? rating.lockedAt.toISOString() : null,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
  };
}
