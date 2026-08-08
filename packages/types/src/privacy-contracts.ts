import { z } from 'zod'

export const ProfileVisibilityAudienceSchema = z.enum(['private', 'group', 'participants', 'public'])
export type ProfileVisibilityAudience = z.infer<typeof ProfileVisibilityAudienceSchema>

export const PROFILE_VISIBILITY_FIELDS = [
  'profilePhoto',
  'generatedCardPhoto',
  'currentClub',
  'formerClub',
  'preferredPosition',
  'strongFoot',
  'playerStyle',
  'specialSkill',
  'favoriteExcuse',
  'badFaithLevel',
  'lockerRoomStyle',
  'thirdHalfProfile',
] as const

const visibilityShape = Object.fromEntries(
  PROFILE_VISIBILITY_FIELDS.map((field) => [field, ProfileVisibilityAudienceSchema]),
) as Record<(typeof PROFILE_VISIBILITY_FIELDS)[number], typeof ProfileVisibilityAudienceSchema>

export const ProfileFieldVisibilitySchema = z.object(visibilityShape).strict()
export type ProfileFieldVisibility = z.infer<typeof ProfileFieldVisibilitySchema>

export const PlayerAttributesSchema = z.object({
  pace: z.number(), technique: z.number(), passing: z.number(),
  defending: z.number(), physicality: z.number(), effort: z.number(),
}).strict()

export const SafeRatingAggregateSchema = z.object({
  sampleCount: z.number().int().nonnegative(),
  attributes: PlayerAttributesSchema.nullable(),
}).strict()

const PublicPlayerBaseShape = {
  playerId: z.string(),
  displayName: z.string(),
  skillLevel: z.enum(['casual', 'intermediate', 'competitive']),
  cardState: z.string(),
  eligibleMatchCount: z.number().int().nonnegative(),
  ovrScore: z.number().nullable(),
  trend: z.enum(['up', 'down', 'stable']).nullable(),
  /**
   * The earned check mark, and deliberately the only trust signal a stranger
   * sees. There is no raw reliability score and no fair-play field here: a
   * visible negative quietly excludes people at a cost far out of proportion to
   * missing recreational football, and absence of the mark must stay ambiguous
   * between "new" and "not earned yet" (ADR-019).
   */
  isReliable: z.boolean(),
  ratingAggregate: SafeRatingAggregateSchema.nullable(),
  photoUrl: z.string().nullable().optional(),
  generatedCardPhotoUrl: z.string().nullable().optional(),
  playerTier: z.string().nullable().optional(),
  isMvp: z.boolean().optional(),
  footballIdentity: z.object({
    currentClub: z.string().nullable().optional(),
    formerClub: z.string().nullable().optional(),
    preferredPosition: z.string().nullable().optional(),
    strongFoot: z.string().nullable().optional(),
    playerStyle: z.string().nullable().optional(),
  }).strict().optional(),
  personality: z.object({
    specialSkill: z.string().nullable().optional(),
    favoriteExcuse: z.string().nullable().optional(),
    badFaithLevel: z.number().int().nullable().optional(),
    lockerRoomStyle: z.string().nullable().optional(),
    thirdHalfProfile: z.string().nullable().optional(),
  }).strict().optional(),
}

export const PublicPlayerProfileSchema = z.object(PublicPlayerBaseShape).strict()
export type PublicPlayerProfile = z.infer<typeof PublicPlayerProfileSchema>

export const PrivatePlayerProfileSchema = z.object({
  ...PublicPlayerBaseShape,
  isOwner: z.literal(true),
  isAdmin: z.boolean(),
  visibility: ProfileFieldVisibilitySchema,
  ratingSampleCount: z.number().int().nonnegative(),
  /**
   * Owner-only detail. You always get to see your own standing and what it is
   * built from — that is feedback, and it is also the access right. Nobody else
   * receives these numbers (ADR-019).
   */
  trust: z.object({
    reliability: z.number().nullable(),
    fairPlay: z.number().nullable(),
    sampleCount: z.number().int().nonnegative(),
  }).strict(),
  ovrHistory: z.array(z.object({
    date: z.string(),
    ovrScore: z.number(),
    direction: z.enum(['up', 'down', 'stable']),
    matchId: z.string().nullable(),
    category: z.literal('match_update'),
  }).strict()),
  bankroll: z.object({ balance: z.number().int(), startingBalance: z.number().int() }).strict(),
  memory: z.object({
    tightestMatch: z.object({ scheduledAt: z.string(), scoreA: z.number().int(), scoreB: z.number().int() }).strict().nullable(),
  }).strict(),
}).strict()
export type PrivatePlayerProfile = z.infer<typeof PrivatePlayerProfileSchema>

export const MatchCapabilitiesSchema = z.object({
  canViewPrivateMatchDetails: z.boolean(),
  canViewExactLocation: z.boolean(),
  canViewParticipantRoster: z.boolean(),
  canViewWaitlist: z.boolean(),
  canViewPendingGroupAttendance: z.boolean(),
  canManageAttendance: z.boolean(),
  canViewPrivateNotes: z.boolean(),
  canRate: z.boolean(),
  canReportAttendance: z.boolean(),
  /** Authority on this match. Per-report impartiality is enforced server-side. */
  canResolveDispute: z.boolean(),
  canSubmitProno: z.boolean(),
  canLeave: z.boolean(),
  canJoin: z.boolean(),
  canJoinWaitlist: z.boolean(),
}).strict()
export type MatchCapabilities = z.infer<typeof MatchCapabilitiesSchema>

const AvailabilitySchema = z.object({
  confirmedCount: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  spotsRemaining: z.number().int().nonnegative(),
  canJoin: z.boolean(),
  canWaitlist: z.boolean(),
}).strict()

