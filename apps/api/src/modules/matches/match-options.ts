import type {
  FootballMatchAttendanceResponse,
  FootballMatchAttendanceStatus,
  FootballMatchStatus,
  GroupGeneratorStyle,
  GroupGoalkeeperMode,
  OpponentRatingTag,
} from '@fit-five/shared';
import {
  isSupportedGroupGeneratorStyle,
  isSupportedGroupGoalkeeperMode,
} from '../groups/group-options';

const supportedMatchStatuses = [
  'open',
  'cancelled',
  'locked',
  'completed',
] as const satisfies readonly FootballMatchStatus[];
const supportedAttendanceResponses = [
  'in',
  'out',
  'maybe',
] as const satisfies readonly FootballMatchAttendanceResponse[];
const supportedAttendanceStatuses = [
  'confirmed',
  'waitlisted',
  'out',
  'maybe',
] as const satisfies readonly FootballMatchAttendanceStatus[];
export const supportedOpponentRatingTags = [
  'fast',
  'technical',
  'aggressive',
  'playmaker',
  'finisher',
  'defensive_wall',
  'funny',
  'team_player',
] as const satisfies readonly OpponentRatingTag[];

export function normalizeMatchStatus(value: unknown): FootballMatchStatus {
  return typeof value === 'string' &&
    supportedMatchStatuses.includes(value as FootballMatchStatus)
    ? (value as FootballMatchStatus)
    : 'open';
}

export function isSupportedAttendanceResponse(
  value: unknown,
): value is FootballMatchAttendanceResponse {
  return (
    typeof value === 'string' &&
    supportedAttendanceResponses.includes(
      value as FootballMatchAttendanceResponse,
    )
  );
}

export function normalizeAttendanceResponse(
  value: unknown,
): FootballMatchAttendanceResponse {
  return isSupportedAttendanceResponse(value) ? value : 'maybe';
}

export function normalizeAttendanceStatus(
  value: unknown,
): FootballMatchAttendanceStatus {
  return typeof value === 'string' &&
    supportedAttendanceStatuses.includes(value as FootballMatchAttendanceStatus)
    ? (value as FootballMatchAttendanceStatus)
    : 'maybe';
}

export function isSupportedOpponentRatingTag(
  value: unknown,
): value is OpponentRatingTag {
  return (
    typeof value === 'string' &&
    supportedOpponentRatingTags.includes(value as OpponentRatingTag)
  );
}

export function normalizeGeneratorStyleOverride(
  value: unknown,
): GroupGeneratorStyle | null {
  return isSupportedGroupGeneratorStyle(value) ? value : null;
}

export function normalizeGoalkeeperModeOverride(
  value: unknown,
): GroupGoalkeeperMode | null {
  return isSupportedGroupGoalkeeperMode(value) ? value : null;
}
