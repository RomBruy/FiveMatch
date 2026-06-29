import { Expo } from 'expo-server-sdk'
import type { NotificationPayload } from '@fivematch/types'
import { db } from '../../db'
import { pushTokens, notificationPreferences } from '../../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { logger } from '../../lib/logger'

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
    case 'MATCH_CREATED': return `${payload.groupName} — Nouveau match`
    case 'ATTENDANCE_REMINDER': return 'Match bientôt — tu joues ?'
    case 'MATCH_FULL': return 'Match complet'
    case 'WAITLIST_SPOT_OPEN': return 'Place disponible !'
    default: return 'FiveMatch'
  }
}

function getBody(payload: NotificationPayload): string {
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
    case 'WAITLIST_SPOT_OPEN': return `Une place s'est libérée. Tu es maintenant confirmé(e).`
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
      data: { type: payload.type },
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
  send: (payload: NotificationPayload): void => {
    void dispatch(payload).catch((err: unknown) => {
      logger.error({ err, type: payload.type }, 'notification dispatch failed')
    })
  },
}
