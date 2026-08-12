import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { PressableScale } from '../../components/ui/PressableScale'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { Input } from '../../components/ui/Input'
import type { PublicMatchPreview } from '@fivematch/types'

/**
 * Browse matches without an account (AF-001).
 *
 * The product's promise is "find a match", and until now the only way to see
 * whether there was one was to create an account and complete a profile first —
 * asking for commitment before showing anything worth committing to.
 *
 * Deliberately thin: city, when, level, price, places left. Tapping through goes
 * to the existing shared-link preview, which carries the match through sign-up
 * so nobody loses the fixture they came for.
 */
export default function GuestDiscoverScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [city, setCity] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data: matches, isLoading, isError } = useQuery({
    queryKey: ['guest-discover', submitted],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: PublicMatchPreview[] }>(
        '/v1/discover/public',
        { params: submitted ? { city: submitted } : {} },
      )
      return data.data
    },
  })

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('guestDiscover.title')}</Text>
      <Text style={styles.subtitle}>{t('guestDiscover.subtitle')}</Text>

      <View style={styles.search}>
        <Input
          value={city}
          onChangeText={setCity}
          placeholder={t('guestDiscover.cityPlaceholder')}
          autoCapitalize="words"
          onSubmitEditing={() => setSubmitted(city.trim())}
          returnKeyType="search"
        />
      </View>

      {isLoading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

      {isError && <Text style={styles.empty}>{t('common.genericError')}</Text>}

      {!isLoading && matches?.length === 0 && (
        <Text style={styles.empty}>{t('guestDiscover.empty')}</Text>
      )}

      {matches?.map((match) => (
        <PressableScale
          key={match.matchId}
          // The shared-link preview, which already carries the match through
          // sign-up so the fixture is never lost.
          onPress={() => router.push(`/m/${match.matchId}` as never)}
          style={styles.card}
          accessibilityRole="button"
        >
          <View style={styles.cardHead}>
            <Text style={styles.when}>{dateLabel(match.scheduledAt)}</Text>
            <Text style={styles.spots}>
              {t('guestDiscover.spots', { count: match.availability.spotsRemaining })}
            </Text>
          </View>
          <Text style={styles.where} numberOfLines={1}>
            {match.city ?? t('guestDiscover.somewhere')}
            {match.distanceKm != null ? ` · ${Math.round(match.distanceKm)} km` : ''}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>{match.format}</Text>
            <Text style={styles.metaText}>·</Text>
            <Text style={styles.metaText}>{t(`player.level.${match.skillLevel}`)}</Text>
            {match.pricePerPlayer != null && match.pricePerPlayer > 0 && (
              <>
                <Text style={styles.metaText}>·</Text>
                <Text style={styles.metaText}>{match.pricePerPlayer} {match.currency}</Text>
              </>
            )}
          </View>
        </PressableScale>
      ))}

      <View style={styles.footer}>
        <Ionicons name="lock-open-outline" size={16} color={Colors.inkDisabled} />
        <Text style={styles.footerText}>{t('guestDiscover.accountNote')}</Text>
      </View>

      <PrimaryButton
        label={t('guestDiscover.createAccount')}
        onPress={() => router.push('/(auth)/sign-up' as never)}
      />
      <SecondaryButton
        label={t('guestDiscover.signIn')}
        onPress={() => router.push('/(auth)/sign-in' as never)}
      />

      <View style={{ height: insets.bottom + 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, gap: 12 },
  title: { fontFamily: Fonts.bebas, fontSize: Type.display.maxSize, color: Colors.ink },
  subtitle: { fontFamily: Fonts.inter, fontSize: 14, color: Colors.inkSecondary },
  search: { marginTop: 4 },
  loader: { marginTop: 24 },
  empty: { fontFamily: Fonts.inter, fontSize: 13, color: Colors.inkDisabled, marginTop: 12 },
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.card,
    padding: 16,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  when: { fontFamily: Fonts.interSemiBold, fontSize: 14, color: Colors.ink, flex: 1 },
  spots: { fontFamily: Fonts.bebas, fontSize: 18, color: Colors.success },
  where: { fontFamily: Fonts.inter, fontSize: 13, color: Colors.inkSecondary },
  meta: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  metaText: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  footerText: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled, flex: 1 },
})
