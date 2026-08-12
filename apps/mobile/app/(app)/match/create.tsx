import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { requestPushPermission } from '../../../hooks/use-push-registration'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { Chip } from '../../../components/ui/Chip'
import { Input } from '../../../components/ui/Input'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { PressableScale } from '../../../components/ui/PressableScale'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { PaperCalendar } from '../../../components/match/PaperCalendar'
import { InfoStrip } from '../../../components/shared/InfoStrip'
import { httpClient } from '../../../lib/api-client'
import { useDiscoveryLocation } from '../../../hooks/use-discovery-location'
import type { SkillLevel } from '../../../lib/matches'

type MatchFormat = '5v5' | '6v6' | '7v7' | 'custom'
type GoalkeeperMode = 'fixed' | 'rotating' | 'none'
type Recurrence = 'none' | 'weekly' | 'biweekly'

interface CreateMatchForm {
  scheduledAt: string
  venueName: string
  city: string
  format: MatchFormat
  goalkeeperMode: GoalkeeperMode
  playersPerTeam: string
  skillLevel: SkillLevel
  pricePerPlayer: string
  openSpots: string
  notes: string
  recurrence: Recurrence
}

interface CrewSummary {
  id: string
  name: string
  userRole: 'organizer' | 'member'
}

const FORMAT_PLAYERS: Record<Exclude<MatchFormat, 'custom'>, number> = { '5v5': 5, '6v6': 6, '7v7': 7 }
const TIME_PRESETS = ['18:00', '19:00', '20:00', '21:00']
const LEVELS: SkillLevel[] = ['casual', 'intermediate', 'competitive']
const PLAYERS_MIN = 4
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

/**
 * Create a match — open to anyone, not just crew organizers.
 *
 * Two decisions were added and one was removed. Added: where it is (so it can
 * be found) and whether to publish spots (so it can be filled). Removed: the
 * requirement to own a crew, which is what made hosting a closed shop.
 */
