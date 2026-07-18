import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import * as Haptics from 'expo-haptics'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { GroupSwitcher } from '../../components/GroupSwitcher'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { DuotoneAvatar, getInitials } from '../../components/ui/DuotoneAvatar'
import { FormDots, type FormResult } from '../../components/ui/FormDots'
import { TextureType } from '../../components/ui/TextureType'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { MvpCeremonyCard } from '../../components/match/MvpCeremonyCard'
import { NextMatchHero } from '../../components/match/NextMatchHero'
import { Chip } from '../../components/ui/Chip'
import { StoryShareGraphic, STORY_EXPORT_WIDTH, STORY_EXPORT_HEIGHT } from '../../components/share/StoryShareGraphic'
import { useGroupContext } from '../../contexts/GroupContext'
import { httpClient } from '../../lib/api-client'

interface MatchHistoryItem {
  matchId: string
  scheduledAt: string
  completedAt: string
  scoreA: number | null
  scoreB: number | null
  mvpPlayerId: string | null
  mvpDisplayName: string | null
  userTeamSide: 'A' | 'B' | null
  userResult: 'win' | 'loss' | 'draw' | null
}

interface MatchParticipant {
  playerId: string | null
  goalsScored: number | null
  assists: number | null
}

interface ActiveMatchSummary {
  matchId: string
  status: string
  scheduledAt: string
  location: string | null
  format: string
  playersPerTeam: number
}

interface AttendanceRow {
  playerId: string | null
  displayName: string | null
  status: 'in' | 'out' | 'unknown'
}

interface WaitlistRow {
  playerId: string | null
  displayName: string | null
  waitlistPosition: number | null
}

interface AttendancesData {
  confirmed: AttendanceRow[]
  waitlist: WaitlistRow[]
  myPlayerId: string | null
}

interface RosterMember {
  userId: string
  displayName: string | null
  role: string
}

const STAR_SYMBOL = '★'

const RESULT_TO_DOT: Record<NonNullable<MatchHistoryItem['userResult']>, FormResult> = {
  win: 'W',
  draw: 'D',
  loss: 'L',
}

