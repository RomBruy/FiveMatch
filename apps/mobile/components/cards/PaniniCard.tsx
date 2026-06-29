import { View, Text, Image, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'
import type { AnimatedStyle } from 'react-native-reanimated'
import { Colors } from '../../constants/colors'
import { AttributeRadar } from '../players/AttributeRadar'
import { ProgressBarPill } from '../shared/ProgressBarPill'
import { TierBadge } from '../players/TierBadge'

type CardState = 'not_started' | 'in_progress_1' | 'in_progress_2' | 'in_progress_3' | 'unlocked'

interface PaniniCardPlayer {
  playerId: string
  displayName: string
  cardState: CardState
  matchCount: number
  ovrScore: number | null
  trend?: 'up' | 'down' | 'stable' | null
  attributes: {
    pace: number
    technique: number
    passing: number
    defending: number
    physicality: number
    effort: number
  } | null
}

interface PaniniCardProps {
  player: PaniniCardPlayer
  groupName?: string
  groupTier?: string
  photoUrl?: string | null
  ovrStyle?: AnimatedStyle<ViewStyle>
  isMvp?: boolean
}

const ATTR_LABELS: Array<{ key: keyof NonNullable<PaniniCardPlayer['attributes']>; label: string }> = [
  { key: 'pace', label: 'PAC' },
  { key: 'technique', label: 'TEC' },
  { key: 'passing', label: 'PAS' },
  { key: 'defending', label: 'DEF' },
  { key: 'physicality', label: 'PHY' },
  { key: 'effort', label: 'EFF' },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PaniniCard({ player, groupName, groupTier, photoUrl, ovrStyle, isMvp }: PaniniCardProps) {
  const { t } = useTranslation()
  const { cardState, matchCount, ovrScore, attributes, displayName, trend } = player

  const isUnlocked = cardState === 'unlocked'
  const isNotStarted = cardState === 'not_started'
  const isInProgress = cardState === 'in_progress_1' || cardState === 'in_progress_2' || cardState === 'in_progress_3'

  const matchCountLabel =
    matchCount === 1
      ? t('card.footer.matchCount_one', { count: matchCount })
      : t('card.footer.matchCount_other', { count: matchCount })

  return (
    <View style={styles.cardShadowWrapper}>
      <View style={styles.card}>

        {/* Top band */}
        <View style={styles.topBand}>
          <Text style={styles.topBandText} numberOfLines={1}>
            {groupName ? groupName.toUpperCase() : 'FIVEMATCH'}
          </Text>
          <TierBadge tier={groupTier} style={styles.topBandTier} />
        </View>

        {/* Photo zone */}
        <View style={styles.photoZone}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoBackground} />
          )}

          {!photoUrl && (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
            </View>
          )}

          {/* Position badge (top-right) */}
          <View style={styles.positionBadge}>
            <Text style={styles.positionBadgeText}>{t('card.position.general')}</Text>
          </View>

          {/* MVP badge (bottom-center of photo zone) */}
          {isMvp === true && (
            <View style={styles.mvpBadge}>
              <Text style={styles.mvpBadgeText}>{t('card.mvp.badge')}</Text>
            </View>
          )}

          {/* OVR / progress zone (top-left) */}
          {ovrStyle !== undefined ? (
            <Animated.View style={[styles.ovrZone, ovrStyle]}>
              {isUnlocked && ovrScore !== null && (
                <Text
                  style={styles.ovrNumber}
                  accessible
                  accessibilityLabel={`OVR ${ovrScore}`}
                >
                  {ovrScore}
                </Text>
              )}

              {isUnlocked && trend === 'up' && (
                <Text style={styles.trendIndicator}>{t('card.trend.inForm')}</Text>
              )}

              {isNotStarted && (
                <Text style={styles.ovrDash}>—</Text>
              )}

              {isInProgress && (
                <ProgressBarPill matchCount={matchCount} cardState={cardState} />
              )}
            </Animated.View>
          ) : (
            <View style={styles.ovrZone}>
              {isUnlocked && ovrScore !== null && (
                <Text
                  style={styles.ovrNumber}
                  accessible
                  accessibilityLabel={`OVR ${ovrScore}`}
                >
                  {ovrScore}
                </Text>
              )}

              {isUnlocked && trend === 'up' && (
                <Text style={styles.trendIndicator}>{t('card.trend.inForm')}</Text>
              )}

              {isNotStarted && (
                <Text style={styles.ovrDash}>—</Text>
              )}

              {isInProgress && (
                <ProgressBarPill matchCount={matchCount} cardState={cardState} />
              )}
            </View>
          )}
        </View>

        {/* Name band */}
        <View style={styles.nameBand}>
          <Text style={styles.nameText} numberOfLines={1}>
            {displayName.toUpperCase()}
          </Text>
        </View>

        {/* Group strip */}
        <View style={styles.groupStrip}>
          <Text style={styles.groupStripText} numberOfLines={1}>
            {groupName ? groupName.toUpperCase() : ''}
          </Text>
        </View>

        {/* Stats zone — radar left + attribute list right */}
        <View style={styles.statsZone}>
          <AttributeRadar attributes={isNotStarted ? null : attributes} width={90} height={90} />
          {attributes && !isNotStarted ? (
            <View style={styles.attrList}>
              {ATTR_LABELS.map(({ key, label }) => (
                <View key={key} style={styles.attrRow}>
                  <Text style={styles.attrLabel}>{label}</Text>
                  <Text style={styles.attrValue}>{Math.round(attributes[key])}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.attrListSkeleton} />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{matchCountLabel}</Text>
        </View>

      </View>
    </View>
  )
}

const CARD_WIDTH = 252

const styles = StyleSheet.create({
  cardShadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.70,
    shadowRadius: 30,
    elevation: 10,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.60,
    shadowRadius: 1,
    elevation: 4,
  },
  topBand: {
    height: 28,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  topBandText: {
    color: Colors.ink,
    fontSize: 9,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 0.5,
    flex: 1,
  },
  topBandTier: {
    color: Colors.ink,
    fontSize: 9,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 0.5,
  },
  photoZone: {
    height: 200,
    backgroundColor: Colors.bg,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 2,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.inkSecondary,
    fontSize: 28,
    fontFamily: 'BebasNeue_400Regular',
  },
  mvpBadge: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.50)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mvpBadgeText: {
    color: Colors.gold,
    fontSize: 13,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 2,
  },
  positionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 0,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  positionBadgeText: {
    color: Colors.ink,
    fontSize: 13,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 2,
  },
  ovrZone: {
    position: 'absolute',
    top: 8,
    left: 8,
    minWidth: 80,
  },
  ovrNumber: {
    color: Colors.gold,
    fontSize: 76,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: -3,
    lineHeight: 67,
  },
  trendIndicator: {
    color: Colors.success,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  ovrDash: {
    color: Colors.inkDisabled,
    fontSize: 40,
    fontFamily: 'BebasNeue_400Regular',
    lineHeight: 44,
  },
  nameBand: {
    height: 36,
    backgroundColor: Colors.surface,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  nameText: {
    color: Colors.ink,
    fontSize: 20,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 6,
  },
  groupStrip: {
    height: 18,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  groupStripText: {
    color: Colors.inkDisabled,
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statsZone: {
    backgroundColor: Colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 94,
  },
  attrList: {
    flex: 1,
    paddingLeft: 8,
    justifyContent: 'center',
    gap: 2,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attrLabel: {
    color: Colors.inkDisabled,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  attrValue: {
    color: Colors.ink,
    fontSize: 16,
    fontFamily: 'BebasNeue_400Regular',
  },
  attrListSkeleton: {
    flex: 1,
    marginLeft: 8,
    height: 80,
    backgroundColor: Colors.surfaceRaised,
    opacity: 0.3,
    borderRadius: 2,
  },
  footer: {
    height: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: {
    color: Colors.inkDisabled,
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
})
