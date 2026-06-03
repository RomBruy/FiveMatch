import type {
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

export function normalizeMatchStatus(value: unknown): FootballMatchStatus {
  return typeof value === 'string' &&
    supportedMatchStatuses.includes(value as FootballMatchStatus)
    ? (value as FootballMatchStatus)
    : 'open';
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
