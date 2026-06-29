import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'

interface GroupResult {
  id: string
  name: string
  tier: string
}

export default function GroupSearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const { data: results, isFetching } = useQuery<GroupResult[]>({
    queryKey: ['groups', 'search', submittedQuery],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: GroupResult[] } }>(
        `/v1/groups/search?q=${encodeURIComponent(submittedQuery)}`,
      )
      return data.data.items
    },
    enabled: submittedQuery.length >= 2,
  })

  const joinMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await httpClient.post(`/v1/groups/${groupId}/join`)
      return groupId
    },
    onSuccess: (groupId: string) => {
      router.replace(`/(group)/pending?groupId=${groupId}`)
    },
    onError: () => {
      setJoinError(t('groups.join.alreadyMember'))
    },
  })

  const handleSearch = useCallback(() => {
    if (query.trim().length >= 2) {
      setSubmittedQuery(query.trim())
      setJoinError(null)
    }
  }, [query])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('groups.search.title')}</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('groups.search.placeholder')}
          placeholderTextColor={Colors.inkSecondary}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoFocus
        />
        <Pressable style={styles.searchButton} onPress={handleSearch}>
          {isFetching ? (
            <ActivityIndicator color={Colors.ink} size="small" />
          ) : (
            <Text style={styles.searchButtonText}>{'›'}</Text>
          )}
        </Pressable>
      </View>

      {joinError && <Text style={styles.errorText}>{joinError}</Text>}

      {results && results.length === 0 && submittedQuery.length >= 2 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('groups.search.noResults')}</Text>
        </View>
      )}

      <FlatList
        data={results ?? []}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{item.name}</Text>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{t(`groups.home.tier.${item.tier}`)}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.joinButton, joinMutation.isPending && styles.joinButtonDisabled]}
              onPress={() => joinMutation.mutate(item.id)}
              disabled={joinMutation.isPending}
            >
              <Text style={styles.joinButtonText}>{t('groups.join.cta')}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: 24,
  },
  title: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.ink,
    padding: 12,
    borderRadius: 4,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surface,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  resultInfo: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '500',
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  tierBadgeText: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  joinButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    marginBottom: 8,
  },
})
