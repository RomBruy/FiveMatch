import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Radius, Type } from '../../constants/tokens'

interface PromiseBandProps {
  style?: StyleProp<ViewStyle>
}

/**
 * The promise, said on screen.
 *
 * A stranger opening FiveMatch had no way to learn what it is: the app showed a
 * list of matches and left them to infer the product. This band answers "what is
 * this" in one sentence, in the same words every time it appears — here, on the
 * account wall, and in every empty state.
 *
 * It is not a dismissible tip. It costs one row and it is the only thing on the
 * screen addressed to someone who has never played.
 */
export function PromiseBand({ style }: PromiseBandProps) {
  const { t } = useTranslation()

  return (
    <View style={[styles.band, style]} accessibilityRole="summary">
      <Text style={styles.badge}>{t('brand.formatBadge')}</Text>
      <Text style={styles.copy}>{t('brand.promiseBand')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Flat primarySubtle rather than a gradient: this sits above the fold on the
    // busiest screen, and the one glow per screen is already spent elsewhere.
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.26)',
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  badge: {
    color: Colors.primary,
    fontFamily: Type.heading.fontFamily,
    fontSize: 15,
    letterSpacing: 1.5, // 0.10em @ 15 (heading register)
  },
  copy: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Type.bodyStrong.fontFamily,
    fontSize: 11.5,
    lineHeight: 15.5,
  },
})
