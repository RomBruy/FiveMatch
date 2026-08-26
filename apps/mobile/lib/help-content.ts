/**
 * The help centre's table of contents.
 *
 * Structure lives here, prose lives in the locale files — an article is a set of
 * i18n keys derived from its id, so translating one never means editing code.
 *
 * Sorted by *role*, not by feature. Someone looking for help knows who they are
 * ("I'm a player and I can't come") but not what the app calls things, so a
 * feature-shaped index makes them hunt. That is also why `cancel` is first and
 * why its two articles are pinned to the front page: they are what people search
 * for under time pressure, and the app used to answer neither.
 */

export const HELP_CATEGORIES = ['cancel', 'matches', 'rating', 'crew', 'pronos', 'account'] as const
export type HelpCategory = (typeof HELP_CATEGORIES)[number]

export interface HelpArticle {
  id: string
  category: HelpCategory
  /** Numbered how-to steps. Numbering is only used where order genuinely matters. */
  steps: number
  /** Renders the "what happens next" paragraph after the steps. */
  hasAfter: boolean
  /** Renders the red-tinted caveat block. */
  hasNote: boolean
  /**
   * Which role this is written for. Drives the grouping inside a category —
   * "I'm a player" and "I organise" are different questions with the same words.
   */
  role: 'player' | 'host' | 'anyone'
}

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Annuler & se désister ───────────────────────────────────────────────────
  { id: 'cant-come', category: 'cancel', steps: 3, hasAfter: true, hasNote: true, role: 'player' },
  { id: 'late-withdrawal', category: 'cancel', steps: 0, hasAfter: true, hasNote: true, role: 'player' },
  { id: 'injured', category: 'cancel', steps: 0, hasAfter: true, hasNote: false, role: 'player' },
  { id: 'cancel-my-match', category: 'cancel', steps: 3, hasAfter: true, hasNote: true, role: 'host' },
  { id: 'waitlist', category: 'cancel', steps: 0, hasAfter: true, hasNote: false, role: 'anyone' },
  // ── Matchs & équipes ────────────────────────────────────────────────────────
  { id: 'how-teams-drawn', category: 'matches', steps: 0, hasAfter: true, hasNote: true, role: 'anyone' },
  { id: 'join-a-match', category: 'matches', steps: 3, hasAfter: false, hasNote: false, role: 'player' },
  // ── La note & la carte ──────────────────────────────────────────────────────
  { id: 'how-rating-works', category: 'rating', steps: 0, hasAfter: true, hasNote: true, role: 'anyone' },
]

/** The two questions people arrive with in a hurry. Pinned above the categories. */
export const HELP_PINNED = ['cant-come', 'cancel-my-match'] as const

export const articlesInCategory = (category: HelpCategory) =>
  HELP_ARTICLES.filter((a) => a.category === category)

export const findArticle = (id: string | undefined) =>
  HELP_ARTICLES.find((a) => a.id === id)

/** Roles present in a category, in a fixed order so the page never reshuffles. */
export const rolesInCategory = (category: HelpCategory): HelpArticle['role'][] => {
  const order: HelpArticle['role'][] = ['player', 'host', 'anyone']
  const present = new Set(articlesInCategory(category).map((a) => a.role))
  return order.filter((r) => present.has(r))
}
