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
  // Gated on __DEV__ rather than APP_ENV: only EXPO_PUBLIC_* vars are inlined
  // into the bundle, so `process.env.APP_ENV` read as undefined at runtime and
  // this was silently false in every build, production included. __DEV__ also
  // covers preview builds, which is where tester crashes actually come from.
  enabled: !__DEV__,
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
import { GroupContextProvider } from '../contexts/GroupContext'
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
    // Compared as plain strings: expo-router's generated route union lags the
    // filesystem until the dev server regenerates it, and a stale union must not
    // turn a real route into a type error.
    const root = segments[0] as string | undefined
    const inAuthGroup = root === '(auth)'
    const inProfileCompletion = inAuthGroup && (segments[1] as string | undefined) === 'profile-completion'
    // Public entry points: a crew invite code, a shared match link, and the
    // (public) group — guest discovery and the privacy policy. None may bounce
    // a signed-out visitor to sign-in; they are the pitch, and a privacy policy
    // you need an account to read is not a privacy policy.
    //
    // Signed-in users are not redirected away from these: the second branch
    // below only fires inside (auth), so there is no loop.
    const inPublicRoute = root === 'join' || root === 'm' || root === '(public)'
    if (!isSignedIn && !inAuthGroup && !inPublicRoute) {
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
  const { isLoaded: authLoaded } = useAuth()
  // Crews are optional now, so cold start no longer waits on one being resolved.
  // Holding the splash for a crew lookup punished exactly the user this app is
  // for: someone with no group who just wants to see tonight's matches.
  const bootstrapReady = authLoaded
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
