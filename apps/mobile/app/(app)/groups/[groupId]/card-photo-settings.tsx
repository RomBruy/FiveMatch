import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { randomUUID } from 'expo-crypto'
import { httpClient } from '../../../../lib/api-client'
import { Colors } from '../../../../constants/colors'

type CardPhotoStatus = {
  state: 'idle' | 'pending' | 'processing' | 'complete' | 'failed'
  photoUrl: string | null
  generationsUsed: number
  generationsAllowed: number
  resetsAt: string
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('cardPhoto.settings.title')}</Text>

      {state === 'idle' && (
        <View style={styles.consentBox}>
          <Text style={styles.consentText}>{t('cardPhoto.consent.explanation')}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => consentMutation.mutate()}
            disabled={consentMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>{t('cardPhoto.consent.accept')}</Text>
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={() => router.back()}>
            <Text style={styles.ghostButtonText}>{t('cardPhoto.consent.refuse')}</Text>
          </Pressable>
        </View>
      )}

      {state !== 'idle' && (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>
            {t(`cardPhoto.state.${state}`)}
          </Text>
          {isProcessing && <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />}
          {state === 'failed' && (
            <Text style={styles.errorText}>{t('cardPhoto.state.failedHint')}</Text>
          )}
          <Text style={styles.quotaText}>
            {t('cardPhoto.quota', { used: generationsUsed, total: generationsAllowed })}
          </Text>
          {canGenerate && (
            <Pressable
              style={styles.primaryButton}
              onPress={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {state === 'failed' ? t('cardPhoto.retry') : t('cardPhoto.generate')}
              </Text>
            </Pressable>
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
    fontSize: 20,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 3,
    marginBottom: 24,
  },
  consentBox: { gap: 16 },
  consentText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  statusBox: { gap: 12 },
  statusLabel: {
    color: Colors.ink,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  quotaText: {
    color: Colors.inkDisabled,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
  },
  primaryButton: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.ink,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  ghostButton: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
})
