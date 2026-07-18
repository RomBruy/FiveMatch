import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { httpClient } from '../../lib/api-client'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { StatTile } from '../../components/ui/StatTile'

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

function CountRows({ rows }: { rows: { label: string; value: number }[] }) {
  return (
    <View style={styles.card}>
      {rows.map((row, idx) => (
        <View key={row.label} style={[styles.countRow, idx < rows.length - 1 && styles.countRowBorder]}>
          <Text style={styles.countLabel}>{row.label}</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

export default function AdminMetricsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

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

  const tiles: { label: string; value: number }[] = [
    { label: t('admin.metrics.totalGroups'), value: data.totalGroups },
    { label: t('admin.metrics.totalActiveUsers'), value: data.totalActiveUsers },
    { label: t('admin.metrics.totalDeletedUsers'), value: data.totalDeletedUsers },
    { label: t('admin.metrics.totalMatches'), value: data.totalMatches },
    { label: t('admin.metrics.activeGroupsLast30Days'), value: data.activeGroupsLast30Days },
    { label: t('admin.metrics.totalRatingsSubmitted'), value: data.totalRatingsSubmitted },
    { label: t('admin.metrics.totalCardPhotoJobs'), value: data.totalCardPhotoJobs },
  ]

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>{t('admin.metrics.title')}</Text>

      <View style={styles.tileGrid}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} value={tile.value} label={tile.label} style={styles.tile} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('admin.metrics.sections.matchesByStatus').toUpperCase()}</Text>
      <CountRows
        rows={[
          { label: t('admin.metrics.matchesByStatus.planning'), value: data.matchesByStatus.planning },
          { label: t('admin.metrics.matchesByStatus.attendanceLocked'), value: data.matchesByStatus.attendanceLocked },
          { label: t('admin.metrics.matchesByStatus.inProgress'), value: data.matchesByStatus.inProgress },
          { label: t('admin.metrics.matchesByStatus.completed'), value: data.matchesByStatus.completed },
          { label: t('admin.metrics.matchesByStatus.cancelled'), value: data.matchesByStatus.cancelled },
        ]}
      />

      <Text style={styles.sectionLabel}>{t('admin.metrics.sections.cardPhotoJobs').toUpperCase()}</Text>
      <CountRows
        rows={[
          { label: t('admin.metrics.cardPhotoJobsByState.idle'), value: data.cardPhotoJobsByState.idle },
          { label: t('admin.metrics.cardPhotoJobsByState.pending'), value: data.cardPhotoJobsByState.pending },
          { label: t('admin.metrics.cardPhotoJobsByState.processing'), value: data.cardPhotoJobsByState.processing },
          { label: t('admin.metrics.cardPhotoJobsByState.complete'), value: data.cardPhotoJobsByState.complete },
          { label: t('admin.metrics.cardPhotoJobsByState.failed'), value: data.cardPhotoJobsByState.failed },
        ]}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg, gap: 12 },
  loadingText: { color: Colors.inkSecondary, fontSize: 14, fontFamily: Fonts.inter },
  title: {
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: Type.heading.maxSize,
    letterSpacing: Type.heading.letterSpacing,
    marginBottom: 20,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  sectionLabel: {
    color: Colors.inkDisabled,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 10.5,
    letterSpacing: 1.68, // 0.16em @ 10.5 (label-caps register)
    marginTop: 22,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  countRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairline,
  },
  countLabel: { color: Colors.ink, fontSize: 13.5, fontFamily: Fonts.interSemiBold, flex: 1 },
  countPill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  countPillText: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 0.66, // 0.06em @ 11
  },
})
