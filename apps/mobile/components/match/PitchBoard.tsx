import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Rect } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Gradients, RenderColors } from '../../constants/gradients'
import { Fonts, Radius } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { fairnessDisplayScore } from './FairnessRing'
import { teamOvrAverage } from './TeamDisplay'
import type { TeamPlayer } from './TeamDisplay'

const PITCH_HEIGHT = 520
const CHALK = 'rgba(255,255,255,0.13)'
const CHALK_WIDTH = 1.5
const FIELD_INSET = 12
const CENTER_CIRCLE_RADIUS = 42 // 84px diameter
const GOAL_BOX_WIDTH = 140
const GOAL_BOX_HEIGHT = 44
const AVATAR_SIZE = 40
const RING_GAP = 2
const RING_WIDTH = 2
const ITEM_WIDTH = 84
const TEAM_B_RING = RenderColors.teamBRing // white team ring (mockup .av.ring-white)

interface Slot {
  x: number // % of pitch width
  y: number // % of pitch height
}

/**
 * Static formation slot maps — no formation data exists in the product, so
 * slots are derived geometrically per team size. Coordinates are % of the
 * pitch box; maps describe Équipe A (top half, y 8–42). Équipe B mirrors
 * across the halfway line (y → 100 − y).
 *   5: 1-2-2 diamond (GK + 2 backs + 2 up)
 *   6: 1-2-3
 *   7: 1-3-3
 *   8: 1-3-4
 */
const SLOT_MAPS: Record<number, Slot[]> = {
  5: [{ x: 50, y: 10 }, { x: 26, y: 24 }, { x: 74, y: 24 }, { x: 31, y: 40 }, { x: 69, y: 40 }],
  6: [{ x: 50, y: 9 }, { x: 30, y: 21 }, { x: 70, y: 21 }, { x: 24, y: 38 }, { x: 50, y: 41 }, { x: 76, y: 38 }],
  7: [{ x: 50, y: 8 }, { x: 24, y: 20 }, { x: 50, y: 23 }, { x: 76, y: 20 }, { x: 26, y: 39 }, { x: 50, y: 42 }, { x: 74, y: 39 }],
  8: [{ x: 50, y: 8 }, { x: 24, y: 19 }, { x: 50, y: 21 }, { x: 76, y: 19 }, { x: 15, y: 36 }, { x: 38, y: 40 }, { x: 62, y: 40 }, { x: 85, y: 36 }],
}

/** Geometric fallback outside the mapped 5–8 range: GK up top, the rest in rows of 3. */
function buildSlots(count: number): Slot[] {
  const mapped = SLOT_MAPS[count]
  if (mapped) return mapped
  if (count <= 0) return []
  const slots: Slot[] = [{ x: 50, y: 8 }]
  const outfield = count - 1
  const rows = Math.max(1, Math.ceil(outfield / 3))
  for (let i = 0; i < outfield; i++) {
    const row = Math.floor(i / 3)
    const inRow = Math.min(3, outfield - row * 3)
    const col = i % 3
    const x = inRow === 1 ? 50 : 20 + (60 / (inRow - 1)) * col
    const y = rows === 1 ? 34 : 18 + (24 / (rows - 1)) * row
    slots.push({ x, y })
  }
  return slots
}

function firstName(displayName: string | null): string {
  return displayName?.trim().split(/\s+/)[0] ?? '—'
}

function PitchPlayer({
  player,
  slot,
  ringColor,
  pitchWidth,
  pitchHeight,
}: {
  player: TeamPlayer
  slot: Slot
  ringColor: string
  pitchWidth: number
  pitchHeight: number
}) {
  const { t } = useTranslation()
  const showOvr = player.cardState === 'unlocked' && player.ovrScore !== null
  const ovrText = showOvr ? String(player.ovrScore) : t('match.generate.ovrLocked')
  const ringSize = AVATAR_SIZE + 2 * (RING_GAP + RING_WIDTH)

  return (
    <View
      style={[
        styles.playerItem,
        {
          left: (slot.x / 100) * pitchWidth - ITEM_WIDTH / 2,
          top: (slot.y / 100) * pitchHeight - ringSize / 2,
        },
      ]}
      accessible
      accessibilityLabel={`${player.displayName ?? '—'}, OVR ${ovrText}`}
    >
      <View style={[styles.teamRing, { borderColor: ringColor, borderRadius: ringSize / 2 }]}>
        <DuotoneAvatar displayName={player.displayName ?? '—'} size={AVATAR_SIZE} />
      </View>
      <View style={styles.tagPill}>
        <Text style={styles.tagName} numberOfLines={1}>{firstName(player.displayName)}</Text>
        <Text style={styles.tagOvr}>{ovrText}</Text>
      </View>
    </View>
  )
}

