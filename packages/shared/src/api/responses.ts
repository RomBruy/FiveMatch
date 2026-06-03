import type { SupportedLocale } from '../localization/index.js';

export type ApiSuccessResponse<TData> = {
  data: TData;
};

export type HealthResponse = ApiSuccessResponse<{
  status: 'ok';
}>;

export type CurrentUser = {
  id: string;
  clerkUserId: string;
  emailAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  preferredLocale: SupportedLocale;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUserResponse = ApiSuccessResponse<{
  user: CurrentUser;
}>;

export type SyncCurrentUserInput = {
  emailAddress?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  preferredLocale?: SupportedLocale;
};

export type UpdateCurrentUserPreferencesInput = {
  preferredLocale: SupportedLocale;
};
