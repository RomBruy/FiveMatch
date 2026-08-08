import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { inArray } from 'drizzle-orm'
import { db } from '../../db'
import {
  groupMemberships,
  groups,
  matchAttendances,
  matchParticipants,
  matches,
  playerMatchEligibilities,
  players,
  ratingEvents,
  ratings,
  users,
} from '../../db/schema'
import { resolveMatchCapabilities } from '../../services/permissions/capability.service'
import { attendanceService } from '../../services/matches/attendance.service'
import { matchService } from '../../services/matches/match.service'
import { playerProfileService } from '../../services/players/player-profile.service'
import { phase2Fixtures as fx, phase2Identity as identity } from '../fixtures/phase2-fixtures'
import apiRouter from '../../routes'

const userEntries = Object.entries(fx.users) as Array<[keyof typeof fx.users, string]>
const scheduledAt = new Date('2099-08-06T18:00:00.000Z')

async function cleanup() {
  await db.delete(ratingEvents).where(inArray(ratingEvents.playerId, Object.values(fx.players)))
  await db.delete(ratings).where(inArray(ratings.ratedPlayerId, Object.values(fx.players)))
  await db.delete(playerMatchEligibilities).where(inArray(playerMatchEligibilities.matchId, Object.values(fx.matches)))
  await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, Object.values(fx.matches)))
  await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, Object.values(fx.matches)))
  await db.delete(matches).where(inArray(matches.id, Object.values(fx.matches)))
  await db.delete(groupMemberships).where(inArray(groupMemberships.groupId, Object.values(fx.groups)))
  await db.delete(players).where(inArray(players.id, Object.values(fx.players)))
  await db.delete(groups).where(inArray(groups.id, Object.values(fx.groups)))
  await db.delete(users).where(inArray(users.id, Object.values(fx.users)))
}

async function seed() {
  await db.insert(users).values(userEntries.map(([name, userId]) => ({
    id: userId,
    clerkUserId: identity.clerk(name),
    email: identity.email(name),
    name: identity.display(name),
    ...(name === 'target' ? {
      currentClub: 'Group-only club',
      specialSkill: 'Participant-only skill',
      favoriteExcuse: 'Public excuse',
      profilePhotoUrl: 'https://images.example.invalid/private.jpg',
      profileFieldVisibility: {
        profilePhoto: 'private' as const,
        generatedCardPhoto: 'private' as const,
        currentClub: 'group' as const,
        formerClub: 'private' as const,
        preferredPosition: 'private' as const,
        strongFoot: 'private' as const,
        playerStyle: 'private' as const,
        specialSkill: 'participants' as const,
        favoriteExcuse: 'public' as const,
        badFaithLevel: 'private' as const,
        lockerRoomStyle: 'private' as const,
        thirdHalfProfile: 'private' as const,
      },
    } : {}),
  })))
  await db.insert(players).values(userEntries.map(([name, userId]) => ({
    id: fx.players[name], userId, displayName: identity.display(name), ovrScoreFloat: '70.000',
  })))
  await db.insert(groups).values([
    {
      id: fx.groups.primary, organizerId: fx.users.host, name: 'Phase2 Group',
      formatPreset: '5v5', goalkeeperMode: 'none',
    },
    {
      id: fx.groups.secondary, organizerId: fx.users.host, name: 'Phase2 Other Group',
      formatPreset: '5v5', goalkeeperMode: 'none',
    },
  ])
  await db.insert(groupMemberships).values([
    { groupId: fx.groups.primary, userId: fx.users.host, role: 'organizer' },
    { groupId: fx.groups.primary, userId: fx.users.organizer, role: 'organizer' },
    { groupId: fx.groups.primary, userId: fx.users.target, role: 'member' },
    { groupId: fx.groups.primary, userId: fx.users.groupMember, role: 'member' },
    { groupId: fx.groups.secondary, userId: fx.users.target, role: 'member' },
    { groupId: fx.groups.secondary, userId: fx.users.raterTwo, role: 'member' },
    { groupId: fx.groups.primary, userId: fx.users.outsider, role: 'member', deletedAt: scheduledAt },
  ])
  await db.insert(matches).values({
    id: fx.matches.access,
    groupId: fx.groups.primary,
    hostId: fx.users.host,
    status: 'attendance_open',
    scheduledAt,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    visibility: 'public',
    openSpots: 2,
    city: 'Geneva',
    venueName: 'Private Arena',
    location: '1 Secret Street',
    latitude: '46.204391',
    longitude: '6.143158',
    notes: 'Private door code',
  })
  await db.insert(matchAttendances).values([
    { matchId: fx.matches.access, playerId: fx.players.target, status: 'in', source: 'crew' },
    { matchId: fx.matches.access, playerId: fx.players.confirmed, status: 'in', source: 'open' },
    { matchId: fx.matches.access, playerId: fx.players.waitlisted, status: 'in', source: 'open', waitlistPosition: 1 },
    { matchId: fx.matches.access, playerId: fx.players.out, status: 'out', source: 'open' },
    { matchId: fx.matches.access, playerId: fx.players.unknown, status: 'unknown', source: 'open' },
  ])
}

