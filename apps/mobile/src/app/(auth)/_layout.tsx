import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

import { AuthLoadingScreen } from '@/features/auth/auth-loading-screen';
import { usePreferences } from '@/features/preferences/preferences-context';

export default function AuthLayout() {
  const { strings } = usePreferences();
  const { isLoaded, isSignedIn } = useAuth({
    treatPendingAsSignedOut: false,
  });

  if (!isLoaded) {
    return <AuthLoadingScreen message={strings.auth.loadingSession} />;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