interface PitchBoardProps {
  teamA: TeamPlayer[]
  teamB: TeamPlayer[]
  /** Raw composite penalty; the fairness pill is omitted when null (matches locked before generation jobs stored a score). */
  fairnessScore?: number | null
}

export function PitchBoard({ teamA, teamB, fairnessScore }: PitchBoardProps) {
  const { t } = useTranslation()
  const [pitchSize, setPitchSize] = useState({ w: 0, h: 0 })

  const ovrA = teamOvrAverage(teamA)
  const ovrB = teamOvrAverage(teamB)
  const slotsA = buildSlots(teamA.length)
  const slotsB = buildSlots(teamB.length).map((s) => ({ x: s.x, y: 100 - s.y }))

  const { w, h } = pitchSize

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.teamLockup, { color: Colors.primary }]}>
          {t('match.generate.teamA').toUpperCase()}
          <Text style={styles.teamLockupOvr}>{` · OVR ${ovrA ?? t('match.generate.ovrLocked')}`}</Text>
        </Text>
        {fairnessScore !== null && fairnessScore !== undefined && (
          <View style={styles.fairnessPill}>
            <Text style={styles.fairnessPillText}>
              {t('match.pitch.fairnessPill', { score: fairnessDisplayScore(fairnessScore) })}
            </Text>
          </View>
        )}
        <Text style={[styles.teamLockup, { color: Colors.ink }]}>
          {t('match.generate.teamB').toUpperCase()}
          <Text style={styles.teamLockupOvr}>{` · OVR ${ovrB ?? t('match.generate.ovrLocked')}`}</Text>
        </Text>
      </View>

      <View style={styles.stampRow}>
        <View style={styles.lockedStamp}>
          <Text style={styles.lockedStampText}>{`✓ ${t('match.pitch.lockedStamp')}`}</Text>
        </View>
      </View>

      {/* Dark tactical surface — NOT grass green (anti-reference). */}
      <View
        style={styles.pitch}
        onLayout={(e) => setPitchSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <LinearGradient
          colors={Gradients.pitch}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {w > 0 && h > 0 && (
          <Svg width={w} height={h} style={StyleSheet.absoluteFill} aria-hidden>
            <Rect
              x={FIELD_INSET}
              y={FIELD_INSET}
              width={w - 2 * FIELD_INSET}
              height={h - 2 * FIELD_INSET}
              rx={10}
              stroke={CHALK}
              strokeWidth={CHALK_WIDTH}
              fill="none"
            />
            <Line x1={FIELD_INSET} y1={h / 2} x2={w - FIELD_INSET} y2={h / 2} stroke={CHALK} strokeWidth={CHALK_WIDTH} />
            <Circle cx={w / 2} cy={h / 2} r={CENTER_CIRCLE_RADIUS} stroke={CHALK} strokeWidth={CHALK_WIDTH} fill="none" />
            <Rect
              x={w / 2 - GOAL_BOX_WIDTH / 2}
              y={FIELD_INSET}
              width={GOAL_BOX_WIDTH}
              height={GOAL_BOX_HEIGHT}
              stroke={CHALK}
              strokeWidth={CHALK_WIDTH}
              fill="none"
            />
            <Rect
              x={w / 2 - GOAL_BOX_WIDTH / 2}
              y={h - FIELD_INSET - GOAL_BOX_HEIGHT}
              width={GOAL_BOX_WIDTH}
              height={GOAL_BOX_HEIGHT}
              stroke={CHALK}
              strokeWidth={CHALK_WIDTH}
              fill="none"
            />
          </Svg>
        )}
        {w > 0 && h > 0 && teamA.map((p, i) => (
          <PitchPlayer
            key={p.playerId ?? `a-${i}`}
            player={p}
            slot={slotsA[i] ?? { x: 50, y: 25 }}
            ringColor={Colors.primary}
            pitchWidth={w}
            pitchHeight={h}
          />
        ))}
        {w > 0 && h > 0 && teamB.map((p, i) => (
          <PitchPlayer
            key={p.playerId ?? `b-${i}`}
            player={p}
            slot={slotsB[i] ?? { x: 50, y: 75 }}
            ringColor={TEAM_B_RING}
            pitchWidth={w}
            pitchHeight={h}
          />
        ))}
      </View>
    </View>
  )
}

