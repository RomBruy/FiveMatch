import {
  View,
  Text,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { haptics } from '../../../../lib/haptics'
import { posthog } from '../../../../lib/posthog'
import { Colors } from '../../../../constants/colors'
import { Fonts, Type } from '../../../../constants/tokens'
import { PaniniCard } from '../../../../components/cards/PaniniCard'
import { CardExport, CARD_EXPORT_WIDTH, CARD_EXPORT_HEIGHT } from '../../../../components/share/CardExport'
import { TextureType } from '../../../../components/ui/TextureType'
import { PrimaryButton } from '../../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../../components/ui/SecondaryButton'
import { httpClient } from '../../../../lib/api-client'
import {
  REVEAL_LABEL_DURATION_MS,
  REVEAL_LABEL_DELAY_MS,
  REVEAL_CARD_DURATION_MS,
  REVEAL_CARD_DELAY_MS,
  REVEAL_OVR_DURATION_MS,
  REVEAL_OVR_DELAY_MS,
  REVEAL_CTA_DURATION_MS,
  REVEAL_CTA_DELAY_MS,
  REVEAL_META_DURATION_MS,
  REVEAL_META_DELAY_MS,
  REVEAL_REDUCED_MOTION_DURATION_MS,
} from '@fivematch/types'

interface PlayerDetail {
  playerId: string
  displayName: string
  cardState: 'not_started' | 'in_progress_1' | 'in_progress_2' | 'in_progress_3' | 'unlocked'
  matchCount: number
  ovrScore: number | null
  trend: 'up' | 'down' | 'stable' | null
  attributes: {
    pace: number; technique: number; passing: number
    defending: number; physicality: number; effort: number
  } | null
  isMvp?: boolean
}

interface GroupData {
  name: string
  tier: string
}

const REVEAL_SEEN_KEY = (groupId: string, playerId: string) =>
  `card_reveal_seen_${groupId}_${playerId}`

function fireCardHaptic() {
  haptics.impact('Medium')
}

function fireOvrHaptic() {
  haptics.success()
}

export default function CardRevealScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { groupId, playerId } = useLocalSearchParams<{ groupId: string; playerId: string }>()

  const [reduceMotion, setReduceMotion] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  // Story 10.4 — the card only becomes a living, tilting object AFTER the 5.2 reveal
  // settles. Gated on the reveal's final (meta) completion; PaniniCard itself no-ops
  // this under reduced motion or a zeroed sensor.
  const [cardInteractive, setCardInteractive] = useState(false)
  const hasMarkedSeen = useRef(false)
  const cardCaptureRef = useRef<View>(null)

  const { data: player } = useQuery<PlayerDetail>({
    queryKey: ['player', groupId, playerId],
    queryFn: () =>
      httpClient
        .get<{ data: PlayerDetail }>(`/v1/groups/${groupId}/players/${playerId}`)
        .then((r) => r.data.data),
    enabled: !!groupId && !!playerId,
  })

  const { data: group } = useQuery<GroupData>({
    queryKey: ['group', groupId],
    queryFn: () =>
      httpClient
        .get<{ data: GroupData }>(`/v1/groups/${groupId}`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })

  // Member count for the card serial — same endpoint/key the Joueurs grid caches.
  const { data: playersData } = useQuery({
    queryKey: ['players', groupId],
    queryFn: () =>
      httpClient
        .get<{ data: { items: { playerId: string }[] } }>(`/v1/groups/${groupId}/players`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })

  const labelOpacity = useSharedValue(0)
  const labelTranslateY = useSharedValue(-8)
  const cardOpacity = useSharedValue(0)
  const cardScale = useSharedValue(0.88)
  const cardTranslateY = useSharedValue(32)
  const ovrOpacity = useSharedValue(0)
  const ovrScale = useSharedValue(0.5)
  const ctaOpacity = useSharedValue(0)
  const ctaTranslateY = useSharedValue(12)
  const metaOpacity = useSharedValue(0)
  const metaTranslateY = useSharedValue(-8)

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: labelTranslateY.value }],
  }))

  const cardWrapperStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale: cardScale.value },
      { translateY: cardTranslateY.value },
    ],
  }))

  const ovrAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ovrOpacity.value,
    transform: [{ scale: ovrScale.value }],
  }))

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }))

  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaOpacity.value,
    transform: [{ translateY: metaTranslateY.value }],
  }))

  const announceAccessibility = () => {
    const ovrText = player?.ovrScore != null ? String(player.ovrScore) : ''
    AccessibilityInfo.announceForAccessibility(
      t('card.reveal.accessibility', { ovr: ovrText })
    )
  }

  const enableCardInteractive = () => {
    setCardInteractive(true)
  }

  useEffect(() => {
    posthog.capture('card_unlocked', {})
  }, [])

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
  }, [])

  useEffect(() => {
    if (!player) return
    if (hasMarkedSeen.current) return
    hasMarkedSeen.current = true

    if (groupId && playerId) {
      AsyncStorage.setItem(REVEAL_SEEN_KEY(groupId, playerId), 'true').catch(() => {})
    }

    const ease = Easing.bezier(0.16, 1, 0.3, 1)
    const easeOut = Easing.out(Easing.quad)

    if (reduceMotion) {
      cardScale.value = 1
      cardTranslateY.value = 0
      ovrScale.value = 1
      ctaTranslateY.value = 0
      metaTranslateY.value = 0
      labelTranslateY.value = 0

      const dur = REVEAL_REDUCED_MOTION_DURATION_MS

      labelOpacity.value = withDelay(REVEAL_LABEL_DELAY_MS, withTiming(1, { duration: dur }))
      cardOpacity.value = withDelay(REVEAL_CARD_DELAY_MS, withTiming(1, { duration: dur }, () => {
        runOnJS(fireCardHaptic)()
      }))
      ovrOpacity.value = withDelay(REVEAL_OVR_DELAY_MS, withTiming(1, { duration: dur }, () => {
        runOnJS(fireOvrHaptic)()
      }))
      ctaOpacity.value = withDelay(REVEAL_CTA_DELAY_MS, withTiming(1, { duration: dur }))
      metaOpacity.value = withDelay(REVEAL_META_DELAY_MS, withTiming(1, { duration: dur }, () => {
        runOnJS(announceAccessibility)()
        runOnJS(enableCardInteractive)()
      }))
    } else {
      // 1. Unlock label
      labelOpacity.value = withDelay(REVEAL_LABEL_DELAY_MS, withTiming(1, { duration: REVEAL_LABEL_DURATION_MS, easing: easeOut }))
      labelTranslateY.value = withDelay(REVEAL_LABEL_DELAY_MS, withTiming(0, { duration: REVEAL_LABEL_DURATION_MS, easing: easeOut }))

      // 2. Card enter — 3-keyframe spring: scale 0.88 → 1.02 → 1.0
      const phase1Duration = Math.round(REVEAL_CARD_DURATION_MS * 0.72)
      const phase2Duration = REVEAL_CARD_DURATION_MS - phase1Duration

      cardOpacity.value = withDelay(REVEAL_CARD_DELAY_MS, withTiming(1, { duration: phase1Duration, easing: ease }, () => {
        runOnJS(fireCardHaptic)()
      }))
      cardScale.value = withDelay(REVEAL_CARD_DELAY_MS, withSequence(
        withTiming(1.02, { duration: phase1Duration, easing: ease }),
        withTiming(1, { duration: phase2Duration, easing: Easing.out(Easing.quad) })
      ))
      cardTranslateY.value = withDelay(REVEAL_CARD_DELAY_MS, withSequence(
        withTiming(-4, { duration: phase1Duration, easing: ease }),
        withTiming(0, { duration: phase2Duration, easing: Easing.out(Easing.quad) })
      ))

      // 3. OVR appear — 3-keyframe spring: scale 0.5 → 1.06 → 1.0
      const ovrPhase1 = Math.round(REVEAL_OVR_DURATION_MS * 0.70)
      const ovrPhase2 = REVEAL_OVR_DURATION_MS - ovrPhase1

      ovrOpacity.value = withDelay(REVEAL_OVR_DELAY_MS, withTiming(1, { duration: ovrPhase1, easing: ease }, () => {
        runOnJS(fireOvrHaptic)()
      }))
      ovrScale.value = withDelay(REVEAL_OVR_DELAY_MS, withSequence(
        withTiming(1.06, { duration: ovrPhase1, easing: ease }),
        withTiming(1, { duration: ovrPhase2, easing: Easing.out(Easing.quad) })
      ))

      // 4. CTA slide-up
      ctaOpacity.value = withDelay(REVEAL_CTA_DELAY_MS, withTiming(1, { duration: REVEAL_CTA_DURATION_MS, easing: easeOut }))
      ctaTranslateY.value = withDelay(REVEAL_CTA_DELAY_MS, withTiming(0, { duration: REVEAL_CTA_DURATION_MS, easing: easeOut }))

      // 5. Meta fade-down — fires accessibility announcement on complete
      metaOpacity.value = withDelay(REVEAL_META_DELAY_MS, withTiming(1, { duration: REVEAL_META_DURATION_MS, easing: easeOut }, () => {
        runOnJS(announceAccessibility)()
        runOnJS(enableCardInteractive)()
      }))
      metaTranslateY.value = withDelay(REVEAL_META_DELAY_MS, withTiming(0, { duration: REVEAL_META_DURATION_MS, easing: easeOut }))
    }
  }, [player, reduceMotion])

  const handleShare = async () => {
    if (!cardCaptureRef.current || isSharing) return
    setIsSharing(true)
    try {
      // Export spec: exactly 1080×1350 (4:5) — view-shot resizes the off-screen frame.
      const uri = await captureRef(cardCaptureRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1350,
      })
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('card.share.dialogTitle'),
      })
      posthog.capture('card_shared', {
        card_state: player?.cardState ?? null,
        has_mvp_badge: player?.isMvp ?? false,
      })
      httpClient.post(
        `/v1/groups/${groupId}/players/${playerId}/card-share-event`
      ).catch(() => {})
    } catch {
      // Sharing cancelled by user — not an error
    } finally {
      setIsSharing(false)
    }
  }

  const handleHistory = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      {/* The screen's ONE texture element: outline LÉGENDE watermark on the ceremonial dark ground. */}
      <TextureType lines={[{ text: t('card.reveal.legende') }]} fontSize={200} style={styles.legendeTexture} />

      {/* Unlock label */}
      <Animated.View style={[styles.labelContainer, labelStyle]}>
        <Text style={styles.unlockLabel}>{t('card.reveal.unlockLabel')}</Text>
      </Animated.View>

      {/* Card — the bone relic lands on the dark ground; the screen's glow belongs to it */}
      <Animated.View style={[styles.cardWrapper, styles.cardGlow, cardWrapperStyle]}>
        {player ? (
          <PaniniCard
            player={player}
            groupName={group?.name}
            groupTier={group?.tier}
            ovrStyle={ovrAnimatedStyle}
            isMvp={player.isMvp}
            serialTotal={playersData?.items.length}
            interactive={cardInteractive}
          />
        ) : (
          <View style={styles.cardSkeleton} />
        )}
      </Animated.View>

      {/* Off-screen 4:5 export frame (paper default) — the share capture target */}
      {player && (
        <View ref={cardCaptureRef} collapsable={false} style={styles.exportOffscreen} pointerEvents="none">
          <CardExport
            player={player}
            groupName={group?.name}
            isMvp={player.isMvp}
            serialTotal={playersData?.items.length}
          />
        </View>
      )}

      {/* CTA area — card owns the glow, so the primary button goes without */}
      <Animated.View style={[styles.ctaArea, ctaStyle]}>
        <PrimaryButton
          label={t('card.reveal.cta.share')}
          onPress={handleShare}
          disabled={isSharing}
          glow={false}
        />
        <SecondaryButton label={t('card.reveal.cta.history')} onPress={handleHistory} />
      </Animated.View>

      {/* Meta section */}
      <Animated.View style={[styles.metaSection, metaStyle]}>
        <Text style={styles.metaText}>{group?.name?.toUpperCase()}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  legendeTexture: {
    top: 80,
    left: -46,
  },
  labelContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  unlockLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 3.6, // 0.3em @ 12
    textTransform: 'uppercase',
  },
  cardWrapper: {
    alignItems: 'center',
  },
  cardGlow: {
    // The screen's single glow — it belongs to the card, not the CTA.
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 14,
  },
  exportOffscreen: {
    position: 'absolute',
    left: -CARD_EXPORT_WIDTH * 30,
    top: 0,
    width: CARD_EXPORT_WIDTH,
    height: CARD_EXPORT_HEIGHT,
  },
  cardSkeleton: {
    width: 272,
    height: 440,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    opacity: 0.4,
  },
  ctaArea: {
    width: '100%',
    marginTop: 32,
    gap: 12,
    alignItems: 'stretch',
  },
  metaSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  metaText: {
    color: Colors.inkDisabled,
    fontSize: 10,
    fontFamily: Type.labelCaps.fontFamily,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
})
