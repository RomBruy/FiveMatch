import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/tokens'
import { PaniniCard } from '../cards/PaniniCard'

/** 4:5 Instagram portrait — capture with view-shot {width: 1080, height: 1350}. */
export const CARD_EXPORT_WIDTH = 360
export const CARD_EXPORT_HEIGHT = 450

interface CardExportPlayer {
  playerId: string
  displayName: string
  cardState: 'not_started' | 'in_progress_1' | 'in_progress_2' | 'in_progress_3' | 'unlocked'
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

interface CardExportProps {
  player: CardExportPlayer
  groupName?: string
  photoUrl?: string | null
  isMvp?: boolean
  serialTotal?: number
  /** Export ground. Default paper per DESIGN-PROCESS.md open question 3. */
  variant?: 'paper' | 'dark'
}

/**
 * Off-screen export frame for the shareable card (1080×1350). The v3 card renders
 * at export scale via its `width` prop; the frame adds the ground and the small
 * FiveMatch wordmark (UX-DR25). Paper is one of the three allowed paper surfaces.
 */
export function CardExport({
  player,
  groupName,
  photoUrl,
  isMvp,
  serialTotal,
  variant = 'paper',
}: CardExportProps) {
  const { t } = useTranslation()
  const isPaper = variant === 'paper'

  return (
    <View style={[styles.frame, { backgroundColor: isPaper ? Colors.paper : Colors.bg }]}>
      <PaniniCard
        player={player}
        groupName={groupName}
        photoUrl={photoUrl}
        isMvp={isMvp}
        serialTotal={serialTotal}
        width={252}
      />
      <Text style={[styles.wordmark, { color: isPaper ? Colors.paperInk2 : Colors.inkDisabled }]}>
        {t('app.name').toUpperCase()}
        <Text style={{ color: isPaper ? Colors.paperRed : Colors.primary }}>.</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: CARD_EXPORT_WIDTH,
    height: CARD_EXPORT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  wordmark: {
    fontFamily: Fonts.bebas,
    fontSize: 13,
    letterSpacing: 1.04, // 0.08em @ 13
  },
})
