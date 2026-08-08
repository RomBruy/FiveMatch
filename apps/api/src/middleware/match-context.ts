import { Request, Response, NextFunction } from 'express'
import { and, eq, isNull } from 'drizzle-orm'
import { ErrorCode } from '@fivematch/types'
import type { MatchCapabilities } from '@fivematch/types'
import { db } from '../db'
import { matches, players, users } from '../db/schema'
import type { Match } from '../db/schema'
import {
  resolveMatchCapabilities,
  type EvaluatedMatchCapabilities,
  type MatchRelation,
} from '../services/permissions/capability.service'

/**
 * How the caller relates to a match. Everything downstream authorizes on this
 * rather than on group membership, because a match may have no group at all.
 *
 *   host        — created it; can lock, generate teams, record the result
 *   participant — on the attendance sheet, however they got there
 *   crew        — in the match's group but hasn't responded yet
 *   viewer      — none of the above, but the match is public so they can read it
 */
export type { MatchRelation } from '../services/permissions/capability.service'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      match: Match
      matchRelation: MatchRelation
      matchCapabilities: EvaluatedMatchCapabilities
    }
  }
}

/**
 * Resolves the caller's global player identity once per request.
 *
 * `players` is 1:1 with `users` now, so this replaces the (userId, groupId)
 * lookup that used to be repeated in every handler. A user who has completed
 * onboarding always has a player row; one who hasn't gets `playerId` undefined
 * and is rejected by anything that needs it.
 */
export async function attachPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [row] = await db
      .select({ internalId: users.id, playerId: players.id })
      .from(users)
      .leftJoin(players, and(eq(players.userId, users.id), isNull(players.deletedAt)))
      .where(eq(users.clerkUserId, req.user.userId))
      .limit(1)

    if (!row) {
      res.status(404).json({
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'User not found', statusCode: 404 },
      })
      return
    }

    req.user.internalId = row.internalId
    req.user.playerId = row.playerId ?? undefined
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Loads `:matchId` and works out the caller's relation to it. Requires
 * `attachPlayer` upstream. Rejects with 404 rather than 403 for matches the
 * caller may not see — a private match should not be probeable by id.
 */
export async function loadMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const matchId = req.params['matchId'] as string

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    if (!match) {
      res.status(404).json({
        error: { code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found', statusCode: 404 },
      })
      return
    }

    const capabilities = await resolveMatchCapabilities(match, req.user.internalId!, req.user.playerId)

    // A private match is invisible to anyone with no tie to it.
    if (!capabilities.canViewMatch) {
      res.status(404).json({
        error: { code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found', statusCode: 404 },
      })
      return
    }

    req.match = match
    req.matchRelation = capabilities.viewerRelation
    req.matchCapabilities = capabilities
    next()
  } catch (err) {
    next(err)
  }
}

/** Match admin — lock attendance, generate teams, record the result, cancel. */
export function requireMatchHost(req: Request, res: Response, next: NextFunction): void {
  if (!req.matchCapabilities.canManageAttendance) {
    res.status(403).json({
      error: { code: ErrorCode.HOST_ONLY, message: 'Only the host can do that', statusCode: 403 },
    })
    return
  }
  next()
}

/** Anything that only makes sense for someone actually playing (voting, rating). */
export function requireMatchParticipant(req: Request, res: Response, next: NextFunction): void {
  if (!req.matchCapabilities.canViewParticipantRoster) {
    res.status(403).json({
      error: { code: ErrorCode.NOT_A_PARTICIPANT, message: 'Not in this match', statusCode: 403 },
    })
    return
  }
  next()
}

export function requireMatchCapability(capability: keyof MatchCapabilities) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.matchCapabilities[capability]) {
      res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Action is not permitted', statusCode: 403 },
      })
      return
    }
    next()
  }
}

/** Requires a completed profile — anything that writes a player-scoped record. */
export function requirePlayer(req: Request, res: Response, next: NextFunction): void {
  if (!req.user.playerId) {
    res.status(403).json({
      error: { code: ErrorCode.PLAYER_NOT_FOUND, message: 'Complete your profile first', statusCode: 403 },
    })
    return
  }
  next()
}
