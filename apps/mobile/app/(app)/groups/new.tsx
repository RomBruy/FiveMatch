import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'
import { posthog } from '../../../lib/posthog'

type FormatPreset = '5v5' | '6v6' | '7v7' | 'custom'
type GoalkeeperMode = 'fixed' | 'rotating' | 'none'
type PlayStyle = 'fixed' | 'flexible' | 'rotating' | 'hybrid'
type GeneratorStyle = 'pure_ovr' | 'position_aware' | 'mixed'

interface CreateGroupForm {
  name: string
  formatPreset: FormatPreset
  goalkeeperMode: GoalkeeperMode
  playStyle?: PlayStyle
  generatorStyle: GeneratorStyle
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

export default function NewGroupScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { control, handleSubmit, formState: { errors } } = useForm<CreateGroupForm>({
    defaultValues: {
      name: '',
      formatPreset: '5v5',
      goalkeeperMode: 'fixed',
      generatorStyle: 'pure_ovr',
    },
  })

  const onSubmit = async (data: CreateGroupForm) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await httpClient.post<{ data: { id: string } }>('/v1/groups', data)
      posthog.capture('group_created', {
        format_preset: data.formatPreset,
        goalkeeper_mode: data.goalkeeperMode,
        generator_style: data.generatorStyle,
      })
      router.replace(`/(app)/groups/${res.data.data.id}`)
    } catch {
      setError(t('common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('groups.create.title')}</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Text style={styles.label}>{t('groups.create.nameLabel')}</Text>
      <Controller
        control={control}
        name="name"
        rules={{ required: true, minLength: 1, maxLength: 100 }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={value}
            onChangeText={onChange}
            placeholder={t('groups.create.namePlaceholder')}
            placeholderTextColor={Colors.inkSecondary}
            autoCapitalize="words"
            maxLength={100}
          />
        )}
      />

      <Text style={styles.label}>{t('groups.create.formatLabel')}</Text>
      <Controller
        control={control}
        name="formatPreset"
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

      <Text style={styles.label}>{t('groups.create.goalkeeperLabel')}</Text>
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

      <Text style={styles.label}>{t('groups.create.generatorLabel')}</Text>
      <Controller
        control={control}
        name="generatorStyle"
        render={({ field: { onChange, value } }) => (
          <OptionPicker
            value={value}
            onChange={onChange}
            options={[
              { value: 'pure_ovr', label: t('groups.create.generatorPureOvr') },
              { value: 'position_aware', label: t('groups.create.generatorPositionAware') },
              { value: 'mixed', label: t('groups.create.generatorMixed') },
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
          <Text style={styles.submitButtonText}>{t('groups.create.submit')}</Text>
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
