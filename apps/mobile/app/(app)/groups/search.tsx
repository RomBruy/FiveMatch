import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { Input } from '../../../components/ui/Input'
import { DuotoneAvatar } from '../../../components/ui/DuotoneAvatar'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { httpClient } from '../../../lib/api-client'

interface GroupResult {
  id: string
  name: string
  tier: string
}

export default function GroupSearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>{t('groups.search.title')}</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('groups.search.placeholder')}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
        </View>
        <Pressable
          style={styles.searchButton}
          onPress={handleSearch}
          accessibilityRole="button"
          accessibilityLabel={t('groups.search.title')}
        >
          {isFetching ? (
            <ActivityIndicator color={Colors.onPrimary} size="small" />
          ) : (
            <Ionicons name="search" size={20} color={Colors.onPrimary} />
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
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <DuotoneAvatar displayName={item.name} size={40} />
            <View style={styles.resultInfo}>
              <Text style={styles.resultName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.resultMeta}>{t(`groups.home.tier.${item.tier}`)}</Text>
            </View>
            <Pressable
              style={[styles.joinPill, joinMutation.isPending && styles.joinPillDisabled]}
              onPress={() => joinMutation.mutate(item.id)}
              disabled={joinMutation.isPending}
              accessibilityRole="button"
              hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            >
              <Text style={styles.joinPillText}>{t('groups.join.cta')}</Text>
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
    paddingHorizontal: 20,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 36,
    letterSpacing: 1.44, // 0.04em @ 36 (display register)
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  searchInputWrap: {
    flex: 1,
  },
  searchButton: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  listContent: {
    gap: 8,
    paddingBottom: DOCK_CLEARANCE,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultInfo: {
    flex: 1,
    gap: 3,
  },
  resultName: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.3,
  },
  resultMeta: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  joinPill: {
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinPillDisabled: {
    opacity: 0.4,
  },
  joinPillText: {
    color: Colors.onPrimary,
    fontSize: 13,
    fontFamily: Fonts.interBold,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    marginBottom: 8,
  },
})
