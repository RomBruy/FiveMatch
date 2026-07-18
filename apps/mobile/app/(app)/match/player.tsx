import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { useGroupContext } from '../../../contexts/GroupContext'
import { PhaseStepper } from '../../../components/shared/PhaseStepper'
import { AttendanceSwiperRow } from '../../../components/match/AttendanceSwiperRow'
import { AttendanceSegmentedPill } from '../../../components/match/AttendanceSegmentedPill'
import { TextureType } from '../../../components/ui/TextureType'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { CountdownPill } from '../../../components/ui/CountdownPill'
import { DuotoneAvatar } from '../../../components/ui/DuotoneAvatar'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { PronosForm } from '../../../components/match/PronosForm'
import { PronosReveal } from '../../../components/match/PronosReveal'
import { PostMatchRatings } from '../../../components/match/PostMatchRatings'
import { LockedPitchBoard } from '../../../components/match/PitchBoard'

const SEPARATOR = ' · '
const TEXTURE_TEXT = 'MATCH DAY'

interface MatchDetail {
  matchId: string
  status: 'planning' | 'attendance_open' | 'attendance_locked' | 'teams_generated' | 'in_progress' | 'completed' | 'cancelled'
  scheduledAt: string
  completedAt: string | null
  location: string | null
  format: string
  playersPerTeam: number
}

const MVP_WINDOW_MS = 24 * 60 * 60 * 1000

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

type AttendanceStatus = 'in' | 'out' | 'unknown'

interface ParticipantPlayer {
  playerId: string | null
  displayName: string | null
}

interface ParticipantsData {
  myPlayerId: string | null
  myTeamSide: 'A' | 'B' | null
  teamA: ParticipantPlayer[]
  teamB: ParticipantPlayer[]
}

