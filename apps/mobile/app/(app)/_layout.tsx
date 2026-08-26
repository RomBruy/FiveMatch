import { Tabs, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { httpClient } from '../../lib/api-client'
import { TabDock } from '../../components/ui/TabDock'
import { TutorialOverlay } from '../../components/onboarding/TutorialOverlay'
import { useTutorialSeen } from '../../lib/onboarding'
import { usePushRegistration } from '../../hooks/use-push-registration'
import * as Notifications from 'expo-notifications'

function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const { data } = await httpClient.get<{
          data: { name: string | null; userId: string; email: string; onboardingCompletedAt: string | null }
        }>('/v1/auth/me')
        return data.data
      } catch (err) {
        // A Clerk session may exist before the corresponding app user has been
        // synced (notably after OAuth). Send that account through onboarding.
        if ((err as { response?: { status?: number } }).response?.status === 404) return null
        throw err
      }
    },
  })
}

/**
 * Five tabs, down from six.
 *
 * The old dock had Accueil and Match both showing the next match, and Players
 * and Vestiaire both showing the same roster. What's left maps to what a user
 * actually does: find a game, manage the games they're in, keep up with their
 * crew, follow their bankroll, and look at their own card.
 *
 * Pronos briefly lived only inside the match. That left the bankroll displayed
 * nowhere and the board reachable only by drilling into a fixture, so the tab is
 * back — as an index over every open market, not a second betting surface.
 * Placing a bet still happens on the match that prices it.
 */
function AppLayoutInner() {
  const { seen, markSeen } = useTutorialSeen()
  const { t } = useTranslation()
  const router = useRouter()
  const { data: user, isSuccess } = useCurrentUser()

  useEffect(() => {
    if (isSuccess && (!user || user.name === null || user.onboardingCompletedAt === null)) {
      router.replace('/(auth)/profile-completion')
    }
  }, [isSuccess, user])

  usePushRegistration()

  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string
        matchId?: string
        groupId?: string
        playerId?: string
      }

      if (data.type === 'CARD_UNLOCKED' && data.playerId) {
        router.push(`/(app)/profile?reveal=${data.playerId}` as never)
        return
      }
      // Every match-scoped notification now carries its matchId, so any of them
      // lands on the match rather than on whichever tab happened to be open.
      if (data.matchId) {
        router.push(`/(app)/match/${data.matchId}` as never)
      }
    })
    return () => {
      responseListener.current?.remove()
    }
  }, [router])

  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <TabDock {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: t('nav.play') }} />
        <Tabs.Screen name="matches" options={{ title: t('nav.myMatches') }} />
        <Tabs.Screen name="crew" options={{ title: t('nav.crew') }} />
        <Tabs.Screen name="pronos/index" options={{ title: t('nav.pronos') }} />
        <Tabs.Screen name="profile/index" options={{ title: t('nav.profile') }} />
        <Tabs.Screen name="match" options={{ href: null }} />
        <Tabs.Screen name="player" options={{ href: null }} />
        <Tabs.Screen name="groups" options={{ href: null }} />
        <Tabs.Screen name="pronos/[matchId]" options={{ href: null }} />
        <Tabs.Screen name="admin" options={{ href: null }} />
        <Tabs.Screen name="help" options={{ href: null }} />
      </Tabs>

      {/* Sits over the tab navigator so the coach marks can point at the dock —
          the whole point is showing places on the running app, not on a mockup.
          `seen === null` means storage has not answered, and rendering nothing
          then is what stops it flashing on every cold start. */}
      {seen === false && <TutorialOverlay onFinish={markSeen} />}
    </View>
  )
}

export default function AppLayout() {
  return <AppLayoutInner />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
})
