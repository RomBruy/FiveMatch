import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useSSO, useSignIn } from '@clerk/expo'
import { returnIntentPath } from '../../lib/return-intent.mjs'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { Fonts, Type } from '../../constants/tokens'
import { Input } from '../../components/ui/Input'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { CodeInput } from '../../components/ui/CodeInput'
import { TextureType } from '../../components/ui/TextureType'

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
  const { next } = useLocalSearchParams<{ next?: string }>()
  // Forwarded verbatim; it is validated where it is finally used.
  const nextSuffix = next ? `?next=${next}` : ''
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

  /**
   * Signing in is not signing up. This used to hand every returning player to
   * profile completion, so anyone with a finished profile was asked to redo it
   * before the app would let them in.
   *
   * (app)/_layout.tsx already owns that decision — it sends a user to profile
   * completion when, and only when, their profile is genuinely incomplete
   * (no synced record, no name, or no onboardingCompletedAt). Landing there and
   * letting the guard speak means a completed profile is never asked twice, and
   * an unfinished one is still caught.
   */
  const enterApp = () => {
    router.replace(returnIntentPath(next) as never)
  }

  const handleSSO = async (strategy: 'oauth_google' | 'oauth_apple') => {
    setError(null)
    setBusy(true)
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy,
        redirectUrl: AuthSession.makeRedirectUri(),
      })
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId })
        enterApp()
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
    enterApp()
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
      <View style={styles.screen}>
        <TextureType lines={[{ text: 'FIVE' }, { text: 'MATCH', x: 90 }]} style={styles.texture} />
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View style={styles.container}>
              <Text style={styles.title}>{t('auth.signUp.verifyTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.signUp.verifySubtitle', { email: email.trim() })}</Text>
              <View style={styles.codeWrap}>
                <CodeInput value={code} onChangeText={setCode} accessibilityLabel={t('auth.signUp.codePlaceholder')} />
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <View style={styles.fullWidth}>
                <PrimaryButton label={t('auth.signUp.verifyButton')} disabled={busy} onPress={handleVerifyCode} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <TextureType lines={[{ text: 'FIVE' }, { text: 'MATCH', x: 90 }]} style={styles.texture} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {t('auth.signIn.title')}
                <Text style={styles.titleAccent}>.</Text>
              </Text>
              <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>
            </View>

            <View style={styles.stack}>
              <SecondaryButton label={t('auth.signIn.withGoogle')} disabled={busy} onPress={() => handleSSO('oauth_google')} />
              {Platform.OS === 'ios' && (
                <SecondaryButton label={t('auth.signIn.withApple')} disabled={busy} onPress={() => handleSSO('oauth_apple')} />
              )}
            </View>

            <View style={styles.stack}>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.signIn.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.signIn.passwordPlaceholder')}
                secureTextEntry
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.fullWidth}>
              <PrimaryButton label={t('auth.signIn.withEmail')} disabled={busy} onPress={handleEmailPassword} />
            </View>

            <Pressable
              onPress={() => router.push('/(public)/discover' as never)}
              accessibilityRole="link"
              style={styles.link}
            >
              <Text style={styles.linkText}>{t('guestDiscover.browseWithoutAccount')}</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/(auth)/sign-up${nextSuffix}` as never)} accessibilityRole="link" style={styles.link}>
              <Text style={styles.linkText}>{t('auth.signIn.noAccount')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  texture: {
    top: 48,
    left: -30,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: 'transparent',
    padding: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 34,
  },
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 40,
    letterSpacing: Type.display.letterSpacing,
    textAlign: 'center',
  },
  titleAccent: {
    color: Colors.primary,
  },
  subtitle: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
  },
  stack: {
    gap: 10,
    marginBottom: 18,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  codeWrap: {
    marginBottom: 26,
  },
  errorText: {
    color: Colors.primary,
    fontFamily: Fonts.inter,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 20,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    textAlign: 'center',
  },
})
