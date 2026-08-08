import { behaviourReportService } from '../services/matches/behaviour-report.service'
import { logger } from '../lib/logger'

/**
 * Retire behaviour reports nobody resolved inside the window (ADR-027).
 *
 * Without this, a standalone match's report — which has no validator by design —
 * would sit pending forever. `expiresAt` already makes an unswept report inert
 * to every read path, so this job settles the record rather than deciding
 * anything: running it late changes nothing, and running it twice changes
 * nothing.
 */
export async function runBehaviourReportExpiryJob(now: Date = new Date()): Promise<number> {
  const expired = await behaviourReportService.expireStaleReports(now)
  if (expired > 0) logger.info({ expired }, 'behaviour reports expired')
  return expired
}
