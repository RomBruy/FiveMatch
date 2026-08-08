const uuid = (prefix: string, value: number) =>
  `${prefix}0000000-0000-4000-8000-${value.toString().padStart(12, '0')}`

export const phase1Fixtures = {
  users: {
    host: uuid('1', 1),
    playerA: uuid('1', 2),
    teammateA: uuid('1', 3),
    opponentB: uuid('1', 4),
    outsider: uuid('1', 5),
  },
  players: {
    host: uuid('2', 1),
    playerA: uuid('2', 2),
    teammateA: uuid('2', 3),
    opponentB: uuid('2', 4),
    outsider: uuid('2', 5),
  },
  groups: {
    primary: uuid('3', 1),
    secondary: uuid('3', 2),
  },
  matches: {
    valid: uuid('4', 1),
    validTwo: uuid('4', 2),
    validThree: uuid('4', 3),
    validFour: uuid('4', 4),
    cancelled: uuid('4', 5),
    incomplete: uuid('4', 6),
    missingParticipant: uuid('4', 7),
  },
  ratings: {
    valid: uuid('5', 1),
    duplicate: uuid('5', 2),
    self: uuid('5', 3),
    teammate: uuid('5', 4),
    nonParticipantTarget: uuid('5', 5),
    nonParticipantRater: uuid('5', 6),
    initialWithoutMatch: uuid('5', 7),
  },
} as const

export const phase1SyntheticIdentity = {
  name: (key: string) => `fixture-${key}`,
  email: (key: string) => `fixture-${key}@example.invalid`,
  clerkId: (key: string) => `fixture-phase1-${key}`,
} as const
