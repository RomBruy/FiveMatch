import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { PrivatePlayerProfile, ProfileFieldVisibility } from '@fivematch/types'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { PressableScale } from '../../../components/ui/PressableScale'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { ProfileVisibilityControls } from '../../../components/players/ProfileVisibilityControls'
import { httpClient } from '../../../lib/api-client'
import { PRESETS, PRESET_ORDER, detectPreset, type PresetId } from '../../../lib/visibility-presets'
import { haptics } from '../../../lib/haptics'

/**
 * Who sees what.
 *
 * Three named settings do the work; the per-field grid that used to sit on the
 * profile is still here, one disclosure down, for anyone who genuinely wants
 * it. What is never negotiable is stated up front rather than hidden in the
 * grid: the note, the reliability mark and the match count stay visible,
 * because they are what lets a stranger accept you into their match.
 */
export default function PrivacyScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [showGrid, setShowGrid] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['players', 'me'],
    queryFn: () => httpClient.get<{ data: PrivatePlayerProfile }>('/v1/players/me').then((r) => r.data.data),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (next: ProfileFieldVisibility) =>
      httpClient.patch<{ data: { visibility: ProfileFieldVisibility } }>('/v1/players/me/visibility', next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<PrivatePlayerProfile>(['players', 'me'], (current) =>
        current ? { ...current, visibility: data.data.visibility } : current)
    },
  })

  const visibility = profile?.visibility
  const active = visibility ? detectPreset(visibility) : null

  const choose = (id: PresetId) => {
    haptics.selection()
    mutation.mutate(PRESETS[id])
  }

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
        <Text style={styles.navTitle}>{t('privacy.title')}</Text>
      </View>

      <Text style={styles.lede}>{t('privacy.alwaysVisible')}</Text>

      <Text style={styles.label}>{t('privacy.chooseSetting').toUpperCase()}</Text>

      {isLoading || !visibility ? (
        <View style={styles.presetList}>
          <Skeleton width="100%" height={92} radius={Radius.lg} />
          <Skeleton width="100%" height={92} radius={Radius.lg} />
          <Skeleton width="100%" height={92} radius={Radius.lg} />
        </View>
      ) : (
        <>
          <View style={styles.presetList}>
            {PRESET_ORDER.map((id) => {
              const on = active === id
              return (
                <PressableScale
                  key={id}
                  onPress={() => choose(id)}
                  disabled={mutation.isPending}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.preset, on && styles.presetOn]}
                >
                  <View style={styles.presetText}>
                    <Text style={styles.presetName}>{t(`privacy.preset.${id}.name`)}</Text>
                    <Text style={styles.presetBody}>{t(`privacy.preset.${id}.body`)}</Text>
                  </View>
                  <View style={[styles.mark, on && styles.markOn]}>
                    {on && <Ionicons name="checkmark" size={14} color={Colors.ink} />}
                  </View>
                </PressableScale>
              )
            })}
          </View>

          {/* A hand-tuned setting must not be silently relabelled as a preset. */}
          {active === null && (
            <View style={styles.customNote}>
              <Ionicons name="options-outline" size={16} color={Colors.inkSecondary} />
              <Text style={styles.customNoteText}>{t('privacy.custom')}</Text>
            </View>
          )}

          <PressableScale
            onPress={() => setShowGrid((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showGrid }}
            style={styles.disclosure}
          >
            <View style={styles.presetText}>
              <Text style={styles.disclosureTitle}>{t('privacy.perField')}</Text>
              <Text style={styles.presetBody}>{t('privacy.perFieldHelp')}</Text>
            </View>
            <Ionicons
              name={showGrid ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={Colors.inkDisabled}
            />
          </PressableScale>

          {showGrid && <ProfileVisibilityControls visibility={visibility} />}
        </>
      )}
    </ScrollView>
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
  lede: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 13.5, lineHeight: 20 },
  label: {
    color: Colors.primary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
    marginTop: 26,
    marginBottom: 10,
  },
  presetList: { gap: 10 },
  preset: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 16,
  },
  presetOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  presetText: { flex: 1, gap: 5 },
  presetName: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  presetBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, lineHeight: 17 },
  mark: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  markOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  customNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  customNoteText: { flex: 1, color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, lineHeight: 17 },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  disclosureTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
})
