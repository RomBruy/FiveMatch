import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Text as SvgText } from 'react-native-svg'
import { Fonts, Type } from '../../constants/tokens'

interface TextureLine {
  text: string
  /** Horizontal stagger of the line inside the canvas. */
  x?: number
}

interface TextureTypeProps {
  lines: readonly TextureLine[]
  /** Texture register: 140–220. */
  fontSize?: number
  /** Position the texture from the caller (absolute top/left). */
  style?: StyleProp<ViewStyle>
  /** Screen-level texture stays ≤6% white; on-gradient watermarks (MVP ceremony card) run at 14%. */
  stroke?: string
}

// RN Text has no stroke — the outline register (transparent fill, 1px stroke ≤6% white) needs SVG text.
const STROKE = 'rgba(255,255,255,0.06)'
const LINE_HEIGHT = 0.92

/**
 * Outline Bebas background texture (`--type-texture`). Never content: hidden from
 * accessibility and touch. Max one texture element per screen — caller's responsibility.
 */
export function TextureType({ lines, fontSize = Type.texture.minSize, style, stroke = STROKE }: TextureTypeProps) {
  const height = lines.length * fontSize * LINE_HEIGHT + fontSize * 0.2
  const width = Math.max(...lines.map((l) => (l.x ?? 0) + l.text.length)) * fontSize * 0.6 + fontSize

  return (
    <View
      style={[styles.container, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        {lines.map((line, i) => (
          <SvgText
            key={`${line.text}-${i}`}
            x={line.x ?? 0}
            y={(i + 1) * fontSize * LINE_HEIGHT}
            fontFamily={Fonts.bebas}
            fontSize={fontSize}
            letterSpacing={Type.texture.letterSpacing}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
          >
            {line.text}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 0,
  },
})
