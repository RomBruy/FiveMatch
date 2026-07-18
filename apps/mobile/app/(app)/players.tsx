import { View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { useGroupContext } from '../../contexts/GroupContext'
import { PaniniCard } from '../../components/cards/PaniniCard'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { httpClient } from '../../lib/api-client'
import { usePreviousValue } from '../../hooks/use-previous-value'

interface PlayerSummary {
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
  isMvp?: boolean
}

interface GroupData {
  name: string
  tier: string
}

const GRID_PADDING = 16
const GRID_GAP = 14

function CardSkeleton({ width }: { width: number }) {
  return <View style={[styles.cardSkeleton, { width }]} />
}

export default function PlayersTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { activeGroupId } = useGroupContext()
  const { userId: clerkUserId } = useAuth()

  // Two-column grid of minis — earned cards are bone, locked slots stay dark.
  const cellWidth = (windowWidth - GRID_PADDING * 2 - GRID_GAP) / 2

  const { data: playersData, isLoading: playersLoading, isError: playersError } = useQuery({
    queryKey: ['players', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { items: PlayerSummary[] } }>(`/v1/groups/${activeGroupId}/players`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  // Shared key with roster/settings — served from cache when warm.
  const { data: myStatusData } = useQuery({
    queryKey: ['groups', activeGroupId, 'my-status'],
    queryFn: () =>
      httpClient
        .get<{ data: { role: string } }>(`/v1/groups/${activeGroupId}/my-status`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })
  const isOrganizer = myStatusData?.role === 'organizer'

  const { data: groupData } = useQuery({
    queryKey: ['group', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: GroupData }>(`/v1/groups/${activeGroupId}`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  // auth/me exposes users.id; players list exposes players.id — different UUIDs.
  // TODO (Story 5.4): expose userId on player list so we can match "my player".
  // Until then this query is in place but myPlayer will be undefined, so the
  // auto-navigate below never fires. Notification deep-link (Task 9) covers the AC.
  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () =>
      httpClient
        .get<{ data: { name: string | null; userId: string } }>('/v1/auth/me')
        .then((r) => r.data.data),
    enabled: !!clerkUserId,
  })

  const myPlayer = playersData?.items.find(
    (p) => meData?.userId && p.playerId === meData.userId
  )
  const prevCardState = usePreviousValue(myPlayer?.cardState)
  const justUnlocked = useRef(false)

  useEffect(() => {
    if (
      prevCardState !== undefined &&
      prevCardState !== 'unlocked' &&
      myPlayer?.cardState === 'unlocked' &&
      activeGroupId &&
      myPlayer.playerId &&
      !justUnlocked.current
    ) {
      justUnlocked.current = true
      const revealKey = `card_reveal_seen_${activeGroupId}_${myPlayer.playerId}`
      AsyncStorage.getItem(revealKey).then((seen) => {
        if (!seen) {
          router.push(
            `/(app)/groups/${activeGroupId}/card-reveal?playerId=${myPlayer.playerId}` as never
          )
        }
      }).catch(() => {})
    }
  }, [myPlayer?.cardState, prevCardState])

  if (!activeGroupId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.message}>{t('auth.shell.noGroup')}</Text>
        {/* The tab dock owns this screen's one glow. */}
        <PrimaryButton
          label={t('auth.shell.createGroup')}
          glow={false}
          onPress={() => router.push('/(app)/groups/new' as never)}
        />
      </View>
    )
  }

  const header = (
    <Text style={[styles.title, { paddingTop: insets.top + 12 }]}>{t('auth.shell.tabPlayers')}</Text>
  )

  if (playersLoading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.skeletonGrid}>
          <CardSkeleton width={cellWidth} />
          <CardSkeleton width={cellWidth} />
        </View>
      </View>
    )
  }

  if (playersError) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.message}>{t('common.loadError')}</Text>
      </View>
    )
  }

  const players = playersData?.items ?? []

  if (players.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyCards}>{t('card.empty.noCards')}</Text>
        <Text style={styles.emptyBody}>{t('card.empty.body')}</Text>
        {isOrganizer && activeGroupId && (
          <SecondaryButton
            label={t('card.empty.cta')}
            onPress={() => router.push(`/(app)/groups/${activeGroupId}/settings` as never)}
          />
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={players}
        keyExtractor={(p) => p.playerId}
        numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/player/${item.playerId}` as never)}
            accessibilityRole="button"
            accessibilityLabel={t('profile.openPlayer', { name: item.displayName })}
          >
            <PaniniCard
              player={item}
              groupName={groupData?.name}
              groupTier={groupData?.tier}
              isMvp={item.isMvp}
              variant="mini"
              width={cellWidth}
              serialTotal={players.length}
            />
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  message: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  emptyCards: {
    color: Colors.inkDisabled,
    fontSize: 24,
    fontFamily: Type.heading.fontFamily,
    letterSpacing: Type.heading.letterSpacing,
    textAlign: 'center',
  },
  emptyBody: {
    color: Colors.inkSecondary,
    fontSize: 14.5,
    fontFamily: Fonts.inter,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: -8,
  },
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 40,
    letterSpacing: 1.8, // 0.045em @ 40 (display register)
    paddingHorizontal: GRID_PADDING,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: DOCK_CLEARANCE,
  },
  gridRow: {
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  skeletonGrid: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  cardSkeleton: {
    height: 210,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    opacity: 0.4,
  },
})
