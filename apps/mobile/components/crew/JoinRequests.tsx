import { View, Text, StyleSheet, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { haptics } from '../../lib/haptics'
import { PressableScale } from '../ui/PressableScale'

interface JoinRequest {
  requestId: string
  displayName: string | null
  requestedAt: string
}

interface JoinRequestsProps {
  groupId: string
  /** The endpoint is organizer-only; asking as anyone else just 403s. */
  isOrganizer: boolean
}

/**
 * People waiting to be let into the crew.
 *
 * This lived on a group detail screen that nothing navigated to any more, so an
 * organizer had no way to approve anyone from inside the app — requests simply
 * accumulated unseen. Crew is where someone goes to think about their crew, so
 * it belongs here.
 *
 * Renders nothing when there is nothing pending, for the same reason the
 * needs-attention section does: an empty box in a permanent slot teaches people
 * to stop looking at it.
 */
export function JoinRequests({ groupId, isOrganizer }: JoinRequestsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: requests } = useQuery({
    queryKey: ['groups', groupId, 'join-requests'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: JoinRequest[] } }>(
        `/v1/groups/${groupId}/join-requests`,
      )
      return data.data.items
    },
    enabled: Boolean(groupId) && isOrganizer,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'join-requests'] })
    // The roster gains a member on approval, so it is stale either way.
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'roster'] })
  }

  const decide = useMutation({
    mutationFn: ({ userId, decision }: { userId: string; decision: 'approve' | 'reject' }) =>
      httpClient.post(`/v1/groups/${groupId}/members/${userId}/${decision}`),
    onSuccess: () => { haptics.success(); invalidate() },
    onError: () => Alert.alert(t('common.genericError')),
  })

  if (!isOrganizer || !requests || requests.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('crew.requests.title').toUpperCase()}</Text>

      {requests.map((request) => (
        <View key={request.requestId} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {request.displayName ?? t('crew.requests.unnamed')}
          </Text>

          <PressableScale
            onPress={() => decide.mutate({ userId: request.requestId, decision: 'approve' })}
            disabled={decide.isPending}
            style={styles.approve}
            accessibilityRole="button"
            accessibilityLabel={t('crew.requests.accept')}
          >
            <Text style={styles.approveText}>{t('crew.requests.accept')}</Text>
          </PressableScale>

          <PressableScale
            onPress={() => decide.mutate({ userId: request.requestId, decision: 'reject' })}
            disabled={decide.isPending}
            style={styles.reject}
            accessibilityRole="button"
            accessibilityLabel={t('crew.requests.reject')}
          >
            <Text style={styles.rejectText}>{t('crew.requests.reject')}</Text>
          </PressableScale>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  name: { flex: 1, fontFamily: Fonts.inter, fontSize: 14, color: Colors.ink },
  approve: {
    borderRadius: Radius.full,
    backgroundColor: Colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  approveText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.bg,
  },
  reject: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.inkDisabled,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rejectText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
})
