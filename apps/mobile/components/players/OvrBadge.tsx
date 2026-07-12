import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

interface OvrBadgeProps {
  ovrScore: number | null
  cardState: string
  size?: 'hero' | 'list'
  /** Gold variant — the single top-rated player only (one gold per screen; caller's responsibility). */
  gold?: boolean
}

export function OvrBadge({ ovrScore, cardState, size = 'list', gold = false }: OvrBadgeProps) {
  const { t } = useTranslation()

  if (ovrScore === null || cardState !== 'unlocked') {
    if (size === 'hero') {
      return (
        <View
          style={styles.heroLocked}
          accessible
          accessibilityLabel={t('card.locked.lockHint')}
        >
          <Text style={styles.heroLockedText}>{t('card.locked.lockHint')}</Text>
        </View>
      )
    }
    // list size: caller (PaniniCard / RankRow) renders the progress pill — render nothing here
    return null
  }

  if (size === 'hero') {
    return (
      <Text
        style={styles.heroOvr}
        accessible
        accessibilityLabel={`OVR ${ovrScore}`}
      >
        {ovrScore}
      </Text>
    )
  }

  return (
    <View
      style={styles.listPill}
      accessible
      accessibilityLabel={`OVR ${ovrScore}`}
    >
      <Text style={[styles.listOvr, gold && styles.listOvrGold]}>{ovrScore}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  heroLocked: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroLockedText: {
    color: Colors.inkDisabled,
    fontSize: 11,
    fontFamily: Fonts.inter,
  },
  heroOvr: {
    color: Colors.gold,
    fontSize: 76,
    fontFamily: Fonts.bebas,
    lineHeight: 76,
  },
  listPill: {
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  listOvr: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.bebas,
    letterSpacing: 0.6,
  },
  listOvrGold: {
    color: Colors.gold,
  },
})
