import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

export interface TeamPlayer {
  playerId: string | null
  displayName: string | null
  cardState: string
  ovrScore: number | null
}

export interface TeamSwap {
  playerId: string
  fromTeam: 'A' | 'B'
  toTeam: 'A' | 'B'
}

interface TeamDisplayProps {
  teamA: TeamPlayer[]
  teamB: TeamPlayer[]
  fairnessScore: number
  generationCount: number
  stagedSwaps: TeamSwap[]
  onSwap: (playerId: string, currentTeam: 'A' | 'B') => void
  selectedForSwap: { playerId: string; team: 'A' | 'B' } | null
  onRegenerate?: () => void
  isLocked: boolean
}

function getFairnessKey(score: number): string {
  if (score <= 10) return 'match.generate.fairness.excellent'
  if (score <= 20) return 'match.generate.fairness.good'
  return 'match.generate.fairness.adjust'
}

function PlayerRow({
  player,
  currentTeam,
  isSwapped,
  isSelected,
  isLocked,
  onSwap,
}: {
  player: TeamPlayer
  currentTeam: 'A' | 'B'
  isSwapped: boolean
  isSelected: boolean
  isLocked: boolean
  onSwap: (playerId: string, currentTeam: 'A' | 'B') => void
}) {
  const { t } = useTranslation()
  const showOvr = player.cardState === 'unlocked' && player.ovrScore !== null
  return (
    <View style={[styles.playerRow, isSelected && styles.playerRowSelected]}>
      <View style={styles.playerNameBlock}>
        <Text style={styles.playerName} numberOfLines={1}>{player.displayName ?? '—'}</Text>
        {isSwapped && (
          <Text style={styles.adjustedLabel}>{t('match.teamLock.manualAdjusted')}</Text>
        )}
      </View>
      {showOvr && (
        <View style={styles.ovrPill} accessibilityLabel={`OVR ${player.ovrScore}`}>
          <Text style={styles.ovrText}>{player.ovrScore}</Text>
        </View>
      )}
      {!isLocked && player.playerId && (
        <Pressable
          style={styles.swapButton}
          onPress={() => onSwap(player.playerId!, currentTeam)}
          accessibilityRole="button"
          accessibilityLabel={`${t('match.teamLock.swap')} ${player.displayName ?? ''}`}
        >
          <Text style={styles.swapButtonText}>{t('match.teamLock.swap')}</Text>
        </Pressable>
      )}
    </View>
  )
}

export function TeamDisplay({
  teamA,
  teamB,
  fairnessScore,
  generationCount,
  stagedSwaps,
  onSwap,
  selectedForSwap,
  onRegenerate,
  isLocked,
}: TeamDisplayProps) {
  const { t } = useTranslation()
  const fairnessKey = getFairnessKey(fairnessScore)
  const swappedIds = new Set(stagedSwaps.map((s) => s.playerId))

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>{t('match.generate.counter', { n: generationCount })}</Text>
      <Text style={styles.fairness}>{t(fairnessKey)}</Text>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.teamLabel}>{t('match.generate.teamA')}</Text>
          {teamA.map((p, i) => (
            <PlayerRow
              key={p.playerId ?? i}
              player={p}
              currentTeam="A"
              isSwapped={p.playerId !== null && swappedIds.has(p.playerId)}
              isSelected={selectedForSwap?.playerId === p.playerId}
              isLocked={isLocked}
              onSwap={onSwap}
            />
          ))}
        </View>
        <View style={styles.divider} />
        <View style={styles.column}>
          <Text style={styles.teamLabel}>{t('match.generate.teamB')}</Text>
          {teamB.map((p, i) => (
            <PlayerRow
              key={p.playerId ?? i}
              player={p}
              currentTeam="B"
              isSwapped={p.playerId !== null && swappedIds.has(p.playerId)}
              isSelected={selectedForSwap?.playerId === p.playerId}
              isLocked={isLocked}
              onSwap={onSwap}
            />
          ))}
        </View>
      </View>

      {onRegenerate && (
        <Pressable
          style={styles.regenerateButton}
          onPress={onRegenerate}
          accessibilityRole="button"
          accessibilityLabel={t('match.generate.regenerate')}
        >
          <Text style={styles.regenerateButtonText}>{t('match.generate.regenerate')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  counter: {
    color: Colors.inkSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  fairness: {
    color: Colors.ink,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  columns: { flexDirection: 'row' },
  column: { flex: 1, gap: 4 },
  divider: { width: 1, backgroundColor: Colors.inkDisabled, marginHorizontal: 8 },
  teamLabel: {
    color: Colors.inkSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
    paddingVertical: 4,
  },
  playerRowSelected: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 2,
  },
  playerNameBlock: { flex: 1, marginRight: 4 },
  playerName: {
    color: Colors.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  adjustedLabel: {
    color: Colors.inkSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ovrPill: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  ovrText: {
    color: Colors.primary,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 14,
  },
  swapButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.inkDisabled,
    borderRadius: 2,
    marginLeft: 4,
  },
  swapButtonText: {
    color: Colors.inkSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  regenerateButton: {
    borderWidth: 1,
    borderColor: Colors.inkDisabled,
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
    marginHorizontal: 16,
  },
  regenerateButtonText: {
    color: Colors.inkSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
