import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useController, useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { useGroupContext } from '../../contexts/GroupContext'
import { DuotoneAvatar } from '../../components/ui/DuotoneAvatar'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { RatingSlider } from '../../components/ui/RatingSlider'
import { SecondaryButton } from '../../components/ui/SecondaryButton'

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
  return <RatingSlider label={label} value={field.value} onChange={field.onChange} />
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

  const total = data?.total ?? 0
  const progressPct = total > 0 ? Math.min(100, Math.round((ratedCount / total) * 100)) : 0

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
        <Text style={styles.doneText}>{t('rating.initial.done')}</Text>
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
        {/* Header */}
        <Text style={styles.title}>{t('rating.initial.title')}</Text>
        <Text style={styles.subtitle}>{t('rating.initial.subtitle')}</Text>

        {/* Per-player progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>
              {t('rating.initial.progress', { rated: ratedCount, total })}
            </Text>
          </View>
        </View>

        {/* Rating card: featured player + attribute sliders */}
        <View style={styles.card}>
          <View style={styles.playerCard}>
            <DuotoneAvatar displayName={currentPlayer.displayName} size={56} variant="ember" />
            <Text style={styles.playerName}>{currentPlayer.displayName}</Text>
          </View>

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
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={t('rating.initial.next')}
            onPress={onSubmit}
            loading={submitMutation.isPending}
          />
          <SecondaryButton
            label={t('rating.initial.skip')}
            onPress={onSkip}
            disabled={submitMutation.isPending}
          />
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
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 36,
    letterSpacing: Type.display.letterSpacing,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  progressPill: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  progressText: {
    color: Colors.inkSecondary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 16,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  playerName: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 24,
    letterSpacing: Type.heading.letterSpacing,
  },
  attrsScroll: {
    flex: 1,
  },
  attrsContent: {
    gap: 14,
    paddingBottom: 8,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  doneText: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 28,
    letterSpacing: Type.display.letterSpacing,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 16,
    textAlign: 'center',
  },
})
