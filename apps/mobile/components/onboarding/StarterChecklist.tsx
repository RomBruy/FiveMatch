import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { PressableScale } from '../ui/PressableScale'
import { useStarterChecklist } from '../../lib/onboarding'

/**
 * What replaces an empty first week.
 *
 * The tutorial ends and is gone; this stays. It is the part that actually fills
 * the first few days, because a four-step overlay teaches nothing that survives
 * being dismissed.
 *
 * Every box is ticked by real state, never by "you visited the screen" — see
 * useStarterChecklist. That is the difference between a to-do list and a
 * progress bar wearing a costume, and people can tell instantly.
 *
 * Renders nothing once complete: it files itself away rather than sitting there
 * as a finished trophy occupying the best space on the screen.
 */
export function StarterChecklist({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { tasks, doneCount, total, visible, dismiss } = useStarterChecklist()

  if (!visible) return null

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('tutorial.checklist.title').toUpperCase()}</Text>
        <Text style={styles.count}>{t('tutorial.checklist.count', { done: doneCount, total })}</Text>
        <PressableScale onPress={dismiss} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="close" size={16} color={Colors.inkDisabled} />
        </PressableScale>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(doneCount / total) * 100}%` }]} />
      </View>

      {tasks.map((task, index) => (
        <PressableScale
          key={task.id}
          style={[styles.task, index > 0 && styles.taskDivided]}
          onPress={() => router.push(task.route as never)}
          disabled={task.done}
          accessibilityRole="button"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={t(`tutorial.checklist.${task.id}`)}
        >
          <View style={[styles.box, task.done && styles.boxDone]}>
            {task.done && <Ionicons name="checkmark" size={12} color={Colors.bg} />}
          </View>
          <Text style={[styles.label, task.done && styles.labelDone]}>
            {t(`tutorial.checklist.${task.id}`)}
          </Text>
          {!task.done && <Ionicons name="chevron-forward" size={14} color={Colors.primary} />}
        </PressableScale>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 20,
    letterSpacing: 1.2, // 0.06em @ 20 (heading register)
  },
  count: {
    color: Colors.success,
    fontFamily: Fonts.bebas,
    fontSize: 17,
    letterSpacing: 0.68,
  },
  track: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
    marginTop: 11,
    marginBottom: 4,
  },
  fill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.success },
  task: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  taskDivided: { borderTopWidth: 1, borderTopColor: Colors.hairline },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  label: { flex: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13 },
  labelDone: { color: Colors.inkSecondary, textDecorationLine: 'line-through' },
})
