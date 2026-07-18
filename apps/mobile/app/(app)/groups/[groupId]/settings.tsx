import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Switch, Share } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../../constants/colors'
import { Fonts, Radius } from '../../../../constants/tokens'
import { Chip } from '../../../../components/ui/Chip'
import { Input } from '../../../../components/ui/Input'
import { PrimaryButton } from '../../../../components/ui/PrimaryButton'
import { DOCK_CLEARANCE } from '../../../../components/ui/TabDock'
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

export default function GroupSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const insets = useSafeAreaInsets()
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Text style={styles.title}>{t('groups.settings.title')}</Text>

      {saveError && <Text style={styles.errorText}>{saveError}</Text>}

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

      {isOrganizer && (
        <>
          <View style={styles.inviteCard}>
            <Text style={styles.cardLabel}>{t('groups.settings.inviteSection')}</Text>

            {currentInviteCode && (
              <View style={styles.codeBoxRow}>
                {currentInviteCode.split('').map((char, i) => (
                  <View key={`${char}-${i}`} style={styles.codeBox}>
                    <Text style={styles.codeBoxChar}>{char}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.inviteToolbar}>
              {currentInviteCode && (
                <Pressable
                  style={styles.toolbarPill}
                  onPress={handleShareInvite}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={15} color={Colors.ink} />
                  <Text style={styles.toolbarPillText}>{t('groups.settings.shareLink')}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.toolbarPill, generateInviteMutation.isPending && styles.pillDisabled]}
                onPress={() => generateInviteMutation.mutate()}
                disabled={generateInviteMutation.isPending}
                accessibilityRole="button"
              >
                {generateInviteMutation.isPending ? (
                  <ActivityIndicator color={Colors.ink} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={15} color={Colors.ink} />
                    <Text style={styles.toolbarPillText}>
                      {currentInviteCode ? t('groups.settings.regenerate') : t('groups.settings.inviteCode')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.switchCard}>
            <Text style={styles.switchLabel}>{t('groups.settings.searchable')}</Text>
            <Controller
              control={control}
              name="searchable"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value ?? false}
                  onValueChange={(val) => onChange(val)}
                  trackColor={{ true: Colors.primary, false: Colors.surfaceRaised }}
                  thumbColor={Colors.ink}
                />
              )}
            />
          </View>
        </>
      )}

      <Text style={styles.label}>{t('groups.join.byCode')}</Text>
      <Input
        value={joinCode}
        onChangeText={(v) => {
          setJoinCode(v.toUpperCase())
          setJoinError(null)
        }}
        placeholder={t('groups.join.codePlaceholder')}
        autoCapitalize="characters"
        maxLength={8}
      />

      {joinError && <Text style={styles.errorText}>{joinError}</Text>}

      <Pressable
        style={[styles.ghostButton, (!joinCode.trim() || joinByCodeMutation.isPending) && styles.pillDisabled]}
        onPress={() => {
          setJoinError(null)
          joinByCodeMutation.mutate(joinCode.trim())
        }}
        disabled={!joinCode.trim() || joinByCodeMutation.isPending}
        accessibilityRole="button"
      >
        {joinByCodeMutation.isPending ? (
          <ActivityIndicator color={Colors.ink} size="small" />
        ) : (
          <Text style={styles.ghostButtonText}>{t('groups.join.cta')}</Text>
        )}
      </Pressable>

      <View style={styles.saveWrap}>
        {/* The tab dock owns this screen's one glow; save is the screen's ONE PrimaryButton. */}
        <PrimaryButton
          label={t('groups.settings.save')}
          onPress={handleSubmit(onSubmit)}
          disabled={!isDirty}
          loading={mutation.isPending}
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
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
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
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    marginTop: 28,
  },
  cardLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  codeBoxRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  codeBox: {
    flex: 1,
    height: 54,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxChar: {
    // Invite-code register: --type-stat Bebas; the 0.34em tracking is carried by the box gaps.
    fontFamily: Fonts.bebas,
    fontSize: 22,
    color: Colors.ink,
  },
  inviteToolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarPill: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  toolbarPillText: {
    color: Colors.ink,
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  switchLabel: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
    flex: 1,
  },
  ghostButton: {
    height: 50,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 12,
  },
  ghostButtonText: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  pillDisabled: {
    opacity: 0.4,
  },
  saveWrap: {
    marginTop: 36,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    marginTop: 8,
    marginBottom: 8,
  },
})
