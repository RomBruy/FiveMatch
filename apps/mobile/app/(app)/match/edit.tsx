import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, Switch } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { haptics } from '../../../lib/haptics'
import { useMatch } from '../../../lib/matches'
import { Input } from '../../../components/ui/Input'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'

/**
 * Edit a match that has not happened yet.
 *
 * Format, players per team and goalkeeper mode are absent on purpose: they
 * decide capacity and team shape, so changing them after people commit silently
 * invalidates the sheet they said yes to. Changing those means a new match.
 */
export default function EditMatchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { data: match } = useMatch(matchId)

  const [venueName, setVenueName] = useState('')
  const [city, setCity] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    if (!match) return
    setVenueName(match.venueName ?? '')
    setCity(match.city ?? '')
    setLocation(match.location ?? '')
    setNotes(match.notes ?? '')
    setIsPublic(match.visibility === 'public')
  }, [match])

  const save = useMutation({
    mutationFn: () => httpClient.patch(`/v1/matches/${matchId}`, {
      venueName: venueName.trim() || null,
      city: city.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      visibility: isPublic ? 'public' : 'private',
    }),
    onSuccess: () => {
      haptics.success()
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      router.back()
    },
    onError: () => Alert.alert(t('common.genericError')),
  })

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('match.edit.title')}</Text>

      <Field label={t('match.edit.venue')}>
        <Input value={venueName} onChangeText={setVenueName} />
      </Field>
      <Field label={t('match.edit.city')}>
        <Input value={city} onChangeText={setCity} />
      </Field>
      <Field label={t('match.edit.address')}>
        <Input value={location} onChangeText={setLocation} />
      </Field>
      <Field label={t('match.edit.notes')}>
        <Input value={notes} onChangeText={setNotes} multiline />
      </Field>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>{t('match.edit.public')}</Text>
          <Text style={styles.switchHelp}>{t('match.edit.publicHelp')}</Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={(next) => { haptics.selection(); setIsPublic(next) }}
          trackColor={{ true: Colors.primary, false: Colors.surfaceRaised }}
        />
      </View>

      <Text style={styles.footnote}>{t('match.edit.formatLocked')}</Text>

      <PrimaryButton
        label={t('common.save')}
        onPress={() => save.mutate()}
        disabled={save.isPending}
      />
      <SecondaryButton label={t('common.cancel')} onPress={() => router.back()} />
      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  )
}

/** Caption above a field — `Input` carries no label of its own. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  content: { paddingHorizontal: 20, gap: 14 },
  title: { fontFamily: Fonts.bebas, fontSize: Type.display.maxSize, color: Colors.ink },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: 14,
  },
  switchText: { flex: 1, gap: 3 },
  switchLabel: { fontFamily: Fonts.interSemiBold, fontSize: 14, color: Colors.ink },
  switchHelp: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled },
  footnote: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.inkDisabled },
})
