import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'
import { useGroupContext } from '../../../contexts/GroupContext'
import { PhaseStepper } from '../../../components/shared/PhaseStepper'
import { AttendanceSwiperRow } from '../../../components/match/AttendanceSwiperRow'
import { NarrativeLoader } from '../../../components/shared/NarrativeLoader'
import { TeamDisplay } from '../../../components/match/TeamDisplay'
import type { TeamPlayer, TeamSwap } from '../../../components/match/TeamDisplay'
import { TEAM_GEN_MAX_GENERATIONS } from '@fivematch/types/algorithm-constants'

interface MatchDetail {
  matchId: string
  status: 'planning' | 'attendance_open' | 'attendance_locked' | 'teams_generated' | 'in_progress' | 'completed' | 'cancelled'
  scheduledAt: string
  location: string | null
  format: string
  playersPerTeam: number
  goalkeeperMode: string
  generatorStyle: string
  generationCount: number
  attendanceSummary: {
    in: number
    out: number
    unknown: number
    waitlist: number
  }
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

interface TeamResult {
  jobId: string
  status: 'complete' | 'processing'
  generationCount: number
  teams: {
    teamA: TeamPlayer[]
    teamB: TeamPlayer[]
    fairnessScore: number
  } | null
}

interface MvpResult {
  resolved: boolean
  mvpPlayerId: string | null
  mvpDisplayName: string | null
}

export default function MatchOrganizerScreen() {
  const { t } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { activeGroupId } = useGroupContext()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [teamResult, setTeamResult] = useState<TeamResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stagedSwaps, setStagedSwaps] = useState<TeamSwap[]>([])
  const [selectedForSwap, setSelectedForSwap] = useState<{ playerId: string; team: 'A' | 'B' } | null>(null)
  const [isLockingTeams, setIsLockingTeams] = useState(false)
  const [lockTeamsError, setLockTeamsError] = useState<string | null>(null)

