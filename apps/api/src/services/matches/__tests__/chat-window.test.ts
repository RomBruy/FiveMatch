import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../db', () => ({ db: {} }))
vi.mock('../../../db/schema', () => ({
  matches: {}, matchAttendances: {}, matchMessages: {}, matchMessageReads: {}, players: {},
}))

import { chatService } from '../chat.service'
import { CHAT_CLOSES_AFTER_HOURS } from '@fivematch/types'

const KICKOFF = new Date('2026-09-03T19:00:00Z')
const at = (offsetHours: number) =>
  new Date(KICKOFF.getTime() + offsetHours * 3_600_000)

const match = (status = 'attendance_locked') => ({ scheduledAt: KICKOFF, status })

describe('chat window', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is open well before kickoff — the thread is for organising, not just playing', () => {
    vi.setSystemTime(at(-72))
    expect(chatService.isOpen(match())).toBe(true)
  })

  it('stays open after the final whistle', () => {
    // The third half, the score argument and "who has my jumper" all happen
    // afterwards. Closing at 90 minutes pushes exactly that back to WhatsApp.
    vi.setSystemTime(at(2))
    expect(chatService.isOpen(match('completed'))).toBe(true)
  })

  it('is still open one minute inside the 48 h window', () => {
    vi.setSystemTime(new Date(at(CHAT_CLOSES_AFTER_HOURS).getTime() - 60_000))
    expect(chatService.isOpen(match('completed'))).toBe(true)
  })

  it('closes once past 48 h — a thread that never ends is just a group chat', () => {
    vi.setSystemTime(new Date(at(CHAT_CLOSES_AFTER_HOURS).getTime() + 60_000))
    expect(chatService.isOpen(match('completed'))).toBe(false)
  })

  it('closes immediately when the match is cancelled, however early', () => {
    // Nothing left to organise, and leaving it open only invites a post-mortem.
    vi.setSystemTime(at(-72))
    expect(chatService.isOpen(match('cancelled'))).toBe(false)
  })
})
