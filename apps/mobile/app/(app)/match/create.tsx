import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { Chip } from '../../../components/ui/Chip'
import { Input } from '../../../components/ui/Input'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { PaperCalendar } from '../../../components/match/PaperCalendar'
import { httpClient } from '../../../lib/api-client'
import { useGroupContext } from '../../../contexts/GroupContext'

type MatchFormat = '5v5' | '6v6' | '7v7' | 'custom'
type GoalkeeperMode = 'fixed' | 'rotating' | 'none'
type Recurrence = 'none' | 'weekly' | 'biweekly'

interface CreateMatchForm {
  scheduledAt: string
  location: string
  format: MatchFormat
  goalkeeperMode: GoalkeeperMode
  playersPerTeam: string
  recurrence: Recurrence
}

const FORMAT_PLAYERS: Record<Exclude<MatchFormat, 'custom'>, number> = {
  '5v5': 5,
  '6v6': 6,
  '7v7': 7,
}

const TIME_PRESETS = ['18:00', '19:00', '20:00']
const PLAYERS_MIN = 5
const PLAYERS_MAX = 20
const MINUS = '−'
const PLUS = '+'

function ChipRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; outlined?: boolean }[]
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          active={value === opt.value}
          variant={opt.outlined ? 'outlined' : 'filled'}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  )
}

