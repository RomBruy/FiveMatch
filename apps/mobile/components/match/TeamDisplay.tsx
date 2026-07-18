import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { TEAM_GEN_MAX_GENERATIONS } from '@fivematch/types/algorithm-constants'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { FairnessRing } from './FairnessRing'

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

/** OVR average over visible scores only (FR-14 gating), 1 decimal; null when no score is visible. */
export function teamOvrAverage(players: TeamPlayer[]): string | null {
  const visible = players.filter((p) => p.cardState === 'unlocked' && p.ovrScore !== null)
  if (visible.length === 0) return null
  const avg = visible.reduce((s, p) => s + p.ovrScore!, 0) / visible.length
  return avg.toFixed(1)
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
  const swappable = !isLocked && player.playerId !== null

  return (
    <Pressable
      style={[styles.playerRow, isSelected && styles.playerRowSelected]}
      disabled={!swappable}
      onPress={() => onSwap(player.playerId!, currentTeam)}
      accessibilityRole={swappable ? 'button' : undefined}
      accessibilityLabel={swappable ? `${t('match.teamLock.swap')} ${player.displayName ?? ''}` : undefined}
      accessibilityState={swappable ? { selected: isSelected } : undefined}
    >
      <DuotoneAvatar displayName={player.displayName ?? '—'} size={24} />
      <View style={styles.playerNameBlock}>
        <Text style={styles.playerName} numberOfLines={1}>{player.displayName ?? '—'}</Text>
        {/* Selection is announced with text + icon, never color alone. */}
        {isSelected && (
          <Text style={styles.selectedLabel}>{t('match.teamLock.swap')}</Text>
        )}
        {!isSelected && isSwapped && (
          <Text style={styles.adjustedLabel}>{t('match.teamLock.manualAdjusted')}</Text>
        )}
      </View>
      {isSelected && (
        <Ionicons name="swap-horizontal" size={14} color={Colors.primary} style={styles.swapIcon} />
      )}
      <View style={[styles.ovrPill, !showOvr && styles.ovrPillMuted]} accessibilityLabel={showOvr ? `OVR ${player.ovrScore}` : undefined}>
        <Text style={[styles.ovrText, !showOvr && styles.ovrTextMuted]}>
          {showOvr ? player.ovrScore : t('match.generate.ovrLocked')}
        </Text>
      </View>
    </Pressable>
  )
}

function TeamCard({
  labelKey,
  players,
  accent,
  currentTeam,
  swappedIds,
  selectedForSwap,
  isLocked,
  onSwap,
}: {
  labelKey: string
  players: TeamPlayer[]
  accent: string
  currentTeam: 'A' | 'B'
  swappedIds: Set<string>
  selectedForSwap: { playerId: string; team: 'A' | 'B' } | null
  isLocked: boolean
  onSwap: (playerId: string, currentTeam: 'A' | 'B') => void
}) {
  const { t } = useTranslation()
  const ovrAvg = teamOvrAverage(players)

  return (
    <View style={[styles.teamCard, { borderTopColor: accent }]}>
      <View style={styles.teamHeader}>
        <Text style={styles.teamName}>{t(labelKey)}</Text>
        <Text style={styles.teamOvr}>{`OVR ${ovrAvg ?? t('match.generate.ovrLocked')}`}</Text>
      </View>
      {players.map((p, i) => (
        <PlayerRow
          key={p.playerId ?? i}
          player={p}
          currentTeam={currentTeam}
          isSwapped={p.playerId !== null && swappedIds.has(p.playerId)}
          isSelected={selectedForSwap?.playerId === p.playerId}
          isLocked={isLocked}
          onSwap={onSwap}
        />
      ))}
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
  const swappedIds = new Set(stagedSwaps.map((s) => s.playerId))

  return (
    <View style={styles.container}>
      <FairnessRing score={fairnessScore} />

      <View style={styles.columns}>
        {/* R7 split: Équipe A carries the red top border, Équipe B the white one. */}
        <TeamCard
          labelKey="match.generate.teamA"
          players={teamA}
          accent={Colors.primary}
          currentTeam="A"
          swappedIds={swappedIds}
          selectedForSwap={selectedForSwap}
          isLocked={isLocked}
          onSwap={onSwap}
        />
        <TeamCard
          labelKey="match.generate.teamB"
          players={teamB}
          accent={Colors.ink}
          currentTeam="B"
          swappedIds={swappedIds}
          selectedForSwap={selectedForSwap}
          isLocked={isLocked}
          onSwap={onSwap}
        />
      </View>

      {onRegenerate ? (
        <Pressable
          style={styles.regeneratePill}
          onPress={onRegenerate}
          accessibilityRole="button"
          accessibilityLabel={`${t('match.generate.regenerate')} ${generationCount}/${TEAM_GEN_MAX_GENERATIONS}`}
        >
          <Ionicons name="refresh" size={15} color={Colors.inkSecondary} />
          <Text style={styles.regenerateLabel}>{t('match.generate.regenerate')}</Text>
          <Text style={styles.regenerateCount}>{`${generationCount}/${TEAM_GEN_MAX_GENERATIONS}`}</Text>
        </Pressable>
      ) : (
        <Text style={styles.counter}>{t('match.generate.counter', { n: generationCount })}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  columns: {
    flexDirection: 'row',
    gap: 12,
  },
  teamCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderTopWidth: 3,
    padding: 12,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  teamName: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 18,
    letterSpacing: 2.16, // 0.12em @ 18 (heading register)
  },
  teamOvr: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.bebas,
    fontSize: 14,
    letterSpacing: 0.56, // 0.04em @ 14 (stat register)
    fontVariant: ['tabular-nums'],
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 4,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: Radius.sm,
  },
  playerRowSelected: {
    borderColor: Colors.primary,
    paddingHorizontal: 4,
  },
  playerNameBlock: {
    flex: 1,
  },
  playerName: {
    color: Colors.ink,
    fontFamily: Fonts.interMedium,
    fontSize: 13,
  },
  selectedLabel: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  adjustedLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interMedium,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  swapIcon: {
    flexShrink: 0,
  },
  ovrPill: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 30,
    alignItems: 'center',
  },
  ovrPillMuted: {
    backgroundColor: Colors.surfaceRaised,
  },
  ovrText: {
    color: Colors.primary,
    fontFamily: Fonts.bebas,
    fontSize: 14,
    letterSpacing: 0.56, // 0.04em @ 14 (stat register)
    fontVariant: ['tabular-nums'],
  },
  ovrTextMuted: {
    color: Colors.inkDisabled,
  },
  regeneratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  regenerateLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  regenerateCount: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 14,
    letterSpacing: 0.56, // 0.04em @ 14 (stat register)
    fontVariant: ['tabular-nums'],
  },
  counter: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.54, // 0.14em @ 11 (label-caps register)
    textTransform: 'uppercase',
    textAlign: 'center',
  },
})
