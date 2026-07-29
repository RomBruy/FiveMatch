import { View, Text, Image, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, {
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  useReducedMotion,
  interpolate,
  Extrapolation,
  SensorType,
} from 'react-native-reanimated'
import type { AnimatedStyle } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { Gradients, RenderColors } from '../../constants/gradients'
import { Fonts } from '../../constants/tokens'
import { ProgressBarPill } from '../shared/ProgressBarPill'

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
  /** Accepted for contract compatibility — the v3 face carries no tier badge. */
  groupTier?: string
  photoUrl?: string | null
  ovrStyle?: AnimatedStyle<ViewStyle>
  isMvp?: boolean
  /** v3: mini renders the Joueurs-grid face (one-line lockup, no stats grid). */
  variant?: 'full' | 'mini'
  /** Design width — the layout scales from it (export surface for 9.12). */
  width?: number
  /** Group member count for the serial ("Nº 023"). Join order is not derivable
   *  from any card payload (players.id ≠ users.id, no joinedAt on players) —
   *  per AC the serial renders member count only. */
  serialTotal?: number
  /** Story 10.4 — additive, default false. When true (unlocked full face only,
   *  never mini) the card subscribes to the gyroscope and tilts/parallaxes/catches
   *  light. Reduced motion or a sensor returning zeros collapses to the static face,
   *  pixel-identical to today. */
  interactive?: boolean
}

const DESIGN_WIDTH = 272

// The coach's-marker scribble — the card's ONE decorative element.
// Path authored in docs/design-v2/fivematch-design-v2.html (extracted verbatim).
const SCRIBBLE_PATH =
  'M36,148 C12,92 58,26 122,32 C192,40 224,88 202,128 C182,166 92,178 62,148 C38,124 72,66 132,62'
const SCRIBBLE_VIEWBOX = '0 0 240 190'

// Bone paper ground (unlocked) and duotone silhouette palettes.
const PAPER_GRADIENT = Gradients.paperCard
const SILHOUETTE = {
  paper: {
    head: Gradients.silhouettePaperHead,
    torso: Gradients.silhouettePaperTorso,
    rim: 'rgba(212,45,34,0.30)',
  },
  dark: {
    head: Gradients.silhouetteDarkHead,
    torso: Gradients.silhouetteDarkTorso,
    rim: 'rgba(255,110,95,0.22)',
  },
}

const ATTRS: Array<{ key: keyof NonNullable<PaniniCardPlayer['attributes']>; labelKey: string }> = [
  { key: 'pace', labelKey: 'card.attr.pace' },
  { key: 'technique', labelKey: 'card.attr.technique' },
  { key: 'passing', labelKey: 'card.attr.passing' },
  { key: 'defending', labelKey: 'card.attr.defending' },
  { key: 'physicality', labelKey: 'card.attr.physicality' },
  { key: 'effort', labelKey: 'card.attr.effort' },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function padSerial(n: number): string {
  return String(n).padStart(3, '0')
}

/** Duotone cutout silhouette — head + torso gradients with a red rim-light
 *  approximation (RN has no inset shadows; an offset tinted backing carries the rim). */
function Silhouette({ scale, palette }: { scale: number; palette: 'paper' | 'dark' }) {
  const p = SILHOUETTE[palette]
  const headSize = 52 * scale
  const torsoW = 140 * scale
  const torsoH = 112 * scale
  const torsoRadius = 60 * scale

  return (
    <View style={{ width: torsoW, alignItems: 'center' }} pointerEvents="none">
      <View
        style={{
          width: headSize + 2,
          height: headSize + 2,
          borderRadius: (headSize + 2) / 2,
          backgroundColor: p.rim,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <LinearGradient
          colors={p.head}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ width: headSize, height: headSize, borderRadius: headSize / 2 }}
        />
      </View>
      <View
        style={{
          width: torsoW + 2,
          borderTopLeftRadius: torsoRadius + 2,
          borderTopRightRadius: torsoRadius + 2,
          borderBottomLeftRadius: 12 * scale,
          borderBottomRightRadius: 12 * scale,
          backgroundColor: p.rim,
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginTop: 4 * scale,
        }}
      >
        <LinearGradient
          colors={p.torso}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{
            width: torsoW,
            height: torsoH,
            borderTopLeftRadius: torsoRadius,
            borderTopRightRadius: torsoRadius,
            borderBottomLeftRadius: 12 * scale,
            borderBottomRightRadius: 12 * scale,
            marginTop: 2,
          }}
        />
      </View>
    </View>
  )
}

