import type { PropsWithChildren } from 'react'
import { BlurView } from 'expo-blur'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'

interface RaisedBlurSurfaceProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>
}

/** Elevation level 3: raised dark tint, system blur, and a single hairline. */
export function RaisedBlurSurface({ children, style }: RaisedBlurSurfaceProps) {
  return (
    <View style={[styles.surface, style]}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(38,38,44,0.92)',
  },
})
