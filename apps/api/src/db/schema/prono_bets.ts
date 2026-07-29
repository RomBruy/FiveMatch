import { pgTable, uuid, text, integer, numeric, timestamp, index, pgEnum } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

export const pronoBetMarketEnum = pgEnum('prono_bet_market', ['result', 'score', 'mvp'])
export const pronoBetStatusEnum = pgEnum('prono_bet_status', ['pending', 'won', 'lost', 'close'])

/**
 * prono_bets — the append-only bankroll ledger (Epic 11).
 *
 * Every mutation of `players.pronos_balance` has exactly one row here, so a balance is
 * always reconstructable: PRONOS_STARTING_BANKROLL + Σpayout − Σstake.
 *
 * Unlike the legacy `pronos` table there is deliberately NO unique (match_id, player_id)
 * constraint — a player places multiple bets on a match until kickoff.
 *
 * `selection` encoding, by market:
 *   - 'result' → 'teamA' | 'draw' | 'teamB'   (same vocabulary as pronos.prediction_result)
 *   - 'score'  → "{scoreA}-{scoreB}", e.g. "3-2" (same format as pronos.prediction_score)
 *   - 'mvp'    → the predicted player's players.id UUID, as text
 *
 * `odds_at_bet` freezes the cote taken at placement — settled bets always pay the frozen
 * price and are never re-priced. NOTE: Drizzle reads numeric back as a STRING.
 */
export const pronoBets = pgTable(
  'prono_bets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id').notNull().references(() => players.id),
    market: pronoBetMarketEnum('market').notNull(),
    selection: text('selection').notNull(),
    stake: integer('stake').notNull(),
    oddsAtBet: numeric('odds_at_bet', { precision: 6, scale: 2 }).notNull(),
    status: pronoBetStatusEnum('status').notNull().default('pending'),
    payout: integer('payout'), // null while pending
    placedAt: timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (table) => ({
    idxMatchId: index('idx_prono_bets_match_id').on(table.matchId),
    idxPlayerId: index('idx_prono_bets_player_id').on(table.playerId),
    // Settlement scans every pending bet of one match — this is that access path.
    idxMatchStatus: index('idx_prono_bets_match_status').on(table.matchId, table.status),
  }),
)

export type PronoBet = typeof pronoBets.$inferSelect
export type NewPronoBet = typeof pronoBets.$inferInsert
