import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@clerk/expo'
import { useQuery } from '@tanstack/react-query'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { httpClient } from '../lib/api-client'

interface GroupSummary {
  id: string
  name: string
  tier: string
  userRole: 'organizer' | 'member'
}

interface GroupContextValue {
  activeGroupId: string | null
  setActiveGroupId: (id: string | null) => void
  isReady: boolean
}

const GroupContext = createContext<GroupContextValue>({
  activeGroupId: null,
  setActiveGroupId: () => {},
  isReady: false,
})

export function GroupContextProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [storedGroupId, setStoredGroupId] = useState<string | null>(null)
  const [storageLoaded, setStorageLoaded] = useState(false)

  const storageKey = userId ? `fivematch:active-group:${userId}` : null

  useEffect(() => {
    let current = true
    setActiveGroupId(null)
    setStoredGroupId(null)
    setStorageLoaded(false)

    if (!storageKey) {
      setStorageLoaded(true)
      return () => { current = false }
    }

    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!current) return
      setStoredGroupId(value)
      setStorageLoaded(true)
    })

    return () => { current = false }
  }, [storageKey])

  const groupsQuery = useQuery({
    queryKey: ['users', 'me', 'groups'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { items: GroupSummary[] } }>('/v1/users/me/groups')
      return data.data.items
    },
    enabled: Boolean(userId) && storageLoaded,
  })

  useEffect(() => {
    if (!storageLoaded || !groupsQuery.data) return
    const storedStillExists = storedGroupId && groupsQuery.data.some((group) => group.id === storedGroupId)
    const nextGroupId = storedStillExists ? storedGroupId : (groupsQuery.data[0]?.id ?? null)
    setActiveGroupId(nextGroupId)
    if (storageKey && nextGroupId !== storedGroupId) {
      if (nextGroupId) void AsyncStorage.setItem(storageKey, nextGroupId)
      else void AsyncStorage.removeItem(storageKey)
    }
  }, [groupsQuery.data, storageKey, storageLoaded, storedGroupId])

  const selectGroup = useCallback((id: string | null) => {
    setActiveGroupId(id)
    setStoredGroupId(id)
    if (!storageKey) return
    if (id) void AsyncStorage.setItem(storageKey, id)
    else void AsyncStorage.removeItem(storageKey)
  }, [storageKey])

  const isReady = !userId || (storageLoaded && (groupsQuery.isFetched || groupsQuery.isError))

  return (
    <GroupContext.Provider value={{ activeGroupId, setActiveGroupId: selectGroup, isReady }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroupContext() {
  return useContext(GroupContext)
}
