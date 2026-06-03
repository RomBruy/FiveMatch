import type { ApiSuccessResponse } from "./responses.js";

export const playerDominantFeet = ["left", "right", "both"] as const;
export const playerPreferredStyles = [
  "goalkeeper",
  "defender",
  "midfielder",
  "attacker",
  "all_rounder",
] as const;
export const playerProfileFields = [
  "firstName",
  "lastName",
  "nickname",
  "photoUrl",
  "bio",
  "dominantFoot",
  "jerseyNumber",
  "preferredStyle",
  "clubDeFormation",
] as const;
export const playerVestiaireFields = [
  "specialty",
  "favoriteExcuse",
  "badFaithLevel",
  "lockerRoomStyle",
  "thirdHalfProfile",
  "warCry",
  "signatureCelebration",
  "worstOnPitchHabit",
  "legendaryPhrase",
] as const;

export type PlayerDominantFoot = (typeof playerDominantFeet)[number];
export type PlayerPreferredStyle = (typeof playerPreferredStyles)[number];
export type PlayerProfileField = (typeof playerProfileFields)[number];
export type PlayerVestiaireField = (typeof playerVestiaireFields)[number];

export type PlayerProfile = {
  id: string;
  groupId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  photoUrl: string | null;
  bio: string | null;
  dominantFoot: PlayerDominantFoot | null;
  jerseyNumber: number | null;
  preferredStyle: PlayerPreferredStyle | null;
  clubDeFormation: string | null;
  specialty: string | null;
  favoriteExcuse: string | null;
  badFaithLevel: number | null;
  lockerRoomStyle: string | null;
  thirdHalfProfile: string | null;
  warCry: string | null;
  signatureCelebration: string | null;
  worstOnPitchHabit: string | null;
  legendaryPhrase: string | null;
  missingFields: PlayerProfileField[];
  isComplete: boolean;
  vestiaireMissingFields: PlayerVestiaireField[];
  isVestiaireComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPlayerProfileInput = {
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  dominantFoot?: PlayerDominantFoot | null;
  jerseyNumber?: number | null;
  preferredStyle?: PlayerPreferredStyle | null;
  clubDeFormation?: string | null;
};

export type UpsertPlayerVestiaireInput = {
  specialty?: string | null;
  favoriteExcuse?: string | null;
  badFaithLevel?: number | null;
  lockerRoomStyle?: string | null;
  thirdHalfProfile?: string | null;
  warCry?: string | null;
  signatureCelebration?: string | null;
  worstOnPitchHabit?: string | null;
  legendaryPhrase?: string | null;
};

export type PlayerProfileResponse = ApiSuccessResponse<{
  player: PlayerProfile | null;
}>;

export type UpsertPlayerProfileResponse = ApiSuccessResponse<{
  player: PlayerProfile;
}>;

export type UpsertPlayerVestiaireResponse = ApiSuccessResponse<{
  player: PlayerProfile;
}>;

export type PlayerRosterResponse = ApiSuccessResponse<{
  players: PlayerProfile[];
}>;
