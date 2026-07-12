import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useController, useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'
import { useGroupContext } from '../../contexts/GroupContext'

const ATTRIBUTES = [
  'pace',
  'technique',
  'passing',
  'defending',
  'physicality',
  'effort',
  'mentality',
] as const

type Attribute = typeof ATTRIBUTES[number]

type RatingFormValues = Record<Attribute, number>

type PendingPlayer = {
  playerId: string
  displayName: string
  avatarInitials: string
}

type PendingResponse = {
  data: {
    items: PendingPlayer[]
    total: number
    rated: number
  }
}

function AttributePicker({
  name,
  label,
  control,
}: {
  name: Attribute
  label: string
  control: ReturnType<typeof useForm<RatingFormValues>>['control']
}) {
  const { field } = useController({ control, name, defaultValue: 5 })
  const value = field.value

  return (
    <View style={styles.attrRow}>
      <Text style={styles.attrLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.pickerBtn, value === n && styles.pickerBtnActive]}
            onPress={() => field.onChange(n)}
            accessibilityLabel={`${label}: ${n}`}
            accessibilityRole="button"
          >
            <Text style={[styles.pickerBtnText, value === n && styles.pickerBtnTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

export default function InitialRatingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { activeGroupId } = useGroupContext()
  const groupId = activeGroupId

  const [localIndex, setLocalIndex] = useState(0)
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState(false)

  const { control, handleSubmit, reset } = useForm<RatingFormValues>({
    defaultValues: { pace: 5, technique: 5, passing: 5, defending: 5, physicality: 5, effort: 5, mentality: 5 },
  })

  // Guard: no active group
  useEffect(() => {
    if (!groupId) {
      router.replace('/(app)')
    }
  }, [groupId])

  const { data, isLoading } = useQuery<PendingResponse['data']>({
    queryKey: ['ratings', 'initial', 'pending', groupId],
    queryFn: async () => {
      const { data: res } = await httpClient.get<PendingResponse>(`/v1/groups/${groupId}/ratings/initial/pending`)
      return res.data
    },
    enabled: Boolean(groupId),
  })

  const submitMutation = useMutation({
    mutationFn: async ({ ratedPlayerId, values }: { ratedPlayerId: string; values: RatingFormValues }) => {
      await httpClient.post(`/v1/groups/${groupId}/ratings/initial`, { ratedPlayerId, ...values })
    },
  })

  // Derive the visible pending list (from API minus locally skipped)
  const allPending = data?.items ?? []
  const pending = allPending.filter((p) => !skippedIds.has(p.playerId))
  const currentPlayer = pending[localIndex] ?? null
  const ratedCount = (data?.rated ?? 0) + (allPending.length - pending.length) // API rated + locally skipped

  // Route to home when done (after confirmation flash)
  useEffect(() => {
    if (showDone) {
      const timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['ratings', 'initial', 'pending', groupId] })
        router.replace('/(app)')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showDone])

  // Auto-advance: if no more pending after data loads, go home
  useEffect(() => {
    if (!isLoading && data && pending.length === 0 && !showDone) {
      router.replace('/(app)')
    }
  }, [isLoading, data, pending.length])

  const advanceOrFinish = () => {
    if (localIndex < pending.length - 1) {
      setLocalIndex((i) => i + 1)
      reset({ pace: 5, technique: 5, passing: 5, defending: 5, physicality: 5, effort: 5, mentality: 5 })
    } else {
      setShowDone(true)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!currentPlayer) return
    await submitMutation.mutateAsync({ ratedPlayerId: currentPlayer.playerId, values })
    advanceOrFinish()
  })

  const onSkip = () => {
    if (!currentPlayer) return
    // TODO: persist initialRatingPending:{groupId} in AsyncStorage once @react-native-async-storage/async-storage is added
    setSkippedIds((prev) => new Set([...prev, currentPlayer.playerId]))
    if (localIndex >= pending.length - 1) {
      setShowDone(true)
    } else {
      setLocalIndex((i) => i + 1)
      reset({ pace: 5, technique: 5, passing: 5, defending: 5, physicality: 5, effort: 5, mentality: 5 })
    }
  }

  if (!groupId || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (showDone) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.doneText, { fontFamily: 'BebasNeue_400Regular' }]}>
          {t('rating.initial.done')}
        </Text>
      </View>
    )
  }

  if (!currentPlayer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('rating.initial.empty')}</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Progress */}
        <Text style={styles.progress}>
          {t('rating.initial.progress', {
            rated: ratedCount,
            total: data?.total ?? 0,
          })}
        </Text>

        {/* Header */}
        <Text style={[styles.title, { fontFamily: 'BebasNeue_400Regular' }]}>
          {t('rating.initial.title')}
        </Text>
        <Text style={styles.subtitle}>{t('rating.initial.subtitle')}</Text>

        {/* Player avatar + name */}
        <View style={styles.playerCard}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarText, { fontFamily: 'BebasNeue_400Regular' }]}>
              {currentPlayer.avatarInitials}
            </Text>
          </View>
          <Text style={[styles.playerName, { fontFamily: 'BebasNeue_400Regular' }]}>
            {currentPlayer.displayName}
          </Text>
        </View>

        {/* Attribute pickers */}
        <ScrollView style={styles.attrsScroll} contentContainerStyle={styles.attrsContent} showsVerticalScrollIndicator={false}>
          {ATTRIBUTES.map((attr) => (
            <AttributePicker
              key={attr}
              name={attr}
              label={t(`rating.initial.attr.${attr}`)}
              control={control}
            />
          ))}
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.submitBtn, submitMutation.isPending && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={submitMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('rating.initial.next')}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color={Colors.ink} size="small" />
            ) : (
              <Text style={[styles.submitBtnText, { fontFamily: 'BebasNeue_400Regular' }]}>
                {t('rating.initial.next')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={onSkip}
            disabled={submitMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('rating.initial.skip')}
          >
            <Text style={styles.skipBtnText}>{t('rating.initial.skip')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  progress: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    color: Colors.ink,
    fontSize: 36,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  playerCard: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.ink,
    fontSize: 20,
  },
  playerName: {
    color: Colors.ink,
    fontSize: 24,
    letterSpacing: 0.15,
  },
  attrsScroll: {
    flex: 1,
  },
  attrsContent: {
    gap: 16,
    paddingBottom: 8,
  },
  attrRow: {
    gap: 8,
  },
  attrLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 4,
  },
  pickerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 2,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnActive: {
    backgroundColor: Colors.primary,
  },
  pickerBtnText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  pickerBtnTextActive: {
    color: Colors.ink,
  },
  actions: {
    gap: 12,
    marginTop: 16,
  },
  submitBtn: {
    height: 52,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: Colors.ink,
    fontSize: 20,
    letterSpacing: 0.07,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipBtnText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  doneText: {
    color: Colors.ink,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
})
