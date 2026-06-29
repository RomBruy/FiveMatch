import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '../../constants/colors'
import { useGroupContext } from '../../contexts/GroupContext'
import { PaniniCard } from '../../components/cards/PaniniCard'
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

function CardSkeleton() {
  return (
    <View style={styles.cardSkeletonWrapper}>
      <View style={styles.cardSkeleton} />
    </View>
  )
}

export default function PlayersTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const { activeGroupId } = useGroupContext()
  const { userId: clerkUserId } = useAuth()

  const { data: playersData, isLoading: playersLoading, isError: playersError } = useQuery({
    queryKey: ['players', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { items: PlayerSummary[] } }>(`/v1/groups/${activeGroupId}/players`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

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
        <Pressable style={styles.button} onPress={() => router.push('/(app)/groups/new' as never)}>
          <Text style={styles.buttonText}>{t('auth.shell.createGroup')}</Text>
        </Pressable>
      </View>
    )
  }

  if (playersLoading) {
    return (
      <View style={styles.container}>
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <CardSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
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
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={players}
        keyExtractor={(p) => p.playerId}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        renderItem={({ item }) => (
          <PaniniCard
            player={item}
            groupName={groupData?.name}
            groupTier={groupData?.tier}
            isMvp={item.isMvp}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    color: Colors.ink,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCards: {
    color: Colors.inkDisabled,
    fontSize: 24,
    fontFamily: 'BebasNeue_400Regular',
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
  },
  buttonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  cardSkeletonWrapper: {
    marginHorizontal: 8,
  },
  cardSkeleton: {
    width: 252,
    height: 398,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    opacity: 0.4,
  },
})
