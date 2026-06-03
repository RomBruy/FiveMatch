import type { CurrentUser } from '@fit-five/shared';
import type { InternalUser } from './users.service';

export function serializeCurrentUser(user: InternalUser): CurrentUser {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    emailAddress: user.emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    preferredLocale: user.preferredLocale,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
