import { View, Text, StyleSheet, RefreshControl } from 'react-native'
import Animated from 'react-native-reanimated'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { DuotoneAvatar, getInitials } from '../../../components/ui/DuotoneAvatar'
import { FormDots, type FormResult } from '../../../components/ui/FormDots'
import { StatTile } from '../../../components/ui/StatTile'
import { Skeleton, SkeletonTile } from '../../../components/ui/Skeleton'
import { CollapsingHeader, CollapsingHeaderTitle, useCollapsingHeader } from '../../../components/ui/CollapsingHeader'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { TextureType } from '../../../components/ui/TextureType'
import { OvrBadge } from '../../../components/players/OvrBadge'
import { ProgressBarPill } from '../../../components/shared/ProgressBarPill'
import { ProfileStorySections, type ProfilePersonality } from '../../../components/players/ProfileStorySections'
import { useGroupContext } from '../../../contexts/GroupContext'
import { httpClient } from '../../../lib/api-client'

interface LeaderboardPlayer {
  rank: number | null
  playerId: string
  displayName: string
  cardState: string
  matchCount: number
  ovrScore: number | null
  totalGoals: number
}

interface MatchHistoryItem {
  matchId: string
  scheduledAt: string
  scoreA: number | null
  scoreB: number | null
  userResult: 'win' | 'loss' | 'draw' | null
}

const RESULT_TO_DOT: Record<NonNullable<MatchHistoryItem['userResult']>, FormResult> = {
  win: 'W',
  draw: 'D',
  loss: 'L',
}

function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await httpClient.get<{
        data: {
          name: string | null
          userId: string
          email: string
          profilePhotoUrl: string | null
          currentClub: string | null
          formerClub: string | null
          preferredPosition: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'utility' | null
          strongFoot: 'left' | 'right' | 'both' | null
          playerStyle: 'playmaker' | 'finisher' | 'engine' | 'wall' | 'wildcard' | null
          specialSkill: string | null
          favoriteExcuse: string | null
          badFaithLevel: number | null
          lockerRoomStyle: string | null
          thirdHalfProfile: string | null
          isAdmin: boolean
        }
      }>('/v1/auth/me')
      return data.data
    },
  })
}