function Scribble({ width, height, strokeWidth }: { width: number; height: number; strokeWidth: number }) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={SCRIBBLE_VIEWBOX}
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Path
        d={SCRIBBLE_PATH}
        fill="none"
        stroke={Colors.paperRed}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={0.8}
      />
    </Svg>
  )
}

function PhotoCutout({
  photoUrl,
  palette,
  scale,
}: {
  photoUrl?: string | null
  palette: 'paper' | 'dark'
  scale: number
}) {
  if (!photoUrl) return <Silhouette scale={scale} palette={palette} />
  return (
    <View style={{ width: 150 * scale, height: 170 * scale, overflow: 'hidden' }}>
      <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Duotone approximation: production photo treatment is a render pipeline
          (DESIGN-PROCESS.md assumption 4) — a tint overlay carries it here. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,18,0.18)' }]} />
    </View>
  )
}

/* ---------- Story 10.4 — living-card tilt ---------- */

// Physical tilt (radians, relative to the pose captured at mount) that maps to the
// full ±TILT_MAX_DEG deflection. ~0.6 rad ≈ 34° of wrist movement. Sensitivity and
// range are the two device-pass tuning knobs (see AC 6 outstanding item).
const TILT_MAX_DEG = 10
const TILT_SENSITIVITY = 2.2
const TILT_RANGE_RAD = 0.6
// Per-layer parallax travel (px at full deflection). Distinct multipliers give the
// duotone cutout (front), name/OVR lockup (mid) and scribble (back) separate planes.
const PARALLAX = { cutout: 12, lockup: 7, scribble: 4 }
// Sheen: a single low-alpha white band that sweeps the paper and fades to 0 at rest.
const SHEEN_MAX_OPACITY = 0.16
const SHEEN_TRAVEL = 60

interface TiltStyles {
  root: AnimatedStyle<ViewStyle>
  cutout: AnimatedStyle<ViewStyle>
  scribble: AnimatedStyle<ViewStyle>
  lockup: AnimatedStyle<ViewStyle>
  sheen: AnimatedStyle<ViewStyle>
}

/** Owns the gyroscope subscription. Only ever mounted for an interactive, non-reduced
 *  unlocked full card, so the sensor is never subscribed on the static path. On the
 *  simulator (zeroed sensor) the baseline is 0 and every derived value stays 0 → no
 *  jitter, static render. Reanimated tears the subscription down on unmount. */
function useCardTilt(): TiltStyles {
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 })
  const basePitch = useSharedValue<number | null>(null)
  const baseRoll = useSharedValue<number | null>(null)

  // Normalized, clamped tilt in [-1, 1]; 0 at rest (baseline = first sample's pose).
  const pitchN = useDerivedValue(() => {
    const { pitch } = sensor.sensor.value
    if (basePitch.value === null) basePitch.value = pitch
    const d = (pitch - basePitch.value) * TILT_SENSITIVITY
    return interpolate(d, [-TILT_RANGE_RAD, TILT_RANGE_RAD], [-1, 1], Extrapolation.CLAMP)
  })
  const rollN = useDerivedValue(() => {
    const { roll } = sensor.sensor.value
    if (baseRoll.value === null) baseRoll.value = roll
    const d = (roll - baseRoll.value) * TILT_SENSITIVITY
    return interpolate(d, [-TILT_RANGE_RAD, TILT_RANGE_RAD], [-1, 1], Extrapolation.CLAMP)
  })

  const root = useAnimatedStyle(() => ({
    // perspective MUST be the first transform for rotateX/rotateY to read as 3D.
    transform: [
      { perspective: 900 },
      { rotateX: `${-pitchN.value * TILT_MAX_DEG}deg` },
      { rotateY: `${rollN.value * TILT_MAX_DEG}deg` },
    ],
  }))
  const cutout = useAnimatedStyle(() => ({
    transform: [
      { translateX: rollN.value * PARALLAX.cutout },
      { translateY: pitchN.value * PARALLAX.cutout },
    ],
  }))
  const lockup = useAnimatedStyle(() => ({
    transform: [
      { translateX: rollN.value * PARALLAX.lockup },
      { translateY: pitchN.value * PARALLAX.lockup },
    ],
  }))
  const scribble = useAnimatedStyle(() => ({
    transform: [
      { translateX: rollN.value * PARALLAX.scribble },
      { translateY: pitchN.value * PARALLAX.scribble },
    ],
  }))
  const sheen = useAnimatedStyle(() => {
    const mag = Math.min(1, Math.hypot(rollN.value, pitchN.value))
    return {
      opacity: mag * SHEEN_MAX_OPACITY,
      transform: [
        { translateX: rollN.value * SHEEN_TRAVEL },
        { translateY: pitchN.value * SHEEN_TRAVEL },
      ],
    }
  })

  return { root, cutout, scribble, lockup, sheen }
}