export default function CreateMatchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { location, requestDeviceLocation, isLocating } = useDiscoveryLocation()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customTime, setCustomTime] = useState(false)
  const [publish, setPublish] = useState(true)
  const [crewId, setCrewId] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  // Essentials first, the rest behind a disclosure. Everything below has a
  // sensible default, so a host who never opens it still creates a good match.
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [hostPlays, setHostPlays] = useState(true)
  const [limitSpots, setLimitSpots] = useState(false)
  const [crewFirstHours, setCrewFirstHours] = useState(0)

  // Crews the user can host for. Absent for most users — the picker only shows
  // when there is genuinely a choice to make.
  const { data: crews } = useQuery({
    queryKey: ['users', 'me', 'groups'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: CrewSummary[] } }>('/v1/users/me/groups')
      return data.data.items.filter((c) => c.userRole === 'organizer')
    },
  })

  const { control, handleSubmit, watch, formState: { errors } } = useForm<CreateMatchForm>({
    defaultValues: {
      scheduledAt: '',
      venueName: '',
      city: location?.city ?? '',
      format: '5v5',
      goalkeeperMode: 'none',
      playersPerTeam: '5',
      skillLevel: 'casual',
      pricePerPlayer: '',
      openSpots: '1',
      notes: '',
      recurrence: 'none',
    },
  })

  const format = watch('format')
  const recurrence = watch('recurrence')

  const useMyPosition = async () => {
    const next = await requestDeviceLocation()
    if (next) setCoords({ latitude: next.latitude, longitude: next.longitude })
  }

  const effectiveCoords = coords ?? (location && (location.latitude !== 0 || location.longitude !== 0)
    ? { latitude: location.latitude, longitude: location.longitude }
    : null)

  const onSubmit = async (data: CreateMatchForm) => {
    setSubmitting(true)
    setError(null)
    try {
      // "YYYY-MM-DD HH:MM" → ISO
      const iso = new Date(data.scheduledAt.replace(' ', 'T')).toISOString()
      const playersPerTeam = format === 'custom'
        ? parseInt(data.playersPerTeam, 10)
        : FORMAT_PLAYERS[format as Exclude<MatchFormat, 'custom'>]

      const price = data.pricePerPlayer.trim() ? Number(data.pricePerPlayer.replace(',', '.')) : null

      const { data: created } = await httpClient.post<{ data: { id: string } }>('/v1/matches', {
        groupId: crewId,
        scheduledAt: iso,
        venueName: data.venueName.trim() || null,
        city: data.city.trim() || null,
        latitude: effectiveCoords?.latitude ?? null,
        longitude: effectiveCoords?.longitude ?? null,
        format: data.format,
        playersPerTeam,
        goalkeeperMode: data.goalkeeperMode,
        skillLevel: data.skillLevel,
        pricePerPlayer: price !== null && !Number.isNaN(price) ? price : null,
        notes: data.notes.trim() || null,
        visibility: publish ? 'public' : 'private',
        // Null publishes whatever is actually left. The client used to force a
        // minimum of 1, so every public match offered a single place however
        // big it was — the API default changed in 6A and this did not.
        openSpots: publish && limitSpots
          ? Math.max(1, parseInt(data.openSpots, 10) || 1)
          : null,
        hostPlays,
        publicOpensAt: publish && crewFirstHours > 0
          ? new Date(Date.now() + crewFirstHours * 60 * 60 * 1000).toISOString()
          : null,
        recurrence: data.recurrence === 'none' ? null : { frequency: data.recurrence },
      })

      await queryClient.invalidateQueries({ queryKey: ['matches'] })
      // A host is the person notifications serve most — people joining,
      // dropping out, the sheet filling up (AF-003).
      void requestPushPermission()
      router.replace(`/(app)/match/${created.data.id}` as never)
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })
        .response?.data?.error?.code
      setError(code === 'VALIDATION_ERROR' ? t('match.create.locationRequired') : t('common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  const canPublish = Boolean(effectiveCoords) || Boolean(watch('city').trim())

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
    >
      <PressableScale
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={22} color={Colors.ink} />
      </PressableScale>

      <Text style={styles.title}>{t('match.create.title')}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* scheduledAt stays one "YYYY-MM-DD HH:MM" form value: the calendar owns
          the date part, the chips/input own the time part. */}
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

      {/* ── Where ─────────────────────────────────────────────────────── */}
      <Text style={styles.label}>{t('match.create.whereLabel')}</Text>
      <Controller
        control={control}
        name="venueName"
        render={({ field: { onChange, value } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder={t('match.create.venuePlaceholder')}
            maxLength={120}
          />
        )}
      />
      <View style={styles.cityRow}>
        <View style={styles.cityInput}>
          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, value } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder={t('match.create.cityPlaceholder')}
                maxLength={120}
                autoCapitalize="words"
              />
            )}
          />
        </View>
        <Chip
          label={effectiveCoords ? t('match.create.positionSet') : t('match.create.useMyPosition')}
          variant="outlined"
          active={Boolean(effectiveCoords)}
          disabled={isLocating}
          onPress={() => void useMyPosition()}
        />
      </View>

      {/* ── Publish: the single decision that makes this a marketplace ──── */}
      <Text style={styles.label}>{t('match.create.visibilityLabel')}</Text>
      <View style={styles.publishCard}>
        <View style={styles.publishHeader}>
          <View style={styles.publishText}>
            <Text style={styles.publishTitle}>{t('match.create.publishTitle')}</Text>
            <Text style={styles.publishBody}>{t('match.create.publishBody')}</Text>
          </View>
          <Chip
            label={publish ? t('common.on') : t('common.off')}
            active={publish}
            onPress={() => setPublish((p) => !p)}
          />
        </View>

        {publish && !canPublish && (
          <View style={styles.publishWarning}>
            <InfoStrip variant="info" message={t('match.create.locationRequired')} />
          </View>
        )}
      </View>

      {/* ── Everything else, defaulted and folded away ─────────────────── */}
      <PressableScale
        onPress={() => setShowAdvanced((v) => !v)}
        style={styles.disclosure}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvanced }}
      >
        <Text style={styles.disclosureText}>{t('match.create.advanced')}</Text>
        <Ionicons
          name={showAdvanced ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.inkSecondary}
        />
      </PressableScale>

      {showAdvanced && (
        <View style={styles.advanced}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('match.create.hostPlays')}</Text>
              <Text style={styles.toggleHelp}>{t('match.create.hostPlaysHelp')}</Text>
            </View>
            <Chip
              label={hostPlays ? t('common.on') : t('common.off')}
              active={hostPlays}
              onPress={() => setHostPlays((v) => !v)}
            />
          </View>

          {publish && (
            <>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>{t('match.create.limitSpots')}</Text>
                  <Text style={styles.toggleHelp}>{t('match.create.limitSpotsHelp')}</Text>
                </View>
                <Chip
                  label={limitSpots ? t('common.on') : t('common.off')}
                  active={limitSpots}
                  onPress={() => setLimitSpots((v) => !v)}
                />
              </View>

              {limitSpots && (
                <Controller
                  control={control}
                  name="openSpots"
                  render={({ field: { onChange, value } }) => (
                    <Stepper value={value} onChange={onChange} min={1} max={PLAYERS_MAX * 2} />
                  )}
                />
              )}

              {crewId && (
                <>
                  <Text style={styles.subLabel}>{t('match.create.crewFirst')}</Text>
                  <Text style={styles.toggleHelp}>{t('match.create.crewFirstHelp')}</Text>
                  <Stepper
                    value={String(crewFirstHours)}
                    onChange={(v) => setCrewFirstHours(parseInt(v, 10) || 0)}
                    min={0}
                    max={72}
                  />
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* ── Level, format, price ──────────────────────────────────────── */}
      <Text style={styles.label}>{t('match.create.levelLabel')}</Text>
      <Controller
        control={control}
        name="skillLevel"
        render={({ field: { onChange, value } }) => (
          <ChipRow
            value={value}
            onChange={onChange}
            options={LEVELS.map((level) => ({ value: level, label: t(`player.level.${level}`) }))}
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
            render={({ field: { onChange, value } }) => (
              <Stepper value={value} onChange={onChange} min={PLAYERS_MIN} max={PLAYERS_MAX} />
            )}
          />
        </>
      )}

      <Text style={styles.label}>{t('match.create.priceLabel')}</Text>
      <Controller
        control={control}
        name="pricePerPlayer"
        render={({ field: { onChange, value } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder={t('match.create.pricePlaceholder')}
            keyboardType="decimal-pad"
            maxLength={6}
          />
        )}
      />

      <Text style={styles.label}>{t('match.create.notesLabel')}</Text>
      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, value } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder={t('match.create.notesPlaceholder')}
            maxLength={500}
          />
        )}
      />

      {/* ── Optional crew + recurrence ─────────────────────────────────── */}
      {crews && crews.length > 0 && (
        <>
          <Text style={styles.label}>{t('match.create.crewLabel')}</Text>
          <View style={styles.chipRow}>
            <Chip
              label={t('match.create.noCrew')}
              active={crewId === null}
              variant="outlined"
              onPress={() => setCrewId(null)}
            />
            {crews.map((crew) => (
              <Chip
                key={crew.id}
                label={crew.name}
                active={crewId === crew.id}
                onPress={() => setCrewId(crew.id)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{t('match.create.crewHint')}</Text>
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
      {recurrence !== 'none' && <Text style={styles.hint}>{t('match.create.recurrenceHint')}</Text>}

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
        <PrimaryButton
          label={t('match.create.submit')}
          onPress={handleSubmit(onSubmit)}
          loading={submitting}
          disabled={publish && !canPublish}
          glow={false}
        />
      </View>
    </ScrollView>
  )
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: string
  onChange: (v: string) => void
  min: number
  max: number
}) {
  const parsed = parseInt(value, 10)
  const current = Number.isNaN(parsed) ? min : parsed

  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepperButton, current <= min && styles.stepperButtonDisabled]}
        onPress={() => onChange(String(Math.max(min, current - 1)))}
        disabled={current <= min}
        accessibilityRole="button"
        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      >
        <Text style={styles.stepperButtonText}>{MINUS}</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{String(current)}</Text>
      <Pressable
        style={[styles.stepperButton, current >= max && styles.stepperButtonDisabled]}
        onPress={() => onChange(String(Math.min(max, current + 1)))}
        disabled={current >= max}
        accessibilityRole="button"
        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      >
        <Text style={styles.stepperButtonText}>{PLUS}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 36,
    letterSpacing: 1.44,
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
  subLabel: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customTimeWrap: { marginTop: 10 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  cityInput: { flex: 1 },
  publishCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
  },
  publishHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  publishText: { flex: 1, gap: 2 },
  publishTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  publishBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12.5, lineHeight: 18 },
  publishWarning: { marginTop: 12 },
  hint: {
    color: Colors.inkSecondary,
    fontSize: 12.5,
    fontFamily: Fonts.inter,
    lineHeight: 18,
    marginTop: 10,
  },
  inputError: { borderColor: Colors.primary },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  disclosureText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.inkSecondary,
  },
  advanced: { gap: 12, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { flex: 1, gap: 3 },
  toggleLabel: { fontFamily: Fonts.interSemiBold, fontSize: 14, color: Colors.ink },
  toggleHelp: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 16,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    padding: 5,
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: { opacity: 0.4 },
  stepperButtonText: { color: Colors.inkSecondary, fontSize: 18, fontFamily: Fonts.interMedium },
  stepperValue: {
    fontFamily: Fonts.bebas,
    fontSize: 22,
    letterSpacing: 0.88,
    color: Colors.ink,
    minWidth: 26,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  submitWrap: { marginTop: 36 },
  errorText: { color: Colors.primary, fontSize: 14, fontFamily: Fonts.inter, marginBottom: 16 },
})
