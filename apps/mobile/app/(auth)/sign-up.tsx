import * as Localization from 'expo-localization'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useSignUp } from '@clerk/expo'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

function clerkErrorMessage(err: unknown): string {
  const clerkErr = err as { longMessage?: string; message?: string; errors?: { longMessage?: string; message?: string }[] }
  return (
    clerkErr.longMessage ??
    clerkErr.errors?.[0]?.longMessage ??
    clerkErr.errors?.[0]?.message ??
    clerkErr.message ??
    String(err)
  )
}

export default function SignUp() {
  const { t } = useTranslation()
  const router = useRouter()
  const { signUp } = useSignUp()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSignUp = async () => {
    if (!signUp) return
    setError(null)
    setBusy(true)
    try {
      const { error: createError } = await signUp.create({
        emailAddress: email.trim(),
        username: username.trim(),
        password,
      })
      if (createError) {
        setError(clerkErrorMessage(createError))
        return
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode()
      if (sendError) {
        setError(clerkErrorMessage(sendError))
        return
      }
      setPendingVerification(true)
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    if (!signUp) return
    setError(null)
    setBusy(true)
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() })
      if (verifyError) {
        setError(clerkErrorMessage(verifyError))
        return
      }
      const { error: finalizeError } = await signUp.finalize()
      if (finalizeError) {
        setError(clerkErrorMessage(finalizeError))
        return
      }
      const locale = Localization.getLocales()[0]?.languageCode ?? 'en'
      await httpClient.post('/v1/auth/sync', {
        name: username.trim() || null,
        email: email.trim(),
        profilePhotoUrl: null,
        languagePreference: ['en', 'fr'].includes(locale) ? locale : 'en',
      })
      router.replace('/(app)')
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (pendingVerification) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('auth.signUp.verifyTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.signUp.verifySubtitle', { email: email.trim() })}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={t('auth.signUp.codePlaceholder')}
          placeholderTextColor={Colors.inkSecondary}
          keyboardType="number-pad"
          autoCapitalize="none"
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Pressable style={styles.button} disabled={busy} onPress={handleVerify}>
          <Text style={styles.buttonText}>{t('auth.signUp.verifyButton')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.signUp.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.signUp.subtitle')}</Text>

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
        value={username}
        onChangeText={setUsername}
        placeholder={t('auth.signUp.usernamePlaceholder')}
        placeholderTextColor={Colors.inkSecondary}
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
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable style={styles.button} disabled={busy} onPress={handleSignUp}>
        <Text style={styles.buttonText}>{t('auth.signUp.button')}</Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/(auth)/sign-in')}>
        <Text style={styles.linkText}>{t('auth.signUp.hasAccount')}</Text>
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
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  linkText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    marginTop: 16,
    textDecorationLine: 'underline',
  },
})
