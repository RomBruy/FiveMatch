import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { useGroupContext } from '../../contexts/GroupContext'
import { InfoStrip } from '../../components/shared/InfoStrip'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { httpClient } from '../../lib/api-client'

const SEPARATOR = ' · '

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
  seriesId: string | null
}

export default function MatchTab() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
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

  const { data: upcomingData, isLoading: matchLoading } = useQuery({
    queryKey: ['matches', activeGroupId, 'upcoming'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { matches: MatchSummary[] } }>(
        `/v1/groups/${activeGroupId}/matches?status=upcoming&limit=10`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId),
    retry: false,
  })

  const upcoming = upcomingData?.matches ?? []
  const [nextMatch, ...laterMatches] = upcoming

  if (!activeGroupId) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{t('auth.shell.noGroup')}</Text>
        <View style={styles.fullWidth}>
          {/* The tab dock owns this screen's one glow. */}
          <PrimaryButton
            label={t('auth.shell.createGroup')}
            onPress={() => router.push('/(app)/groups/new' as never)}
            glow={false}
          />
        </View>
      </View>
    )
  }

  const canGenerate = status?.canGenerate ?? false
  const missing = status ? status.minimumRequired - status.ratedPlayerCount : 0

  const openMatch = (match: MatchSummary) => {
    const dest = isOrganizer
      ? `/(app)/match/organizer?matchId=${match.matchId}`
      : `/(app)/match/player?matchId=${match.matchId}`
    router.push(dest as never)
  }

  const formatRowDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
    >
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
      </View>

      <Text style={styles.sectionLabel}>{t('match.upcoming.title')}</Text>

      {matchLoading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : nextMatch ? (
        <>
          <Pressable style={styles.activeMatchCard} onPress={() => openMatch(nextMatch)} accessibilityRole="button">
            <Text style={styles.activeMatchDate}>{formatRowDate(nextMatch.scheduledAt)}</Text>
            <Text style={styles.activeMatchMeta}>
              {[
                nextMatch.format.toUpperCase(),
                ...(nextMatch.location ? [nextMatch.location] : []),
                ...(nextMatch.seriesId ? [t('match.upcoming.series')] : []),
              ].join(SEPARATOR)}
            </Text>
          </Pressable>
          {laterMatches.length > 0 && (
            <View style={styles.laterRows}>
              {laterMatches.map((match) => (
                <Pressable
                  key={match.matchId}
                  style={styles.laterRow}
                  onPress={() => openMatch(match)}
                  accessibilityRole="button"
                >
                  <Text style={styles.laterRowDate}>{formatRowDate(match.scheduledAt)}</Text>
                  <Text style={styles.laterRowMeta} numberOfLines={1}>
                    {[
                      ...(match.location ? [match.location] : []),
                      ...(match.seriesId ? [t('match.upcoming.series')] : []),
                    ].join(SEPARATOR)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>{t('match.empty.noMatch')}</Text>
      )}

      {isOrganizer && (
        <View style={styles.actionBlock}>
          {/* The tab dock owns this screen's one glow. */}
          <PrimaryButton
            label={t('match.cta.create')}
            onPress={() => router.push('/(app)/match/create' as never)}
            glow={false}
          />
        </View>
      )}

      <View style={styles.actionBlock}>
        {/* onPress wired in Story 3.5 */}
        <SecondaryButton label={t('match.teamGen.generateButton')} disabled={!canGenerate} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: DOCK_CLEARANCE,
  },
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 12,
  },
  laterRows: {
    marginTop: 10,
    gap: 8,
  },
  laterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  laterRowDate: {
    color: Colors.ink,
    fontFamily: Fonts.interSemiBold,
    fontSize: 13.5,
    textTransform: 'capitalize',
  },
  laterRowMeta: {
    flexShrink: 1,
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  actionBlock: {
    width: '100%',
    marginTop: 20,
  },
  message: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
    marginBottom: 24,
  },
  fullWidth: {
    width: '100%',
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
    fontFamily: Fonts.inter,
    textAlign: 'center',
    marginVertical: 8,
  },
  activeMatchCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    gap: 4,
  },
  activeMatchDate: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.92, // 0.08em @ 24 (heading register)
    textTransform: 'capitalize',
  },
  activeMatchMeta: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
})