interface UnlockedBodyProps {
  s: number
  width: number
  groupLabel: string
  crestInitials: string
  initials: string
  ovrScore: number | null
  ovrLabel: string
  ovrStyle?: AnimatedStyle<ViewStyle>
  displayName: string
  matchCountLabel: string
  isMvp?: boolean
  mvpLabel: string
  serialText: string
  appName: string
  attributes: PaniniCardPlayer['attributes']
  attrItems: Array<{ key: keyof NonNullable<PaniniCardPlayer['attributes']>; label: string }>
  photoUrl?: string | null
  /** Present only on the interactive path; absent → static, layout pixel-identical. */
  tilt?: TiltStyles
}

/** L'Éditoriale bone unlocked face — single source of truth for both the static and
 *  interactive renders. Without `tilt` the Animated.Views carry no animated style and
 *  the output matches the pre-10.4 card exactly. */
function UnlockedFaceBody({
  s,
  width,
  groupLabel,
  crestInitials,
  initials,
  ovrScore,
  ovrLabel,
  ovrStyle,
  displayName,
  matchCountLabel,
  isMvp,
  mvpLabel,
  serialText,
  appName,
  attributes,
  attrItems,
  photoUrl,
  tilt,
}: UnlockedBodyProps) {
  return (
    <Animated.View style={[styles.cardShadow, tilt?.root]}>
      <LinearGradient
        colors={PAPER_GRADIENT}
        start={{ x: 0.55, y: 0 }}
        end={{ x: 0.45, y: 1 }}
        style={[styles.card, { width, padding: 18 * s, paddingBottom: 14 * s }]}
      >
        {/* TOP — group lockup + crest monogram */}
        <View style={styles.topRow}>
          <Text style={[styles.topText, { fontSize: 8.5 * s, letterSpacing: 1.87 * s }]} numberOfLines={1}>
            {groupLabel}
          </Text>
          <View style={[styles.crest, { width: 22 * s, height: 22 * s, borderRadius: 11 * s }]}>
            <Text style={[styles.crestText, { fontSize: 9 * s }]}>{crestInitials}</Text>
          </View>
        </View>

        {/* NAME lockup — initials + red period, then the OVR (the number you earn) */}
        <Animated.View style={[styles.lockup, { marginTop: 14 * s }, tilt?.lockup]}>
          <Text style={[styles.lockupText, { fontSize: 72 * s, lineHeight: 61 * s }]}>
            {initials}
            <Text style={styles.red}>.</Text>
          </Text>
          {ovrScore !== null && (
            <Animated.View
              style={[styles.ovrRow, ovrStyle]}
              accessible
              accessibilityLabel={`OVR ${ovrScore}`}
            >
              <Text style={[styles.lockupText, styles.red, { fontSize: 72 * s, lineHeight: 61 * s }]}>
                {ovrScore}
              </Text>
              <Text style={[styles.ovrMicroLabel, { fontSize: 9 * s, letterSpacing: 2.52 * s, marginLeft: 8 * s }]}>
                {ovrLabel}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* META column — the only place the complete name appears; no OVR line, no gold on paper */}
        <View style={[styles.meta, { top: 118 * s, right: 18 * s }]}>
          <Text style={[styles.metaName, { fontSize: 9 * s, lineHeight: 18 * s, letterSpacing: 1.26 * s }]} numberOfLines={1}>
            {displayName.toUpperCase()}
          </Text>
          <Text style={[styles.metaLine, { fontSize: 9 * s, lineHeight: 18 * s, letterSpacing: 1.26 * s }]}>
            {matchCountLabel}
          </Text>
          {isMvp === true && (
            <Text style={[styles.metaMvp, { fontSize: 9 * s, lineHeight: 18 * s, letterSpacing: 1.26 * s }]}>
              {mvpLabel}
            </Text>
          )}
        </View>

        {/* PHOTO — duotone cutout over the coach's-marker scribble */}
        <View style={[styles.photoZone, { height: 178 * s, marginTop: -10 * s }]}>
          <Animated.View style={[styles.scribble, { left: 10 * s, top: -6 * s }, tilt?.scribble]}>
            <Scribble width={width - 56 * s} height={190 * s} strokeWidth={7} />
          </Animated.View>
          <Animated.View style={tilt?.cutout}>
            <PhotoCutout photoUrl={photoUrl} palette="paper" scale={s} />
          </Animated.View>
        </View>

        {/* STATS — the system's progress language on paper */}
        {attributes && (
          <View style={[styles.statsGrid, styles.statsRule, { paddingTop: 10 * s }]}>
            {attrItems.map(({ key, label }) => {
              const value = Math.round(attributes[key])
              return (
                <View key={key} style={styles.statCell}>
                  <View style={styles.statHead}>
                    <Text style={[styles.statLabel, { fontSize: 8 * s, letterSpacing: 0.96 * s }]}>
                      {label}
                    </Text>
                    <Text style={[styles.statValue, { fontSize: 12 * s }]}>{value}</Text>
                  </View>
                  <View style={[styles.statTrack, { height: 2.5 * s }]}>
                    <View style={[styles.statFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* SERIAL */}
        <View style={[styles.serialRow, { marginTop: 10 * s }]}>
          <Text style={[styles.serialText, { fontSize: 7.5 * s, letterSpacing: 1.5 * s }]}>
            {appName}
          </Text>
          <Text style={[styles.serialText, { fontSize: 7.5 * s, letterSpacing: 1.5 * s }]}>{serialText}</Text>
        </View>

        {/* LIGHT — the card's single light response; clipped by the card's overflow */}
        {tilt && (
          <Animated.View pointerEvents="none" style={[styles.sheen, tilt.sheen]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </LinearGradient>
    </Animated.View>
  )
}

/** Interactive wrapper — isolates the sensor hook so it mounts (and subscribes) only
 *  on the tilt path. */
function InteractiveUnlockedFace(props: UnlockedBodyProps) {
  const tilt = useCardTilt()
  return <UnlockedFaceBody {...props} tilt={tilt} />
}

export function PaniniCard({
  player,
  groupName,
  photoUrl,
  ovrStyle,
  isMvp,
  variant = 'full',
  width = DESIGN_WIDTH,
  serialTotal,
  interactive = false,
}: PaniniCardProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const { cardState, matchCount, ovrScore, attributes, displayName, trend } = player

  const isUnlocked = cardState === 'unlocked'
  const isNotStarted = cardState === 'not_started'
  const isInProgress = cardState === 'in_progress_1' || cardState === 'in_progress_2' || cardState === 'in_progress_3'

  const matchCountLabel =
    matchCount === 1
      ? t('card.footer.matchCount_one', { count: matchCount })
      : t('card.footer.matchCount_other', { count: matchCount })

  const groupLabel = (groupName ?? t('app.name')).toUpperCase()
  const crestInitials = getInitials(groupName ?? t('app.name'))
  const initials = getInitials(displayName)
  const serialText = serialTotal !== undefined ? `Nº ${padSerial(serialTotal)}` : ''

  /* ---------- MINI — Joueurs grid face ---------- */

  if (variant === 'mini') {
    if (!isUnlocked) {
      // Locked slot stays dark: earned = material change to bone. Progress, never exclusion.
      return (
        <View
          style={[styles.miniLockSlot, { width }]}
          accessible
          accessibilityLabel={`${displayName}. ${isNotStarted ? '—' : t('card.locked.lockHint')}`}
        >
          {isNotStarted ? (
            <Text style={styles.miniLockDash}>—</Text>
          ) : (
            <ProgressBarPill matchCount={matchCount} cardState={cardState} />
          )}
          <Text style={styles.miniLockName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.miniShadow}>
        <LinearGradient
          colors={PAPER_GRADIENT}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={[styles.mini, { width }]}
        >
          <View style={styles.topRow}>
            <Text style={styles.miniTopText} numberOfLines={1}>
              {groupLabel}
            </Text>
            <View style={styles.miniCrest}>
              <Text style={styles.miniCrestText}>{crestInitials}</Text>
            </View>
          </View>

          <View style={styles.miniLockup}>
            <Text style={styles.miniLockupText}>
              {initials}
              <Text style={styles.red}>.</Text>
            </Text>
            {ovrScore !== null && (
              <View
                style={styles.miniOvrRow}
                accessible
                accessibilityLabel={`OVR ${ovrScore}`}
              >
                <Text style={[styles.miniLockupText, styles.red]}> {ovrScore}</Text>
                <Text style={styles.miniOvrLabel}>{t('card.unlocked.ovrLabel')}</Text>
              </View>
            )}
          </View>

          <View style={styles.miniMeta}>
            <Text style={styles.miniMetaName} numberOfLines={1}>
              {displayName.toUpperCase()}
            </Text>
            {trend === 'up' && <Text style={styles.miniMetaTrend}>{t('card.trend.inForm').toUpperCase()}</Text>}
            {isMvp === true && <Text style={styles.miniMetaMvp}>{t('card.mvp.badge').toUpperCase()}</Text>}
          </View>

          <View style={styles.miniPhoto}>
            <View style={styles.miniScribble}>
              <Scribble width={width - 44} height={104} strokeWidth={8} />
            </View>
            <PhotoCutout photoUrl={photoUrl} palette="paper" scale={0.54} />
          </View>

          <View style={styles.miniSerial}>
            <Text style={styles.miniSerialText}>{serialText || t('app.name').toUpperCase()}</Text>
            <Text style={styles.miniSerialText}>{matchCount} {t('vestiaire.matchesShort')}</Text>
          </View>
        </LinearGradient>
      </View>
    )
  }

  /* ---------- FULL — locked face (dark: earned = material change) ---------- */

  const s = width / DESIGN_WIDTH

  if (!isUnlocked) {
    return (
      <View style={styles.cardShadow}>
        <View style={[styles.darkCard, { width, padding: 18 * s, paddingBottom: 14 * s }]}>
          <View style={styles.topRow}>
            <Text style={[styles.darkTopText, { fontSize: 8.5 * s }]} numberOfLines={1}>
              {groupLabel}
            </Text>
            <View style={[styles.darkCrest, { width: 22 * s, height: 22 * s, borderRadius: 11 * s }]}>
              <Text style={[styles.darkCrestText, { fontSize: 9 * s }]}>{crestInitials}</Text>
            </View>
          </View>

          <Text style={[styles.darkLockupText, { fontSize: 72 * s, lineHeight: 61 * s, marginTop: 14 * s }]}>
            {initials}
            <Text style={styles.darkLockupPeriod}>.</Text>
          </Text>

          {/* Story 2.3 gating, byte-identical: dash when not started, progress language in progress. */}
          <Animated.View style={[{ marginTop: 10 * s, minHeight: 44 * s }, ovrStyle]}>
            {isNotStarted && <Text style={[styles.darkDash, { fontSize: 40 * s, lineHeight: 44 * s }]}>—</Text>}
            {isInProgress && <ProgressBarPill matchCount={matchCount} cardState={cardState} />}
          </Animated.View>

          <View style={[styles.meta, { top: 118 * s, right: 18 * s }]}>
            <Text style={[styles.darkMetaName, { fontSize: 9 * s, lineHeight: 18 * s }]} numberOfLines={1}>
              {displayName.toUpperCase()}
            </Text>
            <Text style={[styles.darkMetaLine, { fontSize: 9 * s, lineHeight: 18 * s }]}>{matchCountLabel}</Text>
          </View>

          <View style={[styles.photoZone, { height: 150 * s }]}>
            <PhotoCutout photoUrl={photoUrl} palette="dark" scale={0.9 * s} />
          </View>

          {attributes && !isNotStarted && (
            <View style={[styles.statsGrid, styles.darkStatsRule, { paddingTop: 10 * s, marginTop: 10 * s }]}>
              {ATTRS.map(({ key, labelKey }) => {
                const value = Math.round(attributes[key])
                return (
                  <View key={key} style={styles.statCell}>
                    <View style={styles.statHead}>
                      <Text style={[styles.darkStatLabel, { fontSize: 8 * s }]}>{t(labelKey)}</Text>
                      <Text style={[styles.darkStatValue, { fontSize: 12 * s }]}>{value}</Text>
                    </View>
                    <View style={[styles.darkStatTrack, { height: 2.5 * s }]}>
                      <View
                        style={[styles.statFillPrimary, { width: `${Math.min(100, Math.max(0, value))}%` }]}
                      />
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          <View style={[styles.serialRow, { marginTop: 10 * s }]}>
            <Text style={[styles.darkSerialText, { fontSize: 7.5 * s }]}>{t('app.name').toUpperCase()}</Text>
            <Text style={[styles.darkSerialText, { fontSize: 7.5 * s }]}>{serialText}</Text>
          </View>
        </View>
      </View>
    )
  }

  /* ---------- FULL — L'Éditoriale (bone unlocked face) ---------- */

  const bodyProps: UnlockedBodyProps = {
    s,
    width,
    groupLabel,
    crestInitials,
    initials,
    ovrScore,
    ovrLabel: t('card.unlocked.ovrLabel'),
    ovrStyle,
    displayName,
    matchCountLabel,
    isMvp,
    mvpLabel: t('card.mvp.badge').toUpperCase(),
    serialText,
    appName: t('app.name').toUpperCase(),
    attributes,
    attrItems: ATTRS.map(({ key, labelKey }) => ({ key, label: t(labelKey) })),
    photoUrl,
  }

  // Tilt is strictly additive: unlocked full face only, and never under reduced motion.
  // The mini face returned above, so `interactive` can never reach the grid.
  const tiltEnabled = interactive === true && variant === 'full' && !reduceMotion

  return tiltEnabled ? (
    <InteractiveUnlockedFace {...bodyProps} />
  ) : (
    <UnlockedFaceBody {...bodyProps} />
  )
}

const styles = StyleSheet.create({
  /* shared */
  cardShadow: {
    shadowColor: RenderColors.shadow,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  red: { color: Colors.paperRed },
  lockup: { zIndex: 2, alignSelf: 'flex-start' },
  lockupText: { fontFamily: Fonts.bebas, color: Colors.paperInk },
  ovrRow: { flexDirection: 'row', alignItems: 'baseline' },
  ovrMicroLabel: { fontFamily: Fonts.interSemiBold, color: Colors.paperInk2 },
  topText: { flex: 1, fontFamily: Fonts.interSemiBold, color: Colors.paperInk2, textTransform: 'uppercase' },
  crest: { backgroundColor: Colors.paperRed, alignItems: 'center', justifyContent: 'center' },
  crestText: { fontFamily: Fonts.bebas, color: Colors.onPrimary },
  meta: { position: 'absolute', alignItems: 'flex-end', zIndex: 2 },
  metaName: { fontFamily: Fonts.interSemiBold, color: Colors.paperInk, textTransform: 'uppercase' },
  metaLine: { fontFamily: Fonts.interSemiBold, color: Colors.paperInk2, textTransform: 'uppercase' },
  metaMvp: { fontFamily: Fonts.interSemiBold, color: Colors.paperRed, textTransform: 'uppercase' },
  photoZone: { alignItems: 'center', justifyContent: 'flex-end', zIndex: 1 },
  scribble: { position: 'absolute', zIndex: 0 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 8,
    zIndex: 2,
  },
  statsRule: { borderTopWidth: 1.5, borderTopColor: Colors.paperInk },
  statCell: { flexBasis: '28%', flexGrow: 1 },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statLabel: { fontFamily: Fonts.interSemiBold, color: Colors.paperInk2, textTransform: 'uppercase' },
  statValue: { fontFamily: Fonts.bebas, color: Colors.paperInk },
  statTrack: { borderRadius: 2, backgroundColor: Colors.paperDot, overflow: 'hidden', marginTop: 3 },
  statFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.paperRed },
  statFillPrimary: { height: '100%', borderRadius: 2, backgroundColor: Colors.primary },
  serialRow: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  serialText: { fontFamily: Fonts.interSemiBold, color: Colors.paperInk2, textTransform: 'uppercase' },
  // Story 10.4 — light sheen: a single diagonal white band, oversized so it can sweep
  // across the paper on tilt while staying clipped by the card's overflow:'hidden'.
  sheen: {
    position: 'absolute',
    top: -SHEEN_TRAVEL,
    left: -SHEEN_TRAVEL,
    right: -SHEEN_TRAVEL,
    bottom: -SHEEN_TRAVEL,
    zIndex: 3,
  },

  /* dark locked face */
  darkCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
  },
  darkTopText: {
    flex: 1,
    fontFamily: Fonts.interSemiBold,
    color: Colors.inkDisabled,
    textTransform: 'uppercase',
    letterSpacing: 1.87,
  },
  darkCrest: { backgroundColor: Colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  darkCrestText: { fontFamily: Fonts.bebas, color: Colors.inkSecondary },
  darkLockupText: { fontFamily: Fonts.bebas, color: Colors.inkSecondary },
  darkLockupPeriod: { color: Colors.primary },
  darkDash: { fontFamily: Fonts.bebas, color: Colors.inkDisabled },
  darkMetaName: { fontFamily: Fonts.interSemiBold, color: Colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 1.26 },
  darkMetaLine: { fontFamily: Fonts.interSemiBold, color: Colors.inkDisabled, textTransform: 'uppercase', letterSpacing: 1.26 },
  darkStatsRule: { borderTopWidth: 1.5, borderTopColor: Colors.line },
  darkStatLabel: { fontFamily: Fonts.interSemiBold, color: Colors.inkDisabled, textTransform: 'uppercase', letterSpacing: 0.96 },
  darkStatValue: { fontFamily: Fonts.bebas, color: Colors.inkSecondary },
  darkStatTrack: { borderRadius: 2, backgroundColor: Colors.surfaceRaised, overflow: 'hidden', marginTop: 3 },
  darkSerialText: { fontFamily: Fonts.interSemiBold, color: Colors.inkDisabled, textTransform: 'uppercase', letterSpacing: 1.5 },

  /* mini — bone face */
  miniShadow: {
    shadowColor: RenderColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  mini: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  miniTopText: {
    flex: 1,
    fontFamily: Fonts.interSemiBold,
    fontSize: 7,
    letterSpacing: 1.12, // 0.16em @ 7
    color: Colors.paperInk2,
    textTransform: 'uppercase',
  },
  miniCrest: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.paperRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCrestText: { fontFamily: Fonts.bebas, fontSize: 7, color: Colors.onPrimary },
  miniLockup: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6, zIndex: 2 },
  miniLockupText: { fontFamily: Fonts.bebas, fontSize: 42, lineHeight: 38, color: Colors.paperInk },
  miniOvrRow: { flexDirection: 'row', alignItems: 'baseline' },
  miniOvrLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 6,
    letterSpacing: 1.2, // 0.2em @ 6
    color: Colors.paperInk2,
    marginLeft: 5,
  },
  miniMeta: { position: 'absolute', top: 44, right: 12, alignItems: 'flex-end', zIndex: 2 },
  miniMetaName: {
    maxWidth: 90,
    fontFamily: Fonts.interSemiBold,
    fontSize: 7.5,
    lineHeight: 13.5,
    letterSpacing: 1.05,
    color: Colors.paperInk,
  },
  miniMetaTrend: { fontFamily: Fonts.interSemiBold, fontSize: 7.5, lineHeight: 13.5, letterSpacing: 1.05, color: Colors.success },
  miniMetaMvp: { fontFamily: Fonts.interSemiBold, fontSize: 7.5, lineHeight: 13.5, letterSpacing: 1.05, color: Colors.paperRed },
  miniPhoto: { height: 100, marginTop: -4, alignItems: 'center', justifyContent: 'flex-end', zIndex: 1 },
  miniScribble: { position: 'absolute', left: 10, top: -4, zIndex: 0 },
  miniSerial: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: Colors.paperInk,
    zIndex: 2,
  },
  miniSerialText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 7.5,
    letterSpacing: 1.5, // 0.2em @ 7.5
    color: Colors.paperInk2,
    textTransform: 'uppercase',
  },

  /* mini — dark locked slot */
  miniLockSlot: {
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.line,
    padding: 16,
    gap: 10,
    justifyContent: 'center',
    minHeight: 200,
  },
  miniLockDash: { fontFamily: Fonts.bebas, fontSize: 30, color: Colors.inkDisabled, letterSpacing: 2.4 },
  miniLockName: { fontFamily: Fonts.interSemiBold, fontSize: 11.5, lineHeight: 16, color: Colors.inkSecondary },
})
