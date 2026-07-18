import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { randomUUID } from 'expo-crypto'
import { Ionicons } from '@expo/vector-icons'
import { httpClient } from '../../../../lib/api-client'
import { Colors } from '../../../../constants/colors'
import { Fonts, Radius } from '../../../../constants/tokens'
import { PrimaryButton } from '../../../../components/ui/PrimaryButton'

type CardPhotoStatus = {
  state: 'idle' | 'pending' | 'processing' | 'complete' | 'failed'
  photoUrl: string | null
  generationsUsed: number
  generationsAllowed: number
  resetsAt: string
}

// Color never the only signal: each generation state pairs its tint with an icon.
const STATE_VISUALS: Record<CardPhotoStatus['state'], { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  idle: { icon: 'image-outline', color: Colors.inkSecondary },
  pending: { icon: 'time-outline', color: Colors.inkSecondary },
  processing: { icon: 'time-outline', color: Colors.inkSecondary },
  complete: { icon: 'checkmark-circle', color: Colors.success },
  failed: { icon: 'alert-circle', color: Colors.primary },
}

export default function CardPhotoSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { groupId, playerId } = useLocalSearchParams<{ groupId: string; playerId: string }>()
  const queryClient = useQueryClient()
  const idempotencyKeyRef = useRef<string>(randomUUID())

  const { data: statusData } = useQuery<CardPhotoStatus>({
    queryKey: ['card-photo-status', groupId, playerId],
    queryFn: () =>
      httpClient
        .get<{ data: CardPhotoStatus }>(
          `/v1/groups/${groupId}/players/${playerId}/card-photo/status`
        )
        .then((r) => r.data.data),
    enabled: !!groupId && !!playerId,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      return state === 'processing' || state === 'pending' ? 2000 : false
    },
  })

  const consentMutation = useMutation({
    mutationFn: () =>
      httpClient.post(`/v1/groups/${groupId}/players/${playerId}/card-photo/consent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-photo-status', groupId, playerId] })
    },
  })

  const generateMutation = useMutation({
    mutationFn: () => {
      idempotencyKeyRef.current = randomUUID()
      return httpClient.post(
        `/v1/groups/${groupId}/players/${playerId}/card-photo/generate`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKeyRef.current } }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-photo-status', groupId, playerId] })
    },
  })

  const state = statusData?.state ?? 'idle'
  const generationsUsed = statusData?.generationsUsed ?? 0
  const generationsAllowed = statusData?.generationsAllowed ?? 3
  const isProcessing = state === 'pending' || state === 'processing'
  const canGenerate = generationsUsed < generationsAllowed && !isProcessing && state !== 'complete'
  const stateVisual = STATE_VISUALS[state]

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('cardPhoto.settings.title')}</Text>

      {state === 'idle' && (
        <View style={styles.consentCard}>
          <Text style={styles.consentText}>{t('cardPhoto.consent.explanation')}</Text>
          <View style={styles.consentActions}>
            <Pressable
              style={[styles.acceptPill, consentMutation.isPending && styles.pillDisabled]}
              onPress={() => consentMutation.mutate()}
              disabled={consentMutation.isPending}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark" size={16} color={Colors.onPrimary} />
              <Text style={styles.acceptPillText}>{t('cardPhoto.consent.accept')}</Text>
            </Pressable>
            <Pressable style={styles.ghostPill} onPress={() => router.back()} accessibilityRole="button">
              <Ionicons name="close" size={16} color={Colors.inkSecondary} />
              <Text style={styles.ghostPillText}>{t('cardPhoto.consent.refuse')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {state !== 'idle' && (
        <View style={styles.statusStack}>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Ionicons name={stateVisual.icon} size={18} color={stateVisual.color} />
              <Text style={[styles.statusLabel, { color: stateVisual.color }]}>
                {t(`cardPhoto.state.${state}`)}
              </Text>
              {isProcessing && <ActivityIndicator color={Colors.primary} size="small" />}
            </View>
            {state === 'failed' && (
              <Text style={styles.failedHint}>{t('cardPhoto.state.failedHint')}</Text>
            )}
          </View>

          <View style={styles.quotaCard}>
            <Text style={styles.quotaText}>
              {t('cardPhoto.quota', { used: generationsUsed, total: generationsAllowed })}
            </Text>
          </View>

          {canGenerate && (
            <PrimaryButton
              label={state === 'failed' ? t('cardPhoto.retry') : t('cardPhoto.generate')}
              onPress={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
            />
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: 24,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 2.4, // 0.10em @ 24 (heading register)
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  consentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 18,
    gap: 16,
  },
  consentText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    lineHeight: 21,
  },
  consentActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptPill: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptPillText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontFamily: Fonts.interBold,
  },
  ghostPill: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostPillText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.interSemiBold,
  },
  pillDisabled: {
    opacity: 0.4,
  },
  statusStack: {
    gap: 12,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  failedHint: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.inter,
    lineHeight: 19,
  },
  quotaCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quotaText: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.interMedium,
    letterSpacing: 0.5,
  },
})
