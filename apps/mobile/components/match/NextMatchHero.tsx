import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Gradients } from '../../constants/gradients'
import { Fonts, Radius } from '../../constants/tokens'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { AttendanceSegmentedPill } from './AttendanceSegmentedPill'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_STACK_AVATARS = 4

interface ConfirmedPlayer {
  playerId: string | null
  displayName: string | null
}

interface NextMatchHeroProps {
  scheduledAt: string
  location: string | null
  confirmed: ConfirmedPlayer[]
  /** Squad size the confirmed count reads against (roster length). */
  squadTotal: number
  myStatus: 'in' | 'out' | 'unknown'
  isWaitlisted?: boolean
  waitlistPosition?: number
  /** Absent while attendance is closed — the pill renders read-only. */
  onSetAttendance?: (status: 'in' | 'out') => void
  onPress: () => void
}

/**
 * The Accueil hero — the screen's one giant numeral (76px kick-off time) on the
 * ember-corner card, with the avatar stack of confirmed players and the
 * player's one decision (the attendance pill) above the fold.
 */
export function NextMatchHero({
  scheduledAt,
  location,
  confirmed,
  squadTotal,
  myStatus,
  isWaitlisted,
  waitlistPosition,
  onSetAttendance,
  onPress,
}: NextMatchHeroProps) {
  const { t, i18n } = useTranslation()

  const kickoff = new Date(scheduledAt)
  const dateLabel = kickoff
    .toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
  // 24h clock in both locales — the athletic register (matches the mockup's 19:00).
  const timeLabel = kickoff.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const matchDayStart = new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate()).getTime()
  const daysUntil = Math.round((matchDayStart - todayStart) / MS_PER_DAY)

  const stack = confirmed.slice(0, MAX_STACK_AVATARS)
  const overflow = confirmed.length - stack.length

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('accueil.hero.a11y', { date: `${dateLabel} ${timeLabel}` })}
    >
      <LinearGradient
        colors={Gradients.heroEmber}
        locations={[0, 0.55]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.65, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <Text style={styles.label}>{`${t('accueil.hero.label')} · ${dateLabel}`}</Text>
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText}>
              {daysUntil <= 0 ? t('accueil.hero.today') : t('accueil.hero.daysUntil', { count: daysUntil })}
            </Text>
          </View>
        </View>

        <Text style={styles.kickoff}>{timeLabel}</Text>

        {location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color={Colors.inkSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
          </View>
        )}

        <View style={styles.squadRow}>
          <View style={styles.stack}>
            {stack.map((player, index) => (
              <View key={player.playerId ?? `slot-${index}`} style={index > 0 && styles.stackOverlap}>
                <DuotoneAvatar displayName={player.displayName ?? '?'} size={30} />
              </View>
            ))}
            {overflow > 0 && (
              <View style={[styles.overflowBubble, stack.length > 0 && styles.stackOverlap]}>
                <Text style={styles.overflowText}>{`+${overflow}`}</Text>
              </View>
            )}
          </View>
          <Text style={styles.countText}>
            <Text style={styles.countConfirmed}>
              {t('accueil.hero.confirmedCount', { count: confirmed.length })}
            </Text>
            <Text style={styles.countTotal}>{` ${t('accueil.hero.squadTotal', { count: squadTotal })}`}</Text>
          </Text>
        </View>

        <View style={styles.pillWrap}>
          <AttendanceSegmentedPill
            status={myStatus}
            isWaitlisted={isWaitlisted}
            waitlistPosition={waitlistPosition}
            onPress={onSetAttendance}
            disabled={!onSetAttendance}
          />
        </View>
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flexShrink: 1,
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.32, // 0.12em @ 11 (caps label register)
    textTransform: 'uppercase',
  },
  dayPill: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayPillText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.66, // 0.06em @ 11
  },
  kickoff: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 76,
    lineHeight: 76,
    marginTop: 10,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flexShrink: 1,
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.interMedium,
  },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackOverlap: {
    marginLeft: -8,
  },
  overflowBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
  },
  countText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontFamily: Fonts.interSemiBold,
    textAlign: 'right',
  },
  countConfirmed: {
    color: Colors.success,
  },
  countTotal: {
    color: Colors.inkSecondary,
  },
  pillWrap: {
    marginTop: 16,
  },
})
