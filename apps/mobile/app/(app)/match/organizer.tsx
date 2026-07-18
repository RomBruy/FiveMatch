import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { useGroupContext } from '../../../contexts/GroupContext'
import { PhaseStepper } from '../../../components/shared/PhaseStepper'
import { AttendanceSwiperRow } from '../../../components/match/AttendanceSwiperRow'
import { NarrativeLoader } from '../../../components/shared/NarrativeLoader'
import { TeamDisplay } from '../../../components/match/TeamDisplay'
import type { TeamPlayer, TeamSwap } from '../../../components/match/TeamDisplay'
import { LockedPitchBoard } from '../../../components/match/PitchBoard'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { CountdownPill } from '../../../components/ui/CountdownPill'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
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
  const { t, i18n } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { activeGroupId } = useGroupContext()
  const router = useRouter()
  const insets = useSafeAreaInsets()
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

  const scheduledDate = new Date(match.scheduledAt).toLocaleDateString(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

  const isUpcoming =
    new Date(match.scheduledAt).getTime() > Date.now() &&
    match.status !== 'completed' &&
    match.status !== 'cancelled'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <PhaseStepper status={match.status} />

      <View style={styles.headerRow}>
        <Text style={styles.dateLabel}>{scheduledDate}</Text>
        <Text style={styles.headerCount}>
          {t('attendance.summary', { confirmed: confirmedCount, total })}
        </Text>
      </View>

      {isUpcoming && (
        <View style={styles.countdownWrap}>
          <CountdownPill targetAt={match.scheduledAt} label={t('pronos.countdownLabel')} />
        </View>
      )}

      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statCount, styles.statCountIn]}>{inCount}</Text>
            <Text style={styles.statLabel}>{t('attendance.toggle.in')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statCount, styles.statCountOut]}>{outCount}</Text>
            <Text style={styles.statLabel}>{t('attendance.toggle.out')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statCount}>{unknownCount}</Text>
            <Text style={styles.statLabel}>{t('attendance.toggle.unknown')}</Text>
          </View>
        </View>
      </View>

      {myPlayerId && (
        <View style={styles.rowsCard}>
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

      {(attendances?.confirmed.length ?? 0) > 0 && (
        <View>
          <Text style={styles.sectionLabel}>{t('attendance.section.confirmed')}</Text>
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
        <View>
          <Text style={styles.sectionLabel}>{t('attendance.section.waitlist')}</Text>
          <View style={styles.rowsCard}>
            {attendances!.waitlist.map((row) => (
              <View key={row.playerId} style={styles.waitlistRow}>
                <Text style={styles.positionBadge}>{`#${row.waitlistPosition}`}</Text>
                <Text style={styles.waitlistName} numberOfLines={1}>
                  {row.displayName}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {isAttendanceOpen && (
        <View style={styles.hintCard}>
          <Ionicons name="time-outline" size={17} color={Colors.inkSecondary} style={styles.hintIcon} />
          <Text style={styles.hintText}>
            {`${t('match.organizer.swipeHint')} ${t('attendance.reminderAuto')}`}
          </Text>
        </View>
      )}

      {isAttendanceOpen && (
        // Lock-roster is this screen's PrimaryButton; the tab dock owns the glow.
        <PrimaryButton
          label={isLocking ? t('attendance.lock.loading') : t('attendance.lock.cta')}
          onPress={() => lockAttendance()}
          disabled={inCount < required}
          loading={isLocking}
          glow={false}
        />
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

      {isTeamsLocked && activeGroupId && matchId && (
        <LockedPitchBoard groupId={activeGroupId} matchId={matchId} />
      )}

      {isTeamsLocked && (
        <SecondaryButton
          label={t('match.result.enterResult')}
          onPress={() => router.push(`/(app)/match/result?matchId=${matchId}&groupId=${activeGroupId}`)}
        />
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
            <PrimaryButton
              label={t(match.generationCount >= TEAM_GEN_MAX_GENERATIONS ? 'match.generate.limitReached' : 'match.teamGen.generateButton')}
              onPress={() => { void generateTeams() }}
              disabled={match.generationCount >= TEAM_GEN_MAX_GENERATIONS}
              glow={false}
            />
          )}

          {adjustedTeams && !isTeamsLocked && (
            <>
              {lockTeamsError && <Text style={styles.lockTeamsError}>{lockTeamsError}</Text>}
              <PrimaryButton
                label={isLockingTeams ? t('match.teamLock.locking') : t('match.teamLock.lockButton')}
                onPress={() => { void lockTeams() }}
                loading={isLockingTeams}
                glow={false}
              />
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
    paddingHorizontal: 20,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  headerCount: {
    color: Colors.inkSecondary,
    fontSize: 12.5,
    fontFamily: Fonts.interSemiBold,
  },
  countdownWrap: {
    alignItems: 'flex-start',
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statCount: {
    fontFamily: Fonts.bebas,
    fontSize: 28,
    letterSpacing: 1.12, // 0.04em @ 28 (stat register)
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statCountIn: {
    color: Colors.success,
  },
  statCountOut: {
    color: Colors.primary,
  },
  statLabel: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
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
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
  },
  hintIcon: {
    flexShrink: 0,
  },
  hintText: {
    flex: 1,
    color: Colors.inkSecondary,
    fontSize: 12.5,
    fontFamily: Fonts.interMedium,
    lineHeight: 19,
  },
  insufficientText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  surplusCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    padding: 14,
  },
  surplusText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
  generateSection: {
    gap: 12,
  },
  generateError: {
    color: Colors.primary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    textAlign: 'center',
  },
  lockTeamsError: {
    color: Colors.primary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    textAlign: 'center',
  },
  mvpCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    gap: 6,
  },
  mvpTitle: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  mvpPending: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
  },
  mvpWinner: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 2.4, // 0.10em @ 24 (heading register)
  },
  mvpNoVotes: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
  },
})
