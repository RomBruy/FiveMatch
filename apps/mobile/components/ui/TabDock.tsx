import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from '../../constants/colors'
import { Motion, MotionSpring, Radius } from '../../constants/tokens'
import { useReduceMotion } from '../../hooks/use-reduce-motion'
import { haptics } from '../../lib/haptics'
import { RaisedBlurSurface } from './RaisedBlurSurface'

/** Bottom padding tab screens need so scrolled content clears the floating dock (height + offset + breathing room). */
export const DOCK_CLEARANCE = 68 + 34 + 16

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'search',
  matches: 'football',
  crew: 'people',
  'pronos/index': 'trending-up',
  'profile/index': 'person',
}

interface DockTabProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  focused: boolean
  reduceMotion: boolean
  onPress: () => void
}

function DockTab({ icon, label, focused, reduceMotion, onPress }: DockTabProps) {
  const circleScale = useSharedValue(focused ? 1 : 0.6)
  const circleOpacity = useSharedValue(focused ? 1 : 0)

  useEffect(() => {
    // Reduced motion: no scale spring, just the icon crossfade
    if (reduceMotion) {
      circleScale.value = 1
      circleOpacity.value = withTiming(focused ? 1 : 0, { duration: Motion.dockActivate })
      return
    }
    if (focused) {
      circleScale.value = 0.6
      circleScale.value = withSpring(1, MotionSpring.sheet)
      circleOpacity.value = withTiming(1, { duration: Motion.dockActivate })
    } else {
      circleOpacity.value = withTiming(0, { duration: Motion.dockActivate })
    }
  }, [focused, reduceMotion, circleScale, circleOpacity])

  const circleStyle = useAnimatedStyle(() => ({
    opacity: circleOpacity.value,
    transform: [{ scale: circleScale.value }],
  }))

  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - circleOpacity.value,
  }))

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={inactiveIconStyle}>
        <Ionicons name={icon} size={22} color={Colors.inkSecondary} />
      </Animated.View>
      <Animated.View style={[styles.activeCircle, circleStyle]}>
        <Ionicons name={icon} size={22} color={Colors.onPrimary} />
      </Animated.View>
    </Pressable>
  )
}

/**
 * Broadcast-grade floating tab dock (design v2, elevation level 3: raised + blur + hairline).
 * Owns the screen's one glow on tab screens — PrimaryButtons there must pass glow={false}.
 */
export function TabDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const dockWidth = Math.min(340, screenWidth - 40)
  const visibleRoutes = state.routes.filter((route) => TAB_ICONS[route.name] !== undefined)

  return (
    <View style={[styles.dock, { bottom: Math.max(insets.bottom, 34), width: dockWidth }]}>
      {/* Surface clips to the pill; tabs render outside it so the active glow isn't cut off */}
      <RaisedBlurSurface style={styles.surface} />
      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key]
        const focused = state.routes[state.index]?.key === route.key
        const label =
          typeof options.title === 'string' ? options.title : route.name

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!focused && !event.defaultPrevented) {
            haptics.selection()
            navigation.navigate(route.name, route.params)
          }
        }

        return (
          <DockTab
            key={route.key}
            icon={TAB_ICONS[route.name] ?? 'ellipse'}
            label={label}
            focused={focused}
            reduceMotion={reduceMotion}
            onPress={onPress}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    alignSelf: 'center',
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
  },
  tab: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
})
