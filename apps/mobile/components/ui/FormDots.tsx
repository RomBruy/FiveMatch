import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/tokens'

export type FormResult = 'W' | 'D' | 'L'

interface FormDotsProps {
  results: FormResult[]
  /** Dot diameter — 28 per spec; rank rows may pass smaller. */
  size?: number
}

const DOT_STYLE: Record<FormResult, { bg: string; letter: string }> = {
  W: { bg: Colors.success, letter: Colors.bg },
  D: { bg: Colors.surfaceRaised, letter: Colors.inkSecondary },
  L: { bg: Colors.primary, letter: Colors.onPrimary },
}

const RESULT_KEY: Record<FormResult, string> = {
  W: 'formDots.win',
  D: 'formDots.draw',
  L: 'formDots.loss',
}

export function FormDots({ results, size = 28 }: FormDotsProps) {
  const { t } = useTranslation()

  if (results.length === 0) return null

  const announcement = results.map((r) => t(RESULT_KEY[r])).join(', ')

  return (
    <View style={styles.row} accessible accessibilityLabel={announcement}>
      {results.map((result, i) => {
        const { bg, letter } = DOT_STYLE[result]
        return (
          <View
            key={`${result}-${i}`}
            style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
          >
            <Text style={[styles.letter, { color: letter, fontSize: size * 0.46 }]}>{result}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: Fonts.interSemiBold,
  },
})