export default function CreateMatchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { activeGroupId } = useGroupContext()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customTime, setCustomTime] = useState(false)

  const { control, handleSubmit, watch, formState: { errors } } = useForm<CreateMatchForm>({
    defaultValues: {
      scheduledAt: '',
      location: '',
      format: '5v5',
      goalkeeperMode: 'none',
      playersPerTeam: '5',
      recurrence: 'none',
    },
  })

  const format = watch('format')
  const recurrence = watch('recurrence')

  const onSubmit = async (data: CreateMatchForm) => {
    if (!activeGroupId) return
    setSubmitting(true)
    setError(null)
    try {
      // Parse "YYYY-MM-DD HH:MM" → ISO datetime
      const iso = new Date(data.scheduledAt.replace(' ', 'T')).toISOString()
      const playersPerTeam = format === 'custom'
        ? parseInt(data.playersPerTeam, 10)
        : FORMAT_PLAYERS[format as Exclude<MatchFormat, 'custom'>]

      await httpClient.post(`/v1/groups/${activeGroupId}/matches`, {
        scheduledAt: iso,
        location: data.location.trim() || null,
        format: data.format,
        playersPerTeam,
        goalkeeperMode: data.goalkeeperMode,
        recurrence: data.recurrence === 'none' ? null : { frequency: data.recurrence },
      })

      await queryClient.invalidateQueries({ queryKey: ['matches', activeGroupId] })
      router.back()
    } catch {
      setError(t('common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Text style={styles.title}>{t('match.create.title')}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* scheduledAt stays one "YYYY-MM-DD HH:MM" form value: calendar owns the date
          part, the time chips/input own the time part — payload unchanged. */}
      <Controller
        control={control}
        name="scheduledAt"
        rules={{ required: true, pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/ }}
        render={({ field: { onChange, value } }) => {
          const [datePart = '', timePart = ''] = value.split(' ')
          const setParts = (date: string, time: string) => {
            onChange(`${date} ${time}`.trim().length === 0 ? '' : `${date} ${time}`)
          }
          return (
            <>
              <PaperCalendar value={datePart} onChange={(date) => setParts(date, timePart)} />

              <Text style={styles.label}>{t('match.create.timeLabel')}</Text>
              <View style={styles.chipRow}>
                {TIME_PRESETS.map((slot) => (
                  <Chip
                    key={slot}
                    label={slot}
                    active={!customTime && timePart === slot}
                    onPress={() => {
                      setCustomTime(false)
                      setParts(datePart, slot)
                    }}
                  />
                ))}
                <Chip
                  label={t('match.create.timeCustom')}
                  variant="outlined"
                  active={customTime}
                  onPress={() => setCustomTime(true)}
                />
              </View>
              {customTime && (
                <View style={styles.customTimeWrap}>
                  <Input
                    value={timePart}
                    onChangeText={(time) => setParts(datePart, time)}
                    placeholder={t('match.create.timePlaceholder')}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    style={errors.scheduledAt && styles.inputError}
                  />
                </View>
              )}
            </>
          )
        }}
      />

      <Text style={styles.label}>{t('match.create.location')}</Text>
      <Controller
        control={control}
        name="location"
        render={({ field: { onChange, value } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder={t('match.create.locationPlaceholder')}
            maxLength={200}
          />
        )}
      />

      <Text style={styles.label}>{t('match.create.format')}</Text>
      <Controller
        control={control}
        name="format"
        render={({ field: { onChange, value } }) => (
          <ChipRow
            value={value}
            onChange={onChange}
            options={[
              { value: '5v5', label: t('groups.create.format5v5') },
              { value: '6v6', label: t('groups.create.format6v6') },
              { value: '7v7', label: t('groups.create.format7v7') },
              { value: 'custom', label: t('groups.create.formatCustom'), outlined: true },
            ]}
          />
        )}
      />

      {format === 'custom' && (
        <>
          <Text style={styles.label}>{t('match.create.playersPerTeam')}</Text>
          <Controller
            control={control}
            name="playersPerTeam"
            rules={{ required: true, min: PLAYERS_MIN, max: PLAYERS_MAX }}
            render={({ field: { onChange, value } }) => {
              const count = parseInt(value, 10)
              const current = Number.isNaN(count) ? PLAYERS_MIN : count
              return (
                <View style={styles.stepper}>
                  <Pressable
                    style={[styles.stepperButton, current <= PLAYERS_MIN && styles.stepperButtonDisabled]}
                    onPress={() => onChange(String(Math.max(PLAYERS_MIN, current - 1)))}
                    disabled={current <= PLAYERS_MIN}
                    accessibilityRole="button"
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text style={styles.stepperButtonText}>{MINUS}</Text>
                  </Pressable>
                  <Text
                    style={styles.stepperValue}
                    accessibilityLabel={t('match.create.playersPerTeam')}
                  >
                    {String(current)}
                  </Text>
                  <Pressable
                    style={[styles.stepperButton, current >= PLAYERS_MAX && styles.stepperButtonDisabled]}
                    onPress={() => onChange(String(Math.min(PLAYERS_MAX, current + 1)))}
                    disabled={current >= PLAYERS_MAX}
                    accessibilityRole="button"
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text style={styles.stepperButtonText}>{PLUS}</Text>
                  </Pressable>
                </View>
              )
            }}
          />
        </>
      )}

      <Text style={styles.label}>{t('match.create.recurrence')}</Text>
      <Controller
        control={control}
        name="recurrence"
        render={({ field: { onChange, value } }) => (
          <ChipRow
            value={value}
            onChange={onChange}
            options={[
              { value: 'none', label: t('match.create.recurrenceNone') },
              { value: 'weekly', label: t('match.create.recurrenceWeekly') },
              { value: 'biweekly', label: t('match.create.recurrenceBiweekly') },
            ]}
          />
        )}
      />
      {recurrence !== 'none' && (
        <Text style={styles.recurrenceHint}>{t('match.create.recurrenceHint')}</Text>
      )}

      <Text style={styles.label}>{t('match.create.goalkeeperMode')}</Text>
      <Controller
        control={control}
        name="goalkeeperMode"
        render={({ field: { onChange, value } }) => (
          <ChipRow
            value={value}
            onChange={onChange}
            options={[
              { value: 'fixed', label: t('groups.create.goalkeeperFixed') },
              { value: 'rotating', label: t('groups.create.goalkeeperRotating') },
              { value: 'none', label: t('groups.create.goalkeeperNone') },
            ]}
          />
        )}
      />

      <View style={styles.submitWrap}>
        {/* The tab dock owns this screen's one glow. */}
        <PrimaryButton
          label={t('match.create.submit')}
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          glow={false}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 36,
    letterSpacing: 1.44, // 0.04em @ 36 (display register)
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  label: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 24,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customTimeWrap: {
    marginTop: 10,
  },
  recurrenceHint: {
    color: Colors.inkSecondary,
    fontSize: 12.5,
    fontFamily: Fonts.inter,
    lineHeight: 18,
    marginTop: 10,
  },
  inputError: {
    borderColor: Colors.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 5,
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonText: {
    color: Colors.inkSecondary,
    fontSize: 18,
    fontFamily: Fonts.interMedium,
  },
  stepperValue: {
    fontFamily: Fonts.bebas,
    fontSize: 22,
    letterSpacing: 0.88, // 0.04em @ 22 (stat register)
    color: Colors.ink,
    minWidth: 26,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  submitWrap: {
    marginTop: 36,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    marginBottom: 16,
  },
})
