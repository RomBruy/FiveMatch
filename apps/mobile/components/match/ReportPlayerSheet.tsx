import { useState } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { haptics } from '../../lib/haptics'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { PressableScale } from '../ui/PressableScale'

/** Order matters: praise first, so the flow does not read as a complaints box. */
const CATEGORIES = [
  'good_spirit',
  'helped_organize',
  'unsporting',
  'abusive_language',
  'aggression',
  'dangerous_play',
] as const

type Category = (typeof CATEGORIES)[number]

const POSITIVE: Category[] = ['good_spirit', 'helped_organize']

interface ReportPlayerSheetProps {
  matchId: string
  opponents: Array<{ playerId: string; displayName: string | null }>
  onClose: () => void
}

/**
 * Report a player's conduct, good or bad.
 *
 * Deliberately never reveals what anyone else submitted, or whether a report has
 * been corroborated. Corroboration that could be observed could be coordinated,
 * and a reporter who can see the count knows exactly how many more voices are
 * needed. The confirmation says only that it was received.
 */
export function ReportPlayerSheet({ matchId, opponents, onClose }: ReportPlayerSheetProps) {
  const { t } = useTranslation()
  const [subjectPlayerId, setSubjectPlayerId] = useState<string | null>(null)
  const [category, setCategory] = useState<Category | null>(null)

  const submit = useMutation({
    mutationFn: async () => {
      const { data } = await httpClient.post<{ data: { reportId: string } }>(
        `/v1/matches/${matchId}/reports`,
        { subjectPlayerId, category },
      )
      return data.data
    },
    onSuccess: () => {
      haptics.success()
      Alert.alert(t('match.report.sentTitle'), t('match.report.sentBody'))
      onClose()
    },
    onError: () => Alert.alert(t('common.genericError')),
  })

  const canSubmit = Boolean(subjectPlayerId && category) && !submit.isPending

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>{t('match.report.title')}</Text>

      <Text style={styles.label}>{t('match.report.who').toUpperCase()}</Text>
      <View style={styles.chips}>
        {opponents.map((player) => (
          <PressableScale
            key={player.playerId}
            onPress={() => { haptics.selection(); setSubjectPlayerId(player.playerId) }}
            accessibilityRole="radio"
            accessibilityState={{ selected: subjectPlayerId === player.playerId }}
            style={[styles.chip, subjectPlayerId === player.playerId && styles.chipActive]}
          >
            <Text style={[styles.chipText, subjectPlayerId === player.playerId && styles.chipTextActive]}>
              {player.displayName}
            </Text>
          </PressableScale>
        ))}
      </View>

      <Text style={styles.label}>{t('match.report.what').toUpperCase()}</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((value) => {
          const selected = category === value
          const positive = POSITIVE.includes(value)
          return (
            <PressableScale
              key={value}
              onPress={() => { haptics.selection(); setCategory(value) }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && (positive ? styles.chipPositive : styles.chipActive)]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {t(`match.report.category.${value}`)}
              </Text>
            </PressableScale>
          )
        })}
      </View>

      <Text style={styles.footnote}>{t('match.report.privacy')}</Text>

      <PrimaryButton
        label={t('match.report.submit')}
        onPress={() => submit.mutate()}
        disabled={!canSubmit}
      />
      <SecondaryButton label={t('common.cancel')} onPress={onClose} />
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { gap: 12 },
  title: {
    fontFamily: Fonts.bebas,
    fontSize: 24,
    color: Colors.ink,
  },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipPositive: { backgroundColor: Colors.success },
  chipText: {
    fontFamily: Fonts.inter,
    fontSize: 12,
    color: Colors.inkSecondary,
  },
  chipTextActive: { color: Colors.ink },
  footnote: {
    fontFamily: Fonts.inter,
    fontSize: 11,
    color: Colors.inkDisabled,
  },
})
