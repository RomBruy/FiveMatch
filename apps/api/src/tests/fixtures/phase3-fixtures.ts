const uuid = (prefix: string, value: number) =>
  `${prefix}0000000-0000-4000-8000-${value.toString().padStart(12, '0')}`

/**
 * Phase 3A finalization fixtures. Deliberately disjoint from the Phase 1 and
 * Phase 2 id space so the suites can never clean up each other's rows.
 */
export const phase3Fixtures = {
  users: {
    host: uuid('a', 1),
    attended: uuid('a', 2),
    excused: uuid('a', 3),
    lateCancel: uuid('a', 4),
    noShow: uuid('a', 5),
    waitlisted: uuid('a', 6),
    neverIn: uuid('a', 7),
  },
  players: {
    host: uuid('b', 1),
    attended: uuid('b', 2),
    excused: uuid('b', 3),
    lateCancel: uuid('b', 4),
    noShow: uuid('b', 5),
    waitlisted: uuid('b', 6),
    neverIn: uuid('b', 7),
  },
  groups: {
    standard: uuid('c', 1),
    strictDeadline: uuid('c', 2),
  },
  matches: {
    completed: uuid('d', 1),
    strictDeadline: uuid('d', 2),
    noResult: uuid('d', 3),
  },
  /** Five matches in a known order, for exercising the projection window. */
  windowMatches: [uuid('e', 1), uuid('e', 2), uuid('e', 3), uuid('e', 4), uuid('e', 5)],
} as const

export const phase3SyntheticIdentity = {
  name: (key: string) => `phase3-${key}`,
  email: (key: string) => `phase3-${key}@example.invalid`,
  clerkId: (key: string) => `fixture-phase3-${key}`,
} as const
