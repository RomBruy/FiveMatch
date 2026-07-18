import { Stack } from 'expo-router'

export default function GroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="roster" />
      <Stack.Screen name="settings" />
      <Stack.Screen
        name="card-reveal"
        options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="card-photo-settings"
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack>
  )
}
