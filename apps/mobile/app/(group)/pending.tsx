import { View, Text, StyleSheet } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Animated, { FadeOut } from 'react-native-reanimated'
import { useEffect, useState } from 'react'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/tokens'
import { DuotoneAvatar } from '../../components/ui/DuotoneAvatar'
import { InfoStrip } from '../../components/shared/InfoStrip'
import { httpClient } from '../../lib/api-client'

const SEPARATOR = ' · '

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
        router.replace('/(app)')
      }, 2000)
      return () => clearTimeout(timer)
    } else if (status.role === null) {
      setRejected(true)
    }
  }, [status?.role])

  if (showWelcome) {
    return (
      <Animated.View style={styles.container} exiting={FadeOut.duration(500)}>
        <Text style={styles.welcomeText}>
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

  const subLine = pendingInfo
    ? `${pendingInfo.groupName}${SEPARATOR}${pendingInfo.memberCount} ${t('groups.pending.members')}`
    : ''

  return (
    <>
      {/* UX-DR24: no entry transition on this screen. */}
      <Stack.Screen options={{ animation: 'none', headerShown: false }} />
      <View style={styles.container}>
        <DuotoneAvatar displayName={pendingInfo?.groupName ?? ''} size={84} />

        <Text style={styles.title}>{t('groups.pending.title')}</Text>

        {subLine.length > 0 && <Text style={styles.subLine}>{subLine}</Text>}

        {/* The pulsing dot is this screen's only motion ("demande envoyée" state). */}
        <View style={styles.stripWrap}>
          <InfoStrip
            variant="warning"
            pulsing
            message={t('groups.pending.waitMessage', {
              organizer: pendingInfo?.organizerDisplayName ?? '',
            })}
          />
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
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 1.6, // 0.04em @ 40 (display register)
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 22,
  },
  subLine: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.interMedium,
    textAlign: 'center',
    marginTop: 10,
  },
  stripWrap: {
    alignSelf: 'stretch',
    marginTop: 26,
  },
  welcomeText: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 32,
    letterSpacing: 1.28, // 0.04em @ 32
    textAlign: 'center',
  },
  rejectedText: {
    color: Colors.inkSecondary,
    fontSize: 17,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
})
