import { Router } from 'express'
import { eq, and, inArray, isNull, count, ilike, sql } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { createGroupSchema, updateGroupSchema, transferOrganizerSchema } from './schemas'
import { db } from '../../db'
import { groups, groupMemberships, users, players, matchParticipants, matches, pronoBets } from '../../db/schema'
import { randomUUID } from 'crypto'
import { notificationService } from '../../services/notifications/notification.service'
import { ErrorCode } from '@fivematch/types'
import { PRONOS_STARTING_BANKROLL } from '@fivematch/types/algorithm-constants'
import { ovrService } from '../../services/players/ovr.service'
import { bankrollService } from '../../services/pronos/bankroll.service'

const router = Router()

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// GET /v1/groups/search — MUST be before /:groupId to prevent 'search' being captured as groupId
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = ((req.query['q'] as string) ?? '').trim()
    if (!q || q.length < 2) {
      return res.json({ data: { items: [] } })
    }
    const results = await db
      .select({ id: groups.id, name: groups.name, tier: groups.tier })
      .from(groups)
      .where(and(eq(groups.searchable, true), ilike(groups.name, `%${q}%`)))
      .limit(20)
    return res.json({ data: { items: results } })
  }),
)

// POST /v1/groups — create group + organizer membership in one transaction
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createGroupSchema.parse(req.body)
    const clerkUserId = req.user.userId

    const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.clerkUserId, clerkUserId))
    if (!user) {
      return res.status(404).json({
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'User not found', statusCode: 404 },
      })
    }

    const result = await db.transaction(async (tx) => {
      const [newGroup] = await tx
        .insert(groups)
        .values({
          organizerId: user.id,
          name: body.name,
          formatPreset: body.formatPreset,
          goalkeeperMode: body.goalkeeperMode,
          playStyle: body.playStyle ?? null,
          generatorStyle: body.generatorStyle,
          tier: 'amateur',
          matchCount: 0,
        })
        .returning()

      await tx.insert(groupMemberships).values({
        groupId: newGroup.id,
        userId: user.id,
        role: 'organizer',
        joinedAt: new Date(),
      })

      // The organizer plays too — without this row they are invisible to
      // attendance, the leaderboard, and cards (the approve flow creates it
      // for every other member).
      await tx.insert(players).values({
        groupId: newGroup.id,
        userId: user.id,
        displayName: user.name ?? 'Player',
        matchCount: 0,
      })

      return newGroup
    })

    return res.status(201).json({ data: result })
  }),
)

// POST /v1/groups/:groupId/invite/generate — organizer only
router.post(
  '/:groupId/invite/generate',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const groupId = req.params['groupId'] as string
    const inviteCode = generateInviteCode()
    const [updated] = await db
      .update(groups)
      .set({ inviteCode, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning()
    return res.json({
      data: {
        inviteCode: updated.inviteCode,
        inviteLink: `fivematch://join/${updated.inviteCode}`,
      },
    })
  }),
)

// POST /v1/groups/:groupId/join — any authenticated user, no membership gate
router.post(
  '/:groupId/join',
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string
    const clerkUserId = req.user.userId

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId))
    if (!user) {
      return res.status(404).json({
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'User not found', statusCode: 404 },
      })
    }

    const [existing] = await db
      .select({ role: groupMemberships.role, deletedAt: groupMemberships.deletedAt })
      .from(groupMemberships)
      .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, user.id)))
      .limit(1)

    if (existing && !existing.deletedAt) {
      return res.status(409).json({
        error: { code: ErrorCode.ALREADY_A_MEMBER, message: 'Already a member or request pending', statusCode: 409 },
      })
    }

    if (existing && existing.deletedAt) {
      const [revived] = await db
        .update(groupMemberships)
        .set({ role: 'pending_member', deletedAt: null, joinedAt: null, createdAt: new Date() })
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, user.id)))
        .returning()
      const [groupForOrg] = await db
        .select({ organizerId: groups.organizerId })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1)
      if (groupForOrg) {
        notificationService.send({ type: 'JOIN_REQUEST_RECEIVED', groupId, recipientUserId: groupForOrg.organizerId })
      }
      return res.status(201).json({ data: revived })
    }

    const [membership] = await db.insert(groupMemberships).values({
      groupId,
      userId: user.id,
      role: 'pending_member',
    }).returning()

    const [groupForNotif] = await db
      .select({ organizerId: groups.organizerId })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1)
    if (groupForNotif) {
      notificationService.send({ type: 'JOIN_REQUEST_RECEIVED', groupId, recipientUserId: groupForNotif.organizerId })
    }

    return res.status(201).json({ data: membership })
  }),
)

