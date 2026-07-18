import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { Chip } from '../ui/Chip'
import { CountdownPill } from '../ui/CountdownPill'
import { PrimaryButton } from '../ui/PrimaryButton'

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

function formatLockTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function PronosForm({ matchId, groupId, scheduledAt }: PronosFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [isLocked, setIsLocked] = useState(() => new Date(scheduledAt).getTime() <= Date.now())
  const [lockedAt, setLockedAt] = useState<string | null>(null)

  // Lock-state interval — the countdown display itself lives in CountdownPill.
  useEffect(() => {
    if (isLocked) return
    const interval = setInterval(() => {
      const diff = new Date(scheduledAt).getTime() - Date.now()
      if (diff <= 0) {
        setIsLocked(true)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt, isLocked])

  // Padlock scale animation — signature motion, timing is a Story 6.1 contract.
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

  const onLockPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    void onSubmit()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('pronos.title')}</Text>

      {/* Countdown */}
      {!isLocked && (
        <View style={styles.countdownRow}>
          <CountdownPill targetAt={scheduledAt} label={t('pronos.countdownLabel')} />
        </View>
      )}

      {/* Locked state */}
      {isLocked && (
        <Animated.View style={[styles.lockedBanner, padlockAnimatedStyle]}>
          {/* No lock icons anywhere (design rule) — the confirmed state speaks success. */}
          <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
          <View style={styles.lockedTextWrap}>
            <Text style={styles.lockedLabel}>{t('pronos.lockedLabel')}</Text>
            {lockedAt && (
              <Text style={styles.confirmedAt}>
                {t('pronos.confirmedAt', { time: formatLockTime(lockedAt) })}
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Result prediction — 1X2 as chips */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{t('pronos.resultLabel')}</Text>
        <Controller
          control={control}
          name="predictionResult"
          render={({ field: { value, onChange } }) => (
            <View style={styles.chipRow}>
              {(['teamA', 'draw', 'teamB'] as const).map((option) => (
                <View key={option} style={styles.chipCell}>
                  <Chip
                    label={t(`pronos.${option}`)}
                    active={value === option}
                    onPress={() => !isLocked && onChange(option)}
                    disabled={isLocked}
                  />
                </View>
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
          <Text style={styles.scoreDivider}>–</Text>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mvpScroll}
                contentContainerStyle={styles.mvpScrollContent}
              >
                {attendees.map((player) => (
                  <Chip
                    key={player.playerId}
                    label={player.displayName}
                    active={value === player.playerId}
                    onPress={() => !isLocked && onChange(value === player.playerId ? null : player.playerId)}
                    disabled={isLocked}
                  />
                ))}
              </ScrollView>
            )}
          />
        )}
      </View>

      {/* Lock CTA — the host screen's glow is owned elsewhere (hero band / tab dock). */}
      {!isLocked && (
        <PrimaryButton
          label={t('pronos.submitButton')}
          onPress={onLockPress}
          disabled={!isFormValid || isSubmitting}
          loading={isSubmitting}
          glow={false}
        />
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
    marginHorizontal: 20,
    borderRadius: Radius.card,
    padding: 16,
    gap: 16,
  },
  title: {
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 20,
    letterSpacing: Type.heading.letterSpacing,
    textTransform: 'uppercase',
  },
  countdownRow: {
    alignItems: 'center',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: 14,
    gap: 12,
  },
  lockedTextWrap: {
    flexShrink: 1,
  },
  lockedLabel: {
    color: Colors.ink,
    fontSize: 14,
    fontFamily: Fonts.interSemiBold,
  },
  confirmedAt: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.inter,
    marginTop: 2,
  },
  confirmedAtInline: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Type.labelCaps.fontFamily,
    letterSpacing: Type.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipCell: {
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scoreInput: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 40,
    letterSpacing: 1.6, // 0.04em @ 40 (stat register, scaled)
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 76,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  scoreDivider: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.bebas,
    fontSize: 28,
  },
  emptyAttendees: {
    color: Colors.inkDisabled,
    fontSize: 13,
    fontFamily: Fonts.inter,
    fontStyle: 'italic',
  },
  mvpScroll: {
    flexGrow: 0,
  },
  mvpScrollContent: {
    gap: 8,
  },
})
