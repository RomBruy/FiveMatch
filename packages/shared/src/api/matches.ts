import type { GroupGeneratorStyle, GroupGoalkeeperMode } from "./groups.js";
import type { ApiSuccessResponse } from "./responses.js";

export const footballMatchStatuses = [
  "open",
  "cancelled",
  "locked",
  "completed",
] as const;

export type FootballMatchStatus = (typeof footballMatchStatuses)[number];

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
