import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { haptics } from '../../lib/haptics'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

type AttendanceStatus = 'in' | 'out' | 'unknown'

// Same props contract as the retired AttendanceToggle (Story 3.2) so call sites swap 1:1.
interface Props {
  status: AttendanceStatus
  isWaitlisted?: boolean
  waitlistPosition?: number
  onPress?: (newStatus: 'in' | 'out') => void
  disabled?: boolean
  /** Additive: h30 stamp rendering for roster rows (swiper rows, confirmed lists). */
  compact?: boolean
}

const ICON_IN = '✓'
const ICON_OUT = '✗'
const ICON_UNKNOWN = '?'
const LABEL_UNKNOWN = '—'

function stateA11yKey(status: AttendanceStatus): string {
  return status === 'in'
    ? 'attendance.toggle.in.a11y'
    : status === 'out'
      ? 'attendance.toggle.out.a11y'
      : 'attendance.toggle.unknown.a11y'
}

/**
 * The Prime Time attendance control. Full size: surface pill with h42 segments
 * (the player's one decision above the fold). Compact: h30 stamp pill for rows.
 * Every state carries text + icon — color is never the only signal.
 */
export function AttendanceSegmentedPill({ status, isWaitlisted, waitlistPosition, onPress, disabled, compact }: Props) {
  const { t } = useTranslation()

  if (isWaitlisted) {
    return (
      <View style={styles.waitlistContainer}>
        <Text
          style={styles.waitlistLabel}
          accessibilityLabel={t('attendance.toggle.waitlist.a11y', { position: waitlistPosition })}
        >
          {t('attendance.waitlist.label', { position: waitlistPosition })}
        </Text>
        {onPress && (
          <Pressable
            style={styles.withdrawPill}
            onPress={() => onPress('out')}
            disabled={disabled}
            accessibilityRole="button"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.withdrawText}>{t('attendance.waitlist.withdraw')}</Text>
          </Pressable>
        )}
      </View>
    )
  }

  const setStatus = (newStatus: 'in' | 'out') => {
    if (!onPress || disabled || newStatus === status) return
    haptics.selection()
    onPress(newStatus)
  }

  if (compact) {
    const stampStyle = status === 'in' ? styles.stampIn : status === 'out' ? styles.stampOut : styles.stampUnknown
    const stampText = status === 'in' ? styles.stampTextIn : status === 'out' ? styles.stampTextOut : styles.stampTextUnknown
    const icon = status === 'in' ? ICON_IN : status === 'out' ? ICON_OUT : ICON_UNKNOWN
    const label = status === 'in'
      ? t('attendance.toggle.in')
      : status === 'out'
        ? t('attendance.toggle.out')
        : LABEL_UNKNOWN

    // Interactive compact keeps the old toggle behavior: press flips in ↔ out.
    const handlePress = () => {
      if (!onPress || disabled) return
      setStatus(status === 'in' ? 'out' : 'in')
    }

    return (
      <Pressable
        style={[styles.stamp, stampStyle]}
        onPress={handlePress}
        disabled={disabled || !onPress}
        accessibilityLabel={t(stateA11yKey(status))}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Text style={[styles.stampText, stampText]}>{`${icon} ${label}`}</Text>
      </Pressable>
    )
  }

  return (
    <View
      style={[styles.container, disabled && styles.containerDisabled]}
      accessibilityLabel={t(stateA11yKey(status))}
    >
      <Pressable
        style={[styles.segment, status === 'in' && styles.segmentIn]}
        onPress={() => setStatus('in')}
        disabled={disabled || !onPress}
        accessibilityRole="button"
        accessibilityLabel={t('attendance.toggle.in.a11y')}
        accessibilityState={{ selected: status === 'in', disabled: disabled || !onPress }}
      >
        <Text style={[styles.segmentText, status === 'in' && styles.segmentTextIn]}>
          {`${ICON_IN} ${t('attendance.toggle.in')}`}
        </Text>
      </Pressable>

      <View
        style={[styles.segment, status === 'unknown' && styles.segmentUnknown]}
        accessibilityLabel={t('attendance.toggle.unknown.a11y')}
      >
        <Text style={[styles.segmentText, status === 'unknown' && styles.segmentTextUnknown]}>
          {`${ICON_UNKNOWN} ${LABEL_UNKNOWN}`}
        </Text>
      </View>

      <Pressable
        style={[styles.segment, status === 'out' && styles.segmentOut]}
        onPress={() => setStatus('out')}
        disabled={disabled || !onPress}
        accessibilityRole="button"
        accessibilityLabel={t('attendance.toggle.out.a11y')}
        accessibilityState={{ selected: status === 'out', disabled: disabled || !onPress }}
      >
        <Text style={[styles.segmentText, status === 'out' && styles.segmentTextOut]}>
          {`${ICON_OUT} ${t('attendance.toggle.out')}`}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  segment: {
    flex: 1,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentIn: {
    backgroundColor: Colors.successSubtle,
    borderWidth: 1.5,
    borderColor: 'rgba(50,215,75,0.4)',
  },
  segmentOut: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,56,0.4)',
  },
  segmentUnknown: {
    backgroundColor: Colors.surfaceRaised,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: Fonts.interBold,
    color: Colors.inkDisabled,
  },
  segmentTextIn: {
    color: Colors.success,
  },
  segmentTextOut: {
    color: Colors.primary,
  },
  segmentTextUnknown: {
    color: Colors.inkSecondary,
  },
  stamp: {
    height: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stampIn: {
    backgroundColor: Colors.successSubtle,
  },
  stampOut: {
    backgroundColor: Colors.primarySubtle,
  },
  stampUnknown: {
    backgroundColor: Colors.surfaceRaised,
  },
  stampText: {
    fontSize: 11,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.66, // 0.06em @ 11
  },
  stampTextIn: {
    color: Colors.success,
  },
  stampTextOut: {
    color: Colors.primary,
  },
  stampTextUnknown: {
    color: Colors.inkDisabled,
  },
  waitlistContainer: {
    gap: 6,
    alignItems: 'flex-start',
  },
  waitlistLabel: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  withdrawPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
  },
  withdrawText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
  },
})
