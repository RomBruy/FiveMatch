import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  SupportedLocale,
  UpdateCurrentUserPreferencesInput,
} from '@fit-five/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PREFERRED_LOCALE,
  normalizePreferredLocale,
} from './user-preferences';

export type InternalUser = {
  id: string;
  clerkUserId: string;
  emailAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  preferredLocale: SupportedLocale;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncUserInput = {
  clerkUserId: string;
  emailAddress?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  preferredLocale?: SupportedLocale;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async syncFromAuth(input: SyncUserInput): Promise<InternalUser> {
    const profileData = {
      emailAddress: input.emailAddress ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      imageUrl: input.imageUrl ?? null,
    };

    const user = await this.prisma.user.upsert({
      where: {
        clerkUserId: input.clerkUserId,
      },
      create: {
        clerkUserId: input.clerkUserId,
        preferredLocale: input.preferredLocale ?? DEFAULT_PREFERRED_LOCALE,
        ...profileData,
      },
      update: {
        ...profileData,
        ...(input.preferredLocale
          ? { preferredLocale: input.preferredLocale }
          : {}),
      },
    });

    return this.toInternalUser(user);
  }

  async updatePreferences(
    clerkUserId: string,
    input: UpdateCurrentUserPreferencesInput,
  ): Promise<InternalUser> {
    const user = await this.prisma.user.upsert({
      where: {
        clerkUserId,
      },
      create: {
        clerkUserId,
        preferredLocale: input.preferredLocale,
      },
      update: {
        preferredLocale: input.preferredLocale,
      },
    });

    return this.toInternalUser(user);
  }

  private toInternalUser(user: User): InternalUser {
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      emailAddress: user.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      preferredLocale: normalizePreferredLocale(user.preferredLocale),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
