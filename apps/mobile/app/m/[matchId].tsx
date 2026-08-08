import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SpotsMeter } from '../../components/match/SpotsMeter'
import { httpClient } from '../../lib/api-client'
import type { PublicMatchPreview } from '@fivematch/types'

/**
 * Public preview of an open match — what a shared link opens.
 *
 * This is the acquisition surface: a host drops the URL in WhatsApp and anyone,
 * signed in or not, sees the fixture before deciding. A signed-in visitor is
 * forwarded straight to the real match screen; everyone else gets the pitch and
 * one button.
 */
export default function MatchPreviewScreen() {
  const { t, i18n } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    if (isLoaded && isSignedIn && matchId) {
      router.replace(`/(app)/match/${matchId}` as never)
    }
  }, [isLoaded, isSignedIn, matchId, router])

  const { data: match, isLoading, isError } = useQuery({
    queryKey: ['match-preview', matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: PublicMatchPreview }>(`/v1/matches/${matchId}/preview`)
      return data.data
    },
    enabled: Boolean(matchId) && isLoaded && !isSignedIn,
  })

  if (!isLoaded || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.paperRed} />
      </View>
    )
  }

  if (isError || !match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('match.notFound')}</Text>
      </View>
    )
  }

  const date = new Date(match.scheduledAt)
  const dayLabel = date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.eyebrow}>{t('preview.eyebrow')}</Text>

      <Text style={styles.time}>{timeLabel}</Text>
      <Text style={styles.day}>{dayLabel}</Text>

      {match.city && (
        <Text style={styles.place}>{match.city}</Text>
      )}

      <Text style={styles.meta}>
        {[
          match.format.toUpperCase(),
          t(`player.level.${match.skillLevel}`).toUpperCase(),
          ...(match.pricePerPlayer
            ? [t('match.pricePerPlayer', {
                amount: String(match.pricePerPlayer),
                currency: match.currency === 'EUR' ? '€' : match.currency,
              })]
            : []),
        ].join(' · ')}
      </Text>

      <View style={styles.spotsCard}>
        <SpotsMeter
          confirmed={match.availability.confirmedCount}
          capacity={match.availability.capacity}
          spotsRemaining={match.availability.spotsRemaining}
          tone="paper"
        />
      </View>

      {match.host.displayName && (
        <Text style={styles.host}>{t('match.hostedBy', { name: match.host.displayName })}</Text>
      )}

      <View style={styles.cta}>
        <PrimaryButton
          label={match.availability.spotsRemaining > 0 ? t('preview.joinCta') : t('preview.signInCta')}
          onPress={() => router.replace('/(auth)/sign-up')}
        />
        <Text style={styles.ctaNote}>{t('preview.ctaNote')}</Text>
      </View>
    </View>
  )
}

// Bone paper, like the invite screen — a shared link lands somewhere that
// doesn't look like the inside of the app, because it isn't yet.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper, paddingHorizontal: 24 },
  centered: {
    flex: 1,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: { color: Colors.paperInk2, fontFamily: Fonts.inter, fontSize: 15 },
  eyebrow: {
    color: Colors.paperRed,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  time: {
    fontFamily: Fonts.bebas,
    fontSize: 84,
    letterSpacing: -0.84,
    color: Colors.paperInk,
    fontVariant: ['tabular-nums'],
    lineHeight: 88,
    marginTop: 12,
  },
  day: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.paperInk2,
  },
  place: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 17,
    color: Colors.paperInk,
    marginTop: 16,
  },
  meta: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.paperInk2,
    marginTop: 4,
  },
  spotsCard: {
    backgroundColor: Colors.paperCard,
    borderRadius: Radius.md,
    padding: 16,
    marginTop: 28,
  },
  host: {
    fontFamily: Fonts.inter,
    fontSize: 12.5,
    color: Colors.paperInk2,
    marginTop: 14,
  },
  cta: { marginTop: 'auto', marginBottom: 40, gap: 12 },
  ctaNote: {
    fontFamily: Fonts.inter,
    fontSize: 12,
    color: Colors.paperInk2,
    textAlign: 'center',
  },
})
