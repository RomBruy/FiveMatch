import { Router } from 'express'
import lifecycleRoutes from './lifecycle.routes'
import attendanceRoutes from './attendance.routes'
import teamsRoutes from './teams.routes'
import resultsRoutes from './results.routes'
import conductRoutes from './conduct.routes'

/**
 * Match routes, by concern.
 *
 * This file was 1255 lines covering match lifecycle, attendance, team
 * generation, results and conduct — five things that change for different
 * reasons and were only ever together because they share a URL prefix.
 *
 * **Mount order is load-bearing.** Express matches in registration order, and
 * `lifecycle` owns `/discover`, `/mine` and `/series/:seriesId/end`. Those are
 * literal segments that `/:matchId` would swallow, so lifecycle must come
 * first. `route-manifest.test.ts` asserts both the full route list and that
 * ordering, so a future split cannot quietly drop or shadow a route.
 */
const router = Router({ mergeParams: true })

router.use(lifecycleRoutes)
router.use(attendanceRoutes)
router.use(teamsRoutes)
router.use(resultsRoutes)
router.use(conductRoutes)

export default router