  const { data: match, isLoading, isError } = useQuery({
    queryKey: ['matches', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MatchDetail }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId),
  })

  const attendancesKey = ['attendances', matchId]

  const { data: attendances } = useQuery({
    queryKey: attendancesKey,
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: AttendancesData }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}/attendances`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId),
  })

  const { data: mvpResult } = useQuery({
    queryKey: ['mvp-result', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MvpResult }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}/mvp-result`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId) && match?.status === 'completed',
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || !data.resolved) return 30_000
      return false
    },
  })

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: attendancesKey })
    }, [matchId]),
  )

  const { mutate: lockAttendance, isPending: isLocking } = useMutation({
    mutationFn: () =>
      httpClient.post(`/v1/groups/${activeGroupId}/matches/${matchId}/lock-attendance`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matches', activeGroupId, matchId] })
      void queryClient.invalidateQueries({ queryKey: attendancesKey })
    },
  })

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
        return { ...old, confirmed: old.confirmed.map(updateRow) }
      })
      return { previous }
    },
    onError: (_err, _newStatus, context) => {
      if (context?.previous) queryClient.setQueryData(attendancesKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: attendancesKey })
    },
  })

  const generateTeams = useCallback(async () => {
    if (!activeGroupId || !matchId) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const { data } = await httpClient.post<{ data: TeamResult }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}/generate-teams`,
      )
      const result = data.data
      if (result.status === 'complete' && result.teams) {
        setTeamResult(result)
        setStagedSwaps([])
        setSelectedForSwap(null)
        setIsGenerating(false)
        void queryClient.invalidateQueries({ queryKey: ['matches', activeGroupId, matchId] })
      } else if (result.status === 'processing') {
        let elapsed = 0
        pollingRef.current = setInterval(async () => {
          elapsed += 1000
          if (elapsed >= 30_000) {
            clearInterval(pollingRef.current!)
            setIsGenerating(false)
            setGenerateError(t('match.generate.polling.timeout'))
            return
          }
          try {
            const { data: pollData } = await httpClient.get<{ data: TeamResult }>(
              `/v1/groups/${activeGroupId}/matches/${matchId}/generation-result/${result.jobId}`,
            )
            if (pollData.data.status === 'complete' && pollData.data.teams) {
              clearInterval(pollingRef.current!)
              setTeamResult(pollData.data)
              setStagedSwaps([])
              setSelectedForSwap(null)
              setIsGenerating(false)
              void queryClient.invalidateQueries({ queryKey: ['matches', activeGroupId, matchId] })
            }
          } catch { /* ignore polling errors — retry on next tick */ }
        }, 1000)
      }
    } catch (err: unknown) {
      setIsGenerating(false)
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
      if (code === 'GENERATION_LIMIT_REACHED') {
        setGenerateError(t('match.generate.limitReached'))
      } else {
        setGenerateError(t('match.generate.error'))
      }
    }
  }, [activeGroupId, matchId, queryClient, t])

  const handleSwap = useCallback((playerId: string, currentTeam: 'A' | 'B') => {
    if (!selectedForSwap) {
      setSelectedForSwap({ playerId, team: currentTeam })
      return
    }

    if (selectedForSwap.playerId === playerId) {
      setSelectedForSwap(null)
      return
    }

    if (selectedForSwap.team === currentTeam) {
      setSelectedForSwap({ playerId, team: currentTeam })
      return
    }

    // Different teams — execute the mutual swap
    const fromTeam = selectedForSwap.team
    const toTeam = currentTeam

    setStagedSwaps((prev) => {
      const next = [...prev]

      const existingA = next.findIndex((s) => s.playerId === selectedForSwap.playerId)
      const swapA: TeamSwap = { playerId: selectedForSwap.playerId, fromTeam, toTeam }
      if (existingA >= 0) next[existingA] = swapA
      else next.push(swapA)

      const existingB = next.findIndex((s) => s.playerId === playerId)
      const swapB: TeamSwap = { playerId, fromTeam: toTeam, toTeam: fromTeam }
      if (existingB >= 0) next[existingB] = swapB
      else next.push(swapB)

      return next
    })

    setSelectedForSwap(null)
  }, [selectedForSwap])

  const lockTeams = useCallback(async () => {
    if (!activeGroupId || !matchId) return
    setIsLockingTeams(true)
    setLockTeamsError(null)
    try {
      if (stagedSwaps.length > 0) {
        await httpClient.patch(
          `/v1/groups/${activeGroupId}/matches/${matchId}/team-adjustment`,
          { swaps: stagedSwaps },
        )
      }

      await httpClient.post(`/v1/groups/${activeGroupId}/matches/${matchId}/lock-teams`)

      void queryClient.invalidateQueries({ queryKey: ['matches', activeGroupId, matchId] })
      setStagedSwaps([])
      setTeamResult(null)
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
      if (code === 'TEAMS_ALREADY_LOCKED') {
        setLockTeamsError(t('match.teamLock.alreadyLocked'))
        void queryClient.invalidateQueries({ queryKey: ['matches', activeGroupId, matchId] })
      } else {
        setLockTeamsError(t('match.teamLock.error'))
      }
    } finally {
      setIsLockingTeams(false)
    }
  }, [activeGroupId, matchId, stagedSwaps, queryClient, t])

  const adjustedTeams = useMemo(() => {
    if (!teamResult?.teams) return null
    if (stagedSwaps.length === 0) return teamResult.teams

    const applySwaps = (players: TeamPlayer[], targetSide: 'A' | 'B'): TeamPlayer[] => {
      const movedIn = stagedSwaps
        .filter((s) => s.toTeam === targetSide)
        .map((s) => {
          const fromList = targetSide === 'A' ? teamResult.teams!.teamB : teamResult.teams!.teamA
          return fromList.find((p) => p.playerId === s.playerId)
        })
        .filter(Boolean) as TeamPlayer[]

      const movedOut = new Set(stagedSwaps.filter((s) => s.fromTeam === targetSide).map((s) => s.playerId))
      return [...players.filter((p) => !movedOut.has(p.playerId ?? '')), ...movedIn]
    }

    return {
      teamA: applySwaps(teamResult.teams.teamA, 'A'),
      teamB: applySwaps(teamResult.teams.teamB, 'B'),
      fairnessScore: teamResult.teams.fairnessScore,
    }
  }, [teamResult, stagedSwaps])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('common.loadError')}</Text>
      </View>
    )
  }

  const scheduledDate = new Date(match.scheduledAt).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  const { in: inCount, out: outCount, unknown: unknownCount } = match.attendanceSummary

  const isAttendanceOpen = match.status === 'attendance_open'
  const isAttendanceLocked = match.status === 'attendance_locked'
  const required = match.playersPerTeam * 2
  const surplus = inCount - required
  const canGenerate = (match.status === 'attendance_locked' || match.status === 'teams_generated') && surplus <= 0

  const myPlayerId = attendances?.myPlayerId ?? null
  const myConfirmedRow = attendances?.confirmed.find((r) => r.playerId === myPlayerId)
  const myWaitlistRow = attendances?.waitlist.find((r) => r.playerId === myPlayerId)
  const myStatus: AttendanceStatus = myConfirmedRow?.status ?? 'unknown'
  const isWaitlisted = Boolean(myWaitlistRow)

  const confirmedCount = attendances?.confirmed.length ?? inCount
  const total = match.playersPerTeam * 2

  const isTeamsLocked = match.status === 'in_progress'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhaseStepper status={match.status} />

      <View style={styles.card}>
        <Text style={styles.dateText}>{scheduledDate}</Text>
        {match.location && <Text style={styles.locationText}>{match.location}</Text>}
        <Text style={styles.formatText}>
          {`${match.format.toUpperCase()} · ${match.playersPerTeam}v${match.playersPerTeam}`}
        </Text>
      </View>

      <View style={styles.attendanceCard}>
        <View style={styles.attendanceRow}>
          <View style={styles.attendanceStat}>
            <Text style={[styles.attendanceCount, styles.inCount]}>{inCount}</Text>
            <Text style={styles.attendanceLabel}>{t('attendance.toggle.in')}</Text>
          </View>
          <View style={styles.attendanceStat}>
            <Text style={[styles.attendanceCount, styles.outCount]}>{outCount}</Text>
            <Text style={styles.attendanceLabel}>{t('attendance.toggle.out')}</Text>
          </View>
          <View style={styles.attendanceStat}>
            <Text style={styles.attendanceCount}>{unknownCount}</Text>
            <Text style={styles.attendanceLabel}>{t('attendance.toggle.unknown')}</Text>
          </View>
        </View>
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
              <Text style={styles.waitlistName}>{row.displayName}</Text>
            </View>
          ))}
        </View>
      )}

      {isAttendanceOpen && (
        <Pressable
          style={[
            styles.lockButton,
            (inCount < required || isLocking) && styles.lockButtonDisabled,
          ]}
          onPress={() => lockAttendance()}
          disabled={inCount < required || isLocking}
          accessibilityRole="button"
          accessibilityLabel={t('attendance.lock.cta')}
        >
          <Text style={styles.lockButtonText}>
            {isLocking ? t('attendance.lock.loading') : t('attendance.lock.cta')}
          </Text>
        </Pressable>
      )}

      {isAttendanceOpen && inCount < required && (
        <Text style={styles.insufficientText}>
          {t('attendance.lock.insufficient', { confirmed: inCount, required })}
        </Text>
      )}

      {isAttendanceLocked && surplus > 0 && (
        <View style={styles.surplusCard}>
          <Text style={styles.surplusText}>
            {t('attendance.lock.surplus', { count: surplus })}
          </Text>
        </View>
      )}

      {isTeamsLocked && (
        <Pressable
          style={styles.recordResultButton}
          onPress={() => router.push(`/(app)/match/result?matchId=${matchId}&groupId=${activeGroupId}`)}
          accessibilityRole="button"
          accessibilityLabel={t('match.result.enterResult')}
        >
          <Text style={styles.recordResultButtonText}>
            {t('match.result.enterResult')}
          </Text>
        </Pressable>
      )}

      {canGenerate && (
        <View style={styles.generateSection}>
          {isGenerating && <NarrativeLoader />}

          {!isGenerating && adjustedTeams && (
            <TeamDisplay
              teamA={adjustedTeams.teamA}
              teamB={adjustedTeams.teamB}
              fairnessScore={adjustedTeams.fairnessScore}
              generationCount={teamResult!.generationCount}
              stagedSwaps={stagedSwaps}
              onSwap={handleSwap}
              selectedForSwap={selectedForSwap}
              isLocked={isTeamsLocked}
              onRegenerate={match.generationCount < TEAM_GEN_MAX_GENERATIONS ? () => { void generateTeams() } : undefined}
            />
          )}

          {!isGenerating && generateError && (
            <Text style={styles.generateError}>{generateError}</Text>
          )}

          {!isGenerating && !adjustedTeams && (
            <Pressable
              style={[
                styles.generateButton,
                match.generationCount >= TEAM_GEN_MAX_GENERATIONS && styles.generateButtonDisabled,
              ]}
              onPress={() => { void generateTeams() }}
              disabled={match.generationCount >= TEAM_GEN_MAX_GENERATIONS}
              accessibilityRole="button"
              accessibilityLabel={t(match.generationCount >= TEAM_GEN_MAX_GENERATIONS ? 'match.generate.limitReached' : 'match.generate.cta')}
            >
              <Text style={styles.generateButtonText}>
                {t(match.generationCount >= TEAM_GEN_MAX_GENERATIONS ? 'match.generate.limitReached' : 'match.teamGen.generateButton')}
              </Text>
            </Pressable>
          )}

          {adjustedTeams && !isTeamsLocked && (
            <>
              {lockTeamsError && <Text style={styles.lockTeamsError}>{lockTeamsError}</Text>}
              <Pressable
                style={[styles.lockTeamsButton, isLockingTeams && styles.lockTeamsButtonDisabled]}
                onPress={() => { void lockTeams() }}
                disabled={isLockingTeams}
                accessibilityRole="button"
                accessibilityLabel={t('match.teamLock.lockButton')}
              >
                <Text style={styles.lockTeamsButtonText}>
                  {isLockingTeams ? t('match.teamLock.locking') : t('match.teamLock.lockButton')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {match.status === 'completed' && mvpResult && (
        <View style={styles.mvpCard}>
          <Text style={styles.mvpTitle}>{t('match.mvp.result.title')}</Text>
          {!mvpResult.resolved ? (
            <Text style={styles.mvpPending}>{t('match.mvp.result.pending')}</Text>
          ) : mvpResult.mvpPlayerId ? (
            <Text style={styles.mvpWinner}>{t('match.mvp.result.winner', { name: mvpResult.mvpDisplayName })}</Text>
          ) : (
            <Text style={styles.mvpNoVotes}>{t('match.mvp.result.noVotes')}</Text>
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
    padding: 16,
    paddingBottom: 48,
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
  },
  card: {
    backgroundColor: Colors.surface,
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
  attendanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attendanceStat: {
    alignItems: 'center',
    gap: 4,
  },
  attendanceCount: {
    color: Colors.ink,
    fontSize: 28,
    fontWeight: '700',
  },
  inCount: {
    color: Colors.success,
  },
  outCount: {
    color: Colors.primary,
  },
  attendanceLabel: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '500',
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
  lockButton: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  lockButtonDisabled: {
    opacity: 0.35,
  },
  lockButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  insufficientText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  surplusCard: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 2,
    padding: 12,
    marginHorizontal: 16,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  surplusText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  generateButton: {
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: Colors.primary,
  },
  generateButtonDisabled: {
    opacity: 0.35,
  },
  generateButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  generateSection: { marginTop: 16 },
  generateError: {
    color: Colors.primary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  lockTeamsButton: {
    backgroundColor: Colors.success,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
  },
  lockTeamsButtonDisabled: {
    opacity: 0.35,
  },
  lockTeamsButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lockTeamsError: {
    color: Colors.primary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  recordResultButton: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  recordResultButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mvpCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    gap: 6,
    marginHorizontal: 16,
  },
  mvpTitle: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mvpPending: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  mvpWinner: {
    color: Colors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  mvpNoVotes: {
    color: Colors.inkSecondary,
    fontSize: 14,
  },
})
