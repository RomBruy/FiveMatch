import { describe, it, expect } from 'vitest'
import { getBody } from './notification.service'
import type { CancellationReason } from '@fivematch/types'

const notice = (spotsRemaining: number, reason: CancellationReason | null) =>
  getBody({
    type: 'PLAYER_WITHDREW',
    matchId: '00000000-0000-0000-0000-000000000001',
    groupId: null,
    playerDisplayName: 'Thomas L.',
    spotsRemaining,
    reason,
    recipientUserId: '00000000-0000-0000-0000-000000000002',
  })

/**
 * The host's push is the whole reason withdrawal was made easy: if the organiser
 * does not learn the match is short, an easy withdrawal is just a quieter no-show.
 */
describe('PLAYER_WITHDREW push copy', () => {
  it('leads with how short the match now is, because that is what a host acts on', () => {
    const body = notice(2, 'unexpected')
    expect(body).toContain('Thomas L.')
    expect(body).toContain('Il manque 2 joueur(s)')
  })

  it('says the squad is still full when the waitlist already covered the gap', () => {
    // The seat was released and immediately refilled by a promotion, so there is
    // nothing to chase — telling the host to find someone would be wrong.
    expect(notice(0, 'unexpected')).toContain("L'effectif est toujours complet")
    expect(notice(0, 'unexpected')).not.toContain('Il manque')
  })

  it('surfaces injury and wrong-date, which change whether the host chases anyone', () => {
    expect(notice(1, 'injured')).toContain('(blessé)')
    expect(notice(1, 'wrong_date')).toContain('(erreur de date)')
  })

  it('stays silent about the reason when none was given', () => {
    // Withdrawing without a reason is always allowed, so the copy must read
    // naturally with nothing to append — never "Thomas L. ne peut plus venir ()".
    const body = notice(1, null)
    expect(body).toBe('Thomas L. ne peut plus venir. Il manque 1 joueur(s).')
  })

  it('does not editorialise "unexpected" — it is the default, not a claim', () => {
    expect(notice(1, 'unexpected')).toBe(notice(1, null))
  })
})