// GET /v1/groups/:groupId/pending-info — inline pending_member check (NOT behind requireGroupMember)
router.get(
  '/:groupId/pending-info',
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string
    const clerkUserId = req.user.userId

    const [membership] = await db
      .select({ role: groupMemberships.role })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .where(and(
        eq(users.clerkUserId, clerkUserId),
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.role, 'pending_member'),
      ))
      .limit(1)

    if (!membership) {
      return res.status(403).json({
        error: { code: ErrorCode.NOT_A_MEMBER, message: 'Not a pending member', statusCode: 403 },
      })
    }

    const [group] = await db
      .select({ name: groups.name, organizerId: groups.organizerId })
      .from(groups)
      .where(eq(groups.id, groupId))

    const [organizer] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, group.organizerId))

    const [{ value: memberCount }] = await db
      .select({ value: count() })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, ['member', 'organizer']),
      ))

    return res.json({
      data: {
        groupName: group.name,
        organizerDisplayName: organizer?.name ?? 'Organizer',
        memberCount: Number(memberCount),
      },
    })
  }),
)

// GET /v1/groups/:groupId/my-status — returns current user's role in the group, no membership gate
router.get(
  '/:groupId/my-status',
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string
    const clerkUserId = req.user.userId

    const [row] = await db
      .select({ role: groupMemberships.role })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .where(and(eq(users.clerkUserId, clerkUserId), eq(groupMemberships.groupId, groupId)))
      .limit(1)

    return res.json({ data: { role: row?.role ?? null } })
  }),
)

// GET /v1/groups/:groupId/join-requests — organizer only
router.get(
  '/:groupId/join-requests',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const groupId = req.params['groupId'] as string

    const items = await db
      .select({
        userId: users.id,
        displayName: users.name,
        requestedAt: groupMemberships.createdAt,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .where(and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.role, 'pending_member'),
      ))

    return res.json({ data: { items } })
  }),
)

// GET /v1/groups/:groupId/roster — list active members (organizer or member)
router.get(
  '/:groupId/roster',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string

    const items = await db
      .select({
        userId: users.id,
        displayName: users.name,
        joinedAt: groupMemberships.joinedAt,
        matchCount: players.matchCount,
        role: groupMemberships.role,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .leftJoin(
        players,
        and(eq(players.groupId, groupId), eq(players.userId, users.id), isNull(players.deletedAt)),
      )
      .where(and(
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, ['member', 'organizer']),
        isNull(groupMemberships.deletedAt),
      ))

    return res.json({ data: { items } })
  }),
)