export default function ProfileTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { activeGroupId } = useGroupContext()
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const [refreshing, setRefreshing] = useState(false)
  const { scrollY, scrollHandler } = useCollapsingHeader()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['auth', 'me'] }),
        queryClient.refetchQueries({ queryKey: ['groups', activeGroupId] }),
        queryClient.refetchQueries({ queryKey: ['leaderboard', activeGroupId] }),
        queryClient.refetchQueries({ queryKey: ['pronos', 'leaderboard', activeGroupId] }),
        queryClient.refetchQueries({ queryKey: ['match-history', 'profile', activeGroupId] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, activeGroupId])

  // All group-scoped data below reuses existing endpoints under the query keys
  // other screens already cache — no new API surface (AC 6).
  const { data: group } = useQuery({
    queryKey: ['groups', activeGroupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { name: string; tier: string } }>(`/v1/groups/${activeGroupId}`)
      return data.data
    },
    enabled: !!activeGroupId,
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { players: LeaderboardPlayer[] } }>(`/v1/groups/${activeGroupId}/leaderboard`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  // The leaderboard payload has no userId; the pronos leaderboard is the one
  // group-scoped endpoint that resolves the caller's playerId.
  const { data: pronosData } = useQuery({
    queryKey: ['pronos', 'leaderboard', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { myPlayerId: string | null } }>(`/v1/groups/${activeGroupId}/pronos/leaderboard`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  const { data: historyData } = useQuery({
    queryKey: ['match-history', 'profile', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { matches: MatchHistoryItem[] } }>(`/v1/groups/${activeGroupId}/matches?status=completed&limit=50`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  const myPlayer = leaderboard?.players.find(
    (p) => pronosData?.myPlayerId && p.playerId === pronosData.myPlayerId
  )

  // Recent form: 5 most recent results, oldest → newest left to right.
  const recentForm: FormResult[] = (historyData?.matches ?? [])
    .filter((m) => m.userResult !== null)
    .slice(0, 5)
    .reverse()
    .map((m) => RESULT_TO_DOT[m.userResult!])

  const displayName = user?.name ?? ''
  const isUnlocked = myPlayer?.cardState === 'unlocked' && myPlayer.ovrScore !== null
  const tightestMatch = (historyData?.matches ?? []).reduce<MatchHistoryItem | null>((tightest, match) => {
    if (match.userResult === null || match.scoreA === null || match.scoreB === null) return tightest
    if (tightest === null || tightest.scoreA === null || tightest.scoreB === null) return match
    const margin = Math.abs(match.scoreA - match.scoreB)
    const tightestMargin = Math.abs(tightest.scoreA - tightest.scoreB)
    return margin < tightestMargin ? match : tightest
  }, null)
  const personality: ProfilePersonality | null = user ? {
    specialSkill: user.specialSkill,
    favoriteExcuse: user.favoriteExcuse,
    badFaithLevel: user.badFaithLevel,
    lockerRoomStyle: user.lockerRoomStyle,
    thirdHalfProfile: user.thirdHalfProfile,
  } : null

  return (
    <View style={styles.container}>
      {/* The screen's ONE texture element: crest-initials outline watermark (R9 mapping). */}
      {group && (
        <TextureType lines={[{ text: getInitials(group.name) }]} fontSize={200} style={styles.crestTexture} />
      )}

      <Animated.ScrollView
        style={styles.scroll}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {userLoading ? (
          <>
            {/* Identity + stat placeholders — the shape the profile fills into */}
            <View style={styles.identity}>
              <Skeleton width={96} height={96} radius={Radius.full} />
              <View style={styles.identityText}>
                <Skeleton width="70%" height={30} />
                <Skeleton width="50%" height={12} style={styles.identitySkeletonMeta} />
              </View>
            </View>
            <View style={styles.statBand}>
              <View style={styles.ovrBlock}>
                <Skeleton width={72} height={54} radius={Radius.sm} />
              </View>
              <View style={styles.tiles}>
                <SkeletonTile />
                <SkeletonTile />
              </View>
            </View>
          </>
        ) : (
          /* Identity header */
          <View style={styles.identity}>
            <DuotoneAvatar displayName={displayName} photoUrl={user?.profilePhotoUrl} size={96} />
            <View style={styles.identityText}>
              <CollapsingHeaderTitle
                title={displayName}
                scrollY={scrollY}
                subtitle={group ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {t(`groups.home.tier.${group.tier}`).toUpperCase()} · {group.name.toUpperCase()}
                  </Text>
                ) : undefined}
              />
              {recentForm.length > 0 && (
                <View style={styles.formRow}>
                  <FormDots results={recentForm} size={24} />
                </View>
              )}
            </View>
          </View>
        )}

        {user?.playerStyle && (
          <View style={styles.footballIdentity}>
            <Text style={styles.sectionLabel}>{t('profile.footballIdentity').toUpperCase()}</Text>
            <View style={styles.playerStyleBanner}>
              <Text style={styles.playerStyleName}>
                {t(`auth.profileCompletion.style.${user.playerStyle}.name`)}
              </Text>
              <Text style={styles.playerStyleDescription}>
                {t(`auth.profileCompletion.style.${user.playerStyle}.description`)}
              </Text>
            </View>
            <View style={styles.identityGrid}>
              {user.currentClub && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>{user.currentClub}</Text>
                  <Text style={styles.identityLabel}>{t('profile.currentClub')}</Text>
                </View>
              )}
              {user.formerClub && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>{user.formerClub}</Text>
                  <Text style={styles.identityLabel}>{t('profile.formerClub')}</Text>
                </View>
              )}
              {user.preferredPosition && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>
                    {t(`auth.profileCompletion.position.${user.preferredPosition}`)}
                  </Text>
                  <Text style={styles.identityLabel}>{t('profile.position')}</Text>
                </View>
              )}
              {user.strongFoot && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>
                    {t(`auth.profileCompletion.foot.${user.strongFoot}`)}
                  </Text>
                  <Text style={styles.identityLabel}>{t('profile.strongFoot')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* OVR + stat tiles — whatever the current payload exposes (Matchs, Buts; no MVP count in any payload) */}
        {myPlayer && (
          <View style={styles.statBand}>
            <View style={styles.ovrBlock}>
              <Text style={styles.ovrLabel}>{t('profile.stats.ovr').toUpperCase()}</Text>
              {isUnlocked ? (
                // Unlocked hero OVR is gold per Story 2.3 — the screen's single gold.
                <OvrBadge ovrScore={myPlayer.ovrScore} cardState={myPlayer.cardState} size="hero" />
              ) : (
                // 4-match gate: locked speaks the progress language, never a number.
                <ProgressBarPill matchCount={myPlayer.matchCount} cardState={myPlayer.cardState} />
              )}
            </View>
            <View style={styles.tiles}>
              <StatTile value={myPlayer.matchCount} label={t('profile.stats.matches')} />
              <StatTile value={myPlayer.totalGoals} label={t('profile.stats.goals')} />
            </View>
          </View>
        )}

        <ProfileStorySections
          tightestMatch={tightestMatch && tightestMatch.scoreA !== null && tightestMatch.scoreB !== null ? {
            scheduledAt: tightestMatch.scheduledAt,
            scoreA: tightestMatch.scoreA,
            scoreB: tightestMatch.scoreB,
          } : null}
          personality={personality}
        />

        {/* Actions — ghost pills */}
        <View style={styles.actions}>
          <SecondaryButton
            label={t('profile.edit')}
            onPress={() => router.push('/(auth)/profile-completion' as never)}
          />
          {user?.isAdmin && (
            <SecondaryButton
              label={t('admin.metrics.navButton')}
              onPress={() => router.push('/(app)/admin' as never)}
            />
          )}
        </View>
      </Animated.ScrollView>
      {!userLoading && (
        <CollapsingHeader
          title={displayName}
          scrollY={scrollY}
          compactLeading={<DuotoneAvatar displayName={displayName} photoUrl={user?.profilePhotoUrl} size={30} />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  crestTexture: {
    top: 26,
    right: -70,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  identityText: { flex: 1, gap: 4 },
  meta: {
    color: Colors.inkSecondary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
  },
  formRow: { marginTop: 6 },
  identitySkeletonMeta: { marginTop: 10 },
  footballIdentity: { marginTop: 28 },
  sectionLabel: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  playerStyleBanner: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.24)',
    padding: 16,
    marginBottom: 10,
  },
  playerStyleName: { color: Colors.primary, fontFamily: Fonts.bebas, fontSize: 24, letterSpacing: 1.4 },
  playerStyleDescription: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, marginTop: 3 },
  identityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  identityTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 14,
  },
  identityValue: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  identityLabel: { color: Colors.inkDisabled, fontFamily: Fonts.inter, fontSize: 11, marginTop: 4 },
  statBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  ovrBlock: {
    minWidth: 96,
    alignItems: 'center',
    gap: 2,
  },
  ovrLabel: {
    color: Colors.inkDisabled,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
  tiles: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
})
