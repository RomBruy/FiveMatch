import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

export default function ProfileCompletion() {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    await httpClient.patch('/v1/auth/me', { name: name.trim() })
    router.replace('/(app)')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.profileCompletion.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.profileCompletion.subtitle')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('auth.profileCompletion.placeholder')}
        placeholderTextColor={Colors.inkSecondary}
        autoFocus
      />
      <Pressable style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>{t('auth.profileCompletion.save')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: Colors.ink,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.inkSecondary,
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.ink,
    padding: 12,
    borderRadius: 4,
    width: '100%',
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
})
