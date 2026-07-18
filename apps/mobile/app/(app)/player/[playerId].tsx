import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { PaniniCard } from '../../../components/cards/PaniniCard'
import { ProfileStorySections, type ProfilePersonality } from '../../../components/players/ProfileStorySections'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { useGroupContext } from '../../../contexts/GroupContext'
import { httpClient } from '../../../lib/api-client'

interface PlayerProfileData {
  playerId: string
  displayName: string
  cardState: 'not_started' | 'in_progress_1' | 'in_progress_2' | 'in_progress_3' | 'unlocked'
  matchCount: number
  ovrScore: number | null
  trend: 'up' | 'down' | 'stable' | null
  attributes: {
    pace: number
    technique: number
    passing: number
    defending: number
    physicality: number
    effort: number
  } | null
  photoUrl: string | null
  isMvp: boolean
  personality: ProfilePersonality
  memory: {
    tightestMatch: {
      scheduledAt: string
      scoreA: number
      scoreB: number
    } | null
  }
}

export default function PlayerProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { playerId } = useLocalSearchParams<{ playerId: string }>()
  const { activeGroupId } = useGroupContext()

  const { data: player, isLoading, isError } = useQuery({
    queryKey: ['player-profile', activeGroupId, playerId],
    queryFn: () =>
      httpClient
        .get<{ data: PlayerProfileData }>(`/v1/groups/${activeGroupId}/players/${playerId}`)
        .then((response) => response.data.data),
    enabled: Boolean(activeGroupId && playerId),
  })
  const { data: group } = useQuery({
    queryKey: ['groups', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { name: string; tier: string } }>(`/v1/groups/${activeGroupId}`)
        .then((response) => response.data.data),
    enabled: Boolean(activeGroupId),
  })

  const cardWidth = Math.min(340, width - 40)

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{player?.displayName ?? t('profile.playerTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('common.loadError')}</Text>
        </View>
      )}

      {player && (
        <ScrollView contentContainerStyle={styles.content}>
          <PaniniCard
            player={player}
            groupName={group?.name}
            groupTier={group?.tier}
            photoUrl={player.photoUrl}
            isMvp={player.isMvp}
            width={cardWidth}
          />
          <ProfileStorySections tightestMatch={player.memory.tightestMatch} personality={player.personality} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { color: Colors.ink, fontFamily: Fonts.inter, fontSize: 34, lineHeight: 36, marginTop: -3 },
  headerTitle: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 22,
    letterSpacing: Type.heading.letterSpacing,
    textAlign: 'center',
  },
  headerSpacer: { width: 44 },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: DOCK_CLEARANCE,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 14, textAlign: 'center' },
})
