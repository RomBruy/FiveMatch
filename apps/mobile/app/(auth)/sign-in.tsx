import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import * as Localization from 'expo-localization'
import { Platform, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useSSO, useSignIn } from '@clerk/expo'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

WebBrowser.maybeCompleteAuthSession()

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

export default function SignIn() {
  const { t } = useTranslation()
  const router = useRouter()
  const { startSSOFlow } = useSSO()
  const { signIn } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingCode, setPendingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const handleSSO = async (strategy: 'oauth_google' | 'oauth_apple') => {
    setError(null)
    setBusy(true)
    try {
      const { createdSessionId, setActive: ssoSetActive, signIn: ssoSignIn } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      })
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId })
        const emailAddress = ssoSignIn?.identifier ?? ''
        await afterSignIn(emailAddress)
      } else {
        setError(t('auth.signIn.ssoIncomplete'))
      }
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const finalizeAndEnter = async () => {
    if (!signIn) return
    const { error: finalizeError } = await signIn.finalize()
    if (finalizeError) {
      setError(clerkErrorMessage(finalizeError))
      return
    }
    await afterSignIn(email.trim())
  }

  const handleEmailPassword = async () => {
    if (!signIn) return
    setError(null)
    setBusy(true)
    try {
      const { error: createError } = await signIn.create({ identifier: email.trim() })
      if (createError) {
        setError(clerkErrorMessage(createError))
        return
      }
      const { error: pwError } = await signIn.password({ password })
      if (pwError) {
        setError(clerkErrorMessage(pwError))
        return
      }
      if (signIn.status === 'complete') {
        await finalizeAndEnter()
      } else if (signIn.status === 'needs_first_factor') {
        // Extra verification (e.g. new device) — Clerk emails a one-time code
        const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email.trim() })
        if (sendError) {
          setError(clerkErrorMessage(sendError))
          return
        }
        setPendingCode(true)
      } else {
        setError(`${t('auth.signIn.verificationRequired')} (${signIn.status})`)
      }
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!signIn) return
    setError(null)
    setBusy(true)
    try {
      const { error: verifyError } = await signIn.emailCode.verifyCode({ code: code.trim() })
      if (verifyError) {
        setError(clerkErrorMessage(verifyError))
        return
      }
      await finalizeAndEnter()
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (pendingCode) {
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
        <Pressable style={styles.button} disabled={busy} onPress={handleVerifyCode}>
          <Text style={styles.buttonText}>{t('auth.signUp.verifyButton')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.signIn.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>

      <Pressable style={styles.button} disabled={busy} onPress={() => handleSSO('oauth_google')}>
        <Text style={styles.buttonText}>{t('auth.signIn.withGoogle')}</Text>
      </Pressable>

      {Platform.OS === 'ios' && (
        <Pressable style={styles.button} disabled={busy} onPress={() => handleSSO('oauth_apple')}>
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
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable style={styles.button} disabled={busy} onPress={handleEmailPassword}>
        <Text style={styles.buttonText}>{t('auth.signIn.withEmail')}</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/sign-up')}>
        <Text style={styles.linkText}>{t('auth.signIn.noAccount')}</Text>
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
