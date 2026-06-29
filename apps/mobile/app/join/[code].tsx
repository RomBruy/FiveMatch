import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/expo'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

type InvitePreview = {
  groupId: string
  groupName: string
  organizerDisplayName: string
  memberCount: number
}

export default function JoinScreen() {
  const { t } = useTranslation()
  const { code } = useLocalSearchParams<{ code: string }>()
  const { isSignedIn } = useAuth()
  const router = useRouter()

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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !preview) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('groups.join.notFound')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('groups.join.title')}</Text>
        <Text style={styles.groupName}>{preview.groupName}</Text>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>{t('groups.join.organizerLabel')}</Text>
          <Text style={styles.metaValue}>{preview.organizerDisplayName}</Text>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>{t('groups.join.membersLabel', { count: preview.memberCount })}</Text>
        </View>
      </View>

      {isSignedIn ? (
        <Pressable
          style={[styles.cta, joinMutation.isPending && styles.ctaDisabled]}
          onPress={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
        >
          {joinMutation.isPending ? (
            <ActivityIndicator color={Colors.ink} />
          ) : (
            <Text style={styles.ctaText}>{t('groups.join.cta')}</Text>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.cta} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.ctaText}>{t('groups.join.signInCta')}</Text>
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
    backgroundColor: Colors.bg,
    padding: 24,
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  groupName: {
    color: Colors.ink,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  metaLabel: {
    color: Colors.inkSecondary,
    fontSize: 15,
  },
  metaValue: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '500',
  },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
  },
})
