import React, { createContext, useContext, useState } from 'react'

interface GroupContextValue {
  activeGroupId: string | null
  setActiveGroupId: (id: string | null) => void
}

const GroupContext = createContext<GroupContextValue>({
  activeGroupId: null,
  setActiveGroupId: () => {},
})

export function GroupContextProvider({ children }: { children: React.ReactNode }) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  return (
    <GroupContext.Provider value={{ activeGroupId, setActiveGroupId }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroupContext() {
  return useContext(GroupContext)
}
