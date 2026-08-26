import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { httpClient } from './api-client'
import { useMyMatches } from './matches'
import { useGroupContext } from '../contexts/GroupContext'
import type { PrivatePlayerProfile } from '@fivematch/types'

const SEEN_KEY = 'onboarding.tutorial.seen'
const CHECKLIST_DISMISSED_KEY = 'onboarding.checklist.dismissed'

/**
 * Shared across every caller, deliberately.
 *
 * Two components need this flag — the layout that renders the overlay, and the
 * help screen that replays it — and they are mounted at the same time. With
 * per-hook state, tapping "revoir le tutoriel" would update the help screen's
 * copy and leave the layout still believing it had been seen, so nothing would
 * happen until the app was restarted.
 *
 * A module-level value plus a subscriber set, rather than a context: no provider
 * to thread through the tree, and no dependency for what is one boolean.
 */
let seenValue: boolean | null = null
const seenSubscribers = new Set<(next: boolean | null) => void>()

function publishSeen(next: boolean | null) {
  seenValue = next
  for (const notify of seenSubscribers) notify(next)
}

/**
 * Has the tutorial been shown?
 *
 * Stored locally rather than on the player: it is a property of this install,
 * not of the account. Reinstalling and being shown the four steps again is
 * correct — you are on a new device with no idea where anything is.
 *
 * `null` means storage has not answered yet. Callers must render nothing in that
 * state rather than assuming false, or the tutorial flashes on every cold start.
 */
export function useTutorialSeen() {
  const [seen, setSeen] = useState<boolean | null>(seenValue)

  useEffect(() => {
    seenSubscribers.add(setSeen)
    if (seenValue === null) {
      void AsyncStorage.getItem(SEEN_KEY).then((v) => publishSeen(v === '1'))
    }
    return () => { seenSubscribers.delete(setSeen) }
  }, [])

  const markSeen = useCallback(() => {
    publishSeen(true)
    void AsyncStorage.setItem(SEEN_KEY, '1')
  }, [])

  /** Replay from Aide. Never fired automatically — see the note above. */
  const replay = useCallback(() => {
    publishSeen(false)
    void AsyncStorage.removeItem(SEEN_KEY)
  }, [])

  return { seen, markSeen, replay }
}

export type StarterTaskId = 'match' | 'photo' | 'vestiaire' | 'crew'

export interface StarterTask {
  id: StarterTaskId
  done: boolean
  route: string
}

/**
 * The starter checklist.
 *
 * Every task is **derived from real state**, never from "did they tap the row".
 * A checklist that ticks itself when you visit a screen is a progress bar
 * pretending to be a to-do list, and people spot it immediately.
 *
 * That constraint is what picked these four: each is a fact the app already
 * fetches. "Say hello in the chat" was in the design and is not here, because
 * proving it would need an endpoint that does not exist, and a box you tick by
 * tapping would have been worse than leaving it out.
 */
export function useStarterChecklist() {
  const { activeGroupId } = useGroupContext()
  const { data: matches } = useMyMatches('upcoming')
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['players', 'me'],
    queryFn: () =>
      httpClient.get<{ data: PrivatePlayerProfile }>('/v1/players/me').then((r) => r.data.data),
  })

  useEffect(() => {
    void AsyncStorage.getItem(CHECKLIST_DISMISSED_KEY).then((v) => setDismissed(v === '1'))
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
    void AsyncStorage.setItem(CHECKLIST_DISMISSED_KEY, '1')
  }, [])

  const tasks: StarterTask[] = [
    {
      id: 'match',
      // Booked or already played — either way they have been through the loop once.
      done: (matches?.length ?? 0) > 0 || (profile?.eligibleMatchCount ?? 0) > 0,
      route: '/(app)',
    },
    {
      id: 'photo',
      done: Boolean(profile?.photoUrl ?? profile?.generatedCardPhotoUrl),
      route: '/(app)/profile/card-photo',
    },
    {
      id: 'vestiaire',
      done: Boolean(profile?.personality?.favoriteExcuse ?? profile?.personality?.specialSkill),
      route: '/(app)/profile/edit',
    },
    { id: 'crew', done: Boolean(activeGroupId), route: '/(app)/crew' },
  ]

  const doneCount = tasks.filter((task) => task.done).length

  return {
    tasks,
    doneCount,
    total: tasks.length,
    /**
     * Hidden once finished, and it stays hidden — it files itself away rather
     * than sitting there as a completed trophy taking up the best space on the
     * screen. Also hidden while storage is still answering.
     */
    visible: dismissed === false && doneCount < tasks.length,
    dismiss,
  }
}
