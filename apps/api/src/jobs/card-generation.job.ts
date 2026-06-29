import { db } from '../db'
import { cardPhotoJobs, players } from '../db/schema'
import { eq } from 'drizzle-orm'
import * as Sentry from '@sentry/node'
import { createRekognitionClientFromEnv } from '../lib/rekognition'
import { createGeminiClientFromEnv } from '../lib/gemini'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

async function uploadToB2(imageBuffer: Buffer, jobId: string): Promise<string> {
  const client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APP_KEY!,
    },
  })
  const key = `card-photos/${jobId}.png`
  await client.send(new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    Body: imageBuffer,
    ContentType: 'image/png',
  }))
  return `${process.env.B2_PUBLIC_URL}/${key}`
}

async function transitionJob(
  jobId: string,
  state: 'processing' | 'complete' | 'failed',
  extras?: { photoUrl?: string; errorMessage?: string }
) {
  await db
    .update(cardPhotoJobs)
    .set({ state, ...extras, updatedAt: new Date() })
    .where(eq(cardPhotoJobs.id, jobId))
}

export async function processCardGenerationJob(jobId: string): Promise<void> {
  // Transition: pending → processing
  await transitionJob(jobId, 'processing')

  const job = await db
    .select()
    .from(cardPhotoJobs)
    .where(eq(cardPhotoJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0])

  if (!job) return

  // Fetch player's current photo to use as Gemini input
  const player = await db
    .select({ profilePhotoCardUrl: players.profilePhotoCardUrl })
    .from(players)
    .where(eq(players.id, job.playerId))
    .limit(1)
    .then((rows) => rows[0])

  // MVP: player must have a raw photo already at profilePhotoCardUrl.
  // The upload UI is out of scope for Story 5.3 — job fails gracefully if missing.
  const inputPhotoUrl = player?.profilePhotoCardUrl
  if (!inputPhotoUrl) {
    await transitionJob(jobId, 'failed', { errorMessage: 'NO_INPUT_PHOTO' })
    Sentry.captureMessage('Card generation failed: no input photo', {
      extra: { jobId, playerId: job.playerId, step: 'rekognition' },
    })
    return
  }

  // Fetch input photo bytes
  let inputBytes: Buffer
  try {
    const response = await fetch(inputPhotoUrl)
    inputBytes = Buffer.from(await response.arrayBuffer())
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'FETCH_INPUT_FAILED' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'rekognition' } })
    return
  }

  // Step 1: Rekognition — face detection + content moderation
  try {
    const rekognition = createRekognitionClientFromEnv()
    const result = await rekognition.checkImage(inputBytes)
    if (!result.hasFace) {
      await transitionJob(jobId, 'failed', { errorMessage: 'NO_FACE_DETECTED' })
      Sentry.captureMessage('Card generation failed: no face detected', {
        extra: { jobId, playerId: job.playerId, step: 'rekognition' },
      })
      return
    }
    if (result.isFlagged) {
      await transitionJob(jobId, 'failed', { errorMessage: `CONTENT_FLAGGED:${result.flagReason}` })
      Sentry.captureMessage('Card generation failed: content flagged', {
        extra: { jobId, playerId: job.playerId, step: 'rekognition', flagReason: result.flagReason },
      })
      return
    }
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'REKOGNITION_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'rekognition' } })
    return
  }

  // Step 2: Gemini Flash — generate stylized card photo
  let generatedBytes: Buffer
  try {
    const gemini = createGeminiClientFromEnv()
    generatedBytes = await gemini.generateCardPhoto(
      inputBytes.toString('base64'),
      'image/jpeg'
    )
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'GEMINI_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'gemini' } })
    return
  }

  // Step 3: Upload to Backblaze B2
  let photoUrl: string
  try {
    photoUrl = await uploadToB2(generatedBytes, jobId)
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'UPLOAD_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'upload' } })
    return
  }

  // All steps passed — atomically transition to complete + update player photo
  await db.transaction(async (tx) => {
    await tx.update(cardPhotoJobs)
      .set({ state: 'complete', photoUrl, updatedAt: new Date() })
      .where(eq(cardPhotoJobs.id, jobId))
    await tx.update(players)
      .set({ profilePhotoCardUrl: photoUrl })
      .where(eq(players.id, job.playerId))
  })
}
