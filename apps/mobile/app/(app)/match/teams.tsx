import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { matchKeys } from '../../../lib/matches'
import { TeamDisplay } from '../../../components/match/TeamDisplay'
import type { TeamPlayer, TeamSwap } from '../../../components/match/TeamDisplay'
import { NarrativeLoader } from '../../../components/shared/NarrativeLoader'
import { InfoStrip } from '../../../components/shared/InfoStrip'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { PressableScale } from '../../../components/ui/PressableScale'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { TEAM_GEN_MAX_GENERATIONS } from '@fivematch/types/algorithm-constants'

interface TeamResult {
  jobId: string
  status: 'complete' | 'processing'
  generationCount: number
  teams: { teamA: TeamPlayer[]; teamB: TeamPlayer[]; fairnessScore: number } | null
}

interface TeamGenStatus {
  canGenerate: boolean
  reason: string | null
  ratedPlayerCount: number
  minimumRequired: number
  fairnessConfidenceDisclaimer: string | null
}

const POLL_INTERVAL_MS = 1000
const POLL_TIMEOUT_MS = 30_000

/**
 * Team generation, split out of the old organizer screen into its own route.
 *
 * It's a focused, one-job flow (generate → swap → lock) that only the host ever
 * sees, and keeping it inline was most of what made that screen 753 lines. The
 * readiness check is now per-match rather than per-crew, which is what it always
 * meant: how many of the people playing tonight carry a rating.
 */
export default function TeamsScreen() {
  const { t } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const [teamResult, setTeamResult] = useState<TeamResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [stagedSwaps, setStagedSwaps] = useState<TeamSwap[]>([])
  const [selectedForSwap, setSelectedForSwap] = useState<{ playerId: string; team: 'A' | 'B' } | null>(null)
  const [isLockingTeams, setIsLockingTeams] = useState(false)
  const [lockTeamsError, setLockTeamsError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: status } = useQuery({
    queryKey: ['matches', matchId, 'team-generator-status'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: TeamGenStatus }>(
        `/v1/matches/${matchId}/team-generator-status`,
      )
      return data.data
    },
    enabled: Boolean(matchId),
  })

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
  }, [])

  const generateTeams = useCallback(async () => {
    if (!matchId) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const { data } = await httpClient.post<{ data: TeamResult }>(`/v1/matches/${matchId}/generate-teams`)
      const result = data.data

      if (result.status === 'complete' && result.teams) {
        setTeamResult(result)
        setStagedSwaps([])
        setSelectedForSwap(null)
        setIsGenerating(false)
        void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
        return
      }

      // Async path: poll the job until it lands or the budget runs out.
      let elapsed = 0
      pollingRef.current = setInterval(async () => {
        elapsed += POLL_INTERVAL_MS
        if (elapsed >= POLL_TIMEOUT_MS) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setIsGenerating(false)
          setGenerateError(t('match.generate.polling.timeout'))
          return
        }
        try {
          const { data: poll } = await httpClient.get<{ data: TeamResult }>(
            `/v1/matches/${matchId}/generation-result/${result.jobId}`,
          )
          if (poll.data.status === 'complete' && poll.data.teams) {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setTeamResult(poll.data)
            setStagedSwaps([])
            setSelectedForSwap(null)
            setIsGenerating(false)
            void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
          }
        } catch { /* ignore — retry on next tick */ }
      }, POLL_INTERVAL_MS)
    } catch (err: unknown) {
      setIsGenerating(false)
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        .response?.data?.error?.code
      setGenerateError(
        code === 'GENERATION_LIMIT_REACHED' ? t('match.generate.limitReached') : t('match.generate.error'),
      )
    }
  }, [matchId, queryClient, t])

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

    // Different sides — stage the mutual swap.
    const fromTeam = selectedForSwap.team
    const toTeam = currentTeam

    setStagedSwaps((prev) => {
      const next = [...prev]
      const upsert = (swap: TeamSwap) => {
        const existing = next.findIndex((s) => s.playerId === swap.playerId)
        if (existing >= 0) next[existing] = swap
        else next.push(swap)
      }
      upsert({ playerId: selectedForSwap.playerId, fromTeam, toTeam })
      upsert({ playerId, fromTeam: toTeam, toTeam: fromTeam })
      return next
    })

    setSelectedForSwap(null)
  }, [selectedForSwap])

  const lockTeams = useCallback(async () => {
    if (!matchId) return
    setIsLockingTeams(true)
    setLockTeamsError(null)
    try {
      if (stagedSwaps.length > 0) {
        await httpClient.patch(`/v1/matches/${matchId}/team-adjustment`, { swaps: stagedSwaps })
      }
      await httpClient.post(`/v1/matches/${matchId}/lock-teams`)
      void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
      setStagedSwaps([])
      setTeamResult(null)
      router.back()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        .response?.data?.error?.code
      if (code === 'TEAMS_ALREADY_LOCKED') {
        setLockTeamsError(t('match.teamLock.alreadyLocked'))
        void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
      } else {
        setLockTeamsError(t('match.teamLock.error'))
      }
    } finally {
      setIsLockingTeams(false)
    }
  }, [matchId, stagedSwaps, queryClient, router, t])

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

  const atGenerationLimit = (teamResult?.generationCount ?? 0) >= TEAM_GEN_MAX_GENERATIONS

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <PressableScale
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={22} color={Colors.ink} />
      </PressableScale>

      <Text style={styles.title}>{t('match.generate.title')}</Text>

      {status?.fairnessConfidenceDisclaimer && (
        <View style={styles.strip}>
          <InfoStrip variant="warning" pulsing message={t('match.teamGen.fairnessDisclaimer')} />
        </View>
      )}
      {status && !status.canGenerate && (
        <View style={styles.strip}>
          <InfoStrip
            variant="info"
            message={t('match.teamGen.insufficientPlayers', {
              minimum: status.minimumRequired,
              missing: status.minimumRequired - status.ratedPlayerCount,
            })}
          />
        </View>
      )}
      {(generateError || lockTeamsError) && (
        <View style={styles.strip}>
          <InfoStrip variant="warning" message={generateError ?? lockTeamsError!} />
        </View>
      )}

      {isGenerating ? (
        <NarrativeLoader />
      ) : adjustedTeams ? (
        <>
          <TeamDisplay
            teamA={adjustedTeams.teamA}
            teamB={adjustedTeams.teamB}
            fairnessScore={adjustedTeams.fairnessScore}
            generationCount={teamResult?.generationCount ?? 0}
            stagedSwaps={stagedSwaps}
            onSwap={handleSwap}
            selectedForSwap={selectedForSwap}
            onRegenerate={atGenerationLimit ? undefined : () => void generateTeams()}
            isLocked={false}
          />
          <View style={styles.action}>
            <PrimaryButton
              label={t('match.cta.lockTeams')}
              onPress={() => void lockTeams()}
              loading={isLockingTeams}
              glow={false}
            />
          </View>
        </>
      ) : (
        <View style={styles.action}>
          <PrimaryButton
            label={t('match.cta.generateTeams')}
            onPress={() => void generateTeams()}
            glow={false}
          />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 36,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  strip: { marginBottom: 14 },
  action: { marginTop: 24 },
})
