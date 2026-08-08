import express from 'express'
import { clerkMiddleware } from './middleware/auth'
import { apiRateLimit } from './middleware/rate-limit'
import { errorHandler } from './middleware/error-handler'
import { logger } from './lib/logger'
import apiRouter from './routes'
import webhooksRouter from './routes/webhooks'
import { runCardStateTimeoutJob } from './jobs/card-state-timeout'
import { runBehaviourReportExpiryJob } from './jobs/behaviour-report-expiry.job'
import { runAttendanceAutoFinalizeJob } from './jobs/attendance-auto-finalize.job'

const app = express()
const PORT = process.env.PORT ?? 3000

// Webhooks must be mounted BEFORE express.json() — svix signature verification
// requires the raw request body, which express.json() would consume first.
app.use('/v1/webhooks', webhooksRouter)

app.use(express.json())
app.use(clerkMiddleware())
app.use('/v1', apiRateLimit, apiRouter)
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API server started')
  setInterval(() => {
    runCardStateTimeoutJob().catch((err) => logger.error(err, 'card-state-timeout job failed'))
  }, 60 * 1000)

  // Hourly is ample for a 72-hour window, and an unswept report is already inert
  // to every read path — this settles the record, it does not decide anything.
  setInterval(() => {
    runBehaviourReportExpiryJob().catch((err) => logger.error(err, 'behaviour-report-expiry job failed'))
  }, 60 * 60 * 1000)

  // Hourly against a 48-hour grace period. Settling a few hours late costs
  // nothing; a card that never unlocks because a host forgot costs a lot.
  setInterval(() => {
    runAttendanceAutoFinalizeJob().catch((err) => logger.error(err, 'attendance-auto-finalize job failed'))
  }, 60 * 60 * 1000)
})

export { app }
