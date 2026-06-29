import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { httpClient } from '../lib/api-client'

export function usePushRegistration() {
  useEffect(() => {
    async function register() {
      if (!Device.isDevice) return // skip in simulator

      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') return // user denied — silent skip

      const tokenData = await Notifications.getExpoPushTokenAsync()
      const token = tokenData.data

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        })
      }

      await httpClient.post('/v1/users/me/push-token', { token })
    }

    register().catch(() => {
      // Silent fail — push registration failure must not crash the app
    })
  }, [])
}
