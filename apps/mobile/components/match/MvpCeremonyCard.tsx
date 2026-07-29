import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Gradients } from '../../constants/gradients'
import { Fonts, Motion, Radius } from '../../constants/tokens'
import { DuotoneAvatar, getInitials } from '../ui/DuotoneAvatar'
import { TextureType } from '../ui/TextureType'
import { CountUpNumber } from '../ui/CountUpNumber'

interface MvpCeremonyCardProps {
  scoreA: number | null
  scoreB: number | null
  mvpDisplayName: string | null
  scheduledAt: string
  onPress: () => void
  /**
   * The card's outline watermark is the screen's texture element ONLY when the
   * crest watermark is absent — never both (one texture per screen).
   */
  watermark?: boolean
  /** Story share entry point (9.12) — renders the share icon when provided. */
  onShare?: () => void
}

// Deep red ceremony gradient — 140deg per spec (#E23A2E→#A8231C→#6E140E).
const GRADIENT_COLORS = Gradients.mvpCeremony
const GRADIENT_LOCATIONS = [0, 0.55, 1] as const
// CSS 140deg direction vector mapped into the unit box.
const GRADIENT_START = { x: 0.18, y: 0.12 }
const GRADIENT_END = { x: 0.82, y: 0.88 }

const WATERMARK_STROKE = 'rgba(255,255,255,0.14)'

/**
 * MVP Ceremony Card — the "Ronaldo-board" treatment for the most recent completed
 * match (design v2, Historique). Pressable → match detail. The share affordance
 * arrives with the export pipeline in 9.12; nothing hidden or disabled here.
 */
export function MvpCeremonyCard({
  scoreA,
  scoreB,
  mvpDisplayName,
  scheduledAt,
  onPress,
  watermark = false,
  onShare,
}: MvpCeremonyCardProps) {
  const { t, i18n } = useTranslation()
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const score = scoreA !== null && scoreB !== null ? `${scoreA}–${scoreB}` : '—'
  const dateLabel = new Date(scheduledAt)
    .toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('accueil.ceremony.label')} — ${mvpDisplayName ?? ''} ${score}`}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: Motion.press })
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: Motion.press })
      }}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <LinearGradient
          colors={GRADIENT_COLORS}
          locations={GRADIENT_LOCATIONS}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
        {watermark && mvpDisplayName && (
          <TextureType
            lines={[{ text: getInitials(mvpDisplayName) }]}
            fontSize={150}
            stroke={WATERMARK_STROKE}
            style={styles.watermark}
          />
        )}
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('accueil.ceremony.label')}</Text>
          {onShare && (
            <Pressable
              onPress={onShare}
              hitSlop={12}
              style={styles.shareButton}
              accessibilityRole="button"
              accessibilityLabel={t('share.story.share')}
            >
              <Ionicons name="share-outline" size={17} color={Colors.onPrimary} />
            </Pressable>
          )}
        </View>
        <View style={styles.row}>
          {mvpDisplayName && (
            <View style={styles.avatarRing}>
              <DuotoneAvatar displayName={mvpDisplayName} size={58} />
            </View>
          )}
          <View style={styles.nameBlock}>
            {mvpDisplayName && (
              <Text style={styles.name} numberOfLines={1}>
                {mvpDisplayName}
              </Text>
            )}
            <View style={styles.mvpLine}>
              <Ionicons name="star" size={14} color={Colors.onPrimary} />
              <Text style={styles.mvpLineText}>{t('accueil.ceremony.mvpLine')}</Text>
            </View>
          </View>
          <View style={styles.scoreBlock}>
            {scoreA !== null && scoreB !== null ? (
              <View style={styles.scoreRow}>
                <CountUpNumber value={scoreA} style={styles.score} />
                <Text style={styles.scoreSeparator}>–</Text>
                <CountUpNumber value={scoreB} style={styles.score} />
              </View>
            ) : <Text style={styles.score}>{score}</Text>}
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: 18,
  },
  watermark: {
    top: -30,
    right: -24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  shareButton: {
    minWidth: 20,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: Colors.onPrimary,
    borderRadius: (58 + 8) / 2,
    padding: 2,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontFamily: Fonts.bebas,
    fontSize: 30,
    letterSpacing: 3, // 0.10em @ 30
    color: Colors.onPrimary,
  },
  mvpLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
  },
  mvpLineText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
  },
  scoreBlock: {
    alignItems: 'flex-end',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  score: {
    fontFamily: Fonts.bebas,
    fontSize: 46,
    lineHeight: 46 * 0.9 + 4,
    color: Colors.onPrimary,
    fontVariant: ['tabular-nums'],
    height: 46,
    minWidth: 22,
  },
  scoreSeparator: {
    fontFamily: Fonts.bebas,
    fontSize: 46,
    lineHeight: 46 * 0.9 + 4,
    color: Colors.onPrimary,
  },
  date: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 0.8, // 0.08em @ 10
    color: 'rgba(255,255,255,0.7)',
  },
})
