import '../global.css'
import '../src/i18n'
import * as Sentry from '@sentry/react-native'
import { ClerkProvider, useAuth } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { Platform } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'

// Keep the native brand frame up through font, auth, and active-group restoration.
void SplashScreen.preventAutoHideAsync()

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
import { useEffect, useRef, useState } from 'react'
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue'
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { queryClient } from '../lib/query-client'
import { setClerkGetToken } from '../lib/api-client'
import { GroupContextProvider, useGroupContext } from '../contexts/GroupContext'
import { BrandSplash } from '../components/BrandSplash'

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

function BootstrappedApp() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { isReady: groupReady } = useGroupContext()
  const bootstrapReady = authLoaded && (!isSignedIn || groupReady)
  const hasCompletedColdStart = useRef(false)

  if (bootstrapReady) hasCompletedColdStart.current = true

  // Bootstrap is a cold-start gate, not an auth-transition gate. Once handed off,
  // signing in/out must never bring the launch frame back or expose a blank root.
  if (!hasCompletedColdStart.current) return null

  return (
    <>
      <AuthGuard />
      <BrandSplash ready />
    </>
  )
}

function BootstrapRoot() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => {
    setClerkGetToken(getToken)
    setTokenReady(true)
  }, [getToken])

  // A restored signed-in session must have its token bridge installed before the
  // group bootstrap's first API request. Signed-out startup has no token dependency.
  if (!isLoaded || (isSignedIn && !tokenReady)) return null

  return (
    <GroupContextProvider>
      <BootstrappedApp />
    </GroupContextProvider>
  )
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

  // Native splash stays above this frame; the React fallback guarantees that even
  // a platform-specific native handoff can never reveal a blank root.
  if (!fontsLoaded) return <BrandSplash ready={false} />

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={Platform.OS === 'web' ? undefined : tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        {/* All reanimated animations follow the OS reduce-motion setting (design v2 motion rule). */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <BootstrapRoot />
      </QueryClientProvider>
    </ClerkProvider>
  )
}
