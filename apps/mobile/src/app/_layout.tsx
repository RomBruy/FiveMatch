import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DarkTheme, Slot, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { MissingAuthConfigScreen } from '@/features/auth/missing-auth-config-screen';
import { PreferencesProvider } from '@/features/preferences/preferences-context';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <PreferencesProvider>
        {publishableKey ? (
          <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
            <Slot />
          </ClerkProvider>
        ) : (
          <MissingAuthConfigScreen />
        )}
        <StatusBar style="light" />
      </PreferencesProvider>
    </ThemeProvider>
  );
}
