import '../global.css'
import '../src/i18n'
import * as Sentry from '@sentry/react-native'
import { ClerkProvider, useAuth } from '@clerk/expo'

if (__DEV__) {
  // Surface the real message behind minified unhandled rejections (e.g. Clerk internals)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
import { useEffect } from 'react'
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
    const inJoinRoute = segments[0] === 'join'
    if (!isSignedIn && !inAuthGroup && !inJoinRoute) {
      router.replace('/(auth)/sign-in')
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/(app)')
    }
  }, [isSignedIn, isLoaded, segments])

  return <Slot />
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
      </QueryClientProvider>
    </ClerkProvider>
  )
}
