import { View, Text, Pressable, Modal, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../constants/colors'
import { httpClient } from '../lib/api-client'
import { useGroupContext } from '../contexts/GroupContext'

const CLOSE_SYMBOL = '✕'

interface GroupItem {
  id: string
  name: string
  tier: string
  userRole: 'organizer' | 'member'
}

interface Props {
  visible: boolean
  onClose: () => void
}

export function GroupSwitcher({ visible, onClose }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const { setActiveGroupId } = useGroupContext()

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'me', 'groups'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: GroupItem[] } }>('/v1/users/me/groups')
      return data.data.items
    },
    enabled: visible,
  })

  const handleSelect = (groupId: string) => {
    setActiveGroupId(groupId)
    router.push(`/(app)/groups/${groupId}`)
    onClose()
  }

  const handleCreateGroup = () => {
    onClose()
    router.push('/(app)/groups/new')
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('groups.switcher.title')}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel={t('groups.switcher.close')}>
            <Text style={styles.closeButtonText}>{CLOSE_SYMBOL}</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('groups.switcher.noGroups')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.groupRow} onPress={() => handleSelect(item.id)}>
                <View style={styles.groupRowLeft}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>{t(`groups.home.tier.${item.tier}`)}</Text>
                  </View>
                </View>
              </Pressable>
            )}
            ListFooterComponent={
              <Pressable style={styles.createGroupButton} onPress={handleCreateGroup}>
                <Text style={styles.createGroupText}>{t('groups.switcher.createGroup')}</Text>
              </Pressable>
            }
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  title: {
    color: Colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: Colors.inkSecondary,
    fontSize: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
  },
  groupRowLeft: {
    flex: 1,
  },
  groupName: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
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
    letterSpacing: 0.1 * 10,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
  },
  createGroupButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
    marginTop: 8,
  },
  createGroupText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
})
