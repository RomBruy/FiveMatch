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
import { httpClient } from '../../../lib/api-client'
import type { PublicPlayerProfile } from '@fivematch/types'

export default function PlayerProfileScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { playerId } = useLocalSearchParams<{ playerId: string }>()

  const { data: player, isLoading, isError } = useQuery({
    queryKey: ['player-profile', playerId],
    queryFn: () =>
      httpClient
        .get<{ data: PublicPlayerProfile }>(`/v1/players/${playerId}`)
        .then((response) => response.data.data),
    enabled: Boolean(playerId),
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
            player={{
              ...player,
              cardState: player.cardState as 'not_started' | 'in_progress_1' | 'in_progress_2' | 'in_progress_3' | 'unlocked',
              matchCount: player.eligibleMatchCount,
              attributes: player.ratingAggregate?.attributes ?? null,
            }}
            photoUrl={player.generatedCardPhotoUrl ?? player.photoUrl}
            isMvp={player.isMvp ?? false}
            width={cardWidth}
          />
          <ProfileStorySections
            tightestMatch={null}
            personality={player.personality ? {
              specialSkill: player.personality.specialSkill ?? null,
              favoriteExcuse: player.personality.favoriteExcuse ?? null,
              badFaithLevel: player.personality.badFaithLevel ?? null,
              lockerRoomStyle: player.personality.lockerRoomStyle ?? null,
              thirdHalfProfile: player.personality.thirdHalfProfile ?? null,
            } satisfies ProfilePersonality : null}
          />
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
