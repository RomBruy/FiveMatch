import express from 'express'
import { clerkMiddleware } from './middleware/auth'
import { apiRateLimit } from './middleware/rate-limit'
import { errorHandler } from './middleware/error-handler'
import { logger } from './lib/logger'
import apiRouter from './routes'
import webhooksRouter from './routes/webhooks'
import { runCardStateTimeoutJob } from './jobs/card-state-timeout'

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
})

export { app }
