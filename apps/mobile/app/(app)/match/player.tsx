import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'
import { useGroupContext } from '../../../contexts/GroupContext'
import { PhaseStepper } from '../../../components/shared/PhaseStepper'
import { AttendanceSwiperRow } from '../../../components/match/AttendanceSwiperRow'
import { AttendanceToggle } from '../../../components/match/AttendanceToggle'
import { PronosForm } from '../../../components/match/PronosForm'
import { PronosReveal } from '../../../components/match/PronosReveal'

interface MatchDetail {
  matchId: string
  status: 'planning' | 'attendance_open' | 'attendance_locked' | 'teams_generated' | 'in_progress' | 'completed' | 'cancelled'
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
  const { t } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { activeGroupId } = useGroupContext()
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

  const scheduledDate = new Date(match.scheduledAt).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhaseStepper status={match.status} />

      {match.status !== 'completed' && match.status !== 'cancelled' && activeGroupId && (
        <PronosForm matchId={matchId} groupId={activeGroupId} scheduledAt={match.scheduledAt} />
      )}

      {match.status === 'completed' && activeGroupId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pronos.reveal.title')}</Text>
          <PronosReveal matchId={matchId} groupId={activeGroupId} currentPlayerId={myPlayerId ?? ''} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.dateText}>{scheduledDate}</Text>
        {match.location && <Text style={styles.locationText}>{match.location}</Text>}
        <Text style={styles.formatText}>
          {`${match.format.toUpperCase()} · ${match.playersPerTeam}v${match.playersPerTeam}`}
        </Text>
      </View>

      {myPlayerId && (
        <View style={styles.myRowCard}>
          <AttendanceSwiperRow
            playerId={myPlayerId}
            displayName={null}
            status={myStatus}
            isWaitlisted={isWaitlisted}
            waitlistPosition={myWaitlistRow?.waitlistPosition ?? undefined}
            onSwipeIn={isAttendanceOpen ? () => updateAttendance('in') : undefined}
            onSwipeOut={isAttendanceOpen ? () => updateAttendance('out') : undefined}
            onTogglePress={isAttendanceOpen ? (s) => updateAttendance(s) : undefined}
            disabled={!isAttendanceOpen}
          />
        </View>
      )}

      <Text style={styles.summaryText}>
        {t('attendance.summary', { confirmed: confirmedCount, total })}
      </Text>

      {(attendances?.confirmed.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('attendance.section.confirmed')}</Text>
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
      )}

      {(attendances?.waitlist.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('attendance.section.waitlist')}</Text>
          {attendances!.waitlist.map((row) => (
            <View key={row.playerId} style={styles.waitlistRow}>
              <Text style={styles.positionBadge}>#{row.waitlistPosition}</Text>
              <AttendanceToggle status="in" isWaitlisted waitlistPosition={row.waitlistPosition ?? undefined} />
              <Text style={styles.waitlistName}>{row.displayName}</Text>
            </View>
          ))}
        </View>
      )}

      {match.status === 'completed' && (
        <View style={styles.mvpSection}>
          <Text style={styles.sectionTitle}>{t('match.mvp.title')}</Text>
          {!participants?.myTeamSide ? (
            <Text style={styles.mvpNotEligible}>{t('match.mvp.notEligible')}</Text>
          ) : voteSubmitted ? (
            <View style={styles.mvpVotedCard}>
              <Text style={styles.mvpVotedText}>{t('match.mvp.alreadyVoted')}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.mvpSubtitle}>{t('match.mvp.subtitle')}</Text>
              {(participants.myTeamSide === 'A' ? participants.teamB : participants.teamA).map((player) => (
                <Pressable
                  key={player.playerId}
                  style={[styles.mvpCandidateRow, selectedNominee === player.playerId && styles.mvpCandidateSelected]}
                  onPress={() => setSelectedNominee(player.playerId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedNominee === player.playerId }}
                >
                  <Text style={[styles.mvpCandidateName, selectedNominee === player.playerId && styles.mvpCandidateNameSelected]}>
                    {player.displayName}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.mvpSubmitButton, (!selectedNominee || isVoting) && styles.mvpSubmitButtonDisabled]}
                onPress={() => selectedNominee && submitVote(selectedNominee)}
                disabled={!selectedNominee || isVoting}
                accessibilityRole="button"
              >
                <Text style={styles.mvpSubmitButtonText}>
                  {isVoting ? t('match.mvp.voting') : t('match.mvp.voteButton')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingBottom: 48,
    gap: 12,
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
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
    gap: 6,
  },
  dateText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  locationText: {
    color: Colors.inkSecondary,
    fontSize: 14,
  },
  formatText: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  myRowCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  summaryText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    paddingHorizontal: 16,
  },
  section: {
    gap: 1,
  },
  sectionTitle: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    color: Colors.inkDisabled,
    fontSize: 12,
    fontWeight: '700',
    width: 24,
  },
  waitlistName: {
    color: Colors.inkDisabled,
    fontSize: 15,
    flex: 1,
  },
  mvpSection: {
    gap: 8,
    paddingHorizontal: 16,
  },
  mvpSubtitle: {
    color: Colors.inkSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  mvpNotEligible: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  mvpCandidateRow: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mvpCandidateSelected: {
    borderColor: Colors.primary,
  },
  mvpCandidateName: {
    color: Colors.ink,
    fontSize: 15,
  },
  mvpCandidateNameSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  mvpSubmitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  mvpSubmitButtonDisabled: {
    opacity: 0.35,
  },
  mvpSubmitButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mvpVotedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
  },
  mvpVotedText: {
    color: Colors.success,
    fontSize: 15,
    fontWeight: '600',
  },
})