export default function AccueilTab() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { activeGroupId, isReady: groupContextReady } = useGroupContext()
  const [switcherVisible, setSwitcherVisible] = useState(false)

  // Same key/shape as the app shell's ContextPill query — served from cache, no new endpoint.
  const { data: group } = useQuery({
    queryKey: ['groups', activeGroupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { name: string; tier: string } }>(`/v1/groups/${activeGroupId}`)
      return data.data
    },
    enabled: !!activeGroupId,
  })

  // Shared keys with the Match tab / roster screen — served from cache when warm.
  const { data: myStatusData } = useQuery({
    queryKey: ['groups', activeGroupId, 'my-status'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { role: string } }>(`/v1/groups/${activeGroupId}/my-status`)
      return data.data
    },
    enabled: !!activeGroupId,
  })
  const isOrganizer = myStatusData?.role === 'organizer'

  // Shared with the Match tab — soonest upcoming match feeds the hero.
  const { data: upcomingData } = useQuery({
    queryKey: ['matches', activeGroupId, 'upcoming'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { matches: ActiveMatchSummary[] } }>(
        `/v1/groups/${activeGroupId}/matches?status=upcoming&limit=10`,
      )
      return data.data
    },
    enabled: !!activeGroupId,
    retry: false,
  })
  const activeMatch = upcomingData?.matches[0] ?? null

  const attendancesKey = ['attendances', activeMatch?.matchId]
  const { data: attendances } = useQuery({
    queryKey: attendancesKey,
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: AttendancesData }>(
        `/v1/groups/${activeGroupId}/matches/${activeMatch!.matchId}/attendances`,
      )
      return data.data
    },
    enabled: !!activeGroupId && !!activeMatch,
  })

  const { data: rosterData } = useQuery({
    queryKey: ['groups', activeGroupId, 'roster'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: RosterMember[] } }>(
        `/v1/groups/${activeGroupId}/roster`,
      )
      return data.data
    },
    enabled: !!activeGroupId,
  })

  const { mutate: updateAttendance } = useMutation({
    mutationFn: (newStatus: 'in' | 'out') =>
      httpClient.patch(`/v1/groups/${activeGroupId}/matches/${activeMatch!.matchId}/attendance`, {
        status: newStatus,
      }),
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: attendancesKey })
      const previous = queryClient.getQueryData<AttendancesData>(attendancesKey)
      queryClient.setQueryData<AttendancesData>(attendancesKey, (old) => {
        if (!old || !old.myPlayerId) return old
        return {
          ...old,
          confirmed: old.confirmed.map((row) =>
            row.playerId === old.myPlayerId ? { ...row, status: newStatus } : row,
          ),
        }
      })
      return { previous }
    },
    onError: (_error, _newStatus, context) => {
      if (context?.previous) {
        queryClient.setQueryData(attendancesKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attendancesKey })
    },
  })

  const { data: historyData } = useQuery({
    queryKey: ['match-history', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { matches: MatchHistoryItem[] } }>(`/v1/groups/${activeGroupId}/matches?status=completed&limit=10`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  const matches = historyData?.matches ?? []
  const [lastMatch, ...olderMatches] = matches

  // Story share data — existing endpoints under existing query keys only.
  const { data: lastMatchDetail } = useQuery({
    queryKey: ['match', activeGroupId, lastMatch?.matchId],
    queryFn: () =>
      httpClient
        .get<{ data: { participants?: MatchParticipant[] } }>(
          `/v1/groups/${activeGroupId}/matches/${lastMatch!.matchId}`
        )
        .then((r) => r.data.data),
    enabled: !!activeGroupId && !!lastMatch,
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { players: { playerId: string; ovrScore: number | null }[] } }>(
          `/v1/groups/${activeGroupId}/leaderboard`
        )
        .then((r) => r.data.data),
    enabled: !!activeGroupId && !!lastMatch?.mvpPlayerId,
  })

  const mvpParticipant = lastMatchDetail?.participants?.find(
    (p) => lastMatch?.mvpPlayerId && p.playerId === lastMatch.mvpPlayerId
  )
  const mvpOvr = leaderboard?.players.find(
    (p) => lastMatch?.mvpPlayerId && p.playerId === lastMatch.mvpPlayerId
  )?.ovrScore

  const storyRef = useRef<View>(null)
  const [isSharingStory, setIsSharingStory] = useState(false)

  const handleShareStory = async () => {
    if (!storyRef.current || isSharingStory) return
    setIsSharingStory(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    try {
      // Story export spec: exactly 1080×1920 — view-shot resizes the off-screen frame.
      const uri = await captureRef(storyRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1920,
      })
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('share.story.share'),
      })
    } catch {
      // Sharing cancelled by user — not an error
    } finally {
      setIsSharingStory(false)
    }
  }

  const formatRowDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }).toUpperCase()

  const formatStoryDate = (iso: string) =>
    new Date(iso)
      .toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
      .toUpperCase()

  const openMatch = (matchId: string) => router.push(`/(app)/match/${matchId}` as never)

  const openActiveMatch = () => {
    if (!activeMatch) return
    const dest = isOrganizer
      ? `/(app)/match/organizer?matchId=${activeMatch.matchId}`
      : `/(app)/match/player?matchId=${activeMatch.matchId}`
    router.push(dest as never)
  }

  const confirmedPlayers = attendances?.confirmed.filter((row) => row.status === 'in') ?? []
  const myRow = attendances?.myPlayerId
    ? attendances.confirmed.find((row) => row.playerId === attendances.myPlayerId)
    : undefined
  const myWaitlistRow = attendances?.myPlayerId
    ? attendances.waitlist.find((row) => row.playerId === attendances.myPlayerId)
    : undefined
  const squadTotal = rosterData?.items.length ?? attendances?.confirmed.length ?? 0
  const attendanceOpen = activeMatch?.status === 'attendance_open'

  return (
    <View style={styles.container}>
      {/* The screen's ONE texture element: crest-initials outline watermark (R9 mapping). */}
      {group && (
        <TextureType lines={[{ text: getInitials(group.name) }]} fontSize={200} style={styles.crestTexture} />
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        {activeGroupId && group && (
          <Pressable
            style={styles.header}
            onPress={() => setSwitcherVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('accueil.header.switchGroup')}
          >
            <DuotoneAvatar displayName={group.name} size={42} />
            <View style={styles.headerText}>
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <View style={styles.tierPill}>
                <Text style={styles.tierPillText}>{t(`groups.home.tier.${group.tier}`)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={18} color={Colors.inkSecondary} />
          </Pressable>
        )}

        {groupContextReady && !activeGroupId && (
          <View style={styles.noGroup}>
            <Text style={styles.noGroupTitle}>{t('auth.shell.noGroupTitle')}<Text style={styles.titleAccent}>.</Text></Text>
            <Text style={styles.noGroupText}>{t('auth.shell.noGroup')}</Text>
            <View style={styles.noGroupActions}>
              {/* The tab dock owns this screen's one glow. */}
              <PrimaryButton label={t('auth.shell.createGroup')} glow={false} onPress={() => router.push('/(app)/groups/new')} />
              <SecondaryButton label={t('groups.search.title')} onPress={() => router.push('/(app)/groups/search')} />
              <SecondaryButton label={t('groups.switcher.title')} onPress={() => setSwitcherVisible(true)} />
            </View>
          </View>
        )}

        {activeGroupId && activeMatch && (
          <View style={styles.heroSection}>
            <NextMatchHero
              scheduledAt={activeMatch.scheduledAt}
              location={activeMatch.location}
              confirmed={confirmedPlayers}
              squadTotal={squadTotal}
              myStatus={myRow?.status ?? 'unknown'}
              isWaitlisted={!!myWaitlistRow}
              waitlistPosition={myWaitlistRow?.waitlistPosition ?? undefined}
              onSetAttendance={attendanceOpen ? (status) => updateAttendance(status) : undefined}
              onPress={openActiveMatch}
            />
          </View>
        )}

        {activeGroupId && rosterData && rosterData.items.length > 0 && (
          <View style={styles.squadSection}>
            <Text style={styles.sectionLabel}>{t('accueil.squad.title')}</Text>
            <View style={styles.squadCard}>
              <View style={styles.squadStack}>
                {rosterData.items.slice(0, 5).map((member, index) => (
                  <View key={member.userId} style={index > 0 && styles.squadOverlap}>
                    <DuotoneAvatar displayName={member.displayName ?? '?'} size={32} />
                  </View>
                ))}
              </View>
              <Text style={styles.squadCount}>
                {t('accueil.squad.members', { count: rosterData.items.length })}
              </Text>
              {isOrganizer && (
                <Chip
                  label={t('accueil.squad.invite')}
                  variant="outlined"
                  onPress={() => router.push(`/(app)/groups/${activeGroupId}/settings` as never)}
                />
              )}
            </View>
          </View>
        )}

        {activeGroupId && (
          <View style={styles.historySection}>
            <Text style={styles.sectionLabel}>{t('accueil.history.title')}</Text>
            {!lastMatch ? (
              <View style={styles.historyEmptyBlock}>
                <Text style={styles.historyEmpty}>{t('accueil.history.empty')}</Text>
                {!activeMatch && isOrganizer && (
                  <SecondaryButton
                    label={t('accueil.history.cta')}
                    onPress={() => router.push('/(app)/match/create' as never)}
                  />
                )}
              </View>
            ) : (
              <>
                <MvpCeremonyCard
                  scoreA={lastMatch.scoreA}
                  scoreB={lastMatch.scoreB}
                  mvpDisplayName={lastMatch.mvpDisplayName}
                  scheduledAt={lastMatch.scheduledAt}
                  onPress={() => openMatch(lastMatch.matchId)}
                  watermark={false}
                  onShare={handleShareStory}
                />
                <View style={styles.rows}>
                  {olderMatches.map((match) => (
                    <Pressable key={match.matchId} style={styles.matchRow} onPress={() => openMatch(match.matchId)}>
                      <Text style={styles.rowDate}>{formatRowDate(match.scheduledAt)}</Text>
                      <View style={styles.rowMvp}>
                        {match.mvpDisplayName && (
                          <>
                            <DuotoneAvatar displayName={match.mvpDisplayName} size={24} />
                            <Text style={styles.rowMvpName} numberOfLines={1}>
                              {`${STAR_SYMBOL} ${match.mvpDisplayName}`}
                            </Text>
                          </>
                        )}
                      </View>
                      <Text style={styles.rowScore}>
                        {match.scoreA !== null && match.scoreB !== null ? `${match.scoreA}–${match.scoreB}` : '—'}
                      </Text>
                      <View style={styles.rowDot}>
                        {match.userResult && <FormDots results={[RESULT_TO_DOT[match.userResult]]} size={24} />}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Off-screen 9:16 story frame — the share capture target */}
      {lastMatch && group && (
        <View ref={storyRef} collapsable={false} style={styles.storyOffscreen} pointerEvents="none">
          <StoryShareGraphic
            groupName={group.name}
            dateLabel={formatStoryDate(lastMatch.scheduledAt)}
            scoreA={lastMatch.scoreA}
            scoreB={lastMatch.scoreB}
            mvpDisplayName={lastMatch.mvpDisplayName}
            goals={mvpParticipant?.goalsScored}
            assists={mvpParticipant?.assists}
            ovrScore={mvpOvr}
          />
        </View>
      )}

      <GroupSwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
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
    top: 30,
    right: -70,
  },
  storyOffscreen: {
    position: 'absolute',
    left: -STORY_EXPORT_WIDTH * 30,
    top: 0,
    width: STORY_EXPORT_WIDTH,
    height: STORY_EXPORT_HEIGHT,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupName: {
    flexShrink: 1,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.92, // 0.08em @ 24 (heading register)
    color: Colors.ink,
  },
  tierPill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierPillText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  noGroup: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  noGroupTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 40,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  titleAccent: {
    color: Colors.primary,
  },
  noGroupText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 32,
  },
  noGroupActions: {
    gap: 12,
  },
  heroSection: {
    marginTop: 20,
  },
  squadSection: {
    marginTop: 26,
  },
  squadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  squadStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  squadOverlap: {
    marginLeft: -8,
  },
  squadCount: {
    flex: 1,
    color: Colors.inkSecondary,
    fontSize: 12.5,
    fontFamily: Fonts.interSemiBold,
  },
  historySection: {
    marginTop: 28,
  },
  historyEmptyBlock: {
    gap: 14,
    paddingVertical: 6,
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  historyEmpty: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    textAlign: 'center',
    paddingVertical: 16,
  },
  rows: {
    marginTop: 12,
    gap: 8,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDate: {
    width: 64,
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.4,
  },
  rowMvp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowMvpName: {
    flexShrink: 1,
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
  },
  rowScore: {
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.44, // 0.06em @ 24
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rowDot: {
    width: 24,
    alignItems: 'center',
  },
})
