import { View, Text, StyleSheet } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeOut,
} from 'react-native-reanimated'
import { useEffect, useState } from 'react'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

type PendingInfo = {
  groupName: string
  organizerDisplayName: string
  memberCount: number
}

type MyStatus = {
  role: 'pending_member' | 'member' | 'organizer' | null
}

export default function PendingScreen() {
  const { t } = useTranslation()
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const router = useRouter()
  const [showWelcome, setShowWelcome] = useState(false)
  const [rejected, setRejected] = useState(false)

  const shimmerX = useSharedValue(-300)

  useEffect(() => {
    shimmerX.value = withRepeat(
      withSequence(
        withDelay(3000, withTiming(300, { duration: 1000, easing: Easing.linear })),
        withTiming(-300, { duration: 0 }),
      ),
      -1,
      false,
    )
  }, [])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }))

  const { data: pendingInfo } = useQuery<PendingInfo>({
    queryKey: ['groups', groupId, 'pending-info'],
    queryFn: async () => {
      const { data } = await httpClient.get(`/v1/groups/${groupId}/pending-info`)
      return data.data as PendingInfo
    },
    enabled: Boolean(groupId),
  })

  const { data: status } = useQuery<MyStatus>({
    queryKey: ['groups', groupId, 'my-status'],
    queryFn: async () => {
      const { data } = await httpClient.get(`/v1/groups/${groupId}/my-status`)
      return data.data as MyStatus
    },
    refetchInterval: 10000,
    enabled: Boolean(groupId) && !showWelcome && !rejected,
  })

  useEffect(() => {
    if (!status) return
    if (status.role === 'member' || status.role === 'organizer') {
      setShowWelcome(true)
      const timer = setTimeout(() => {
        router.replace('/(group)/initial-rating')
      }, 2000)
      return () => clearTimeout(timer)
    } else if (status.role === null) {
      setRejected(true)
    }
  }, [status?.role])

  if (showWelcome) {
    return (
      <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
        <Text style={[styles.welcomeText, styles.bebasText]}>
          {t('groups.pending.welcome', { groupName: pendingInfo?.groupName ?? '' })}
        </Text>
      </Animated.View>
    )
  }

  if (rejected) {
    return (
      <View style={styles.container}>
        <Text style={styles.rejectedText}>{t('groups.pending.rejected')}</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ animation: 'none', headerShown: false }} />
      <View style={styles.container}>
        <Text style={[styles.groupName, styles.bebasText]}>
          {pendingInfo?.groupName ?? ''}
        </Text>

        <Text style={styles.waitMessage}>
          {t('groups.pending.waitMessage', {
            organizer: pendingInfo?.organizerDisplayName ?? '',
          })}
        </Text>

        <View style={styles.frostedContainer}>
          <BlurView intensity={80} tint="dark" style={styles.frostedPanel}>
            <Animated.View style={[styles.shimmerBar, shimmerStyle]} />
            <Text style={styles.memberCount}>{pendingInfo?.memberCount ?? '—'}</Text>
            <Text style={styles.memberLabel}>{t('groups.pending.members')}</Text>
          </BlurView>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 24,
  },
  groupName: {
    color: Colors.ink,
    fontSize: 48,
    textAlign: 'center',
  },
  bebasText: {
    fontFamily: 'BebasNeue_400Regular',
  },
  waitMessage: {
    color: Colors.inkSecondary,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  frostedContainer: {
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 16,
  },
  frostedPanel: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: 'center',
    minWidth: 160,
    overflow: 'hidden',
  },
  shimmerBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  memberCount: {
    color: Colors.ink,
    fontSize: 40,
    fontWeight: '700',
  },
  memberLabel: {
    color: Colors.inkSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  welcomeText: {
    color: Colors.ink,
    fontSize: 32,
    textAlign: 'center',
  },
  rejectedText: {
    color: Colors.inkSecondary,
    fontSize: 17,
    textAlign: 'center',
  },
})
