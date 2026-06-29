import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { GroupSwitcher } from '../../components/GroupSwitcher'
import { useGroupContext } from '../../contexts/GroupContext'
import { httpClient } from '../../lib/api-client'

interface MatchHistoryItem {
  matchId: string
  scheduledAt: string
  completedAt: string
  scoreA: number | null
  scoreB: number | null
  mvpDisplayName: string | null
  userTeamSide: 'A' | 'B' | null
  userResult: 'win' | 'loss' | 'draw' | null
}

export default function AccueilTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const { activeGroupId } = useGroupContext()
  const [switcherVisible, setSwitcherVisible] = useState(false)

  const { data: historyData } = useQuery({
    queryKey: ['match-history', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { matches: MatchHistoryItem[] } }>(`/v1/groups/${activeGroupId}/matches?status=completed&limit=10`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.switcherButton} onPress={() => setSwitcherVisible(true)}>
        <Text style={styles.switcherButtonText}>{t('groups.switcher.title')}</Text>
      </Pressable>

      {!activeGroupId && (
        <View style={styles.noGroup}>
          <Text style={styles.noGroupText}>{t('auth.shell.noGroup')}</Text>
          <Pressable style={styles.createButton} onPress={() => router.push('/(app)/groups/new')}>
            <Text style={styles.createButtonText}>{t('auth.shell.createGroup')}</Text>
          </Pressable>
          <Pressable style={styles.searchButton} onPress={() => router.push('/(app)/groups/search')}>
            <Text style={styles.searchButtonText}>{t('groups.search.title')}</Text>
          </Pressable>
        </View>
      )}

      {activeGroupId && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>{t('accueil.history.title')}</Text>
          {(!historyData || historyData.matches.length === 0) ? (
            <Text style={styles.historyEmpty}>{t('accueil.history.empty')}</Text>
          ) : (
            historyData.matches.map((match) => (
              <Pressable
                key={match.matchId}
                style={styles.matchCard}
                onPress={() => router.push(`/(app)/match/${match.matchId}` as never)}
              >
                <View style={styles.matchCardLeft}>
                  <Text style={styles.matchDate}>
                    {new Date(match.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={styles.matchScore}>
                    {match.scoreA !== null && match.scoreB !== null
                      ? `${match.scoreA}–${match.scoreB}`
                      : '—–—'}
                  </Text>
                </View>
                {match.userResult && (
                  <View style={[
                    styles.resultBadge,
                    match.userResult === 'win' && styles.resultWin,
                    match.userResult === 'loss' && styles.resultLoss,
                    match.userResult === 'draw' && styles.resultDraw,
                  ]}>
                    <Text style={styles.resultText}>
                      {match.userResult === 'win' ? 'W' : match.userResult === 'loss' ? 'L' : 'D'}
                    </Text>
                  </View>
                )}
                <Text style={styles.matchMvp} numberOfLines={1}>
                  {match.mvpDisplayName ? `MVP: ${match.mvpDisplayName}` : ''}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      <GroupSwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flexGrow: 1,
  },
  switcherButton: {
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    alignItems: 'center',
  },
  switcherButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  noGroup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noGroupText: {
    color: Colors.inkSecondary,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
  },
  createButtonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  searchButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.inkSecondary,
  },
  searchButtonText: {
    color: Colors.inkSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  historySection: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { color: Colors.inkSecondary, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  historyEmpty: { color: Colors.inkSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 16 },
  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4, gap: 12 },
  matchCardLeft: { flex: 0, width: 80, gap: 2 },
  matchDate: { color: Colors.inkSecondary, fontSize: 11, fontFamily: 'Inter_400Regular' },
  matchScore: { color: Colors.ink, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 1 },
  resultBadge: { width: 28, height: 28, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  resultWin: { backgroundColor: 'rgba(50,215,75,0.15)' },
  resultLoss: { backgroundColor: 'rgba(255,59,71,0.15)' },
  resultDraw: { backgroundColor: 'rgba(255,255,255,0.05)' },
  resultText: { color: Colors.ink, fontSize: 14, fontFamily: 'Inter_700Bold' },
  matchMvp: { flex: 1, color: Colors.inkSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right' },
})
