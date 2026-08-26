import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import type { MatchMessageView } from '@fivematch/types'

/** Icon per system event. Semantic, never decorative. */
const EVENT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  player_joined: 'person-add',
  player_withdrew: 'alert-circle',
  waitlist_promoted: 'checkmark-circle',
  teams_drawn: 'flash',
  odds_open: 'cash',
  result_recorded: 'football',
  match_cancelled: 'close-circle',
}

const EVENT_TINT: Record<string, string> = {
  player_joined: Colors.success,
  waitlist_promoted: Colors.success,
  player_withdrew: Colors.primary,
  match_cancelled: Colors.primary,
}

/**
 * One row of the thread.
 *
 * System rows are rendered from `kind` + `meta` rather than stored prose, so the
 * thread speaks the reader's language and old events pick up copy fixes. They
 * sit inline with human messages on purpose — the teams being drawn *is* part of
 * the conversation, and pushing it to a separate tab means nobody reads either.
 */
export function ChatMessage({ message }: { message: MatchMessageView }) {
  const { t } = useTranslation()
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (message.kind !== 'text') {
    const tint = EVENT_TINT[message.kind] ?? Colors.inkSecondary
    return (
      <View style={styles.system} accessibilityRole="text">
        <Ionicons name={EVENT_ICON[message.kind] ?? 'information-circle'} size={15} color={tint} />
        <Text style={styles.systemText}>
          {t(`chat.event.${message.kind}`, {
            ...(message.meta ?? {}),
            // Some events name a player who has since been erased; the copy has
            // to survive that rather than rendering "undefined a rejoint".
            name: (message.meta?.displayName as string | undefined) ?? t('chat.someone'),
          })}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.bubbleRow, message.isMine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, message.isMine && styles.bubbleMine]}>
        {!message.isMine && (
          <Text style={styles.author}>{message.displayName ?? t('chat.someone')}</Text>
        )}
        <Text style={[styles.body, message.isMine && styles.bodyMine]}>{message.body}</Text>
        <Text style={[styles.time, message.isMine && styles.timeMine]}>{time}</Text>
      </View>
    </View>
  )
}

/** Date divider. Keeps "hier" and "aujourd'hui" legible in a long thread. */
export function ChatDaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.daySep}>
      <View style={styles.dayLine} />
      <Text style={styles.dayLabel}>{label.toUpperCase()}</Text>
      <View style={styles.dayLine} />
    </View>
  )
}

const styles = StyleSheet.create({
  system: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  systemText: {
    flex: 1,
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 11.5,
    lineHeight: 16,
  },
  bubbleRow: { flexDirection: 'row', maxWidth: '82%' },
  bubbleRowMine: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubble: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: 5,
  },
  author: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    marginBottom: 4,
  },
  body: { color: Colors.ink, fontFamily: Fonts.inter, fontSize: 13, lineHeight: 18 },
  bodyMine: { color: Colors.onPrimary },
  time: {
    marginTop: 5,
    color: Colors.inkDisabled,
    fontFamily: Fonts.interSemiBold,
    fontSize: 8.5,
  },
  timeMine: { color: 'rgba(255,255,255,0.66)', textAlign: 'right' },
  daySep: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  dayLine: { flex: 1, height: 1, backgroundColor: Colors.hairline },
  dayLabel: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.26, // 0.14em @ 9 (label-caps register)
  },
})
