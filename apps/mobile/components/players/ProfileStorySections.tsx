import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'

export interface ProfilePersonality {
  specialSkill: string | null
  favoriteExcuse: string | null
  badFaithLevel: number | null
  lockerRoomStyle: string | null
  thirdHalfProfile: string | null
}

interface TightestMatch {
  scheduledAt: string
  scoreA: number
  scoreB: number
}

interface ProfileStorySectionsProps {
  tightestMatch?: TightestMatch | null
  personality?: ProfilePersonality | null
}

const BAD_FAITH_EMOJIS = ['😇', '😏', '🤥', '🤡', '👹']

export function ProfileStorySections({ tightestMatch, personality }: ProfileStorySectionsProps) {
  const { t, i18n } = useTranslation()
  const hasPersonality = Boolean(
    personality && (
      personality.specialSkill ||
      personality.favoriteExcuse ||
      personality.badFaithLevel !== null ||
      personality.lockerRoomStyle ||
      personality.thirdHalfProfile
    ),
  )
  const badFaithLevel = Math.min(5, Math.max(0, personality?.badFaithLevel ?? 0))

  if (!tightestMatch && !hasPersonality) return null

  return (
    <View style={styles.sections}>
      {tightestMatch && (
        <View>
          <Text style={styles.sectionLabel}>{t('profile.memory.icon')}  {t('profile.memory.title').toUpperCase()}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.memoryRow}>
              <Text style={styles.memoryIcon}>{t('profile.memory.matchIcon')}</Text>
              <View style={styles.flex}>
                <Text style={styles.memoryScore}>{tightestMatch.scoreA}–{tightestMatch.scoreB}</Text>
                <Text style={styles.cardLabel}>
                  {t('profile.memory.tightest')} · {new Date(tightestMatch.scheduledAt).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {hasPersonality && personality && (
        <View>
          <Text style={styles.sectionLabel}>{t('profile.personality.icon')}  {t('profile.personality.title').toUpperCase()}</Text>
          <View style={styles.personalityStack}>
            {personality.specialSkill && (
              <View style={[styles.personalityCard, styles.primaryCard]}>
                <Text style={styles.cardLabel}>🎯  {t('profile.personality.specialSkill')}</Text>
                <Text style={styles.cardValue}>{personality.specialSkill}</Text>
              </View>
            )}

            {personality.favoriteExcuse && (
              <View style={[styles.personalityCard, styles.excuseCard]}>
                <Text style={styles.cardLabel}>{t('profile.personality.excuseIcon')}  {t('profile.personality.favoriteExcuse')}</Text>
                <Text style={[styles.cardValue, styles.quote]}>« {personality.favoriteExcuse} »</Text>
              </View>
            )}

            {personality.thirdHalfProfile && (
              <View style={[styles.personalityCard, styles.thirdHalfCard]}>
                <Text style={styles.cardLabel}>🍺  {t('profile.personality.thirdHalf')}</Text>
                <Text style={styles.cardValue}>{personality.thirdHalfProfile}</Text>
              </View>
            )}

            {(personality.badFaithLevel !== null || personality.lockerRoomStyle) && (
              <View style={styles.smallCardRow}>
                {personality.badFaithLevel !== null && (
                  <View style={[styles.smallCard, styles.flex]}>
                    <Text style={styles.cardLabel}>{t('profile.personality.badFaith')}</Text>
                    <View style={styles.emojiRow} accessibilityLabel={`${t('profile.personality.badFaith')}: ${badFaithLevel}/5`}>
                      {BAD_FAITH_EMOJIS.map((emoji, index) => (
                        <Text key={index} style={[styles.emoji, index >= badFaithLevel && styles.emojiMuted]}>
                          {BAD_FAITH_EMOJIS[Math.min(index, Math.max(0, badFaithLevel - 1))] ?? emoji}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
                {personality.lockerRoomStyle && (
                  <View style={[styles.smallCard, styles.flex]}>
                    <Text style={styles.cardLabel}>{t('profile.personality.lockerIcon')}  {t('profile.personality.lockerRoomStyle')}</Text>
                    <Text style={styles.smallCardValue}>{personality.lockerRoomStyle}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  sections: { gap: 28, marginTop: 28 },
  sectionLabel: {
    color: Colors.primary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 18,
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: 16,
  },
  memoryIcon: { fontSize: 20 },
  memoryScore: { color: Colors.ink, fontFamily: Fonts.interBold, fontSize: 20 },
  cardLabel: { color: Colors.inkSecondary, fontFamily: Fonts.interMedium, fontSize: 12 },
  personalityStack: { gap: 10 },
  personalityCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 10,
  },
  primaryCard: { backgroundColor: Colors.primarySubtle, borderColor: 'rgba(255,68,56,0.30)' },
  excuseCard: { backgroundColor: 'rgba(168,35,28,0.14)', borderColor: 'rgba(255,68,56,0.24)' },
  thirdHalfCard: { backgroundColor: Colors.successSubtle, borderColor: 'rgba(50,215,75,0.26)' },
  cardValue: { color: Colors.ink, fontFamily: Fonts.interBold, fontSize: 18, lineHeight: 25 },
  quote: { fontStyle: 'italic' },
  smallCardRow: { flexDirection: 'row', gap: 10 },
  smallCard: {
    minHeight: 112,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
    justifyContent: 'space-between',
  },
  smallCardValue: { color: Colors.ink, fontFamily: Fonts.interBold, fontSize: 17 },
  emojiRow: { flexDirection: 'row' },
  emoji: { fontSize: 19 },
  emojiMuted: { opacity: 0.18 },
  flex: { flex: 1 },
})
