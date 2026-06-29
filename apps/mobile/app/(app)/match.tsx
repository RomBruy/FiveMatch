import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { useGroupContext } from '../../contexts/GroupContext'
import { InfoStrip } from '../../components/shared/InfoStrip'
import { httpClient } from '../../lib/api-client'

interface TeamGenStatus {
  canGenerate: boolean
  reason: string | null
  ratedPlayerCount: number
  minimumRequired: number
  fairnessConfidenceDisclaimer: string | null
}

interface MatchSummary {
  matchId: string
  status: string
  scheduledAt: string
  location: string | null
  format: string
  playersPerTeam: number
}

export default function MatchTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const { activeGroupId } = useGroupContext()

  const { data: myStatus } = useQuery({
    queryKey: ['groups', activeGroupId, 'my-status'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { role: string } }>(
        `/v1/groups/${activeGroupId}/my-status`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId),
  })

  const isOrganizer = myStatus?.role === 'organizer'

  const { data: status } = useQuery({
    queryKey: ['team-generator-status', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: TeamGenStatus }>(`/v1/groups/${activeGroupId}/team-generator/status`)
        .then((r) => r.data.data),
    enabled: Boolean(activeGroupId),
  })

  const { data: activeMatch, isLoading: matchLoading } = useQuery({
    queryKey: ['matches', activeGroupId, 'active'],
    queryFn: async () => {
      // GET /v1/groups/:groupId/matches returns the most recent non-completed match
      // This endpoint will be implemented in Story 3.2; returns null until then
      const { data } = await httpClient.get<{ data: MatchSummary | null }>(
        `/v1/groups/${activeGroupId}/matches/active`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId),
    // Gracefully handle 404 until Story 3.2 ships the list endpoint
    retry: false,
  })

  if (!activeGroupId) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{t('auth.shell.noGroup')}</Text>
        <Pressable style={styles.button} onPress={() => router.push('/(app)/groups/new' as never)}>
          <Text style={styles.buttonText}>{t('auth.shell.createGroup')}</Text>
        </Pressable>
      </View>
    )
  }

  const canGenerate = status?.canGenerate ?? false
  const missing = status ? status.minimumRequired - status.ratedPlayerCount : 0

  return (
    <View style={styles.container}>
      <View style={styles.gateSection}>
        {status?.fairnessConfidenceDisclaimer != null && (
          <InfoStrip
            variant="warning"
            pulsing
            message={t('match.teamGen.fairnessDisclaimer')}
          />
        )}
        {!canGenerate && status && (
          <InfoStrip
            variant="info"
            message={t('match.teamGen.insufficientPlayers', {
              minimum: status.minimumRequired,
              missing,
            })}
          />
        )}

        {matchLoading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : activeMatch ? (
          <Pressable
            style={styles.activeMatchButton}
            onPress={() => {
              const dest = isOrganizer
                ? `/(app)/match/organizer?matchId=${activeMatch.matchId}`
                : `/(app)/match/player?matchId=${activeMatch.matchId}`
              router.push(dest as never)
            }}
          >
            <Text style={styles.activeMatchLabel}>
              {new Date(activeMatch.scheduledAt).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Text style={styles.activeMatchSublabel}>
              {activeMatch.format.toUpperCase()}
              {activeMatch.location ? ` · ${activeMatch.location}` : ''}
            </Text>
          </Pressable>
        ) : (
          <>
            {!isOrganizer && (
              <Text style={styles.emptyText}>{t('match.empty.noMatch')}</Text>
            )}
          </>
        )}

        {isOrganizer && !activeMatch && (
          <Pressable
            style={styles.createButton}
            onPress={() => router.push('/(app)/match/create' as never)}
          >
            <Text style={styles.createButtonText}>{t('match.cta.create')}</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
          disabled={!canGenerate}
          // onPress wired in Story 3.5
        >
          <Text style={styles.generateButtonText}>
            {t('match.teamGen.generateButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
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
  gateSection: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  loader: {
    marginVertical: 8,
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  activeMatchButton: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  activeMatchLabel: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  activeMatchSublabel: {
    color: Colors.inkSecondary,
    fontSize: 13,
  },
  createButton: {
    width: '100%',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  createButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 4,
    width: '100%',
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.35,
  },
  generateButtonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
