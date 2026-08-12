import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { PressableScale } from '../ui/PressableScale'

type AttentionItem = {
  type: 'record_result' | 'finalize_attendance' | 'rate_opponents' | 'answer_rsvp'
  matchId: string
  scheduledAt: string
  venueName: string | null
  city: string | null
}

const ICONS: Record<AttentionItem['type'], keyof typeof Ionicons.glyphMap> = {
  record_result: 'football-outline',
  finalize_attendance: 'clipboard-outline',
  rate_opponents: 'star-outline',
  answer_rsvp: 'help-circle-outline',
}

export function useAttention() {
  return useQuery<AttentionItem[]>({
    queryKey: ['attention'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: AttentionItem[] }>('/v1/players/me/attention')
      return data.data
    },
  })
}

/**
 * What is waiting on you, at the top of Mes matchs.
 *
 * The server decides the order, by how much someone else is blocked — a host
 * who has not recorded a result is holding up everyone's ratings and cards,
 * while an unanswered RSVP only affects the person who owes it. Sorting here
 * instead would put that judgement somewhere it cannot be tested.
 *
 * Renders nothing when there is nothing to do. An empty "needs attention" box
 * is worse than no box: it trains people to ignore the space.
 */
export function NeedsAttention() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data: items } = useAttention()

  if (!items || items.length === 0) return null

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }).toUpperCase()

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('attention.title').toUpperCase()}</Text>

      {items.slice(0, 5).map((item) => (
        <PressableScale
          key={`${item.type}-${item.matchId}`}
          onPress={() => router.push(`/(app)/match/${item.matchId}` as never)}
          style={styles.row}
          accessibilityRole="button"
        >
          <Ionicons name={ICONS[item.type]} size={18} color={Colors.primary} />
          <View style={styles.text}>
            <Text style={styles.action} numberOfLines={1}>{t(`attention.${item.type}`)}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {dateLabel(item.scheduledAt)}
              {item.venueName || item.city ? ` · ${item.venueName ?? item.city}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
        </PressableScale>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8, marginBottom: 4 },
  sectionLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  text: { flex: 1, gap: 3 },
  action: { fontFamily: Fonts.interSemiBold, fontSize: 14, color: Colors.ink },
  meta: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled },
})
