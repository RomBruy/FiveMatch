import rateLimit from 'express-rate-limit'
import { TEAM_GEN_RATE_LIMIT_PER_MIN } from '@fivematch/types/algorithm-constants'

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests', statusCode: 429 } },
})

/**
 * Unauthenticated endpoints, keyed by IP.
 *
 * Tighter than the authenticated limit because there is no account behind a
 * caller here — nothing to suspend, and nothing that makes bulk collection
 * costly. Generous enough for a person browsing, mean enough that scraping a
 * city's fixtures is tedious.
 */
export const publicRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests', statusCode: 429 } },
})

export const teamGenRateLimit = rateLimit({
  windowMs: 60_000,
  max: TEAM_GEN_RATE_LIMIT_PER_MIN,
  keyGenerator: (req) => {
    // Key: groupId extracted from route param — limits per-group, not per-IP
    return (req.params as { groupId?: string }).groupId ?? req.ip ?? 'unknown'
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Team generation rate limit exceeded', statusCode: 429, meta: { retryAfterMs: 60_000 } },
  },
})
