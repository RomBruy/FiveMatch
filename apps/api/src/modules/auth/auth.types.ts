import type { Request } from 'express';

export type AuthenticatedUser = {
  clerkUserId: string;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedUser;
};
