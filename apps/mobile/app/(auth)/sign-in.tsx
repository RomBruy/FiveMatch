import * as WebBrowser from 'expo-web-browser'
import * as Localization from 'expo-localization'
import { Platform, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useOAuth, useSignIn } from '@clerk/expo'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

WebBrowser.maybeCompleteAuthSession()

type UserData = {
  firstName?: string | null
  lastName?: string | null
  primaryEmailAddress?: { emailAddress: string } | null
  imageUrl?: string
}

export default function SignIn() {
  const { t } = useTranslation()
  const router = useRouter()
  const { startOAuthFlow: googleOAuth } = useOAuth({ strategy: 'oauth_google' })
  const { startOAuthFlow: appleOAuth } = useOAuth({ strategy: 'oauth_apple' })
  const { signIn } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const afterSignIn = async (emailAddress: string) => {
    const locale = Localization.getLocales()[0]?.languageCode ?? 'en'
    await httpClient.post('/v1/auth/sync', {
      name: null,
      email: emailAddress,
      profilePhotoUrl: null,
      languagePreference: ['en', 'fr'].includes(locale) ? locale : 'en',
    })
    router.replace('/(app)')
  }

  const handleGoogle = async () => {
    const { createdSessionId, setActive, signIn: result } = await googleOAuth()
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId })
      const userData = result as UserData | undefined
      const emailAddress = userData?.primaryEmailAddress?.emailAddress ?? ''
      await afterSignIn(emailAddress)
    }
  }

  const handleApple = async () => {
    const { createdSessionId, setActive, signIn: result } = await appleOAuth()
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId })
      const userData = result as UserData | undefined
      const emailAddress = userData?.primaryEmailAddress?.emailAddress ?? ''
      await afterSignIn(emailAddress)
    }
  }

  const handleEmailPassword = async () => {
    if (!signIn) return
    const { error: createError } = await signIn.create({ identifier: email })
    if (createError) return
    const { error: pwError } = await signIn.password({ password })
    if (pwError) return
    const { error: finalizeError } = await signIn.finalize()
    if (finalizeError) return
    await afterSignIn(email)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.signIn.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>

      <Pressable style={styles.button} onPress={handleGoogle}>
        <Text style={styles.buttonText}>{t('auth.signIn.withGoogle')}</Text>
      </Pressable>

      {Platform.OS === 'ios' && (
        <Pressable style={styles.button} onPress={handleApple}>
          <Text style={styles.buttonText}>{t('auth.signIn.withApple')}</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.signIn.emailPlaceholder')}
        placeholderTextColor={Colors.inkSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.signIn.passwordPlaceholder')}
        placeholderTextColor={Colors.inkSecondary}
        secureTextEntry
      />
      <Pressable style={styles.button} onPress={handleEmailPassword}>
        <Text style={styles.buttonText}>{t('auth.signIn.withEmail')}</Text>
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
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '600',
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
})
