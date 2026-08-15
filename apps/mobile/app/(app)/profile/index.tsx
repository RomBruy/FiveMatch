import { View, Text, StyleSheet, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated from 'react-native-reanimated'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { DuotoneAvatar, getInitials } from '../../../components/ui/DuotoneAvatar'
import { StatTile } from '../../../components/ui/StatTile'
import { Skeleton, SkeletonTile } from '../../../components/ui/Skeleton'
import { CollapsingHeader, CollapsingHeaderTitle, useCollapsingHeader } from '../../../components/ui/CollapsingHeader'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { TextureType } from '../../../components/ui/TextureType'
import { OvrBadge } from '../../../components/players/OvrBadge'
import { ProgressBarPill } from '../../../components/shared/ProgressBarPill'
import { ProfileStorySections, type ProfilePersonality } from '../../../components/players/ProfileStorySections'
import { TrustRow } from '../../../components/players/TrustRow'
import { TrustDetail } from '../../../components/players/TrustDetail'
import { useGroupContext } from '../../../contexts/GroupContext'
import { httpClient } from '../../../lib/api-client'
import type { PrivatePlayerProfile } from '@fivematch/types'
import { PressableScale } from '../../../components/ui/PressableScale'

export default function ProfileTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { activeGroupId } = useGroupContext()
  const { data: profile, isLoading: userLoading } = useQuery({
    queryKey: ['players', 'me'],
    queryFn: () => httpClient.get<{ data: PrivatePlayerProfile }>('/v1/players/me').then((r) => r.data.data),
    retry: false,
  })
  const [refreshing, setRefreshing] = useState(false)
  const { scrollY, scrollHandler } = useCollapsingHeader()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['players', 'me'] }),
        queryClient.refetchQueries({ queryKey: ['groups', activeGroupId] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, activeGroupId])

  // The crest is the only thing here that still needs a crew, and it's optional.
  const { data: group } = useQuery({
    queryKey: ['groups', activeGroupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { name: string; tier: string } }>(`/v1/groups/${activeGroupId}`)
      return data.data
    },
    enabled: !!activeGroupId,
  })

  const myPlayer = profile ? { ...profile, matchCount: profile.eligibleMatchCount } : undefined
  const football = profile?.footballIdentity
  const user = profile ? {
    name: profile.displayName,
    profilePhotoUrl: profile.photoUrl ?? null,
    currentClub: football?.currentClub ?? null,
    formerClub: football?.formerClub ?? null,
    preferredPosition: football?.preferredPosition ?? null,
    strongFoot: football?.strongFoot ?? null,
    playerStyle: football?.playerStyle ?? null,
    isAdmin: profile.isAdmin,
  } : undefined
  const displayName = profile?.displayName ?? ''
  const isUnlocked = profile?.cardState === 'unlocked' && profile.ovrScore !== null
  const tightestMatch = profile?.memory.tightestMatch ?? null
  const personality: ProfilePersonality | null = profile?.personality ? {
    specialSkill: profile.personality.specialSkill ?? null,
    favoriteExcuse: profile.personality.favoriteExcuse ?? null,
    badFaithLevel: profile.personality.badFaithLevel ?? null,
    lockerRoomStyle: profile.personality.lockerRoomStyle ?? null,
    thirdHalfProfile: profile.personality.thirdHalfProfile ?? null,
  } : null

  return (
    <View style={styles.container}>
      {/* The screen's ONE texture element: crest-initials outline watermark (R9 mapping). */}
      {group && (
        <TextureType lines={[{ text: getInitials(group.name) }]} fontSize={200} style={styles.crestTexture} />
      )}

      <Animated.ScrollView
        style={styles.scroll}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {userLoading ? (
          <>
            {/* Identity + stat placeholders — the shape the profile fills into */}
            <View style={styles.identity}>
              <Skeleton width={96} height={96} radius={Radius.full} />
              <View style={styles.identityText}>
                <Skeleton width="70%" height={30} />
                <Skeleton width="50%" height={12} style={styles.identitySkeletonMeta} />
              </View>
            </View>
            <View style={styles.statBand}>
              <View style={styles.ovrBlock}>
                <Skeleton width={72} height={54} radius={Radius.sm} />
              </View>
              <View style={styles.tiles}>
                <SkeletonTile />
                <SkeletonTile />
              </View>
            </View>
          </>
        ) : (
          /* Identity header */
          <View style={styles.identity}>
            <DuotoneAvatar displayName={displayName} photoUrl={user?.profilePhotoUrl} size={96} />
            <View style={styles.identityText}>
              <CollapsingHeaderTitle
                title={displayName}
                scrollY={scrollY}
                subtitle={group ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {t(`groups.home.tier.${group.tier}`).toUpperCase()} · {group.name.toUpperCase()}
                  </Text>
                ) : undefined}
              />
            </View>
          </View>
        )}

        {user?.playerStyle && (
          <View style={styles.footballIdentity}>
            <Text style={styles.sectionLabel}>{t('profile.footballIdentity').toUpperCase()}</Text>
            <View style={styles.playerStyleBanner}>
              <Text style={styles.playerStyleName}>
                {t(`auth.profileCompletion.style.${user.playerStyle}.name`)}
              </Text>
              <Text style={styles.playerStyleDescription}>
                {t(`auth.profileCompletion.style.${user.playerStyle}.description`)}
              </Text>
            </View>
            <View style={styles.identityGrid}>
              {user.currentClub && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>{user.currentClub}</Text>
                  <Text style={styles.identityLabel}>{t('profile.currentClub')}</Text>
                </View>
              )}
              {user.formerClub && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>{user.formerClub}</Text>
                  <Text style={styles.identityLabel}>{t('profile.formerClub')}</Text>
                </View>
              )}
              {user.preferredPosition && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>
                    {t(`auth.profileCompletion.position.${user.preferredPosition}`)}
                  </Text>
                  <Text style={styles.identityLabel}>{t('profile.position')}</Text>
                </View>
              )}
              {user.strongFoot && (
                <View style={styles.identityTile}>
                  <Text style={styles.identityValue} numberOfLines={1}>
                    {t(`auth.profileCompletion.foot.${user.strongFoot}`)}
                  </Text>
                  <Text style={styles.identityLabel}>{t('profile.strongFoot')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* OVR stays — but as the reward it is, sitting beside the two numbers
            that other people actually judge you on. */}
        {myPlayer && (
          <View style={styles.statBand}>
            <View style={styles.ovrBlock}>
              <Text style={styles.ovrLabel}>{t('profile.stats.ovr').toUpperCase()}</Text>
              {isUnlocked ? (
                // Unlocked hero OVR is gold per Story 2.3 — the screen's single gold.
                <OvrBadge ovrScore={myPlayer.ovrScore} cardState={myPlayer.cardState} size="hero" />
              ) : (
                // 4-match gate: locked speaks the progress language, never a number.
                <ProgressBarPill matchCount={myPlayer.matchCount} cardState={myPlayer.cardState} />
              )}
            </View>
            <View style={styles.tiles}>
              <StatTile value={myPlayer.matchCount} label={t('profile.stats.matches')} />
              <StatTile
                value={myPlayer.trust.reliability !== null ? `${myPlayer.trust.reliability}%` : '—'}
                label={t('profile.stats.reliability')}
              />
            </View>
          </View>
        )}

        {myPlayer && (
          <View style={styles.levelSection}>
            <Text style={styles.sectionLabel}>{t('profile.level.title').toUpperCase()}</Text>
            <TrustRow
              skillLevel={myPlayer.skillLevel}
              isReliable={myPlayer.isReliable}
              matchCount={myPlayer.matchCount}
            />
            <TrustDetail
              reliability={myPlayer.trust.reliability}
              fairPlay={myPlayer.trust.fairPlay}
              sampleCount={myPlayer.trust.sampleCount}
            />
          </View>
        )}

        {/* The note decided team balance, card unlocks and pronos odds while no
            screen said where it came from. This is the door to that answer, and
            it sits directly under the number it explains. */}
        <PressableScale
          style={styles.explainRow}
          onPress={() => router.push('/(app)/profile/note' as never)}
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
          <View style={styles.explainText}>
            <Text style={styles.explainTitle}>{t('profile.note.explainCta')}</Text>
            <Text style={styles.explainSub}>{t('profile.note.explainSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={Colors.primary} />
        </PressableScale>

        {/* Second door to the history — the first is the Mes matchs segmented
            control. It was reachable only behind a chip that read as a filter. */}
        {myPlayer && (
          <>
            <Text style={styles.sectionLabel}>{t('profile.history.title').toUpperCase()}</Text>
            <PressableScale
              style={styles.navRow}
              onPress={() => router.push('/(app)/matches?scope=past' as never)}
              accessibilityRole="button"
            >
              <Ionicons name="calendar-outline" size={18} color={Colors.inkSecondary} />
              <View style={styles.explainText}>
                <Text style={styles.navRowTitle}>
                  {t('profile.history.count', { count: myPlayer.matchCount })}
                </Text>
                <Text style={styles.explainSub}>{t('profile.history.sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={Colors.inkDisabled} />
            </PressableScale>
          </>
        )}

        <ProfileStorySections
          tightestMatch={tightestMatch}
          personality={personality}
        />

        {/* Settings live in Modifier mon profil. A profile is a shop window;
            48 visibility chips under the card made it a control panel. */}
        <View style={styles.actions}>
          <SecondaryButton
            label={t('profile.edit')}
            onPress={() => router.push('/(app)/profile/edit' as never)}
          />
          {user?.isAdmin && (
            <SecondaryButton
              label={t('admin.metrics.navButton')}
              onPress={() => router.push('/(app)/admin' as never)}
            />
          )}
        </View>
      </Animated.ScrollView>
      {!userLoading && (
        <CollapsingHeader
          title={displayName}
          scrollY={scrollY}
          compactLeading={<DuotoneAvatar displayName={displayName} photoUrl={user?.profilePhotoUrl} size={30} />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  crestTexture: {
    top: 26,
    right: -70,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  identityText: { flex: 1, gap: 4 },
  meta: {
    color: Colors.inkSecondary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
  },
  formRow: { marginTop: 6 },
  identitySkeletonMeta: { marginTop: 10 },
  footballIdentity: { marginTop: 28 },
  sectionLabel: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  playerStyleBanner: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.24)',
    padding: 16,
    marginBottom: 10,
  },
  playerStyleName: { color: Colors.primary, fontFamily: Fonts.bebas, fontSize: 24, letterSpacing: 1.4 },
  playerStyleDescription: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, marginTop: 3 },
  identityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  identityTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 14,
  },
  identityValue: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  identityLabel: { color: Colors.inkDisabled, fontFamily: Fonts.inter, fontSize: 11, marginTop: 4 },
  levelSection: {
    marginTop: 22,
    gap: 10,
  },
  statBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  ovrBlock: {
    minWidth: 96,
    alignItems: 'center',
    gap: 2,
  },
  ovrLabel: {
    color: Colors.inkDisabled,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
  tiles: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  explainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 24,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.24)',
  },
  explainText: { flex: 1, gap: 2 },
  explainTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  explainSub: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 11.5, lineHeight: 16 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  navRowTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
})
