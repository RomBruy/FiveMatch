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

      {/* The vestiaire.
          This was four cards of identical size and four competing colours,
          plus a row of emojis nobody could count. It is the funny part of the
          product, so it gets a composition: the excuse leads as a quote — it is
          the line people actually read aloud — and everything else falls in
          behind it as labelled rows. One card, one accent, one voice. */}
      {hasPersonality && personality && (
        <View>
          <Text style={styles.sectionLabel}>{t('profile.personality.icon')}  {t('profile.personality.title').toUpperCase()}</Text>
          <View style={styles.vestiaire}>
            {personality.favoriteExcuse && (
              <View style={styles.leadBlock}>
                <Text style={styles.leadLabel}>{t('profile.personality.favoriteExcuse').toUpperCase()}</Text>
                <Text style={styles.quote}>« {personality.favoriteExcuse} »</Text>
              </View>
            )}

            <View style={[styles.pairs, personality.favoriteExcuse ? styles.pairsDivided : null]}>
              {personality.specialSkill && (
                <View style={styles.pair}>
                  <Text style={styles.pairKey}>{t('profile.personality.specialSkill')}</Text>
                  <Text style={styles.pairValue}>{personality.specialSkill}</Text>
                </View>
              )}

              {personality.badFaithLevel !== null && (
                <View style={styles.pair}>
                  <Text style={styles.pairKey}>{t('profile.personality.badFaith')}</Text>
                  {/* A 5-notch meter reads at a glance; five near-identical
                      emoji faces had to be counted to mean anything. */}
                  <View
                    style={styles.meter}
                    accessibilityLabel={`${t('profile.personality.badFaith')}: ${badFaithLevel}/5`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <View key={i} style={[styles.notch, i < badFaithLevel && styles.notchOn]} />
                    ))}
                  </View>
                  <Text style={styles.meterFace}>
                    {BAD_FAITH_EMOJIS[Math.max(0, badFaithLevel - 1)] ?? BAD_FAITH_EMOJIS[0]}
                  </Text>
                </View>
              )}

              {personality.lockerRoomStyle && (
                <View style={styles.pair}>
                  <Text style={styles.pairKey}>{t('profile.personality.lockerRoomStyle')}</Text>
                  <Text style={styles.pairValue}>{personality.lockerRoomStyle}</Text>
                </View>
              )}

              {personality.thirdHalfProfile && (
                <View style={styles.pair}>
                  <Text style={styles.pairKey}>{t('profile.personality.thirdHalf')}</Text>
                  <Text style={styles.pairValue}>{personality.thirdHalfProfile}</Text>
                </View>
              )}
            </View>
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
  // One card, one accent stripe — the section's whole colour budget.
  vestiaire: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: 18,
    gap: 14,
  },
  leadBlock: { gap: 7 },
  leadLabel: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
  },
  quote: {
    color: Colors.ink,
    fontFamily: Fonts.inter,
    fontSize: 17,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  pairs: { gap: 12 },
  pairsDivided: { borderTopWidth: 1, borderTopColor: Colors.hairline, paddingTop: 14 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pairKey: {
    width: 104,
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pairValue: { flex: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13.5 },
  meter: { flex: 1, flexDirection: 'row', gap: 4 },
  notch: { flex: 1, height: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceRaised },
  notchOn: { backgroundColor: Colors.primary },
  meterFace: { fontSize: 16 },
  flex: { flex: 1 },
})
