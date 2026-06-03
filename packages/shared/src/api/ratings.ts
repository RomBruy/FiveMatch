import type { ApiSuccessResponse } from "./responses.js";

export const initialPeerRatingAttributeSets = [
  "standard",
  "goalkeeper",
] as const;
export const standardInitialPeerRatingAttributes = [
  "overall",
  "speed",
  "attack",
  "technique",
  "defense",
  "physical",
  "stamina",
  "fun",
] as const;
export const goalkeeperInitialPeerRatingAttributes = [
  "overall",
  "reflexes",
  "positioning",
  "handling",
  "distribution",
  "communication",
  "physical",
  "fun",
] as const;

export type InitialPeerRatingAttributeSet =
  (typeof initialPeerRatingAttributeSets)[number];
export type StandardInitialPeerRatingAttribute =
  (typeof standardInitialPeerRatingAttributes)[number];
export type GoalkeeperInitialPeerRatingAttribute =
  (typeof goalkeeperInitialPeerRatingAttributes)[number];
export type InitialPeerRatingAttribute =
  | StandardInitialPeerRatingAttribute
  | GoalkeeperInitialPeerRatingAttribute;

export type InitialPeerRatingValues = Partial<
  Record<InitialPeerRatingAttribute, number>
>;

export type SubmitInitialPeerRatingInput = {
  ratedPlayerId: string;
  values: InitialPeerRatingValues;
};

export type InitialPeerRating = {
  id: string;
  groupId: string;
  raterPlayerId: string;
  ratedPlayerId: string;
  attributeSet: InitialPeerRatingAttributeSet;
  overall: number;
  speed: number | null;
  attack: number | null;
  technique: number | null;
  defense: number | null;
  reflexes: number | null;
  positioning: number | null;
  handling: number | null;
  distribution: number | null;
  communication: number | null;
  physical: number;
  stamina: number | null;
  fun: number;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmitInitialPeerRatingResponse = ApiSuccessResponse<{
  rating: InitialPeerRating;
}>;

export type MyInitialPeerRatingsResponse = ApiSuccessResponse<{
  ratings: InitialPeerRating[];
}>;
