import type {
  AcceptFootballGroupInvitationResponse,
  CreateFootballGroupInvitationResponse,
  CreateFootballGroupInput,
  CreateFootballGroupResponse,
  CreateFootballMatchInput,
  CreateFootballMatchResponse,
  CurrentUserResponse,
  FootballGroupMembersResponse,
  FootballGroupsResponse,
  GenerateTeamVersionResponse,
  HealthResponse,
  InitialPeerRatingReadinessResponse,
  LatestTeamGenerationResponse,
  MyInitialPeerRatingsResponse,
  NextFootballMatchResponse,
  PlayerProfileResponse,
  PlayerRosterResponse,
  RemoveFootballGroupMemberResponse,
  SubmitInitialPeerRatingInput,
  SubmitInitialPeerRatingResponse,
  SubmitMatchAttendanceInput,
  SubmitMatchAttendanceResponse,
  SyncCurrentUserInput,
  UpdateInitialPeerRatingInput,
  UpdateInitialPeerRatingResponse,
  UpdateFootballGroupMemberRoleInput,
  UpdateFootballGroupMemberRoleResponse,
  UpdateCurrentUserPreferencesInput,
  UpsertPlayerProfileInput,
  UpsertPlayerProfileResponse,
  UpsertPlayerVestiaireInput,
  UpsertPlayerVestiaireResponse,
  UpdateFootballGroupSettingsInput,
  UpdateFootballGroupSettingsResponse,
} from "@fit-five/shared";
import Constants from "expo-constants";

const DEFAULT_API_BASE_URL = "http://localhost:3000/api/v1";

type ApiRequestOptions = RequestInit & {
  token?: string | null;
};

export function getApiBaseUrl() {
  const configuredUrl =
    Constants.expoConfig?.extra?.apiBaseUrl ??
    process.env.EXPO_PUBLIC_API_BASE_URL;

  return configuredUrl ?? DEFAULT_API_BASE_URL;
}

async function apiFetch<TResponse>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

