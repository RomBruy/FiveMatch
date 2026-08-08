import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type {
  PrivatePlayerProfile,
  ProfileFieldVisibility,
  ProfileVisibilityAudience,
} from '@fivematch/types'
import { httpClient } from '../../lib/api-client'
import { Colors } from '../../constants/colors'
import { Radius, Type } from '../../constants/tokens'
import { Chip } from '../ui/Chip'

const FIELDS: Array<keyof ProfileFieldVisibility> = [
  'profilePhoto', 'generatedCardPhoto', 'currentClub', 'formerClub',
  'preferredPosition', 'strongFoot', 'playerStyle', 'specialSkill',
  'favoriteExcuse', 'badFaithLevel', 'lockerRoomStyle', 'thirdHalfProfile',
]
const AUDIENCES: ProfileVisibilityAudience[] = ['private', 'group', 'participants', 'public']

export function ProfileVisibilityControls({ visibility }: { visibility: ProfileFieldVisibility }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (next: ProfileFieldVisibility) =>
      httpClient.patch<{ data: { visibility: ProfileFieldVisibility } }>('/v1/players/me/visibility', next),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<PrivatePlayerProfile>(['players', 'me'], (current) => current
        ? { ...current, visibility: data.data.visibility }
        : current)
    },
  })

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('profile.visibility.title').toUpperCase()}</Text>
      <Text style={styles.help}>{t('profile.visibility.help')}</Text>
      <View style={styles.card}>
        {FIELDS.map((field, index) => (
          <View key={field} style={[styles.row, index > 0 && styles.rowBorder]}>
            <Text style={styles.fieldLabel}>{t(`profile.visibility.fields.${field}`)}</Text>
            <View style={styles.chips}>
              {AUDIENCES.map((audience) => (
                <Chip
                  key={audience}
                  label={t(`profile.visibility.audiences.${audience}`)}
                  active={visibility[field] === audience}
                  variant={visibility[field] === audience ? 'filled' : 'outlined'}
                  onPress={() => mutation.mutate({ ...visibility, [field]: audience })}
                  disabled={mutation.isPending}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  sectionLabel: {
    color: Colors.primary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
    marginBottom: 8,
  },
  help: {
    color: Colors.inkSecondary,
    fontFamily: Type.body.fontFamily,
    fontSize: Type.body.minSize,
    lineHeight: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 14,
  },
  row: { paddingVertical: 14, gap: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.line },
  fieldLabel: {
    color: Colors.ink,
    fontFamily: Type.bodyStrong.fontFamily,
    fontSize: Type.bodyStrong.minSize,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
