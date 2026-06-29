import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../../constants/colors'
import { httpClient } from '../../../lib/api-client'

function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await httpClient.get<{
        data: { name: string | null; userId: string; email: string; isAdmin: boolean }
      }>('/v1/auth/me')
      return data.data
    },
  })
}

export default function ProfileTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: user } = useCurrentUser()

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('auth.shell.tabProfile')}</Text>
      {user?.isAdmin && (
        <Pressable
          style={styles.adminButton}
          onPress={() => router.push('/(app)/admin' as never)}
          accessibilityLabel={t('admin.metrics.navButton')}
        >
          <Text style={styles.adminButtonText}>{t('admin.metrics.navButton')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    color: Colors.ink,
    fontSize: 17,
  },
  adminButton: {
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminButtonText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
})
