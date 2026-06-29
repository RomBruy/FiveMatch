import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Colors } from '../../../../constants/colors'
import { httpClient } from '../../../../lib/api-client'

interface RosterMember {
  userId: string
  displayName: string | null
  joinedAt: string | null
  matchCount: number | null
  role: 'organizer' | 'member'
}

export default function RosterScreen() {
  const { t } = useTranslation()
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{t('groups.roster.title')}</Text>
      {rosterData.map((item) => (
        <View key={item.userId} style={styles.memberRow}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.displayName ?? '—'}</Text>
            <View style={styles.memberMeta}>
              <View style={[styles.roleBadge, item.role === 'organizer' ? styles.organizerBadge : styles.memberBadge]}>
                <Text style={styles.roleBadgeText}>
                  {item.role === 'organizer'
                    ? t('groups.roster.role.organizer')
                    : t('groups.roster.role.member')}
                </Text>
              </View>
              {item.joinedAt && (
                <Text style={styles.metaText}>
                  {t('groups.roster.joinedAt', { date: new Date(item.joinedAt).toLocaleDateString() })}
                </Text>
              )}
              <Text style={styles.metaText}>
                {t('groups.roster.matchCount', { count: item.matchCount ?? 0 })}
              </Text>
            </View>
          </View>

          {isOrganizer && item.role !== 'organizer' && (
            <View style={styles.actions}>
              <Pressable
                style={styles.transferButton}
                onPress={() => handleTransfer(item.userId, item.displayName ?? '—')}
                disabled={transferMutation.isPending || removeMutation.isPending}
              >
                <Text style={styles.transferButtonText}>{t('groups.roster.transferButton')}</Text>
              </Pressable>
              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemove(item.userId, item.displayName ?? '—')}
                disabled={removeMutation.isPending || transferMutation.isPending}
              >
                <Text style={styles.removeButtonText}>{t('groups.roster.removeButton')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
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
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  organizerBadge: {
    backgroundColor: Colors.primary,
  },
  memberBadge: {
    backgroundColor: Colors.surface,
  },
  roleBadgeText: {
    color: Colors.bg,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaText: {
    color: Colors.inkSecondary,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  removeButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  transferButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.inkSecondary,
  },
  transferButtonText: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: Colors.primary,
    fontSize: 15,
  },
})
