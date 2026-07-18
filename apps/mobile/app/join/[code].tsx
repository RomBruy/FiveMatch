import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/expo'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

// The mockup's red period after the group name — punctuation, not content.
const PERIOD = '.'
const TICKET_EDGE_DOTS = 14

type InvitePreview = {
  groupId: string
  groupName: string
  organizerDisplayName: string
  memberCount: number
}

/** Decorative perforation line — the paper screen's one texture element. */
function TicketEdge() {
  return (
    <View
      style={styles.ticketEdge}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: TICKET_EDGE_DOTS }, (_, i) => (
        <View key={i} style={styles.ticketEdgeDot} />
      ))}
    </View>
  )
}

export default function JoinScreen() {
  const { t } = useTranslation()
  const { code } = useLocalSearchParams<{ code: string }>()
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { data: preview, isLoading, isError } = useQuery<InvitePreview>({
    queryKey: ['invite', code],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/v1/invite/${code}`)
      if (!res.ok) throw new Error('not found')
      const json = await res.json()
      return json.data as InvitePreview
    },
    enabled: Boolean(code),
    retry: false,
  })

  const joinMutation = useMutation({
    mutationFn: async () => {
      await httpClient.post(`/v1/groups/${preview?.groupId}/join`)
    },
    onSuccess: () => {
      router.replace(`/(group)/pending?groupId=${preview?.groupId}`)
    },
  })

  // Status bar flips to dark-content on this screen only (paper ground);
  // the RN StatusBar stack restores the previous style on unmount.
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator color={Colors.paperRed} />
      </View>
    )
  }

  if (isError || !preview) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{t('groups.join.notFound')}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <Text style={styles.ticketLabel}>{t('groups.join.ticketLabel')}</Text>

        <Text style={styles.groupName}>
          {preview.groupName}
          <Text style={styles.groupNamePeriod}>{PERIOD}</Text>
        </Text>

        <View style={styles.ticketCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('groups.join.organizerLabel')}</Text>
            <Text style={styles.metaValue}>{preview.organizerDisplayName}</Text>
          </View>

          <TicketEdge />

          <View style={styles.metaRow}>
            <Text style={styles.metaValue}>{t('groups.join.membersLabel', { count: preview.memberCount })}</Text>
          </View>
        </View>
      </View>

      {isSignedIn ? (
        <Pressable
          style={[styles.cta, joinMutation.isPending && styles.ctaDisabled]}
          onPress={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          accessibilityRole="button"
        >
          {joinMutation.isPending ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>{t('groups.join.cta')}</Text>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.ghostCta} onPress={() => router.push('/(auth)/sign-in')} accessibilityRole="button">
          <Text style={styles.ghostCtaText}>{t('groups.join.signInCta')}</Text>
        </Pressable>
      )}

      {joinMutation.isError && (
        <Text style={styles.errorText}>{t('groups.join.alreadyMember')}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.paper,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  ticketLabel: {
    color: Colors.paperInk2,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.76, // 0.16em @ 11 (label-caps register, wide end)
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  groupName: {
    color: Colors.paperInk,
    fontFamily: Fonts.bebas,
    fontSize: 64,
    lineHeight: 60, // 0.92 line-height per the mockup's display block
    letterSpacing: 1.28, // 0.02em @ 64
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  groupNamePeriod: {
    color: Colors.paperRed,
  },
  ticketCard: {
    backgroundColor: Colors.paperCard,
    borderRadius: Radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  metaRow: {
    paddingVertical: 8,
    gap: 3,
  },
  metaLabel: {
    color: Colors.paperInk2,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54, // 0.14em @ 11 (label-caps register)
    textTransform: 'uppercase',
  },
  metaValue: {
    color: Colors.paperInk,
    fontSize: 15,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.3,
  },
  ticketEdge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  ticketEdgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.paperDot,
  },
  cta: {
    height: 54,
    borderRadius: Radius.full,
    backgroundColor: Colors.paperRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    // paperRed meets contrast for white bold 15px labels on bone per spec.
    color: Colors.onPrimary,
    fontSize: 15,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.3,
  },
  ghostCta: {
    height: 54,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ghostCtaText: {
    color: Colors.paperInk,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  errorText: {
    color: Colors.paperInk2,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
    marginTop: 16,
  },
})
