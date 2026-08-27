import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CHAT_MESSAGE_MAX_LENGTH } from '@fivematch/types'
import type { MatchMessageView } from '@fivematch/types'
import { Colors } from '../../../../constants/colors'
import { Fonts, Radius } from '../../../../constants/tokens'
import { PressableScale } from '../../../../components/ui/PressableScale'
import { DOCK_CLEARANCE } from '../../../../components/ui/TabDock'
import { ChatMessage, ChatDaySeparator } from '../../../../components/match/ChatMessage'
import { useMatchChat, useSendMessage, useMarkChatRead } from '../../../../lib/chat'
import { useMatch } from '../../../../lib/matches'

/**
 * The match thread.
 *
 * The one screen that decides whether a group stops using WhatsApp. It only wins
 * if it does something the group chat cannot: announce the teams the moment they
 * are drawn, say which seat came free, and put "I can't come" one tap from the
 * conversation instead of buried in a menu.
 */
export default function MatchChatScreen() {
  const { t, i18n } = useTranslation()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  /**
   * The floating dock is absolutely positioned over every screen in the (app)
   * group — `href: null` hides its button, not the bar itself — so it sat on top
   * of the composer and swallowed the send button. Every other screen in the
   * group already clears it with DOCK_CLEARANCE; this one was the exception.
   *
   * Only while the keyboard is down: once it opens, the dock is behind it and
   * that clearance would strand the input mid-screen.
   */
  const [keyboardUp, setKeyboardUp] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardUp(true),
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardUp(false),
    )
    return () => { show.remove(); hide.remove() }
  }, [])
  const bottomClearance = keyboardUp ? 10 : DOCK_CLEARANCE

  const { data: match } = useMatch(matchId)
  const [focused, setFocused] = useState(true)
  // Polling stops the moment the screen is not on top; a backgrounded thread
  // costs nothing.
  const { data, isLoading } = useMatchChat(matchId, focused)
  const send = useSendMessage(matchId)
  const markRead = useMarkChatRead(matchId)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )

  // Opening the thread is reading it. Re-fired as messages land so the badge
  // does not reappear behind someone sitting on the screen watching it.
  //
  // Held in a ref because the mutation object is a new identity every render:
  // depending on it directly would mark-read in a loop, once per render, for as
  // long as the screen stays open.
  const messageCount = data?.messages.length ?? 0
  const markReadRef = useRef(markRead.mutate)
  markReadRef.current = markRead.mutate
  useEffect(() => {
    if (messageCount > 0) markReadRef.current()
  }, [messageCount])

  /** Group by calendar day so the separators mean something. */
  const rows = useMemo(() => {
    const out: Array<{ type: 'day'; label: string } | { type: 'msg'; message: MatchMessageView }> = []
    let lastDay: string | null = null
    for (const message of data?.messages ?? []) {
      const date = new Date(message.createdAt)
      const day = date.toDateString()
      if (day !== lastDay) {
        lastDay = day
        out.push({
          type: 'day',
          label: date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'short' }),
        })
      }
      out.push({ type: 'msg', message })
    }
    return out
  }, [data?.messages, i18n.language])

  const canSend = draft.trim().length > 0 && !send.isPending && (data?.isOpen ?? false)

  const submit = () => {
    if (!canSend) return
    const body = draft.trim()
    setDraft('')
    send.mutate(body, {
      // Put the text back rather than losing what someone typed.
      onError: () => setDraft(body),
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <PressableScale
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.inkSecondary} />
        </PressableScale>
        <View style={styles.navText}>
          <Text style={styles.navTitle} numberOfLines={1}>
            {match?.venueName ?? match?.city ?? t('chat.title')}
          </Text>
          {match && (
            <Text style={styles.navSub} numberOfLines={1}>
              {new Date(match.scheduledAt).toLocaleString(i18n.language, {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {isLoading && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

        {rows.map((row, index) =>
          row.type === 'day' ? (
            <ChatDaySeparator key={`day-${index}`} label={row.label} />
          ) : (
            <ChatMessage key={row.message.id} message={row.message} />
          ),
        )}
      </ScrollView>

      {data?.isOpen === false ? (
        <View style={[styles.closed, { paddingBottom: DOCK_CLEARANCE }]}>
          <Text style={styles.closedText}>{t('chat.closed')}</Text>
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: bottomClearance }]}>
          {/* The gesture that saves a match, one tap from the conversation —
              this is where people realise they can't make it. */}
          <PressableScale
            style={styles.quickWithdraw}
            onPress={() => router.push(`/(app)/match/${matchId}` as never)}
            accessibilityRole="button"
          >
            <Text style={styles.quickWithdrawText}>{t('chat.quick.cantCome')}</Text>
          </PressableScale>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={Colors.inkDisabled}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              multiline
              onSubmitEditing={submit}
            />
            <PressableScale
              style={[styles.send, !canSend && styles.sendOff]}
              onPress={submit}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
            >
              <Ionicons name="arrow-up" size={18} color={Colors.onPrimary} />
            </PressableScale>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { flex: 1, gap: 2 },
  navTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 15 },
  navSub: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 11 },
  thread: { flex: 1 },
  threadContent: { paddingHorizontal: 20, paddingVertical: 14, gap: 9 },
  loader: { marginTop: 24 },
  composer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  quickWithdraw: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  quickWithdrawText: { color: Colors.primary, fontFamily: Fonts.interSemiBold, fontSize: 11.5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: Colors.ink,
    fontFamily: Fonts.inter,
    fontSize: 13,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.35 },
  closed: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  closedText: {
    textAlign: 'center',
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 12,
    lineHeight: 17,
  },
})
