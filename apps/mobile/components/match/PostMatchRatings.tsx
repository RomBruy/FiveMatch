import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { CountdownPill } from '../ui/CountdownPill'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { PrimaryButton } from '../ui/PrimaryButton'
import { RatingSlider } from '../ui/RatingSlider'
import { InfoStrip } from '../shared/InfoStrip'
import { mapPostMatchRatingError } from '../../lib/post-match-opponents.mjs'

// Post-match ratings collect 6 attributes — no mentality (Story 4.3 API contract).
const ATTRIBUTES = ['pace', 'technique', 'passing', 'defending', 'physicality', 'effort'] as const

type Attribute = typeof ATTRIBUTES[number]

type RatingValues = Record<Attribute, number>

const DEFAULT_VALUES: RatingValues = {
  pace: 5,
  technique: 5,
  passing: 5,
  defending: 5,
  physicality: 5,
  effort: 5,
}

const WINDOW_MS = 48 * 60 * 60 * 1000

interface Opponent {
  playerId: string
  displayName: string | null
}

interface PostMatchRatingsProps {
  matchId: string
  /** Match completion timestamp — the 48h window anchors here. */
  completedAt: string
  /** Final participants on the opposing team — the API rejects teammates. */
  opponents: Opponent[]
}

/**
 * 48h post-match rating window (FR-12: ratings are anonymous — this surface
 * never shows per-rater data, and there is deliberately no endpoint to read
 * ratings back). Same slider system as the initial assessment.
 */
export function PostMatchRatings({ matchId, completedAt, opponents }: PostMatchRatingsProps) {
  const { t } = useTranslation()

  const deadlineMs = new Date(completedAt).getTime() + WINDOW_MS

  const [isWindowOpen, setIsWindowOpen] = useState(() => deadlineMs > Date.now())
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set())
  const [values, setValues] = useState<RatingValues>(DEFAULT_VALUES)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Flip-only tick: no re-render until the window actually closes.
  useEffect(() => {
    if (!isWindowOpen) return
    const interval = setInterval(() => {
      if (deadlineMs <= Date.now()) {
        setIsWindowOpen(false)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [deadlineMs, isWindowOpen])

  const pending = opponents.filter((p) => !ratedIds.has(p.playerId))
  const currentPlayer = pending[0] ?? null

  const markRated = (playerId: string) => {
    setRatedIds((prev) => new Set([...prev, playerId]))
    setValues(DEFAULT_VALUES)
    setSubmitError(null)
  }

  const { mutate: submitRating, isPending: isSubmitting } = useMutation({
    mutationFn: async ({ ratedPlayerId, ratingValues }: { ratedPlayerId: string; ratingValues: RatingValues }) => {
      await httpClient.post(`/v1/matches/${matchId}/ratings`, {
        ratedPlayerId,
        ...ratingValues,
      })
    },
    onSuccess: (_data, { ratedPlayerId }) => {
      markRated(ratedPlayerId)
    },
    onError: (err: unknown, { ratedPlayerId }) => {
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
      const outcome = mapPostMatchRatingError(code)
      if (outcome === 'rated') {
        // Duplicate from an earlier session — treat as done and advance.
        markRated(ratedPlayerId)
      } else if (outcome === 'window_closed') {
        setIsWindowOpen(false)
      } else {
        setSubmitError(t('common.genericError'))
      }
    },
  })

  if (!isWindowOpen) {
    return <InfoStrip message={t('match.ratings.windowClosed')} variant="info" />
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>{t('match.ratings.windowSubtitle')}</Text>
        <CountdownPill
          targetAt={new Date(deadlineMs).toISOString()}
          label={t('match.ratings.countdownLabel')}
        />
      </View>

      <InfoStrip message={t('match.ratings.anonymity')} variant="info" />

      {currentPlayer ? (
        <View style={styles.card}>
          <View style={styles.playerHeader}>
            <DuotoneAvatar displayName={currentPlayer.displayName ?? '—'} size={52} variant="ember" />
            <Text style={styles.playerName} numberOfLines={1}>{currentPlayer.displayName}</Text>
          </View>

          <View style={styles.sliders}>
            {ATTRIBUTES.map((attr) => (
              <RatingSlider
                key={attr}
                label={t(`rating.initial.attr.${attr}`)}
                value={values[attr]}
                onChange={(n) => setValues((prev) => ({ ...prev, [attr]: n }))}
              />
            ))}
          </View>

          {submitError && <Text style={styles.errorText}>{submitError}</Text>}

          {/* The host screen's glow is owned elsewhere (hero band / tab dock). */}
          <PrimaryButton
            label={t('match.ratings.submitRating')}
            onPress={() => submitRating({ ratedPlayerId: currentPlayer.playerId, ratingValues: values })}
            loading={isSubmitting}
            glow={false}
          />
        </View>
      ) : (
        <View style={styles.allRatedCard}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.allRatedText}>{t('match.ratings.allRated')}</Text>
        </View>
      )}

      {opponents.length > 0 && (
        <View style={styles.rowsCard}>
          {opponents.map((p) => {
            const isRated = ratedIds.has(p.playerId)
            return (
              <View key={p.playerId} style={styles.row}>
                <DuotoneAvatar displayName={p.displayName ?? '—'} size={32} />
                <Text style={styles.rowName} numberOfLines={1}>{p.displayName}</Text>
                {/* Phase pill — rated players stamp green (text + icon). */}
                {isRated ? (
                  <View style={[styles.stamp, styles.stampRated]}>
                    <Ionicons name="checkmark" size={12} color={Colors.success} />
                    <Text style={[styles.stampText, styles.stampTextRated]}>{t('match.ratings.ratedPill')}</Text>
                  </View>
                ) : (
                  <View style={styles.stamp}>
                    <Ionicons name="time-outline" size={12} color={Colors.inkSecondary} />
                    <Text style={styles.stampText}>{t('match.ratings.pendingPill')}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subtitle: {
    flexShrink: 1,
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.inter,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playerName: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 22,
    letterSpacing: Type.heading.letterSpacing,
  },
  sliders: {
    gap: 14,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
  allRatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.successSubtle,
    borderRadius: Radius.md,
    padding: 16,
  },
  allRatedText: {
    flexShrink: 1,
    color: Colors.success,
    fontSize: 14,
    fontFamily: Fonts.interSemiBold,
  },
  rowsCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowName: {
    flex: 1,
    color: Colors.ink,
    fontSize: 14,
    fontFamily: Fonts.interMedium,
  },
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  stampRated: {
    backgroundColor: Colors.successSubtle,
  },
  stampText: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  stampTextRated: {
    color: Colors.success,
  },
})
