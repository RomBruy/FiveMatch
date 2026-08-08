import { useState } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { haptics } from '../../lib/haptics'
import { PrimaryButton } from '../ui/PrimaryButton'
import { PressableScale } from '../ui/PressableScale'
import type { AttendanceEntry } from '../../lib/matches'

interface AttendanceFinalizationProps {
  matchId: string
  confirmed: AttendanceEntry[]
  /** Already settled — the action is offered once and then reads as done. */
  isFinalized: boolean
}

/**
 * The host settles who actually turned up.
 *
 * Only late arrivals are collected here. Attended, excused, late cancellation
 * and no-show are all derived server-side from facts already recorded — the RSVP
 * sheet, the cancellation timestamp and the final participant snapshot — because
 * asking a host to re-enter what the system already knows invites both errors
 * and score-shopping. Lateness is the one thing only the host witnessed.
 */
export function AttendanceFinalization({ matchId, confirmed, isFinalized }: AttendanceFinalizationProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [latePlayerIds, setLatePlayerIds] = useState<string[]>([])

  const finalize = useMutation({
    mutationFn: async () => {
      const { data } = await httpClient.post<{ data: { finalized: number } }>(
        `/v1/matches/${matchId}/finalize-attendance`,
        { arrivedLatePlayerIds: latePlayerIds },
      )
      return data.data
    },
    onSuccess: () => {
      haptics.success()
      queryClient.invalidateQueries({ queryKey: ['matches', matchId] })
      queryClient.invalidateQueries({ queryKey: ['attendances', matchId] })
    },
    onError: () => Alert.alert(t('common.genericError')),
  })

  const toggleLate = (playerId: string) => {
    haptics.selection()
    setLatePlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId],
    )
  }

  if (isFinalized) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('match.finalize.title').toUpperCase()}</Text>
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.doneText}>{t('match.finalize.done')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('match.finalize.title').toUpperCase()}</Text>
      <Text style={styles.help}>{t('match.finalize.help')}</Text>

      {confirmed.map((entry) => {
        const isLate = latePlayerIds.includes(entry.playerId)
        return (
          <PressableScale
            key={entry.playerId}
            onPress={() => toggleLate(entry.playerId)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isLate }}
            style={[styles.row, isLate && styles.rowActive]}
          >
            <Text style={styles.name} numberOfLines={1}>{entry.displayName}</Text>
            <View style={[styles.tag, isLate && styles.tagActive]}>
              <Text style={[styles.tagText, isLate && styles.tagTextActive]}>
                {t('match.finalize.late')}
              </Text>
            </View>
          </PressableScale>
        )
      })}

      <PrimaryButton
        label={t('match.finalize.action')}
        onPress={() => finalize.mutate()}
        disabled={finalize.isPending}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  help: {
    fontFamily: Fonts.inter,
    fontSize: 12,
    color: Colors.inkDisabled,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowActive: { backgroundColor: Colors.surface },
  name: {
    flex: 1,
    fontFamily: Fonts.inter,
    fontSize: 14,
    color: Colors.ink,
  },
  tag: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.inkDisabled,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagActive: { borderColor: Colors.primary },
  tagText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.inkDisabled,
  },
  tagTextActive: { color: Colors.primary },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneText: {
    fontFamily: Fonts.inter,
    fontSize: 13,
    color: Colors.inkSecondary,
  },
})
