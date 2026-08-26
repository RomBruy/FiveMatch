import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { haptics } from '../../../lib/haptics'
import {
  useMatch, useAttendances, useJoinMatch, useJoinWaitlist, useLeaveMatch,
  useSetAttendance, useSetVisibility, errorCodeOf, matchKeys,
  type AttendanceEntry,
} from '../../../lib/matches'
import { PhaseStepper } from '../../../components/shared/PhaseStepper'
import { InfoStrip } from '../../../components/shared/InfoStrip'
import { LockedPitchBoard } from '../../../components/match/PitchBoard'
import { PostMatchRatings } from '../../../components/match/PostMatchRatings'
import { MvpCeremonyCard } from '../../../components/match/MvpCeremonyCard'
import { StoryShareGraphic, STORY_EXPORT_WIDTH, STORY_EXPORT_HEIGHT } from '../../../components/share/StoryShareGraphic'
import { SpotsMeter } from '../../../components/match/SpotsMeter'
import { TrustRow } from '../../../components/players/TrustRow'
import { AttendanceFinalization } from '../../../components/match/AttendanceFinalization'
import { HostMatchActions } from '../../../components/match/HostMatchActions'
import { ReportPlayerSheet } from '../../../components/match/ReportPlayerSheet'
import { WithdrawSheet } from '../../../components/match/WithdrawSheet'
import { DEFAULT_CANCELLATION_DEADLINE_HOURS } from '@fivematch/types'
import { AttendanceSegmentedPill } from '../../../components/match/AttendanceSegmentedPill'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { PressableScale } from '../../../components/ui/PressableScale'
import { CountdownPill } from '../../../components/ui/CountdownPill'
import { DuotoneAvatar } from '../../../components/ui/DuotoneAvatar'
import { TextureType } from '../../../components/ui/TextureType'
import { Chip } from '../../../components/ui/Chip'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { getOpposingParticipants } from '../../../lib/post-match-opponents.mjs'

const SEPARATOR = ' · '
const TEXTURE_TEXT = 'MATCH DAY'

/**
 * THE match screen. One route, one component.
 *
 * This replaces `match/organizer.tsx` (753 lines) and `match/player.tsx` (613),
 * which were the same screen twice with a different set of buttons — and which
 * forced the caller to know the viewer's role before it could even pick a route.
 * The server reports `viewerRelation` on the match now, so the screen decides for
 * itself, and a stranger arriving from discovery lands somewhere real.
 */
