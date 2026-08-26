import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { PrivatePlayerProfile } from '@fivematch/types'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { PressableScale } from '../../../components/ui/PressableScale'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { httpClient } from '../../../lib/api-client'
import { detectPreset } from '../../../lib/visibility-presets'

/**
 * Everything about the profile that is a setting rather than a display.
 *
 * The profile screen had grown into both at once: your card and your face at
 * the top, forty-eight consent chips at the bottom. Splitting them means the
 * page people look at a hundred times stays a page, and the things you set once
 * live where you go looking for settings.
 *
 * Each row shows its current value, so you can tell what needs opening without
 * opening it.
 */

type Row = {
  key: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  onPress: () => void
}

export default function ProfileEditScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { data: profile } = useQuery({
    queryKey: ['players', 'me'],
    queryFn: () => httpClient.get<{ data: PrivatePlayerProfile }>('/v1/players/me').then((r) => r.data.data),
    retry: false,
  })

  const football = profile?.footballIdentity
  // Only the parts that are actually filled in — an empty summary is noise.
  const identitySummary = [
    football?.preferredPosition && t(`auth.profileCompletion.position.${football.preferredPosition}`),
    football?.strongFoot && t(`auth.profileCompletion.foot.${football.strongFoot}`),
    football?.currentClub,
  ].filter(Boolean).join(' · ')

  const preset = profile?.visibility ? detectPreset(profile.visibility) : null

  const you: Row[] = [
    {
      key: 'identity',
      icon: 'person-outline',
      title: t('profileEdit.identity'),
      subtitle: identitySummary || t('profileEdit.identityEmpty'),
      onPress: () => router.push('/(auth)/profile-completion' as never),
    },
    {
      key: 'cardPhoto',
      icon: 'image-outline',
      title: t('profileEdit.cardPhoto'),
      subtitle: t('profileEdit.cardPhotoSub'),
      onPress: () => router.push('/(app)/profile/card-photo' as never),
    },
  ]

  const audience: Row[] = [
    {
      key: 'privacy',
      icon: 'lock-closed-outline',
      title: t('profileEdit.privacy'),
      subtitle: preset
        ? t('profileEdit.privacyPreset', { name: t(`privacy.preset.${preset}.name`) })
        : t('profileEdit.privacyCustom'),
      onPress: () => router.push('/(app)/profile/privacy' as never),
    },
  ]

  const account: Row[] = [
    {
      key: 'language',
      icon: 'globe-outline',
      title: t('auth.profileCompletion.language'),
      subtitle: i18n.language === 'fr' ? 'Français' : 'English',
      onPress: () => router.push('/(auth)/profile-completion' as never),
    },
    {
      // Bottom of Account is where people go looking for help, so that is where
      // it lives — not behind a question mark in a header nobody scans.
      key: 'help',
      icon: 'help-circle-outline',
      title: t('help.title'),
      subtitle: t('profileEdit.helpSub'),
      onPress: () => router.push('/(app)/help' as never),
    },
    {
      key: 'policy',
      icon: 'document-text-outline',
      title: t('profileEdit.policy'),
      subtitle: t('profileEdit.policySub'),
      onPress: () => router.push('/(public)/privacy-policy' as never),
    },
  ]

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.nav}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.ink} />
        </PressableScale>
        <Text style={styles.navTitle}>{t('profile.edit')}</Text>
      </View>

      <Section label={t('profileEdit.sectionYou')} rows={you} />
      <Section label={t('profileEdit.sectionAudience')} rows={audience} />
      <Section label={t('profileEdit.sectionAccount')} rows={account} />
    </ScrollView>
  )
}

function Section({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.list}>
        {rows.map((row, index) => (
          <PressableScale
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="button"
            style={[styles.row, index > 0 && styles.rowDivided]}
          >
            <View style={styles.icon}>
              <Ionicons name={row.icon} size={16} color={Colors.inkSecondary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              {row.subtitle && (
                <Text style={styles.rowSub} numberOfLines={1}>{row.subtitle}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={17} color={Colors.inkDisabled} />
          </PressableScale>
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  navTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 30,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  label: {
    color: Colors.primary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
    marginTop: 26,
    marginBottom: 10,
  },
  list: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 15 },
  rowDivided: { borderTopWidth: 1, borderTopColor: Colors.hairline },
  icon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  rowSub: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 11.5 },
})
