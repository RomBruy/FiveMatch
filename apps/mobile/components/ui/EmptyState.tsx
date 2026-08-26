import { type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'
import { Radius, Type } from '../../constants/tokens'

interface EmptyStateProps {
  title: string
  body: string
  /** Buttons. Rendered full-width, stacked, primary first. */
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * An empty screen has to teach, not apologise.
 *
 * Every list in the app could be empty on day one, and four of them were the
 * first thing a new user saw — which is why the app "felt empty". The rule this
 * component enforces: name what belongs here, say it in the product's own words,
 * and give exactly one obvious action (a second is allowed only when it changes
 * the query rather than the subject).
 *
 * The dashed border is deliberate: it reads as a placeholder, so the screen
 * looks unfinished-by-data rather than broken.
 */
export function EmptyState({ title, body, children, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      <Text style={styles.body}>{body}</Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  )
}

/**
 * Skeleton rows shown *below* an empty state, under a "what this will look like"
 * label. They are not a loading indicator — they show the shape of the thing
 * that is missing, which is what tells someone the screen works and the world is
 * simply empty. Faded out at the bottom so they never read as real content.
 */
export function EmptyPreview({ rows = 3, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.preview, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.ghost, { opacity: 0.5 - i * 0.14 }]}>
          <View style={styles.ghostNum} />
          <View style={styles.ghostLines}>
            <View style={[styles.ghostLine, { width: `${62 - i * 7}%` }]} />
            <View style={[styles.ghostLine, styles.ghostLineThin, { width: `${84 - i * 9}%` }]} />
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    borderStyle: 'dashed',
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 11,
  },
  title: {
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 24,
    letterSpacing: 1.2, // 0.05em @ 24 (heading register)
  },
  body: {
    color: Colors.inkSecondary,
    fontFamily: Type.body.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
  },
  actions: {
    marginTop: 4,
    gap: 8,
  },
  preview: {
    gap: 9,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 14,
  },
  ghostNum: {
    width: 40,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.surfaceRaised,
  },
  ghostLines: {
    flex: 1,
    gap: 7,
  },
  ghostLine: {
    height: 9,
    borderRadius: 99,
    backgroundColor: Colors.surfaceRaised,
  },
  ghostLineThin: {
    height: 7,
  },
})
