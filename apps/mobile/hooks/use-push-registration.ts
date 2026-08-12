import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { httpClient } from '../lib/api-client'

/**
 * Push permission, asked when it means something (AF-003).
 *
 * The prompt used to fire on app entry, before the user had seen a single
 * match. Asking then is asking a stranger for something with nothing offered in
 * return, and a denial is close to permanent — iOS will not show the system
 * dialog twice, so a reflexive "no" costs every future notification.
 *
 * Split in two:
 *
 * - `usePushRegistration` is silent. It registers a token only if permission is
 *   already granted, so a returning user's token stays fresh without any dialog.
 * - `requestPushPermission` is the ask, called after something happened that
 *   makes notifications obviously useful — joining a match, hosting one.
 */

async function registerToken(): Promise<void> {
  const tokenData = await Notifications.getExpoPushTokenAsync()

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    })
  }

  await httpClient.post('/v1/users/me/push-token', { token: tokenData.data })
}

/** Keep an already-granted token current. Never prompts. */
export function usePushRegistration() {
  useEffect(() => {
    async function sync() {
      if (!Device.isDevice) return

      const { status } = await Notifications.getPermissionsAsync()
      // The distinction that matters: only act on permission the user has
      // already given. Anything else waits for a contextual ask.
      if (status !== 'granted') return

      await registerToken()
    }

    sync().catch(() => {
      // Silent: a registration failure must never interrupt the app.
    })
  }, [])
}

/**
 * Ask for permission now, because the user just did something that
 * notifications serve. Safe to call repeatedly — it prompts at most once.
 *
 * Returns whether notifications are enabled afterwards, so a caller can decide
 * whether to explain what they will now be told about.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!Device.isDevice) return false

  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.status === 'granted') {
      await registerToken()
      return true
    }

    // Already refused. The OS will not show the dialog again, so asking would
    // do nothing except make the app look like it is nagging.
    if (!current.canAskAgain) return false

    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return false

    await registerToken()
    return true
  } catch {
    return false
  }
}
