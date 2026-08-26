import { Expo } from 'expo-server-sdk'
import type { NotificationPayload } from '@fivematch/types'
import { db } from '../../db'
import { pushTokens, notificationPreferences } from '../../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { logger } from '../../lib/logger'
import { notificationOutboxService } from './outbox.service'

const expo = new Expo()

function getTitle(payload: NotificationPayload): string {
  switch (payload.type) {
    case 'JOIN_REQUEST_RECEIVED': return 'New join request'
    case 'JOIN_APPROVED': return `Welcome to ${payload.groupName}`
    case 'JOIN_REJECTED': return 'Join request declined'
    case 'ORGANIZER_TRANSFERRED': return "You're the new organizer"
    case 'TEAMS_LOCKED': return 'Teams are set'
    case 'CARD_UNLOCKED': return 'Your card is ready'
    case 'CARD_INITIAL_UNLOCKED': return 'Your card is being built'
    case 'PLAYER_TIER_CHANGED': return 'Tier change'
    case 'GROUP_TIER_CHANGED': return `${payload.groupName} — Nouveau tier`
    case 'MATCH_CREATED': return payload.groupName ? `${payload.groupName} — Nouveau match` : 'Nouveau match'
    case 'ATTENDANCE_REMINDER': return 'Match bientôt — tu joues ?'
    case 'MATCH_FULL': return 'Match complet'
    case 'SPOT_CLAIMED': return 'Une place vient d’être prise'
    case 'WAITLIST_SPOT_OPEN': return 'Place disponible !'
    case 'PLAYER_WITHDREW': return 'Un joueur se désiste'
    default: return 'FiveMatch'
  }
}

/** Exported for tests — push copy is a deliverable, not an implementation detail. */
export function getBody(payload: NotificationPayload): string {
  switch (payload.type) {
    case 'JOIN_REQUEST_RECEIVED': return 'Someone wants to join your group.'
    case 'JOIN_APPROVED': return `You're now a member of ${payload.groupName}.`
    case 'JOIN_REJECTED': return 'Your request to join was declined.'
    case 'ORGANIZER_TRANSFERRED': return 'You are now the organizer of your group.'
    case 'TEAMS_LOCKED': return 'Check your team assignment.'
    case 'CARD_UNLOCKED': return 'Your Panini card has unlocked. Tap to reveal.'
    case 'CARD_INITIAL_UNLOCKED': return 'The squad has rated you. Your Panini card is being built.'
    case 'PLAYER_TIER_CHANGED': return `Ton tier joueur est passé à ${payload.newTier}.`
    case 'GROUP_TIER_CHANGED': return `Le groupe a atteint le niveau ${payload.newTier}.`
    case 'MATCH_CREATED': return `Un match est prévu le ${new Date(payload.scheduledAt).toLocaleDateString('fr-FR')}.`
    case 'ATTENDANCE_REMINDER': return 'Le match approche. Confirme ta présence maintenant.'
    case 'MATCH_FULL': return 'Toutes les places sont prises pour ce match.'
    case 'SPOT_CLAIMED': return payload.spotsRemaining > 0
      ? `${payload.playerDisplayName} a rejoint le match. ${payload.spotsRemaining} place(s) restante(s).`
      : `${payload.playerDisplayName} a rejoint le match. L'effectif est complet.`
    case 'WAITLIST_SPOT_OPEN': return `Une place s'est libérée. Tu es maintenant confirmé(e).`
    // Lead with the number the host acts on, not the name. "Il manque 1 joueur"
    // is a decision; "X s'est désisté" is only news. The reason is appended when
    // stated because it changes whether the host chases a replacement at all.
    case 'PLAYER_WITHDREW': {
      const gap = payload.spotsRemaining > 0
        ? `Il manque ${payload.spotsRemaining} joueur(s).`
        : `L'effectif est toujours complet.`
      const why = payload.reason === 'injured'
        ? ' (blessé)'
        : payload.reason === 'wrong_date'
          ? ' (erreur de date)'
          : ''
      return `${payload.playerDisplayName} ne peut plus venir${why}. ${gap}`
    }
    default: return 'You have a new notification.'
  }
}

function getRecipientIds(payload: NotificationPayload): string[] {
  if ('recipientUserId' in payload) return [payload.recipientUserId]
  if ('recipientUserIds' in payload) return payload.recipientUserIds
  return []
}

async function dispatch(payload: NotificationPayload): Promise<void> {
  const recipientIds = getRecipientIds(payload)
  if (recipientIds.length === 0) return

  const tokenRows = await db
    .select({ userId: pushTokens.userId, token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, recipientIds))

  if (tokenRows.length === 0) return

  const disabledPrefs = await db
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(and(
      inArray(notificationPreferences.userId, recipientIds),
      eq(notificationPreferences.type, payload.type),
      eq(notificationPreferences.enabled, false),
    ))
  const disabledSet = new Set(disabledPrefs.map((p) => p.userId))

  const messages = tokenRows
    .filter((t) => !disabledSet.has(t.userId))
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title: getTitle(payload),
      body: getBody(payload),
      // matchId travels with every match-scoped notification so the app can
      // deep-link straight to the match instead of dumping the user on a tab.
      data: {
        type: payload.type,
        ...('matchId' in payload ? { matchId: payload.matchId } : {}),
        ...('groupId' in payload && payload.groupId ? { groupId: payload.groupId } : {}),
        ...('playerId' in payload ? { playerId: payload.playerId } : {}),
      },
    }))

  if (messages.length === 0) return

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk)
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        logger.error({ error: ticket.details, type: payload.type }, 'expo push ticket error')
      }
    }
  }
}

export const notificationService = {
  /**
   * Queue a notification.
   *
   * This used to call Expo directly and swallow the failure, so a provider
   * blip, a network fault or a restart mid-flight lost the notification for
   * good. Now it writes a row and returns; a worker delivers it, retries it,
   * and eventually dead-letters it where somebody can see.
   *
   * Still void-returning so the twenty-five existing call sites are unchanged.
   * Callers that need the notification to be part of their transaction should
   * use `enqueue` with a `tx` instead.
   */
  send: (payload: NotificationPayload): void => {
    void notificationOutboxService.enqueue(payload).catch((err: unknown) => {
      logger.error({ err, type: payload.type }, 'notification enqueue failed')
    })
  },

  /**
   * Queue inside a caller's transaction, so the intention to notify commits or
   * rolls back with the change that caused it.
   */
  enqueue: notificationOutboxService.enqueue,

  /** Delivery. Called by the outbox worker, not by application code. */
  deliver: dispatch,
}
