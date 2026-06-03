import { useAuth, useUser } from '@clerk/expo';
import { useEffect, useState } from 'react';

import { syncCurrentUser } from '@/api/client';
import { usePreferences } from '@/features/preferences/preferences-context';

export function SessionBootstrap() {
  const { hasStoredLocale, setLocale } = usePreferences();
  const { getToken, isLoaded, isSignedIn } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const { user } = useUser();
  const [lastSyncedUserId, setLastSyncedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id || lastSyncedUserId === user.id) {
      return;
    }

    let isActive = true;
    const currentUser = user;

    async function syncSession() {
      try {
        const token = await getToken();

        if (!token) {
          return;
        }

        const response = await syncCurrentUser(token, {
          emailAddress: currentUser.primaryEmailAddress?.emailAddress ?? null,
          firstName: currentUser.firstName ?? null,
          lastName: currentUser.lastName ?? null,
          imageUrl: currentUser.imageUrl ?? null,
        });

        if (!hasStoredLocale) {
          await setLocale(response.data.user.preferredLocale);
        }

        if (isActive) {
          setLastSyncedUserId(currentUser.id);
        }
      } catch (error) {
        console.warn('Unable to sync FiveMatch user session', error);
      }
    }

    void syncSession();

    return () => {
      isActive = false;
    };
  }, [getToken, hasStoredLocale, isLoaded, isSignedIn, lastSyncedUserId, setLocale, user]);

  return null;
}
