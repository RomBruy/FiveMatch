import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'
import { useGroupContext } from '../../../contexts/GroupContext'

type MatchFormat = '5v5' | '6v6' | '7v7' | 'custom'
type GoalkeeperMode = 'fixed' | 'rotating' | 'none'

interface CreateMatchForm {
  scheduledAt: string
  location: string
  format: MatchFormat
  goalkeeperMode: GoalkeeperMode
  playersPerTeam: string
}

const FORMAT_PLAYERS: Record<Exclude<MatchFormat, 'custom'>, number> = {
  '5v5': 5,
  '6v6': 6,
  '7v7': 7,
}

function OptionPicker<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <View style={styles.pickerRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.pickerOption, value === opt.value && styles.pickerOptionActive]}
        >
          <Text style={[styles.pickerOptionText, value === opt.value && styles.pickerOptionTextActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

export default function CreateMatchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { activeGroupId } = useGroupContext()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { control, handleSubmit, watch, formState: { errors } } = useForm<CreateMatchForm>({
    defaultValues: {
      scheduledAt: '',
      location: '',
      format: '5v5',
      goalkeeperMode: 'none',
      playersPerTeam: '5',
    },
  })

  const format = watch('format')

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('match.create.title')}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Text style={styles.label}>{t('match.create.scheduledAt')}</Text>
      <Controller
        control={control}
        name="scheduledAt"
        rules={{ required: true, pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/ }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, errors.scheduledAt && styles.inputError]}
            value={value}
            onChangeText={onChange}
            placeholder="2025-01-15 18:00"
            placeholderTextColor={Colors.inkSecondary}
            keyboardType="numbers-and-punctuation"
          />
        )}
      />

      <Text style={styles.label}>{t('match.create.location')}</Text>
      <Controller
        control={control}
        name="location"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholder="Terrain Plaine de Jeux"
            placeholderTextColor={Colors.inkSecondary}
            maxLength={200}
          />
        )}
      />

      <Text style={styles.label}>{t('match.create.format')}</Text>
      <Controller
        control={control}
        name="format"
        render={({ field: { onChange, value } }) => (
          <OptionPicker
            value={value}
            onChange={onChange}
            options={[
              { value: '5v5', label: t('groups.create.format5v5') },
              { value: '6v6', label: t('groups.create.format6v6') },
              { value: '7v7', label: t('groups.create.format7v7') },
              { value: 'custom', label: t('groups.create.formatCustom') },
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
            rules={{ required: true, min: 5, max: 20 }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, errors.playersPerTeam && styles.inputError]}
                value={value}
                onChangeText={onChange}
                keyboardType="number-pad"
                maxLength={2}
              />
            )}
          />
        </>
      )}

      <Text style={styles.label}>{t('match.create.goalkeeperMode')}</Text>
      <Controller
        control={control}
        name="goalkeeperMode"
        render={({ field: { onChange, value } }) => (
          <OptionPicker
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

      <Pressable
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={Colors.ink} />
        ) : (
          <Text style={styles.submitButtonText}>{t('match.create.submit')}</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    color: Colors.ink,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  label: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.ink,
    padding: 12,
    borderRadius: 4,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: Colors.primary,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerOptionActive: {
    borderColor: Colors.primary,
  },
  pickerOptionText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: Colors.ink,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    marginBottom: 16,
  },
})
