import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  groups: { id: 'id', tier: 'tier', name: 'name', updatedAt: 'updated_at' },
  groupMemberships: { groupId: 'group_id', userId: 'user_id', role: 'role' },
}))

vi.mock('../notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import { db } from '../../db'
import { notificationService } from '../notifications/notification.service'
import { tierService } from './tier.service'
import { GROUP_TIER_THRESHOLDS } from '@fivematch/types/algorithm-constants'

function makeSelectLimit(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(resolved)
  return chain
}

function makeSelectWhere(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockResolvedValue(resolved)
  return chain
}

function makeUpdate() {
  const chain = { set: vi.fn(), where: vi.fn() }
  chain.set.mockReturnValue(chain)
  chain.where.mockResolvedValue(undefined)
  return chain
}

const GROUP_ID = 'group-uuid-1'
const GROUP_NAME = 'Test Group'
const MEMBERS = [{ userId: 'user-1' }, { userId: 'user-2' }]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tierService.evaluateTier — no tier change', () => {
  it('matchCount=0 stays amateur, changed=false, no notification', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([{ tier: 'amateur', name: GROUP_NAME }]) as unknown as ReturnType<typeof db.select>,
    )

    const result = await tierService.evaluateTier(GROUP_ID, 0)

    expect(result).toEqual({ previousTier: 'amateur', newTier: 'amateur', changed: false })
    expect(db.update).not.toHaveBeenCalled()
    expect(notificationService.send).not.toHaveBeenCalled()
  })

  it(`matchCount=${GROUP_TIER_THRESHOLDS.club - 1} stays amateur, changed=false`, async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([{ tier: 'amateur', name: GROUP_NAME }]) as unknown as ReturnType<typeof db.select>,
    )

    const result = await tierService.evaluateTier(GROUP_ID, GROUP_TIER_THRESHOLDS.club - 1)

    expect(result.newTier).toBe('amateur')
    expect(result.changed).toBe(false)
    expect(notificationService.send).not.toHaveBeenCalled()
  })

  it('matchCount=19 stays club when already club, changed=false', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([{ tier: 'club', name: GROUP_NAME }]) as unknown as ReturnType<typeof db.select>,
    )

    const result = await tierService.evaluateTier(GROUP_ID, 19)

    expect(result.newTier).toBe('club')
    expect(result.changed).toBe(false)
    expect(notificationService.send).not.toHaveBeenCalled()
  })
})

describe('tierService.evaluateTier — tier transitions', () => {
  it(`matchCount=${GROUP_TIER_THRESHOLDS.club} transitions amateur→club, changed=true, notification sent`, async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectLimit([{ tier: 'amateur', name: GROUP_NAME }]) as unknown as ReturnType<typeof db.select>,
      )
      .mockReturnValueOnce(
        makeSelectWhere(MEMBERS) as unknown as ReturnType<typeof db.select>,
      )
    vi.mocked(db.update).mockReturnValue(makeUpdate() as unknown as ReturnType<typeof db.update>)

    const result = await tierService.evaluateTier(GROUP_ID, GROUP_TIER_THRESHOLDS.club)

    expect(result).toEqual({ previousTier: 'amateur', newTier: 'club', changed: true })
    expect(db.update).toHaveBeenCalledOnce()
    expect(notificationService.send).toHaveBeenCalledOnce()
    expect(notificationService.send).toHaveBeenCalledWith({
      type: 'GROUP_TIER_CHANGED',
      groupId: GROUP_ID,
      groupName: GROUP_NAME,
      newTier: 'club',
      previousTier: 'amateur',
      recipientUserIds: ['user-1', 'user-2'],
    })
  })

  it(`matchCount=${GROUP_TIER_THRESHOLDS.semiPro} transitions club→semiPro, changed=true, notification sent`, async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectLimit([{ tier: 'club', name: GROUP_NAME }]) as unknown as ReturnType<typeof db.select>,
      )
      .mockReturnValueOnce(
        makeSelectWhere(MEMBERS) as unknown as ReturnType<typeof db.select>,
      )
    vi.mocked(db.update).mockReturnValue(makeUpdate() as unknown as ReturnType<typeof db.update>)

    const result = await tierService.evaluateTier(GROUP_ID, GROUP_TIER_THRESHOLDS.semiPro)

    expect(result).toEqual({ previousTier: 'club', newTier: 'semiPro', changed: true })
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GROUP_TIER_CHANGED', newTier: 'semiPro', previousTier: 'club' }),
    )
  })

  it(`matchCount=${GROUP_TIER_THRESHOLDS.elite} transitions semiPro→elite, changed=true, notification sent`, async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(
        makeSelectLimit([{ tier: 'semiPro', name: GROUP_NAME }]) as unknown as ReturnType<typeof db.select>,
      )
      .mockReturnValueOnce(
        makeSelectWhere(MEMBERS) as unknown as ReturnType<typeof db.select>,
      )
    vi.mocked(db.update).mockReturnValue(makeUpdate() as unknown as ReturnType<typeof db.update>)

    const result = await tierService.evaluateTier(GROUP_ID, GROUP_TIER_THRESHOLDS.elite)

    expect(result).toEqual({ previousTier: 'semiPro', newTier: 'elite', changed: true })
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GROUP_TIER_CHANGED', newTier: 'elite', previousTier: 'semiPro' }),
    )
  })
})
