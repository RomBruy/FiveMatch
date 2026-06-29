import { Stack } from 'expo-router'
import { Colors } from '../../constants/colors'

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.ink,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
      }}
    />
  )
}
