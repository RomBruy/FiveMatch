import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, Type } from '../../constants/tokens'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'

interface PodiumPlayer {
  playerId: string
  displayName: string
  ovrScore: number
  rank: 1 | 2 | 3
}

const SLOT_CONFIG = {
  // P1's gold trio (top border + ring + OVR) is the screen's single gold moment.
  1: { avatarSize: 56, blockHeight: 104, metal: Colors.gold, ring: 'gold' as const, ovrSize: 32 },
  2: { avatarSize: 46, blockHeight: 78, metal: Colors.rankSilver, ring: 'silver' as const, ovrSize: Type.heading.maxSize },
  3: { avatarSize: 42, blockHeight: 62, metal: Colors.rankBronze, ring: 'bronze' as const, ovrSize: Type.heading.maxSize },
}

function PodiumSlot({ player }: { player: PodiumPlayer }) {
  const config = SLOT_CONFIG[player.rank]

  return (
    <View style={styles.slot}>
      <DuotoneAvatar
        displayName={player.displayName}
        size={config.avatarSize}
        ring={config.ring}
      />
      <View style={[styles.block, { height: config.blockHeight, borderTopColor: config.metal }]}>
        <Text style={[styles.ovr, { fontSize: config.ovrSize, color: config.metal }]}>
          {player.ovrScore}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {player.displayName}
        </Text>
      </View>
    </View>
  )
}

interface PodiumProps {
  top3: PodiumPlayer[]
}

export function Podium({ top3 }: PodiumProps) {
  const p1 = top3.find((p) => p.rank === 1)
  const p2 = top3.find((p) => p.rank === 2)
  const p3 = top3.find((p) => p.rank === 3)

  if (!p1) return null

  return (
    <View style={styles.container}>
      {/* P2 left, P1 center, P3 right */}
      {p2 ? <PodiumSlot player={p2} /> : <View style={styles.slot} />}
      <PodiumSlot player={p1} />
      {p3 ? <PodiumSlot player={p3} /> : <View style={styles.slot} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 18,
    paddingBottom: 6,
    gap: 10,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  block: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderTopWidth: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ovr: {
    fontFamily: Fonts.bebas,
    letterSpacing: Type.heading.letterSpacing,
  },
  name: {
    maxWidth: '90%',
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 0.8, // 0.08em @ 10
  },
})
