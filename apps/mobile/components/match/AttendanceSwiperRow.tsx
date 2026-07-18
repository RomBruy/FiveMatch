import { useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/tokens'
import { AttendanceSegmentedPill } from './AttendanceSegmentedPill'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'

interface Props {
  playerId: string | null
  displayName: string | null
  status: 'in' | 'out' | 'unknown'
  isWaitlisted?: boolean
  waitlistPosition?: number
  onSwipeIn?: () => void
  onSwipeOut?: () => void
  onTogglePress?: (newStatus: 'in' | 'out') => void
  disabled?: boolean
}

export function AttendanceSwiperRow({
  displayName,
  status,
  isWaitlisted,
  waitlistPosition,
  onSwipeIn,
  onSwipeOut,
  onTogglePress,
  disabled,
}: Props) {
  const { t } = useTranslation()
  const swipeableRef = useRef<Swipeable>(null)

  const renderLeftActions = () => {
    if (!onSwipeIn) return null
    return (
      <View style={styles.actionLeft}>
        <Text style={styles.actionText}>{t('attendance.swipe.markIn')}</Text>
      </View>
    )
  }

  const renderRightActions = () => {
    if (!onSwipeOut) return null
    return (
      <View style={styles.actionRight}>
        <Text style={styles.actionText}>{t('attendance.swipe.markOut')}</Text>
      </View>
    )
  }

  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    swipeableRef.current?.close()
    if (direction === 'left' && onSwipeIn) onSwipeIn()
    if (direction === 'right' && onSwipeOut) onSwipeOut()
  }

  if (disabled) {
    return (
      <View style={styles.row}>
        {displayName != null && <DuotoneAvatar displayName={displayName} size={28} />}
        <Text style={styles.name} numberOfLines={1}>{displayName ?? '—'}</Text>
        <AttendanceSegmentedPill compact status={status} isWaitlisted={isWaitlisted} waitlistPosition={waitlistPosition} />
      </View>
    )
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeableOpen}
    >
      <View style={styles.row}>
        {displayName != null && <DuotoneAvatar displayName={displayName} size={28} />}
        <Text style={styles.name} numberOfLines={1}>{displayName ?? '—'}</Text>
        <AttendanceSegmentedPill
          compact
          status={status}
          isWaitlisted={isWaitlisted}
          waitlistPosition={waitlistPosition}
          onPress={onTogglePress}
        />
      </View>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    gap: 10,
  },
  name: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
    flex: 1,
    marginRight: 12,
  },
  actionLeft: {
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionRight: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionText: {
    color: Colors.ink,
    fontSize: 13,
    fontFamily: Fonts.interBold,
  },
})
