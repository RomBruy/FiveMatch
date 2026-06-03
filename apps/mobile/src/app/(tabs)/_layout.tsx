import { useAuth } from '@clerk/expo';
import { Redirect, Tabs } from 'expo-router';

import { AuthLoadingScreen } from '@/features/auth/auth-loading-screen';
import { SessionBootstrap } from '@/features/auth/session-bootstrap';
import { usePreferences } from '@/features/preferences/preferences-context';

export default function TabsLayout() {
  const { strings } = usePreferences();
  const { isLoaded, isSignedIn } = useAuth({
    treatPendingAsSignedOut: false,
  });

  if (!isLoaded) {
    return <AuthLoadingScreen message={strings.auth.restoringSession} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <>
      <SessionBootstrap />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: '#07110D' },
          headerTintColor: '#F4F7F2',
          tabBarActiveTintColor: '#35C77B',
          tabBarInactiveTintColor: '#7D8796',
          tabBarStyle: {
            backgroundColor: '#07110D',
            borderTopColor: '#1D2630',
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: strings.navigation.home }} />
        <Tabs.Screen name="joueurs" options={{ title: strings.navigation.players }} />
        <Tabs.Screen name="match" options={{ title: strings.navigation.match }} />
        <Tabs.Screen
          name="vestiaire"
          options={{ title: strings.navigation.lockerRoom }}
        />
        <Tabs.Screen name="profil" options={{ title: strings.navigation.profile }} />
      </Tabs>
    </>
  );
}
