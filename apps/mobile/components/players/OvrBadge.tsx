import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

interface OvrBadgeProps {
  ovrScore: number | null
  cardState: string
  size?: 'hero' | 'list'
}

export function OvrBadge({ ovrScore, cardState, size = 'list' }: OvrBadgeProps) {
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
      <Text style={styles.listOvr}>{ovrScore}</Text>
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
    fontFamily: 'Inter_400Regular',
  },
  heroOvr: {
    color: Colors.gold,
    fontSize: 76,
    fontFamily: 'BebasNeue_400Regular',
    lineHeight: 76,
  },
  listPill: {
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  listOvr: {
    color: Colors.gold,
    fontSize: 20,
    fontFamily: 'BebasNeue_400Regular',
  },
})
