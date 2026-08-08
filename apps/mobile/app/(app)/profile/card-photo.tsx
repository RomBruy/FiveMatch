import { useRef, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Image, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/expo'
import * as ImagePicker from 'expo-image-picker'
import { randomUUID } from 'expo-crypto'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { httpClient } from '../../../lib/api-client'
import { haptics } from '../../../lib/haptics'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'

type ConsentState = {
  granted: boolean
  current: boolean
  policyVersion: string | null
  purpose: string | null
  retentionDays: number | null
  grantedAt: string | null
  currentPolicyVersion: string
}

type CardPhotoStatus = {
  state: 'idle' | 'pending' | 'processing' | 'complete' | 'failed'
  photoUrl: string | null
  generationsUsed: number
  generationsAllowed: number
  resetsAt: string
}

/**
 * Card photo, under global Profile.
 *
 * It used to live under `groups/[groupId]/`, which stopped making sense when the
 * card became a global identity — the same card was reachable at as many URLs as
 * the player had crews. Nothing about it is crew-scoped.
 */
export default function CardPhotoScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const idempotencyKeyRef = useRef<string>(randomUUID())
  const [uploading, setUploading] = useState(false)

  const { data: me } = useQuery<{ playerId: string }>({
    queryKey: ['players', 'me'],
    queryFn: () => httpClient.get('/v1/players/me').then((r) => r.data.data),
  })
  const playerId = me?.playerId

  const { data: consent } = useQuery<ConsentState>({
    queryKey: ['card-photo', 'consent', playerId],
    queryFn: () => httpClient.get(`/v1/players/${playerId}/card-photo/consent`).then((r) => r.data.data),
    enabled: Boolean(playerId),
  })

  const { data: status } = useQuery<CardPhotoStatus>({
    queryKey: ['card-photo', 'status', playerId],
    queryFn: () => httpClient.get(`/v1/players/${playerId}/card-photo/status`).then((r) => r.data.data),
    enabled: Boolean(playerId),
    refetchInterval: (query) => {
      const state = query.state.data?.state
      return state === 'processing' || state === 'pending' ? 2000 : false
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['card-photo'] })

  const grantConsent = useMutation({
    mutationFn: () => httpClient.post(`/v1/players/${playerId}/card-photo/consent`),
    onSuccess: invalidate,
  })

  const withdrawConsent = useMutation({
    mutationFn: () => httpClient.delete(`/v1/players/${playerId}/card-photo/consent`),
    onSuccess: () => { haptics.success(); invalidate() },
  })

  const deletePhoto = useMutation({
    mutationFn: () => httpClient.delete(`/v1/players/${playerId}/card-photo`),
    onSuccess: () => { haptics.success(); invalidate() },
  })

  const generate = useMutation({
    mutationFn: () => httpClient.post(
      `/v1/players/${playerId}/card-photo/generate`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKeyRef.current } },
    ),
    onSuccess: () => { idempotencyKeyRef.current = randomUUID(); invalidate() },
    onError: () => Alert.alert(t('common.genericError')),
  })

  /**
   * Pick a source photo.
   *
   * Uploaded through Clerk, which already hosts the player's photo over HTTPS —
   * the API stores the URL. Hosting a second copy here would duplicate the same
   * personal data for no benefit, and give erasure two places to reach.
   */
  const pickSourcePhoto = async () => {
    if (!user) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Portrait, matching the card slot rather than a square avatar.
      aspect: [15, 17],
      quality: 0.9,
      base64: true,
    })
    if (result.canceled) return

    setUploading(true)
    try {
      const asset = result.assets[0]
      // Clerk cannot read a local file:// URI in React Native.
      const file = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri
      const image = await user.setProfileImage({ file })
      await user.reload()

      const sourceUrl = image.publicUrl || user.imageUrl
      if (!sourceUrl) throw new Error('no url')

      await httpClient.put('/v1/players/me/photo-source', { sourceUrl })
      haptics.success()
      invalidate()
    } catch {
      Alert.alert(t('cardPhoto.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const confirmWithdraw = () => Alert.alert(
    t('cardPhoto.withdraw.title'),
    t('cardPhoto.withdraw.body'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cardPhoto.withdraw.confirm'), style: 'destructive', onPress: () => withdrawConsent.mutate() },
    ],
  )

  const busy = status?.state === 'pending' || status?.state === 'processing'

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>{t('cardPhoto.title')}</Text>

      {status?.photoUrl ? (
        <View style={styles.preview}>
          <Image source={{ uri: status.photoUrl }} style={styles.previewImage} resizeMode="contain" />
        </View>
      ) : null}

      {!consent?.current ? (
        <View style={styles.card}>
          <Text style={styles.body}>{t('cardPhoto.consent.explanation')}</Text>
          <Text style={styles.meta}>
            {t('cardPhoto.consent.terms', { version: consent?.currentPolicyVersion ?? '' })}
          </Text>
          {consent?.granted && !consent.current && (
            // Their old agreement was to different text, so it is not carried
            // forward silently.
            <Text style={styles.meta}>{t('cardPhoto.consent.updated')}</Text>
          )}
          <PrimaryButton
            label={t('cardPhoto.consent.accept')}
            onPress={() => grantConsent.mutate()}
            disabled={grantConsent.isPending}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.body}>{t('cardPhoto.consent.active')}</Text>
          </View>

          <SecondaryButton
            label={uploading ? t('cardPhoto.uploading') : t('cardPhoto.choosePhoto')}
            onPress={() => void pickSourcePhoto()}
            disabled={uploading}
          />

          {busy ? (
            <View style={styles.row}>
              <ActivityIndicator color={Colors.inkSecondary} />
              <Text style={styles.meta}>{t('cardPhoto.processing')}</Text>
            </View>
          ) : (
            <PrimaryButton
              label={status?.state === 'failed' ? t('cardPhoto.retry') : t('cardPhoto.generate')}
              onPress={() => generate.mutate()}
              disabled={generate.isPending}
            />
          )}

          <Text style={styles.meta}>
            {t('cardPhoto.generationsLeft', {
              left: Math.max(0, (status?.generationsAllowed ?? 0) - (status?.generationsUsed ?? 0)),
            })}
          </Text>
        </View>
      )}

      {status?.photoUrl && (
        <SecondaryButton
          label={t('cardPhoto.deletePhoto')}
          onPress={() => deletePhoto.mutate()}
          disabled={deletePhoto.isPending}
        />
      )}

      {consent?.granted && (
        <>
          <SecondaryButton label={t('cardPhoto.withdraw.action')} onPress={confirmWithdraw} />
          <Text style={styles.footnote}>{t('cardPhoto.withdraw.explanation')}</Text>
        </>
      )}

      <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, gap: 12 },
  title: { fontFamily: Fonts.bebas, fontSize: Type.display.maxSize, color: Colors.ink },
  card: { backgroundColor: Colors.surfaceRaised, borderRadius: Radius.card, padding: 18, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: {
    height: 240,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  body: { fontFamily: Fonts.inter, fontSize: 14, color: Colors.ink, flex: 1 },
  meta: { fontFamily: Fonts.inter, fontSize: 12, color: Colors.inkSecondary },
  footnote: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled },
})
