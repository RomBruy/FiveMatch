import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../db', () => ({ db: {} }))
vi.mock('../../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))
vi.mock('../../players/seeding.service', () => ({
  seedingService: { computeInitialSeed: vi.fn() },
}))

import { ovrService } from '../../players/ovr.service'

const SRC = join(__dirname, '../../..')

/** Every OVR calculation path. If one is added, add it here. */
const OVR_SOURCES = [
  'services/players/ovr.service.ts',
  'services/players/ovr-signal.ts',
  'services/players/seeding.service.ts',
  'services/players/signals/post-match-rating-signal.ts',
]

/** Things reliability and fair play are made of. None may reach OVR. */
const FORBIDDEN_IN_OVR = [
  'trust-constants',
  'trust-projection',
  'behaviour-report',
  'behaviourReports',
  'attendance-finalization',
  'RELIABILITY_',
  'FAIR_PLAY_',
  'BEHAVIOUR_',
]

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  return entries.flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(full)
    }
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : []
  })
}

describe('Trust signal isolation from OVR', () => {
  it('no OVR calculation path imports or names a trust concept', () => {
    const offenders: string[] = []

    for (const relative of OVR_SOURCES) {
      let contents: string
      try {
        contents = readFileSync(join(SRC, relative), 'utf8')
      } catch {
        // The file has been renamed or removed. That is a real signal: this list
        // must be maintained alongside the OVR pipeline, so fail loudly.
        offenders.push(`${relative} — listed OVR source not found; update OVR_SOURCES`)
        continue
      }

      for (const token of FORBIDDEN_IN_OVR) {
        if (contents.includes(token)) offenders.push(`${relative} references "${token}"`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('no trust module imports an OVR module', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(join(SRC, 'services/trust'))) {
      const contents = readFileSync(file, 'utf8')
      if (/from ['"].*(ovr|seeding|calibration)/.test(contents)) {
        offenders.push(`${file} imports an OVR module`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('the trust constants module is versioned independently of the OVR constants', async () => {
    const trust = await import('@fivematch/types/trust-constants')
    const algorithm = await import('@fivematch/types/algorithm-constants')

    // Two versions that move independently. Were trust constants folded into the
    // OVR module, changing a reliability weight would bump the version the OVR
    // golden regression pins — and the pressure would be to weaken that guard.
    expect(trust.TRUST_CONSTANTS_VERSION).toBeDefined()
    expect(algorithm.ALGORITHM_CONSTANTS_VERSION).toBeDefined()
    expect(trust.TRUST_CONSTANTS_VERSION).not.toBe(algorithm.ALGORITHM_CONSTANTS_VERSION)
  })

  it('OVR is unmoved by attendance and behaviour evidence', () => {
    // The structural argument is above; this is the behavioural one. OVR takes
    // ratings, goals, MVP and match outcome. There is no parameter through which
    // a no-show or a behaviour report could enter, and this pins that shape.
    const breakdown = ovrService.applyEmaWithBreakdown({
      matchId: 'trust-isolation',
      player: {
        ovrScoreFloat: 70,
        matchCount: 10,
        lastMatchAt: null,
        avgPace: null,
        avgTechnique: null,
        avgPassing: null,
        avgDefending: null,
        avgPhysicality: null,
        avgEffort: null,
      },
      matchRatings: [{ pace: 7, technique: 7, passing: 7, defending: 7, physicality: 7, effort: 7 }],
      goalCount: 0,
      assistCount: 0,
      isMvp: false,
      groupTier: 'amateur',
      distinctRatersCount: 1,
      diversityTarget: 8,
      myTeamAvgOvr: 70,
      oppTeamAvgOvr: 70,
      matchOutcome: 'draw',
    })

    const inputKeys = Object.keys(breakdown.breakdown)
    for (const key of inputKeys) {
      expect(key.toLowerCase()).not.toContain('reliab')
      expect(key.toLowerCase()).not.toContain('fairplay')
      expect(key.toLowerCase()).not.toContain('behaviour')
      expect(key.toLowerCase()).not.toContain('attendance')
    }
  })
})
