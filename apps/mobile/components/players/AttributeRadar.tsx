import { View } from 'react-native'
import Svg, { Polygon, Text as SvgText, G, Circle } from 'react-native-svg'
import { Colors } from '../../constants/colors'

interface Attributes {
  pace: number
  technique: number
  passing: number
  physicality: number
  defending: number
  effort: number
}

interface AttributeRadarProps {
  attributes: Attributes | null
  size?: number
  width?: number
  height?: number
}

const ATTRS = [
  { key: 'pace' as const, label: 'PAC', angle: -90 },
  { key: 'technique' as const, label: 'TEC', angle: -30 },
  { key: 'passing' as const, label: 'PAS', angle: 30 },
  { key: 'physicality' as const, label: 'PHY', angle: 90 },
  { key: 'defending' as const, label: 'DEF', angle: 150 },
  { key: 'effort' as const, label: 'EFF', angle: 210 },
]

function polarToPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function pointsToString(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

function hexagonPoints(cx: number, cy: number, r: number) {
  return ATTRS.map((a) => polarToPoint(cx, cy, r, a.angle))
}

export function AttributeRadar({ attributes, size = 94, width, height }: AttributeRadarProps) {
  const svgW = width ?? size
  const svgH = height ?? size
  const cx = svgW / 2
  const cy = svgH / 2
  const maxR = Math.min(svgW, svgH) / 2 - 14

  const accessibilityLabel = attributes
    ? ATTRS.map((a) => `${a.label}: ${attributes[a.key].toFixed(1)}`).join(', ')
    : 'Stats not yet available'

  if (!attributes) {
    const outerPoints = hexagonPoints(cx, cy, maxR)
    return (
      <View style={{ width: svgW, height: svgH }}>
        <Svg
          width={svgW}
          height={svgH}
          accessible
          accessibilityLabel="Stats not yet available"
        >
          <Polygon
            points={pointsToString(outerPoints)}
            fill={`rgba(72,72,74,0.15)`}
            stroke={Colors.inkDisabled}
            strokeWidth={0.5}
          />
        </Svg>
      </View>
    )
  }

  const valuePoints = ATTRS.map((a) => {
    const r = (attributes[a.key] / 10) * maxR
    return polarToPoint(cx, cy, r, a.angle)
  })

  const labelR = maxR + 9

  return (
    <View style={{ width: svgW, height: svgH }}>
      <Svg
        width={svgW}
        height={svgH}
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        <G>
          {/* outer reference hexagon */}
          <Polygon
            points={pointsToString(hexagonPoints(cx, cy, maxR))}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          {/* inner guide hexagon */}
          <Polygon
            points={pointsToString(hexagonPoints(cx, cy, maxR * 0.5))}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={0.5}
          />
          <Polygon
            points={pointsToString(valuePoints)}
            fill="rgba(255,59,71,0.18)"
            stroke={Colors.primary}
            strokeWidth={1.5}
          />
          {valuePoints.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.2} fill={Colors.primary} />
          ))}
          {ATTRS.map((a) => {
            const lp = polarToPoint(cx, cy, labelR, a.angle)
            return (
              <SvgText
                key={a.key}
                x={lp.x}
                y={lp.y + 3}
                textAnchor="middle"
                fill={Colors.inkDisabled}
                fontSize={7}
                fontFamily="Inter_600SemiBold"
              >
                {a.label}
              </SvgText>
            )
          })}
        </G>
      </Svg>
    </View>
  )
}
