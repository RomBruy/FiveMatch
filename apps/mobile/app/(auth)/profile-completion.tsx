import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuth, useUser } from '@clerk/expo'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { Input } from '../../components/ui/Input'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { Chip } from '../../components/ui/Chip'
import { DuotoneAvatar } from '../../components/ui/DuotoneAvatar'
import { TextureType } from '../../components/ui/TextureType'

const LANGUAGES = ['fr', 'en'] as const
const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward', 'utility'] as const
const STRONG_FEET = ['left', 'right', 'both'] as const
const PLAYER_STYLES = ['playmaker', 'finisher', 'engine', 'wall', 'wildcard'] as const
const SKILL_LEVELS = ['casual', 'intermediate', 'competitive'] as const
const SPECIAL_SKILLS = ['stands', 'nutmeg', 'tackles'] as const
const FAVORITE_EXCUSES = ['cold', 'pitch', 'foul'] as const
const LOCKER_ROOM_STYLES = ['leader', 'clown', 'quiet'] as const
const THIRD_HALF_PROFILES = ['home', 'replay', 'close'] as const
const BAD_FAITH_EMOJIS = ['😇', '😏', '🤥', '🤡', '👹']

type Language = (typeof LANGUAGES)[number]
type Position = (typeof POSITIONS)[number]
type StrongFoot = (typeof STRONG_FEET)[number]
type PlayerStyle = (typeof PLAYER_STYLES)[number]
type SkillLevel = (typeof SKILL_LEVELS)[number]

interface ProfileData {
  userId: string
  name: string | null
  email: string
  languagePreference: Language
  profilePhotoUrl: string | null
  currentClub: string | null
  formerClub: string | null
  preferredPosition: Position | null
  strongFoot: StrongFoot | null
  playerStyle: PlayerStyle | null
  specialSkill: string | null
  favoriteExcuse: string | null
  badFaithLevel: number | null
  lockerRoomStyle: string | null
  thirdHalfProfile: string | null
  skillLevel: SkillLevel | null
  onboardingCompletedAt: string | null
}