beforeEach(async () => { await cleanup(); await seed() })
afterEach(cleanup)

describe('Phase 2 database-backed capability and attendance boundaries', () => {
  it('serves an anonymous preview with city and capacity only', async () => {
    const app = express()
    app.use('/v1', apiRouter)
    const response = await request(app).get(`/v1/matches/${fx.matches.access}/preview`)
    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({ audience: 'public', city: 'Geneva' })
    expect(response.body.data).not.toHaveProperty('venueName')
    expect(response.body.data).not.toHaveProperty('location')
    expect(response.body.data).not.toHaveProperty('groupId')
    expect(response.body.data).not.toHaveProperty('notes')
  })

  it('does not promote group, out, unknown, or waitlisted state into participation', async () => {
    const [match] = await db.select().from(matches).where(inArray(matches.id, [fx.matches.access]))
    const cases = [
      ['host', fx.users.host, fx.players.host, 'host', true],
      ['organizer', fx.users.organizer, fx.players.organizer, 'host', true],
      ['confirmed', fx.users.confirmed, fx.players.confirmed, 'participant', true],
      ['group', fx.users.groupMember, fx.players.groupMember, 'crew', false],
      ['waitlist', fx.users.waitlisted, fx.players.waitlisted, 'viewer', false],
      ['out', fx.users.out, fx.players.out, 'viewer', false],
      ['unknown', fx.users.unknown, fx.players.unknown, 'viewer', false],
      ['outsider', fx.users.outsider, fx.players.outsider, 'viewer', false],
    ] as const

    for (const [, userId, playerId, relation, exact] of cases) {
      const capabilities = await resolveMatchCapabilities(match!, userId, playerId)
      expect(capabilities.viewerRelation).toBe(relation)
      expect(capabilities.canViewExactLocation).toBe(exact)
    }
  })

  it('returns identity lists only to the audiences that need them', async () => {
    const [match] = await db.select().from(matches).where(inArray(matches.id, [fx.matches.access]))
    const managerCapabilities = await resolveMatchCapabilities(match!, fx.users.host, fx.players.host)
    const manager = await attendanceService.getAttendances(
      match!.id, fx.users.host, managerCapabilities, managerCapabilities.viewerRelation,
    )
    expect(manager.audience).toBe('manager')
    expect('waitlist' in manager ? manager.waitlist : []).toHaveLength(1)

    const groupCapabilities = await resolveMatchCapabilities(match!, fx.users.groupMember, fx.players.groupMember)
    const group = await attendanceService.getAttendances(
      match!.id, fx.users.groupMember, groupCapabilities, groupCapabilities.viewerRelation,
    )
    expect(group).toMatchObject({ audience: 'group', counts: { confirmed: 2, waitlist: 1, pending: 1 } })
    expect('confirmed' in group).toBe(false)

    const participantCapabilities = await resolveMatchCapabilities(match!, fx.users.confirmed, fx.players.confirmed)
    const participant = await attendanceService.getAttendances(
      match!.id, fx.users.confirmed, participantCapabilities, participantCapabilities.viewerRelation,
    )
    expect(participant.audience).toBe('participant')
    expect('confirmed' in participant ? participant.confirmed : []).toHaveLength(2)
    expect('waitlist' in participant).toBe(false)
  })

  it('serializes match detail by role without leaking exact or private fields', async () => {
    const [match] = await db.select().from(matches).where(inArray(matches.id, [fx.matches.access]))
    const outsiderCaps = await resolveMatchCapabilities(match!, fx.users.outsider, fx.players.outsider)
    const publicDetail = await matchService.getMatch(match!.id, outsiderCaps, outsiderCaps.viewerRelation)
    expect(publicDetail).toMatchObject({ audience: 'viewer', city: 'Geneva' })
    expect(publicDetail).not.toHaveProperty('exactLocation')
    expect(publicDetail).not.toHaveProperty('privateNotes')
    expect(publicDetail).not.toHaveProperty('group')

    const groupCaps = await resolveMatchCapabilities(match!, fx.users.groupMember, fx.players.groupMember)
    const groupDetail = await matchService.getMatch(match!.id, groupCaps, groupCaps.viewerRelation)
    expect(groupDetail).toMatchObject({ audience: 'group', group: { groupId: fx.groups.primary } })
    expect(groupDetail).not.toHaveProperty('exactLocation')

    const participantCaps = await resolveMatchCapabilities(match!, fx.users.confirmed, fx.players.confirmed)
    const participant = await matchService.getMatch(match!.id, participantCaps, participantCaps.viewerRelation)
    expect(participant).toMatchObject({
      audience: 'participant', exactLocation: { venueName: 'Private Arena', location: '1 Secret Street' },
    })
    expect(participant).not.toHaveProperty('privateNotes')

    const managerCaps = await resolveMatchCapabilities(match!, fx.users.host, fx.players.host)
    const manager = await matchService.getMatch(match!.id, managerCaps, managerCaps.viewerRelation)
    expect(manager).toMatchObject({ audience: 'manager', privateNotes: 'Private door code' })
  })
})

