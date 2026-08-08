const id = (family: number, value: number) =>
  `${family}0000000-0000-4000-8000-${String(value).padStart(12, '0')}`

export const phase2Fixtures = {
  users: {
    target: id(6, 1), host: id(6, 2), organizer: id(6, 3), confirmed: id(6, 4),
    groupMember: id(6, 5), waitlisted: id(6, 6), out: id(6, 7), unknown: id(6, 8), outsider: id(6, 9),
    raterTwo: id(6, 10), raterThree: id(6, 11), raterFour: id(6, 12),
  },
  players: {
    target: id(7, 1), host: id(7, 2), organizer: id(7, 3), confirmed: id(7, 4),
    groupMember: id(7, 5), waitlisted: id(7, 6), out: id(7, 7), unknown: id(7, 8), outsider: id(7, 9),
    raterTwo: id(7, 10), raterThree: id(7, 11), raterFour: id(7, 12),
  },
  groups: { primary: id(8, 1), secondary: id(8, 2) },
  matches: { access: id(9, 1), ratingOne: id(9, 2), ratingTwo: id(9, 3), ratingThree: id(9, 4), ratingFour: id(9, 5) },
} as const

export const phase2Identity = {
  clerk: (name: string) => `fixture-phase2-${name}`,
  email: (name: string) => `fixture-phase2-${name}@example.invalid`,
  display: (name: string) => `Phase2 ${name}`,
} as const