export default function MatchPlayerScreen() {
  const { t, i18n } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { activeGroupId } = useGroupContext()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const { data: match, isLoading: matchLoading } = useQuery({
    queryKey: ['match', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MatchDetail }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId),
  })

  const [selectedNominee, setSelectedNominee] = useState<string | null>(null)
  const [voteSubmitted, setVoteSubmitted] = useState(false)

  const attendancesKey = ['attendances', matchId]

  const { data: attendances, isLoading: attendanceLoading } = useQuery({
    queryKey: attendancesKey,
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: AttendancesData }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}/attendances`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId),
  })

  const { data: participants } = useQuery({
    queryKey: ['participants', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: ParticipantsData }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}/participants`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId) && match?.status === 'completed',
  })

  const { mutate: submitVote, isPending: isVoting } = useMutation({
    mutationFn: (nominatedPlayerId: string) =>
      httpClient.post(`/v1/groups/${activeGroupId}/matches/${matchId}/mvp-votes`, { nominatedPlayerId }),
    onSuccess: () => {
      setVoteSubmitted(true)
      setSelectedNominee(null)
    },
  })

  // Selection feedback only — vote rules and submission stay server-enforced (UX-DR23).
  const selectNominee = (playerId: string | null) => {
    if (!playerId) return
    setSelectedNominee(playerId)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: attendancesKey })
    }, [matchId]),
  )

  const { mutate: updateAttendance } = useMutation({
    mutationFn: (newStatus: AttendanceStatus) =>
      httpClient.patch(`/v1/groups/${activeGroupId}/matches/${matchId}/attendance`, { status: newStatus }),
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: attendancesKey })
      const previous = queryClient.getQueryData<AttendancesData>(attendancesKey)
      queryClient.setQueryData<AttendancesData>(attendancesKey, (old) => {
        if (!old) return old
        const myPlayerId = old.myPlayerId
        const updateRow = (r: AttendanceRow): AttendanceRow =>
          r.playerId === myPlayerId ? { ...r, status: newStatus } : r
        return {
          ...old,
          confirmed: old.confirmed.map(updateRow),
        }
      })
      return { previous }
    },
    onError: (_err, _newStatus, context) => {
      if (context?.previous) {
        queryClient.setQueryData(attendancesKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attendancesKey })
    },
  })

  if (matchLoading || attendanceLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (!match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('common.loadError')}</Text>
      </View>
    )
  }

  const isAttendanceOpen = match?.status === 'attendance_open'

  const myPlayerId = attendances?.myPlayerId ?? null
  const myConfirmedRow = attendances?.confirmed.find((r) => r.playerId === myPlayerId)
  const myWaitlistRow = attendances?.waitlist.find((r) => r.playerId === myPlayerId)
  const myStatus: AttendanceStatus = myConfirmedRow?.status ?? 'unknown'
  const isWaitlisted = Boolean(myWaitlistRow)

  const confirmedCount = attendances?.confirmed.length ?? 0
  const total = match.playersPerTeam * 2

  const scheduled = new Date(match.scheduledAt)
  const kickoffTime = scheduled.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  const daysUntil = Math.ceil((scheduled.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  const dateLine = [
    scheduled.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
    ...(daysUntil > 0 ? [t('match.player.dayCountdown', { days: daysUntil })] : []),
  ].join(SEPARATOR)
  const venueLine = [
    ...(match.location ? [match.location] : []),
    `${match.format.toUpperCase()}`,
    `${match.playersPerTeam}v${match.playersPerTeam}`,
  ].join(SEPARATOR)

  return (
    <View style={styles.screen}>
      {/* The screen's ONE texture element + its one glow (hero band). */}
      <TextureType lines={[{ text: TEXTURE_TEXT }]} fontSize={150} style={styles.texture} />
      <LinearGradient
        colors={['rgba(255,68,56,0.14)', 'rgba(255,68,56,0)']}
        style={styles.glow}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        <PhaseStepper status={match.status} />

        <View style={styles.hero}>
          <Text style={styles.dateLine}>{dateLine}</Text>
          <Text style={styles.kickoff}>{kickoffTime}</Text>
          <View style={styles.venueRow}>
            <Ionicons name="location-outline" size={15} color={Colors.inkSecondary} />
            <Text style={styles.venueText}>{venueLine}</Text>
          </View>
        </View>

        {myPlayerId && !isWaitlisted && (
          <View style={styles.pillWrap}>
            <AttendanceSegmentedPill
              status={myStatus}
              onPress={isAttendanceOpen ? (s) => updateAttendance(s) : undefined}
              disabled={!isAttendanceOpen}
            />
          </View>
        )}

        {myPlayerId && isWaitlisted && (
          <View style={styles.waitlistCard}>
            <AttendanceSegmentedPill
              status={myStatus}
              isWaitlisted
              waitlistPosition={myWaitlistRow?.waitlistPosition ?? undefined}
              onPress={isAttendanceOpen ? (s) => updateAttendance(s) : undefined}
              disabled={!isAttendanceOpen}
            />
          </View>
        )}

        {match.status === 'in_progress' && activeGroupId && matchId && (
          <View style={styles.section}>
            <LockedPitchBoard groupId={activeGroupId} matchId={matchId} />
          </View>
        )}

        {match.status !== 'completed' && match.status !== 'cancelled' && activeGroupId && (
          <PronosForm matchId={matchId} groupId={activeGroupId} scheduledAt={match.scheduledAt} />
        )}

        {match.status === 'completed' && activeGroupId && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('pronos.reveal.title')}</Text>
            <PronosReveal matchId={matchId} groupId={activeGroupId} currentPlayerId={myPlayerId ?? ''} />
          </View>
        )}

        {(attendances?.confirmed.length ?? 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{t('attendance.section.confirmed')}</Text>
              <Text style={styles.sectionCount}>
                {t('attendance.summary', { confirmed: confirmedCount, total })}
              </Text>
            </View>
            <View style={styles.rowsCard}>
              {attendances!.confirmed.map((row) => (
                <AttendanceSwiperRow
                  key={row.playerId}
                  playerId={row.playerId}
                  displayName={row.displayName}
                  status={row.status}
                  disabled
                />
              ))}
            </View>
          </View>
        )}

        {(attendances?.waitlist.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('attendance.section.waitlist')}</Text>
            <View style={styles.rowsCard}>
              {attendances!.waitlist.map((row) => (
                <View
                  key={row.playerId}
                  style={styles.waitlistRow}
                  accessibilityLabel={t('attendance.toggle.waitlist.a11y', { position: row.waitlistPosition })}
                >
                  <Text style={styles.positionBadge}>{`#${row.waitlistPosition}`}</Text>
                  <Text style={styles.waitlistName} numberOfLines={1}>
                    {row.displayName}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {match.status === 'completed' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{t('match.mvp.title')}</Text>
              {match.completedAt && new Date(match.completedAt).getTime() + MVP_WINDOW_MS > Date.now() && (
                <CountdownPill
                  targetAt={new Date(new Date(match.completedAt).getTime() + MVP_WINDOW_MS).toISOString()}
                  label={t('match.mvp.countdownLabel')}
                />
              )}
            </View>
            {!participants?.myTeamSide ? (
              <Text style={styles.mvpNotEligible}>{t('match.mvp.notEligible')}</Text>
            ) : voteSubmitted ? (
              <View style={styles.mvpVotedCard}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.mvpVotedText}>{t('match.mvp.alreadyVoted')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.mvpSubtitle}>{t('match.mvp.subtitle')}</Text>
                <View style={styles.mvpGrid}>
                  {(participants.myTeamSide === 'A' ? participants.teamB : participants.teamA).map((player) => {
                    const selected = selectedNominee === player.playerId
                    return (
                      <Pressable
                        key={player.playerId}
                        style={[styles.mvpTile, selected && styles.mvpTileSelected]}
                        onPress={() => selectNominee(player.playerId)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        {/* R10 register: the chosen one takes the primary ring + check. */}
                        <DuotoneAvatar
                          displayName={player.displayName ?? '—'}
                          size={48}
                          ring={selected ? 'red' : undefined}
                        />
                        <View style={styles.mvpTileNameRow}>
                          {selected && <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />}
                          <Text
                            style={[styles.mvpTileName, selected && styles.mvpTileNameSelected]}
                            numberOfLines={1}
                          >
                            {player.displayName}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
                <View style={styles.mvpSubmitWrap}>
                  {/* The tab dock owns this screen's one glow. */}
                  <PrimaryButton
                    label={isVoting ? t('match.mvp.voting') : t('match.mvp.voteButton')}
                    onPress={() => selectedNominee && submitVote(selectedNominee)}
                    disabled={!selectedNominee}
                    loading={isVoting}
                    glow={false}
                  />
                </View>
              </>
            )}
          </View>
        )}

        {match.status === 'completed' && activeGroupId && matchId && match.completedAt && participants?.myTeamSide && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('match.ratings.windowTitle')}</Text>
            <PostMatchRatings
              matchId={matchId}
              groupId={activeGroupId}
              completedAt={match.completedAt}
              teammates={(participants.myTeamSide === 'A' ? participants.teamA : participants.teamB).filter(
                (p): p is ParticipantPlayer & { playerId: string } =>
                  p.playerId !== null && p.playerId !== myPlayerId,
              )}
            />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  texture: {
    top: 50,
    left: -40,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: DOCK_CLEARANCE,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
  },
  hero: {
    paddingHorizontal: 20,
  },
  dateLine: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  kickoff: {
    // --type-numeral: THE one giant numeral on this screen.
    fontFamily: Fonts.bebas,
    fontSize: 92,
    lineHeight: 88, // 0.95 line-height per the hero block
    letterSpacing: -0.92, // -0.01em @ 92
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  venueText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.interMedium,
  },
  pillWrap: {
    paddingHorizontal: 20,
  },
  waitlistCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    marginHorizontal: 20,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionCount: {
    color: Colors.inkSecondary,
    fontSize: 12.5,
    fontFamily: Fonts.interSemiBold,
    marginBottom: 10,
  },
  rowsCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    gap: 1,
  },
  waitlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  positionBadge: {
    fontFamily: Fonts.bebas,
    fontSize: 16,
    letterSpacing: 0.64, // 0.04em @ 16 (stat register)
    color: Colors.inkDisabled,
    width: 28,
    fontVariant: ['tabular-nums'],
  },
  waitlistName: {
    color: Colors.inkDisabled,
    fontSize: 15,
    fontFamily: Fonts.interMedium,
    flex: 1,
  },
  mvpSubtitle: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.inter,
    marginBottom: 10,
  },
  mvpNotEligible: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
  },
  mvpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mvpTile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  mvpTileSelected: {
    borderColor: Colors.primary,
  },
  mvpTileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  mvpTileName: {
    flexShrink: 1,
    color: Colors.ink,
    fontSize: 13.5,
    fontFamily: Fonts.interMedium,
  },
  mvpTileNameSelected: {
    color: Colors.primary,
    fontFamily: Fonts.interBold,
  },
  mvpSubmitWrap: {
    marginTop: 12,
  },
  mvpVotedCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.successSubtle,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
  },
  mvpVotedText: {
    color: Colors.success,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
})
