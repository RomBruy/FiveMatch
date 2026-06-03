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

export type FootballMatchStatus = (typeof footballMatchStatuses)[number];
export type FootballMatchAttendanceResponse =
  (typeof footballMatchAttendanceResponses)[number];
export type FootballMatchAttendanceStatus =
  (typeof footballMatchAttendanceStatuses)[number];

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
  myAttendance: FootballMatchAttendance | null;
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
