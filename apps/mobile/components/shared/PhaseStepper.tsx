import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

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
          <View key={step.labelKey} style={styles.stepWrapper}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isActive && styles.dotActive,
                ]}
              />
              {index < STEPS.length - 1 && (
                <View style={[styles.connector, isDone && styles.connectorDone]} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                isActive && styles.labelActive,
                isDone && styles.labelDone,
              ]}
            >
              {t(step.labelKey)}
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.inkDisabled,
    zIndex: 1,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotDone: {
    backgroundColor: Colors.success,
  },
  connector: {
    position: 'absolute',
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: Colors.inkDisabled,
    top: 4,
  },
  connectorDone: {
    backgroundColor: Colors.success,
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    color: Colors.inkDisabled,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  labelDone: {
    color: Colors.inkSecondary,
  },
})
