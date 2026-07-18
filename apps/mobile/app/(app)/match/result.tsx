import { useState } from 'react'
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { posthog } from '../../../lib/posthog'
import { DuotoneAvatar } from '../../../components/ui/DuotoneAvatar'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'

interface Participant {
  playerId: string | null
  displayName: string | null
  teamSide: 'A' | 'B' | null
  goalsScored: number | null
  assists: number | null
}

interface MatchDetail {
  matchId: string
  status: string
  format?: string
  participants?: Participant[]
}

interface PlayerStat {
  playerId: string
  goalsScored: number
  assists: number
}

export default function MatchResultScreen() {
  const { t } = useTranslation()
  const { matchId, groupId } = useLocalSearchParams<{ matchId: string; groupId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()

  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [playerStats, setPlayerStats] = useState<Record<string, { goalsScored: string; assists: string }>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: match, isLoading } = useQuery({
    queryKey: ['matches', groupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MatchDetail }>(
        `/v1/groups/${groupId}/matches/${matchId}`,
      )
      return data.data
    },
    enabled: Boolean(groupId) && Boolean(matchId),
  })

  const getPlayerStat = (playerId: string) =>
    playerStats[playerId] ?? { goalsScored: '', assists: '' }

  const setPlayerGoals = (playerId: string, value: string) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: { ...getPlayerStat(playerId), goalsScored: value },
    }))
  }

  const setPlayerAssists = (playerId: string, value: string) => {
    setPlayerStats((prev) => ({
      ...prev,
      [playerId]: { ...getPlayerStat(playerId), assists: value },
    }))
  }

  const handleSubmit = async () => {
    const parsedScoreA = parseInt(scoreA, 10)
    const parsedScoreB = parseInt(scoreB, 10)
    if (isNaN(parsedScoreA) || isNaN(parsedScoreB) || parsedScoreA < 0 || parsedScoreB < 0) {
      setSubmitError(t('common.genericError'))
      return
    }

    const stats: PlayerStat[] = (match?.participants ?? [])
      .filter((p): p is Participant & { playerId: string } => p.playerId !== null)
      .map((p) => ({
        playerId: p.playerId,
        goalsScored: parseInt(getPlayerStat(p.playerId).goalsScored || '0', 10) || 0,
        assists: parseInt(getPlayerStat(p.playerId).assists || '0', 10) || 0,
      }))

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await httpClient.post(`/v1/groups/${groupId}/matches/${matchId}/result`, {
        scoreA: parsedScoreA,
        scoreB: parsedScoreB,
        playerStats: stats,
      })
      posthog.capture('match_completed', {
        format: match?.format ?? 'unknown',
        player_count: match?.participants?.length ?? stats.length,
      })
      await queryClient.invalidateQueries({ queryKey: ['matches', groupId, matchId] })
      router.back()
    } catch {
      setSubmitError(t('common.genericError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const participants = match?.participants ?? []

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Text style={styles.title}>{t('match.result.title')}</Text>

      {/* The score is this screen's ONE giant numeral moment. */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreField}>
          <Text style={[styles.scoreLabel, styles.scoreLabelA]}>{t('match.result.teamAScore')}</Text>
          <TextInput
            style={styles.scoreInput}
            keyboardType="numeric"
            value={scoreA}
            onChangeText={setScoreA}
            placeholderTextColor={Colors.inkDisabled}
            placeholder="0"
          />
        </View>
        <Text style={styles.scoreSeparator}>–</Text>
        <View style={styles.scoreField}>
          <Text style={styles.scoreLabel}>{t('match.result.teamBScore')}</Text>
          <TextInput
            style={styles.scoreInput}
            keyboardType="numeric"
            value={scoreB}
            onChangeText={setScoreB}
            placeholderTextColor={Colors.inkDisabled}
            placeholder="0"
          />
        </View>
      </View>

      {participants.length > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>{t('match.result.playerStatsTitle')}</Text>
          <View style={styles.rowsCard}>
            {participants.map((p) => {
              if (!p.playerId) return null
              const stat = getPlayerStat(p.playerId)
              return (
                <View key={p.playerId} style={styles.playerRow}>
                  <DuotoneAvatar displayName={p.displayName ?? '—'} size={36} />
                  <Text style={styles.playerName} numberOfLines={1}>{p.displayName ?? '—'}</Text>
                  <View style={styles.statFields}>
                    <View style={styles.statField}>
                      <Text style={styles.statLabel}>{t('match.result.goalsLabel')}</Text>
                      <TextInput
                        style={styles.statInput}
                        keyboardType="numeric"
                        value={stat.goalsScored}
                        onChangeText={(v) => setPlayerGoals(p.playerId!, v)}
                        placeholderTextColor={Colors.inkDisabled}
                        placeholder="0"
                      />
                    </View>
                    <View style={styles.statField}>
                      <Text style={styles.statLabel}>{t('match.result.assistsLabel')}</Text>
                      <TextInput
                        style={styles.statInput}
                        keyboardType="numeric"
                        value={stat.assists}
                        onChangeText={(v) => setPlayerAssists(p.playerId!, v)}
                        placeholderTextColor={Colors.inkDisabled}
                        placeholder="0"
                      />
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {submitError && <Text style={styles.errorText}>{submitError}</Text>}

      {/* The one PrimaryButton; the tab dock owns this screen's glow. */}
      <PrimaryButton
        label={isSubmitting ? t('match.result.submitting') : t('match.result.submit')}
        onPress={() => { void handleSubmit() }}
        disabled={isSubmitting}
        loading={isSubmitting}
        glow={false}
      />
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
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 36,
    letterSpacing: Type.display.letterSpacing,
    textTransform: 'uppercase',
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  scoreField: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  scoreLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Type.labelCaps.fontFamily,
    letterSpacing: Type.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  scoreLabelA: {
    color: Colors.primary,
  },
  scoreInput: {
    // --type-numeral: the score owns this screen's giant numeral (tabular Bebas).
    color: Colors.ink,
    fontFamily: Type.numeral.fontFamily,
    fontSize: 80,
    letterSpacing: -0.8, // -0.01em @ 80
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: 0,
    width: '100%',
  },
  scoreSeparator: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.bebas,
    fontSize: 40,
  },
  statsSection: {
    gap: 10,
  },
  sectionTitle: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Type.labelCaps.fontFamily,
    letterSpacing: Type.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  rowsCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    gap: 1,
  },
  playerRow: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerName: {
    color: Colors.ink,
    fontSize: 14,
    fontFamily: Fonts.interMedium,
    flex: 1,
  },
  statFields: {
    flexDirection: 'row',
    gap: 10,
  },
  statField: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: Colors.inkSecondary,
    fontSize: 8.5,
    fontFamily: Type.micro.fontFamily,
    letterSpacing: Type.micro.letterSpacing,
    textTransform: 'uppercase',
  },
  statInput: {
    // Pill counter — stat register numerals on a raised pill.
    color: Colors.ink,
    fontFamily: Type.stat.fontFamily,
    fontSize: 16,
    letterSpacing: 0.64, // 0.04em @ 16
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 52,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
})
