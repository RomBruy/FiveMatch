import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Colors } from '../../../../constants/colors'
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
  userId: string
  displayName: string | null
  requestedAt: string
}

export default function GroupHomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{t(tierKey)}</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          {isOrganizer && (
            <Pressable
              onPress={() => router.push(`/(app)/groups/${groupId}/roster`)}
              style={styles.settingsButton}
            >
              <Text style={styles.settingsButtonText}>{t('groups.roster.viewButton')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push(`/(app)/groups/${groupId}/settings`)}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsButtonText}>{t('groups.home.settingsButton')}</Text>
          </Pressable>
        </View>
      </View>

      {isOrganizer && joinRequests && joinRequests.length > 0 && (
        <View style={styles.joinRequestsSection}>
          <Text style={styles.joinRequestsTitle}>{t('groups.requests.title')}</Text>
          {joinRequests.map((req) => (
            <View key={req.userId} style={styles.joinRequestRow}>
              <Text style={styles.joinRequestName}>{req.displayName ?? '—'}</Text>
              <View style={styles.joinRequestActions}>
                <Pressable
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => approveMutation.mutate(req.userId)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  <Text style={styles.acceptButtonText}>{t('groups.requests.accept')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => rejectMutation.mutate(req.userId)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  <Text style={styles.rejectButtonText}>{t('groups.requests.reject')}</Text>
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  headerLeft: {
    flex: 1,
  },
  groupName: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  tierBadgeText: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
  },
  headerButtons: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 12,
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.inkSecondary,
  },
  settingsButtonText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  joinRequestsSection: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  joinRequestsTitle: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  joinRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  joinRequestName: {
    color: Colors.ink,
    fontSize: 15,
    flex: 1,
  },
  joinRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  acceptButtonText: {
    color: Colors.bg,
    fontSize: 13,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: Colors.surface,
  },
  rejectButtonText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontWeight: '500',
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
    fontSize: 17,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.primary,
    fontSize: 15,
  },
})
