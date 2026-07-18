import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../../constants/colors'
import { Fonts, Radius } from '../../../../constants/tokens'
import { DuotoneAvatar } from '../../../../components/ui/DuotoneAvatar'
import { DOCK_CLEARANCE } from '../../../../components/ui/TabDock'
import { httpClient } from '../../../../lib/api-client'

const SEPARATOR = ' · '

interface RosterMember {
  userId: string
  displayName: string | null
  joinedAt: string | null
  matchCount: number | null
  role: 'organizer' | 'member'
}

interface JoinRequest {
  userId: string
  displayName: string | null
  requestedAt: string
}

export default function RosterScreen() {
  const { t, i18n } = useTranslation()
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const { data: myStatus } = useQuery({
    queryKey: ['groups', groupId, 'my-status'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { role: string } }>(`/v1/groups/${groupId}/my-status`)
      return data.data
    },
    enabled: Boolean(groupId),
  })

  const isOrganizer = myStatus?.role === 'organizer'

  const { data: rosterData, isLoading, isError } = useQuery({
    queryKey: ['groups', groupId, 'roster'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: RosterMember[] } }>(`/v1/groups/${groupId}/roster`)
      return data.data.items
    },
    enabled: Boolean(groupId),
  })

  // Approval queue — same query key + endpoints the group home uses (shared cache).
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'join-requests'] })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'roster'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (userId: string) =>
      httpClient.post(`/v1/groups/${groupId}/members/${userId}/reject`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'join-requests'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      httpClient.delete(`/v1/groups/${groupId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'roster'] })
    },
  })

  const transferMutation = useMutation({
    mutationFn: (newOrganizerId: string) =>
      httpClient.post(`/v1/groups/${groupId}/transfer-organizer`, { newOrganizerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'my-status'] })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'roster'] })
    },
  })

  const handleRemove = (userId: string, name: string) => {
    Alert.alert(
      t('groups.roster.removeConfirmTitle'),
      t('groups.roster.removeConfirmMessage', { name }),
      [
        { text: t('groups.roster.cancel'), style: 'cancel' },
        {
          text: t('groups.roster.removeConfirmOk'),
          style: 'destructive',
          onPress: () => removeMutation.mutate(userId),
        },
      ],
    )
  }

  const handleTransfer = (userId: string, name: string) => {
    Alert.alert(
      t('groups.roster.transferConfirmTitle'),
      t('groups.roster.transferConfirmMessage', { name }),
      [
        { text: t('groups.roster.cancel'), style: 'cancel' },
        {
          text: t('groups.roster.transferConfirmOk'),
          onPress: () => transferMutation.mutate(userId),
        },
      ],
    )
  }

  const formatMemberMeta = (member: RosterMember) => {
    const parts: string[] = []
    if (member.joinedAt) {
      parts.push(
        t('groups.roster.joinedAt', {
          date: new Date(member.joinedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
        }),
      )
    }
    parts.push(t('groups.roster.matchCount', { count: member.matchCount ?? 0 }))
    return parts.join(SEPARATOR)
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !rosterData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('common.loadError')}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('groups.roster.title')}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{rosterData.length}</Text>
        </View>
      </View>

      {isOrganizer && joinRequests && joinRequests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.sectionLabel}>{t('groups.requests.title')}</Text>
          {joinRequests.map((req) => (
            <View key={req.userId} style={styles.requestCard}>
              <DuotoneAvatar displayName={req.displayName ?? ''} size={40} />
              <Text style={styles.requestName} numberOfLines={1}>
                {req.displayName ?? '—'}
              </Text>
              <Pressable
                style={[styles.acceptPill, (approveMutation.isPending || rejectMutation.isPending) && styles.pillDisabled]}
                onPress={() => approveMutation.mutate(req.userId)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                accessibilityRole="button"
              >
                <Text style={styles.acceptPillText}>{t('groups.requests.accept')}</Text>
              </Pressable>
              <Pressable
                style={[styles.declinePill, (approveMutation.isPending || rejectMutation.isPending) && styles.pillDisabled]}
                onPress={() => rejectMutation.mutate(req.userId)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                accessibilityRole="button"
              >
                <Text style={styles.declinePillText}>{t('groups.requests.reject')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.membersCard}>
        {rosterData.map((item, index) => (
          <View key={item.userId} style={[styles.memberRow, index > 0 && styles.memberRowBorder]}>
            <DuotoneAvatar displayName={item.displayName ?? ''} size={40} />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.displayName ?? '—'}
              </Text>
              <Text style={styles.memberMeta} numberOfLines={1}>
                {formatMemberMeta(item)}
              </Text>
            </View>

            {item.role === 'organizer' && (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{t('groups.roster.role.organizer')}</Text>
              </View>
            )}

            {isOrganizer && item.role !== 'organizer' && (
              <View style={styles.actions}>
                <Pressable
                  style={[styles.ghostActionPill, (transferMutation.isPending || removeMutation.isPending) && styles.pillDisabled]}
                  onPress={() => handleTransfer(item.userId, item.displayName ?? '—')}
                  disabled={transferMutation.isPending || removeMutation.isPending}
                  accessibilityRole="button"
                  hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                >
                  <Text style={styles.ghostActionPillText}>{t('groups.roster.transferButton')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.removePill, (removeMutation.isPending || transferMutation.isPending) && styles.pillDisabled]}
                  onPress={() => handleRemove(item.userId, item.displayName ?? '—')}
                  disabled={removeMutation.isPending || transferMutation.isPending}
                  accessibilityRole="button"
                  hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                >
                  <Text style={styles.removePillText}>{t('groups.roster.removeButton')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
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
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
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
    gap: 10,
    marginBottom: 16,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 36,
    letterSpacing: 1.44, // 0.04em @ 36 (display register)
    textTransform: 'uppercase',
  },
  countPill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countPillText: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  requestsSection: {
    marginBottom: 24,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  requestName: {
    flex: 1,
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.3,
  },
  acceptPill: {
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptPillText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontFamily: Fonts.interBold,
  },
  declinePill: {
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declinePillText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
  pillDisabled: {
    opacity: 0.4,
  },
  membersCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  memberInfo: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.3,
  },
  memberMeta: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.interMedium,
  },
  rolePill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  ghostActionPill: {
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostActionPillText: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
  },
  removePill: {
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePillText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Fonts.interBold,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.inter,
  },
})
