import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { httpClient } from '../../lib/api-client'
import { Colors } from '../../constants/colors'

interface AdminMetrics {
  totalGroups: number
  totalActiveUsers: number
  totalDeletedUsers: number
  totalMatches: number
  matchesByStatus: {
    planning: number
    attendanceLocked: number
    inProgress: number
    completed: number
    cancelled: number
  }
  activeGroupsLast30Days: number
  totalRatingsSubmitted: number
  totalCardPhotoJobs: number
  cardPhotoJobsByState: {
    idle: number
    pending: number
    processing: number
    complete: number
    failed: number
  }
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

export default function AdminMetricsScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      const res = await httpClient.get<{ data: AdminMetrics }>('/v1/admin/metrics')
      return res.data.data
    },
    retry: false,
  })

  useEffect(() => {
    if (isError) {
      router.replace('/(app)')
    }
  }, [isError, router])

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>{t('admin.metrics.loading')}</Text>
      </View>
    )
  }

  if (!data) return null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('admin.metrics.title')}</Text>

      <View style={styles.section}>
        <StatRow label={t('admin.metrics.totalGroups')} value={data.totalGroups} />
        <StatRow label={t('admin.metrics.totalActiveUsers')} value={data.totalActiveUsers} />
        <StatRow label={t('admin.metrics.totalDeletedUsers')} value={data.totalDeletedUsers} />
        <StatRow label={t('admin.metrics.totalMatches')} value={data.totalMatches} />
        <StatRow label={t('admin.metrics.activeGroupsLast30Days')} value={data.activeGroupsLast30Days} />
        <StatRow label={t('admin.metrics.totalRatingsSubmitted')} value={data.totalRatingsSubmitted} />
        <StatRow label={t('admin.metrics.totalCardPhotoJobs')} value={data.totalCardPhotoJobs} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('admin.metrics.matchesByStatus.planning')}</Text>
        <StatRow label={t('admin.metrics.matchesByStatus.planning')} value={data.matchesByStatus.planning} />
        <StatRow label={t('admin.metrics.matchesByStatus.attendanceLocked')} value={data.matchesByStatus.attendanceLocked} />
        <StatRow label={t('admin.metrics.matchesByStatus.inProgress')} value={data.matchesByStatus.inProgress} />
        <StatRow label={t('admin.metrics.matchesByStatus.completed')} value={data.matchesByStatus.completed} />
        <StatRow label={t('admin.metrics.matchesByStatus.cancelled')} value={data.matchesByStatus.cancelled} />
      </View>

      <View style={styles.section}>
        <StatRow label={t('admin.metrics.cardPhotoJobsByState.idle')} value={data.cardPhotoJobsByState.idle} />
        <StatRow label={t('admin.metrics.cardPhotoJobsByState.pending')} value={data.cardPhotoJobsByState.pending} />
        <StatRow label={t('admin.metrics.cardPhotoJobsByState.processing')} value={data.cardPhotoJobsByState.processing} />
        <StatRow label={t('admin.metrics.cardPhotoJobsByState.complete')} value={data.cardPhotoJobsByState.complete} />
        <StatRow label={t('admin.metrics.cardPhotoJobsByState.failed')} value={data.cardPhotoJobsByState.failed} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.inkSecondary, fontSize: 14 },
  title: { color: Colors.ink, fontSize: 24, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionLabel: { color: Colors.inkSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceRaised },
  statLabel: { color: Colors.inkSecondary, fontSize: 14 },
  statValue: { color: Colors.ink, fontSize: 16, fontWeight: '600' },
})