const MatchPublicShape = {
  matchId: z.string(),
  audience: z.enum(['public', 'viewer']),
  scheduledAt: z.string(),
  durationMinutes: z.number().int().positive(),
  city: z.string().nullable(),
  format: z.string(),
  skillLevel: z.string(),
  pricePerPlayer: z.number().nullable(),
  currency: z.string(),
  status: z.string(),
  completedAt: z.string().nullable().optional(),
  publication: z.object({ isPublic: z.boolean() }).strict(),
  availability: AvailabilitySchema,
  // The earned mark only. A public preview showing a host's raw reliability
  // would publish a behavioural judgement to strangers (ADR-019).
  host: z.object({ displayName: z.string().nullable(), isReliable: z.boolean().optional() }).strict(),
  distanceKm: z.number().nullable().optional(),
  viewerJoined: z.boolean().optional(),
  viewerRelation: z.enum(['host', 'participant', 'crew', 'viewer']).optional(),
  capabilities: MatchCapabilitiesSchema.optional(),
}

export const PublicMatchPreviewSchema = z.object(MatchPublicShape).strict()
export type PublicMatchPreview = z.infer<typeof PublicMatchPreviewSchema>

const ParticipantSchema = z.object({
  playerId: z.string(), displayName: z.string(), teamSide: z.string().nullable().optional(),
  goalsScored: z.number().int().optional(), assists: z.number().int().optional(),
}).strict()

const ExactLocationSchema = z.object({
  location: z.string().nullable(), venueName: z.string().nullable(),
  latitude: z.number().nullable(), longitude: z.number().nullable(),
}).strict()

const GroupContextSchema = z.object({ groupId: z.string(), name: z.string() }).strict()
const ResultSchema = z.object({ scoreA: z.number().int().nullable(), scoreB: z.number().int().nullable() }).strict()

export const GroupMatchDetailSchema = z.object({
  ...MatchPublicShape,
  audience: z.literal('group'),
  group: GroupContextSchema,
  result: ResultSchema.optional(),
}).strict()

export const ParticipantMatchDetailSchema = z.object({
  ...MatchPublicShape,
  audience: z.literal('participant'),
  group: GroupContextSchema.nullable(),
  exactLocation: ExactLocationSchema,
  participants: z.array(ParticipantSchema),
  result: ResultSchema.optional(),
}).strict()

export const ManagerMatchDetailSchema = z.object({
  ...MatchPublicShape,
  audience: z.literal('manager'),
  group: GroupContextSchema.nullable(),
  exactLocation: ExactLocationSchema,
  participants: z.array(ParticipantSchema),
  privateNotes: z.string().nullable(),
  configuration: z.object({
    playersPerTeam: z.number().int(), goalkeeperMode: z.string(), generatorStyle: z.string(),
    generationCount: z.number().int(), seriesId: z.string().nullable(), visibility: z.string(), openSpots: z.number().int().nullable(),
  }).strict(),
  attendanceSummary: z.object({ in: z.number().int(), out: z.number().int(), unknown: z.number().int(), waitlist: z.number().int() }).strict(),
  result: ResultSchema.optional(),
}).strict()

export const MatchDetailResponseSchema = z.discriminatedUnion('audience', [
  PublicMatchPreviewSchema,
  GroupMatchDetailSchema,
  ParticipantMatchDetailSchema,
  ManagerMatchDetailSchema,
])
export type MatchDetailResponse = z.infer<typeof MatchDetailResponseSchema>

const AttendanceCountsSchema = z.object({ confirmed: z.number().int(), waitlist: z.number().int(), pending: z.number().int() }).strict()
const SelfAttendanceSchema = z.object({
  playerId: z.string(), status: z.string(), waitlistPosition: z.number().int().nullable(),
}).strict().nullable()
const AttendancePlayerSchema = z.object({
  playerId: z.string(), displayName: z.string().nullable(), skillLevel: z.string().nullable(),
  matchCount: z.number().int(), isReliable: z.boolean(),
}).strict()

export const ViewerAttendanceSchema = z.object({
  audience: z.enum(['viewer', 'group']), counts: AttendanceCountsSchema, self: SelfAttendanceSchema,
}).strict()
export const ParticipantAttendanceSchema = z.object({
  audience: z.literal('participant'), counts: AttendanceCountsSchema, self: SelfAttendanceSchema,
  confirmed: z.array(AttendancePlayerSchema),
}).strict()
export const ManagerAttendanceSchema = z.object({
  audience: z.literal('manager'), counts: AttendanceCountsSchema, self: SelfAttendanceSchema,
  /**
   * Whether every confirmed player has been settled. A single boolean on
   * purpose: per-player outcomes would tell a whole roster who no-showed, which
   * is the visible negative ADR-019 refuses. The host needs to know the job is
   * done, not who let them down.
   */
  attendanceFinalized: z.boolean(),
  confirmed: z.array(AttendancePlayerSchema.extend({ source: z.enum(['crew', 'open']) }).strict()),
  waitlist: z.array(AttendancePlayerSchema.extend({ source: z.enum(['crew', 'open']), waitlistPosition: z.number().int() }).strict()),
  pending: z.array(AttendancePlayerSchema.extend({ source: z.enum(['crew', 'open']) }).strict()),
  out: z.array(AttendancePlayerSchema.extend({ source: z.enum(['crew', 'open']) }).strict()),
}).strict()

export const AttendanceResponseSchema = z.discriminatedUnion('audience', [
  ViewerAttendanceSchema, ParticipantAttendanceSchema, ManagerAttendanceSchema,
])
export type AttendanceResponse = z.infer<typeof AttendanceResponseSchema>
