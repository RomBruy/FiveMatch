import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { PressableScale } from '../ui/PressableScale'
import { SpotsMeter } from './SpotsMeter'
import { currencySymbol } from '../../lib/currency'
import type { SkillLevel } from '../../lib/matches'

export interface MatchCardProps {
  scheduledAt: string
  venueName: string | null
  city: string | null
  location: string | null
  distanceKm: number | null
  format: string
  skillLevel: SkillLevel
  pricePerPlayer: number | null
  currency?: string
  confirmedCount: number
  capacity: number
  spotsRemaining: number
  hostDisplayName?: string | null
  joined?: boolean
  onPress: () => void
}

const SEPARATOR = ' · '

/**
 * The unit of the product. Same card in discovery and in "my matches", because
 * they are the same object seen from two sides — a group's open spot and a
 * stranger's available game are one row, not two features.
 */
export function MatchCard({
  scheduledAt,
  venueName,
  city,
  location,
  distanceKm,
  format,
  skillLevel,
  pricePerPlayer,
  currency = 'EUR',
  confirmedCount,
  capacity,
  spotsRemaining,
  hostDisplayName,
  joined = false,
  onPress,
}: MatchCardProps) {
  const { t, i18n } = useTranslation()
  const date = new Date(scheduledAt)

  const dayLabel = date
    .toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
  const timeLabel = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  const place = venueName ?? location ?? city
  const meta = [
    format.toUpperCase(),
    t(`player.level.${skillLevel}`).toUpperCase(),
    ...(distanceKm !== null ? [t('discover.distance', { km: distanceKm })] : city ? [city] : []),
  ].join(SEPARATOR)

  return (
    <PressableScale style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.header}>
        <View style={styles.when}>
          <Text style={styles.day}>{dayLabel}</Text>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        {joined && (
          <View style={styles.joinedBadge}>
            <Ionicons name="checkmark" size={12} color={Colors.success} />
            <Text style={styles.joinedText}>{t('match.joined')}</Text>
          </View>
        )}
      </View>

      {place && (
        <Text style={styles.place} numberOfLines={1}>{place}</Text>
      )}
      <Text style={styles.meta} numberOfLines={1}>{meta}</Text>

      <View style={styles.footer}>
        <SpotsMeter confirmed={confirmedCount} capacity={capacity} spotsRemaining={spotsRemaining} />
        <View style={styles.footerRight}>
          {pricePerPlayer !== null && pricePerPlayer > 0 && (
            <Text style={styles.price}>
              {t('match.pricePerPlayer', {
                amount: pricePerPlayer.toFixed(2).replace(/\.00$/, ''),
                currency: currencySymbol(currency),
              })}
            </Text>
          )}
          {hostDisplayName && (
            <Text style={styles.host} numberOfLines={1}>
              {t('match.hostedBy', { name: hostDisplayName })}
            </Text>
          )}
        </View>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  when: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  day: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.inkSecondary,
  },
  time: {
    fontFamily: Fonts.bebas,
    fontSize: 28,
    letterSpacing: 1.4,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  joinedText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.success,
  },
  place: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.ink,
    marginTop: 2,
  },
  meta: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  footerRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 1,
  },
  price: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  host: {
    fontFamily: Fonts.inter,
    fontSize: 10,
    color: Colors.inkDisabled,
  },
})
