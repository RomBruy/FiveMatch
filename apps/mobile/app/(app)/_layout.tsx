import { Tabs, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { httpClient } from '../../lib/api-client'
import { GroupContextProvider, useGroupContext } from '../../contexts/GroupContext'
import { usePushRegistration } from '../../hooks/use-push-registration'
import * as Notifications from 'expo-notifications'

function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { name: string | null; userId: string; email: string } }>('/v1/auth/me')
      return data.data
    },
  })
}

function useActiveGroup(groupId: string | null) {
  return useQuery({
    queryKey: ['groups', groupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { name: string; tier: string } }>(`/v1/groups/${groupId}`)
      return data.data
    },
    enabled: groupId !== null,
  })
}

function ContextPill() {
  const { t } = useTranslation()
  const { activeGroupId } = useGroupContext()
  const { data: group } = useActiveGroup(activeGroupId)

  if (!activeGroupId || !group) return null

  return (
    <View style={styles.contextPill}>
      <Text style={styles.contextPillText}>
        {t(`groups.home.tier.${group.tier}`).toUpperCase()} · {group.name.toUpperCase()}
      </Text>
    </View>
  )
}

function AppLayoutInner() {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: user, isSuccess } = useCurrentUser()

  useEffect(() => {
    if (isSuccess && user.name === null) {
      router.replace('/(auth)/profile-completion')
    }
  }, [isSuccess, user])

  usePushRegistration()

  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          type?: string
          groupId?: string
          playerId?: string
        }
        if (data.type === 'CARD_UNLOCKED' && data.groupId && data.playerId) {
          router.push(
            `/(app)/groups/${data.groupId}/card-reveal?playerId=${data.playerId}` as never
          )
        }
      }
    )
    return () => {
      responseListener.current?.remove()
    }
  }, [router])

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.inkSecondary,
          tabBarStyle: { backgroundColor: Colors.surface },
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('auth.shell.tabAccueil') }} />
        <Tabs.Screen name="players" options={{ title: t('auth.shell.tabPlayers') }} />
        <Tabs.Screen name="match" options={{ title: t('auth.shell.tabMatch') }} />
        <Tabs.Screen name="vestiaire" options={{ title: t('auth.shell.tabVestiaire') }} />
        <Tabs.Screen name="profile/index" options={{ title: t('auth.shell.tabProfile') }} />
        <Tabs.Screen name="groups" options={{ href: null }} />
        <Tabs.Screen name="admin" options={{ href: null }} />
      </Tabs>
      <ContextPill />
    </View>
  )
}

export default function AppLayout() {
  return (
    <GroupContextProvider>
      <AppLayoutInner />
    </GroupContextProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  contextPill: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    paddingVertical: 4,
  },
  contextPillText: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.12 * 10,
  },
})