function initialsOf(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export default function ProfileCompletion() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken } = useAuth()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState<Language>(i18n.language === 'fr' ? 'fr' : 'en')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [currentClub, setCurrentClub] = useState('')
  const [formerClub, setFormerClub] = useState('')
  const [preferredPosition, setPreferredPosition] = useState<Position | null>(null)
  const [strongFoot, setStrongFoot] = useState<StrongFoot | null>(null)
  const [playerStyle, setPlayerStyle] = useState<PlayerStyle | null>(null)
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('casual')
  const [specialSkill, setSpecialSkill] = useState('')
  const [favoriteExcuse, setFavoriteExcuse] = useState('')
  const [badFaithLevel, setBadFaithLevel] = useState(1)
  const [lockerRoomStyle, setLockerRoomStyle] = useState('')
  const [thirdHalfProfile, setThirdHalfProfile] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const syncedUserId = useRef<string | null>(null)

  const syncProfile = useCallback(async () => {
    if (!userLoaded || !user) return

    setSyncing(true)
    setError(null)
    try {
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress
      const token = await getToken({ skipCache: true })
      if (!email || !token) throw new Error('Authenticated profile data is unavailable')

      const { data } = await httpClient.post<{ data: ProfileData }>(
        '/v1/auth/sync',
        {
          name: null,
          email,
          // Clerk always has an imageUrl (its generated initials avatar) — only a real upload counts.
          profilePhotoUrl: user.hasImage ? (user.imageUrl ?? null) : null,
          languagePreference: language,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const profile = data.data
      const clerkName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || ''
      setName(profile.name || clerkName)
      setLanguage(profile.languagePreference)
      setProfilePhotoUrl(profile.profilePhotoUrl || (user.hasImage ? user.imageUrl : null))
      setCurrentClub(profile.currentClub ?? '')
      setFormerClub(profile.formerClub ?? '')
      setPreferredPosition(profile.preferredPosition)
      if (profile.skillLevel) setSkillLevel(profile.skillLevel)
      setStrongFoot(profile.strongFoot)
      setPlayerStyle(profile.playerStyle)
      setSpecialSkill(profile.specialSkill ?? '')
      setFavoriteExcuse(profile.favoriteExcuse ?? '')
      setBadFaithLevel(profile.badFaithLevel ?? 1)
      setLockerRoomStyle(profile.lockerRoomStyle ?? '')
      setThirdHalfProfile(profile.thirdHalfProfile ?? '')
      void i18n.changeLanguage(profile.languagePreference)
      setProfileReady(true)
    } catch {
      setError('auth.profileCompletion.syncError')
    } finally {
      setSyncing(false)
    }
  }, [getToken, i18n, language, user, userLoaded])

  useEffect(() => {
    if (!user || syncedUserId.current === user.id) return
    syncedUserId.current = user.id
    void syncProfile()
  }, [syncProfile, user])

  const handleLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage)
    void i18n.changeLanguage(nextLanguage)
  }

  const handlePhoto = async () => {
    if (!user || photoUploading) return
    setError(null)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      })
      if (result.canceled) return

      setPhotoUploading(true)
      const asset = result.assets[0]
      // Clerk cannot read a local file:// URI in React Native — it needs a base64 data URL
      const file = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri
      const image = await user.setProfileImage({ file })
      await user.reload()
      setProfilePhotoUrl(image.publicUrl || user.imageUrl || asset.uri)
    } catch {
      setError('auth.profileCompletion.photoError')
    } finally {
      setPhotoUploading(false)
    }
  }

  // Only the first two steps gate anything. Steps 2 and 3 are the flavour that
  // makes the card worth sharing — worth asking for, never worth blocking on.
  const isRequiredStep = step <= 1
  const canContinue = step === 0
    ? name.trim().length > 0
    : step === 1
      ? preferredPosition !== null
      : true

  const handleContinue = async () => {
    if (!profileReady || !canContinue || saving) return
    if (step < 3) {
      setStep((current) => current + 1)
      return
    }
    await saveProfile()
  }

  /** Persist and enter the app. Reachable from the finish button or "skip". */
  const saveProfile = async () => {
    if (!profileReady || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data } = await httpClient.patch<{ data: ProfileData }>('/v1/auth/me', {
        // Required
        name: name.trim(),
        languagePreference: language,
        preferredPosition,
        skillLevel,
        // Optional — only sent when the user actually filled them in
        profilePhotoUrl,
        currentClub: currentClub.trim() || null,
        formerClub: formerClub.trim() || null,
        strongFoot,
        playerStyle,
        specialSkill: specialSkill.trim() || null,
        favoriteExcuse: favoriteExcuse.trim() || null,
        badFaithLevel,
        lockerRoomStyle: lockerRoomStyle.trim() || null,
        thirdHalfProfile: thirdHalfProfile.trim() || null,
      })
      queryClient.setQueryData(['auth', 'me'], data.data)
      await queryClient.invalidateQueries({ queryKey: ['users', 'me', 'groups'] })
      router.replace('/(app)')
    } catch {
      setError('common.genericError')
    } finally {
      setSaving(false)
    }
  }

  const previewName = name.trim() || t('auth.profileCompletion.placeholder')
  const textureLines = step === 0
    ? [{ text: 'YOUR' }, { text: 'NAME', x: 72 }]
    : step === 1
      ? [{ text: 'YOUR' }, { text: 'GAME', x: 72 }]
      : [{ text: 'YOUR' }, { text: 'STORY', x: 72 }]

  return (
    <View style={styles.screen}>
      <TextureType lines={textureLines} style={styles.texture} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.container}>
            <Text style={styles.kicker}>{t('auth.profileCompletion.kicker', { step: step + 1 })}</Text>
            <View style={styles.progressRow}>
              {[0, 1, 2, 3].map((item) => (
                <View key={item} style={[styles.progressBar, item <= step && styles.progressBarActive]} />
              ))}
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>
                {t(`auth.profileCompletion.step${step + 1}Title`)}
                <Text style={styles.titleAccent}>.</Text>
              </Text>
              <Text style={styles.subtitle}>{t(`auth.profileCompletion.step${step + 1}Subtitle`)}</Text>
            </View>

            {step === 0 && (
              <View>
                <View style={styles.photoBlock}>
                  <DuotoneAvatar displayName={previewName} photoUrl={profilePhotoUrl} size={112} ring="red" />
                  <Chip
                    label={photoUploading ? t('auth.profileCompletion.photoUploading') : t('auth.profileCompletion.addPhoto')}
                    variant="outlined"
                    onPress={handlePhoto}
                  />
                  <Text style={styles.photoHint}>{t('auth.profileCompletion.photoHint')}</Text>
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.nameLabel')}</Text>
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder={t('auth.profileCompletion.placeholder')}
                  autoCapitalize="words"
                />

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.language').toUpperCase()}</Text>
                <View style={styles.chipRow}>
                  {LANGUAGES.map((item) => (
                    <Chip key={item} label={item.toUpperCase()} active={language === item} onPress={() => handleLanguage(item)} />
                  ))}
                </View>
              </View>
            )}

            {/* The only other required step: what a host needs to place you. */}
            {step === 1 && (
              <View>
                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.position')}</Text>
                <View style={styles.chipRow}>
                  {POSITIONS.map((item) => (
                    <Chip
                      key={item}
                      label={t(`auth.profileCompletion.position.${item}`)}
                      active={preferredPosition === item}
                      onPress={() => setPreferredPosition(item)}
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.skillLevel')}</Text>
                <View style={styles.chipRow}>
                  {SKILL_LEVELS.map((item) => (
                    <Chip
                      key={item}
                      label={t(`player.level.${item}`)}
                      active={skillLevel === item}
                      onPress={() => setSkillLevel(item)}
                    />
                  ))}
                </View>
                <Text style={styles.optionalHint}>{t('auth.profileCompletion.skillLevelHint')}</Text>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={styles.funHint}>{t('auth.profileCompletion.funOptional')}</Text>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.currentClub')}</Text>
                <Input
                  value={currentClub}
                  onChangeText={setCurrentClub}
                  placeholder={t('auth.profileCompletion.currentClubPlaceholder')}
                  autoCapitalize="words"
                  maxLength={100}
                />

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.formerClub')}</Text>
                <Input
                  value={formerClub}
                  onChangeText={setFormerClub}
                  placeholder={t('auth.profileCompletion.formerClubPlaceholder')}
                  autoCapitalize="words"
                  maxLength={100}
                />

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.strongFoot')}</Text>
                <View style={styles.chipRow}>
                  {STRONG_FEET.map((item) => (
                    <Chip
                      key={item}
                      label={t(`auth.profileCompletion.foot.${item}`)}
                      active={strongFoot === item}
                      onPress={() => setStrongFoot(item)}
                    />
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.playerStyle')}</Text>
                <View style={styles.styleGrid}>
                  {PLAYER_STYLES.map((item) => (
                    <Pressable
                      key={item}
                      style={[styles.styleCard, playerStyle === item && styles.styleCardActive]}
                      onPress={() => setPlayerStyle(item)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: playerStyle === item }}
                    >
                      <Text style={[styles.styleName, playerStyle === item && styles.styleNameActive]}>
                        {t(`auth.profileCompletion.style.${item}.name`)}
                      </Text>
                      <Text style={styles.styleDescription}>{t(`auth.profileCompletion.style.${item}.description`)}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.previewLabel}>{t('auth.profileCompletion.cardPreview').toUpperCase()}</Text>
                <LinearGradient
                  colors={[Colors.paperCard, Colors.paper]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.2, y: 1 }}
                  style={styles.previewCard}
                >
                  <View>
                    <Text style={styles.previewInitials}>
                      {initialsOf(previewName)}<Text style={styles.previewDot}>.</Text>
                    </Text>
                    <Text style={styles.previewName}>{previewName.toUpperCase()}</Text>
                  </View>
                  <View style={styles.previewMeta}>
                    <Text style={styles.previewMetaPrimary}>
                      {playerStyle ? t(`auth.profileCompletion.style.${playerStyle}.name`).toUpperCase() : '—'}
                    </Text>
                    <Text style={styles.previewMetaSecondary}>
                      {preferredPosition ? t(`auth.profileCompletion.position.${preferredPosition}`).toUpperCase() : '—'}
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={styles.funHint}>{t('auth.profileCompletion.funOptional')}</Text>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.specialSkill')}</Text>
                <Input
                  value={specialSkill}
                  onChangeText={setSpecialSkill}
                  placeholder={t('auth.profileCompletion.specialSkillPlaceholder')}
                  maxLength={50}
                />
                <View style={styles.suggestionRow}>
                  {SPECIAL_SKILLS.map((item) => {
                    const label = t(`auth.profileCompletion.specialSkill.${item}`)
                    return <Chip key={item} label={label} active={specialSkill === label} onPress={() => setSpecialSkill(label)} />
                  })}
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.favoriteExcuse')}</Text>
                <Input
                  value={favoriteExcuse}
                  onChangeText={setFavoriteExcuse}
                  placeholder={t('auth.profileCompletion.favoriteExcusePlaceholder')}
                  maxLength={60}
                />
                <View style={styles.suggestionRow}>
                  {FAVORITE_EXCUSES.map((item) => {
                    const label = t(`auth.profileCompletion.favoriteExcuse.${item}`)
                    return <Chip key={item} label={label} active={favoriteExcuse === label} onPress={() => setFavoriteExcuse(label)} />
                  })}
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.badFaith')}</Text>
                <View style={styles.badFaithRow}>
                  {BAD_FAITH_EMOJIS.map((emoji, index) => {
                    const level = index + 1
                    return (
                      <Pressable
                        key={emoji}
                        style={[styles.badFaithButton, badFaithLevel === level && styles.badFaithButtonActive]}
                        onPress={() => setBadFaithLevel(level)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: badFaithLevel === level }}
                        accessibilityLabel={`${t('auth.profileCompletion.badFaith')} ${level}/5`}
                      >
                        <Text style={styles.badFaithEmoji}>{emoji}</Text>
                      </Pressable>
                    )
                  })}
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.lockerRoomStyle')}</Text>
                <Input
                  value={lockerRoomStyle}
                  onChangeText={setLockerRoomStyle}
                  placeholder={t('auth.profileCompletion.lockerRoomStylePlaceholder')}
                  maxLength={40}
                />
                <View style={styles.suggestionRow}>
                  {LOCKER_ROOM_STYLES.map((item) => {
                    const label = t(`auth.profileCompletion.lockerRoomStyle.${item}`)
                    return <Chip key={item} label={label} active={lockerRoomStyle === label} onPress={() => setLockerRoomStyle(label)} />
                  })}
                </View>

                <Text style={styles.fieldLabel}>{t('auth.profileCompletion.thirdHalf')}</Text>
                <Input
                  value={thirdHalfProfile}
                  onChangeText={setThirdHalfProfile}
                  placeholder={t('auth.profileCompletion.thirdHalfPlaceholder')}
                  maxLength={50}
                />
                <View style={styles.suggestionRow}>
                  {THIRD_HALF_PROFILES.map((item) => {
                    const label = t(`auth.profileCompletion.thirdHalf.${item}`)
                    return <Chip key={item} label={label} active={thirdHalfProfile === label} onPress={() => setThirdHalfProfile(label)} />
                  })}
                </View>
              </View>
            )}

            {/* error holds an i18n key, translated at render so a language switch never strands stale copy */}
            {error && <Text style={styles.errorText}>{t(error)}</Text>}

            <View style={styles.actions}>
              {step > 0 && (
                <Pressable style={styles.backButton} onPress={() => setStep((current) => current - 1)}>
                  <Text style={styles.backButtonText}>{t('auth.profileCompletion.back')}</Text>
                </Pressable>
              )}
              <View style={styles.primaryAction}>
                <PrimaryButton
                  label={
                    profileReady
                      ? t(step === 3 ? 'auth.profileCompletion.finish' : 'auth.profileCompletion.continue')
                      : t('auth.profileCompletion.retry')
                  }
                  onPress={profileReady ? handleContinue : syncProfile}
                  loading={syncing || saving}
                  disabled={profileReady && !canContinue}
                />
              </View>
            </View>

            {/* From the last required step onward, the user can be in the app in
                one tap. The card fields are a reward to come back for. */}
            {profileReady && !isRequiredStep && step < 3 && (
              <Pressable
                style={styles.skipButton}
                onPress={() => void saveProfile()}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.skipButtonText}>{t('auth.profileCompletion.skip')}</Text>
              </Pressable>
            )}
            {profileReady && step === 1 && canContinue && (
              <Pressable
                style={styles.skipButton}
                onPress={() => void saveProfile()}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.skipButtonText}>{t('auth.profileCompletion.startPlaying')}</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  keyboard: { flex: 1 },
  texture: { top: 42, left: -34 },
  scrollContent: { flexGrow: 1, paddingBottom: 36 },
  container: { paddingHorizontal: 24 },
  kicker: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  progressRow: { flexDirection: 'row', gap: 7, marginTop: 10, marginBottom: 30 },
  skipButton: { alignSelf: 'center', marginTop: 18, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  skipButtonText: { color: Colors.inkSecondary, fontFamily: Fonts.interSemiBold, fontSize: 13 },
  progressBar: { flex: 1, height: 3, borderRadius: Radius.full, backgroundColor: Colors.line },
  progressBarActive: { backgroundColor: Colors.primary },
  header: { marginBottom: 28 },
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 40,
    letterSpacing: Type.display.letterSpacing,
  },
  titleAccent: { color: Colors.primary },
  subtitle: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 15, lineHeight: 22, marginTop: 8 },
  photoBlock: { alignItems: 'center', gap: 12, marginBottom: 28 },
  photoHint: { color: Colors.inkDisabled, fontFamily: Fonts.inter, fontSize: 12, textAlign: 'center' },
  fieldLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  optionalHint: { color: Colors.inkDisabled, fontFamily: Fonts.inter, fontSize: 12, marginTop: 6, marginLeft: 3 },
  funHint: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    padding: 14,
  },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  badFaithRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  badFaithButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badFaithButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  badFaithEmoji: { fontSize: 22 },
  storyCallout: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.25)',
    padding: 18,
    marginBottom: 4,
  },
  storyCalloutEyebrow: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  storyCalloutText: { color: Colors.ink, fontFamily: Fonts.interMedium, fontSize: 15, lineHeight: 22 },
  styleGrid: { gap: 9 },
  styleCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.md,
    padding: 16,
  },
  styleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  styleName: { color: Colors.ink, fontFamily: Fonts.interBold, fontSize: 15 },
  styleNameActive: { color: Colors.primary },
  styleDescription: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, lineHeight: 18, marginTop: 3 },
  previewLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: 28,
    marginBottom: 10,
  },
  previewCard: {
    borderRadius: Radius.card,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewInitials: { color: Colors.paperInk, fontFamily: Fonts.bebas, fontSize: 42, letterSpacing: 1.4 },
  previewDot: { color: Colors.paperRed },
  previewName: { color: Colors.paperInk2, fontFamily: Fonts.interSemiBold, fontSize: 9, letterSpacing: 1.1 },
  previewMeta: { alignItems: 'flex-end', maxWidth: 150 },
  previewMetaPrimary: { color: Colors.paperRed, fontFamily: Fonts.bebas, fontSize: 21, letterSpacing: 1.2 },
  previewMetaSecondary: { color: Colors.paperInk2, fontFamily: Fonts.interSemiBold, fontSize: 9, marginTop: 3 },
  errorText: { color: Colors.primary, fontFamily: Fonts.inter, fontSize: 13, marginTop: 18, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 30 },
  backButton: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 8 },
  backButtonText: { color: Colors.inkSecondary, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  primaryAction: { flex: 1 },
})