// GET /v1/groups/:groupId/leaderboard — any group member
router.get(
  '/:groupId/leaderboard',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }

    // 1. Load group matchCount for attendanceRate
    const [group] = await db
      .select({ matchCount: groups.matchCount })
      .from(groups)
      .where(eq(groups.id, groupId))

    const groupMatchCount = group?.matchCount ?? 0

    // 2. Load all active players with OVR data
    const playerRows = await db
      .select({
        id: players.id,
        displayName: players.displayName,
        cardState: players.cardState,
        matchCount: players.matchCount,
        ovrScoreFloat: players.ovrScoreFloat,
        previousOvrScoreFloat: players.previousOvrScoreFloat,
        playerTier: players.playerTier,
        avgPace: players.avgPace,
        avgTechnique: players.avgTechnique,
        avgPassing: players.avgPassing,
        avgDefending: players.avgDefending,
        avgPhysicality: players.avgPhysicality,
        avgEffort: players.avgEffort,
      })
      .from(players)
      .where(and(eq(players.groupId, groupId), isNull(players.deletedAt)))

    // 3. Aggregate total goals and assists per player from match_participants
    const goalRows = await db
      .select({
        playerId: matchParticipants.playerId,
        totalGoals: sql<number>`SUM(${matchParticipants.goalsScored})::int`.as('total_goals'),
        totalAssists: sql<number>`SUM(${matchParticipants.assists})::int`.as('total_assists'),
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .where(and(
        eq(matches.groupId, groupId),
        eq(matches.status, 'completed'),
      ))
      .groupBy(matchParticipants.playerId)

    const goalMap = new Map(goalRows.map((r) => [r.playerId, r]))

    // 4. Compute trend and apply OVR visibility gate
    const mapped = playerRows.map((row) => {
      const goals = goalMap.get(row.id)
      const totalGoals = goals?.totalGoals ?? 0
      const totalAssists = goals?.totalAssists ?? 0

      const currentFloat = row.ovrScoreFloat ? parseFloat(row.ovrScoreFloat) : null
      const previousFloat = row.previousOvrScoreFloat ? parseFloat(row.previousOvrScoreFloat) : null
      const displayOvr = ovrService.getOvrForDisplay(currentFloat, row.matchCount)

      let trend: 'up' | 'down' | 'stable' | null = null
      if (currentFloat !== null && previousFloat !== null) {
        const computedTrend = ovrService.computeTrend(previousFloat, currentFloat)
        if (computedTrend === 'Trending up') trend = 'up'
        else if (computedTrend === 'Trending down') trend = 'down'
        else trend = 'stable'
      }

      const hasAttributes = row.avgPace !== null
      const attributes = hasAttributes
        ? {
            pace: parseFloat(row.avgPace!),
            technique: parseFloat(row.avgTechnique!),
            passing: parseFloat(row.avgPassing!),
            defending: parseFloat(row.avgDefending!),
            physicality: parseFloat(row.avgPhysicality!),
            effort: parseFloat(row.avgEffort!),
          }
        : null

      const attendanceRate = groupMatchCount > 0
        ? Math.min(100, Math.round((row.matchCount / groupMatchCount) * 100))
        : null

      return {
        playerId: row.id,
        displayName: row.displayName,
        cardState: row.cardState,
        matchCount: row.matchCount,
        ovrScore: displayOvr,
        trend,
        playerTier: row.playerTier,
        attributes,
        totalGoals,
        totalAssists,
        attendanceRate,
      }
    })

    // 5. Sort: unlocked players by ovrScore desc, then locked by matchCount desc
    const unlocked = mapped
      .filter((p) => p.cardState === 'unlocked' && p.ovrScore !== null)
      .sort((a, b) => (b.ovrScore ?? 0) - (a.ovrScore ?? 0))
      .map((p, i) => ({ ...p, rank: i + 1 }))

    const locked = mapped
      .filter((p) => p.cardState !== 'unlocked' || p.ovrScore === null)
      .sort((a, b) => b.matchCount - a.matchCount)
      .map((p) => ({ ...p, rank: null }))

    return res.json({
      data: {
        players: [...unlocked, ...locked],
        groupMatchCount,
      },
    })
  }),
)

