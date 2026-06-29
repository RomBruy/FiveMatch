import { useState } from 'react'
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'
import { posthog } from '../../../lib/posthog'

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('match.result.title')}</Text>

      <View style={styles.scoreRow}>
        <View style={styles.scoreField}>
          <Text style={styles.scoreLabel}>{t('match.result.teamAScore')}</Text>
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
          {participants.map((p) => {
            if (!p.playerId) return null
            const stat = getPlayerStat(p.playerId)
            return (
              <View key={p.playerId} style={styles.playerRow}>
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
      )}

      {submitError && <Text style={styles.errorText}>{submitError}</Text>}

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={() => { void handleSubmit() }}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={t('match.result.submit')}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? t('match.result.submitting') : t('match.result.submit')}
        </Text>
      </Pressable>
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
  title: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    padding: 16,
  },
  scoreField: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  scoreLabel: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scoreInput: {
    color: Colors.ink,
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: '100%',
  },
  scoreSeparator: {
    color: Colors.inkSecondary,
    fontSize: 28,
    fontWeight: '300',
  },
  statsSection: {
    gap: 1,
  },
  sectionTitle: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingVertical: 8,
  },
  playerRow: {
    backgroundColor: Colors.surface,
    borderRadius: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 1,
  },
  playerName: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  statFields: {
    flexDirection: 'row',
    gap: 8,
  },
  statField: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statInput: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 52,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    height: 54,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.35,
  },
  submitButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