export async function syncCurrentUser(
  token: string,
  input: SyncCurrentUserInput
): Promise<CurrentUserResponse> {
  return apiFetch<CurrentUserResponse>("/auth/sync", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function updateCurrentUserPreferences(
  token: string,
  input: UpdateCurrentUserPreferencesInput
): Promise<CurrentUserResponse> {
  return apiFetch<CurrentUserResponse>("/users/me/preferences", {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export async function listCurrentUserGroups(
  token: string
): Promise<FootballGroupsResponse> {
  return apiFetch<FootballGroupsResponse>("/groups", {
    token,
  });
}

export async function createFootballGroup(
  token: string,
  input: CreateFootballGroupInput
): Promise<CreateFootballGroupResponse> {
  return apiFetch<CreateFootballGroupResponse>("/groups", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function createFootballGroupInvitation(
  token: string,
  groupId: string
): Promise<CreateFootballGroupInvitationResponse> {
  return apiFetch<CreateFootballGroupInvitationResponse>(
    `/groups/${groupId}/invitations`,
    {
      method: "POST",
      token,
    }
  );
}

export async function acceptFootballGroupInvitation(
  token: string,
  inviteToken: string
): Promise<AcceptFootballGroupInvitationResponse> {
  return apiFetch<AcceptFootballGroupInvitationResponse>(
    `/invitations/${encodeURIComponent(inviteToken)}/accept`,
    {
      method: "POST",
      token,
    }
  );
}

export async function updateFootballGroupSettings(
  token: string,
  groupId: string,
  input: UpdateFootballGroupSettingsInput
): Promise<UpdateFootballGroupSettingsResponse> {
  return apiFetch<UpdateFootballGroupSettingsResponse>(
    `/groups/${groupId}/settings`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function listFootballGroupMembers(
  token: string,
  groupId: string
): Promise<FootballGroupMembersResponse> {
  return apiFetch<FootballGroupMembersResponse>(`/groups/${groupId}/members`, {
    token,
  });
}

export async function updateFootballGroupMemberRole(
  token: string,
  groupId: string,
  memberId: string,
  input: UpdateFootballGroupMemberRoleInput
): Promise<UpdateFootballGroupMemberRoleResponse> {
  return apiFetch<UpdateFootballGroupMemberRoleResponse>(
    `/groups/${groupId}/members/${memberId}/role`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function removeFootballGroupMember(
  token: string,
  groupId: string,
  memberId: string
): Promise<RemoveFootballGroupMemberResponse> {
  return apiFetch<RemoveFootballGroupMemberResponse>(
    `/groups/${groupId}/members/${memberId}`,
    {
      method: "DELETE",
      token,
    }
  );
}

export async function listGroupPlayers(
  token: string,
  groupId: string
): Promise<PlayerRosterResponse> {
  return apiFetch<PlayerRosterResponse>(`/groups/${groupId}/players`, {
    token,
  });
}

export async function getMyPlayerProfile(
  token: string,
  groupId: string
): Promise<PlayerProfileResponse> {
  return apiFetch<PlayerProfileResponse>(`/groups/${groupId}/players/me`, {
    token,
  });
}

export async function upsertMyPlayerProfile(
  token: string,
  groupId: string,
  input: UpsertPlayerProfileInput
): Promise<UpsertPlayerProfileResponse> {
  return apiFetch<UpsertPlayerProfileResponse>(
    `/groups/${groupId}/players/me`,
    {
      method: "PUT",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function upsertMyPlayerVestiaire(
  token: string,
  groupId: string,
  input: UpsertPlayerVestiaireInput
): Promise<UpsertPlayerVestiaireResponse> {
  return apiFetch<UpsertPlayerVestiaireResponse>(
    `/groups/${groupId}/players/me/vestiaire`,
    {
      method: "PUT",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function listMyInitialPeerRatings(
  token: string,
  groupId: string
): Promise<MyInitialPeerRatingsResponse> {
  return apiFetch<MyInitialPeerRatingsResponse>(
    `/groups/${groupId}/initial-peer-ratings/me`,
    {
      token,
    }
  );
}

export async function getInitialPeerRatingReadiness(
  token: string,
  groupId: string
): Promise<InitialPeerRatingReadinessResponse> {
  return apiFetch<InitialPeerRatingReadinessResponse>(
    `/groups/${groupId}/initial-peer-ratings/readiness`,
    {
      token,
    }
  );
}

export async function submitInitialPeerRating(
  token: string,
  groupId: string,
  input: SubmitInitialPeerRatingInput
): Promise<SubmitInitialPeerRatingResponse> {
  return apiFetch<SubmitInitialPeerRatingResponse>(
    `/groups/${groupId}/initial-peer-ratings`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function updateInitialPeerRating(
  token: string,
  groupId: string,
  ratingId: string,
  input: UpdateInitialPeerRatingInput
): Promise<UpdateInitialPeerRatingResponse> {
  return apiFetch<UpdateInitialPeerRatingResponse>(
    `/groups/${groupId}/initial-peer-ratings/${ratingId}`,
    {
      method: "PUT",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function createFootballMatch(
  token: string,
  groupId: string,
  input: CreateFootballMatchInput
): Promise<CreateFootballMatchResponse> {
  return apiFetch<CreateFootballMatchResponse>(`/groups/${groupId}/matches`, {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function getNextFootballMatch(
  token: string,
  groupId: string
): Promise<NextFootballMatchResponse> {
  return apiFetch<NextFootballMatchResponse>(
    `/groups/${groupId}/matches/next`,
    {
      token,
    }
  );
}

export async function submitMatchAttendance(
  token: string,
  groupId: string,
  matchId: string,
  input: SubmitMatchAttendanceInput
): Promise<SubmitMatchAttendanceResponse> {
  return apiFetch<SubmitMatchAttendanceResponse>(
    `/groups/${groupId}/matches/${matchId}/attendance/me`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    }
  );
}

export async function generateTeamVersion(
  token: string,
  groupId: string,
  matchId: string
): Promise<GenerateTeamVersionResponse> {
  return apiFetch<GenerateTeamVersionResponse>(
    `/groups/${groupId}/matches/${matchId}/team-generations`,
    {
      method: "POST",
      token,
    }
  );
}

export async function getLatestTeamGeneration(
  token: string,
  groupId: string,
  matchId: string
): Promise<LatestTeamGenerationResponse> {
  return apiFetch<LatestTeamGenerationResponse>(
    `/groups/${groupId}/matches/${matchId}/team-generations/latest`,
    {
      token,
    }
  );
}