export default function MatchScreen() {
  const { t, i18n } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const [actionError, setActionError] = useState<string | null>(null)
  const storyRef = useRef<View>(null)
  const [isSharingStory, setIsSharingStory] = useState(false)

  const { data: match, isLoading, isError } = useMatch(matchId)
  const { data: sheet } = useAttendances(matchId)

  const { data: mvpResult } = useQuery({
    queryKey: ['matches', matchId, 'mvp-result'],
    queryFn: async () => {
      const { data } = await httpClient.get<{
        data: { resolved: boolean; mvpPlayerId: string | null; mvpDisplayName: string | null }
      }>(`/v1/matches/${matchId}/mvp-result`)
      return data.data
    },
    enabled: Boolean(matchId) && match?.status === 'completed',
    // Poll until the 24h vote resolves, then stop.
    refetchInterval: (query) => (query.state.data?.resolved ? false : 30_000),
    retry: false,
  })

  const join = useJoinMatch(matchId)
  const leave = useLeaveMatch(matchId)
  const setAttendance = useSetAttendance(matchId)
  const setVisibility = useSetVisibility(matchId)

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
      void queryClient.invalidateQueries({ queryKey: matchKeys.attendances(matchId) })
    }, [queryClient, matchId]),
  )

  const isHost = match?.capabilities.canManageAttendance ?? false
  const joinWaitlist = useJoinWaitlist(matchId)
  // Their own place in the queue, so the screen can say where they stand rather
  // than only that the match is full.
  const myWaitlistPosition = sheet?.waitlist.find((e) => e.playerId === sheet.myPlayerId)?.waitlistPosition ?? null
  const [reportOpen, setReportOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  // Server-authored, and manager-only. Once settled the section reads as done
  // rather than offering the action again.
  const attendanceFinalized = sheet?.attendanceFinalized ?? false
  const isOutsider = match?.viewerRelation === 'viewer'
  const myStatus = sheet?.myStatus ?? null
  const kickoffPassed = match ? new Date(match.scheduledAt).getTime() <= Date.now() : false

  // Are we inside the standard late-cancellation window? Advisory only — the
  // server decides at finalization, against the crew's own deadline if it has
  // one (ADR-028), which the match payload does not carry. So the sheet always
  // states the rule and only *emphasises* it here: a quiet always-on line can
  // never under-warn a crew that set a longer deadline, whereas a purely
  // conditional warning silently would.
  const withdrawIsLate = match
    ? new Date(match.scheduledAt).getTime() - Date.now()
      <= DEFAULT_CANCELLATION_DEADLINE_HOURS * 3_600_000
    : false

  const opponents = useMemo(() => {
    if (!match?.participants || !sheet?.myPlayerId) return []
    return getOpposingParticipants(match.participants, sheet.myPlayerId)
      .map((p) => ({ playerId: p.playerId!, displayName: p.displayName }))
  }, [match?.participants, sheet?.myPlayerId])

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError(null)
    try {
      haptics.impact('Light')
      await fn()
    } catch (err) {
      const code = errorCodeOf(err)
      setActionError(
        code ? t(`errors.${code}`, { defaultValue: t('common.genericError') }) : t('common.genericError'),
      )
    }
  }

  const handleShare = async () => {
    if (!match) return
    const when = new Date(match.scheduledAt).toLocaleString(i18n.language, {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })
    // The shared link is the acquisition channel for open matches — the host
    // pastes it into WhatsApp and it opens a public preview, no install needed.
    await Share.share({
      message: t('match.share.message', {
        when,
        place: match.city ?? '',
        count: match.spotsRemaining,
        url: `https://fivematch.app/m/${match.matchId}`,
      }),
    }).catch(() => { /* dismissed */ })
  }

  /** Capture the off-screen 9:16 frame at export size and hand it to the OS sheet. */
  const handleShareStory = async () => {
    if (!storyRef.current || isSharingStory) return
    setIsSharingStory(true)
    haptics.impact('Medium')
    try {
      const uri = await captureRef(storyRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: 1080,
        height: 1920,
      })
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.story.share') })
    } catch {
      // Sharing cancelled by the user — not an error.
    } finally {
      setIsSharingStory(false)
    }
  }

  const handlePublish = () => {
    if (!match) return
    if (match.visibility === 'public') {
      void runAction(() => setVisibility.mutateAsync({ visibility: 'private' }))
      return
    }
    const free = Math.max(1, match.capacity - match.confirmed)
    Alert.alert(
      t('match.publish.title'),
      t('match.publish.body', { count: free }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('match.publish.confirm'),
          onPress: () => void runAction(() => setVisibility.mutateAsync({ visibility: 'public', openSpots: free })),
        },
      ],
    )
  }

  const lockAttendance = () => runAction(() => httpClient.post(`/v1/matches/${matchId}/lock-attendance`))

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (isError || !match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('match.notFound')}</Text>
        <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
      </View>
    )
  }

  const date = new Date(match.scheduledAt)
  const dayLabel = date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  const place = match.venueName ?? match.location ?? match.city
  const meta = [
    match.format.toUpperCase(),
    t(`player.level.${match.skillLevel}`).toUpperCase(),
    ...(match.pricePerPlayer
      ? [t('match.pricePerPlayer', {
          amount: String(match.pricePerPlayer),
          currency: match.currency === 'EUR' ? '€' : match.currency,
        })]
      : []),
  ].join(SEPARATOR)

  return (
    <View style={styles.container}>
      <TextureType lines={[{ text: TEXTURE_TEXT }]} fontSize={170} style={styles.texture} />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.ink} />
          </PressableScale>
          {match.visibility === 'public' && (
            <PressableScale
              onPress={() => void handleShare()}
              accessibilityRole="button"
              accessibilityLabel={t('match.share.action')}
              style={styles.iconButton}
            >
              <Ionicons name="share-outline" size={20} color={Colors.inkSecondary} />
            </PressableScale>
          )}
        </View>

        {/* ── When, where, how much ─────────────────────────────────────── */}
        <Text style={styles.time}>{timeLabel}</Text>
        <Text style={styles.day}>{dayLabel}</Text>
        {place && <Text style={styles.place}>{place}</Text>}
        <Text style={styles.meta}>{meta}</Text>

        {!kickoffPassed && match.status !== 'completed' && (
          <View style={styles.countdown}>
            <CountdownPill targetAt={match.scheduledAt} label={t('match.countdown.kickoff')} />
          </View>
        )}

        {match.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesText}>{match.notes}</Text>
          </View>
        )}

        <View style={styles.phaseSection}>
          <PhaseStepper status={match.status} />
        </View>

        {actionError && (
          <View style={styles.errorStrip}>
            <InfoStrip variant="warning" message={actionError} />
          </View>
        )}

        {/* ── Seats + the one primary action for this viewer ─────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('match.squad.title')}</Text>
          <SpotsMeter
            confirmed={match.confirmed}
            capacity={match.capacity}
            spotsRemaining={match.spotsRemaining}
          />

          <View style={styles.actionBlock}>
            {match.capabilities.canJoin && !kickoffPassed && (
              <PrimaryButton
                label={t('match.cta.join')}
                onPress={() => void runAction(() => join.mutateAsync())}
                loading={join.isPending}
                glow={false}
              />
            )}
            {match.capabilities.canJoinWaitlist && (
              <SecondaryButton
                label={t('match.cta.joinWaitlist')}
                onPress={() => void runAction(async () => {
                  const { waitlistPosition } = await joinWaitlist.mutateAsync()
                  Alert.alert(t('match.cta.waitlistJoined', { position: waitlistPosition }))
                })}
                disabled={joinWaitlist.isPending}
              />
            )}

            {myWaitlistPosition !== null && (
              <Text style={styles.mutedNote}>
                {t('match.cta.waitlistPosition', { position: myWaitlistPosition })}
              </Text>
            )}

            {isOutsider && !match.capabilities.canJoin && !match.capabilities.canJoinWaitlist
              && match.spotsRemaining === 0 && (
              <Text style={styles.mutedNote}>{t('match.cta.fullNote')}</Text>
            )}

            {!isOutsider && !isHost && match.status === 'attendance_open' && (
              <AttendanceSegmentedPill
                status={myStatus ?? 'unknown'}
                onPress={(next) => void runAction(() => setAttendance.mutateAsync(next))}
                disabled={setAttendance.isPending}
              />
            )}

            {/* Was only offered once the sheet was locked, which is backwards:
                the earlier someone can say they are out, the more chance the
                match has of surviving it. Now available the whole time they
                hold a seat, and it opens the sheet instead of firing blind. */}
            {match.capabilities.canLeave && myStatus === 'in' && (
              <SecondaryButton
                label={t('match.cta.leave')}
                onPress={() => setWithdrawOpen(true)}
              />
            )}
          </View>
        </View>

        {/* ── Who's playing, with the signals that let you judge them ────── */}
        {sheet && sheet.confirmed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('match.confirmed.title')}</Text>
            {sheet.confirmed.map((entry, index) => (
              <PlayerRow
                key={entry.playerId ?? `confirmed-${index}`}
                entry={entry}
                isMe={entry.playerId === sheet.myPlayerId}
                onPress={entry.playerId ? () => router.push(`/(app)/player/${entry.playerId}` as never) : undefined}
              />
            ))}
          </View>
        )}

        {sheet && sheet.waitlist.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('match.waitlist.title')}</Text>
            {sheet.waitlist.map((entry, index) => (
              <PlayerRow
                key={entry.playerId ?? `waitlist-${index}`}
                entry={entry}
                isMe={entry.playerId === sheet.myPlayerId}
                position={entry.waitlistPosition ?? undefined}
              />
            ))}
          </View>
        )}

        {/* ── Host controls ─────────────────────────────────────────────── */}
        {isHost && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('match.host.title')}</Text>

            {match.status === 'attendance_open' && (
              <>
                {/* The publish toggle — the whole of use case 1 lives here. */}
                <View style={styles.publishRow}>
                  <View style={styles.publishText}>
                    <Text style={styles.publishTitle}>
                      {match.visibility === 'public' ? t('match.publish.onTitle') : t('match.publish.offTitle')}
                    </Text>
                    <Text style={styles.publishBody}>
                      {match.visibility === 'public'
                        ? t('match.publish.onBody', { count: match.spotsRemaining })
                        : t('match.publish.offBody')}
                    </Text>
                  </View>
                  <Chip
                    label={match.visibility === 'public' ? t('match.publish.withdraw') : t('match.publish.action')}
                    active={match.visibility === 'public'}
                    variant={match.visibility === 'public' ? 'filled' : 'outlined'}
                    onPress={handlePublish}
                  />
                </View>

                <View style={styles.hostActions}>
                  <PrimaryButton
                    label={t('match.cta.lockAttendance')}
                    onPress={() => void lockAttendance()}
                    disabled={match.confirmed < match.capacity}
                    glow={false}
                  />
                  {match.confirmed < match.capacity && (
                    <Text style={styles.mutedNote}>
                      {t('match.host.needMore', { count: match.capacity - match.confirmed })}
                    </Text>
                  )}
                </View>
              </>
            )}

            {(match.status === 'attendance_locked' || match.status === 'teams_generated') && (
              <View style={styles.hostActions}>
                <PrimaryButton
                  label={t('match.cta.generateTeams')}
                  onPress={() => router.push(`/(app)/match/teams?matchId=${matchId}` as never)}
                  glow={false}
                />
              </View>
            )}

            {match.status === 'in_progress' && (
              <View style={styles.hostActions}>
                <PrimaryButton
                  label={t('match.cta.recordResult')}
                  onPress={() => router.push(`/(app)/match/result?matchId=${matchId}` as never)}
                  glow={false}
                />
              </View>
            )}
          </View>
        )}

        {/* ── Teams ─────────────────────────────────────────────────────── */}
        {(match.status === 'in_progress' || match.status === 'completed') && matchId && (
          <View style={styles.pitchSection}>
            <LockedPitchBoard matchId={matchId} />
          </View>
        )}

        {/* ── Betting: secondary, and only where there's something to price ─ */}
        {match.status === 'teams_generated' && !kickoffPassed && (
          <PressableScale
            style={styles.pronosCard}
            onPress={() => router.push(`/(app)/pronos/${matchId}` as never)}
            accessibilityRole="button"
          >
            <Ionicons name="trending-up" size={20} color={Colors.gold} />
            <View style={styles.pronosText}>
              <Text style={styles.pronosTitle}>{t('pronos.tab.title')}</Text>
              <Text style={styles.pronosBody}>{t('pronos.shortcut.open')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.inkSecondary} />
          </PressableScale>
        )}

        {/* ── After the whistle ─────────────────────────────────────────
            The ceremony card and its 9:16 story export are the app's best
            shareable moment, so they live where the result actually lands. */}
        {match.status === 'completed' && match.result && (
          <View style={styles.ceremonySection}>
            <Text style={styles.sectionLabel}>{t('match.result.title')}</Text>
            <MvpCeremonyCard
              scoreA={match.result.scoreA}
              scoreB={match.result.scoreB}
              mvpDisplayName={mvpResult?.mvpDisplayName ?? null}
              scheduledAt={match.scheduledAt}
              onPress={() => { /* already on the match */ }}
              watermark={false}
              onShare={() => void handleShareStory()}
            />
          </View>
        )}

        {match.capabilities.canRate && match.completedAt && opponents.length > 0 && matchId && (
          <View style={styles.ratingsSection}>
            <PostMatchRatings matchId={matchId} completedAt={match.completedAt} opponents={opponents} />
          </View>
        )}

        {isHost && matchId && match.status !== 'completed' && match.status !== 'cancelled' && (
          <View style={styles.ratingsSection}>
            <HostMatchActions
              matchId={matchId}
              scheduledAt={match.scheduledAt}
              venueName={match.venueName ?? null}
              city={match.city ?? null}
              latitude={match.latitude ?? null}
              longitude={match.longitude ?? null}
              waitlist={sheet?.waitlist ?? []}
              canCancel
            />
          </View>
        )}

        {isHost && match.status === 'completed' && match.result && matchId && (
          <View style={styles.ratingsSection}>
            <AttendanceFinalization
              matchId={matchId}
              confirmed={sheet?.confirmed ?? []}
              isFinalized={attendanceFinalized}
            />
          </View>
        )}

        {match.capabilities.canReportAttendance && opponents.length > 0 && matchId && (
          <View style={styles.ratingsSection}>
            {reportOpen ? (
              <ReportPlayerSheet
                matchId={matchId}
                opponents={opponents}
                onClose={() => setReportOpen(false)}
              />
            ) : (
              <SecondaryButton label={t('match.report.open')} onPress={() => setReportOpen(true)} />
            )}
          </View>
        )}
      </ScrollView>

      <WithdrawSheet
        visible={withdrawOpen}
        otherPlayerCount={Math.max(0, match.confirmed - 1)}
        isLate={withdrawIsLate}
        submitting={leave.isPending}
        onExplain={() => {
          setWithdrawOpen(false)
          router.push('/(app)/help/article/late-withdrawal' as never)
        }}
        onClose={() => setWithdrawOpen(false)}
        onConfirm={(reason) => {
          void runAction(async () => {
            await leave.mutateAsync(reason)
            setWithdrawOpen(false)
            // Says what the app did, not just that it worked. Someone who feels
            // they left the group short does not withdraw next time — they go
            // quiet, which is the outcome this whole flow exists to prevent.
            Alert.alert(t('match.withdraw.done'))
          })
        }}
      />

      {/* Off-screen 9:16 story frame — the share capture target. */}
      {match.status === 'completed' && match.result && (
        <View ref={storyRef} collapsable={false} style={styles.storyOffscreen} pointerEvents="none">
          <StoryShareGraphic
            groupName={match.venueName ?? match.city ?? ''}
            dateLabel={new Date(match.scheduledAt)
              .toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
              .toUpperCase()}
            scoreA={match.result.scoreA}
            scoreB={match.result.scoreB}
            mvpDisplayName={mvpResult?.mvpDisplayName ?? null}
          />
        </View>
      )}
    </View>
  )
}