// GET /v1/groups/:groupId/pronos/leaderboard — bankroll leaderboard, group-scoped (Story 11.6)
//
// Ranks by balance, not by the Epic 6 flat points: the biggest winner leads and accuracy
// drops to a secondary stat. Only members with at least one bet appear — a board of
// members who never bet would be a wall of identical starting bankrolls, and the rank-1
// "biggest better" badge on someone who never placed a bet would be nonsense.
router.get(
  '/:groupId/pronos/leaderboard',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }

    // Resolved independently of the board below: Profil calls this endpoint purely for the
    // caller's playerId, and must still get it when the caller has never placed a bet.
    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId), isNull(players.deletedAt)))

    const myPlayerId = callerPlayer?.id ?? null

    // One query, one row per bet, carrying the player's cached balance. The balance is the
    // column bankrollService maintains transactionally — never recomputed per player here.
    const rows = await db
      .select({
        playerId: players.id,
        displayName: players.displayName,
        balance: players.pronosBalance,
        status: pronoBets.status,
      })
      .from(players)
      .innerJoin(pronoBets, eq(pronoBets.playerId, players.id))
      .where(and(eq(players.groupId, groupId), isNull(players.deletedAt)))

    const statsMap = new Map<string, {
      playerId: string
      displayName: string
      balance: number
      betsPlaced: number
      betsSettled: number
      betsWon: number
    }>()

    for (const row of rows) {
      const entry = statsMap.get(row.playerId) ?? {
        playerId: row.playerId,
        displayName: row.displayName,
        balance: row.balance,
        betsPlaced: 0,
        betsSettled: 0,
        betsWon: 0,
      }
      entry.betsPlaced += 1
      // A close refund is a soft landing, not a win — it counts against accuracy.
      if (row.status !== 'pending') entry.betsSettled += 1
      if (row.status === 'won') entry.betsWon += 1
      statsMap.set(row.playerId, entry)
    }

    const leaderboard = [...statsMap.values()]
      .map((entry) => ({
        ...entry,
        accuracyRate: entry.betsSettled > 0 ? entry.betsWon / entry.betsSettled : 0,
      }))
      // Deterministic all the way down — equal balances must not shuffle between calls.
      .sort((a, b) =>
        b.balance - a.balance ||
        b.accuracyRate - a.accuracyRate ||
        a.displayName.localeCompare(b.displayName),
      )
      .map((entry, idx) => ({ rank: idx + 1, ...entry }))

    return res.json({ data: { leaderboard, myPlayerId } })
  }),
)

// GET /v1/groups/:groupId/pronos/bankroll — the caller's group-scoped betting balance.
// Group-scoped rather than per-match: the Pronos tab hero and the bet slip's "solde après"
// are the same number, and `GET matches/:matchId/pronos/bets/my` only answers per match.
router.get(
  '/:groupId/pronos/bankroll',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }

    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId), isNull(players.deletedAt)))

    if (!callerPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_MEMBER, statusCode: 403 } })
    }

    const balance = await bankrollService.getBalance(callerPlayer.id)

    return res.json({ data: { balance, startingBankroll: PRONOS_STARTING_BANKROLL } })
  }),
)

// GET /v1/groups/:groupId — get group details (member gate applied)
router.get(
  '/:groupId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId))
    if (!group) {
      return res.status(404).json({
        error: { code: ErrorCode.GROUP_NOT_FOUND, message: 'Group not found', statusCode: 404 },
      })
    }
    return res.json({ data: group })
  }),
)

// PATCH /v1/groups/:groupId — update group settings (organizer only)
router.patch(
  '/:groupId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const body = updateGroupSchema.parse(req.body)
    const patchGroupId = req.params['groupId'] as string
    const [updated] = await db
      .update(groups)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(groups.id, patchGroupId))
      .returning()
    return res.json({ data: updated })
  }),
)

// POST /v1/groups/:groupId/members/:userId/approve — organizer only, atomic transaction
router.post(
  '/:groupId/members/:userId/approve',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const groupId = req.params['groupId'] as string
    const targetUserId = req.params['userId'] as string

    const [pendingRow] = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.userId, targetUserId),
        eq(groupMemberships.role, 'pending_member'),
      ))
      .limit(1)

    if (!pendingRow) {
      return res.status(404).json({
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'No pending request found', statusCode: 404 },
      })
    }

    await db.transaction(async (tx) => {
      await tx
        .update(groupMemberships)
        .set({ role: 'member', joinedAt: new Date() })
        .where(and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, targetUserId),
        ))

      const [targetUser] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, targetUserId))

      const [existingPlayer] = await tx
        .select({ id: players.id })
        .from(players)
        .where(and(eq(players.groupId, groupId), eq(players.userId, targetUserId)))
        .limit(1)

      if (existingPlayer) {
        await tx.update(players)
          .set({ displayName: targetUser?.name ?? 'Player', deletedAt: null, matchCount: 0 })
          .where(and(eq(players.groupId, groupId), eq(players.userId, targetUserId)))
      } else {
        await tx.insert(players).values({
          groupId,
          userId: targetUserId,
          displayName: targetUser?.name ?? 'Player',
          matchCount: 0,
        })
      }
    })

    const [group] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId))
    notificationService.send({
      type: 'JOIN_APPROVED',
      groupId,
      groupName: group?.name ?? '',
      recipientUserId: targetUserId,
    })

    return res.json({ data: { approved: true } })
  }),
)

