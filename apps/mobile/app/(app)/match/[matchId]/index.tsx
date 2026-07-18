import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../../constants/colors'
import { Fonts } from '../../../../constants/tokens'
import { httpClient } from '../../../../lib/api-client'
import { useGroupContext } from '../../../../contexts/GroupContext'
import { LockedPitchBoard } from '../../../../components/match/PitchBoard'
import { DOCK_CLEARANCE } from '../../../../components/ui/TabDock'

interface MatchDetail {
  matchId: string
  status: 'planning' | 'attendance_open' | 'attendance_locked' | 'teams_generated' | 'in_progress' | 'completed' | 'cancelled'
}

// Composition view — the locked-teams Pitch Board (Story 9.8). Other match
// states keep the placeholder until their views land.
export default function MatchDetailScreen() {
  const { t } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { activeGroupId } = useGroupContext()
  const insets = useSafeAreaInsets()

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MatchDetail }>(
        `/v1/groups/${activeGroupId}/matches/${matchId}`,
      )
      return data.data
    },
    enabled: Boolean(activeGroupId) && Boolean(matchId),
  })

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (match?.status === 'in_progress' && activeGroupId && matchId) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      >
        <LockedPitchBoard groupId={activeGroupId} matchId={matchId} />
      </ScrollView>
    )
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.placeholder}>{t('match.detail.comingSoon')}</Text>
    </View>
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
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholder: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
})
