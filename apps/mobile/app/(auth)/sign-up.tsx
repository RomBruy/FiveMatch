import { useEffect } from 'react'
import { useRouter } from 'expo-router'

export default function SignUp() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/(auth)/sign-in')
  }, [])

  return null
}