// POST /v1/groups/:groupId/members/:userId/reject — organizer only
router.post(
  '/:groupId/members/:userId/reject',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const groupId = req.params['groupId'] as string
    const targetUserId = req.params['userId'] as string

    await db.delete(groupMemberships).where(and(
      eq(groupMemberships.groupId, groupId),
      eq(groupMemberships.userId, targetUserId),
      eq(groupMemberships.role, 'pending_member'),
    ))

    notificationService.send({ type: 'JOIN_REJECTED', groupId, recipientUserId: targetUserId })

    return res.json({ data: { rejected: true } })
  }),
)

// DELETE /v1/groups/:groupId/members/:userId — organizer only, soft-delete
router.delete(
  '/:groupId/members/:userId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const groupId = req.params['groupId'] as string
    const targetUserId = req.params['userId'] as string

    if (req.user.internalId === targetUserId) {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer cannot remove themselves', statusCode: 403 },
      })
    }

    const [targetMembership] = await db
      .select({ userId: groupMemberships.userId, role: groupMemberships.role })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.userId, targetUserId),
        inArray(groupMemberships.role, ['member', 'organizer']),
        isNull(groupMemberships.deletedAt),
      ))
      .limit(1)

    if (!targetMembership) {
      return res.status(404).json({
        error: { code: ErrorCode.MEMBER_NOT_FOUND, message: 'Member not found', statusCode: 404 },
      })
    }

    await db.transaction(async (tx) => {
      const now = new Date()

      await tx
        .update(groupMemberships)
        .set({ deletedAt: now })
        .where(and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, targetUserId),
        ))

      await tx
        .update(players)
        .set({ deletedAt: now })
        .where(and(
          eq(players.groupId, groupId),
          eq(players.userId, targetUserId),
        ))

      // Anonymize match_participants rows for this user in this group.
      // Join through matches to scope to this group only.
      const participantRows = await tx
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
        .where(and(
          eq(matchParticipants.userId, targetUserId),
          eq(matches.groupId, groupId),
        ))

      for (const row of participantRows) {
        await tx
          .update(matchParticipants)
          .set({ userId: null, playerId: null, displayName: `Joueur_${randomUUID().slice(0, 8).toUpperCase()}` })
          .where(eq(matchParticipants.id, row.id))
      }
    })

    return res.json({ data: { removed: true } })
  }),
)

// POST /v1/groups/:groupId/transfer-organizer — organizer only
router.post(
  '/:groupId/transfer-organizer',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    if (req.user.groupRole !== 'organizer') {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Organizer access required', statusCode: 403 },
      })
    }
    const groupId = req.params['groupId'] as string
    const { newOrganizerId } = transferOrganizerSchema.parse(req.body)

    const [targetMembership] = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.userId, newOrganizerId),
        eq(groupMemberships.role, 'member'),
        isNull(groupMemberships.deletedAt),
      ))
      .limit(1)

    if (!targetMembership) {
      return res.status(404).json({
        error: { code: ErrorCode.MEMBER_NOT_FOUND, message: 'Target member not found or not an active member', statusCode: 404 },
      })
    }

    await db.transaction(async (tx) => {
      await tx
        .update(groupMemberships)
        .set({ role: 'organizer' })
        .where(and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, newOrganizerId),
        ))

      await tx
        .update(groupMemberships)
        .set({ role: 'member' })
        .where(and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.userId, req.user.internalId!),
        ))
    })

    notificationService.send({ type: 'ORGANIZER_TRANSFERRED', groupId, recipientUserId: newOrganizerId })

    return res.json({ data: { transferred: true } })
  }),
)

export default router
