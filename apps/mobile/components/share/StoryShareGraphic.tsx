import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { StoryEmber } from '../../constants/gradients'
import { Fonts } from '../../constants/tokens'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { TextureType } from '../ui/TextureType'

/** 9:16 story portrait — capture with view-shot {width: 1080, height: 1920}. */
export const STORY_EXPORT_WIDTH = 360
export const STORY_EXPORT_HEIGHT = 640

// Design units are the spec's frame (250×444) — everything scales from it.
const DESIGN_W = 250
const S = STORY_EXPORT_WIDTH / DESIGN_W

// Marker circle around the MVP name — the frame's ONE decorative element.
// Path extracted verbatim from the share frame in fivematch-design-v2.html.
const MARKER_PATH = 'M14,44 C46,10 178,4 206,24 C182,52 62,60 24,46'
const MARKER_VIEWBOX = '0 0 220 60'

interface StoryShareGraphicProps {
  groupName: string
  /** Caller-formatted, e.g. "MER 8 JAN". */
  dateLabel: string
  scoreA: number | null
  scoreB: number | null
  mvpDisplayName: string | null
  /** Stat strip renders whichever of these the payloads expose. */
  goals?: number | null
  assists?: number | null
  /** Gold — the frame's single gold. */
  ovrScore?: number | null
}

/**
 * Story share graphic (résultat & MVP, 1080×1920) — dark ember radial ground,
 * outline "MVP" watermark, Bebas 92 score, marker-circled MVP name, stat strip,
 * wordmark footer. Rendered off-screen and captured at exact pixel dimensions.
 */
export function StoryShareGraphic({
  groupName,
  dateLabel,
  scoreA,
  scoreB,
  mvpDisplayName,
  goals,
  assists,
  ovrScore,
}: StoryShareGraphicProps) {
  const { t } = useTranslation()
  const score = scoreA !== null && scoreB !== null ? `${scoreA}–${scoreB}` : '—'

  const stats: Array<{ value: string; label: string; gold?: boolean }> = []
  if (goals !== null && goals !== undefined) {
    stats.push({ value: String(goals), label: t('match.result.goalsLabel') })
  }
  if (assists !== null && assists !== undefined) {
    stats.push({ value: String(assists), label: t('match.result.assistsLabel') })
  }
  if (ovrScore !== null && ovrScore !== undefined) {
    stats.push({ value: String(ovrScore), label: t('card.unlocked.ovrLabel'), gold: true })
  }

  return (
    <View style={styles.frame}>
      {/* Dark ember radial ground */}
      <Svg width={STORY_EXPORT_WIDTH} height={STORY_EXPORT_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ember" cx="50%" cy="0%" rx="150%" ry="110%">
            <Stop offset="0%" stopColor={StoryEmber.center} />
            <Stop offset="52%" stopColor={StoryEmber.mid} />
            <Stop offset="100%" stopColor={StoryEmber.edge} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ember)" />
      </Svg>

      {/* Outline "MVP" watermark — texture, never content */}
      <TextureType
        lines={[{ text: t('accueil.ceremony.mvpLine') }]}
        fontSize={150 * S}
        style={styles.watermark}
      />

      <View style={styles.content}>
        <DuotoneAvatar displayName={groupName} size={34 * S} />
        <Text style={styles.capsLabel}>
          {groupName.toUpperCase()} · {dateLabel.toUpperCase()}
        </Text>

        <Text style={styles.score} accessible accessibilityLabel={score}>
          {score}
        </Text>

        {mvpDisplayName && (
          <>
            <Text style={[styles.capsLabel, styles.mvpLabel]}>{t('share.story.mvpLabel').toUpperCase()}</Text>
            <View style={styles.mvpBlock}>
              <Text style={styles.mvpName} numberOfLines={1}>
                {mvpDisplayName.toUpperCase()}
              </Text>
              <Svg
                width={220 * S}
                height={60 * S}
                viewBox={MARKER_VIEWBOX}
                preserveAspectRatio="none"
                style={styles.marker}
                pointerEvents="none"
              >
                <Path
                  d={MARKER_PATH}
                  fill="none"
                  stroke={Colors.primary}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
          </>
        )}

        {stats.length > 0 && (
          <View style={styles.statStrip}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCell}>
                <Text style={[styles.statValue, stat.gold && styles.statValueGold]}>{stat.value}</Text>
                <Text style={styles.capsLabel}>{stat.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.wordmark}>
            {t('app.name').toUpperCase()}
            <Text style={styles.wordmarkDot}>.</Text>
          </Text>
          <Text style={styles.footerUrl}>{t('share.story.footerUrl')}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: STORY_EXPORT_WIDTH,
    height: STORY_EXPORT_HEIGHT,
    overflow: 'hidden',
    backgroundColor: StoryEmber.edge,
  },
  watermark: {
    top: 114 * S,
    left: -24 * S,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 44 * S,
    paddingHorizontal: 18 * S,
    paddingBottom: 22 * S,
    gap: 10 * S,
  },
  capsLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9 * S,
    lineHeight: 13.5 * S,
    letterSpacing: 2.34 * S, // 0.26em @ 9
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
    textAlign: 'center',
  },
  score: {
    fontFamily: Fonts.bebas,
    fontSize: 92 * S,
    lineHeight: 88 * S,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
    marginTop: 8 * S,
  },
  mvpLabel: {
    color: Colors.primary,
    marginTop: 6 * S,
  },
  mvpBlock: {
    paddingVertical: 8 * S,
    paddingHorizontal: 10 * S,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mvpName: {
    fontFamily: Fonts.bebas,
    fontSize: 36 * S,
    letterSpacing: 5.04 * S, // 0.14em @ 36
    color: Colors.ink,
  },
  marker: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
  },
  statStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14 * S,
    marginTop: 14 * S,
  },
  statCell: {
    alignItems: 'center',
    minWidth: 40 * S,
  },
  statValue: {
    fontFamily: Fonts.bebas,
    fontSize: 22 * S,
    color: Colors.ink,
  },
  statValueGold: {
    color: Colors.gold,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 * S,
  },
  wordmark: {
    fontFamily: Fonts.bebas,
    fontSize: 13 * S,
    letterSpacing: 1.04 * S, // 0.08em @ 13
    color: Colors.inkSecondary,
  },
  wordmarkDot: {
    color: Colors.primary,
  },
  footerUrl: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9 * S,
    letterSpacing: 1.8 * S, // 0.2em @ 9
    textTransform: 'uppercase',
    color: Colors.inkDisabled,
  },
})
