import {
  ActivityIndicator,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useEffect, useRef, useState } from 'react'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../constants/colors'
import { Fonts, Motion, MotionEasing, MotionSpring, Radius } from '../constants/tokens'
import { DuotoneAvatar } from './ui/DuotoneAvatar'
import { SecondaryButton } from './ui/SecondaryButton'
import { useReduceMotion } from '../hooks/use-reduce-motion'
import { httpClient } from '../lib/api-client'
import { useGroupContext } from '../contexts/GroupContext'

interface GroupItem {
  id: string
  name: string
  tier: string
  userRole: 'organizer' | 'member'
}

interface Props {
  visible: boolean
  onClose: () => void
}

const DRAG_DISMISS_DISTANCE = 120
const DRAG_DISMISS_VELOCITY = 0.8
const EXIT_DURATION = 240

/**
 * Group switcher — level-3 bottom sheet (raised + blur + hairline, the TabDock
 * surface treatment) with a 320ms spring entrance. Drag the grab zone down or
 * tap the backdrop to dismiss. Public API unchanged: `visible` / `onClose`.
 */
export function GroupSwitcher({ visible, onClose }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const { activeGroupId, setActiveGroupId } = useGroupContext()

  // Modal stays mounted through the exit animation, then unmounts.
  const [rendered, setRendered] = useState(visible)
  const translateY = useSharedValue(windowHeight)
  const sheetOpacity = useSharedValue(1)
  const backdropOpacity = useSharedValue(0)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (visible) {
      // Pre-position before the modal mounts; the entrance runs in Modal.onShow.
      backdropOpacity.value = 0
      if (reduceMotion) {
        translateY.value = 0
        sheetOpacity.value = 0
      } else {
        translateY.value = windowHeight
        sheetOpacity.value = 1
      }
      setRendered(true)
    } else if (rendered) {
      backdropOpacity.value = withTiming(0, { duration: Motion.toggle })
      if (reduceMotion) {
        sheetOpacity.value = withTiming(0, { duration: Motion.toggle }, (finished) => {
          if (finished) runOnJS(setRendered)(false)
        })
      } else {
        translateY.value = withTiming(
          windowHeight,
          { duration: EXIT_DURATION, easing: MotionEasing.out },
          (finished) => {
            if (finished) runOnJS(setRendered)(false)
          },
        )
      }
    }
  }, [visible])

  const handleShow = () => {
    backdropOpacity.value = withTiming(1, { duration: Motion.toggle })
    if (reduceMotion) {
      sheetOpacity.value = withTiming(1, { duration: Motion.toggle })
    } else {
      translateY.value = withSpring(0, MotionSpring.sheet)
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        translateY.value = Math.max(0, g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_DISMISS_DISTANCE || g.vy > DRAG_DISMISS_VELOCITY) {
          onCloseRef.current()
        } else {
          translateY.value = withSpring(0, MotionSpring.sheet)
        }
      },
    }),
  ).current

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'me', 'groups'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: GroupItem[] } }>('/v1/users/me/groups')
      return data.data.items
    },
    enabled: visible,
  })

  const handleSelect = (groupId: string) => {
    setActiveGroupId(groupId)
    router.push(`/(app)/groups/${groupId}`)
    onClose()
  }

  const handleCreateGroup = () => {
    onClose()
    router.push('/(app)/groups/new')
  }

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onShow={handleShow}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('groups.switcher.close')}
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, { maxHeight: windowHeight * 0.7 }, sheetStyle]}>
          {/* Level-3 surface: raised + blur(14) + hairline — the TabDock treatment. */}
          <View style={styles.surface}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tint} />
          </View>

          <View style={styles.grabZone} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t('groups.switcher.title')}</Text>
          </View>

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={data ?? []}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>{t('groups.switcher.noGroups')}</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = item.id === activeGroupId
                return (
                  <Pressable
                    style={styles.groupRow}
                    onPress={() => handleSelect(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <DuotoneAvatar displayName={item.name} size={40} ring={isActive ? 'red' : undefined} />
                    <Text style={styles.groupName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.tierPill}>
                      <Text style={styles.tierPillText}>{t(`groups.home.tier.${item.tier}`)}</Text>
                    </View>
                    {isActive && (
                      <View style={styles.activeTag}>
                        <Ionicons name="checkmark" size={16} color={Colors.primary} />
                        <Text style={styles.activeTagText}>{t('groups.switcher.active')}</Text>
                      </View>
                    )}
                  </Pressable>
                )
              }}
              ListFooterComponent={
                <Pressable style={styles.createRow} onPress={handleCreateGroup} accessibilityRole="button">
                  <View style={styles.createIcon}>
                    <Ionicons name="add" size={20} color={Colors.inkSecondary} />
                  </View>
                  <Text style={styles.createText}>{t('groups.switcher.createGroup')}</Text>
                </Pressable>
              }
            />
          )}

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <SecondaryButton label={t('groups.switcher.close')} onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(38,38,44,0.92)',
  },
  grabZone: {
    paddingTop: 12,
    paddingHorizontal: 22,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: Fonts.bebas,
    fontSize: 26,
    letterSpacing: 2.08, // 0.08em @ 26 (heading register)
    textTransform: 'uppercase',
    color: Colors.ink,
    marginBottom: 6,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
    paddingHorizontal: 22,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  groupName: {
    flex: 1,
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  tierPill: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierPillText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeTagText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.hairline,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    flex: 1,
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
})
