import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Switch, Share,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { Colors } from '../../../../constants/colors'
import { httpClient } from '../../../../lib/api-client'

type FormatPreset = '5v5' | '6v6' | '7v7' | 'custom'
type GoalkeeperMode = 'fixed' | 'rotating' | 'none'
type GeneratorStyle = 'pure_ovr' | 'position_aware' | 'mixed'

interface GroupSettingsForm {
  name: string
  formatPreset: FormatPreset
  goalkeeperMode: GoalkeeperMode
  generatorStyle: GeneratorStyle
  searchable: boolean
}

interface GroupData {
  id: string
  name: string
  tier: string
  formatPreset: FormatPreset
  goalkeeperMode: GoalkeeperMode
  generatorStyle: GeneratorStyle
  playStyle: string | null
  inviteCode: string | null
  searchable: boolean
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

export default function GroupSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const { data: group, isLoading } = useQuery({
    queryKey: ['groups', groupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: GroupData }>(`/v1/groups/${groupId}`)
      return data.data
    },
    enabled: Boolean(groupId),
  })

  const { data: myStatus } = useQuery({
    queryKey: ['groups', groupId, 'my-status'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { role: string } }>(`/v1/groups/${groupId}/my-status`)
      return data.data
    },
    enabled: Boolean(groupId),
  })

  const isOrganizer = myStatus?.role === 'organizer'

  const { control, handleSubmit, reset, formState: { isDirty, dirtyFields } } = useForm<GroupSettingsForm>()

  useEffect(() => {
    if (group) {
      reset({
        name: group.name,
        formatPreset: group.formatPreset,
        goalkeeperMode: group.goalkeeperMode,
        generatorStyle: group.generatorStyle,
        searchable: group.searchable,
      })
    }
  }, [group])

  const mutation = useMutation({
    mutationFn: async (data: Partial<GroupSettingsForm>) => {
      const res = await httpClient.patch<{ data: GroupData }>(`/v1/groups/${groupId}`, data)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
      router.back()
    },
    onError: () => {
      setSaveError(t('common.genericError'))
    },
  })

  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await httpClient.post<{ data: { inviteCode: string; inviteLink: string } }>(
        `/v1/groups/${groupId}/invite/generate`,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
    },
  })

  const joinByCodeMutation = useMutation({
    mutationFn: async (codeToUse: string) => {
      // First resolve the code to a groupId via the public invite endpoint
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
      const res = await fetch(`${apiUrl}/v1/invite/${codeToUse}`)
      if (!res.ok) throw new Error('not_found')
      const preview = await res.json()
      await httpClient.post(`/v1/groups/${preview.data.groupId}/join`)
      return preview.data.groupId as string
    },
    onSuccess: (targetGroupId: string) => {
      router.replace(`/(group)/pending?groupId=${targetGroupId}`)
    },
    onError: () => {
      setJoinError(t('groups.join.notFound'))
    },
  })

  const handleShareInvite = async () => {
    const code = group?.inviteCode ?? generateInviteMutation.data?.inviteCode
    if (!code) return
    await Share.share({ message: `fivematch://join/${code}` })
  }

  const onSubmit = (data: GroupSettingsForm) => {
    setSaveError(null)
    const patch: Partial<GroupSettingsForm> = {}
    if (dirtyFields.name) patch.name = data.name
    if (dirtyFields.formatPreset) patch.formatPreset = data.formatPreset
    if (dirtyFields.goalkeeperMode) patch.goalkeeperMode = data.goalkeeperMode
    if (dirtyFields.generatorStyle) patch.generatorStyle = data.generatorStyle
    if (dirtyFields.searchable) patch.searchable = data.searchable
    mutation.mutate(patch)
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const currentInviteCode = generateInviteMutation.data?.inviteCode ?? group?.inviteCode

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('groups.settings.title')}</Text>

      {saveError && <Text style={styles.errorText}>{saveError}</Text>}

      <Text style={styles.label}>{t('groups.create.nameLabel')}</Text>
      <Controller
        control={control}
        name="name"
        rules={{ required: true, minLength: 1, maxLength: 100 }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
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

      {isOrganizer && (
        <>
          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>{t('groups.settings.inviteSection')}</Text>

          {currentInviteCode && (
            <View style={styles.inviteCodeRow}>
              <Text style={styles.inviteCode}>{currentInviteCode}</Text>
              <Pressable style={styles.secondaryButton} onPress={handleShareInvite}>
                <Text style={styles.secondaryButtonText}>{t('groups.settings.shareLink')}</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[styles.secondaryButton, generateInviteMutation.isPending && styles.buttonDisabled]}
            onPress={() => generateInviteMutation.mutate()}
            disabled={generateInviteMutation.isPending}
          >
            {generateInviteMutation.isPending ? (
              <ActivityIndicator color={Colors.ink} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {currentInviteCode ? t('groups.settings.regenerate') : t('groups.settings.inviteCode')}
              </Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('groups.settings.searchable')}</Text>
            <Controller
              control={control}
              name="searchable"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value ?? false}
                  onValueChange={(val) => onChange(val)}
                  trackColor={{ true: Colors.primary, false: Colors.surface }}
                  thumbColor={Colors.ink}
                />
              )}
            />
          </View>
        </>
      )}

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>{t('groups.join.byCode')}</Text>

      <TextInput
        style={styles.input}
        value={joinCode}
        onChangeText={(v) => {
          setJoinCode(v.toUpperCase())
          setJoinError(null)
        }}
        placeholder={t('groups.join.codePlaceholder')}
        placeholderTextColor={Colors.inkSecondary}
        autoCapitalize="characters"
        maxLength={8}
      />

      {joinError && <Text style={styles.errorText}>{joinError}</Text>}

      <Pressable
        style={[styles.secondaryButton, (!joinCode.trim() || joinByCodeMutation.isPending) && styles.buttonDisabled]}
        onPress={() => {
          setJoinError(null)
          joinByCodeMutation.mutate(joinCode.trim())
        }}
        disabled={!joinCode.trim() || joinByCodeMutation.isPending}
      >
        {joinByCodeMutation.isPending ? (
          <ActivityIndicator color={Colors.ink} size="small" />
        ) : (
          <Text style={styles.secondaryButtonText}>{t('groups.join.cta')}</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.saveButton, (!isDirty || mutation.isPending) && styles.saveButtonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={!isDirty || mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color={Colors.ink} />
        ) : (
          <Text style={styles.saveButtonText}>{t('groups.settings.save')}</Text>
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
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.ink,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.surface,
    marginVertical: 24,
  },
  sectionTitle: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  switchLabel: {
    color: Colors.ink,
    fontSize: 15,
    flex: 1,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  inviteCode: {
    color: Colors.ink,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    flex: 1,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.ink,
    padding: 12,
    borderRadius: 4,
    fontSize: 15,
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
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: Colors.surfaceRaised,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  secondaryButtonText: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    marginBottom: 16,
    marginTop: 8,
  },
})
