import { AccessibilityInfo } from 'react-native'
import { useEffect, useState } from 'react'

/** All motion respects prefers-reduced-motion → immediate crossfade (DESIGN.md motion table). */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])

  return reduceMotion
}
