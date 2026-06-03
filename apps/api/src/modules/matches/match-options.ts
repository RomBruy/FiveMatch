import type {
  FootballMatchAttendanceResponse,
  FootballMatchAttendanceStatus,
  FootballMatchStatus,
  GroupGeneratorStyle,
  GroupGoalkeeperMode,
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
