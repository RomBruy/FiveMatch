import type { GroupGeneratorStyle, GroupGoalkeeperMode } from "./groups.js";
import type { ApiSuccessResponse } from "./responses.js";

export const footballMatchStatuses = [
  "open",
  "cancelled",
  "locked",
  "completed",
] as const;
export const footballMatchAttendanceResponses = ["in", "out", "maybe"] as const;
export const footballMatchAttendanceStatuses = [
  "confirmed",
  "waitlisted",
  "out",
  "maybe",
] as const;
export const footballMatchEventKinds = ["goal", "assist"] as const;
export const teamGenerationVersionLimit = 5;

export type FootballMatchStatus = (typeof footballMatchStatuses)[number];
export type FootballMatchAttendanceResponse =
  (typeof footballMatchAttendanceResponses)[number];
export type FootballMatchAttendanceStatus =
  (typeof footballMatchAttendanceStatuses)[number];
export type FootballMatchEventKind = (typeof footballMatchEventKinds)[number];

export type FootballMatchAttendance = {
  id: string;
  matchId: string;
  playerId: string;
  response: FootballMatchAttendanceResponse;
  status: FootballMatchAttendanceStatus;
  waitlistPosition: number | null;
  respondedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FootballMatchScore = {
  teamAScore: number;
  teamBScore: number;
  submittedByUserId: string;
  submittedAt: string;
};

export type FootballMatchEvent = {
  id: string;
  matchId: string;
  playerId: string;
  kind: FootballMatchEventKind;
  count: number;
  recordedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type FootballMatchMvpVote = {
  id: string;
  matchId: string;
  voterPlayerId: string;
  votedPlayerId: string;
  createdAt: string;
  updatedAt: string;
};

export type FootballMatch = {
  id: string;
  groupId: string;
  organizerUserId: string;
  title: string;
  startsAt: string;
  location: string;
  playersPerTeam: number;
  maxPlayers: number;
  attendanceDeadlineAt: string;
  generatorStyleOverride: GroupGeneratorStyle | null;
  goalkeeperModeOverride: GroupGoalkeeperMode | null;
  status: FootballMatchStatus;
  confirmedCount: number;
  waitlistCount: number;
  score: FootballMatchScore | null;
  events: FootballMatchEvent[];
  mvpVotes: FootballMatchMvpVote[];
  myMvpVote: FootballMatchMvpVote | null;
  attendances: FootballMatchAttendance[];
  myAttendance: FootballMatchAttendance | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamGenerationPlayer = {
  playerId: string;
  rating: number;
  preferredStyle: string | null;
  slot: number;
};

export type TeamGenerationTeam = {
  label: "A" | "B";
  totalRating: number;
  averageRating: number;
  players: TeamGenerationPlayer[];
};

export type TeamGenerationScoreComponents = {
  ratingGap: number;
  positionImbalance: number;
  goalkeeperImbalance: number;
  randomness: number;
  candidateScore: number;
};

export type TeamGenerationExplanation = {
  summary: string;
  bullets: string[];
};

export type TeamManualAdjustment = {
  type: "swap";
  adjustedAt: string;
  adjustedByUserId: string;
  fromTeamAPlayerId: string;
  fromTeamBPlayerId: string;
};

export type TeamGenerationInputSnapshot = {
  matchId: string;
  groupId: string;
  playersPerTeam: number;
  generatorStyle: GroupGeneratorStyle;
  goalkeeperMode: GroupGoalkeeperMode;
  playerRatings: Array<{
    playerId: string;
    rating: number;
    ratingsReceived: number;
    preferredStyle: string | null;
  }>;
};

export type TeamGenerationVersion = {
  id: string;
  matchId: string;
  generatedByUserId: string;
  versionNumber: number;
  seed: string;
  algorithmVersion: string;
  status: "draft" | "locked";
  teamA: TeamGenerationTeam;
  teamB: TeamGenerationTeam;
  teamATotal: number;
  teamBTotal: number;
  fairnessPercentage: number;
  inputSnapshot: TeamGenerationInputSnapshot;
  scoreComponents: TeamGenerationScoreComponents;
  explanation: TeamGenerationExplanation;
  manualAdjustment: TeamManualAdjustment | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateFootballMatchInput = {
  title: string;
  startsAt: string;
  location: string;
  playersPerTeam: number;
  attendanceDeadlineAt: string;
  generatorStyleOverride?: GroupGeneratorStyle | null;
  goalkeeperModeOverride?: GroupGoalkeeperMode | null;
};

export type CreateFootballMatchResponse = ApiSuccessResponse<{
  match: FootballMatch;
}>;

export type NextFootballMatchResponse = ApiSuccessResponse<{
  match: FootballMatch | null;
}>;

export type SubmitMatchAttendanceInput = {
  response: FootballMatchAttendanceResponse;
};

export type SubmitMatchAttendanceResponse = ApiSuccessResponse<{
  match: FootballMatch;
}>;

export type SubmitFinalScoreInput = {
  teamAScore: number;
  teamBScore: number;
};

export type SubmitFinalScoreResponse = ApiSuccessResponse<{
  match: FootballMatch;
}>;

export type UpsertMatchPlayerEventsInput = {
  players: Array<{
    playerId: string;
    goals: number;
    assists: number;
  }>;
};

export type UpsertMatchPlayerEventsResponse = ApiSuccessResponse<{
  match: FootballMatch;
}>;

export type SubmitMvpVoteInput = {
  votedPlayerId: string;
};

export type SubmitMvpVoteResponse = ApiSuccessResponse<{
  vote: FootballMatchMvpVote;
  match: FootballMatch;
}>;

export type GenerateTeamVersionResponse = ApiSuccessResponse<{
  generation: TeamGenerationVersion;
}>;

export type LatestTeamGenerationResponse = ApiSuccessResponse<{
  generation: TeamGenerationVersion | null;
}>;

export type TeamGenerationVersionsResponse = ApiSuccessResponse<{
  generations: TeamGenerationVersion[];
  limit: number;
  remaining: number;
}>;

export type ManualTeamAdjustmentInput = {
  teamAPlayerId: string;
  teamBPlayerId: string;
};

export type ManualTeamAdjustmentResponse = ApiSuccessResponse<{
  generation: TeamGenerationVersion;
}>;

export type ConfirmTeamGenerationResponse = ApiSuccessResponse<{
  match: FootballMatch;
  generation: TeamGenerationVersion;
}>;
