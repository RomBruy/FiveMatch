import { View, Text, StyleSheet, Alert, Share, Linking, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { haptics } from '../../lib/haptics'
import { PressableScale } from '../ui/PressableScale'
import type { AttendanceEntry } from '../../lib/matches'

interface HostMatchActionsProps {
  matchId: string
  scheduledAt: string
  venueName: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  waitlist: AttendanceEntry[]
  canCancel: boolean
}

/**
 * What a host actually needs on the day.
 *
 * These existed only as endpoints — a host could not edit a time, call a match
 * off, share it, get directions or pull someone off the waitlist from inside the
 * app (AF-009). Everything here is a contextual action on the match in front of
 * them, not a settings screen somewhere else.
 */
export function HostMatchActions({
  matchId, scheduledAt, venueName, city, latitude, longitude, waitlist, canCancel,
}: HostMatchActionsProps) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['matches'] })
    queryClient.invalidateQueries({ queryKey: ['attendances', matchId] })
  }

  const cancelMatch = useMutation({
    mutationFn: () => httpClient.post(`/v1/matches/${matchId}/cancel`, {}),
    onSuccess: () => { haptics.success(); invalidate(); router.back() },
    onError: () => Alert.alert(t('common.genericError')),
  })

  const promote = useMutation({
    mutationFn: (playerId: string) =>
      httpClient.post(`/v1/matches/${matchId}/waitlist/${playerId}/promote`, {}),
    onSuccess: () => { haptics.success(); invalidate() },
    onError: () => Alert.alert(t('match.host.promoteError')),
  })

  const share = async () => {
    const when = new Date(scheduledAt).toLocaleString(i18n.language, {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })
    const where = venueName ?? city ?? ''
    await Share.share({
      message: t('match.host.shareMessage', { when, where, link: `https://fivematch.app/m/${matchId}` }),
    })
  }

  /**
   * Open the venue in the platform's maps app. Coordinates when we have them,
   * otherwise the venue name as a search — a name a human typed is more use to a
   * driver than nothing at all.
   */
  const openDirections = async () => {
    const label = encodeURIComponent(venueName ?? city ?? '')
    const url = latitude != null && longitude != null
      ? Platform.select({
        ios: `maps://?daddr=${latitude},${longitude}`,
        default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      })!
      : `https://maps.google.com/?q=${label}`

    const canOpen = await Linking.canOpenURL(url)
    await Linking.openURL(canOpen ? url : `https://maps.google.com/?q=${label}`)
  }

  const confirmCancel = () => Alert.alert(
    t('match.host.cancel.title'),
    t('match.host.cancel.body'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('match.host.cancel.confirm'), style: 'destructive', onPress: () => cancelMatch.mutate() },
    ],
  )

  const hasLocation = Boolean(latitude != null || venueName || city)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('match.host.title').toUpperCase()}</Text>

      <View style={styles.actions}>
        <Action icon="create-outline" label={t('match.host.edit')} onPress={() => router.push(`/(app)/match/edit?matchId=${matchId}` as never)} />
        <Action icon="share-outline" label={t('match.host.share')} onPress={() => void share()} />
        {hasLocation && (
          <Action icon="navigate-outline" label={t('match.host.directions')} onPress={() => void openDirections()} />
        )}
      </View>

      {waitlist.length > 0 && (
        <View style={styles.waitlist}>
          <Text style={styles.sectionLabel}>{t('match.host.waitlist').toUpperCase()}</Text>
          {waitlist.map((entry) => (
            <View key={entry.playerId} style={styles.waitRow}>
              <Text style={styles.waitName} numberOfLines={1}>{entry.displayName}</Text>
              <PressableScale
                onPress={() => promote.mutate(entry.playerId)}
                disabled={promote.isPending}
                style={styles.promotePill}
              >
                <Text style={styles.promoteText}>{t('match.host.promote')}</Text>
              </PressableScale>
            </View>
          ))}
        </View>
      )}

      {canCancel && (
        <PressableScale onPress={confirmCancel} style={styles.cancelRow}>
          <Ionicons name="close-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.cancelText}>{t('match.host.cancel.action')}</Text>
        </PressableScale>
      )}
    </View>
  )
}

function Action({ icon, label, onPress }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <PressableScale onPress={onPress} style={styles.action} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={Colors.ink} />
      <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  actions: { flexDirection: 'row', gap: 8 },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontFamily: Fonts.inter,
    fontSize: 11,
    color: Colors.inkSecondary,
  },
  waitlist: { gap: 8, marginTop: 4 },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  waitName: { flex: 1, fontFamily: Fonts.inter, fontSize: 14, color: Colors.ink },
  promotePill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.inkDisabled,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  promoteText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  cancelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  cancelText: { fontFamily: Fonts.inter, fontSize: 13, color: Colors.primary },
})