// ─── Data container — joins participants (sides, names) with the players list
// (ovrScore + cardState for FR-14) client-side; the team lock API is untouched.

interface ParticipantEntry {
  playerId: string | null
  displayName: string | null
}

interface ParticipantsData {
  myPlayerId: string | null
  myTeamSide: 'A' | 'B' | null
  /** Penalty of the locked split's generation job (null for pre-fairness legacy matches). */
  fairnessScore: number | null
  teamA: ParticipantEntry[]
  teamB: ParticipantEntry[]
}

interface PlayerSummary {
  playerId: string
  displayName: string
  cardState: string
  ovrScore: number | null
}

interface LockedPitchBoardProps {
  groupId: string
  matchId: string
}

/** Locked-teams composition view — shared by the organizer, player, and match-detail routes. */
export function LockedPitchBoard({ groupId, matchId }: LockedPitchBoardProps) {
  const { data: participants } = useQuery({
    queryKey: ['participants', groupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: ParticipantsData }>(
        `/v1/groups/${groupId}/matches/${matchId}/participants`,
      )
      return data.data
    },
    enabled: Boolean(groupId) && Boolean(matchId),
  })

  const { data: playersData } = useQuery({
    queryKey: ['players', groupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: PlayerSummary[] } }>(
        `/v1/groups/${groupId}/players`,
      )
      return data.data
    },
    enabled: Boolean(groupId),
  })

  if (!participants || (participants.teamA.length === 0 && participants.teamB.length === 0)) {
    return null
  }

  const byId = new Map((playersData?.items ?? []).map((p) => [p.playerId, p]))
  const toTeamPlayer = (entry: ParticipantEntry): TeamPlayer => {
    const summary = entry.playerId ? byId.get(entry.playerId) : undefined
    return {
      playerId: entry.playerId,
      displayName: entry.displayName,
      cardState: summary?.cardState ?? 'not_started',
      ovrScore: summary?.ovrScore ?? null,
    }
  }

  return (
    <PitchBoard
      teamA={participants.teamA.map(toTeamPlayer)}
      teamB={participants.teamB.map(toTeamPlayer)}
      fairnessScore={participants.fairnessScore}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamLockup: {
    fontFamily: Fonts.bebas,
    fontSize: 17,
    letterSpacing: 2.04, // 0.12em @ 17 (heading register)
  },
  teamLockupOvr: {
    color: Colors.inkSecondary,
  },
  fairnessPill: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fairnessPillText: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 14,
    letterSpacing: 0.56, // 0.04em @ 14 (stat register)
    fontVariant: ['tabular-nums'],
  },
  stampRow: {
    alignItems: 'center',
  },
  lockedStamp: {
    backgroundColor: Colors.successSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    height: 30,
    justifyContent: 'center',
  },
  lockedStampText: {
    color: Colors.success,
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  pitch: {
    height: PITCH_HEIGHT,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  playerItem: {
    position: 'absolute',
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
  teamRing: {
    borderWidth: RING_WIDTH,
    padding: RING_GAP,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    maxWidth: ITEM_WIDTH,
  },
  tagName: {
    color: Colors.ink,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    flexShrink: 1,
  },
  tagOvr: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 11,
    letterSpacing: 0.44, // 0.04em @ 11 (stat register)
    fontVariant: ['tabular-nums'],
  },
})
