import { KeyboardAvoidingView, Platform, View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Type } from '../../../constants/tokens'
import { Chip } from '../../../components/ui/Chip'
import { Input } from '../../../components/ui/Input'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { httpClient } from '../../../lib/api-client'
import { posthog } from '../../../lib/posthog'
import { TextureType } from '../../../components/ui/TextureType'
import { useGroupContext } from '../../../contexts/GroupContext'

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

function ChipRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | undefined
  onChange: (v: T | undefined) => void
  options: { value: T; label: string; outlined?: boolean; optional?: boolean }[]
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          active={value === opt.value}
          variant={opt.outlined ? 'outlined' : 'filled'}
          onPress={() => onChange(opt.optional && value === opt.value ? undefined : opt.value)}
        />
      ))}
    </View>
  )
}

export default function NewGroupScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { setActiveGroupId } = useGroupContext()
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
      setActiveGroupId(res.data.data.id)
      await queryClient.invalidateQueries({ queryKey: ['users', 'me', 'groups'] })
      router.replace(`/(app)/groups/${res.data.data.id}`)
    } catch (err) {
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        .response?.data?.error?.message
      setError(apiMessage ?? t('common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.screen}>
      <TextureType lines={[{ text: 'BUILD' }, { text: 'YOUR XI', x: 52 }]} style={styles.texture} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('groups.create.title')}<Text style={styles.titleAccent}>.</Text></Text>
            <Text style={styles.subtitle}>{t('groups.create.subtitle')}</Text>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>{t('groups.create.nameLabel')}</Text>
          <Controller
        control={control}
        name="name"
        rules={{ required: true, minLength: 1, maxLength: 100 }}
        render={({ field: { onChange, value } }) => (
          <Input
            value={value}
            onChangeText={onChange}
            placeholder={t('groups.create.namePlaceholder')}
            autoCapitalize="words"
            maxLength={100}
            style={errors.name && styles.inputError}
          />
        )}
          />

          <Text style={styles.label}>{t('groups.create.formatLabel')}</Text>
          <Controller
        control={control}
        name="formatPreset"
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

          <Text style={styles.label}>{t('groups.create.goalkeeperLabel')}</Text>
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

          <Text style={styles.label}>{t('groups.create.playStyleLabel')}</Text>
          <Controller
        control={control}
        name="playStyle"
        render={({ field: { onChange, value } }) => (
          <ChipRow
            value={value}
            onChange={onChange}
            options={[
              { value: 'fixed', label: t('groups.create.playStyleFixed'), optional: true },
              { value: 'flexible', label: t('groups.create.playStyleFlexible'), optional: true },
              { value: 'rotating', label: t('groups.create.playStyleRotating'), optional: true },
              { value: 'hybrid', label: t('groups.create.playStyleHybrid'), optional: true },
            ]}
          />
        )}
          />

          <Text style={styles.label}>{t('groups.create.generatorLabel')}</Text>
          <Controller
        control={control}
        name="generatorStyle"
        render={({ field: { onChange, value } }) => (
          <ChipRow
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

          <View style={styles.submitWrap}>
            {/* The tab dock owns this screen's one glow. */}
            <PrimaryButton
              label={t('groups.create.submit')}
              onPress={handleSubmit(onSubmit)}
              loading={submitting}
              glow={false}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  keyboard: {
    flex: 1,
  },
  texture: {
    top: 34,
    left: -42,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 40,
    letterSpacing: Type.display.letterSpacing,
  },
  titleAccent: {
    color: Colors.primary,
  },
  subtitle: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 300,
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
  inputError: {
    borderColor: Colors.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