describe('Phase 2 profile audiences and aggregate threshold', () => {
  it('filters each field independently and never exposes owner settings', async () => {
    const group = await playerProfileService.getPublicProfile(fx.players.target, fx.users.groupMember, fx.players.groupMember)
    expect(group?.footballIdentity?.currentClub).toBe('Group-only club')
    expect(group?.personality?.specialSkill).toBeUndefined()
    expect(group?.personality?.favoriteExcuse).toBe('Public excuse')
    expect(group).not.toHaveProperty('visibility')

    const participant = await playerProfileService.getPublicProfile(fx.players.target, fx.users.confirmed, fx.players.confirmed)
    expect(participant?.footballIdentity?.currentClub).toBeUndefined()
    expect(participant?.personality?.specialSkill).toBe('Participant-only skill')
    expect(participant?.photoUrl).toBeUndefined()

    const outsider = await playerProfileService.getPublicProfile(fx.players.target, fx.users.outsider, fx.players.outsider)
    expect(outsider?.personality?.favoriteExcuse).toBe('Public excuse')
    expect(outsider?.personality?.specialSkill).toBeUndefined()
    expect(outsider?.footballIdentity?.currentClub).toBeUndefined()

    const secondSharedGroup = await playerProfileService.getPublicProfile(
      fx.players.target, fx.users.raterTwo, fx.players.raterTwo,
    )
    expect(secondSharedGroup?.footballIdentity?.currentClub).toBe('Group-only club')

    await db.insert(ratingEvents).values({
      playerId: fx.players.target,
      matchId: fx.matches.access,
      eventType: 'MATCH_UPDATE',
      oldOvr: '69.000',
      newOvr: '70.000',
      breakdown: { raterPlayerId: fx.players.confirmed, rawRating: { pace: 8 } },
    })
    const owner = await playerProfileService.getPrivateProfile(fx.players.target, identity.clerk('target'))
    expect(owner?.isOwner).toBe(true)
    expect(owner?.visibility.profilePhoto).toBe('private')
    expect(owner?.photoUrl).toBe('https://images.example.invalid/private.jpg')
    expect(owner?.ovrHistory[0]).toEqual({
      date: expect.any(String), ovrScore: 70, direction: 'up', matchId: fx.matches.access, category: 'match_update',
    })
    expect(JSON.stringify(owner)).not.toContain('raterPlayerId')
    expect(JSON.stringify(owner)).not.toContain('rawRating')
  })

  it('withholds football attributes below four eligible samples', async () => {
    const ratingMatches = [fx.matches.ratingOne, fx.matches.ratingTwo, fx.matches.ratingThree, fx.matches.ratingFour]
    const raters = [fx.players.confirmed, fx.players.raterTwo, fx.players.raterThree, fx.players.raterFour]
    for (let index = 0; index < ratingMatches.length; index += 1) {
      const matchId = ratingMatches[index]!
      const raterId = raters[index]!
      await db.insert(matches).values({
        id: matchId, hostId: fx.users.host, status: 'completed', scheduledAt,
        completedAt: scheduledAt, scoreA: 2, scoreB: 1,
        format: '5v5', playersPerTeam: 5, goalkeeperMode: 'none', visibility: 'private',
      })
      await db.insert(matchParticipants).values([
        { matchId, playerId: fx.players.target, userId: fx.users.target, displayName: 'Target', teamSide: 'A' },
        { matchId, playerId: raterId, userId: userEntries.find(([name]) => fx.players[name] === raterId)![1], displayName: 'Rater', teamSide: 'B' },
      ])
      await db.insert(playerMatchEligibilities).values([
        { matchId, playerId: fx.players.target }, { matchId, playerId: raterId },
      ])
      await db.insert(ratings).values({
        matchId, raterPlayerId: raterId, ratedPlayerId: fx.players.target,
        pace: 8, technique: 8, passing: 8, defending: 8, physicality: 8, effort: 8, mentality: 8,
      })
      const profile = await playerProfileService.getPublicProfile(fx.players.target, fx.users.outsider, fx.players.outsider)
      expect(profile?.ratingAggregate?.sampleCount).toBe(index + 1)
      expect(profile?.ratingAggregate?.attributes).toEqual(index === 3 ? {
        pace: 8, technique: 8, passing: 8, defending: 8, physicality: 8, effort: 8,
      } : null)
    }
  })
})
