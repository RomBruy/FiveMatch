import type { PlayerProfile } from '@fit-five/shared';
import type { InternalPlayerProfile } from './players.service';

export function serializePlayerProfile(
  player: InternalPlayerProfile,
): PlayerProfile {
  return {
    id: player.id,
    groupId: player.groupId,
    userId: player.userId,
    firstName: player.firstName,
    lastName: player.lastName,
    nickname: player.nickname,
    photoUrl: player.photoUrl,
    bio: player.bio,
    dominantFoot: player.dominantFoot,
    jerseyNumber: player.jerseyNumber,
    preferredStyle: player.preferredStyle,
    clubDeFormation: player.clubDeFormation,
    specialty: player.specialty,
    favoriteExcuse: player.favoriteExcuse,
    badFaithLevel: player.badFaithLevel,
    lockerRoomStyle: player.lockerRoomStyle,
    thirdHalfProfile: player.thirdHalfProfile,
    warCry: player.warCry,
    signatureCelebration: player.signatureCelebration,
    worstOnPitchHabit: player.worstOnPitchHabit,
    legendaryPhrase: player.legendaryPhrase,
    missingFields: player.missingFields,
    isComplete: player.isComplete,
    vestiaireMissingFields: player.vestiaireMissingFields,
    isVestiaireComplete: player.isVestiaireComplete,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
  };
}
