import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { httpClient } from './api-client'
import type { MatchChatPage } from '@fivematch/types'

export const chatKeys = {
  thread: (matchId: string | undefined) => ['matches', matchId, 'messages'] as const,
}

/**
 * How often the thread refetches while the screen is focused.
 *
 * There is no socket, and deliberately so — it would be a new dependency and new
 * infrastructure for a thread that moves at conversation speed, not trading-floor
 * speed. Six seconds is under the threshold where a reply feels late in a chat,
 * and the query only polls while mounted, so a backgrounded app costs nothing.
 */
const POLL_MS = 6_000

export function useMatchChat(matchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.thread(matchId),
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MatchChatPage }>(
        `/v1/matches/${matchId}/messages`,
      )
      return data.data
    },
    enabled: Boolean(matchId) && enabled,
    refetchInterval: POLL_MS,
    // A thread is stale the moment you look away from it.
    staleTime: 0,
  })
}

export function useSendMessage(matchId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await httpClient.post(`/v1/matches/${matchId}/messages`, { body })
      return data
    },
    // Refetch rather than optimistically appending: the server assigns the id
    // and timestamp that ordering depends on, and a message that appears then
    // jumps position is worse than one that appears a beat later.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.thread(matchId) }),
  })
}

/**
 * Move the read high-water mark.
 *
 * Fire-and-forget: failing to record that someone read a thread should never
 * surface an error at them. The worst case is a badge that lingers until the
 * next open, which is a great deal better than an alert about bookkeeping.
 */
export function useMarkChatRead(matchId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => httpClient.post(`/v1/matches/${matchId}/messages/read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matches', matchId] })
    },
    onError: () => { /* see above */ },
  })
}
