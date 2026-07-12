import { Image, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/tokens'

type RingColor = 'gold' | 'silver' | 'bronze' | 'red'

interface DuotoneAvatarProps {
  displayName: string
  photoUrl?: string | null
  size?: number
  /** Prestige ring — podium and MVP selection only. */
  ring?: RingColor
  /** "ember" marks the featured player (warm duotone). */
  variant?: 'default' | 'ember'
}

const RING_COLORS: Record<RingColor, string> = {
  gold: Colors.gold,
  silver: Colors.rankSilver,
  bronze: Colors.rankBronze,
  red: Colors.primary,
}

// Duotone grounds — a render treatment of the avatar slot, not an AI pipeline (DESIGN-PROCESS.md assumption 4).
const GRADIENTS = {
  default: { colors: ['#3B3B44', '#222227'] as const, initials: Colors.inkSecondary },
  ember: { colors: ['#4A2320', '#2A1512', '#1A0E0C'] as const, initials: '#E8A9A2' },
}

function getInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function DuotoneAvatar({ displayName, photoUrl, size = 40, ring, variant = 'default' }: DuotoneAvatarProps) {
  const gradient = GRADIENTS[variant]

  const avatar = (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {photoUrl ? (
        <>
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Grayscale approximation: RN has no CSS filter — dark tint overlay carries the duotone treatment. */}
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
        </>
      ) : (
        <LinearGradient
          colors={gradient.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.initialsWrap}>
            <Text style={[styles.initials, { color: gradient.initials, fontSize: size * 0.4 }]}>
              {getInitials(displayName)}
            </Text>
          </View>
        </LinearGradient>
      )}
    </View>
  )

  if (!ring) return avatar

  // Double-ring: 2px metal border, 2px bg gap, then the avatar.
  return (
    <View
      style={[
        styles.ring,
        {
          borderColor: RING_COLORS[ring],
          borderRadius: (size + 8) / 2,
          padding: 2,
        },
      ]}
    >
      {avatar}
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    backgroundColor: Colors.surfaceRaised,
  },
  tint: {
    backgroundColor: 'rgba(16,16,19,0.35)',
  },
  initialsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: Fonts.bebas,
    letterSpacing: 1,
  },
  ring: {
    borderWidth: 2,
    backgroundColor: Colors.bg,
  },
})
