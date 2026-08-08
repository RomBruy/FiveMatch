import { View, Text, StyleSheet, Pressable, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import type { SkillLevel } from '../../lib/matches'

interface TrustRowProps {
  skillLevel: SkillLevel | null
  /**
   * The earned check mark. Deliberately a boolean and not a score: absence means
   * "not yet", never "unreliable", and there is no failing counterpart to show
   * (ADR-019).
   */
  isReliable: boolean
  matchCount: number
  size?: 'sm' | 'md'
}

const LEVEL_COLOR: Record<SkillLevel, string> = {
  casual: Colors.inkSecondary,
  intermediate: Colors.rankSilver,
  competitive: Colors.gold,
}

/**
 * What a stranger and a host actually need from each other before a match.
 *
 * OVR is deliberately absent here. It answers "how good are they", which nobody
 * can act on when deciding whether to let someone into a Wednesday game; these
 * three answer "will they turn up, and will the level match", which is the real
 * question on both sides. OVR lives on the profile, as a reward.
 */
export function TrustRow({ skillLevel, isReliable, matchCount, size = 'md' }: TrustRowProps) {
  const { t } = useTranslation()
  const small = size === 'sm'

  // A bare check reads as "identity verified" to anyone who has used Instagram.
  // Tapping says what it actually means here.
  const explain = () => Alert.alert(t('player.reliable.title'), t('player.reliable.explain'))

  return (
    <View style={styles.row}>
      {skillLevel && (
        <View style={[styles.pill, small && styles.pillSmall]}>
          <View style={[styles.dot, { backgroundColor: LEVEL_COLOR[skillLevel] }]} />
          <Text style={[styles.pillText, small && styles.pillTextSmall]}>
            {t(`player.level.${skillLevel}`)}
          </Text>
        </View>
      )}

      {isReliable && (
        <Pressable
          onPress={explain}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('player.reliable.explain')}
          style={[styles.pill, small && styles.pillSmall]}
        >
          <Ionicons name="checkmark-circle" size={small ? 11 : 12} color={Colors.success} />
          <Text style={[styles.pillText, small && styles.pillTextSmall, styles.reliable]}>
            {t('player.reliable.title')}
          </Text>
        </Pressable>
      )}

      <Text style={[styles.matches, small && styles.matchesSmall]}>
        {t('player.matchesPlayed', { count: matchCount })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillSmall: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  pillText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  pillTextSmall: {
    fontSize: 9,
  },
  reliable: {
    color: Colors.success,
  },
  matches: {
    fontFamily: Fonts.inter,
    fontSize: 11,
    color: Colors.inkDisabled,
  },
  matchesSmall: {
    fontSize: 10,
  },
})
