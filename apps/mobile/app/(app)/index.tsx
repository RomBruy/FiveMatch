import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { Chip } from '../../components/ui/Chip'
import { Input } from '../../components/ui/Input'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { SkeletonRow } from '../../components/ui/Skeleton'
import { EmptyState, EmptyPreview } from '../../components/ui/EmptyState'
import { StaggerItem } from '../../components/ui/Stagger'
import { TextureType } from '../../components/ui/TextureType'
import { PromiseBand } from '../../components/brand/PromiseBand'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { MatchCard } from '../../components/match/MatchCard'
import { useDiscoveryLocation } from '../../hooks/use-discovery-location'
import {
  useDiscoverMatches,
  DEFAULT_DISCOVER_FILTERS,
  type DiscoverFilters,
  type SkillLevel,
} from '../../lib/matches'

const RADIUS_OPTIONS = [5, 15, 30, 50]
const LEVEL_OPTIONS: SkillLevel[] = ['casual', 'intermediate', 'competitive']

/**
 * JOUER — the app's front door.
 *
 * This replaced a group home screen that dead-ended for anyone without a crew.
 * The first thing a new user sees is now games they can actually join, and the
 * only thing standing between them and the list is "where are you".
 */
export default function DiscoverTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { location, permission, isLocating, requestDeviceLocation, setManualCity } = useDiscoveryLocation()
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_DISCOVER_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [cityDraft, setCityDraft] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data: matches, isLoading, refetch } = useDiscoverMatches(location, filters)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const patch = (next: Partial<DiscoverFilters>) => setFilters((f) => ({ ...f, ...next }))

  // "Nothing here" is usually a radius problem, so the empty state offers the next
  // step up rather than making someone open the filter panel to guess. Null at 50 km,
  // where widening further stops being a plausible answer.
  const widerRadius = RADIUS_OPTIONS.find((km) => km > filters.radiusKm) ?? null

  const activeFilterCount =
    (filters.skillLevel ? 1 : 0) +
    (filters.when !== 'any' ? 1 : 0) +
    (filters.radiusKm !== DEFAULT_DISCOVER_FILTERS.radiusKm ? 1 : 0)

  const handleCitySubmit = async () => {
    if (!cityDraft.trim()) return
    await setManualCity(cityDraft)
    setCityDraft('')
  }

  return (
    <View style={styles.container}>
      <TextureType lines={[{ text: 'JOUER' }]} fontSize={190} style={styles.texture} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <StaggerItem index={0}>
          {/* The heading states the world, not the menu — and follows the filter,
              so it can never promise "tonight" while showing next Saturday. */}
          <Text style={styles.title}>
            {t(`discover.heading.${filters.when}`)}<Text style={styles.titleAccent}>.</Text>
          </Text>
          <Text style={styles.subtitle}>{t('discover.subtitle')}</Text>
          {/* Front door: the one row that tells a stranger what this app is.
              If it later reads as clutter for veterans, gate it on matches played. */}
          <PromiseBand style={styles.promise} />
        </StaggerItem>

        {/* Location bar — the one thing discovery cannot work without. */}
        <StaggerItem index={1} style={styles.locationSection}>
          {location ? (
            <PressableScale
              style={styles.locationBar}
              onPress={() => void requestDeviceLocation()}
              accessibilityRole="button"
              accessibilityLabel={t('discover.location.change')}
            >
              <Ionicons name="location" size={16} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {location.city ?? t('discover.location.nearby')}
              </Text>
              <Text style={styles.locationAction}>{t('discover.location.change')}</Text>
            </PressableScale>
          ) : (
            <View style={styles.locationPrompt}>
              <Text style={styles.locationPromptText}>{t('discover.location.prompt')}</Text>
              <PrimaryButton
                label={t('discover.location.useDevice')}
                onPress={() => void requestDeviceLocation()}
                loading={isLocating}
                glow={false}
              />
              {permission === 'denied' && (
                <Text style={styles.locationDenied}>{t('discover.location.denied')}</Text>
              )}
              <View style={styles.cityRow}>
                <View style={styles.cityInput}>
                  <Input
                    value={cityDraft}
                    onChangeText={setCityDraft}
                    placeholder={t('discover.location.cityPlaceholder')}
                    returnKeyType="search"
                    onSubmitEditing={() => void handleCitySubmit()}
                    autoCapitalize="words"
                  />
                </View>
                <SecondaryButton label={t('common.ok')} onPress={() => void handleCitySubmit()} />
              </View>
            </View>
          )}
        </StaggerItem>

        {location && (
          <>
            <StaggerItem index={2} style={styles.filterBar}>
              <Chip
                label={
                  activeFilterCount > 0
                    ? t('discover.filters.activeCount', { count: activeFilterCount })
                    : t('discover.filters.title')
                }
                variant="outlined"
                active={activeFilterCount > 0}
                onPress={() => setFiltersOpen((open) => !open)}
              />
              <Chip
                label={t('discover.when.today')}
                active={filters.when === 'today'}
                onPress={() => patch({ when: filters.when === 'today' ? 'any' : 'today' })}
              />
              <Chip
                label={t('discover.when.week')}
                active={filters.when === 'week'}
                onPress={() => patch({ when: filters.when === 'week' ? 'any' : 'week' })}
              />
            </StaggerItem>

            {filtersOpen && (
              <View style={styles.filterPanel}>
                <Text style={styles.filterLabel}>{t('discover.filters.radius')}</Text>
                <View style={styles.chipRow}>
                  {RADIUS_OPTIONS.map((km) => (
                    <Chip
                      key={km}
                      label={t('discover.filters.radiusValue', { km })}
                      active={filters.radiusKm === km}
                      onPress={() => patch({ radiusKm: km })}
                    />
                  ))}
                </View>

                {/* No format filter: every match is 5v5, so it filtered nothing. */}
                <Text style={styles.filterLabel}>{t('discover.filters.level')}</Text>
                <View style={styles.chipRow}>
                  {LEVEL_OPTIONS.map((level) => (
                    <Chip
                      key={level}
                      label={t(`player.level.${level}`)}
                      active={filters.skillLevel === level}
                      onPress={() => patch({ skillLevel: filters.skillLevel === level ? null : level })}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.results}>
              {isLoading ? (
                <View style={styles.resultsList}>
                  <SkeletonRow card />
                  <SkeletonRow card />
                  <SkeletonRow card />
                </View>
              ) : matches && matches.length > 0 ? (
                <View style={styles.resultsList}>
                  {matches.map((match, index) => (
                    <StaggerItem key={match.matchId} index={Math.min(index, 6)}>
                      <MatchCard
                        scheduledAt={match.scheduledAt}
                        venueName={null}
                        city={match.city}
                        location={null}
                        distanceKm={match.distanceKm}
                        format={match.format}
                        skillLevel={match.skillLevel}
                        pricePerPlayer={match.pricePerPlayer}
                        currency={match.currency}
                        confirmedCount={match.confirmedCount}
                        capacity={match.capacity}
                        spotsRemaining={match.spotsRemaining}
                        hostDisplayName={match.hostDisplayName}
                        joined={match.viewerJoined}
                        onPress={() => router.push(`/(app)/match/${match.matchId}` as never)}
                      />
                    </StaggerItem>
                  ))}
                </View>
              ) : (
                // The worst screen in the app, and the one that made it feel empty.
                // It now names what belongs here, offers the two real fixes — create
                // one, or widen the search — and shows the shape of the missing
                // cards so it reads as "no matches yet", not "this is broken".
                <View style={styles.emptyBlock}>
                  <EmptyState
                    title={t('discover.empty.title')}
                    body={t('discover.empty.body', { km: filters.radiusKm })}
                  >
                    <PrimaryButton
                      label={t('discover.empty.cta')}
                      onPress={() => router.push('/(app)/match/create' as never)}
                      glow={false}
                    />
                    {widerRadius !== null && (
                      <SecondaryButton
                        label={t('discover.empty.widen', { km: widerRadius })}
                        onPress={() => patch({ radiusKm: widerRadius })}
                      />
                    )}
                  </EmptyState>
                  <Text style={styles.emptyPreviewLabel}>{t('discover.empty.preview')}</Text>
                  <EmptyPreview />
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.createBlock}>
          <SecondaryButton
            label={t('discover.createMatch')}
            onPress={() => router.push('/(app)/match/create' as never)}
          />
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  texture: {
    top: 20,
    right: -60,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 40,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titleAccent: {
    color: Colors.primary,
  },
  subtitle: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    marginTop: 4,
  },
  promise: {
    marginTop: 13,
  },
  locationSection: {
    marginTop: 22,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  locationText: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Fonts.interSemiBold,
    fontSize: 13.5,
  },
  locationAction: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  locationPrompt: {
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
  },
  locationPromptText: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    lineHeight: 20,
  },
  locationDenied: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.inter,
    fontSize: 12.5,
    lineHeight: 18,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityInput: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  filterPanel: {
    marginTop: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    gap: 8,
  },
  filterLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  results: {
    marginTop: 22,
  },
  resultsList: {
    gap: 10,
  },
  emptyBlock: {
    gap: 16,
    paddingVertical: 8,
  },
  emptyPreviewLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
    textTransform: 'uppercase',
  },
  createBlock: {
    marginTop: 28,
  },
})
