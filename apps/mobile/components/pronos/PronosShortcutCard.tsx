import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { PressableScale } from '../ui/PressableScale'

interface PronosShortcutCardProps {
  /** Number of matches whose odds board is live (teams generated, kick-off ahead). */
  openCount: number
  /** ISO kick-off of the soonest open market — when its betting window closes. */
  closesAt: string | null
  onPress: () => void
}

/**
 * Accueil's way into the Pronos module (Story 11.4). Deliberately the plainest card on
 * the screen: a `--surface` row with a `--primary-subtle` monogram and a chevron. It
 * spends nothing from Accueil's scarcity budget — no glow, no numeral, no gold, no
 * texture — so the kick-off time in NextMatchHero keeps the screen's only numeral.
 */
export function PronosShortcutCard({ openCount, closesAt, onPress }: PronosShortcutCardProps) {
  const { t, i18n } = useTranslation()
  const hasOpenMarkets = openCount > 0

  const closesLabel = closesAt
    ? t('pronos.shortcut.closesAt', {
        time: new Date(closesAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
      })
    : null

  return (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('pronos.shortcut.a11y')}
    >
      <View style={styles.monogram}>
        <Text style={styles.monogramLetter}>{t('pronos.shortcut.monogram')}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {hasOpenMarkets ? t('pronos.shortcut.openCount', { count: openCount }) : t('pronos.shortcut.none')}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {hasOpenMarkets && closesLabel ? closesLabel : t('pronos.shortcut.noneHint')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={Colors.inkDisabled} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLetter: {
    color: Colors.primary,
    fontSize: 17,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.68, // 0.04em @ 17 (stat register)
  },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: Colors.ink, fontSize: 14.5, fontFamily: Fonts.interSemiBold },
  meta: { color: Colors.inkSecondary, fontSize: 12, fontFamily: Fonts.inter },
})
