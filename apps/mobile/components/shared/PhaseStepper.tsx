import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

type MatchStatus =
  | 'planning'
  | 'attendance_open'
  | 'attendance_locked'
  | 'teams_generated'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

interface Step {
  labelKey: string
  statuses: MatchStatus[]
}

const STEPS: Step[] = [
  { labelKey: 'match.phase.planification', statuses: ['planning'] },
  { labelKey: 'match.phase.presences', statuses: ['attendance_open'] },
  { labelKey: 'match.phase.generation', statuses: ['attendance_locked', 'teams_generated'] },
  { labelKey: 'match.phase.inProgress', statuses: ['in_progress'] },
  { labelKey: 'match.phase.completed', statuses: ['completed'] },
]

function statusToStepIndex(status: MatchStatus): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i]!.statuses.includes(status)) return i
  }
  return 0
}

interface PhaseStepperProps {
  status: MatchStatus
}

export function PhaseStepper({ status }: PhaseStepperProps) {
  const { t } = useTranslation()
  const activeIndex = statusToStepIndex(status)

  return (
    <View style={styles.container} accessibilityRole="progressbar">
      {STEPS.map((step, index) => {
        const isDone = index < activeIndex
        const isActive = index === activeIndex
        return (
          <View
            key={step.labelKey}
            style={[styles.pill, isDone && styles.pillDone, isActive && styles.pillActive]}
          >
            <Text
              style={[styles.label, isDone && styles.labelDone, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {isDone ? `✓ ${t(step.labelKey)}` : t(step.labelKey)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    height: 30,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pillDone: {
    backgroundColor: Colors.successSubtle,
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    color: Colors.inkDisabled,
  },
  labelDone: {
    color: Colors.success,
  },
  labelActive: {
    color: Colors.onPrimary,
  },
})
