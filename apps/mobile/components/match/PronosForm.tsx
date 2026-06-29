import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

interface PronosFormProps {
  matchId: string
  groupId: string
  scheduledAt: string
}

interface FormValues {
  predictionResult: 'teamA' | 'draw' | 'teamB' | null
  predictionMvpPlayerId: string | null
  predictionScoreA: string
  predictionScoreB: string
}

interface AttendeePlayer {
  playerId: string
  displayName: string
}

interface ExistingProno {
  predictionResult: 'teamA' | 'draw' | 'teamB'
  predictionMvpPlayerId: string | null
  predictionScore: string
  submittedAt: string
  pointsEarned: number | null
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatLockTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function PronosForm({ matchId, groupId, scheduledAt }: PronosFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    return new Date(scheduledAt).getTime() - Date.now()
  })
  const [isLocked, setIsLocked] = useState(() => new Date(scheduledAt).getTime() <= Date.now())
  const [lockedAt, setLockedAt] = useState<string | null>(null)

  const isUrgent = !isLocked && timeRemaining < 10 * 60 * 1000

  // Countdown interval
  useEffect(() => {
    if (isLocked) return
    const interval = setInterval(() => {
      const diff = new Date(scheduledAt).getTime() - Date.now()
      if (diff <= 0) {
        setIsLocked(true)
        setTimeRemaining(0)
        clearInterval(interval)
      } else {
        setTimeRemaining(diff)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt, isLocked])

  // Pulse animation for urgent countdown
  const pulseOpacity = useSharedValue(1)
  useEffect(() => {
    if (isUrgent) {
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.7, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true,
      )
    } else {
      pulseOpacity.value = 1
    }
  }, [isUrgent])

  const timerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  // Padlock scale animation
  const padlockScale = useSharedValue(0.8)
  useEffect(() => {
    if (isLocked) {
      padlockScale.value = withSpring(1, { mass: 1, damping: 15, stiffness: 200 })
    }
  }, [isLocked])
  const padlockAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: padlockScale.value }],
  }))

  // Load existing prono
  const { data: existingProno } = useQuery({
    queryKey: ['pronos', matchId, 'my'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { prono: ExistingProno | null } }>(
        `/v1/groups/${groupId}/matches/${matchId}/pronos/my`,
      )
      return data.data.prono
    },
    enabled: !isLocked,
  })

  // Load attendees (MVP candidates)
  const { data: attendeesData } = useQuery({
    queryKey: ['pronos', matchId, 'attendees-in'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { players: AttendeePlayer[] } }>(
        `/v1/groups/${groupId}/matches/${matchId}/pronos/attendees-in`,
      )
      return data.data.players
    },
    enabled: !isLocked,
  })

  const attendees = attendeesData ?? []

  const { control, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      predictionResult: null,
      predictionMvpPlayerId: null,
      predictionScoreA: '',
      predictionScoreB: '',
    },
  })

  // Pre-fill form if existing prono loaded
  useEffect(() => {
    if (existingProno) {
      setValue('predictionResult', existingProno.predictionResult)
      setValue('predictionMvpPlayerId', existingProno.predictionMvpPlayerId)
      const parts = existingProno.predictionScore.split('-')
      setValue('predictionScoreA', parts[0] ?? '')
      setValue('predictionScoreB', parts[1] ?? '')
      if (existingProno.submittedAt) {
        setLockedAt(existingProno.submittedAt)
      }
    }
  }, [existingProno])

  const predictionResult = watch('predictionResult')
  const predictionScoreA = watch('predictionScoreA')
  const predictionScoreB = watch('predictionScoreB')

  const isFormValid =
    predictionResult !== null &&
    predictionScoreA.trim() !== '' &&
    predictionScoreB.trim() !== ''

  const { mutate: submitProno, isPending: isSubmitting } = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await httpClient.post<{ data: { submittedAt: string } }>(
        `/v1/groups/${groupId}/matches/${matchId}/pronos`,
        {
          predictionResult: values.predictionResult,
          predictionMvpPlayerId: values.predictionMvpPlayerId,
          predictionScoreA: parseInt(values.predictionScoreA, 10),
          predictionScoreB: parseInt(values.predictionScoreB, 10),
        },
      )
      return data.data
    },
    onSuccess: (result) => {
      setLockedAt(result.submittedAt)
      void queryClient.invalidateQueries({ queryKey: ['pronos', matchId, 'my'] })
    },
  })

  const onSubmit = handleSubmit((values) => {
    if (!isLocked) {
      submitProno(values)
    }
  })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('pronos.title')}</Text>

      {/* Countdown */}
      {!isLocked && (
        <View style={styles.countdownRow}>
          <Animated.Text
            style={[
              styles.countdown,
              isUrgent && styles.countdownUrgent,
              timerAnimatedStyle,
            ]}
          >
            {formatCountdown(timeRemaining)}
          </Animated.Text>
          <Text style={styles.countdownLabel}>{t('pronos.countdownLabel')}</Text>
        </View>
      )}

      {/* Locked state */}
      {isLocked && (
        <Animated.View style={[styles.lockedBanner, padlockAnimatedStyle]}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <View>
            <Text style={styles.lockedLabel}>{t('pronos.lockedLabel')}</Text>
            {lockedAt && (
              <Text style={styles.confirmedAt}>
                {t('pronos.confirmedAt', { time: formatLockTime(lockedAt) })}
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Result prediction */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('pronos.resultLabel')}</Text>
        <Controller
          control={control}
          name="predictionResult"
          render={({ field: { value, onChange } }) => (
            <View style={styles.radioRow}>
              {(['teamA', 'draw', 'teamB'] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.radioOption, value === option && styles.radioOptionActive]}
                  onPress={() => !isLocked && onChange(option)}
                  disabled={isLocked}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: value === option }}
                >
                  <Text style={[styles.radioLabel, value === option && styles.radioLabelActive]}>
                    {t(`pronos.${option}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      </View>

      {/* Score prediction */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('pronos.scoreLabel')}</Text>
        <View style={styles.scoreRow}>
          <Controller
            control={control}
            name="predictionScoreA"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={[styles.scoreInput, isLocked && styles.inputDisabled]}
                keyboardType="numeric"
                maxLength={2}
                value={value}
                onChangeText={onChange}
                editable={!isLocked}
                placeholder="0"
                placeholderTextColor={Colors.inkDisabled}
              />
            )}
          />
          <Text style={styles.scoreDivider}> – </Text>
          <Controller
            control={control}
            name="predictionScoreB"
            render={({ field: { value, onChange } }) => (
              <TextInput
                style={[styles.scoreInput, isLocked && styles.inputDisabled]}
                keyboardType="numeric"
                maxLength={2}
                value={value}
                onChangeText={onChange}
                editable={!isLocked}
                placeholder="0"
                placeholderTextColor={Colors.inkDisabled}
              />
            )}
          />
        </View>
      </View>

      {/* MVP prediction */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('pronos.mvpLabel')}</Text>
        {attendees.length === 0 ? (
          <Text style={styles.emptyAttendees}>{t('pronos.mvpEmpty')}</Text>
        ) : (
          <Controller
            control={control}
            name="predictionMvpPlayerId"
            render={({ field: { value, onChange } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mvpScroll}>
                {attendees.map((player) => (
                  <Pressable
                    key={player.playerId}
                    style={[styles.mvpChip, value === player.playerId && styles.mvpChipActive]}
                    onPress={() => !isLocked && onChange(value === player.playerId ? null : player.playerId)}
                    disabled={isLocked}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: value === player.playerId }}
                  >
                    <Text style={[styles.mvpChipText, value === player.playerId && styles.mvpChipTextActive]}>
                      {player.displayName}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          />
        )}
      </View>

      {/* Submit */}
      {!isLocked && (
        <Pressable
          style={[styles.submitButton, (!isFormValid || isSubmitting) && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={!isFormValid || isSubmitting}
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.ink} />
          ) : (
            <Text style={styles.submitButtonText}>{t('pronos.submitButton')}</Text>
          )}
        </Pressable>
      )}

      {/* Submission confirmation */}
      {!isLocked && lockedAt && (
        <Text style={styles.confirmedAtInline}>
          {t('pronos.confirmedAt', { time: formatLockTime(lockedAt) })}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
    gap: 16,
  },
  title: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  countdownRow: {
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  countdownUrgent: {
    color: Colors.gold,
  },
  countdownLabel: {
    color: Colors.inkSecondary,
    fontSize: 12,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 6,
    padding: 12,
    gap: 12,
  },
  lockedIcon: {
    fontSize: 24,
  },
  lockedLabel: {
    color: Colors.inkDisabled,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmedAt: {
    color: Colors.inkSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  confirmedAtInline: {
    color: Colors.inkSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radioOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
  },
  radioOptionActive: {
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  radioLabelActive: {
    color: Colors.ink,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreInput: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    color: Colors.ink,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    width: 64,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  scoreDivider: {
    color: Colors.inkSecondary,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  emptyAttendees: {
    color: Colors.inkDisabled,
    fontSize: 13,
    fontStyle: 'italic',
  },
  mvpScroll: {
    flexGrow: 0,
  },
  mvpChip: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mvpChipActive: {
    borderColor: Colors.primary,
  },
  mvpChipText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  mvpChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.35,
  },
  submitButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
