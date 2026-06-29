import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'

interface PodiumPlayer {
  playerId: string
  displayName: string
  ovrScore: number
  rank: 1 | 2 | 3
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function PodiumSlot({ player }: { player: PodiumPlayer }) {
  const config = {
    1: { avatarSize: 52, blockHeight: 80, color: Colors.gold, ovrSize: 24 },
    2: { avatarSize: 42, blockHeight: 60, color: Colors.rankSilver, ovrSize: 20 },
    3: { avatarSize: 38, blockHeight: 46, color: Colors.rankBronze, ovrSize: 20 },
  }[player.rank]

  return (
    <View style={styles.slot}>
      <View
        style={[
          styles.avatar,
          {
            width: config.avatarSize,
            height: config.avatarSize,
            borderColor: config.color,
          },
        ]}
      >
        <Text style={styles.initials}>{getInitials(player.displayName)}</Text>
      </View>
      <Text style={[styles.name, { color: Colors.inkSecondary }]} numberOfLines={1}>
        {player.displayName}
      </Text>
      <View style={[styles.block, { height: config.blockHeight, borderTopColor: config.color }]}>
        <Text style={[styles.ovr, { fontSize: config.ovrSize, color: config.color }]}>
          {player.ovrScore}
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
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    borderRadius: 2,
    borderWidth: 2,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.ink,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  name: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  block: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderTopWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovr: {
    fontFamily: 'BebasNeue_400Regular',
  },
})