function PlayerRow({
  entry,
  isMe,
  position,
  onPress,
}: {
  entry: AttendanceEntry
  isMe: boolean
  position?: number
  onPress?: () => void
}) {
  const { t } = useTranslation()

  const body = (
    <>
      {position !== undefined && <Text style={styles.waitlistPosition}>{position}</Text>}
      <DuotoneAvatar displayName={entry.displayName ?? '?'} size={36} />
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={styles.playerName} numberOfLines={1}>{entry.displayName ?? '—'}</Text>
          {isMe && <Text style={styles.youTag}>{t('common.you')}</Text>}
          {/* Flagging who came off the marketplace is the honest thing to do —
              a host is entitled to know which of these ten they've never met. */}
          {entry.source === 'open' && (
            <View style={styles.openTag}>
              <Text style={styles.openTagText}>{t('match.fromMarketplace')}</Text>
            </View>
          )}
        </View>
        <TrustRow
          skillLevel={entry.skillLevel}
          isReliable={entry.isReliable}
          matchCount={entry.matchCount}
          size="sm"
        />
      </View>
    </>
  )

  if (onPress) {
    return (
      <PressableScale style={styles.playerRow} onPress={onPress} accessibilityRole="button">
        {body}
      </PressableScale>
    )
  }
  return <View style={styles.playerRow}>{body}</View>
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  centered: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 15 },
  texture: { top: 60, right: -70 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -10,
  },
  time: {
    fontFamily: Fonts.bebas,
    fontSize: 76,
    letterSpacing: -0.76,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
    lineHeight: 80,
  },
  day: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  place: { fontFamily: Fonts.interSemiBold, fontSize: 16, color: Colors.ink, marginTop: 10 },
  meta: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
    marginTop: 4,
  },
  countdown: { alignSelf: 'flex-start', marginTop: 14 },
  notes: { backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: 14, marginTop: 16 },
  notesText: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 13.5, lineHeight: 19 },
  phaseSection: { marginTop: 22 },
  errorStrip: { marginTop: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  actionBlock: { gap: 10 },
  mutedNote: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12.5, lineHeight: 18 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  waitlistPosition: {
    width: 18,
    fontFamily: Fonts.bebas,
    fontSize: 18,
    color: Colors.inkDisabled,
    textAlign: 'center',
  },
  playerInfo: { flex: 1, gap: 4 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { flexShrink: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  youTag: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  openTag: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  openTagText: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 8.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  publishRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  publishText: { flex: 1, gap: 2 },
  publishTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13.5 },
  publishBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, lineHeight: 17 },
  hostActions: { gap: 10, marginTop: 4 },
  pitchSection: { marginTop: 20 },
  pronosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    marginTop: 16,
  },
  pronosText: { flex: 1, gap: 2 },
  pronosTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13.5 },
  pronosBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12 },
  score: {
    fontFamily: Fonts.bebas,
    fontSize: 56,
    letterSpacing: 2.24,
    color: Colors.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  ratingsSection: { marginTop: 20 },
  ceremonySection: { marginTop: 20, gap: 12 },
  storyOffscreen: {
    position: 'absolute',
    left: -STORY_EXPORT_WIDTH * 30,
    top: 0,
    width: STORY_EXPORT_WIDTH,
    height: STORY_EXPORT_HEIGHT,
  },
})
