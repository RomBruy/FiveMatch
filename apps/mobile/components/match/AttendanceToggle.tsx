import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

interface Props {
  status: 'in' | 'out' | 'unknown'
  isWaitlisted?: boolean
  waitlistPosition?: number
  onPress?: (newStatus: 'in' | 'out') => void
  disabled?: boolean
}

export function AttendanceToggle({ status, isWaitlisted, waitlistPosition, onPress, disabled }: Props) {
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
            style={styles.withdrawButton}
            onPress={() => onPress('out')}
            disabled={disabled}
          >
            <Text style={styles.withdrawText}>{t('attendance.waitlist.withdraw')}</Text>
          </Pressable>
        )}
      </View>
    )
  }

  const handlePress = () => {
    if (!onPress || disabled) return
    if (status === 'in') {
      onPress('out')
    } else {
      onPress('in')
    }
  }

  const stateStyle = status === 'in'
    ? styles.stateIn
    : status === 'out'
      ? styles.stateOut
      : styles.stateUnknown

  const textStyle = status === 'in'
    ? styles.textIn
    : status === 'out'
      ? styles.textOut
      : styles.textUnknown

  const a11yLabel = status === 'in'
    ? t('attendance.toggle.in.a11y')
    : status === 'out'
      ? t('attendance.toggle.out.a11y')
      : t('attendance.toggle.unknown.a11y')

  const icon = status === 'in' ? '✓' : status === 'out' ? '✗' : '?'
  const label = status === 'in'
    ? t('attendance.toggle.in')
    : status === 'out'
      ? t('attendance.toggle.out')
      : t('attendance.toggle.unknown')

  return (
    <Pressable
      style={[styles.toggle, stateStyle]}
      onPress={handlePress}
      disabled={disabled || !onPress}
      accessibilityLabel={a11yLabel}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, textStyle]}>{icon}</Text>
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  toggle: {
    width: 64,
    height: 30,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stateIn: {
    backgroundColor: 'rgba(50,215,75,0.15)',
    borderColor: Colors.success,
  },
  stateOut: {
    backgroundColor: 'rgba(255,59,71,0.15)',
    borderColor: Colors.primary,
  },
  stateUnknown: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'transparent',
  },
  icon: {
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textIn: {
    color: Colors.success,
  },
  textOut: {
    color: Colors.primary,
  },
  textUnknown: {
    color: Colors.inkDisabled,
  },
  waitlistContainer: {
    gap: 4,
    alignItems: 'flex-start',
  },
  waitlistLabel: {
    color: Colors.inkDisabled,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  withdrawButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  withdrawText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
})
