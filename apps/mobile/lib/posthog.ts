import PostHog from 'posthog-react-native'

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? ''

export const posthog = new PostHog(apiKey || 'phc_disabled', {
  host: 'https://eu.i.posthog.com',
  disabled: !apiKey,
  captureAppLifecycleEvents: false,
})
