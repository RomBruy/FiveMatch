import '../global.css'
import '../src/i18n'
import * as Sentry from '@sentry/react-native'
import { ClerkProvider, useAuth } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { Platform } from 'react-native'

if (__DEV__) {
  // Surface the real message behind minified unhandled rejections (e.g. Clerk internals)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('promise/setimmediate/rejection-tracking').enable({
    allRejections: true,
    onUnhandled: (id: number, error: unknown) => {
      const e = error as { message?: string; code?: string; longMessage?: string; errors?: unknown; stack?: string }
      console.error(
        `[unhandled-rejection ${id}]`,
        JSON.stringify({ message: e?.message, code: e?.code, longMessage: e?.longMessage, errors: e?.errors }, null, 2),
      )
    },
  })
}

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: process.env.APP_ENV === 'production',
  tracesSampleRate: 0.2,
})
import { QueryClientProvider } from '@tanstack/react-query'
import { Slot, useRouter, useSegments } from 'expo-router'
import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated'
import { useEffect } from 'react'
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue'
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { queryClient } from '../lib/query-client'
import { setClerkGetToken } from '../lib/api-client'

function AuthGuard() {
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    setClerkGetToken(getToken)
  }, [getToken])

  useEffect(() => {
    if (!isLoaded) return
    const inAuthGroup = segments[0] === '(auth)'
    const inProfileCompletion = inAuthGroup && segments[1] === 'profile-completion'
    const inJoinRoute = segments[0] === 'join'
    if (!isSignedIn && !inAuthGroup && !inJoinRoute) {
      router.replace('/(auth)/sign-in')
    } else if (isSignedIn && inAuthGroup && !inProfileCompletion) {
      // A session restored from SecureStore should enter immediately. Explicit
      // sign-in/sign-up handlers route through profile completion themselves.
      router.replace('/(app)')
    }
  }, [isSignedIn, isLoaded, segments])

  return <Slot />
}

export default function RootLayout() {
  // All five faces load once here; screens reference them via constants/tokens.ts Fonts map.
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })

  if (!fontsLoaded) return null

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={Platform.OS === 'web' ? undefined : tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        {/* All reanimated animations follow the OS reduce-motion setting (design v2 motion rule). */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <AuthGuard />
      </QueryClientProvider>
    </ClerkProvider>
  )
}
