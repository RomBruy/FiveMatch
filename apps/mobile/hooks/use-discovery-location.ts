import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useCallback, useEffect, useState } from 'react'

export interface DiscoveryLocation {
  latitude: number
  longitude: number
  city: string | null
  /** 'gps' when the device gave it to us, 'manual' when the user typed a city. */
  source: 'gps' | 'manual'
}

const STORAGE_KEY = 'fivematch:discovery-location'

/**
 * Where to look for matches.
 *
 * Deliberately never blocks the screen: discovery renders before permission is
 * resolved, and a refused permission is a normal state, not an error — the user
 * types a city instead. The last known position is cached so a cold start shows
 * results before the GPS fix lands.
 */
export function useDiscoveryLocation() {
  const [location, setLocation] = useState<DiscoveryLocation | null>(null)
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!active || !raw) return
      try {
        setLocation(JSON.parse(raw) as DiscoveryLocation)
      } catch {
        // A corrupt cache is not worth surfacing — fall back to asking again.
      }
    })
    return () => { active = false }
  }, [])

  const persist = useCallback(async (next: DiscoveryLocation | null) => {
    setLocation(next)
    if (next) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else await AsyncStorage.removeItem(STORAGE_KEY)
  }, [])

  const requestDeviceLocation = useCallback(async () => {
    setIsLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setPermission('denied')
        return null
      }
      setPermission('granted')

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).catch(() => [])

      const next: DiscoveryLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: place?.city ?? place?.subregion ?? null,
        source: 'gps',
      }
      await persist(next)
      return next
    } catch {
      setPermission('denied')
      return null
    } finally {
      setIsLocating(false)
    }
  }, [persist])

  /** Geocode a typed city so a denied permission still gets real distances. */
  const setManualCity = useCallback(async (city: string) => {
    const trimmed = city.trim()
    if (!trimmed) return null
    setIsLocating(true)
    try {
      const [match] = await Location.geocodeAsync(trimmed).catch(() => [])
      const next: DiscoveryLocation = match
        ? { latitude: match.latitude, longitude: match.longitude, city: trimmed, source: 'manual' }
        // No geocoder result still gives a usable filter: the API matches on city name.
        : { latitude: 0, longitude: 0, city: trimmed, source: 'manual' }
      await persist(next)
      return next
    } finally {
      setIsLocating(false)
    }
  }, [persist])

  const clear = useCallback(() => persist(null), [persist])

  return { location, permission, isLocating, requestDeviceLocation, setManualCity, clear }
}
