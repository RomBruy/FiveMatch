import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../../constants/colors'
import { Fonts, Radius } from '../../../../constants/tokens'
import { DuotoneAvatar, getInitials } from '../../../../components/ui/DuotoneAvatar'
import { TextureType } from '../../../../components/ui/TextureType'
import { httpClient } from '../../../../lib/api-client'
import { useGroupContext } from '../../../../contexts/GroupContext'

interface GroupData {
  id: string
  name: string
  tier: string
  matchCount: number
  formatPreset: string
  goalkeeperMode: string
  generatorStyle: string
  playStyle: string | null
}

interface JoinRequest {
  requestId: string
  displayName: string | null
  requestedAt: string
}

export default function GroupHomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const { setActiveGroupId } = useGroupContext()
  const queryClient = useQueryClient()

  const { data: group, isLoading, isError } = useQuery({
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

  const { data: joinRequests } = useQuery({
    queryKey: ['groups', groupId, 'join-requests'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: JoinRequest[] } }>(
        `/v1/groups/${groupId}/join-requests`,
      )
      return data.data.items
    },
    enabled: Boolean(groupId) && isOrganizer,
  })

  const approveMutation = useMutation({
    mutationFn: (userId: string) =>
      httpClient.post(`/v1/groups/${groupId}/members/${userId}/approve`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'join-requests'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (userId: string) =>
      httpClient.post(`/v1/groups/${groupId}/members/${userId}/reject`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'join-requests'] }),
  })

  useEffect(() => {
    if (groupId) {
      setActiveGroupId(groupId)
    }
  }, [groupId])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !group) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('common.loadError')}</Text>
      </View>
    )
  }

  const tierKey = `groups.home.tier.${group.tier}` as const

  return (
    <View style={styles.container}>
      {/* The screen's ONE texture element: crest-initials outline watermark (shared Accueil composition). */}
      <TextureType lines={[{ text: getInitials(group.name) }]} fontSize={200} style={styles.crestTexture} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.header}>
          <DuotoneAvatar displayName={group.name} size={42} />
          <View style={styles.headerText}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            <View style={styles.tierPill}>
              <Text style={styles.tierPillText}>{t(tierKey)}</Text>
            </View>
          </View>
          {isOrganizer && (
            <Pressable
              onPress={() => router.push(`/(app)/groups/${groupId}/roster`)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={t('groups.roster.viewButton')}
            >
              <Ionicons name="people-outline" size={19} color={Colors.inkSecondary} />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push(`/(app)/groups/${groupId}/settings`)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('groups.home.settingsButton')}
          >
            <Ionicons name="settings-outline" size={19} color={Colors.inkSecondary} />
          </Pressable>
        </View>

        {isOrganizer && joinRequests && joinRequests.length > 0 && (
          <View style={styles.joinRequestsSection}>
            <Text style={styles.sectionLabel}>{t('groups.requests.title')}</Text>
            {joinRequests.map((req) => (
              <View key={req.requestId} style={styles.joinRequestRow}>
                <Text style={styles.joinRequestName} numberOfLines={1}>
                  {req.displayName ?? '—'}
                </Text>
                <View style={styles.joinRequestActions}>
                  <Pressable
                    style={[styles.actionPill, styles.acceptPill]}
                    onPress={() => approveMutation.mutate(req.requestId)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    accessibilityRole="button"
                  >
                    <Text style={styles.acceptPillText}>{t('groups.requests.accept')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionPill, styles.rejectPill]}
                    onPress={() => rejectMutation.mutate(req.requestId)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    accessibilityRole="button"
                  >
                    <Text style={styles.rejectPillText}>{t('groups.requests.reject')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('groups.home.emptyRoster')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  crestTexture: {
    top: 30,
    right: -70,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupName: {
    flexShrink: 1,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.92, // 0.08em @ 24 (heading register)
    color: Colors.ink,
  },
  tierPill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierPillText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  joinRequestsSection: {
    marginTop: 28,
  },
  joinRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  joinRequestName: {
    flex: 1,
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  joinRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPill: {
    height: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptPill: {
    backgroundColor: Colors.successSubtle,
  },
  acceptPillText: {
    color: Colors.success,
    fontSize: 13,
    fontFamily: Fonts.interBold,
  },
  rejectPill: {
    backgroundColor: Colors.primarySubtle,
  },
  rejectPillText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 200,
  },
  emptyStateText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.inter,
  },
})
