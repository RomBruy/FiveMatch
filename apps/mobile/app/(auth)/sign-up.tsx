import { KeyboardAvoidingView, Platform, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useSignUp } from '@clerk/expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { Fonts, Type } from '../../constants/tokens'
import { Input } from '../../components/ui/Input'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { CodeInput } from '../../components/ui/CodeInput'
import { TextureType } from '../../components/ui/TextureType'

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
  const { next } = useLocalSearchParams<{ next?: string }>()
  // Forwarded verbatim; it is validated where it is finally used.
  const nextSuffix = next ? `?next=${next}` : ''
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
      router.replace(`/(auth)/profile-completion${nextSuffix}` as never)
    } catch (err) {
      setError(clerkErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (pendingVerification) {
    return (
      <AuthFrame>
        <Text style={styles.title}>{t('auth.signUp.verifyTitle')}<Text style={styles.titleAccent}>.</Text></Text>
        <Text style={styles.subtitle}>{t('auth.signUp.verifySubtitle', { email: email.trim() })}</Text>
        <View style={styles.codeWrap}>
          <CodeInput value={code} onChangeText={setCode} accessibilityLabel={t('auth.signUp.codePlaceholder')} />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <PrimaryButton label={t('auth.signUp.verifyButton')} disabled={busy} onPress={handleVerify} />
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.signUp.title')}<Text style={styles.titleAccent}>.</Text></Text>
        <Text style={styles.subtitle}>{t('auth.signUp.subtitle')}</Text>
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
          value={username}
          onChangeText={setUsername}
          placeholder={t('auth.signUp.usernamePlaceholder')}
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
      <PrimaryButton label={t('auth.signUp.button')} disabled={busy} onPress={handleSignUp} />

      <Pressable onPress={() => router.replace(`/(auth)/sign-in${nextSuffix}` as never)} accessibilityRole="link" style={styles.link}>
        <Text style={styles.linkText}>{t('auth.signUp.hasAccount')}</Text>
      </Pressable>
    </AuthFrame>
  )
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.screen}>
      <TextureType lines={[{ text: 'FIVE' }, { text: 'MATCH', x: 90 }]} style={styles.texture} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.container}>{children}</View>
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
    marginBottom: 26,
  },
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 36,
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
    marginTop: 8,
    textAlign: 'center',
  },
  stack: {
    gap: 10,
    marginBottom: 18,
  },
  codeWrap: {
    marginTop: 8,
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
    paddingVertical: 18,
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
